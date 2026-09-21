#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellscalingapi.h>
#include <wrl.h>
#include <WebView2.h>
#include <algorithm>
#include <string>
using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;
namespace {
HWND g_hwnd=nullptr;
ComPtr<ICoreWebView2Controller> g_controller;
ComPtr<ICoreWebView2> g_webview;
std::wstring AppDirectory(){wchar_t b[MAX_PATH]{};DWORD n=GetModuleFileNameW(nullptr,b,MAX_PATH);std::wstring p(b,n);auto i=p.find_last_of(L"\\/");return i==std::wstring::npos?L".":p.substr(0,i);}
void ResizeWebView(){if(!g_controller)return;RECT r{};GetClientRect(g_hwnd,&r);g_controller->put_Bounds(r);}
void KeepOnCurrentWorkArea(){HMONITOR m=MonitorFromWindow(g_hwnd,MONITOR_DEFAULTTONEAREST);MONITORINFO mi{sizeof(mi)};if(!GetMonitorInfoW(m,&mi))return;RECT r=mi.rcWork,w{};GetWindowRect(g_hwnd,&w);int ww=w.right-w.left,hh=w.bottom-w.top,margin=24;int x=std::clamp(r.right-ww-margin,r.left,r.right-ww);int y=std::clamp(r.bottom-hh-margin,r.top,r.bottom-hh);SetWindowPos(g_hwnd,HWND_TOPMOST,x,y,ww,hh,SWP_NOACTIVATE|SWP_SHOWWINDOW);}
void InitializeWebView(){std::wstring data=AppDirectory()+L"\\SaeedWebViewData";CreateCoreWebView2EnvironmentWithOptions(nullptr,data.c_str(),nullptr,Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>([](HRESULT hr,ICoreWebView2Environment* env)->HRESULT{if(FAILED(hr)||!env)return hr;return env->CreateCoreWebView2Controller(g_hwnd,Callback<ICoreWebView2CreateCoreWebView2ControllerCompletedHandler>([](HRESULT hr,ICoreWebView2Controller* c)->HRESULT{if(FAILED(hr)||!c)return hr;g_controller=c;c->get_CoreWebView2(&g_webview);c->put_IsVisible(TRUE);ResizeWebView();std::wstring url=L"file:///"+AppDirectory()+L"/assets/avatar.html";g_webview->Navigate(url.c_str());return S_OK;}).Get());}).Get());}
LRESULT CALLBACK WndProc(HWND h,UINT msg,WPARAM wp,LPARAM lp){switch(msg){case WM_NCHITTEST:return HTCAPTION;case WM_DISPLAYCHANGE:case WM_DPICHANGED:case WM_MOVE:case WM_SIZE:ResizeWebView();KeepOnCurrentWorkArea();return 0;case WM_DESTROY:g_webview.Reset();g_controller.Reset();PostQuitMessage(0);return 0;}return DefWindowProcW(h,msg,wp,lp);}
}
int APIENTRY wWinMain(HINSTANCE inst,HINSTANCE,LPWSTR,int){SetProcessDpiAwareness(PROCESS_PER_MONITOR_DPI_AWARE);const wchar_t* cn=L"SaeedNativeWindow";WNDCLASSEXW wc{sizeof(wc)};wc.hInstance=inst;wc.lpfnWndProc=WndProc;wc.lpszClassName=cn;wc.hCursor=LoadCursorW(nullptr,IDC_ARROW);if(!RegisterClassExW(&wc))return 1;g_hwnd=CreateWindowExW(WS_EX_LAYERED|WS_EX_TOOLWINDOW|WS_EX_TOPMOST,cn,L"Saeed AI",WS_POPUP,100,100,420,620,nullptr,nullptr,inst,nullptr);if(!g_hwnd)return 2;SetLayeredWindowAttributes(g_hwnd,0,255,LWA_ALPHA);ShowWindow(g_hwnd,SW_SHOWNOACTIVATE);UpdateWindow(g_hwnd);KeepOnCurrentWorkArea();InitializeWebView();MSG msg{};while(GetMessageW(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessageW(&msg);}return (int)msg.wParam;}
