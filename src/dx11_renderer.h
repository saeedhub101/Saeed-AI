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
    bool HasRig() const { return m_avatar.HasRig(); }
    bool HasAnimation() const { return m_avatar.HasAnimation(); }
    bool HasFacialMorphs() const { return m_avatar.HasFacialMorphs(); }
    bool HasBone(const std::string& key) const { return m_avatar.HasBone(key); }
    void SetFacialCommand(const std::string& action,double blink=0.0,double smile=0.0,double brow=0.0,const std::string& emotion="neutral") {
        m_avatar.SetFacialCommand(action,blink,smile,brow,emotion);
    }
    void SetBehaviorState(const std::string& state) { m_avatar.SetBehaviorState(state); }
    const std::string& BehaviorState() const { return m_avatar.BehaviorState(); }
    const std::wstring& LoadedPath() const { return m_avatar.LoadedPath(); }
    void ApplyCharacterCommand(const std::string& action, double x=0.0, double y=0.0, double z=0.0,
                               double left=0.0, double right=0.0, double leftForearm=0.0,
                               double rightForearm=0.0, double leftThigh=0.0, double rightThigh=0.0,
                               double leftShin=0.0, double rightShin=0.0, double leftFoot=0.0,
                               double rightFoot=0.0, double leftWrist=0.0, double rightWrist=0.0) {
        m_avatar.ApplyCharacterCommand(action,x,y,z,left,right,leftForearm,rightForearm,
                                       leftThigh,rightThigh,leftShin,rightShin,leftFoot,rightFoot,leftWrist,rightWrist);
    }
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
    Microsoft::WRL::ComPtr<ID3D11Texture2D> m_depthStencil;
    Microsoft::WRL::ComPtr<ID3D11DepthStencilView> m_depthStencilView;
    Microsoft::WRL::ComPtr<IDCompositionDevice> m_dcompDevice;
    Microsoft::WRL::ComPtr<IDCompositionTarget> m_dcompTarget;
    Microsoft::WRL::ComPtr<IDCompositionVisual> m_dcompVisual;
    bool m_useComposition = false;
    bool m_ciOffscreen = false;
    SaeedDx11AvatarRenderer m_avatar;
};
