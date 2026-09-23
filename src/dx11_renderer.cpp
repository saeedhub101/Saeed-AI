#include "dx11_renderer.h"
#include <algorithm>
#include <dxgi1_2.h>
#include <dcomp.h>
#include <cstdio>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")
#pragma comment(lib, "dcomp.lib")

SaeedDx11Renderer::~SaeedDx11Renderer() { Shutdown(); }

bool SaeedDx11Renderer::Initialize(HWND hwnd) {
    if (!hwnd) return false;
    m_hwnd = hwnd;
    if (!CreateDeviceAndSwapChain() || !CreateRenderTarget()) {
        Shutdown();
        return false;
    }
    if (!m_avatar.Initialize(m_device.Get(), m_context.Get())) {
        Shutdown();
        return false;
    }
    return true;
}

void SaeedDx11Renderer::Shutdown() {
    m_avatar.Shutdown();
    if (m_context) m_context->ClearState();
    if (m_dcompDevice) m_dcompDevice->Commit();
    m_dcompVisual.Reset();
    m_dcompTarget.Reset();
    m_dcompDevice.Reset();
    m_renderTarget.Reset();
    m_useComposition = false;
    m_swapChain.Reset();
    m_context.Reset();
    m_device.Reset();
    m_hwnd = nullptr;
}

bool SaeedDx11Renderer::CreateDeviceAndSwapChain() {
    RECT rc{};
    if (!GetClientRect(m_hwnd, &rc)) return false;
    const UINT width = std::max<LONG>(1, rc.right - rc.left);
    const UINT height = std::max<LONG>(1, rc.bottom - rc.top);

    constexpr D3D_FEATURE_LEVEL levels[] = {
        D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_10_1,
        D3D_FEATURE_LEVEL_10_0, D3D_FEATURE_LEVEL_9_3
    };
    D3D_FEATURE_LEVEL selected{};
    const UINT flags = D3D11_CREATE_DEVICE_BGRA_SUPPORT;

    HRESULT hr = D3D11CreateDevice(
        nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, flags,
        levels, ARRAYSIZE(levels), D3D11_SDK_VERSION,
        m_device.GetAddressOf(), &selected, m_context.GetAddressOf());

    if (FAILED(hr)) {
        m_device.Reset();
        m_context.Reset();
        hr = D3D11CreateDevice(
            nullptr, D3D_DRIVER_TYPE_WARP, nullptr, flags,
            levels, ARRAYSIZE(levels), D3D11_SDK_VERSION,
            m_device.GetAddressOf(), &selected, m_context.GetAddressOf());
    }

    if (FAILED(hr)) {
        char msg[192]{};
        std::snprintf(msg, sizeof(msg),
            "D3D11CreateDevice failed: HRESULT=0x%08lX\\n",
            static_cast<unsigned long>(hr));
        OutputDebugStringA(msg);
        return false;
    }

    Microsoft::WRL::ComPtr<IDXGIDevice> dxgiDevice;
    Microsoft::WRL::ComPtr<IDXGIAdapter> adapter;
    Microsoft::WRL::ComPtr<IDXGIFactory2> factory;

    HRESULT h1 = m_device.As(&dxgiDevice);
    HRESULT h2 = h1 == S_OK ? dxgiDevice->GetAdapter(adapter.GetAddressOf()) : h1;
    HRESULT h3 = h2 == S_OK ? adapter->GetParent(IID_PPV_ARGS(factory.GetAddressOf())) : h2;
    if (FAILED(h3)) {
        char msg[192]{};
        std::snprintf(msg, sizeof(msg),
            "DXGI factory creation failed: HRESULT=0x%08lX\\n",
            static_cast<unsigned long>(h3));
        OutputDebugStringA(msg);
        return false;
    }

    // Use the standard HWND swap chain first. It is the least fragile Win32 path
    // and does not depend on DirectComposition being available in the session.
    DXGI_SWAP_CHAIN_DESC1 desc{};
    desc.Width = width;
    desc.Height = height;
    desc.Format = DXGI_FORMAT_B8G8R8A8_UNORM;
    desc.BufferCount = 2;
    desc.BufferUsage = DXGI_USAGE_RENDER_TARGET_OUTPUT;
    desc.SampleDesc.Count = 1;
    desc.SwapEffect = DXGI_SWAP_EFFECT_FLIP_DISCARD;
    desc.Scaling = DXGI_SCALING_STRETCH;
    desc.AlphaMode = DXGI_ALPHA_MODE_IGNORE;

    HRESULT swapHr = factory->CreateSwapChainForHwnd(
        m_device.Get(), m_hwnd, &desc, nullptr, nullptr,
        m_swapChain.GetAddressOf());

    // Older/remote Windows configurations may reject flip-discard. Fall back
    // to the traditional discard model before declaring renderer startup dead.
    if (FAILED(swapHr)) {
        desc.BufferCount = 1;
        desc.SwapEffect = DXGI_SWAP_EFFECT_DISCARD;
        swapHr = factory->CreateSwapChainForHwnd(
            m_device.Get(), m_hwnd, &desc, nullptr, nullptr,
            m_swapChain.GetAddressOf());
    }

    if (FAILED(swapHr)) {
        char msg[256]{};
        std::snprintf(msg, sizeof(msg),
            "CreateSwapChainForHwnd failed: HRESULT=0x%08lX\\n",
            static_cast<unsigned long>(swapHr));
        OutputDebugStringA(msg);
        return false;
    }

    m_useComposition = false;
    OutputDebugStringA("Saeed: native HWND DirectX renderer active.\\n");
    return true;
}

