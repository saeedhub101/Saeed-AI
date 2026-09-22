#include <windows.h>
#include <shellscalingapi.h>
#include <commdlg.h>
#include <shellapi.h>
#include <wrl.h>
#include <WebView2.h>
#include <winhttp.h>
#include <mmdeviceapi.h>
#include <endpointvolume.h>
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
#include <iomanip>
#include <ctime>
#include <cstdio>

#pragma comment(lib,"shlwapi.lib")

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
using json=nlohmann::json;
#ifndef SAEED_VERSION
#define SAEED_VERSION "0.3.0"
#endif
#ifndef SAEED_BUILD_NUMBER
#define SAEED_BUILD_NUMBER 0
#endif

namespace {
HWND g_hwnd=nullptr;
NOTIFYICONDATAW g_tray{};
bool g_trayReady=false;
constexpr UINT WM_SAEED_TRAY=WM_APP+10;
constexpr UINT WM_SAEED_INIT_TRAY=WM_APP+11;
constexpr UINT ID_TRAY_SHOW=1001;
constexpr UINT ID_TRAY_HIDE=1002;
constexpr UINT ID_TRAY_EXIT=1003;
constexpr UINT ID_TRAY_STARTUP=1004;
constexpr UINT ID_TRAY_RESET_POSITION=1005;
constexpr UINT ID_TRAY_CHAT=1006;
constexpr UINT ID_TRAY_ACCOUNTS=1007;
constexpr UINT ID_TRAY_SETTINGS=1008;
constexpr UINT ID_TRAY_MUTE=1009;
constexpr UINT ID_TRAY_PAUSE=1010;
constexpr UINT ID_TRAY_ABOUT=1011;
constexpr int ID_SAEED_HOTKEY=7001;
ComPtr<ICoreWebView2Controller> g_controller;
ComPtr<ICoreWebView2> g_webview;
std::mutex g_confirmMutex;
std::mutex g_confirmRequestMutex;
std::condition_variable g_confirmCv;
std::string g_confirmId;
bool g_confirmValue=false;
std::atomic_uint64_t g_requestId{0};
std::atomic_bool g_shuttingDown{false};
std::atomic_bool g_agentCancel{false};
std::atomic_uint64_t g_agentTaskSerial{0};
std::atomic_bool g_agentRunning{false};
std::string g_agentTaskId;
std::mutex g_characterStateMutex;
std::mutex g_characterStateRequestMutex;
std::condition_variable g_characterStateCv;
std::string g_characterStateId;
json g_characterStateResult;
uint64_t g_characterStateRequestSerial=0;

void ResizeWebView();
void KeepOnCurrentWorkArea();

bool InterruptibleSleep(DWORD milliseconds){
    const DWORD slice=100;
    DWORD elapsed=0;
    while(elapsed<milliseconds){
        if(g_agentCancel.load()) return false;
        DWORD step=std::min(slice,milliseconds-elapsed);
        Sleep(step);
        elapsed+=step;
    }
    return !g_agentCancel.load();
}




void RemoveTrayIcon(){
    if(!g_trayReady)return;
    Shell_NotifyIconW(NIM_DELETE,&g_tray);
    g_trayReady=false;
}
void RegisterSaeedHotkey(){
    // Ctrl+Shift+S toggles Saeed visibility without stealing focus while hidden.
    RegisterHotKey(g_hwnd,ID_SAEED_HOTKEY,MOD_CONTROL|MOD_SHIFT,'S');
}
void UnregisterSaeedHotkey(){
    UnregisterHotKey(g_hwnd,ID_SAEED_HOTKEY);
}
void ToggleSaeedVisibility(){
    if(IsWindowVisible(g_hwnd)){
        ShowWindow(g_hwnd,SW_HIDE);
    }else{
        ShowWindow(g_hwnd,SW_SHOWNOACTIVATE);
        SetWindowPos(g_hwnd,HWND_TOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE);
    }
}
void AddTrayIcon(){
    if(g_trayReady)return;
    ZeroMemory(&g_tray,sizeof(g_tray));
    g_tray.cbSize=sizeof(g_tray);
    g_tray.hWnd=g_hwnd;
    g_tray.uID=1;
    g_tray.uFlags=NIF_MESSAGE|NIF_ICON|NIF_TIP;
    g_tray.uCallbackMessage=WM_SAEED_TRAY;
    g_tray.hIcon=LoadIconW(nullptr,IDI_APPLICATION);
    wcscpy_s(g_tray.szTip,L"Saeed AI");
    g_trayReady=Shell_NotifyIconW(NIM_ADD,&g_tray)!=FALSE;
}
bool IsStartupEnabled(){
    HKEY key=nullptr;
    if(RegOpenKeyExW(HKEY_CURRENT_USER,L"Software\\Microsoft\\Windows\\CurrentVersion\\Run",0,KEY_QUERY_VALUE,&key)!=ERROR_SUCCESS)return false;
    DWORD type=0,size=0;
    LONG rc=RegQueryValueExW(key,L"SaeedAI",nullptr,&type,nullptr,&size);
    RegCloseKey(key);
    return rc==ERROR_SUCCESS && type==REG_SZ;
}
bool SetStartupEnabled(bool enabled){
    HKEY key=nullptr;
    if(RegCreateKeyExW(HKEY_CURRENT_USER,L"Software\\Microsoft\\Windows\\CurrentVersion\\Run",0,nullptr,0,KEY_SET_VALUE,nullptr,&key,nullptr)!=ERROR_SUCCESS)return false;
    LONG rc=ERROR_SUCCESS;
    if(enabled){
        wchar_t path[MAX_PATH]{};
        DWORD n=GetModuleFileNameW(nullptr,path,MAX_PATH);
        if(!n || n>=MAX_PATH){RegCloseKey(key);return false;}
        std::wstring command=L"\\\""+std::wstring(path,n)+L"\\\"";
        rc=RegSetValueExW(key,L"SaeedAI",0,REG_SZ,reinterpret_cast<const BYTE*>(command.c_str()),static_cast<DWORD>((command.size()+1)*sizeof(wchar_t)));
    }else{
        rc=RegDeleteValueW(key,L"SaeedAI");
        if(rc==ERROR_FILE_NOT_FOUND)rc=ERROR_SUCCESS;
    }
    RegCloseKey(key);
    return rc==ERROR_SUCCESS;
}

void PostJson(const json& j);
void TrayCommand(const char* command){
    if(!g_webview)return;
    PostJson({{"type","native_command"},{"command",command}});
}
void ShowTrayMenu(){
    HMENU menu=CreatePopupMenu();
    AppendMenuW(menu,MF_STRING,ID_TRAY_SHOW,L"Show Saeed");
    AppendMenuW(menu,MF_STRING,ID_TRAY_HIDE,L"Hide Saeed");
    AppendMenuW(menu,MF_SEPARATOR,0,nullptr);
    AppendMenuW(menu,MF_STRING,ID_TRAY_CHAT,L"Open Chat");
    AppendMenuW(menu,MF_STRING,ID_TRAY_ACCOUNTS,L"Accounts");
    AppendMenuW(menu,MF_STRING,ID_TRAY_SETTINGS,L"Settings");
    AppendMenuW(menu,MF_SEPARATOR,0,nullptr);
    AppendMenuW(menu,MF_STRING,ID_TRAY_MUTE,L"Mute");
    AppendMenuW(menu,MF_STRING,ID_TRAY_PAUSE,L"Pause Listening");
    AppendMenuW(menu,MF_STRING,ID_TRAY_ABOUT,L"About Saeed");
    AppendMenuW(menu,MF_SEPARATOR,0,nullptr);
    AppendMenuW(menu,MF_STRING,ID_TRAY_RESET_POSITION,L"Reset Saeed Position");
    AppendMenuW(menu,MF_SEPARATOR,0,nullptr);
    AppendMenuW(menu,MF_STRING,ID_TRAY_EXIT,L"Exit");
    POINT p{};GetCursorPos(&p);
    SetForegroundWindow(g_hwnd);
    UINT cmd=TrackPopupMenu(menu,TPM_RETURNCMD|TPM_NONOTIFY,p.x,p.y,0,g_hwnd,nullptr);
    DestroyMenu(menu);
    if(cmd==ID_TRAY_SHOW){
        ShowWindow(g_hwnd,SW_SHOWNOACTIVATE);
        SetWindowPos(g_hwnd,HWND_TOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE);
    }else if(cmd==ID_TRAY_HIDE){
        ShowWindow(g_hwnd,SW_HIDE);
    }else if(cmd==ID_TRAY_CHAT){
        ShowWindow(g_hwnd,SW_SHOWNOACTIVATE); TrayCommand("open_chat");
    }else if(cmd==ID_TRAY_ACCOUNTS){
        ShowWindow(g_hwnd,SW_SHOWNOACTIVATE); TrayCommand("open_accounts");
    }else if(cmd==ID_TRAY_SETTINGS){
        ShowWindow(g_hwnd,SW_SHOWNOACTIVATE); TrayCommand("open_settings");
    }else if(cmd==ID_TRAY_MUTE){
        TrayCommand("mute");
    }else if(cmd==ID_TRAY_PAUSE){
        TrayCommand("pause_listening");
    }else if(cmd==ID_TRAY_ABOUT){
        ShowWindow(g_hwnd,SW_SHOWNOACTIVATE); TrayCommand("about");
    }else if(cmd==ID_TRAY_STARTUP){
        SetStartupEnabled(true);
    }else if(cmd==ID_TRAY_RESET_POSITION){
        SetWindowPos(g_hwnd,HWND_TOPMOST,100,100,0,0,SWP_NOSIZE|SWP_NOACTIVATE);
        KeepOnCurrentWorkArea(); ResizeWebView();
    }else if(cmd==ID_TRAY_EXIT){
        RemoveTrayIcon(); DestroyWindow(g_hwnd);
    }
}
void PostJson(const json& j);
std::wstring Wide(const std::string& s);
std::string Utf8(const std::wstring& s);
void WriteLog(const std::string& message);
std::wstring AppDirectory(){
    wchar_t b[MAX_PATH]{};
    DWORD n=GetModuleFileNameW(nullptr,b,MAX_PATH);
    std::wstring p(b,n);
    auto i=p.find_last_of(L"\\/");
    return i==std::wstring::npos?L".":p.substr(0,i);
}

static int CompareVersions(std::string a,std::string b){
    auto parse=[](std::string s){
        if(!s.empty()&&(s[0]=='v'||s[0]=='V'))s.erase(0,1);
        std::vector<int> out;std::stringstream ss(s);std::string part;
        while(std::getline(ss,part,'.')){try{out.push_back(std::stoi(part));}catch(...){out.push_back(0);}}
        while(out.size()<3)out.push_back(0);
        return out;
    };
    auto x=parse(a),y=parse(b);
    for(int i=0;i<3;i++)if(x[i]!=y[i])return x[i]<y[i]?-1:1;
    return 0;
}
struct ReleaseBuildInfo{
    std::string version;
    uint64_t build=0;
};
static ReleaseBuildInfo ParseReleaseTag(std::string tag){
    if(!tag.empty()&&(tag[0]=='v'||tag[0]=='V'))tag.erase(0,1);
    ReleaseBuildInfo out;
    const std::string marker="-build.";
    const auto p=tag.find(marker);
    out.version=(p==std::string::npos)?tag:tag.substr(0,p);
    if(p!=std::string::npos){
        try{out.build=std::stoull(tag.substr(p+marker.size()));}catch(...){out.build=0;}
    }
    return out;
}
static bool IsReleaseNewer(const std::string& tag){
    const auto rel=ParseReleaseTag(tag);
    const int versionCmp=CompareVersions(SAEED_VERSION,rel.version);
    if(versionCmp<0)return true;
    if(versionCmp>0)return false;
    return rel.build>static_cast<uint64_t>(SAEED_BUILD_NUMBER);
}
static std::string HttpGetText(const std::wstring& host,const std::wstring& path){
    HINTERNET s=WinHttpOpen(L"Saeed AI/1.0",WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,nullptr,nullptr,0);
    if(!s)throw std::runtime_error("WinHTTP unavailable");
    HINTERNET c=WinHttpConnect(s,host.c_str(),INTERNET_DEFAULT_HTTPS_PORT,0);
    if(!c){WinHttpCloseHandle(s);throw std::runtime_error("Update server connection failed");}
    HINTERNET r=WinHttpOpenRequest(c,L"GET",path.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,WINHTTP_FLAG_SECURE);
    if(!r){WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("Update request failed");}
    WinHttpSetTimeouts(r,5000,5000,10000,10000);
    if(!WinHttpSendRequest(r,WINHTTP_NO_ADDITIONAL_HEADERS,0,nullptr,0,0,0)||!WinHttpReceiveResponse(r,nullptr)){
        WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("Update request failed");
    }
    DWORD status=0,statusSize=sizeof(status);
    if(!WinHttpQueryHeaders(r,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,nullptr,&status,&statusSize,nullptr)||status<200||status>=300){
        WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);
        throw std::runtime_error("Update server returned HTTP status "+std::to_string(status));
    }
    std::string out;DWORD avail=0;
    while(WinHttpQueryDataAvailable(r,&avail)&&avail){
        std::string buf(avail,'\0');DWORD got=0;
        if(!WinHttpReadData(r,buf.data(),avail,&got)||!got)break;
        buf.resize(got);out+=buf;
    }
    WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);
    return out;
}
static std::wstring TempUpdatePath(){
    wchar_t b[MAX_PATH]{};GetTempPathW(MAX_PATH,b);
    return (std::filesystem::path(b)/(L"Saeed-AI-Update-"+std::to_wstring(GetTickCount64())+L".exe")).wstring();
}
static void DownloadUpdate(const std::string& url,const std::wstring& out){
    URL_COMPONENTSW uc{};uc.dwStructSize=sizeof(uc);
    wchar_t host[512]{},path[4096]{},extra[4096]{};
    uc.lpszHostName=host;uc.dwHostNameLength=512;uc.lpszUrlPath=path;uc.dwUrlPathLength=4096;
    uc.lpszExtraInfo=extra;uc.dwExtraInfoLength=4096;
    if(!WinHttpCrackUrl(Wide(url).c_str(),0,0,&uc))throw std::runtime_error("Invalid update URL");
    HINTERNET s=WinHttpOpen(L"Saeed AI/1.0",WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,nullptr,nullptr,0);
    if(!s)throw std::runtime_error("WinHTTP unavailable");
    HINTERNET c=WinHttpConnect(s,uc.lpszHostName,uc.nPort,0);
    if(!c){WinHttpCloseHandle(s);throw std::runtime_error("Update download connection failed");}
    std::wstring req=std::wstring(uc.lpszUrlPath,uc.dwUrlPathLength)+std::wstring(uc.lpszExtraInfo?uc.lpszExtraInfo:L"",uc.dwExtraInfoLength);
    HINTERNET r=WinHttpOpenRequest(c,L"GET",req.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,uc.nScheme==INTERNET_SCHEME_HTTPS?WINHTTP_FLAG_SECURE:0);
    if(!r){WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("Update download request failed");}
    WinHttpSetTimeouts(r,5000,5000,15000,30000);
    if(!WinHttpSendRequest(r,WINHTTP_NO_ADDITIONAL_HEADERS,0,nullptr,0,0,0)||!WinHttpReceiveResponse(r,nullptr)){
        WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("Update download failed");
    }
    DWORD status=0,statusSize=sizeof(status);
    if(!WinHttpQueryHeaders(r,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,nullptr,&status,&statusSize,nullptr)||status<200||status>=300){
        WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);
        throw std::runtime_error("Update download server returned HTTP status "+std::to_string(status));
    }
    std::ofstream f(Utf8(out),std::ios::binary);if(!f){WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("Cannot create update file");}
    DWORD avail=0;
    while(WinHttpQueryDataAvailable(r,&avail)&&avail){
        std::vector<char>buf(avail);DWORD got=0;
        if(!WinHttpReadData(r,buf.data(),avail,&got)||!got)break;
        f.write(buf.data(),got);
    }
    f.close();WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);
    if(!std::filesystem::exists(out)||std::filesystem::file_size(out)<100000)throw std::runtime_error("Downloaded update is invalid");
}
static void ApplyUpdateHelper(const std::wstring& installer,DWORD parentPid){
    if(parentPid){
        HANDLE p=OpenProcess(SYNCHRONIZE,FALSE,parentPid);
        if(p){WaitForSingleObject(p,30000);CloseHandle(p);}
    }
    std::wstring cmd=L"\""+installer+L"\" /SILENT /CLOSEAPPLICATIONS /NORESTART";
    STARTUPINFOW si{sizeof(si)};PROCESS_INFORMATION pi{};
    if(!CreateProcessW(nullptr,cmd.data(),nullptr,nullptr,FALSE,0,nullptr,nullptr,&si,&pi))return;
    WaitForSingleObject(pi.hProcess,INFINITE);
    DWORD code=1;GetExitCodeProcess(pi.hProcess,&code);
    CloseHandle(pi.hThread);CloseHandle(pi.hProcess);
    std::error_code ec;std::filesystem::remove(installer,ec);
    if(code==0){
        std::filesystem::path app=std::filesystem::path(AppDirectory())/L"Saeed.exe";
        ShellExecuteW(nullptr,L"open",app.wstring().c_str(),nullptr,nullptr,SW_SHOWNOACTIVATE);
    }
}
static void CheckForUpdateAsync(){
    std::thread([](){
        try{
            const auto raw=HttpGetText(L"api.github.com",L"/repos/saeedhub101/Saeed-AI/releases/latest");
            const auto rel=json::parse(raw);
            const std::string latest=rel.value("tag_name","");
            if(latest.empty()||!IsReleaseNewer(latest))return;
            std::string asset;
            for(const auto&a:rel.value("assets",json::array())){
                if(a.value("name","")=="Saeed-AI-Setup-x64.exe"){asset=a.value("browser_download_url","");break;}
            }
            if(asset.empty())return;
            const auto releaseInfo=ParseReleaseTag(latest);
            PostJson({{"type","update_available"},{"version",latest},{"url",asset},{"current",SAEED_VERSION},{"build",releaseInfo.build}});
        }catch(const std::exception&e){
            WriteLog(std::string("Update check failed: ")+e.what());
        }catch(...){WriteLog("Update check failed");}
    }).detach();
}
static void StartUpdateDownload(const std::string& url,const std::string& version){
    std::thread([url,version](){
        try{
            PostJson({{"type","update_status"},{"text","جاري تنزيل التحديث "+version+"..."},{"state","downloading_update"}});
            const std::wstring installer=TempUpdatePath();
            DownloadUpdate(url,installer);
            std::wstring exe=(std::filesystem::path(AppDirectory())/L"Saeed.exe").wstring();
            std::wstring cmd=L"\""+exe+L"\" --saeed-apply-update \""+installer+L"\" "+std::to_wstring(GetCurrentProcessId());
            STARTUPINFOW si{sizeof(si)};PROCESS_INFORMATION pi{};
            if(!CreateProcessW(exe.c_str(),cmd.data(),nullptr,nullptr,FALSE,0,nullptr,nullptr,&si,&pi))
                throw std::runtime_error("Could not start integrated update helper");
            CloseHandle(pi.hThread);CloseHandle(pi.hProcess);
            PostJson({{"type","update_status"},{"text","سيتم إغلاق Saeed وتثبيت التحديث الآن..."},{"state","installing_update"}});
            PostMessageW(g_hwnd,WM_CLOSE,0,0);
        }catch(const std::exception&e){
            PostJson({{"type","update_status"},{"text",std::string("فشل التحديث: ")+e.what()},{"state","update_error"}});
        }
    }).detach();
}
std::wstring HistoryPath(){wchar_t b[MAX_PATH]{};GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);return std::wstring(b)+L"\\Saeed\\history.json";}
std::wstring AgentTasksPath(){wchar_t b[MAX_PATH]{};GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);return std::wstring(b)+L"\\Saeed\\agent_tasks.json";}
json LoadArrayFile(const std::wstring& p);
bool SaveArrayFile(const std::wstring& p,const json& j);
std::string WallClockIso();



