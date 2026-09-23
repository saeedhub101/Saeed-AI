#include "saeed_windows_automation.h"
#include <algorithm>
#include <filesystem>
#include <cwctype>
#include <tlhelp32.h>

using json=nlohmann::json;
namespace {
std::wstring Lower(std::wstring s){std::transform(s.begin(),s.end(),s.begin(),[](wchar_t c){return (wchar_t)towlower(c);});return s;}
HWND FindWindowByTitle(const std::string& title){
    std::wstring n=Lower(std::wstring(title.begin(),title.end()));
    HWND found=nullptr;
    EnumWindows([](HWND h,LPARAM p)->BOOL{
        auto* q=reinterpret_cast<std::pair<std::wstring,HWND*>*>(p);
        if(!IsWindowVisible(h)) return TRUE;
        wchar_t b[512]{};GetWindowTextW(h,b,512);
        std::wstring t=Lower(b);
        if(!q->first.empty()&&t.find(q->first)!=std::wstring::npos){*q->second=h;return FALSE;}
        return TRUE;
    },reinterpret_cast<LPARAM>(&std::pair<std::wstring,HWND*>{n,&found}));
    return found;
}
std::string Title(HWND h){wchar_t b[512]{};GetWindowTextW(h,b,512);int n=WideCharToMultiByte(CP_UTF8,0,b,-1,nullptr,0,nullptr,nullptr);std::string s(n? n-1:0,'\0');if(n)WideCharToMultiByte(CP_UTF8,0,b,-1,s.data(),n,nullptr,nullptr);return s;}
}
namespace SaeedWindows {
json EnumerateWindows(){
    json out=json::array();
    EnumWindows([](HWND h,LPARAM p)->BOOL{
        if(!IsWindowVisible(h))return TRUE;
        wchar_t t[512]{};GetWindowTextW(h,t,512);if(!t[0])return TRUE;
        RECT r{};GetWindowRect(h,&r);DWORD pid=0;GetWindowThreadProcessId(h,&pid);
        auto* a=reinterpret_cast<json*>(p);
        a->push_back({{"title",Title(h)},{"pid",pid},{"x",r.left},{"y",r.top},{"width",r.right-r.left},{"height",r.bottom-r.top},{"minimized",!!IsIconic(h)},{"maximized",!!IsZoomed(h)}});
        return TRUE;
    },reinterpret_cast<LPARAM>(&out));
    return {{"ok",true},{"windows",out},{"count",out.size()}};
}
json GetWindow(const std::string& title){
    HWND h=FindWindowByTitle(title);if(!h)return {{"ok",false},{"error","Window not found"}};
    RECT r{};GetWindowRect(h,&r);DWORD pid=0;GetWindowThreadProcessId(h,&pid);
    return {{"ok",true},{"title",Title(h)},{"pid",pid},{"x",r.left},{"y",r.top},{"width",r.right-r.left},{"height",r.bottom-r.top},{"minimized",!!IsIconic(h)},{"maximized",!!IsZoomed(h)}};
}
json SetWindowGeometry(const std::string& title,int x,int y,int width,int height,bool maximize,bool restore){
    HWND h=FindWindowByTitle(title);if(!h)return {{"ok",false},{"error","Window not found"}};
    if(restore)ShowWindow(h,SW_RESTORE);
    if(maximize)ShowWindow(h,SW_MAXIMIZE);
    else if(width>0&&height>0)SetWindowPos(h,nullptr,x,y,width,height,SWP_NOZORDER|SWP_NOACTIVATE);
    Sleep(80);
    RECT r{};GetWindowRect(h,&r);
    bool verified=maximize?!!IsZoomed(h):(r.left==x&&r.top==y&&(r.right-r.left)==width&&(r.bottom-r.top)==height);
    return {{"ok",verified},{"verified",verified},{"title",Title(h)},{"x",r.left},{"y",r.top},{"width",r.right-r.left},{"height",r.bottom-r.top},{"maximized",!!IsZoomed(h)}};
}
json RestoreWindow(const std::string& title){
    HWND h=FindWindowByTitle(title);if(!h)return {{"ok",false},{"error","Window not found"}};
    ShowWindow(h,SW_RESTORE);Sleep(80);
    return {{"ok",!IsIconic(h)&&!IsZoomed(h)},{"verified",!IsIconic(h)&&!IsZoomed(h)},{"title",Title(h)}};
}
json SearchFiles(const std::wstring& root,const std::wstring& query,int maxResults){
    json out=json::array();std::error_code ec;std::filesystem::path base(root);
    if(!std::filesystem::exists(base,ec))return {{"ok",false},{"error","Search root does not exist"}};
    const auto q=Lower(query);size_t visited=0;
    try{
        for(const auto& e:std::filesystem::recursive_directory_iterator(base,std::filesystem::directory_options::skip_permission_denied,ec)){
            if(ec){ec.clear();continue;} if(++visited>50000)break;
            std::wstring n=Lower(e.path().filename().wstring());
            if(q.empty()||n.find(q)!=std::wstring::npos){
                out.push_back({{"path",e.path().wstring()},{"directory",e.is_directory(ec)}});
                if((int)out.size()>=maxResults)break;
            }
        }
    }catch(...){}
    return {{"ok",true},{"root",root},{"query",query},{"results",out},{"count",out.size()},{"visited",visited}};
}
json EnumerateProcesses(){
    json out=json::array();HANDLE s=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0);
    if(s==INVALID_HANDLE_VALUE)return {{"ok",false},{"error","Cannot enumerate processes"}};
    PROCESSENTRY32W pe{sizeof(pe)};if(Process32FirstW(s,&pe)){do{out.push_back({{"name",std::wstring(pe.szExeFile)},{"pid",pe.th32ProcessID}});}while(Process32NextW(s,&pe));}CloseHandle(s);
    return {{"ok",true},{"processes",out},{"count",out.size()}};
}
json TerminateProcessByPid(DWORD pid){
    if(pid==0||pid==GetCurrentProcessId())return {{"ok",false},{"error","Refusing to terminate Saeed itself"}};
    HANDLE h=OpenProcess(PROCESS_TERMINATE|PROCESS_QUERY_LIMITED_INFORMATION,FALSE,pid);
    if(!h)return {{"ok",false},{"error","Process could not be opened","pid",pid}};
    BOOL ok=TerminateProcess(h,1);CloseHandle(h);Sleep(100);
    return {{"ok",!!ok},{"verified",!!ok},{"pid",pid}};
}
}
