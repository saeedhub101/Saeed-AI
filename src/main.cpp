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
#include <shlwapi.h>
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
#include <chrono>
#include <stdexcept>
#include <utility>

#pragma comment(lib,"shlwapi.lib")

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
std::mutex g_characterStateMutex;
std::condition_variable g_characterStateCv;
std::string g_characterStateId;
json g_characterStateResult;
uint64_t g_characterStateRequestSerial=0;




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
    std::string r(n,'\0');
    WideCharToMultiByte(CP_UTF8,0,s.data(),(int)s.size(),r.data(),n,nullptr,nullptr);
    return r;
}

void WriteLog(const std::string& message){
    try{
        wchar_t b[MAX_PATH]{};
        GetEnvironmentVariableW(L"LOCALAPPDATA",b,MAX_PATH);
        std::filesystem::path fp=std::filesystem::path(b)/L"Saeed"/L"saeed.log";
        std::filesystem::create_directories(fp.parent_path());
        std::ofstream f(Utf8(fp.wstring()),std::ios::app);
        if(f) f<<message<<"\n";
    }catch(...){}
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
    if(slash!=std::wstring::npos)std::filesystem::create_directories(std::filesystem::path(p).parent_path());
    std::ofstream f(Utf8(p));f<<j.dump(2);
}
void SaveSettings(const json& j){
    std::wstring p=SettingsPath();
    size_t slash=p.find_last_of(L"\\/");
    if(slash!=std::wstring::npos) std::filesystem::create_directories(std::filesystem::path(p).parent_path());
    json out=j; if(out.contains("apiKey")) out["apiKey"]=ProtectSecret(out.value("apiKey","")); std::ofstream f(Utf8(p)); f<<out.dump(2);
}
void ResizeWebView(){if(!g_controller)return;RECT r{};GetClientRect(g_hwnd,&r);g_controller->put_Bounds(r);}
void ApplyDpiSuggestedRect(LPARAM lp){
    if(!g_hwnd||!lp)return;
    const RECT* suggested=reinterpret_cast<const RECT*>(lp);
    if(suggested){
        SetWindowPos(g_hwnd,nullptr,suggested->left,suggested->top,
                     suggested->right-suggested->left,suggested->bottom-suggested->top,
                     SWP_NOZORDER|SWP_NOACTIVATE);
    }
}
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
    if(!g_confirmCv.wait_for(l,std::chrono::seconds(60),[&]{return g_confirmId!=id;})){ g_confirmId="timeout"; return false; }
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
    DWORD status=0,statusSize=sizeof(status);
    if(!WinHttpQueryHeaders(req,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&statusSize,WINHTTP_NO_HEADER_INDEX)){
        WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);throw std::runtime_error("Cannot read AI response status");
    }
    std::string out;DWORD avail=0;
    while(WinHttpQueryDataAvailable(req,&avail)&&avail){char buf[8192];DWORD n=0;WinHttpReadData(req,buf,(DWORD)std::min<DWORD>(avail,sizeof(buf)),&n);out.append(buf,n);}
    WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);
    if(status<200||status>=300){
        try{json e=json::parse(out);std::string msg=e.value("error",json{{"message","AI provider HTTP error"}}).value("message","AI provider HTTP error");throw std::runtime_error("AI provider HTTP "+std::to_string(status)+": "+msg);}catch(const json::parse_error&){throw std::runtime_error("AI provider HTTP "+std::to_string(status));}
    }
    return out;
}