void RecordAgentEvent(const std::string& taskId,const std::string& state,const std::string& text,int step=0,const std::string& tool=""){
    try{
        auto events=LoadArrayFile(AgentTasksPath());
        if(!events.is_array()) events=json::array();
        events.push_back({{"time",WallClockIso()},{"taskId",taskId},{"state",state},{"text",text},{"step",step},{"tool",tool}});
        if(events.size()>300) events.erase(events.begin(),events.begin()+(events.size()-300));
        SaveArrayFile(AgentTasksPath(),events);
    }catch(...){}
}

std::wstring AgentTaskStatePath(){
    wchar_t b[MAX_PATH]{};
    GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);
    return std::wstring(b)+L"\\Saeed\\agent_task_state.json";
}

void UpdateAgentTaskState(const std::string& taskId,const std::string& goal,const std::string& state,
                          int step=0,int maxSteps=0,const std::string& phase="",
                          const std::string& tool="",int attempt=0,const std::string& message=""){
    try{
        json s={
            {"taskId",taskId},{"goal",goal},{"state",state},{"step",step},
            {"maxSteps",maxSteps},{"phase",phase},{"tool",tool},{"attempt",attempt},
            {"message",message},{"updatedAt",WallClockIso()}
        };
        SaveArrayFile(AgentTaskStatePath(),s);
    }catch(...){}
}

std::wstring SaeedDataRoot(){
    wchar_t b[MAX_PATH]{};
    GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);
    std::filesystem::path p=std::filesystem::path(b)/L"Saeed";
    std::error_code ec; std::filesystem::create_directories(p,ec);
    return p.wstring();
}
std::wstring LinkedAccountsPath(){ return (std::filesystem::path(SaeedDataRoot())/L"linked_accounts.json").wstring(); }
std::wstring AccountSessionDir(const std::string& provider,const std::string& accountId){
    std::wstring safe=Wide(provider+"_"+accountId);
    for(auto& ch:safe) if(ch==L'/'||ch==L'\\'||ch==L':'||ch==L'?'||ch==L'*'||ch==L'\"'||ch==L'<'||ch==L'>'||ch==L'|') ch=L'_';
    return (std::filesystem::path(SaeedDataRoot())/L"accounts"/safe).wstring();
}
void RemoveDirectoryTreeSafe(const std::wstring& path){
    std::error_code ec;
    if(std::filesystem::exists(path,ec)) std::filesystem::remove_all(path,ec);
    WriteLog("Linked account session removed: "+Utf8(path));
}
void SignOutLinkedAccount(const std::string& provider,const std::string& accountId){
    if(provider.empty()||accountId.empty()) return;
    auto dir=AccountSessionDir(provider,accountId);
    RemoveDirectoryTreeSafe(dir);
    auto accounts=LoadArrayFile(LinkedAccountsPath());
    if(!accounts.is_array()) accounts=json::array();
    json kept=json::array();
    for(const auto& a:accounts){
        if(a.value("provider","")==provider && a.value("accountId","")==accountId) continue;
        kept.push_back(a);
    }
    SaveArrayFile(LinkedAccountsPath(),kept);
    PostJson({{"type","account_signed_out"},{"provider",provider},{"accountId",accountId}});
}
void SaveLinkedAccountSession(const json& account,const json& importedData){
    const std::string provider=account.value("provider","");
    const std::string accountId=account.value("accountId","");
    if(provider.empty()||accountId.empty()) throw std::runtime_error("Invalid linked account");
    auto dir=AccountSessionDir(provider,accountId);
    std::error_code ec; std::filesystem::create_directories(dir,ec);
    if(ec) throw std::runtime_error("Cannot create account session directory");
    {
        std::ofstream f(Utf8((std::filesystem::path(dir)/L"session.json").wstring()),std::ios::binary|std::ios::trunc);
        if(!f) throw std::runtime_error("Cannot save account session");
        f<<account.dump(2); f.flush();
        if(!f) throw std::runtime_error("Cannot write account session");
    }
    {
        std::ofstream f(Utf8((std::filesystem::path(dir)/L"imported_data.json").wstring()),std::ios::binary|std::ios::trunc);
        if(!f) throw std::runtime_error("Cannot save imported account data");
        f<<importedData.dump(2); f.flush();
        if(!f) throw std::runtime_error("Cannot write imported account data");
    }
    auto accounts=LoadArrayFile(LinkedAccountsPath());
    if(!accounts.is_array()) accounts=json::array();
    bool found=false;
    for(auto& a:accounts) if(a.value("provider","")==provider && a.value("accountId","")==accountId){a=account;found=true;break;}
    if(!found) accounts.push_back(account);
    SaveArrayFile(LinkedAccountsPath(),accounts);
}
void ClearAllLinkedAccountSessions(){
    auto root=std::filesystem::path(SaeedDataRoot())/L"accounts";
    std::error_code ec;
    if(std::filesystem::exists(root,ec)) std::filesystem::remove_all(root,ec);
    SaveArrayFile(LinkedAccountsPath(),json::array());
}

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

