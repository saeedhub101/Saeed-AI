#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <winhttp.h>
#include <shellapi.h>
#include <nlohmann/json.hpp>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>
#include <sstream>
#include <stdexcept>
using json=nlohmann::json;
#ifndef SAEED_VERSION
#define SAEED_VERSION "0.3.0"
#endif
static std::wstring W(const std::string&s){int n=MultiByteToWideChar(CP_UTF8,0,s.data(),(int)s.size(),nullptr,0);std::wstring r(n,L'\0');MultiByteToWideChar(CP_UTF8,0,s.data(),(int)s.size(),r.data(),n);return r;}
static std::string U(const std::wstring&s){int n=WideCharToMultiByte(CP_UTF8,0,s.data(),(int)s.size(),nullptr,0,nullptr,nullptr);std::string r(n,'\0');WideCharToMultiByte(CP_UTF8,0,s.data(),(int)s.size(),r.data(),n,nullptr,nullptr);return r;}
static std::string HttpGet(const std::wstring&host,const std::wstring&path){
 HINTERNET s=WinHttpOpen(L"SaeedUpdater/1.0",WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,nullptr,nullptr,0);if(!s)throw std::runtime_error("WinHTTP unavailable");
 HINTERNET c=WinHttpConnect(s,host.c_str(),INTERNET_DEFAULT_HTTPS_PORT,0);if(!c){WinHttpCloseHandle(s);throw std::runtime_error("GitHub connection failed");}
 HINTERNET r=WinHttpOpenRequest(c,L"GET",path.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,WINHTTP_FLAG_SECURE);if(!r){WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("GitHub request failed");}
 if(!WinHttpSendRequest(r,WINHTTP_NO_ADDITIONAL_HEADERS,0,nullptr,0,0,0)||!WinHttpReceiveResponse(r,nullptr)){WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("GitHub request failed");}
 std::string out;DWORD avail=0;while(WinHttpQueryDataAvailable(r,&avail)&&avail){std::string b(avail,'\0');DWORD got=0;if(!WinHttpReadData(r,b.data(),avail,&got)||!got)break;b.resize(got);out+=b;}
 WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);return out;
}
static std::wstring TempInstaller(){wchar_t b[MAX_PATH]{};GetTempPathW(MAX_PATH,b);return (std::filesystem::path(b)/(L"Saeed-AI-Update-"+std::to_wstring(GetTickCount64())+L".exe")).wstring();}
static void Download(const std::wstring&url,const std::wstring&out){
 URL_COMPONENTSW uc{};uc.dwStructSize=sizeof(uc);wchar_t host[512]{},path[4096]{},extra[4096]{};uc.lpszHostName=host;uc.dwHostNameLength=512;uc.lpszUrlPath=path;uc.dwUrlPathLength=4096;uc.lpszExtraInfo=extra;uc.dwExtraInfoLength=4096;
 if(!WinHttpCrackUrl(url.c_str(),0,0,&uc))throw std::runtime_error("Invalid update URL");
 HINTERNET s=WinHttpOpen(L"SaeedUpdater/1.0",WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,nullptr,nullptr,0);if(!s)throw std::runtime_error("WinHTTP unavailable");
 HINTERNET c=WinHttpConnect(s,uc.lpszHostName,uc.nPort,0);if(!c){WinHttpCloseHandle(s);throw std::runtime_error("Update host connection failed");}
 std::wstring req=std::wstring(uc.lpszUrlPath,uc.dwUrlPathLength)+std::wstring(uc.lpszExtraInfo?uc.lpszExtraInfo:L"",uc.dwExtraInfoLength);
 HINTERNET r=WinHttpOpenRequest(c,L"GET",req.c_str(),nullptr,WINHTTP_NO_REFERER,WINHTTP_DEFAULT_ACCEPT_TYPES,(uc.nScheme==INTERNET_SCHEME_HTTPS?WINHTTP_FLAG_SECURE:0));if(!r){WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("Update download failed");}
 if(!WinHttpSendRequest(r,WINHTTP_NO_ADDITIONAL_HEADERS,0,nullptr,0,0,0)||!WinHttpReceiveResponse(r,nullptr)){WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);throw std::runtime_error("Update download failed");}
 std::ofstream f(U(out),std::ios::binary);if(!f)throw std::runtime_error("Cannot create update file");DWORD avail=0;while(WinHttpQueryDataAvailable(r,&avail)&&avail){std::vector<char>b(avail);DWORD got=0;if(!WinHttpReadData(r,b.data(),avail,&got)||!got)break;f.write(b.data(),got);}f.close();WinHttpCloseHandle(r);WinHttpCloseHandle(c);WinHttpCloseHandle(s);
 if(!std::filesystem::exists(out)||std::filesystem::file_size(out)<100000)throw std::runtime_error("Downloaded update is invalid");
}
static int CmpVersion(std::string a,std::string b){auto p=[](std::string s){if(!s.empty()&&s[0]=='v')s.erase(0,1);std::vector<int>v;std::stringstream ss(s);std::string x;while(std::getline(ss,x,'.')){try{v.push_back(std::stoi(x));}catch(...){v.push_back(0);}}while(v.size()<3)v.push_back(0);return v;};auto x=p(a),y=p(b);for(int i=0;i<3;i++)if(x[i]!=y[i])return x[i]<y[i]?-1:1;return 0;}
int WINAPI wWinMain(HINSTANCE,HINSTANCE,LPWSTR,int){
 try{
  auto rel=json::parse(HttpGet(L"api.github.com",L"/repos/saeedhub101/Saeed-AI/releases/latest"));std::string tag=rel.value("tag_name","");
  if(tag.empty()||CmpVersion(SAEED_VERSION,tag)>=0){MessageBoxW(nullptr,L"Saeed is already up to date.",L"Saeed AI",MB_OK|MB_ICONINFORMATION);return 0;}
  std::string asset;for(auto&a:rel.value("assets",json::array()))if(a.value("name","")=="Saeed-AI-Setup-x64.exe"){asset=a.value("browser_download_url","");break;}
  if(asset.empty())throw std::runtime_error("Latest installer asset not found");
  std::wstring installer=TempInstaller();Download(W(asset),installer);
  STARTUPINFOW si{sizeof(si)};PROCESS_INFORMATION pi{};
  std::wstring cmd=L"\""+installer+L"\" /SILENT /CLOSEAPPLICATIONS /NORESTART";
  if(!CreateProcessW(nullptr,cmd.data(),nullptr,nullptr,FALSE,0,nullptr,nullptr,&si,&pi))throw std::runtime_error("Could not start installer");
  WaitForSingleObject(pi.hProcess,INFINITE);DWORD code=1;GetExitCodeProcess(pi.hProcess,&code);CloseHandle(pi.hThread);CloseHandle(pi.hProcess);
  std::error_code ec;std::filesystem::remove(installer,ec);
  if(code!=0)throw std::runtime_error("Installer returned a failure code");
  wchar_t exe[MAX_PATH]{};DWORD n=GetModuleFileNameW(nullptr,exe,MAX_PATH);std::filesystem::path updater(exe);std::filesystem::path app=updater.parent_path()/L"Saeed.exe";
  ShellExecuteW(nullptr,L"open",app.wstring().c_str(),nullptr,nullptr,SW_SHOWNOACTIVATE);
  return 0;
 }catch(const std::exception&e){MessageBoxW(nullptr,W(std::string("Saeed update failed: ")+e.what()).c_str(),L"Saeed AI Update",MB_OK|MB_ICONERROR);return 1;}
}