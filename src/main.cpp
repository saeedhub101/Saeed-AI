#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellscalingapi.h>
#include <shellapi.h>
#include <wrl.h>
#include <WebView2.h>
#include <winhttp.h>
#include <wincrypt.h>
#include <wincodec.h>
#include <shlobj.h>
#include <cctype>
#include <tlhelp32.h>
#include <nlohmann/json.hpp>

#include <algorithm>
#include <atomic>
#include <condition_variable>
#include <fstream>
#include <filesystem>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
using json=nlohmann::json;

namespace {
HWND g_hwnd=nullptr;
ComPtr<ICoreWebView2Controller> g_controller;
ComPtr<ICoreWebView2> g_webview;
std::mutex g_confirmMutex;
std::condition_variable g_confirmCv;
std::string g_confirmId;
bool g_confirmValue=false;
std::atomic_uint64_t g_requestId{0};
std::atomic_bool g_shuttingDown{false};

void WriteLog(const std::string& message){
    try{
        std::wstring p=std::wstring([]{wchar_t b[MAX_PATH]{};GetEnvironmentVariableW(L"LOCALAPPDATA",b,MAX_PATH);return b;}())+L"\\Saeed\\saeed.log";
        std::filesystem::path fp(p); std::filesystem::create_directories(fp.parent_path());
        std::ofstream f(Utf8(p),std::ios::app); if(f) f<<message<<"\\n";
    }catch(...){ }
}

std::wstring AppDirectory(){
    wchar_t b[MAX_PATH]{};
    DWORD n=GetModuleFileNameW(nullptr,b,MAX_PATH);
    std::wstring p(b,n);
    auto i=p.find_last_of(L"\\/");
    return i==std::wstring::npos?L".":p.substr(0,i);
}
std::wstring HistoryPath(){wchar_t b[MAX_PATH]{};GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);return std::wstring(b)+L"\\Saeed\\history.json";}
std::wstring MemoryPath(){wchar_t b[MAX_PATH]{};GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);return std::wstring(b)+L"\\Saeed\\memory.json";}
std::wstring SettingsPath(){
    wchar_t b[MAX_PATH]{};
    GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);
    return std::wstring(b)+L"\\Saeed\\settings.json";
}
std::string Utf8(const std::wstring& s){
    if(s.empty()) return {};
    int n=WideCharToMultiByte(CP_UTF8,0,s.data(),(int)s.size(),nullptr,0,nullptr,nullptr);
    std::string r(n,'\0'); WideCharToMultiByte(CP_UTF8,0,s.data(),(int)s.size(),r.data(),n,nullptr,nullptr); return r;
}
std::wstring Wide(const std::string& s){
    if(s.empty()) return {};
    int n=MultiByteToWideChar(CP_UTF8,0,s.data(),(int)s.size(),nullptr,0);
    std::wstring r(n,L'\0'); MultiByteToWideChar(CP_UTF8,0,s.data(),(int)s.size(),r.data(),n); return r;
}