void WriteLog(const std::string& message);
void CheckForUpdateAsync();

LONG WINAPI SaeedUnhandledException(EXCEPTION_POINTERS* info){
    std::string msg="Unhandled native exception";
    if(info&&info->ExceptionRecord){
        msg+=" code=0x"+std::to_string(static_cast<unsigned long long>(info->ExceptionRecord->ExceptionCode));
    }
    WriteLog(msg);
    return EXCEPTION_EXECUTE_HANDLER;
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
bool SaveArrayFile(const std::wstring& p,const json& j){
    try{
        size_t slash=p.find_last_of(L"\\/");
        if(slash!=std::wstring::npos)std::filesystem::create_directories(std::filesystem::path(p).parent_path());
        std::ofstream f(Utf8(p),std::ios::trunc);
        if(!f)return false;
        f<<j.dump(2);
        f.flush();
        return f.good();
    }catch(...){
        return false;
    }
}
std::string WallClockIso(){
    using namespace std::chrono;
    const auto now=system_clock::now();
    const auto ms=duration_cast<milliseconds>(now.time_since_epoch())%1000;
    const std::time_t tt=system_clock::to_time_t(now);
    std::tm utc{};
    gmtime_s(&utc,&tt);
    std::ostringstream out;
    out<<std::put_time(&utc,"%Y-%m-%dT%H:%M:%S")<<'.'
       <<std::setfill('0')<<std::setw(3)<<ms.count()<<"Z";
    return out.str();
}
void SaveSettings(const json& j){
    std::wstring p=SettingsPath();
    size_t slash=p.find_last_of(L"\\/");
    if(slash!=std::wstring::npos) std::filesystem::create_directories(std::filesystem::path(p).parent_path());
    json out=j; if(out.contains("apiKey")) out["apiKey"]=ProtectSecret(out.value("apiKey","")); std::ofstream f(Utf8(p)); f<<out.dump(2);
}
std::wstring CharacterDirectory(){
    wchar_t b[MAX_PATH]{};
    GetEnvironmentVariableW(L"APPDATA",b,MAX_PATH);
    return std::wstring(b)+L"\\Saeed\\Characters";
}
std::string UrlPathSegment(const std::wstring& value){
    const std::string bytes=Utf8(value);
    static const char hex[]="0123456789ABCDEF";
    std::string out;
    for(unsigned char ch:bytes){
        const bool safe=(ch>='a'&&ch<='z')||(ch>='A'&&ch<='Z')||(ch>='0'&&ch<='9')||ch=='-'||ch=='_'||ch=='.'||ch=='~';
        if(safe) out.push_back((char)ch);
        else { out.push_back('%'); out.push_back(hex[(ch>>4)&0xF]); out.push_back(hex[ch&0xF]); }
    }
    return out;
}
std::string CharacterVirtualUrl(const std::wstring& p){
    return "https://saeed-characters.local/"+UrlPathSegment(std::filesystem::path(p).filename().wstring());
}
void SendCharacterSelection(){
    json s=LoadSettings();
    std::wstring p;
    if(s.contains("characterPath")&&s["characterPath"].is_string())
        p=std::filesystem::path(s["characterPath"].get<std::string>()).wstring();
    if(p.empty()||!std::filesystem::exists(p)){
        PostJson({{"type","character_selected"},{"name","Saeed"},{"path","./saeed.ai.glb"},{"builtin",true}});
        return;
    }
    PostJson({{"type","character_selected"},{"name",Utf8(std::filesystem::path(p).stem().wstring())},{"path",CharacterVirtualUrl(p)},{"builtin",false}});
}
void ChooseCharacterFile(){
    wchar_t file[MAX_PATH*4]{};
    OPENFILENAMEW ofn{};
    ofn.lStructSize=sizeof(ofn); ofn.hwndOwner=g_hwnd;
    ofn.lpstrFile=file; ofn.nMaxFile=static_cast<DWORD>(std::size(file));
    ofn.lpstrFilter=L"GLB Character (*.glb)\\0*.glb\\0All Files (*.*)\\0*.*\\0";
    ofn.Flags=OFN_FILEMUSTEXIST|OFN_PATHMUSTEXIST|OFN_HIDEREADONLY;
    if(!GetOpenFileNameW(&ofn))return;
    try{
        std::filesystem::create_directories(CharacterDirectory());
        std::filesystem::path src(file);
        std::filesystem::path dst=std::filesystem::path(CharacterDirectory())/(src.stem().wstring()+L".glb");
        std::filesystem::copy_file(src,dst,std::filesystem::copy_options::overwrite_existing);
        json s=LoadSettings();
        s["characterPath"]=Utf8(dst.wstring());
        SaveSettings(s);
        SendCharacterSelection();
    }catch(const std::exception& e){
        PostJson({{"type","character_error"},{"text",std::string("تعذر إضافة الشخصية: ")+e.what()}});
    }
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
    PostJson({{"type","status"},{"text","بانتظار موافقتك"},{"state","waiting_confirmation"},{"requestId",id},{"taskId",g_agentTaskId},{"tool",name}});
    PostJson({{"type","confirm"},{"id",id},{"name",name},{"args",args}});
    std::unique_lock<std::mutex> l(g_confirmMutex);
    g_confirmCv.wait(l,[&]{return g_confirmId!=id;});
}
bool WaitConfirmation(const std::string& name,const json& args){
    std::unique_lock<std::mutex> requestLock(g_confirmRequestMutex);
    const std::string id=std::to_string(++g_requestId);
    {
        std::lock_guard<std::mutex> l(g_confirmMutex);
        g_confirmId=id; g_confirmValue=false;
    }
    PostJson({{"type","status"},{"text","بانتظار موافقتك"},{"state","waiting_confirmation"},{"requestId",id},{"taskId",g_agentTaskId},{"tool",name}});
    PostJson({{"type","confirm"},{"id",id},{"name",name},{"args",args}});
    std::unique_lock<std::mutex> l(g_confirmMutex);
    if(!g_confirmCv.wait_for(l,std::chrono::seconds(60),[&]{return g_confirmId!=id || g_agentCancel.load();})){
        g_confirmId="timeout";
        PostJson({{"type","status"},{"text","انتهت مهلة الموافقة"},{"state","confirmation_timeout"},{"requestId",id},{"taskId",g_agentTaskId},{"tool",name}});
        return false;
    }
    if(g_agentCancel.load()){ g_confirmId="cancelled"; return false; }
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
    // Bound network waits so a stalled provider cannot hold an Agent task forever.
    DWORD timeoutMs=15000;
    WinHttpSetTimeouts(req,(int)timeoutMs,(int)timeoutMs,(int)timeoutMs,(int)timeoutMs);
    std::wstring headers=L"Content-Type: application/json\r\nAuthorization: Bearer "+Wide(apiKey)+L"\r\n";
    std::string data=body.dump();
    BOOL ok=WinHttpSendRequest(req,headers.c_str(),(DWORD)-1L,(LPVOID)data.data(),(DWORD)data.size(),(DWORD)data.size(),0);
    if(!ok||!WinHttpReceiveResponse(req,nullptr)){WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);throw std::runtime_error("AI request failed");}
    DWORD status=0,statusSize=sizeof(status);
    if(!WinHttpQueryHeaders(req,WINHTTP_QUERY_STATUS_CODE|WINHTTP_QUERY_FLAG_NUMBER,WINHTTP_HEADER_NAME_BY_INDEX,&status,&statusSize,WINHTTP_NO_HEADER_INDEX)){
        WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);throw std::runtime_error("Cannot read AI response status");
    }
    std::string out;DWORD avail=0;
    while(WinHttpQueryDataAvailable(req,&avail)&&avail){
        if(g_agentCancel.load()){WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);throw std::runtime_error("Agent task cancelled by user.");}
        if(!avail)break;
        char buf[8192];DWORD n=0;
        if(!WinHttpReadData(req,buf,(DWORD)std::min<DWORD>(avail,sizeof(buf)),&n))break;
        out.append(buf,n);
    }
    WinHttpCloseHandle(req);WinHttpCloseHandle(con);WinHttpCloseHandle(ses);
    if(status<200||status>=300){
        try{json e=json::parse(out);std::string msg=e.value("error",json{{"message","AI provider HTTP error"}}).value("message","AI provider HTTP error");throw std::runtime_error("AI provider HTTP "+std::to_string(status)+": "+msg);}catch(const json::parse_error&){throw std::runtime_error("AI provider HTTP "+std::to_string(status));}
    }
    return out;
}

json ToolSchemas(){
    return json::parse(R"JSON([
      {"type":"function","function":{"name":"cancel_agent","description":"Cancel the currently running Saeed agent task. Use only when the user asks to stop/cancel the current task.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"local_command_info","description":"Local commands such as time, date, volume, opening Windows apps, files, folders and URLs are handled by the native C++ command engine without an AI provider.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"system_info","description":"Get Windows computer information.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"active_window","description":"Get the currently focused Windows window.","parameters":{"type":"object","properties":{}}}},
      {"type":"function","function":{"name":"window_geometry","description":"Get the exact screen rectangle, state and monitor of a visible Windows window by part of its title. Use before coordinate-based GUI actions.","parameters":{"type":"object","properties":{"title":{"type":"string"}},"required":["title"]}}},
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
      {"type":"function","function":{"name":"remember","description":"Store a fact in Saeed's persistent long-term memory when the user explicitly asks you to remember it. Optional category and importance improve future retrieval.","parameters":{"type":"object","properties":{"fact":{"type":"string"},"category":{"type":"string","enum":["personal","preference","project","task","technical","general"]},"importance":{"type":"integer","minimum":1,"maximum":5}},"required":["fact"]}}},
      {"type":"function","function":{"name":"recall","description":"Search Saeed's persistent memory for relevant facts.","parameters":{"type":"object","properties":{"query":{"type":"string"},"category":{"type":"string","enum":["personal","preference","project","task","technical","general"]}},"required":["query"]}}},
      {"type":"function","function":{"name":"forget","description":"Remove a persistent memory entry by its ID, or by an exact case-sensitive fact query when no ID is supplied. Use only when the user explicitly asks to forget or remove a memory.","parameters":{"type":"object","properties":{"id":{"type":"string"},"query":{"type":"string"}}}}},
      {"type":"function","function":{"name":"set_eye_rotation","description":"Control both Saeed eye bones. X and Z are strictly limited to -15..+15 degrees.","parameters":{"type":"object","properties":{"x":{"type":"number","minimum":-15,"maximum":15},"z":{"type":"number","minimum":-15,"maximum":15}},"required":["x","z"]}}},
      {"type":"function","function":{"name":"set_head_rotation","description":"Control Saeed head orientation. X, Y and Z are limited to -15..+15 degrees.","parameters":{"type":"object","properties":{"x":{"type":"number","minimum":-15,"maximum":15},"y":{"type":"number","minimum":-15,"maximum":15},"z":{"type":"number","minimum":-15,"maximum":15}},"required":["x","y","z"]}}},
      {"type":"function","function":{"name":"reset_character_pose","description":"Return Saeed's controller to its neutral state.","parameters":{"type":"object","properties":{}}}}},
      {"type":"function","function":{"name":"character_control","description":"Advanced non-destructive Saeed avatar controller. Controls eyes, head, neck, spine, shoulders, arms, forearms, wrists, facial morphs, blinking, breathing, talking, natural behavior and short gestures. Eye X/Z and head X/Y/Z are hard-limited to -15..+15 degrees; spine and limbs have their own safe limits.","parameters":{"type":"object","properties":{"action":{"type":"string","enum":["eyes","head","spine","neck","shoulders","wrists","arms","face","emotion","blink","gesture","breathing","talking","behavior","reset"]},"x":{"type":"number"},"y":{"type":"number"},"z":{"type":"number"},"left":{"type":"number"},"right":{"type":"number"},"leftForearm":{"type":"number"},"rightForearm":{"type":"number"},"gesture":{"type":"string","enum":["idle","nod","wave","agree","disagree","think","greet"]},"duration":{"type":"integer","minimum":100,"maximum":10000},"enabled":{"type":"boolean"},"blink":{"type":"number","minimum":0,"maximum":1},"smile":{"type":"number","minimum":0,"maximum":1},"brow":{"type":"number","minimum":-1,"maximum":1},"emotion":{"type":"string","enum":["neutral","happy","sad","surprised","angry","thinking","greeting","speaking"]},"autoBlink":{"type":"boolean"},"eyeSaccades":{"type":"boolean"},"speechGestures":{"type":"boolean"}},"required":["action"]}}}},{"type":"function","function":{"name":"character_state","description":"Read Saeed's live avatar controller state directly from the 3D character. Use this to verify eye/head/limb/facial/behavior settings after changes.","parameters":{"type":"object","properties":{}}}}
    ])JSON");
}

