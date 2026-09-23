#include "dx11_renderer.h"
#include <algorithm>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")

SaeedDx11Renderer::~SaeedDx11Renderer() { Shutdown(); }

bool SaeedDx11Renderer::Initialize(HWND hwnd) {
    if (!hwnd) return false;
    m_hwnd=hwnd;
    if (!CreateDeviceAndSwapChain() || !CreateRenderTarget()) {
        Shutdown();
        return false;
    }
    return m_avatar.Initialize(m_device.Get(),m_context.Get());
}

void SaeedDx11Renderer::Shutdown() {
    m_avatar.Shutdown();
    if (m_context) m_context->ClearState();
    m_renderTarget.Reset();
    m_swapChain.Reset();
    m_context.Reset();
    m_device.Reset();
    m_hwnd=nullptr;
}

bool SaeedDx11Renderer::CreateDeviceAndSwapChain() {
    RECT rc{};
    if (!GetClientRect(m_hwnd,&rc)) return false;
    const UINT width=std::max<LONG>(1,rc.right-rc.left);
    const UINT height=std::max<LONG>(1,rc.bottom-rc.top);

    DXGI_SWAP_CHAIN_DESC desc{};
    desc.BufferCount=2;
    desc.BufferDesc.Width=width;
    desc.BufferDesc.Height=height;
    desc.BufferDesc.Format=DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.BufferDesc.RefreshRate.Numerator=60;
    desc.BufferDesc.RefreshRate.Denominator=1;
    desc.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;
    desc.OutputWindow=m_hwnd;
    desc.SampleDesc.Count=1;
    desc.Windowed=TRUE;
    desc.SwapEffect=DXGI_SWAP_EFFECT_FLIP_DISCARD;

    constexpr D3D_FEATURE_LEVEL levels[]={D3D_FEATURE_LEVEL_11_1,D3D_FEATURE_LEVEL_11_0};
    D3D_FEATURE_LEVEL selected{};
    HRESULT hr=D3D11CreateDeviceAndSwapChain(nullptr,D3D_DRIVER_TYPE_HARDWARE,nullptr,
        D3D11_CREATE_DEVICE_BGRA_SUPPORT,levels,ARRAYSIZE(levels),D3D11_SDK_VERSION,
        &desc,m_swapChain.GetAddressOf(),m_device.GetAddressOf(),&selected,m_context.GetAddressOf());

    if (FAILED(hr)) {
        hr=D3D11CreateDeviceAndSwapChain(nullptr,D3D_DRIVER_TYPE_WARP,nullptr,
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,levels,ARRAYSIZE(levels),D3D11_SDK_VERSION,
            &desc,m_swapChain.GetAddressOf(),m_device.GetAddressOf(),&selected,m_context.GetAddressOf());
    }
    return SUCCEEDED(hr);
}

bool SaeedDx11Renderer::CreateRenderTarget() {
    if (!m_swapChain||!m_device) return false;
    Microsoft::WRL::ComPtr<ID3D11Texture2D> backBuffer;
    HRESULT hr=m_swapChain->GetBuffer(0,IID_PPV_ARGS(backBuffer.GetAddressOf()));
    if (FAILED(hr)) return false;
    return SUCCEEDED(m_device->CreateRenderTargetView(backBuffer.Get(),nullptr,m_renderTarget.GetAddressOf()));
}

void SaeedDx11Renderer::Resize() {
    if (!m_swapChain) return;
    m_context->OMSetRenderTargets(0,nullptr,nullptr);
    m_renderTarget.Reset();

    RECT rc{};
    if (!GetClientRect(m_hwnd,&rc)) return;
    const UINT width=std::max<LONG>(1,rc.right-rc.left);
    const UINT height=std::max<LONG>(1,rc.bottom-rc.top);
    if (SUCCEEDED(m_swapChain->ResizeBuffers(0,width,height,DXGI_FORMAT_UNKNOWN,0))) CreateRenderTarget();
}

bool SaeedDx11Renderer::LoadAvatar(const std::wstring& path) {
    if (!m_avatar.Initialize(m_device.Get(),m_context.Get())) return false;
    return m_avatar.LoadGlb(path);
}

void SaeedDx11Renderer::ClearAvatar() { m_avatar.ClearAvatar(); }

void SaeedDx11Renderer::Render() {
    if (!IsInitialized()||!m_renderTarget) return;
    RECT rc{}; GetClientRect(m_hwnd,&rc);
    const UINT width=std::max<LONG>(1,rc.right-rc.left);
    const UINT height=std::max<LONG>(1,rc.bottom-rc.top);

    constexpr float transparent[4]={0,0,0,0};
    m_context->OMSetRenderTargets(1,m_renderTarget.GetAddressOf(),nullptr);
    m_context->ClearRenderTargetView(m_renderTarget.Get(),transparent);

    m_avatar.Update(1.0f/60.0f);
    m_avatar.Render(m_renderTarget.Get(),width,height);
    m_swapChain->Present(1,0);
}
