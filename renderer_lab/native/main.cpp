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

static void failBox(const wchar_t* renderer, int code) {
    wchar_t msg[1024]{};
    swprintf_s(msg, L"%s renderer failed to initialize.\n\nError code: %d\n\n"
                    L"The other renderer tests will still be attempted.\n"
                    L"See Saeed-Renderer-Lab.log beside the EXE for diagnostics.",
                    renderer, code);
    MessageBoxW(nullptr, msg, L"Saeed Renderer Lab - Renderer Diagnostic",
                MB_OK | MB_ICONERROR);
}

int WINAPI wWinMain(HINSTANCE inst,HINSTANCE,LPWSTR,int){
    const std::wstring dir = exeDir();
    const std::wstring glb = (std::filesystem::path(dir) / L"saeed.ai.glb").wstring();
    const std::wstring logPath = (std::filesystem::path(dir) / L"Saeed-Renderer-Lab.log").wstring();

    FILE* log = nullptr;
    _wfopen_s(&log, logPath.c_str(), L"wt, ccs=UTF-8");
    if (log) {
        fwprintf(log, L"Saeed Renderer Lab diagnostic start\n");
        fwprintf(log, L"EXE directory: %ls\n", dir.c_str());
        fwprintf(log, L"GLB: %ls\n", glb.c_str());
        fwprintf(log, L"GLB present: %ls\n",
                 GetFileAttributesW(glb.c_str()) == INVALID_FILE_ATTRIBUTES ? L"NO" : L"YES");
        fflush(log);
    }

    if (GetFileAttributesW(glb.c_str()) == INVALID_FILE_ATTRIBUTES) {
        if (log) fclose(log);
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
    const wchar_t* names[]={L"DirectX 11",L"OpenGL",L"Filament"};

    int failures = 0;
    for(size_t i=0;i<w.size();++i) {
        bool ok = w[i]->Create(inst,L"SaeedRendererLabNative",t[i],
                               40+(int)i*520,40,500,720,glb.c_str());
        if (!ok) {
            ++failures;
            if (log) fwprintf(log, L"%ls: FAILED to initialize\n", names[i]);
            failBox(names[i], 20 + (int)i);
            w[i].reset();
        } else if (log) {
            fwprintf(log, L"%ls: initialized successfully\n", names[i]);
        }
    }

    if (log) {
        fwprintf(log, L"Initialization failures: %d\n", failures);
        fflush(log);
    }

    if (failures == 3) {
        if (log) fclose(log);
        return 23;
    }

    MSG msg{};
    while(msg.message!=WM_QUIT){
        while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){
            TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
        for(auto& x:w) if (x) x->Frame();
        Sleep(1);
    }
    if (log) fclose(log);
    return failures ? 21 : 0;
}
