#include <windows.h>
#include <array>
#include <memory>
#include "d3d11_window.h"
#include "opengl_window.h"
#include "filament_window.h"
#include "bgfx_window.h"
static LRESULT CALLBACK WndProc(HWND h,UINT m,WPARAM w,LPARAM l){if(m==WM_DESTROY){PostQuitMessage(0);return 0;}return DefWindowProcW(h,m,w,l);}
int WINAPI wWinMain(HINSTANCE inst,HINSTANCE,LPWSTR,int){
 WNDCLASSW wc{}; wc.hInstance=inst; wc.lpfnWndProc=WndProc; wc.lpszClassName=L"SaeedRendererLabNative"; wc.hCursor=LoadCursor(nullptr,IDC_ARROW); RegisterClassW(&wc);
 std::array<std::unique_ptr<IRenderLabWindow>,4> w;
 w[0]=std::make_unique<D3D11Window>(); w[1]=std::make_unique<OpenGLWindow>(); w[2]=std::make_unique<FilamentWindow>(); w[3]=std::make_unique<BgfxWindow>();
 const wchar_t* t[]={L"1 — DirectX 11 — Native D3D11",L"2 — OpenGL — Native WGL/OpenGL",L"3 — Filament — Google Filament",L"4 — bgfx — Native bgfx"};
 for(size_t i=0;i<w.size();++i) if(!w[i]->Create(inst,L"SaeedRendererLabNative",t[i],40+(int)i*520,40,500,720,L"saeed.ai.glb")) return 2;
 MSG msg{}; while(msg.message!=WM_QUIT){while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){TranslateMessage(&msg);DispatchMessageW(&msg);} for(auto& x:w)x->Frame(); Sleep(1);} return 0;
}