bool SaeedDx11Renderer::CreateCompositionTarget() {
    if (!m_swapChain || !m_hwnd || !m_useComposition) return false;

    Microsoft::WRL::ComPtr<IDXGIDevice> dxgiDevice;
    if (FAILED(m_device.As(&dxgiDevice))) return false;

    HRESULT hr = DCompositionCreateDevice(
        dxgiDevice.Get(), IID_PPV_ARGS(m_dcompDevice.GetAddressOf()));
    if (FAILED(hr)) return false;

    hr = m_dcompDevice->CreateTargetForHwnd(m_hwnd, TRUE, m_dcompTarget.GetAddressOf());
    if (FAILED(hr)) return false;

    hr = m_dcompDevice->CreateVisual(m_dcompVisual.GetAddressOf());
    if (FAILED(hr)) return false;

    hr = m_dcompVisual->SetContent(m_swapChain.Get());
    if (FAILED(hr)) return false;

    hr = m_dcompTarget->SetRoot(m_dcompVisual.Get());
    if (FAILED(hr)) return false;

    return SUCCEEDED(m_dcompDevice->Commit());
}

bool SaeedDx11Renderer::CreateRenderTarget() {
    if (!m_swapChain || !m_device) return false;
    Microsoft::WRL::ComPtr<ID3D11Texture2D> backBuffer;
    HRESULT hr = m_swapChain->GetBuffer(0, IID_PPV_ARGS(backBuffer.GetAddressOf()));
    if (FAILED(hr)) return false;
    return SUCCEEDED(m_device->CreateRenderTargetView(
        backBuffer.Get(), nullptr, m_renderTarget.GetAddressOf()));
}

void SaeedDx11Renderer::Resize() {
    if (!m_swapChain) return;
    m_context->OMSetRenderTargets(0, nullptr, nullptr);
    m_renderTarget.Reset();

    RECT rc{};
    if (!GetClientRect(m_hwnd, &rc)) return;
    const UINT width = std::max<LONG>(1, rc.right - rc.left);
    const UINT height = std::max<LONG>(1, rc.bottom - rc.top);

    if (SUCCEEDED(m_swapChain->ResizeBuffers(
            0, width, height, DXGI_FORMAT_UNKNOWN, 0))) {
        if(!CreateRenderTarget())
            OutputDebugStringA("Saeed: failed to recreate DirectX render target after resize.\\n");
    }
}

bool SaeedDx11Renderer::LoadAvatar(const std::wstring& path) {
    if (!m_device || !m_context) return false;
    return m_avatar.LoadGlb(path);
}

void SaeedDx11Renderer::ClearAvatar() {
    m_avatar.ClearAvatar();
}

void SaeedDx11Renderer::Render() {
    if (!IsInitialized() || !m_renderTarget) return;

    RECT rc{};
    GetClientRect(m_hwnd, &rc);
    const UINT width = std::max<LONG>(1, rc.right - rc.left);
    const UINT height = std::max<LONG>(1, rc.bottom - rc.top);

    const float background[4] = {0, 0, 0, m_useComposition ? 0.0f : 1.0f};
    m_context->OMSetRenderTargets(1, m_renderTarget.GetAddressOf(), nullptr);
    m_context->ClearRenderTargetView(m_renderTarget.Get(), background);

    m_avatar.Update(1.0f / 60.0f);
    m_avatar.Render(m_renderTarget.Get(), width, height);
    m_swapChain->Present(1, 0);
}