bool IsProtectedWritePath(const std::wstring& raw){
    try{
        if(raw.empty()) return false;
        std::filesystem::path p=std::filesystem::weakly_canonical(std::filesystem::path(raw));
        std::wstring s=p.wstring();
        std::transform(s.begin(),s.end(),s.begin(),[](wchar_t ch){return (wchar_t)towlower(ch);});
        auto under=[&](const std::wstring& root){
            if(root.empty()) return false;
            std::wstring r=root;
            std::transform(r.begin(),r.end(),r.begin(),[](wchar_t ch){return (wchar_t)towlower(ch);});
            while(!r.empty() && r.back()==L'\\') r.pop_back();
            return !r.empty() && (s==r || (s.size()>r.size() && s.rfind(r+L"\\",0)==0));
        };
        wchar_t b[MAX_PATH]{};
        GetWindowsDirectoryW(b,MAX_PATH); if(under(std::wstring(b))) return true;
        GetSystemDirectoryW(b,MAX_PATH); if(under(std::wstring(b))) return true;
        DWORD n=GetEnvironmentVariableW(L"ProgramFiles",b,MAX_PATH); if(n&&under(std::wstring(b))) return true;
        n=GetEnvironmentVariableW(L"ProgramFiles(x86)",b,MAX_PATH); if(n&&under(std::wstring(b))) return true;
        return false;
    }catch(...){ return false; }
}

json ExecuteFileOperationCore(const json& a){
    const std::filesystem::path src=Wide(a.value("source",""));
    const std::string op=a.value("operation","");
    try{
        if(op=="delete"){
            if(!std::filesystem::exists(src)) return {{"ok",false},{"error","Source does not exist"},{"source",a.value("source","")}};
            const auto removed=std::filesystem::remove_all(src);
            if(removed==0||std::filesystem::exists(src)) return {{"ok",false},{"error","Delete operation could not be verified"},{"source",a.value("source","")}};
            return {{"ok",true},{"operation",op},{"source",a.value("source","")},{"removed_count",(uint64_t)removed},{"verified",true}};
        }
        const std::filesystem::path dst=Wide(a.value("destination",""));
        if(op=="copy"){
            if(!std::filesystem::exists(src)) return {{"ok",false},{"error","Source does not exist"}};
            if(std::filesystem::is_directory(src)) std::filesystem::copy(src,dst,std::filesystem::copy_options::recursive|std::filesystem::copy_options::overwrite_existing);
            else std::filesystem::copy_file(src,dst,std::filesystem::copy_options::overwrite_existing);
        }else if(op=="move"||op=="rename"){
            std::filesystem::rename(src,dst);
        }else return {{"ok",false},{"error","Unsupported file operation"}};
        if(!std::filesystem::exists(dst)) return {{"ok",false},{"error","File operation completed without a verifiable destination"}};
        if((op=="move"||op=="rename")&&std::filesystem::exists(src)) return {{"ok",false},{"error","Source still exists after operation"}};
        return {{"ok",true},{"operation",op},{"source",a.value("source","")},{"destination",a.value("destination","")},{"verified",true}};
    }catch(const std::exception& e){ return {{"ok",false},{"error",e.what()}}; }
}

json ExecuteWriteFileCore(const json& a){
    const std::wstring p=Wide(a.value("filePath",""));
    try{
        size_t slash=p.find_last_of(L"\\/");
        if(slash!=std::wstring::npos) std::filesystem::create_directories(std::filesystem::path(p).parent_path());
    }catch(const std::exception& e){ return {{"ok",false},{"error",e.what()}}; }
    std::ofstream f(Utf8(p),std::ios::trunc);
    if(!f) return {{"ok",false},{"error","Cannot open destination"}};
    const std::string content=a.value("content","");
    f<<content; f.flush();
    if(!f.good()) return {{"ok",false},{"error","Failed while writing destination"}};
    return {{"ok",true},{"path",a.value("filePath","")},{"bytes",(int64_t)content.size()},{"verified",true}};
}

json RunElevatedFileOperation(const json& request){
    wchar_t tempPath[MAX_PATH]{};
    GetTempPathW(MAX_PATH,tempPath);
    wchar_t tempName[MAX_PATH]{};
    if(!GetTempFileNameW(tempPath,L"SAD",0,tempName)) return {{"ok",false},{"error","Could not create elevation request file"}};
    std::wstring requestPath=tempName, resultPath=requestPath+L".result";
    try{
        std::ofstream rf(Utf8(requestPath),std::ios::trunc);
        if(!rf) throw std::runtime_error("request");
        rf<<request.dump(2); rf.flush();
        if(!rf.good()) throw std::runtime_error("request");
    }catch(...){
        DeleteFileW(requestPath.c_str());
        return {{"ok",false},{"error","Could not prepare elevation request"}};
    }
    std::wstring params=L"--saeed-elevated-op \""+requestPath+L"\"";
    SHELLEXECUTEINFOW sei{sizeof(sei)};
    sei.fMask=SEE_MASK_NOCLOSEPROCESS; sei.hwnd=g_hwnd; sei.lpVerb=L"runas";
    sei.lpFile=AppDirectory().c_str(); sei.lpParameters=params.c_str(); sei.nShow=SW_SHOWNORMAL;
    if(!ShellExecuteExW(&sei)){
        DWORD err=GetLastError();
        DeleteFileW(requestPath.c_str()); DeleteFileW(resultPath.c_str());
        if(err==ERROR_CANCELLED) return {{"ok",false},{"error","Windows UAC permission was denied by the user"},{"uac_denied",true}};
        return {{"ok",false},{"error","Could not request Windows administrator elevation"},{"win32_error",(uint32_t)err}};
    }
    DWORD wait=WaitForSingleObject(sei.hProcess,120000);
    if(wait==WAIT_TIMEOUT){
        TerminateProcess(sei.hProcess,1); CloseHandle(sei.hProcess);
        DeleteFileW(requestPath.c_str()); DeleteFileW(resultPath.c_str());
        return {{"ok",false},{"error","Elevated operation timed out"}};
    }
    CloseHandle(sei.hProcess);
    json result={{"ok",false},{"error","Elevated helper did not return a result"}};
    std::ifstream out(Utf8(resultPath));
    if(out){try{out>>result;}catch(...){result={{"ok",false},{"error","Invalid elevated operation result"}};}}
    DeleteFileW(requestPath.c_str()); DeleteFileW(resultPath.c_str());
    result["elevated"]=true;
    return result;
}

void RunElevatedOperationEntry(const std::wstring& requestPath){
    try{
        std::ifstream f(Utf8(requestPath));
        if(!f) ExitProcess(2);
        json request; f>>request; json result;
        const std::string kind=request.value("kind","");
        if(kind=="file_operation") result=ExecuteFileOperationCore(request);
        else if(kind=="write_file") result=ExecuteWriteFileCore(request);
        else result={{"ok",false},{"error","Unsupported elevated operation"}};
        std::ofstream out(Utf8(requestPath+L".result"),std::ios::trunc);
        if(out){out<<result.dump(2);out.flush();}
        ExitProcess(result.value("ok",false)?0:1);
    }catch(...){
        std::ofstream out(Utf8(requestPath+L".result"),std::ios::trunc);
        if(out) out<<R"({"ok":false,"error":"Elevated helper failed"})";
        ExitProcess(1);
    }
}

