#include <windows.h>
#include <array>
#include <memory>
#include <filesystem>
#include "d3d11_window.h"
#include "opengl_window.h"
#include "filament_window.h"

static std::wstring exeDir() {
    wchar_t buf[MAX_PATH]{};
    DWORD n = GetModuleFileNameW(nullptr, buf, MAX_PATH);
    if (n == 0 || n >= MAX_PATH) return L".";
    return std::filesystem::path(buf, buf + n).parent_path().wstring();
}

int WINAPI wWinMain(HINSTANCE inst,HINSTANCE,LPWSTR,int){
    const std::wstring glb = (std::filesystem::path(exeDir()) / L"saeed.ai.glb").wstring();

    if (GetFileAttributesW(glb.c_str()) == INVALID_FILE_ATTRIBUTES) {
        MessageBoxW(nullptr,
            L"Saeed Renderer Lab could not find saeed.ai.glb.\n\n"
            L"Keep saeed.ai.glb in the same folder as the EXE.",
            L"Saeed Renderer Lab", MB_OK | MB_ICONERROR);
        return 10;
    }

    std::array<std::unique_ptr<IRenderLabWindow>,3> w;
    w[0]=std::make_unique<D3D11Window>();
    w[1]=std::make_unique<OpenGLWindow>();
    w[2]=std::make_unique<FilamentWindow>();

    const wchar_t* t[]={
        L"1 — DirectX 11 — Native D3D11",
        L"2 — OpenGL — Native WGL/OpenGL",
        L"3 — Filament — Google Filament"
    };

    for(size_t i=0;i<w.size();++i) {
        if(!w[i]->Create(inst,L"SaeedRendererLabNative",t[i],
                         40+(int)i*520,40,500,720,glb.c_str())) {
            MessageBoxW(nullptr,
                L"One of the renderer windows failed to initialize.\n\n"
                L"Check the Windows graphics drivers and keep saeed.ai.glb beside the EXE.",
                L"Saeed Renderer Lab", MB_OK | MB_ICONERROR);
            return 20 + (int)i;
        }
    }

    MSG msg{};
    while(msg.message!=WM_QUIT){
        while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        for(auto& x:w) x->Frame();
        Sleep(1);
    }
    return 0;
}