std::string Base64Encode(const std::vector<BYTE>& data){
    if(data.empty()) return {};
    DWORD need=0;
    if(!CryptBinaryToStringA(data.data(),(DWORD)data.size(),CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,nullptr,&need)) return {};
    std::string out(need,'\0');
    if(!CryptBinaryToStringA(data.data(),(DWORD)data.size(),CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,out.data(),&need)) return {};
    if(!out.empty()&&out.back()=='\0')out.pop_back();
    return out;
}
struct MonitorCaptureContext{int wanted=-1;int index=0;RECT rect{};bool found=false;};
BOOL CALLBACK FindMonitorForCapture(HMONITOR m,HDC,LPRECT,LPARAM lp){
    auto* c=reinterpret_cast<MonitorCaptureContext*>(lp);
    if(c->wanted<0||c->index++==c->wanted){MONITORINFO mi{sizeof(mi)};if(GetMonitorInfoW(m,&mi)){c->rect=mi.rcMonitor;c->found=true;return FALSE;}}
    return TRUE;
}
std::string CaptureMonitorJpeg(int monitorIndex){
    // Limit capture size to keep vision requests practical on 4K/8K monitors.
    MonitorCaptureContext ctx;ctx.wanted=monitorIndex;
    EnumDisplayMonitors(nullptr,nullptr,FindMonitorForCapture,reinterpret_cast<LPARAM>(&ctx));
    if(!ctx.found) return {};
    int w=ctx.rect.right-ctx.rect.left,h=ctx.rect.bottom-ctx.rect.top;
    HDC screen=GetDC(nullptr),mem=CreateCompatibleDC(screen);
    if(!screen||!mem){if(mem)DeleteDC(mem);if(screen)ReleaseDC(nullptr,screen);return {};}
    const int maxWidth=1920;
    const int maxHeight=1080;
    int capW=w, capH=h;
    double scale=std::min(1.0,std::min((double)maxWidth/w,(double)maxHeight/h));
    capW=std::max(1,(int)(w*scale)); capH=std::max(1,(int)(h*scale));
    HBITMAP bmp=CreateCompatibleBitmap(screen,capW,capH);
    if(!bmp){DeleteDC(mem);ReleaseDC(nullptr,screen);return {};}
    HGDIOBJ old=SelectObject(mem,bmp);
    SetStretchBltMode(mem,HALFTONE);
    BOOL copied=StretchBlt(mem,0,0,capW,capH,screen,ctx.rect.left,ctx.rect.top,w,h,SRCCOPY|CAPTUREBLT);
    SelectObject(mem,old);ReleaseDC(nullptr,screen);
    if(!copied){DeleteObject(bmp);DeleteDC(mem);return {};}
    HRESULT ci=CoInitializeEx(nullptr,COINIT_MULTITHREADED);
    bool uninit=SUCCEEDED(ci);
    ComPtr<IWICImagingFactory> factory;
    HRESULT hr=CoCreateInstance(CLSID_WICImagingFactory,nullptr,CLSCTX_INPROC_SERVER,IID_PPV_ARGS(&factory));
    ComPtr<IWICBitmap> wb;
    if(SUCCEEDED(hr))hr=factory->CreateBitmapFromHBITMAP(bmp,nullptr,WICBitmapUseAlpha,&wb);
    DeleteObject(bmp);DeleteDC(mem);
    if(FAILED(hr)){if(uninit)CoUninitialize();return {};}
    IStream* rawStream=SHCreateMemStream(nullptr,0);
    if(!rawStream){if(uninit)CoUninitialize();return {};}
    ComPtr<IStream> stream;stream.Attach(rawStream);
    ComPtr<IWICBitmapEncoder> enc;
    hr=factory->CreateEncoder(GUID_ContainerFormatJpeg,nullptr,&enc);
    if(SUCCEEDED(hr))hr=enc->Initialize(stream.Get(),WICBitmapEncoderNoCache);
    ComPtr<IWICBitmapFrameEncode> frame;
    ComPtr<IPropertyBag2> props;
    if(SUCCEEDED(hr))hr=enc->CreateNewFrame(&frame,&props);
    if(SUCCEEDED(hr))hr=frame->Initialize(props.Get());
    if(SUCCEEDED(hr))hr=frame->SetSize((UINT)capW,(UINT)capH);
    if(SUCCEEDED(hr)){WICPixelFormatGUID fmt=GUID_WICPixelFormat24bppBGR;hr=frame->SetPixelFormat(&fmt);}
    if(SUCCEEDED(hr))hr=frame->WriteSource(wb.Get(),nullptr);
    if(SUCCEEDED(hr))hr=frame->Commit();
    if(SUCCEEDED(hr))hr=enc->Commit();
    if(FAILED(hr)){if(uninit)CoUninitialize();return {};}
    STATSTG st{};hr=stream->Stat(&st,STATFLAG_NONAME);
    if(FAILED(hr)||st.cbSize.HighPart!=0){if(uninit)CoUninitialize();return {};}
    ULONG size=(ULONG)st.cbSize.LowPart;
    LARGE_INTEGER zero{};stream->Seek(zero,STREAM_SEEK_SET,nullptr);
    std::vector<BYTE> bytes(size);ULONG read=0;
    hr=stream->Read(bytes.data(),size,&read);
    if(uninit)CoUninitialize();
    if(FAILED(hr)||read!=size)return {};
    return Base64Encode(bytes);
}
std::string ProtectSecret(const std::string& plain){
    if(plain.empty()) return {};
    DATA_BLOB in{(DWORD)plain.size(),(BYTE*)plain.data()}, out{};
    if(!CryptProtectData(&in,L"Saeed API Key",nullptr,nullptr,nullptr,CRYPTPROTECT_UI_FORBIDDEN,&out)) return plain;
    DWORD need=0; CryptBinaryToStringA(out.pbData,out.cbData,CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,nullptr,&need);
    std::string b64(need,'\0'); CryptBinaryToStringA(out.pbData,out.cbData,CRYPT_STRING_BASE64|CRYPT_STRING_NOCRLF,b64.data(),&need);
    LocalFree(out.pbData); if(!b64.empty() && b64.back()=='\0') b64.pop_back(); return "DPAPI:"+b64;
}
std::string UnprotectSecret(const std::string& stored){
    if(stored.rfind("DPAPI:",0)!=0) return stored;
    std::string b64=stored.substr(6); DWORD bytes=0;
    if(!CryptStringToBinaryA(b64.c_str(),0,CRYPT_STRING_BASE64,nullptr,&bytes,nullptr,nullptr)) return {};
    std::vector<BYTE> buf(bytes); if(!CryptStringToBinaryA(b64.c_str(),0,CRYPT_STRING_BASE64,buf.data(),&bytes,nullptr,nullptr)) return {};
    DATA_BLOB in{bytes,buf.data()}, out{};
    if(!CryptUnprotectData(&in,nullptr,nullptr,nullptr,nullptr,CRYPTPROTECT_UI_FORBIDDEN,&out)) return {};
    std::string plain((char*)out.pbData,out.cbData); LocalFree(out.pbData); return plain;
}

