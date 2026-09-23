#pragma once
#include <windows.h>
#include <d3d11.h>
#include <dxgi.h>
#include <wrl.h>

class SaeedDx11Renderer {
public:
    SaeedDx11Renderer() = default;
    ~SaeedDx11Renderer();

    SaeedDx11Renderer(const SaeedDx11Renderer&) = delete;
    SaeedDx11Renderer& operator=(const SaeedDx11Renderer&) = delete;

    bool Initialize(HWND hwnd);
    void Shutdown();
    void Resize();
    void Render();

    bool IsInitialized() const { return m_device != nullptr && m_swapChain != nullptr; }

private:
    bool CreateDeviceAndSwapChain();
    bool CreateRenderTarget();

    HWND m_hwnd = nullptr;
    Microsoft::WRL::ComPtr<ID3D11Device> m_device;
    Microsoft::WRL::ComPtr<ID3D11DeviceContext> m_context;
    Microsoft::WRL::ComPtr<IDXGISwapChain> m_swapChain;
    Microsoft::WRL::ComPtr<ID3D11RenderTargetView> m_renderTarget;
};