json ExecuteTool(const std::string& name,const json& a){
    if(name=="character_state"){
        // Serialize live-avatar queries so concurrent agent/tool calls cannot
        // overwrite the global request slot or consume each other's response.
        std::unique_lock<std::mutex> requestLock(g_characterStateRequestMutex);
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
    if(name=="cancel_agent"){
        g_agentCancel.store(true);
        PostJson({{"type","status"},{"text","تم طلب إيقاف المهمة"},{"state","cancelling"},{"taskId",g_agentTaskId}});
        return {{"ok",true},{"cancelling",true},{"message","Cancellation requested; the active task will report its final cancelled state."}};
    }
    if(name=="system_info"){
        SYSTEM_INFO si{};GetSystemInfo(&si);MEMORYSTATUSEX ms{sizeof(ms)};GlobalMemoryStatusEx(&ms);
        return {{"ok",true},{"processors",si.dwNumberOfProcessors},{"memoryGB",ms.ullTotalPhys/1024.0/1024.0/1024.0},{"memoryFreeGB",ms.ullAvailPhys/1024.0/1024.0/1024.0}};
    }
    if(name=="active_window"){
        HWND h=GetForegroundWindow();wchar_t title[512]{};GetWindowTextW(h,title,512);DWORD pid=0;GetWindowThreadProcessId(h,&pid);
        return {{"ok",true},{"title",Utf8(title)},{"pid",pid}};
    }
    if(name=="window_geometry"){
        std::string needle=a.value("title","");
        if(needle.empty()) return {{"ok",false},{"error","Window title is empty"}};
        std::wstring wn=Wide(needle);
        HWND found=nullptr;
        std::pair<std::wstring,HWND> ctx{wn,nullptr};
        EnumWindows([](HWND h,LPARAM lp)->BOOL{
            auto* c=reinterpret_cast<std::pair<std::wstring,HWND>*>(lp);
            if(!IsWindowVisible(h)) return TRUE;
            wchar_t title[512]{};GetWindowTextW(h,title,512);std::wstring t(title),n=c->first;
            std::transform(t.begin(),t.end(),t.begin(),[](wchar_t ch){return (wchar_t)towlower(ch);});
            std::transform(n.begin(),n.end(),n.begin(),[](wchar_t ch){return (wchar_t)towlower(ch);});
            if(!n.empty()&&t.find(n)!=std::wstring::npos){c->second=h;return FALSE;} return TRUE;
        },reinterpret_cast<LPARAM>(&ctx));
        found=ctx.second;
        if(!found)return {{"ok",false},{"error","Window not found"}};
        RECT r{};GetWindowRect(found,&r);DWORD pid=0;GetWindowThreadProcessId(found,&pid);
        HMONITOR mon=MonitorFromWindow(found,MONITOR_DEFAULTTONEAREST);MONITORINFO mi{sizeof(mi)};GetMonitorInfoW(mon,&mi);
        return {{"ok",true},{"title",Utf8([&](){wchar_t t[512]{};GetWindowTextW(found,t,512);return std::wstring(t);}())},{"pid",pid},
                {"x",r.left},{"y",r.top},{"width",r.right-r.left},{"height",r.bottom-r.top},
                {"minimized",IsIconic(found)!=FALSE},{"maximized",IsZoomed(found)!=FALSE},
                {"monitorX",mi.rcMonitor.left},{"monitorY",mi.rcMonitor.top},
                {"monitorWidth",mi.rcMonitor.right-mi.rcMonitor.left},{"monitorHeight",mi.rcMonitor.bottom-mi.rcMonitor.top}};
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
        if(!InterruptibleSleep((DWORD)ms)) return {{"ok",false},{"cancelled",true},{"error","Agent task cancelled by user"}};
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
        std::string application=a.value("application","");
        if(application.empty())return {{"ok",false},{"error","Application is empty"}};
        HINSTANCE r=ShellExecuteW(nullptr,L"open",Wide(application).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
        if((INT_PTR)r<=32)return {{"ok",false},{"error","Windows could not launch the application"}};
        Sleep(1200);
        HWND fg=GetForegroundWindow(); DWORD pid=0; if(fg)GetWindowThreadProcessId(fg,&pid);
        wchar_t title[512]{}; if(fg)GetWindowTextW(fg,title,512);
        if(!fg) return {{"ok",false},{"application",application},{"error","Application launched but no foreground window was detected"}};
        return {{"ok",true},{"application",application},{"foregroundTitle",Utf8(std::wstring(title))},{"foregroundPid",pid},{"verified",fg!=nullptr}};
    }
    if(name=="open_url"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::string url=a.value("url","");
        if(url.rfind("https://",0)!=0 && url.rfind("http://",0)!=0)return {{"ok",false},{"error","Only http/https URLs are allowed"}};
        HINSTANCE r=ShellExecuteW(nullptr,L"open",Wide(url).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
        if((INT_PTR)r<=32)return {{"ok",false},{"error","Windows could not open the URL"}};
        Sleep(1200);
        HWND fg=GetForegroundWindow(); wchar_t title[512]{}; if(fg)GetWindowTextW(fg,title,512);
        if(!fg) return {{"ok",false},{"url",url},{"error","URL launch returned but no foreground window was detected"}};
        return {{"ok",true},{"url",url},{"foregroundTitle",Utf8(std::wstring(title))},{"verified",fg!=nullptr}};
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
        const std::wstring sourcePath=Wide(a.value("source",""));
        const std::wstring destinationPath=Wide(a.value("destination",""));
        if(IsProtectedWritePath(sourcePath)||(!destinationPath.empty()&&IsProtectedWritePath(destinationPath))){
            json request=a; request["kind"]="file_operation";
            return RunElevatedFileOperation(request);
        }
        return ExecuteFileOperationCore(a);
    }
    if(name=="read_file"){
        std::ifstream f(Utf8(Wide(a.value("filePath",""))));if(!f)return {{"ok",false},{"error","File not found or cannot be opened"}};
        std::ostringstream ss;ss<<f.rdbuf();std::string text=ss.str();if(text.size()>200000)text.resize(200000);
        return {{"ok",true},{"content",text}};
    }
    if(name=="write_file"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        std::wstring p=Wide(a.value("filePath",""));
        if(IsProtectedWritePath(p)){
            json request=a; request["kind"]="write_file";
            return RunElevatedFileOperation(request);
        }
        return ExecuteWriteFileCore(a);
    }
    if(name=="mouse_move"){
        int x=a.value("x",0),y=a.value("y",0);
        BOOL moved=SetCursorPos(x,y); POINT p{}; BOOL read=GetCursorPos(&p);
        bool verified=moved!=FALSE&&read!=FALSE&&p.x==x&&p.y==y;
        return {{"ok",verified},{"x",x},{"y",y},{"actualX",p.x},{"actualY",p.y},{"verified",verified}};
    }
    if(name=="mouse_click"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        int x=a.value("x",0),y=a.value("y",0); BOOL moved=SetCursorPos(x,y); POINT p{}; BOOL read=GetCursorPos(&p);
        if(!moved||!read||p.x!=x||p.y!=y)return {{"ok",false},{"error","Windows could not position the cursor"},{"x",x},{"y",y},{"actualX",p.x},{"actualY",p.y}};
        bool right=a.value("button","left")=="right";INPUT in[2]{};in[0].type=in[1].type=INPUT_MOUSE;in[0].mi.dwFlags=right?MOUSEEVENTF_RIGHTDOWN:MOUSEEVENTF_LEFTDOWN;in[1].mi.dwFlags=right?MOUSEEVENTF_RIGHTUP:MOUSEEVENTF_LEFTUP;UINT sent=SendInput(2,in,sizeof(INPUT));
        if(sent!=2)return {{"ok",false},{"error","Windows rejected the mouse input"}};
        if(a.value("verify_after",false)){ if(!InterruptibleSleep(350)) return {{"ok",false},{"cancelled",true},{"error","Agent task cancelled by user"}}; int mon=a.value("monitor",-1); if(mon<0){HMONITOR hm=MonitorFromPoint(POINT{a.value("x",0),a.value("y",0)},MONITOR_DEFAULTTONEAREST);json monitors=json::array();EnumDisplayMonitors(nullptr,nullptr,[](HMONITOR m,HDC,LPRECT,LPARAM lp)->BOOL{auto* out=reinterpret_cast<json*>(lp);MONITORINFO mi{sizeof(mi)};if(GetMonitorInfoW(m,&mi))out->push_back({{"handle",(uint64_t)(uintptr_t)m}});return TRUE;},reinterpret_cast<LPARAM>(&monitors));for(size_t i=0;i<monitors.size();++i)if(monitors[i].value("handle",0ULL)==(uint64_t)(uintptr_t)hm){mon=(int)i;break;}}
            std::string shot=CaptureMonitorJpeg(mon); if(!shot.empty())return {{"ok",true},{"verified",true},{"monitor",mon},{"mime","image/jpeg"},{"image_base64",shot}}; }
        return {{"ok",true},{"verified",false}};
    }
    if(name=="type_text"){
        if(!WaitConfirmation(name,a))return {{"ok",false},{"error","User denied action"}};
        HWND before=GetForegroundWindow(); DWORD beforePid=0; GetWindowThreadProcessId(before,&beforePid);
        std::wstring text=Wide(a.value("text",""));std::vector<INPUT> in;
        for(wchar_t ch:text){INPUT i{};i.type=INPUT_KEYBOARD;i.ki.wScan=ch;i.ki.dwFlags=KEYEVENTF_UNICODE;in.push_back(i);i.ki.dwFlags=KEYEVENTF_UNICODE|KEYEVENTF_KEYUP;in.push_back(i);}
        if(!in.empty()){
            UINT sent=SendInput((UINT)in.size(),in.data(),sizeof(INPUT));
            if(sent!=in.size())return {{"ok",false},{"error","Windows rejected some text input"},{"sent",sent},{"expected",(UINT)in.size()}};
        }
        // Re-check the foreground window after input; this is only transport
        // verification, while the Agent can request screen_capture for visual verification.
        HWND after=GetForegroundWindow(); DWORD afterPid=0; GetWindowThreadProcessId(after,&afterPid);
        return {{"ok",true},{"sent",in.size()},{"verified",after==before||afterPid==beforePid},{"foreground_pid",afterPid}};
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
        // Key delivery is verified at the OS transport level. For UI state changes,
        // the Agent should follow with screen_capture/window_geometry and verify the result.
        HWND after=GetForegroundWindow(); DWORD afterPid=0; GetWindowThreadProcessId(after,&afterPid);
        return {{"ok",true},{"sent",sent},{"verified",afterPid!=0},{"foreground_pid",afterPid}};
    }
    if(name=="remember"){
        auto mem=LoadArrayFile(MemoryPath());
        std::string fact=a.value("fact","");
        if(fact.empty()) return {{"ok",false},{"error","Memory fact is empty"}};
        std::string category=a.value("category","general");
        int importance=std::clamp(a.value("importance",3),1,5);
        const std::string now=WallClockIso();
        std::string id=now+"-"+std::to_string(++g_requestId);
        mem.push_back({{"id",id},{"fact",fact},{"category",category},{"importance",importance},{"time",now}});
        if(!SaveArrayFile(MemoryPath(),mem)) return {{"ok",false},{"error","Failed to save memory"}};
        return {{"ok",true},{"saved",fact},{"category",category},{"importance",importance}};
    }
    if(name=="forget"){
        auto mem=LoadArrayFile(MemoryPath());
        std::string id=a.value("id","");
        std::string query=a.value("query","");
        if(id.empty()&&query.empty()) return {{"ok",false},{"error","Memory id or query is required"}};
        size_t before=mem.size();
        mem.erase(std::remove_if(mem.begin(),mem.end(),[&](const json& x){
            if(!id.empty()) return x.value("id","")==id;
            std::string fact=x.value("fact","");
            return !query.empty()&&fact.find(query)!=std::string::npos;
        }),mem.end());
        if(mem.size()==before)return {{"ok",false},{"error","Memory entry not found"}};
        if(!SaveArrayFile(MemoryPath(),mem))return {{"ok",false},{"error","Failed to save memory"}};
        return {{"ok",true},{"removed",(int)(before-mem.size())}};
    }
    if(name=="recall"){
        auto mem=LoadArrayFile(MemoryPath());
        std::string q=a.value("query","");
        std::string category=a.value("category","");
        std::vector<std::pair<int,std::string>> ranked;
        auto lower=[](std::string s){std::transform(s.begin(),s.end(),s.begin(),[](unsigned char ch){return (char)std::tolower(ch);});return s;};
        std::string lq=lower(q);
        std::vector<std::string> terms; std::string term;
        for(unsigned char ch:lq){
            if(std::isalnum(ch) || ch>=128) term.push_back((char)ch);
            else if(!term.empty()){terms.push_back(term);term.clear();}
        }
        if(!term.empty())terms.push_back(term);
        for(auto& x:mem){
            std::string fact=x.value("fact","");
            std::string cat=x.value("category","general");
            if(!category.empty() && cat!=category) continue;
            std::string lf=lower(fact);
            int importance=std::clamp(x.value("importance",3),1,5);
            if(q.empty()){ranked.push_back({importance,fact});continue;}
            int score=(lf.find(lq)!=std::string::npos?100:0)+importance;
            for(const auto& t:terms) if(t.size()>1 && lf.find(t)!=std::string::npos) score+=2;
            if(score>importance) ranked.push_back({score,fact});
        }
        std::sort(ranked.begin(),ranked.end(),[](const auto& a,const auto& b){return a.first>b.first;});
        json matches=json::array();
        for(size_t i=0;i<ranked.size() && i<12;i++) matches.push_back(ranked[i].second);
        return {{"ok",true},{"matches",matches},{"count",matches.size()}};
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


static std::string LocalLower(std::string s){
    std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return (char)std::tolower(c);});
    return s;
}
static bool LocalContainsAny(const std::string& s,const std::vector<std::string>& terms){
    for(const auto& t:terms) if(s.find(t)!=std::string::npos) return true;
    return false;
}
static std::string LocalTrim(std::string s){
    const auto a=s.find_first_not_of(" \t\r\n");
    if(a==std::string::npos)return "";
    const auto b=s.find_last_not_of(" \t\r\n");
    return s.substr(a,b-a+1);
}
static bool LocalOpen(const std::string& target){
    if(target.empty())return false;
    HINSTANCE r=ShellExecuteW(nullptr,L"open",Wide(target).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
    return (INT_PTR)r>32;
}
static bool LocalOpenApplication(const std::string& app){
    if(app.empty())return false;
    HINSTANCE r=ShellExecuteW(nullptr,L"open",Wide(app).c_str(),nullptr,nullptr,SW_SHOWNORMAL);
    return (INT_PTR)r>32;
}
static bool LocalSetVolume(double percent){
    percent=std::clamp(percent,0.0,100.0);
    ComPtr<IMMDeviceEnumerator> enumerator;
    HRESULT hr=CoCreateInstance(__uuidof(MMDeviceEnumerator),nullptr,CLSCTX_ALL,IID_PPV_ARGS(&enumerator));
    if(FAILED(hr)||!enumerator)return false;
    ComPtr<IMMDevice> device;
    hr=enumerator->GetDefaultAudioEndpoint(eRender,eMultimedia,&device);
    if(FAILED(hr)||!device)return false;
    ComPtr<IAudioEndpointVolume> volume;
    hr=device->Activate(__uuidof(IAudioEndpointVolume),CLSCTX_ALL,nullptr,(void**)&volume);
    if(FAILED(hr)||!volume)return false;
    return SUCCEEDED(volume->SetMasterVolumeLevelScalar((float)(percent/100.0),nullptr));
}
static std::string LocalTimeText(){
    SYSTEMTIME st{};GetLocalTime(&st);
    char b[64]{};std::snprintf(b,sizeof(b),"%02u:%02u:%02u",(unsigned)st.wHour,(unsigned)st.wMinute,(unsigned)st.wSecond);
    return b;
}
static std::string LocalDateText(){
    SYSTEMTIME st{};GetLocalTime(&st);
    char b[64]{};std::snprintf(b,sizeof(b),"%04u-%02u-%02u",(unsigned)st.wYear,(unsigned)st.wMonth,(unsigned)st.wDay);
    return b;
}
static bool TryLocalCommand(const std::string& original){
    const std::string raw=LocalTrim(original);
    if(raw.empty())return false;
    const std::string q=LocalLower(raw);

    // Common direct Windows commands. These never require an AI provider/API.
    if(LocalContainsAny(q,{"what time","current time","time is it","كم الساعة","الساعة كم","الوقت كم","الوقت الآن"})){
        const std::string answer="الوقت الآن "+LocalTimeText();
        PostJson({{"type","answer"},{"text",answer},{"local",true}});
        return true;
    }
    if(LocalContainsAny(q,{"what date","today's date","todays date","date today","what day","ما تاريخ اليوم","تاريخ اليوم","اليوم كم"})){
        const std::string answer="تاريخ اليوم "+LocalDateText();
        PostJson({{"type","answer"},{"text",answer},{"local",true}});
        return true;
    }

    // Volume: "set volume to 50", "volume 30%", "اجعل الصوت 50%".
    if(LocalContainsAny(q,{"set volume","volume to","volume ","الصوت","ارفع الصوت","اخفض الصوت","مستوى الصوت"})){
        size_t pos=q.find_last_of("0123456789");
        if(pos!=std::string::npos){
            size_t start=pos;
            while(start>0 && std::isdigit((unsigned char)q[start-1]))--start;
            try{
                int pct=std::clamp(std::stoi(q.substr(start,pos-start+1)),0,100);
                if(LocalSetVolume(pct)){
                    const std::string answer="تم ضبط صوت الكمبيوتر إلى "+std::to_string(pct)+"%.";
                    PostJson({{"type","answer"},{"text",answer},{"local",true}});
                }else{
                    PostJson({{"type","error"},{"text","تعذر تغيير مستوى صوت Windows."}});
                }
                return true;
            }catch(...){}
        }
    }

    if(LocalContainsAny(q,{"my computer","this pc","computer","file explorer","explorer","جهاز الكمبيوتر","هذا الكمبيوتر","الكمبيوتر","مستكشف الملفات"})){
        HINSTANCE r=ShellExecuteW(nullptr,L"open",L"explorer.exe",L"shell:MyComputerFolder",nullptr,SW_SHOWNORMAL);
        if((INT_PTR)r>32){
            const std::string answer=(INT_PTR)r>32?"تم فتح جهاز الكمبيوتر.":"تعذر فتح جهاز الكمبيوتر.";
            PostJson({{"type","answer"},{"text",answer},{"local",true}});
        }else PostJson({{"type","error"},{"text","تعذر فتح مستكشف الملفات."}});
        return true;
    }

    std::string url;
    if(q.find("yahoo")!=std::string::npos){
        url="https://www.yahoo.com/";
    }else if(q.find("google")!=std::string::npos){
        url="https://www.google.com/";
    }else if(q.find("youtube")!=std::string::npos){
        url="https://www.youtube.com/";
    }
    if(!url.empty() && LocalContainsAny(q,{"open","go to","visit","website","browse","ادخل","افتح","اذهب","موقع","المتصفح"})){
        if(LocalOpen(url)) PostJson({{"type","answer"},{"text","تم فتح "+url+".","local",true}});
        else PostJson({{"type","error"},{"text","تعذر فتح الموقع في المتصفح الافتراضي."}});
        return true;
    }

    if(LocalContainsAny(q,{"open browser","open chrome","open edge","افتح المتصفح","افتح كروم","افتح إيدج"})){
        std::string app;
        if(q.find("chrome")!=std::string::npos||q.find("كروم")!=std::string::npos)app="chrome.exe";
        else if(q.find("edge")!=std::string::npos||q.find("إيدج")!=std::string::npos)app="msedge.exe";
        else app="msedge.exe";
        if(LocalOpenApplication(app))PostJson({{"type","answer"},{"text","تم فتح المتصفح.","local",true}});
        else PostJson({{"type","error"},{"text","تعذر تشغيل المتصفح."}});
        return true;
    }

    // Explicit local path: open any existing file/folder with its Windows association.
    if((raw.size()>2 && (raw[1]==':' || raw.rfind("\\\\",0)==0 || raw.rfind("/",0)==0))){
        std::error_code ec;
        if(std::filesystem::exists(Wide(raw),ec)){
            if(LocalOpen(raw))PostJson({{"type","answer"},{"text","تم فتح "+raw+".","local",true}});
            else PostJson({{"type","error"},{"text","تعذر فتح "+raw+"."}});
            return true;
        }
    }
    return false;
}

void RunAgent(std::string text){
    if(g_agentRunning.exchange(true)){
        PostJson({{"type","status"},{"text","سعيد مشغول بمهمة أخرى"},{"state","busy"}});
        return;
    }
    const std::string taskId="task-"+std::to_string(++g_agentTaskSerial);
    g_agentTaskId=taskId;
    g_agentCancel.store(false);
    PostJson({{"type","status"},{"text","بدأت مهمة جديدة"},{"state","running"},{"taskId",taskId}});
    RecordAgentEvent(taskId,"running","بدأت مهمة جديدة");
    UpdateAgentTaskState(taskId,text,"running",0,0,"plan","",0,"بدأت المهمة؛ سيتم إنشاء خطوات التنفيذ أثناء التقدم.");

    try{
        std::thread([text=std::move(text),taskId]() mutable{
        try{
            json settings=LoadSettings();
            std::string key=settings.value("apiKey",""); if(key.empty())throw std::runtime_error("ضع API key في الإعدادات أولاً.");
            std::string base=settings.value("baseUrl","https://openrouter.ai/api/v1");while(!base.empty()&&base.back()=='/')base.pop_back();
            std::string url=base+"/chat/completions";
            json history=LoadArrayFile(HistoryPath());
            json messages=json::array();
            messages.push_back({{"role","system"},{"content","You are Saeed, a persistent Windows desktop AI agent and companion. You have a reasoning loop, tools, visual perception, long-term memory, and the ability to execute multi-step tasks. Detect the language of each user message automatically. Always understand and respond in the same language as the user's latest message, including when the user switches languages between turns; never require a language setting and never translate unless the user asks. Do not merely explain how to do something when the user asks you to do it: inspect the computer, make a plan internally, execute safe steps, verify outcomes, recover from errors, and continue until the goal is complete or a real blocker exists. Use active_window, monitor_info and screen_capture before GUI actions when visual state matters. Use recall when the request may depend on prior user preferences or facts, and remember only facts the user explicitly asks you to remember. Maintain continuity across turns using conversation history and memory. Never claim success unless a tool result or verification supports it. Ask for confirmation only for actions marked as requiring it; never bypass confirmation. Avoid destructive actions unless explicitly requested and confirmed. When executing a multi-step task, treat tool failures as evidence, not as success: inspect the returned error/state, change the approach when needed, and stop repeating an identical failed action after the retry limit. Before a final answer, ensure the requested goal is actually verified; if it is not, clearly report the blocker instead of claiming completion."}});
            if(history.is_array()){ size_t start=history.size()>20?history.size()-20:0; for(size_t i=start;i<history.size();++i){ if(history[i].is_object()&&history[i].contains("role")&&history[i].contains("content")) messages.push_back({{"role",history[i]["role"]},{"content",history[i]["content"]}}); } }
            // Automatically surface relevant long-term memory for every user turn.
            // This does not save anything; it only provides existing memories as context.
            {
                auto mem=LoadArrayFile(MemoryPath());
                std::string q=text, lq=q;
                std::transform(lq.begin(),lq.end(),lq.begin(),[](unsigned char ch){return (char)std::tolower(ch);});
                std::vector<std::pair<int,std::string>> ranked;
                for(auto& x:mem){
                    std::string fact=x.value("fact","");
                    std::string lf=fact;
                    std::transform(lf.begin(),lf.end(),lf.begin(),[](unsigned char ch){return (char)std::tolower(ch);});
                    int score=std::clamp(x.value("importance",3),1,5);
                    if(lq.size()>2 && lf.find(lq)!=std::string::npos) score+=100;
                    std::vector<std::string> terms; std::string t;
                    for(unsigned char ch:lq){
                        if(std::isalnum(ch) || ch>=128) t.push_back((char)ch);
                        else if(!t.empty()){terms.push_back(t);t.clear();}
                    }
                    if(!t.empty())terms.push_back(t);
                    for(const auto& term:terms){
                        if(term.size()>1 && lf.find(term)!=std::string::npos) score+=3;
                    }
                    if(score>3) ranked.push_back({score,fact});
                }
                std::sort(ranked.begin(),ranked.end(),[](const auto& a,const auto& b){return a.first>b.first;});
                if(!ranked.empty()){
                    json context=json::array();
                    for(size_t i=0;i<ranked.size()&&i<8;i++) context.push_back(ranked[i].second);
                    messages.push_back({{"role","system"},{"content","Relevant long-term memory for this turn (use only when relevant; do not claim these facts if they conflict with the user's current message):\\n"+context.dump()}});
                }
            }
            messages.push_back({{"role","user"},{"content",text}});
            int maxSteps=std::clamp(settings.value("maxSteps",12),1,32);
            const int maxToolRetries=2;
            std::unordered_map<std::string,int> toolFailures;
            for(int step=0;step<maxSteps;step++){
                if(g_agentCancel.load()) throw std::runtime_error("Agent task cancelled by user.");
                PostJson({{"type","status"},{"text","سعيد يفكر..."},{"state","thinking"},{"taskId",taskId},{"step",step+1},{"maxSteps",maxSteps}});
                UpdateAgentTaskState(taskId,text,"thinking",step+1,maxSteps,"plan","",0,"تحليل الخطوة التالية والتحقق من حالة المهمة.");
                json req={{"model",settings.value("model","openai/gpt-5.1")},{"messages",messages},{"tools",ToolSchemas()},{"tool_choice","auto"}};
                json resp=json::parse(HttpPostJson(url,key,req));
                if(!resp.contains("choices"))throw std::runtime_error(resp.value("error",json{{"message","AI provider returned no choices"}}).value("message","AI error"));
                json msg=resp["choices"][0]["message"];
                if(msg.contains("tool_calls")&&!msg["tool_calls"].empty()){
                    messages.push_back(msg);
                    for(auto& tc:msg["tool_calls"]){
                        std::string name=tc["function"].value("name","");
                        json args=json::parse(tc["function"].value("arguments","{}"));
                        PostJson({{"type","status"},{"text","ينفذ: "+name},{"state","tool"},{"taskId",taskId},{"tool",name},{"step",step+1}});
                        RecordAgentEvent(taskId,"tool","تنفيذ الأداة",step+1,name);
                        UpdateAgentTaskState(taskId,text,"executing",step+1,maxSteps,"execute",name,0,"تنفيذ خطوة المهمة.");
                        json result=ExecuteTool(name,args);
                        if(!result.value("ok",false)){
                            const std::string failureKey=name+"|"+args.dump();
                            const int failures=++toolFailures[failureKey];
                            PostJson({{"type","status"},{"text","حدث خطأ، يحاول Saeed التعافي"},{"state","recovering"},{"taskId",taskId},{"tool",name},{"step",step+1},{"attempt",failures},{"maxAttempts",maxToolRetries+1}});
                            RecordAgentEvent(taskId,"recovering",result.value("error",std::string("tool failed")),step+1,name);
                            UpdateAgentTaskState(taskId,text,"recovering",step+1,maxSteps,"recover",name,failures,result.value("error",std::string("tool failed")));
                            result["agent_recovery_hint"]="The tool failed. Inspect the error and reconsider the target/state.";
                            if(failures>maxToolRetries){
                                result["retry_exhausted"]=true;
                                result["agent_recovery_hint"]="This exact tool/action has failed too many times. Do not repeat it unchanged. Inspect state and choose a different safe approach, or report a real blocker.";
                                PostJson({{"type","status"},{"text","استنفدت محاولات هذه العملية؛ يبحث Saeed عن طريقة أخرى"},{"state","recovery_exhausted"},{"taskId",taskId},{"tool",name},{"step",step+1}});
                            } else result["retry_allowed"]=true;
                        }
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
                // A text-only response is considered a completion only when the
                // model is not still describing an unfinished action.
                // Keep the execution journal explicit for diagnostics/recovery.
                RecordAgentEvent(taskId,"decision","Agent produced a final response",step+1);
                auto h=LoadArrayFile(HistoryPath()); h.push_back({{"role","user"},{"content",text}}); h.push_back({{"role","assistant"},{"content",answer}}); if(h.size()>40) h.erase(h.begin(),h.begin()+(h.size()-40)); SaveArrayFile(HistoryPath(),h);
                PostJson({{"type","answer"},{"text",answer},{"state","completed"},{"taskId",taskId}});
                RecordAgentEvent(taskId,"completed",answer);
                UpdateAgentTaskState(taskId,text,"completed",step+1,maxSteps,"verify","",0,"تم الوصول إلى إجابة نهائية بعد دورة التنفيذ.");
                g_agentRunning.store(false);
                return;
            }
            throw std::runtime_error("تم الوصول إلى حد خطوات الوكيل.");
        }catch(const std::exception& e){
            const bool cancelled=g_agentCancel.load();
            PostJson({{"type",cancelled?"status":"error"},{"text",cancelled?"تم إلغاء المهمة":e.what()},{"state",cancelled?"cancelled":"error"},{"taskId",taskId}});
            RecordAgentEvent(taskId,cancelled?"cancelled":"error",cancelled?"تم إلغاء المهمة":e.what());
        }
        g_agentRunning.store(false);
    }).detach();
    }catch(const std::exception& e){
        g_agentRunning.store(false);
        PostJson({{"type","error"},{"text",std::string("تعذر بدء مهمة Saeed: ")+e.what()},{"state","error"},{"taskId",taskId}});
    }
}

void InitializeWebView(){
    wchar_t local[MAX_PATH]{};
    GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH);
    std::wstring data=std::wstring(local)+L"\\Saeed\\WebView2Data";
    WriteLog("WebView2 environment creation starting");
    CreateCoreWebView2EnvironmentWithOptions(nullptr,data.c_str(),nullptr,Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([](HRESULT hr,ICoreWebView2Environment* env)->HRESULT{
        WriteLog("WebView2 environment callback received. HRESULT="+std::to_string((long)hr));
        if(FAILED(hr)||!env){
            const std::string msg="WebView2 Runtime is required but could not be initialized. HRESULT="+std::to_string((long)hr);
            WriteLog(msg);
            const std::wstring detail=L"Saeed cannot start the 3D interface.\n\nMicrosoft Edge WebView2 Runtime is missing, blocked, or incompatible.\n\nPlease run the Saeed installer again so it can install WebView2 Runtime, then restart Saeed.\n\nDiagnostic code: "+Wide(std::to_string((long)hr));
            MessageBoxW(g_hwnd,detail.c_str(),L"Saeed AI - Startup Error",MB_OK|MB_ICONERROR);
            return hr;
        }
        WriteLog("WebView2 environment is ready; requesting controller creation");
        HRESULT controllerRequestHr = env->CreateCoreWebView2Controller(g_hwnd,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([](HRESULT hr,ICoreWebView2Controller* c)->HRESULT{
            WriteLog("WebView2 controller callback received. HRESULT="+std::to_string((long)hr));
            if(FAILED(hr)||!c){
                const std::string msg="WebView2 controller initialization failed: "+std::to_string((long)hr);
                WriteLog(msg);
                const std::wstring detail=L"Saeed could not create the 3D rendering window.\n\nWebView2 started but its controller could not be created.\nCheck Windows graphics/driver settings and the diagnostic log at %LOCALAPPDATA%\\Saeed\\saeed.log.\n\nDiagnostic code: "+Wide(std::to_string((long)hr));
                MessageBoxW(g_hwnd,detail.c_str(),L"Saeed AI - Startup Error",MB_OK|MB_ICONERROR);
                return hr;
            }
            WriteLog("WebView2 controller object received; storing controller");
            g_controller=c;
            ComPtr<ICoreWebView2Controller2> c2;
            if(SUCCEEDED(c->QueryInterface(IID_PPV_ARGS(&c2)))&&c2){
                const HRESULT bgHr=c2->put_DefaultBackgroundColor(COREWEBVIEW2_COLOR{0,0,0,0});
                WriteLog("WebView2 transparent background configured. HRESULT="+std::to_string((long)bgHr));
            }
            WriteLog("Requesting CoreWebView2 interface from controller");
            const HRESULT coreHr=c->get_CoreWebView2(&g_webview);
            WriteLog("CoreWebView2 interface result. HRESULT="+std::to_string((long)coreHr));
            if(FAILED(coreHr)||!g_webview){
                const std::string msg="WebView2 CoreWebView2 interface could not be obtained. HRESULT="+std::to_string((long)coreHr);
                WriteLog(msg);
                MessageBoxW(g_hwnd,Wide("Saeed could not initialize the WebView2 browser interface.\n\nDiagnostic code: "+std::to_string((long)coreHr)).c_str(),L"Saeed AI - Startup Error",MB_OK|MB_ICONERROR);
                return FAILED(coreHr)?coreHr:E_FAIL;
            }
            if(g_webview){
                // Saeed is a packaged desktop application, not a browser page.
                // Disable browser-only affordances so right-click cannot expose
                // Save Image / Inspect / DevTools or browser accelerators.
                ComPtr<ICoreWebView2Settings> settings;
                const HRESULT settingsHr=g_webview->get_Settings(&settings);
                WriteLog("WebView2 settings query. HRESULT="+std::to_string((long)settingsHr));
                if(SUCCEEDED(settingsHr) && settings){
                    settings->put_AreDefaultContextMenusEnabled(FALSE);
                    settings->put_AreDevToolsEnabled(FALSE);
                    settings->put_IsStatusBarEnabled(FALSE);
                    settings->put_IsZoomControlEnabled(FALSE);
                    WriteLog("WebView2 browser chrome/context menus/devtools disabled");
                }
                WriteLog("Registering WebView2 microphone permission handler");
                const HRESULT permissionHr=g_webview->add_PermissionRequested(Callback<ICoreWebView2PermissionRequestedEventHandler>([](ICoreWebView2*,ICoreWebView2PermissionRequestedEventArgs* args)->HRESULT{
                    COREWEBVIEW2_PERMISSION_KIND kind{};
                    if(SUCCEEDED(args->get_PermissionKind(&kind))&&kind==COREWEBVIEW2_PERMISSION_KIND_MICROPHONE){
                        args->put_State(COREWEBVIEW2_PERMISSION_STATE_ALLOW);
                    }
                    return S_OK;
                }).Get(),nullptr);
                WriteLog("WebView2 microphone permission handler registered. HRESULT="+std::to_string((long)permissionHr));
            }
            WriteLog("Making WebView2 controller visible");
            const HRESULT visibleHr=c->put_IsVisible(TRUE);
            WriteLog("WebView2 controller visibility set. HRESULT="+std::to_string((long)visibleHr));
            ResizeWebView();
            WriteLog("WebView2 controller resized");
            WriteLog("Registering WebView2 message handler");
            const HRESULT messageHr=g_webview->add_WebMessageReceived(Callback<ICoreWebView2WebMessageReceivedEventHandler>([](ICoreWebView2*,ICoreWebView2WebMessageReceivedEventArgs* args)->HRESULT{
                LPWSTR raw=nullptr;if(FAILED(args->get_WebMessageAsJson(&raw)))return S_OK;
                try{
                    json j=json::parse(Utf8(raw));CoTaskMemFree(raw);raw=nullptr;
                    std::string type=j.value("type","");
                    if(type=="startup_diagnostic"){
                        const std::string message=j.value("message","Unknown startup error");
                        const std::string details=j.value("details","");
                        WriteLog(std::string("STARTUP_ERROR: ")+message+(details.empty()?"":" | "+details));
                        if(j.value("fatal",false)){
                            std::string combined="Saeed could not start its 3D interface.\n\n"+message;
                            if(!details.empty()) combined+="\n\nDetails: "+details;
                            MessageBoxW(g_hwnd,Wide(combined).c_str(),L"Saeed AI - 3D Startup Error",MB_OK|MB_ICONERROR);
                        }
                    } else if(type=="startup_ready"){
                        WriteLog("STARTUP_READY: WebView2 + WebGL + GLB character loaded. renderer="+j.value("renderer","unknown")+" vendor="+j.value("vendor","unknown"));
                    } else if(type=="check_update"){PostJson({{"type","update_status"},{"text","جاري فحص التحديثات..."}});CheckForUpdateAsync();}
                    else if(type=="apply_update"){StartUpdateDownload(j.value("url",""),j.value("version",""));}
                     else if(type=="choose_character"){ChooseCharacterFile();}
                    else if(type=="request_settings"){
                        json st=LoadSettings();
                        PostJson({{"type","settings_data"},{"provider",st.value("provider","openrouter")},{"baseUrl",st.value("baseUrl","https://openrouter.ai/api/v1")},{"model",st.value("model","openai/gpt-5.1")},{"apiKey",st.value("apiKey","")}});
                    } else if(type=="native_command"){
                        PostJson({{"type","native_command"},{"command",j.value("command","")}});
                    } else if(type=="restore_default_character"){
                        try{
                            json s=LoadSettings();
                            s.erase("characterPath");
                            SaveSettings(s);
                            PostJson({{"type","character_selected"},{"name","Saeed"},{"path","./saeed.ai.glb"},{"builtin",true}});
                        }catch(const std::exception& e){
                            PostJson({{"type","character_error"},{"text",std::string("Could not restore the default character: ")+e.what()}});
                        }
                    } else if(type=="window_drag"){
                        ReleaseCapture();
                        SendMessageW(g_hwnd,WM_NCLBUTTONDOWN,HTCAPTION,0);
                    } else if(type=="chat"){ const std::string text=j.value("text",""); if(!TryLocalCommand(text)) RunAgent(text); }
                    else if(type=="cancel_agent"){
                        g_agentCancel.store(true);
                        PostJson({{"type","status"},{"text","تم طلب إيقاف المهمة"},{"state","cancelling"}});
                    } else if(type=="confirm"){
                        std::lock_guard<std::mutex> l(g_confirmMutex);
                        const std::string responseId=j.value("id","");
                        if(responseId.empty() || responseId!=g_confirmId) return S_OK;
                        g_confirmValue=j.value("approved",false);
                        g_confirmId="done";
                        PostJson({{"type","status"},{"text",g_confirmValue?"تمت الموافقة، أتابع التنفيذ":"تم رفض العملية"},{"state",g_confirmValue?"approved":"denied"},{"taskId",g_agentTaskId}});
                        g_confirmCv.notify_all();
                    } else if(type=="character_state_response"){
                        std::lock_guard<std::mutex> l(g_characterStateMutex);
                        const std::string responseId=j.value("id","");
                        if(responseId.empty() || responseId!=g_characterStateId) return S_OK;
                        g_characterStateResult=j.value("state",json{{"ok",false},{"error","Invalid character state response"}});
                        g_characterStateId="done";
                        g_characterStateCv.notify_all();
                    } else if(type=="account_list"){
                        auto accounts=LoadArrayFile(LinkedAccountsPath()); if(!accounts.is_array()) accounts=json::array(); PostJson({{"type","account_list"},{"accounts",accounts}});
                    } else if(type=="exit_app"){
                        RemoveTrayIcon(); DestroyWindow(g_hwnd);
                    } else if(type=="account_signout"){
                        SignOutLinkedAccount(j.value("provider",""),j.value("accountId",""));
                    } else if(type=="account_session_save"){
                        try{ SaveLinkedAccountSession(j.value("account",json::object()),j.value("importedData",json::object())); PostJson({{"type","account_session_saved"},{"provider",j.value("account",json::object()).value("provider","")},{"accountId",j.value("account",json::object()).value("accountId","")}}); }
                        catch(const std::exception& e){ PostJson({{"type","error"},{"text",std::string("فشل حفظ جلسة الحساب: ")+e.what()}}); }
                    } else if(type=="account_signout_all"){
                        ClearAllLinkedAccountSessions(); PostJson({{"type","account_signed_out_all"}});
                    } else if(type=="settings"){
                        json s=LoadSettings();s["provider"]=j.value("provider",s.value("provider","openrouter"));s["baseUrl"]=j.value("baseUrl",s.value("baseUrl","https://openrouter.ai/api/v1"));s["model"]=j.value("model",s.value("model","openai/gpt-5.1"));s["maxSteps"]=j.value("maxSteps",12);s["voiceMode"]=j.value("voiceMode",s.value("voiceMode","always"));if(j.contains("apiKey")&&!j["apiKey"].get<std::string>().empty())s["apiKey"]=j["apiKey"];SaveSettings(s);PostJson({{"type","settingsSaved"}});
                    }
                }catch(...){if(raw)CoTaskMemFree(raw);}
                return S_OK;
            }).Get(),nullptr);
            WriteLog("WebView2 message handler registered. HRESULT="+std::to_string((long)messageHr));
            WriteLog("Registering WebView2 navigation handler");
            const HRESULT navigationHandlerHr=g_webview->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>([](ICoreWebView2*,ICoreWebView2NavigationCompletedEventArgs*)->HRESULT{
                WriteLog("WebView2 navigation completed; sending character selection and checking updates");
                SendCharacterSelection();
                CheckForUpdateAsync();
                // Ask the page directly for a deterministic module/runtime diagnostic.
            // This runs after NavigationCompleted and therefore distinguishes a native
            // WebView2 problem from a page/module/import problem.
            // NavigationCompleted can fire before an ES module graph finishes evaluating.
            // Do not probe __saeedModulesReady here; avatar.html reports startup_ready only
            // after Three.js, GLTFLoader, WebGL, and the GLB character are initialized.
            WriteLog("WebView2 navigation completed; waiting for page startup_ready");
                return S_OK;
            }).Get(),nullptr);
            WriteLog("WebView2 navigation handler registered. HRESULT="+std::to_string((long)navigationHandlerHr));
            WriteLog("Configuring WebView2 virtual host mapping for local avatar assets");
            ComPtr<ICoreWebView2_3> webview3;
            const HRESULT webview3Hr=g_webview->QueryInterface(IID_PPV_ARGS(&webview3));
            WriteLog("WebView2 ICoreWebView2_3 query result. HRESULT="+std::to_string((long)webview3Hr));
            if(FAILED(webview3Hr)||!webview3){
                const std::string msg="WebView2 virtual host mapping is unavailable. HRESULT="+std::to_string((long)webview3Hr);
                WriteLog(msg);
                MessageBoxW(g_hwnd,Wide("Saeed could not prepare the local 3D asset host.\n\nDiagnostic code: "+std::to_string((long)webview3Hr)).c_str(),L"Saeed AI - Startup Error",MB_OK|MB_ICONERROR);
                return FAILED(webview3Hr)?webview3Hr:E_NOINTERFACE;
            }
            const std::wstring appDir=AppDirectory();
            const HRESULT mapHr=webview3->SetVirtualHostNameToFolderMapping(L"saeed.local",appDir.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
            WriteLog("WebView2 application virtual host mapping result. HRESULT="+std::to_string((long)mapHr));
            if(FAILED(mapHr))return mapHr;
            const std::wstring characterDir=CharacterDirectory();
            const HRESULT characterMapHr=webview3->SetVirtualHostNameToFolderMapping(L"saeed-characters.local",characterDir.c_str(),COREWEBVIEW2_HOST_RESOURCE_ACCESS_KIND_ALLOW);
            WriteLog("WebView2 character virtual host mapping result. HRESULT="+std::to_string((long)characterMapHr));
            if(FAILED(characterMapHr))return characterMapHr;
            std::wstring url=L"https://saeed.local/assets/avatar.html";
            WriteLog("Navigating WebView2 to avatar.html via virtual host");
            HRESULT nav=g_webview->Navigate(url.c_str());
            WriteLog("WebView2 navigation request returned HRESULT="+std::to_string((long)nav));
            if(FAILED(nav)) WriteLog("Avatar navigation failed: "+std::to_string((long)nav));
            return S_OK;
        }).Get());
        WriteLog("WebView2 controller creation request returned HRESULT="+std::to_string((long)controllerRequestHr));
        return controllerRequestHr;
    }).Get());
}
LRESULT CALLBACK WndProc(HWND h,UINT msg,WPARAM wp,LPARAM lp){
    if(msg==WM_QUERYENDSESSION){
        // Allow Windows logoff/shutdown/restart to proceed; the app will
        // receive WM_ENDSESSION and clean up its native resources.
        return TRUE;
    }
    if(msg==WM_ENDSESSION){
        if(wp){
            g_shuttingDown=true;
            RemoveTrayIcon();
            UnregisterSaeedHotkey();
        }
        return 0;
    }

    if(msg==WM_SAEED_INIT_TRAY){
        AddTrayIcon();
        RegisterSaeedHotkey();
        return 0;
    }
    if(msg==WM_HOTKEY && wp==ID_SAEED_HOTKEY){
        ToggleSaeedVisibility();
        return 0;
    }
    if(msg==WM_SAEED_TRAY){
        if(lp==WM_LBUTTONDBLCLK){
            ShowWindow(h,SW_SHOWNOACTIVATE);
            SetWindowPos(h,HWND_TOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE);
        }else if(lp==WM_RBUTTONUP){
            ShowTrayMenu();
        }
        return 0;
    }

    switch(msg){
        case WM_APP+1:{auto* p=reinterpret_cast<std::wstring*>(lp);if(g_webview&&p){g_webview->PostWebMessageAsJson(p->c_str());}delete p;return 0;}
        case WM_GETMINMAXINFO:{
            auto* m=reinterpret_cast<MINMAXINFO*>(lp);
            if(m){
                // Keep the desktop companion within a sensible native window range.
                m->ptMinTrackSize.x=260;
                m->ptMinTrackSize.y=320;
                m->ptMaxTrackSize.x=460;
                m->ptMaxTrackSize.y=680;
            }
            return 0;
        }
        case WM_ERASEBKGND:return 1;
        case WM_NCHITTEST:return HTCLIENT;
        case WM_MOUSEACTIVATE:return MA_NOACTIVATE;
        case WM_DISPLAYCHANGE:
            KeepOnCurrentWorkArea();ResizeWebView();return 0;
        case WM_DPICHANGED:
            ApplyDpiSuggestedRect(lp);KeepOnCurrentWorkArea();ResizeWebView();return 0;
        case WM_SETTINGCHANGE:
            KeepOnCurrentWorkArea();ResizeWebView();return 0;
        case WM_SIZE:ResizeWebView();return 0;
        case WM_CLOSE:
            ShowWindow(h,SW_HIDE);
            return 0;
        case WM_DESTROY:
            g_shuttingDown=true;
            UnregisterSaeedHotkey();
            RemoveTrayIcon();
            g_webview.Reset();
            g_controller.Reset();
            PostQuitMessage(0);
            return 0;
    }
    return DefWindowProcW(h,msg,wp,lp);
}
}
void RestoreLastVisibility(){
    // Keep startup behavior predictable: a fresh launch always shows Saeed.
    // Visibility can then be toggled through the tray or global hotkey.
    ShowWindow(g_hwnd,SW_SHOWNOACTIVATE);
    SetWindowPos(g_hwnd,HWND_TOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE);
}

int APIENTRY wWinMain(HINSTANCE inst,HINSTANCE,LPWSTR,int){
    // WebView2 environment creation requires COM on the UI thread.
    // Without explicit COM initialization, CreateCoreWebView2EnvironmentWithOptions
    // can fail with CO_E_NOTINITIALIZED (0x800401F0) even when WebView2 is installed.
    const HRESULT comHr=CoInitializeEx(nullptr,COINIT_APARTMENTTHREADED);
    if(FAILED(comHr) && comHr!=RPC_E_CHANGED_MODE){
        WriteLog("COM initialization failed before WebView2 startup. HRESULT="+std::to_string((long)comHr));
        return 3;
    }
    const bool comInitialized=SUCCEEDED(comHr);
    SetUnhandledExceptionFilter(SaeedUnhandledException);
    int argc=0; LPWSTR* argv=CommandLineToArgvW(GetCommandLineW(),&argc);
    if(argv){
        for(int i=1;i<argc;i++){
            if(std::wstring(argv[i])==L"--saeed-apply-update" && i+2<argc){
                std::wstring installer=argv[i+1];
                DWORD parentPid=0;try{parentPid=std::stoul(argv[i+2]);}catch(...){}
                ApplyUpdateHelper(installer,parentPid);
                LocalFree(argv);
                return 0;
            }
        }
    }
    if(argv){
        for(int i=1;i<argc;i++){
            if(std::wstring(argv[i])==L"--saeed-elevated-op" && i+1<argc) RunElevatedOperationEntry(argv[i+1]);
        }
        LocalFree(argv);
    }
    // Prevent accidental duplicate Saeed instances. If one is already running,
    // bring its avatar window to the foreground and exit this launch.
    HANDLE singleInstance=CreateMutexW(nullptr,TRUE,L"Local\\SaeedAI.SingleInstance");
    if(!singleInstance)return 1;
    if(GetLastError()==ERROR_ALREADY_EXISTS){
        HWND existing=FindWindowW(L"SaeedNativeWindow",L"Saeed AI");
        if(existing){
            ShowWindow(existing,SW_SHOWNOACTIVATE);
            SetWindowPos(existing,HWND_TOPMOST,0,0,0,0,SWP_NOMOVE|SWP_NOSIZE|SWP_NOACTIVATE);
            SetForegroundWindow(existing);
        }
        CloseHandle(singleInstance);
        return 0;
    }
    SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);
    const wchar_t* cn=L"SaeedNativeWindow";WNDCLASSEXW wc{sizeof(wc)};wc.hInstance=inst;wc.lpfnWndProc=WndProc;wc.lpszClassName=cn;wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);
    if(!RegisterClassExW(&wc))return 1;
    g_hwnd=CreateWindowExW(WS_EX_LAYERED|WS_EX_TOOLWINDOW|WS_EX_TOPMOST,cn,L"Saeed AI",WS_POPUP,100,100,320,420,nullptr,nullptr,inst,nullptr);
    if(!g_hwnd)return 2;
    SetLayeredWindowAttributes(g_hwnd,0,255,LWA_ALPHA);
    RestoreLastVisibility();
    UpdateWindow(g_hwnd);
    // Do not touch the Windows notification-area shell synchronously during
    // startup. On headless/CI desktops Shell_NotifyIcon can block for many
    // seconds and prevent WebView2 UI-thread callbacks from being processed.
    // The tray is initialized once the message loop is running.
    WriteLog("Saeed C++ starting");
    WriteLog("Saeed native window created");
    // Saeed is designed to start with Windows. The registry entry is repaired
    // on every launch so reinstall/upgrade cannot accidentally disable startup.
    SetStartupEnabled(true);
    KeepOnCurrentWorkArea();
    WriteLog("Saeed work area positioned");
    InitializeWebView();
    WriteLog("Saeed WebView2 initialization requested");
    PostMessageW(g_hwnd,WM_SAEED_INIT_TRAY,0,0);
    MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}
    CloseHandle(singleInstance);
    if(comInitialized) CoUninitialize();
    return (int)msg.wParam;}
