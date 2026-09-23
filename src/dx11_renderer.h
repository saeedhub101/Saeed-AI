#pragma once
#include <windows.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <dcomp.h>
#include <wrl.h>
#include <string>
#include "dx11_avatar_renderer.h"

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

    bool LoadAvatar(const std::wstring& path);
    void ClearAvatar();
    bool HasAvatar() const { return m_avatar.HasAvatar(); }
    bool IsInitialized() const { return m_device != nullptr && m_swapChain != nullptr; }

private:
    bool CreateDeviceAndSwapChain();
    bool CreateCompositionTarget();
    bool CreateRenderTarget();

    HWND m_hwnd = nullptr;
    Microsoft::WRL::ComPtr<ID3D11Device> m_device;
    Microsoft::WRL::ComPtr<ID3D11DeviceContext> m_context;
    Microsoft::WRL::ComPtr<IDXGISwapChain1> m_swapChain;
    Microsoft::WRL::ComPtr<ID3D11RenderTargetView> m_renderTarget;
    Microsoft::WRL::ComPtr<IDCompositionDevice> m_dcompDevice;
    Microsoft::WRL::ComPtr<IDCompositionTarget> m_dcompTarget;
    Microsoft::WRL::ComPtr<IDCompositionVisual> m_dcompVisual;
    SaeedDx11AvatarRenderer m_avatar;
};