json LoadSettings(){
    std::ifstream f(Utf8(SettingsPath()));
    if(!f) return {{"provider","openrouter"},{"baseUrl","https://openrouter.ai/api/v1"},{"model","openai/gpt-5.1"},{"apiKey",""},{"maxSteps",12}};
    try { json j; f>>j; if(j.contains("apiKey")) j["apiKey"]=UnprotectSecret(j.value("apiKey","")); return j; } catch(...) { return {{"provider","openrouter"},{"baseUrl","https://openrouter.ai/api/v1"},{"model","openai/gpt-5.1"},{"apiKey",""},{"maxSteps",12}}; }
}
json LoadArrayFile(const std::wstring& p){
    std::ifstream f(Utf8(p));if(!f)return json::array();
    try{json j;f>>j;return j.is_array()?j:json::array();}catch(...){return json::array();}
}
void SaveArrayFile(const std::wstring& p,const json& j){
    size_t slash=p.find_last_of(L"\\/");
    if(slash!=std::wstring::npos)CreateDirectoryW(p.substr(0,slash).c_str(),nullptr);
    std::ofstream f(Utf8(p));f<<j.dump(2);
}
void SaveSettings(const json& j){
    std::wstring p=SettingsPath();
    size_t slash=p.find_last_of(L"\\/");
    if(slash!=std::wstring::npos) CreateDirectoryW(p.substr(0,slash).c_str(),nullptr);
    json out=j; if(out.contains("apiKey")) out["apiKey"]=ProtectSecret(out.value("apiKey","")); std::ofstream f(Utf8(p)); f<<out.dump(2);
}
void ResizeWebView(){if(!g_controller)return;RECT r{};GetClientRect(g_hwnd,&r);g_controller->put_Bounds(r);}
void KeepOnCurrentWorkArea(){
    HMONITOR m=MonitorFromWindow(g_hwnd,MONITOR_DEFAULTTONEAREST); MONITORINFO mi{sizeof(mi)};
    if(!GetMonitorInfoW(m,&mi))return; RECT r=mi.rcWork,w{};GetWindowRect(g_hwnd,&w);
    int ww=w.right-w.left,hh=w.bottom-w.top,margin=24;
    int x=std::clamp(r.right-ww-margin,r.left,r.right-ww);
    int y=std::clamp(r.bottom-hh-margin,r.top,r.bottom-hh);
    SetWindowPos(g_hwnd,HWND_TOPMOST,x,y,ww,hh,SWP_NOACTIVATE|SWP_SHOWWINDOW);
}
void PostJson(const json& j){
    if(!g_hwnd)return;
    auto* p=new std::wstring(Wide(j.dump()));
    PostMessageW(g_hwnd,WM_APP+1,0,reinterpret_cast<LPARAM>(p));
}
void AskConfirmation(const std::string& name,const json& args){
    const std::string id=std::to_string(++g_requestId);
    {
        std::lock_guard<std::mutex> l(g_confirmMutex);
        g_confirmId=id; g_confirmValue=false;
    }
    PostJson({{"type","confirm"},{"id",id},{"name",name},{"args",args}});
    std::unique_lock<std::mutex> l(g_confirmMutex);
    g_confirmCv.wait(l,[&]{return g_confirmId!=id;});
}
bool WaitConfirmation(const std::string& name,const json& args){
    const std::string id=std::to_string(++g_requestId);
    {
        std::lock_guard<std::mutex> l(g_confirmMutex);
        g_confirmId=id; g_confirmValue=false;
    }
    PostJson({{"type","confirm"},{"id",id},{"name",name},{"args",args}});
    std::unique_lock<std::mutex> l(g_confirmMutex);
    g_confirmCv.wait(l,[&]{return g_confirmId!=id;});
    return g_confirmValue;
}

std::string HttpPostJson(const std::string& url,const std::string& apiKey,const json& body){
    std::wstring wurl=Wide(url);
    size_t scheme=wurl.find(L"://"); if(scheme==std::wstring::npos)throw std::runtime_error("Invalid API URL");
    bool https=wurl.substr(0,scheme)==L"https";
    size_t hs=scheme+3, slash=wurl.find(L'/',hs);
    std::wstring host=(slash==std::wstring::npos?wurl.substr(hs):wurl.substr(hs,slash-hs));
    std::wstring path=(slash==std::wstring::npos?L"/":wurl.substr(slash));
    INTERNET_PORT port=https?INTERNET_DEFAULT_HTTPS_PORT:INTERNET_DEFAULT_HTTP_PORT;
    size_t colon=host.rfind(L':');
    if(colon!=std::wstring::npos){port=(INTERNET_PORT)std::stoi(host.substr(colon+1));host=host.substr(0,colon);}
    HINTERNET ses=WinHttpOpen(L"Saeed/1.0",WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,nullptr,nullptr,0);
    if(!ses)throw std::runtime_error("WinHTTP unavailable");
    HINTERNET con=WinHttpConnect(ses,host.c_str(),port,0);
    if(!con){WinHttpCloseHandle(ses);throw std::runtime_error("Cannot connect to AI provider");}
    HINTERNET req=WinHttpOpenRequest(con,L"POST",path.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,https?WINHTTP_FLAG_SECURE:0);
    if(!req){WinHttpCloseHandle(con);WinHttpCloseHandle(ses);throw std::runtime_error("Cannot create HTTP request");}
    std::wstring headers=L"Content-Type: application/json\r\nAuthorization: Bearer "+Wide(apiKey)+L"\r\n";
    std::string data=body.dump();
    BOOL ok=WinHttpSendRequest(req,headers.c_str(),(DWORD)-1L,(LPVOID)data.data(),(DWORD)data.size(),(DWORD)data.size(),0);
    if(!ok||!WinHttpReceiveResponse(req,nullptr)){WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);throw std::runtime_error("AI request failed");}
    std::string out;DWORD avail=0;
    while(WinHttpQueryDataAvailable(req,&avail)&&avail){char buf[8192];DWORD n=0;WinHttpReadData(req,buf,(DWORD)std::min<DWORD>(avail,sizeof(buf)),&n);out.append(buf,n);}
    WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);return out;
}