json ToolSchemas(){
    return json::parse(R"JSON([
      {"type":"function","function":{"name":"system_info","description":"Get Windows computer information.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"active_window","description":"Get the currently focused Windows window.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"list_windows","description":"List visible Windows applications.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"focus_window","description":"Bring a visible Windows window to the foreground by part of its title. Requires confirmation.","parameters":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"]}}},
      {"type":"function","function":{"name":"close_window","description":"Close a visible Windows window by part of its title. Requires confirmation.","parameters":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"]}}},
      {"type":"function","function":{"name":"minimize_window","description":"Minimize a visible Windows window by part of its title. Requires confirmation.","parameters":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"]}}},
      {"type":"function","function":{"name":"maximize_window","description":"Maximize a visible Windows window by part of its title. Requires confirmation.","parameters":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"]}}},
      {"type":"function","function":{"name":"monitor_info","description":"Get all connected monitor work areas, sizes and primary monitor information.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"screen_capture","description":"Capture a JPEG screenshot of a connected monitor so the AI can visually inspect the current desktop. Use monitor index from monitor_info; -1 captures the primary monitor.","parameters":{"type":"object","properties":{"monitor":{"type":"integer","description":"Zero-based monitor index. Use -1 for primary monitor."}},"required":["monitor"]}}},
      {"type":"function","function":{"name":"wait","description":"Wait briefly for a Windows UI transition to finish before inspecting or taking the next action. Maximum 5000 milliseconds.","parameters":{"type":"object","properties":{"milliseconds":{"type":"integer","minimum":100,"maximum":5000}},"required":["milliseconds"]}}},
      {"type":"function","function":{"name":"open_application","description":"Open a Windows application or executable. Requires confirmation.","parameters":{"type":"object","properties":{"application":{"type":"string"}},"required":["application"]}}},
      {"type":"function","function":{"name":"open_url","description":"Open a URL in the default Windows browser. Requires confirmation.","parameters":{"type":"object","properties":{"url":{"type":"string"}},"required":["url"]}}},
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
      {"type":"function","function":{"name":"recall","description":"Search Saeed's persistent memory for relevant facts.","parameters":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}},
      {"type":"function","function":{"name":"set_eye_rotation","description":"Control both Saeed eye bones. X and Z are strictly limited to -15..+15 degrees.","parameters":{"type":"object","properties":{"x":{"type":"number","minimum":-15,"maximum":15},"z":{"type":"number","minimum":-15,"maximum":15}},"required":["x","z"]}}},
      {"type":"function","function":{"name":"set_head_rotation","description":"Control Saeed head orientation. X, Y and Z are limited to -15..+15 degrees.","parameters":{"type":"object","properties":{"x":{"type":"number","minimum":-15,"maximum":15},"y":{"type":"number","minimum":-15,"maximum":15},"z":{"type":"number","minimum":-15,"maximum":15}},"required":["x","y","z"]}}},
      {"type":"function","function":{"name":"reset_character_pose","description":"Return Saeed's controller to its neutral state.","parameters":{"type":"object","properties":{}}}}},
      {"type":"function","function":{"name":"character_control","description":"Advanced non-destructive Saeed avatar controller. Controls eyes, head, neck, spine, shoulders, arms, forearms, wrists, facial morphs, blinking, breathing, talking, natural behavior and short gestures. Eye X/Z and head X/Y/Z are hard-limited to -15..+15 degrees; spine and limbs have their own safe limits.","parameters":{"type":"object","properties":{"action":{"type":"string","enum":["eyes","head","spine","neck","shoulders","wrists","arms","face","emotion","blink","gesture","breathing","talking","behavior","reset"]},"x":{"type":"number"},"y":{"type":"number"},"z":{"type":"number"},"left":{"type":"number"},"right":{"type":"number"},"leftForearm":{"type":"number"},"rightForearm":{"type":"number"},"gesture":{"type":"string","enum":["idle","nod","wave","agree","disagree","think","greet"]},"duration":{"type":"integer","minimum":100,"maximum":10000},"enabled":{"type":"boolean"},"blink":{"type":"number","minimum":0,"maximum":1},"smile":{"type":"number","minimum":0,"maximum":1},"brow":{"type":"number","minimum":-1,"maximum":1},"emotion":{"type":"string","enum":["neutral","happy","sad","surprised","angry","thinking","greeting","speaking"]},"autoBlink":{"type":"boolean"},"eyeSaccades":{"type":"boolean"},"speechGestures":{"type":"boolean"}},"required":["action"]}}}},{"type":"function","function":{"name":"character_state","description":"Read Saeed's live avatar controller state directly from the 3D character. Use this to verify eye/head/limb/facial/behavior settings after changes.","parameters":{"type":"object","properties":{}}}}
    ])JSON");
}

json ExecuteTool(const std::string& name,const json& a){
    if(name=="character_state"){
        const std::string id=std::to_string(++g_requestId);
        {
            std::lock_guard<std::mutex> lock(g_characterStateMutex);
            g_characterStateId=id;
            g_characterStateResult=json{{"ok",false},{"error","Character state request timed out"}};
        }
        PostJson({{"type","character_state_request"},{"id",id}});
        std::unique_lock<std::mutex> lock(g_characterStateMutex);
        if(!g_characterStateCv.wait_for(lock,std::chrono::seconds(3),[&]{return g_characterStateId!=id;})){
            return g_characterStateResult;
        }
        return g_characterStateResult;
    }
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
        Sleep(150);
        HWND fg=GetForegroundWindow();
        DWORD targetPid=0,fgPid=0;GetWindowThreadProcessId(found,&targetPid);GetWindowThreadProcessId(fg,&fgPid);
        return {{"ok",fg==found||fgPid==targetPid},{"verified",fg==found||fgPid==targetPid},{"title",q}};
    }
    if(name=="close_window"||name=="minimize_window"||name=="maximize_window"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::string q=a.value("title","");
        HWND found=nullptr;
        std::pair<std::string,HWND*> search{q,&found};
        EnumWindows([](HWND h,LPARAM lp)->BOOL{
            auto* p=reinterpret_cast<std::pair<std::string,HWND*>*>(lp);
            if(!IsWindowVisible(h))return TRUE;
            wchar_t t[512]{};GetWindowTextW(h,t,512);std::string title=Utf8(t);
            std::string hay=title,needle=p->first;
            std::transform(hay.begin(),hay.end(),hay.begin(),[](char c){return (char)tolower((unsigned char)c);});
            std::transform(needle.begin(),needle.end(),needle.begin(),[](char c){return (char)tolower((unsigned char)c);});
            if(!needle.empty()&&hay.find(needle)!=std::string::npos){*p->second=h;return FALSE;}
            return TRUE;
        },reinterpret_cast<LPARAM>(&search));
        if(!found)return {{"ok",false},{"error","Window not found"}};
        if(name=="close_window") PostMessageW(found,WM_CLOSE,0,0);
        else if(name=="minimize_window") ShowWindow(found,SW_MINIMIZE);
        else ShowWindow(found,SW_MAXIMIZE);
        Sleep(150);
        bool verified=false;
        if(name=="close_window") verified=!IsWindow(found)||!IsWindowVisible(found);
        else if(name=="minimize_window") verified=IsIconic(found);
        else verified=IsZoomed(found);
        return {{"ok",verified},{"verified",verified},{"title",a.value("title","")},{"action",name}};
    }
    if(name=="open_application"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        HINSTANCE r=ShellExecuteW(nullptr,L"open",Wide(a.value("application","")).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
        return {{"ok",((INT_PTR)r)>32}};
    }
    if(name=="open_url"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::string url=a.value("url","");
        if(url.rfind("https://",0)!=0 && url.rfind("http://",0)!=0)return {{"ok",false},{"error","Only http/https URLs are allowed"}};
        HINSTANCE r=ShellExecuteW(nullptr,L"open",Wide(url).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
        return {{"ok",((INT_PTR)r)>32},{"url",url}};
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
        try{if(slash!=std::wstring::npos)std::filesystem::create_directories(std::filesystem::path(p).parent_path());}catch(const std::exception& e){return {{"ok",false},{"error",e.what()}};}
        std::ofstream f(Utf8(p));if(!f)return {{"ok",false},{"error","Cannot open destination"}};
        const std::string content=a.value("content",""); f<<content;
        if(!f)return {{"ok",false},{"error","Failed while writing destination"}};
        f.flush();
        return {{"ok",true},{"path",a.value("filePath","")},{"bytes",(int64_t)content.size()}};
    }
    if(name=="mouse_move"){int x=a.value("x",0),y=a.value("y",0);BOOL moved=SetCursorPos(x,y);return {{"ok",moved!=FALSE},{"x",x},{"y",y},{"verified",moved!=FALSE}};}
    if(name=="mouse_click"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        SetCursorPos(a.value("x",0),a.value("y",0));bool right=a.value("button","left")=="right";INPUT in[2]{};in[0].type=in[1].type=INPUT_MOUSE;in[0].mi.dwFlags=right?MOUSEEVENTF_RIGHTDOWN:MOUSEEVENTF_LEFTDOWN;in[1].mi.dwFlags=right?MOUSEEVENTF_RIGHTUP:MOUSEEVENTF_LEFTUP;UINT sent=SendInput(2,in,sizeof(INPUT));
        if(sent!=2)return {{"ok",false},{"error","Windows rejected the mouse input"}};
        if(a.value("verify_after",false)){ Sleep(350); int mon=a.value("monitor",-1); if(mon<0){HMONITOR hm=MonitorFromPoint(POINT{a.value("x",0),a.value("y",0)},MONITOR_DEFAULTTONEAREST);json monitors=json::array();EnumDisplayMonitors(nullptr,nullptr,[](HMONITOR m,HDC,LPRECT,LPARAM lp)->BOOL{auto* out=reinterpret_cast<json*>(lp);MONITORINFO mi{sizeof(mi)};if(GetMonitorInfoW(m,&mi))out->push_back({{"handle",(uint64_t)(uintptr_t)m}});return TRUE;},reinterpret_cast<LPARAM>(&monitors));for(size_t i=0;i<monitors.size();++i)if(monitors[i].value("handle",0ULL)==(uint64_t)(uintptr_t)hm){mon=(int)i;break;}}
            std::string shot=CaptureMonitorJpeg(mon); if(!shot.empty())return {{"ok",true},{"verified",true},{"monitor",mon},{"mime","image/jpeg"},{"image_base64",shot}}; }
        return {{"ok",true},{"verified",false}};
    }
    if(name=="type_text"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};        std::wstring text=Wide(a.value("text",""));std::vector<INPUT> in;for(wchar_t ch:text){INPUT i{};i.type=INPUT_KEYBOARD;i.ki.wScan=ch;i.ki.dwFlags=KEYEVENTF_UNICODE;in.push_back(i);i.ki.dwFlags=KEYEVENTF_UNICODE|KEYEVENTF_KEYUP;in.push_back(i);}if(!in.empty())SendInput((UINT)in.size(),in.data(),sizeof(INPUT));return {{"ok",true}};
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
        UINT sent=SendInput((UINT)in.size(),in.data(),sizeof(INPUT));
        if(sent!=in.size())return {{"ok",false},{"error","Windows rejected some key input"},{"sent",sent},{"expected",(UINT)in.size()}};
        return {{"ok",true},{"sent",sent}};
    }
    if(name=="remember"){
        auto mem=LoadArrayFile(MemoryPath());std::string fact=a.value("fact","");if(!fact.empty())mem.push_back({{"fact",fact},{"time",GetTickCount64()}});SaveArrayFile(MemoryPath(),mem);return {{"ok",true},{"saved",fact}};
    }
    if(name=="recall"){
        auto mem=LoadArrayFile(MemoryPath());std::string q=a.value("query",""),out;for(auto& x:mem){std::string fact=x.value("fact","");if(q.empty()||fact.find(q)!=std::string::npos)out+=fact+"\\n";}return {{"ok",true},{"matches",out}};
    }
    if(name=="character_control"){
        std::string action=a.value("action","");
        if(action=="eyes"){
            double x=std::clamp(a.value("x",0.0),-15.0,15.0), z=std::clamp(a.value("z",0.0),-15.0,15.0);
            PostJson({{"type","character"},{"action","eye_rotation"},{"x",x},{"z",z}});
            return {{"ok",true},{"action",action},{"x",x},{"z",z},{"limits","eye X/Z: -15..+15 degrees"}};
        }
        if(action=="head"){
            double x=std::clamp(a.value("x",0.0),-15.0,15.0), y=std::clamp(a.value("y",0.0),-15.0,15.0), z=std::clamp(a.value("z",0.0),-15.0,15.0);
            PostJson({{"type","character"},{"action","head_rotation"},{"x",x},{"y",y},{"z",z}});
            return {{"ok",true},{"action",action},{"x",x},{"y",y},{"z",z},{"limits","head X/Y/Z: -15..+15 degrees"}};
        }
        if(action=="spine"){
            double x=std::clamp(a.value("x",0.0),-8.0,8.0), y=std::clamp(a.value("y",0.0),-8.0,8.0), z=std::clamp(a.value("z",0.0),-8.0,8.0);
            PostJson({{"type","character"},{"action","spine"},{"x",x},{"y",y},{"z",z}});
            return {{"ok",true},{"action",action},{"x",x},{"y",y},{"z",z}};
        }
        if(action=="neck"){
            double x=std::clamp(a.value("x",0.0),-15.0,15.0), y=std::clamp(a.value("y",0.0),-15.0,15.0), z=std::clamp(a.value("z",0.0),-15.0,15.0);
            PostJson({{"type","character"},{"action","neck"},{"x",x},{"y",y},{"z",z}});
            return {{"ok",true},{"action",action},{"x",x},{"y",y},{"z",z},{"limits","neck X/Y/Z: -15..+15 degrees"}};
        }
        if(action=="shoulders"){
            double l=std::clamp(a.value("left",0.0),-15.0,15.0), r=std::clamp(a.value("right",0.0),-15.0,15.0);
            PostJson({{"type","character"},{"action","shoulders"},{"left",l},{"right",r}});
            return {{"ok",true},{"action",action},{"left",l},{"right",r}};
        }
        if(action=="wrists"){
            double l=std::clamp(a.value("left",0.0),-25.0,25.0), r=std::clamp(a.value("right",0.0),-25.0,25.0);
            PostJson({{"type","character"},{"action","wrists"},{"left",l},{"right",r}});
            return {{"ok",true},{"action",action},{"left",l},{"right",r}};
        }
        if(action=="face"){
            double blink=std::clamp(a.value("blink",0.0),0.0,1.0), smile=std::clamp(a.value("smile",0.0),0.0,1.0), brow=std::clamp(a.value("brow",0.0),-1.0,1.0);
            PostJson({{"type","character"},{"action","face"},{"blink",blink},{"smile",smile},{"brow",brow}});
            return {{"ok",true},{"action",action},{"blink",blink},{"smile",smile},{"brow",brow}};
        }
        if(action=="emotion"){
            const std::string emotion=a.value("emotion","neutral");
            const std::vector<std::string> allowed={"neutral","happy","sad","surprised","angry","thinking","greeting","speaking"};
            if(std::find(allowed.begin(),allowed.end(),emotion)==allowed.end()) return {{"ok",false},{"error","Unknown facial emotion"}};
            int duration=std::clamp(a.value("duration",280),0,10000);
            PostJson({{"type","character"},{"action","emotion"},{"emotion",emotion},{"duration",duration}});
            return {{"ok",true},{"action",action},{"emotion",emotion},{"duration",duration}};
        }
        if(action=="blink"){
            int duration=std::clamp(a.value("duration",140),80,500);
            PostJson({{"type","character"},{"action","blink"},{"duration",duration}});
            return {{"ok",true},{"action",action},{"duration",duration}};
        }
        if(action=="arms"){
            double l=std::clamp(a.value("left",0.0),-20.0,20.0),r=std::clamp(a.value("right",0.0),-20.0,20.0),lf=std::clamp(a.value("leftForearm",0.0),-25.0,25.0),rf=std::clamp(a.value("rightForearm",0.0),-25.0,25.0);
            PostJson({{"type","character"},{"action","arms"},{"left",l},{"right",r},{"leftForearm",lf},{"rightForearm",rf}});
            return {{"ok",true},{"action",action}};
        }
        if(action=="gesture"){
            std::string g=a.value("gesture","idle");int duration=std::clamp(a.value("duration",900),100,10000);
            PostJson({{"type","character"},{"action","gesture"},{"gesture",g},{"duration",duration}});
            return {{"ok",true},{"action",action},{"gesture",g},{"duration",duration}};
        }
        if(action=="breathing"||action=="talking"){
            bool enabled=a.value("enabled",true);
            PostJson({{"type","character"},{"action",action},{"enabled",enabled}});
            return {{"ok",true},{"action",action},{"enabled",enabled}};
        }
        if(action=="behavior"){
            bool enabled=a.value("enabled",true);
            bool autoBlink=a.value("autoBlink",true);
            bool eyeSaccades=a.value("eyeSaccades",true);
            bool speechGestures=a.value("speechGestures",true);
            PostJson({{"type","character"},{"action","behavior"},{"enabled",enabled},{"autoBlink",autoBlink},{"eyeSaccades",eyeSaccades},{"speechGestures",speechGestures}});
            return {{"ok",true},{"action","behavior"},{"enabled",enabled},{"autoBlink",autoBlink},{"eyeSaccades",eyeSaccades},{"speechGestures",speechGestures}};
        }
        if(action=="reset"){
            PostJson({{"type","character"},{"action","reset"}});
            return {{"ok",true},{"action","reset"}};
        }
        return {{"ok",false},{"error","Unknown character controller action"}};
    }
    if(name=="set_eye_rotation"){
        double x=std::clamp(a.value("x",0.0),-15.0,15.0);
        double z=std::clamp(a.value("z",0.0),-15.0,15.0);
        PostJson({{"type","character"},{"action","eye_rotation"},{"x",x},{"z",z}});
        return {{"ok",true},{"x",x},{"z",z},{"limits","-15..+15 degrees"}};
    }
    if(name=="set_head_rotation"){
        double x=std::clamp(a.value("x",0.0),-15.0,15.0);
        double y=std::clamp(a.value("y",0.0),-15.0,15.0);
        double z=std::clamp(a.value("z",0.0),-15.0,15.0);
        PostJson({{"type","character"},{"action","head_rotation"},{"x",x},{"y",y},{"z",z}});
        return {{"ok",true},{"x",x},{"y",y},{"z",z},{"limits","-15..+15 degrees"}};
    }
    if(name=="reset_character_pose"){
        PostJson({{"type","character"},{"action","reset"}});
        return {{"ok",true}};
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
            messages.push_back({{"role","system"},{"content","You are Saeed, a persistent Windows desktop AI agent and companion. You have a reasoning loop, tools, visual perception, long-term memory, and the ability to execute multi-step tasks. Do not merely explain how to do something when the user asks you to do it: inspect the computer, make a plan internally, execute safe steps, verify outcomes, recover from errors, and continue until the goal is complete or a real blocker exists. Use active_window, monitor_info and screen_capture before GUI actions when visual state matters. Use recall when the request may depend on prior user preferences or facts, and remember only facts the user explicitly asks you to remember. Maintain continuity across turns using conversation history and memory. Never claim success unless a tool result or verification supports it. Ask for confirmation only for actions marked as requiring it; never bypass confirmation. Avoid destructive actions unless explicitly requested and confirmed."}});
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
    wchar_t local[MAX_PATH]{};
    GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH);
    std::wstring data=std::wstring(local)+L"\\Saeed\\WebView2Data";
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
                    } else if(type=="character_state_response"){
                        std::lock_guard<std::mutex> l(g_characterStateMutex);
                        const std::string responseId=j.value("id","");
                        if(responseId.empty() || responseId!=g_characterStateId) return S_OK;
                        g_characterStateResult=j.value("state",json{{"ok",false},{"error","Invalid character state response"}});
                        g_characterStateId="done";
                        g_characterStateCv.notify_all();
                    } else if(type=="settings"){
                        json s=LoadSettings();s["provider"]=j.value("provider",s.value("provider","openrouter"));s["baseUrl"]=j.value("baseUrl",s.value("baseUrl","https://openrouter.ai/api/v1"));s["model"]=j.value("model",s.value("model","openai/gpt-5.1"));s["maxSteps"]=j.value("maxSteps",12);if(j.contains("apiKey")&&!j["apiKey"].get<std::string>().empty())s["apiKey"]=j["apiKey"];SaveSettings(s);PostJson({{"type","settingsSaved"}});
                    }
                }catch(...){if(raw)CoTaskMemFree(raw);}
                return S_OK;
            }).Get(),nullptr);
            std::wstring url=L"file:///"+AppDirectory()+L"/assets/avatar.html";
            HRESULT nav=g_webview->Navigate(url.c_str());
            if(FAILED(nav)) WriteLog("Avatar navigation failed: "+std::to_string((long)nav));
            return S_OK;
        }).Get());
    }).Get());
}
LRESULT CALLBACK WndProc(HWND h,UINT msg,WPARAM wp,LPARAM lp){
    switch(msg){
        case WM_APP+1:{auto* p=reinterpret_cast<std::wstring*>(lp);if(g_webview&&p){g_webview->PostWebMessageAsJson(p->c_str());}delete p;return 0;}
        case WM_NCHITTEST:return HTCLIENT;
        case WM_MOUSEACTIVATE:return MA_NOACTIVATE;
        case WM_DISPLAYCHANGE:
            KeepOnCurrentWorkArea();ResizeWebView();return 0;
        case WM_DPICHANGED:
            ApplyDpiSuggestedRect(lp);KeepOnCurrentWorkArea();ResizeWebView();return 0;
        case WM_SETTINGCHANGE:
            KeepOnCurrentWorkArea();ResizeWebView();return 0;
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
    MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}return (int)msg.wParam;}