json ToolSchemas(){
    return json::parse(R"JSON([
      {"type":"function","function":{"name":"system_info","description":"Get Windows computer information.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"active_window","description":"Get the currently focused Windows window.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"list_windows","description":"List visible Windows applications.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"focus_window","description":"Bring a visible Windows window to the foreground by part of its title. Requires confirmation.","parameters":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"]}}},
      {"type":"function","function":{"name":"monitor_info","description":"Get all connected monitor work areas, sizes and primary monitor information.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"screen_capture","description":"Capture a JPEG screenshot of a connected monitor so the AI can visually inspect the current desktop. Use monitor index from monitor_info; -1 captures the primary monitor.","parameters":{"type":"object","properties":{"monitor":{"type":"integer","description":"Zero-based monitor index. Use -1 for primary monitor."}},"required":["monitor"]}}},
      {"type":"function","function":{"name":"wait","description":"Wait briefly for a Windows UI transition to finish before inspecting or taking the next action. Maximum 5000 milliseconds.","parameters":{"type":"object","properties":{"milliseconds":{"type":"integer","minimum":100,"maximum":5000}},"required":["milliseconds"]}}},
      {"type":"function","function":{"name":"open_application","description":"Open a Windows application or executable. Requires confirmation.","parameters":{"type":"object","properties":{"application":{"type":"string"}},"required":["application"]}}},
      {"type":"function","function":{"name":"list_directory","description":"List files and folders in a directory.","parameters":{"type":"object","properties":{"directory":{"type":"string"}},"required":["directory"]}}},
      {"type":"function","function":{"name":"file_operation","description":"Copy, move, rename or delete a file or folder. Requires confirmation.","parameters":{"type":"object","properties":{"operation":{"type":"string","enum":["copy","move","rename","delete"]},"source":{"type":"string"},"destination":{"type":"string"}},"required":["operation","source"]}}},
      {"type":"function","function":{"name":"process_list","description":"List running Windows processes with names and process IDs.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"read_file","description":"Read a UTF-8 text file up to 200KB.","parameters":{"type":"object","properties":{"filePath":{"type":"string"}},"required":["filePath"]}}},
      {"type":"function","function":{"name":"write_file","description":"Write a UTF-8 text file. Requires confirmation.","parameters":{"type":"object","properties":{"filePath":{"type":"string"},"content":{"type":"string"}},"required":["filePath","content"]}}},
      {"type":"function","function":{"name":"mouse_move","description":"Move the mouse to screen coordinates.","parameters":{"type":"object","properties":{"x":{"type":"integer"},"y":{"type":"integer"}},"required":["x","y"]}}},
      {"type":"function","function":{"name":"mouse_click","description":"Click at screen coordinates. Requires confirmation. For GUI tasks, set verify_after=true to wait briefly and automatically capture the same monitor so the AI can visually verify the result.","parameters":{"type":"object","properties":{"x":{"type":"integer"},"y":{"type":"integer"},"button":{"type":"string","enum":["left","right"]},"verify_after":{"type":"boolean","description":"Wait and capture the target monitor after the click for visual verification."},"monitor":{"type":"integer","description":"Monitor index for verification capture. Use -1 for primary monitor."}},"required":["x","y"]}}},
      {"type":"function","function":{"name":"type_text","description":"Type text into the focused application. Requires confirmation.","parameters":{"type":"object","properties":{"text":{"type":"string"}},"required":["text"]}}},
      {"type":"function","function":{"name":"key_press","description":"Press a Windows key or shortcut such as ENTER, ESC, CTRL+C, CTRL+V, CTRL+A, ALT+F4, WIN+D or arrows. Requires confirmation.","parameters":{"type":"object","properties":{"key":{"type":"string"}},"required":["key"]}}},
      {"type":"function","function":{"name":"remember","description":"Store a fact in Saeed's persistent memory when the user explicitly asks you to remember it.","parameters":{"type":"object","properties":{"fact":{"type":"string"}},"required":["fact"]}}},
      {"type":"function","function":{"name":"recall","description":"Search Saeed's persistent memory for relevant facts.","parameters":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}}
    ])JSON");
}

json ExecuteTool(const std::string& name,const json& a){
    if(name=="system_info"){
        SYSTEM_INFO si{};GetSystemInfo(&si);MEMORYSTATUSEX ms{sizeof(ms)};GlobalMemoryStatusEx(&ms);
        return {{"ok",true},{"processors",si.dwNumberOfProcessors},{"memoryGB",ms.ullTotalPhys/1024.0/1024.0/1024.0},{"memoryFreeGB",ms.ullAvailPhys/1024.0/1024.0/1024.0}};
    }
    if(name=="active_window"){
        HWND h=GetForegroundWindow();wchar_t title[512]{};GetWindowTextW(h,title,512);DWORD pid=0;GetWindowThreadProcessId(h,&pid);
        return {{"ok",true},{"title",Utf8(title)},{"pid",pid}};
    }
    if(name=="list_windows"){
        json arr=json::array();
        EnumWindows([](HWND h,LPARAM lp)->BOOL{if(!IsWindowVisible(h))return TRUE;wchar_t t[512]{};GetWindowTextW(h,t,512);if(!t[0])return TRUE;auto* a=reinterpret_cast<json*>(lp);DWORD pid=0;GetWindowThreadProcessId(h,&pid);a->push_back({{"title",Utf8(t)},{"pid",pid}});return TRUE;},reinterpret_cast<LPARAM>(&arr));
        return {{"ok",true},{"windows",arr}};
    }
    if(name=="monitor_info"){
        json arr=json::array();
        struct Ctx{json* out;};
        Ctx ctx{&arr};
        EnumDisplayMonitors(nullptr,nullptr,[](HMONITOR m,HDC,LPRECT,LPARAM lp)->BOOL{
            MONITORINFO mi{sizeof(mi)};if(!GetMonitorInfoW(m,&mi))return TRUE;
            auto* out=reinterpret_cast<Ctx*>(lp)->out;
            RECT r=mi.rcMonitor,w=mi.rcWork;
            out->push_back({{"primary",(mi.dwFlags&MONITORINFOF_PRIMARY)!=0},
                            {"x",r.left},{"y",r.top},{"width",r.right-r.left},{"height",r.bottom-r.top},
                            {"workX",w.left},{"workY",w.top},{"workWidth",w.right-w.left},{"workHeight",w.bottom-w.top}});
            return TRUE;
        },reinterpret_cast<LPARAM>(&ctx));
        return {{"ok",true},{"monitors",arr}};
    }
    if(name=="wait"){
        int ms=std::clamp(a.value("milliseconds",500),100,5000);
        Sleep((DWORD)ms);
        return {{"ok",true},{"waited_ms",ms}};
    }
    if(name=="screen_capture"){
        int requested=a.value("monitor",-1);
        if(requested<0){
            HMONITOR primary=MonitorFromWindow(g_hwnd,MONITOR_DEFAULTTOPRIMARY);
            json monitors=json::array();
            EnumDisplayMonitors(nullptr,nullptr,[](HMONITOR m,HDC,LPRECT,LPARAM lp)->BOOL{
                auto* out=reinterpret_cast<json*>(lp);MONITORINFO mi{sizeof(mi)};
                if(GetMonitorInfoW(m,&mi)){out->push_back({{"primary",(mi.dwFlags&MONITORINFOF_PRIMARY)!=0}});}
                return TRUE;
            },reinterpret_cast<LPARAM>(&monitors));
            requested=0;for(size_t i=0;i<monitors.size();++i)if(monitors[i].value("primary",false)){requested=(int)i;break;}
        }
        std::string b64=CaptureMonitorJpeg(requested);
        if(b64.empty())return {{"ok",false},{"error","Screen capture failed"}};
        return {{"ok",true},{"monitor",requested},{"mime","image/jpeg"},{"image_base64",b64}};
    }
    if(name=="focus_window"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::string q=a.value("title","");
        HWND found=nullptr;
        std::pair<std::string,HWND*> search{q,&found};
        EnumWindows([](HWND h,LPARAM lp)->BOOL{
            auto* p=reinterpret_cast<std::pair<std::string,HWND*>*>(lp);
            if(!IsWindowVisible(h))return TRUE;
            wchar_t t[512]{};GetWindowTextW(h,t,512);std::string title=Utf8(t);
            std::string hay=title, needle=p->first;
            std::transform(hay.begin(),hay.end(),hay.begin(),[](char c){return (char)tolower((unsigned char)c);});
            std::transform(needle.begin(),needle.end(),needle.begin(),[](char c){return (char)tolower((unsigned char)c);});
            if(!needle.empty()&&hay.find(needle)!=std::string::npos){*p->second=h;return FALSE;} return TRUE;
        },reinterpret_cast<LPARAM>(&search));
        if(!found)return {{"ok",false},{"error","Window not found"}};
        ShowWindow(found,SW_RESTORE);SetForegroundWindow(found);
        return {{"ok",true}};
    }
    if(name=="open_application"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        HINSTANCE r=ShellExecuteW(nullptr,L"open",Wide(a.value("application","")).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
        return {{"ok",((INT_PTR)r)>32}};
    }
    if(name=="list_directory"){
        std::string dir=a.value("directory",".");json arr=json::array();
        try{for(auto& p:std::filesystem::directory_iterator(Wide(dir))){arr.push_back({{"name",Utf8(p.path().filename().wstring())},{"directory",p.is_directory()}});}return {{"ok",true},{"files",arr}};}
        catch(const std::exception& e){return {{"ok",false},{"error",e.what()}};}
    }
    if(name=="process_list"){
        json arr=json::array();
        HANDLE snap=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0);
        if(snap==INVALID_HANDLE_VALUE)return {{"ok",false},{"error","Cannot enumerate processes"}};
        PROCESSENTRY32W pe{sizeof(pe)};
        if(Process32FirstW(snap,&pe)){do{arr.push_back({{"name",Utf8(pe.szExeFile)},{"pid",pe.th32ProcessID}});}while(Process32NextW(snap,&pe));}
        CloseHandle(snap); return {{"ok",true},{"processes",arr}};
    }
    if(name=="file_operation"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::filesystem::path src=Wide(a.value("source",""));
        std::string op=a.value("operation","");
        try{
            if(op=="delete"){std::filesystem::remove_all(src);return {{"ok",true},{"operation",op},{"source",a.value("source","")}};}
            std::filesystem::path dst=Wide(a.value("destination",""));
            if(op=="copy"){
                if(std::filesystem::is_directory(src))std::filesystem::copy(src,dst,std::filesystem::copy_options::recursive|std::filesystem::copy_options::overwrite_existing);
                else std::filesystem::copy_file(src,dst,std::filesystem::copy_options::overwrite_existing);
            }else if(op=="move"){std::filesystem::rename(src,dst);}
            else if(op=="rename"){std::filesystem::rename(src,dst);}
            else return {{"ok",false},{"error","Unsupported file operation"}};
            return {{"ok",true},{"operation",op},{"source",a.value("source","")},{"destination",a.value("destination","")}};
        }catch(const std::exception& e){return {{"ok",false},{"error",e.what()}};}
    }
    if(name=="read_file"){
        std::ifstream f(Utf8(Wide(a.value("filePath",""))));if(!f)return {{"ok",false},{"error","File not found or cannot be opened"}};
        std::ostringstream ss;ss<<f.rdbuf();std::string text=ss.str();if(text.size()>200000)text.resize(200000);
        return {{"ok",true},{"content",text}};
    }
    if(name=="write_file"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::wstring p=Wide(a.value("filePath",""));size_t slash=p.find_last_of(L"\\/");
        if(slash!=std::wstring::npos)CreateDirectoryW(p.substr(0,slash).c_str(),nullptr);
        std::ofstream f(Utf8(p));if(!f)return {{"ok",false},{"error","Cannot open destination"}};
        f<<a.value("content","");return {{"ok",true},{"path",a.value("filePath","")}};
    }
    if(name=="mouse_move"){SetCursorPos(a.value("x",0),a.value("y",0));return {{"ok",true}};}
    if(name=="mouse_click"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        SetCursorPos(a.value("x",0),a.value("y",0));bool right=a.value("button","left")=="right";INPUT in[2]{};in[0].type=in[1].type=INPUT_MOUSE;in[0].mi.dwFlags=right?MOUSEEVENTF_RIGHTDOWN:MOUSEEVENTF_LEFTDOWN;in[1].mi.dwFlags=right?MOUSEEVENTF_RIGHTUP:MOUSEEVENTF_LEFTUP;SendInput(2,in,sizeof(INPUT));return {{"ok",true}};
    }
    if(name=="type_text"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::wstring text=Wide(a.value("text",""));std::vector<INPUT> in;for(wchar_t ch:text){INPUT i{};i.type=INPUT_KEYBOARD;i.ki.wScan=ch;i.ki.dwFlags=KEYEVENTF_UNICODE;in.push_back(i);i.ki.dwFlags=KEYEVENTF_UNICODE|KEYEVENTF_KEYUP;in.push_back(i);}if(!in.empty())SendInput((UINT)in.size(),in.data(),sizeof(INPUT));return {{"ok",true}};
    }
    if(name=="key_press"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::string k=a.value("key","");
        std::transform(k.begin(),k.end(),k.begin(),[](char ch){return (char)toupper((unsigned char)ch);});
        auto vk=[&](const std::string& s)->WORD{
            if(s=="ENTER")return VK_RETURN;if(s=="ESC"||s=="ESCAPE")return VK_ESCAPE;if(s=="TAB")return VK_TAB;
            if(s=="SPACE")return VK_SPACE;if(s=="BACKSPACE")return VK_BACK;if(s=="DELETE"||s=="DEL")return VK_DELETE;
            if(s=="UP")return VK_UP;if(s=="DOWN")return VK_DOWN;if(s=="LEFT")return VK_LEFT;if(s=="RIGHT")return VK_RIGHT;
            if(s=="HOME")return VK_HOME;if(s=="END")return VK_END;if(s=="PGUP")return VK_PRIOR;if(s=="PGDN")return VK_NEXT;
            if(s=="CTRL"||s=="CONTROL")return VK_CONTROL;if(s=="ALT")return VK_MENU;if(s=="SHIFT")return VK_SHIFT;
            if(s=="WIN"||s=="WINDOWS")return VK_LWIN;
            if(s.size()==1)return (WORD)s[0]; return 0;
        };
        std::vector<std::string> parts; size_t pos=0;
        while(true){size_t p=k.find('+',pos);parts.push_back(k.substr(pos,p==std::string::npos?k.size()-pos:p-pos));if(p==std::string::npos)break;pos=p+1;}
        std::vector<WORD> keys;for(auto& p:parts){WORD x=vk(p);if(!x)return {{"ok",false},{"error","Unsupported key: "+p}};keys.push_back(x);}
        std::vector<INPUT> in;for(WORD x:keys){INPUT i{};i.type=INPUT_KEYBOARD;i.ki.wVk=x;in.push_back(i);}
        for(auto it=keys.rbegin();it!=keys.rend();++it){INPUT i{};i.type=INPUT_KEYBOARD;i.ki.wVk=*it;i.ki.dwFlags=KEYEVENTF_KEYUP;in.push_back(i);}
        SendInput((UINT)in.size(),in.data(),sizeof(INPUT));return {{"ok",true}};
    }
    if(name=="remember"){
        auto mem=LoadArrayFile(MemoryPath());std::string fact=a.value("fact","");if(!fact.empty())mem.push_back({{"fact",fact},{"time",GetTickCount64()}});SaveArrayFile(MemoryPath(),mem);return {{"ok",true},{"saved",fact}};
    }
    if(name=="recall"){
        auto mem=LoadArrayFile(MemoryPath());std::string q=a.value("query",""),out;for(auto& x:mem){std::string fact=x.value("fact","");if(q.empty()||fact.find(q)!=std::string::npos)out+=fact+"\\n";}return {{"ok",true},{"matches",out}};
    }
    return {{"ok",false},{"error","Unknown tool"}};
}

void RunAgent(std::string text){
    std::thread([text=std::move(text)]() mutable{
        try{
            json settings=LoadSettings();
            std::string key=settings.value("apiKey",""); if(key.empty())throw std::runtime_error("ضع API key في الإعدادات أولاً.");
            std::string base=settings.value("baseUrl","https://openrouter.ai/api/v1");while(!base.empty()&&base.back()=='/')base.pop_back();
            std::string url=base+"/chat/completions";
            json history=LoadArrayFile(HistoryPath());
            json messages=json::array();
            messages.push_back({{"role","system"},{"content","You are Saeed, a helpful Windows desktop AI agent. Be concise. For GUI tasks, inspect the current state first, using active_window, monitor_info, and screen_capture when visual information is needed. Then act with the appropriate tool and verify the result with another inspection or screenshot before claiming success. Use multi-step tool chains when necessary. Before destructive or external actions, use the provided tools which may require confirmation. Never claim an action succeeded unless its tool result says so."}});
            if(history.is_array()){ size_t start=history.size()>20?history.size()-20:0; for(size_t i=start;i<history.size();++i){ if(history[i].is_object()&&history[i].contains("role")&&history[i].contains("content")) messages.push_back({{"role",history[i]["role"]},{"content",history[i]["content"]}}); } }
            messages.push_back({{"role","user"},{"content",text}});
            int maxSteps=std::clamp(settings.value("maxSteps",12),1,32);
            for(int step=0;step<maxSteps;step++){
                PostJson({{"type","status"},{"text","يفكر / ينفذ..."},{"state","think"}});
                json req={{"model",settings.value("model","openai/gpt-5.1")},{"messages",messages},{"tools",ToolSchemas()},{"tool_choice","auto"}};
                json resp=json::parse(HttpPostJson(url,key,req));
                if(!resp.contains("choices"))throw std::runtime_error(resp.value("error",json{{"message","AI provider returned no choices"}}).value("message","AI error"));
                json msg=resp["choices"][0]["message"];
                if(msg.contains("tool_calls")&&!msg["tool_calls"].empty()){
                    messages.push_back(msg);
                    for(auto& tc:msg["tool_calls"]){
                        std::string name=tc["function"].value("name","");
                        json args=json::parse(tc["function"].value("arguments","{}"));
                        PostJson({{"type","tool"},{"name",name}});
                        json result=ExecuteTool(name,args);
                        if(result.value("ok",false) && result.contains("image_base64")){
                            std::string b64=result.value("image_base64","");
                            result.erase("image_base64");
                            result["note"]="A visual screenshot is attached for verification.";
                            messages.push_back({{"role","tool"},{"tool_call_id",tc.value("id","")},{"content",result.dump()}});
                            messages.push_back({{"role","user"},{"content",json::array({
                                {{"type","text"},{"text","Here is the current desktop screenshot captured by screen_capture. Inspect it visually and use it to decide the next action."}},
                                {{"type","image_url"},{"image_url",{{"url","data:image/jpeg;base64,"+b64}}}}
                            })}});
                        }else{
                            messages.push_back({{"role","tool"},{"tool_call_id",tc.value("id","")},{"content",result.dump()}});
                        }
                    }
                    continue;
                }
                std::string answer=msg.value("content","");
                auto h=LoadArrayFile(HistoryPath()); h.push_back({{"role","user"},{"content",text}}); h.push_back({{"role","assistant"},{"content",answer}}); if(h.size()>40) h.erase(h.begin(),h.begin()+(h.size()-40)); SaveArrayFile(HistoryPath(),h);
                PostJson({{"type","answer"},{"text",answer},{"state","talk"}});
                return;
            }
            throw std::runtime_error("تم الوصول إلى حد خطوات الوكيل.");
        }catch(const std::exception& e){PostJson({{"type","error"},{"text",e.what()},{"state","idle"}});}
    }).detach();
}

void InitializeWebView(){
    std::wstring data=AppDirectory()+L"\\SaeedWebViewData";
    CreateCoreWebView2EnvironmentWithOptions(nullptr,data.c_str(),nullptr,Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([](HRESULT hr,ICoreWebView2Environment* env)->HRESULT{
        if(FAILED(hr)||!env){ WriteLog("WebView2 environment initialization failed: "+std::to_string((long)hr)); return hr; }
        return env->CreateCoreWebView2Controller(g_hwnd,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([](HRESULT hr,ICoreWebView2Controller* c)->HRESULT{
            if(FAILED(hr)||!c){ WriteLog("WebView2 controller initialization failed: "+std::to_string((long)hr)); return hr; }
            g_controller=c;ComPtr<ICoreWebView2Controller2> c2;if(SUCCEEDED(c->QueryInterface(IID_PPV_ARGS(&c2)))&&c2)c2->put_DefaultBackgroundColor(COREWEBVIEW2_COLOR{0,0,0,0});c->get_CoreWebView2(&g_webview);c->put_IsVisible(TRUE);ResizeWebView();
            g_webview->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([](ICoreWebView2*,ICoreWebView2WebMessageReceivedEventArgs* args)->HRESULT{
                LPWSTR raw=nullptr;if(FAILED(args->get_WebMessageAsJson(&raw)))return S_OK;
                try{
                    json j=json::parse(Utf8(raw));CoTaskMemFree(raw);raw=nullptr;
                    std::string type=j.value("type","");
                    if(type=="chat")RunAgent(j.value("text",""));
                    else if(type=="confirm"){
                        std::lock_guard<std::mutex> l(g_confirmMutex);g_confirmValue=j.value("approved",false);g_confirmId="done";g_confirmCv.notify_all();
                    } else if(type=="settings"){
                        json s=LoadSettings();s["provider"]=j.value("provider",s.value("provider","openrouter"));s["baseUrl"]=j.value("baseUrl",s.value("baseUrl","https://openrouter.ai/api/v1"));s["model"]=j.value("model",s.value("model","openai/gpt-5.1"));s["maxSteps"]=j.value("maxSteps",12);if(j.contains("apiKey")&&!j["apiKey"].get<std::string>().empty())s["apiKey"]=j["apiKey"];SaveSettings(s);PostJson({{"type","settingsSaved"}});
                    }
                }catch(...){if(raw)CoTaskMemFree(raw);}
                return S_OK;
            }).Get(),nullptr);
            std::wstring url=L"file:///"+AppDirectory()+L"/assets/avatar.html";\n            HRESULT nav=g_webview->Navigate(url.c_str());\n            if(FAILED(nav)) WriteLog("Avatar navigation failed: "+std::to_string((long)nav));\n            return S_OK;
        }).Get());
    }).Get());
}
LRESULT CALLBACK WndProc(HWND h,UINT msg,WPARAM wp,LPARAM lp){
    switch(msg){
        case WM_APP+1:{auto* p=reinterpret_cast<std::wstring*>(lp);if(g_webview&&p){g_webview->PostWebMessageAsJson(p->c_str());}delete p;return 0;}
        case WM_NCHITTEST:return HTCLIENT;\n        case WM_MOUSEACTIVATE:return MA_NOACTIVATE;
        case WM_DISPLAYCHANGE:case WM_DPICHANGED:ResizeWebView();KeepOnCurrentWorkArea();return 0;
        case WM_SIZE:ResizeWebView();return 0;
        case WM_DESTROY:g_shuttingDown=true;g_webview.Reset();g_controller.Reset();PostQuitMessage(0);return 0;
    }
    return DefWindowProcW(h,msg,wp,lp);
}
}
int APIENTRY wWinMain(HINSTANCE inst,HINSTANCE,LPWSTR,int){
    SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
    const wchar_t* cn=L"SaeedNativeWindow";WNDCLASSEXW wc{sizeof(wc)};wc.hInstance=inst;wc.lpfnWndProc=WndProc;wc.lpszClassName=cn;wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);
    if(!RegisterClassExW(&wc))return 1;
    g_hwnd=CreateWindowExW(WS_EX_LAYERED|WS_EX_TOOLWINDOW|WS_EX_TOPMOST,cn,L"Saeed AI",WS_POPUP,100,100,420,700,nullptr,nullptr,inst,nullptr);
    if(!g_hwnd)return 2;
    SetLayeredWindowAttributes(g_hwnd,0,255,LWA_ALPHA);
    ShowWindow(g_hwnd,SW_SHOWNOACTIVATE);
    UpdateWindow(g_hwnd);
    KeepOnCurrentWorkArea();
    WriteLog("Saeed C++ starting");
    InitializeWebView();
    MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}return (int)msg.wParam;
}