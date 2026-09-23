#pragma once
#include <windows.h>
#include <d3d11.h>
#include <DirectXMath.h>
#include <wrl.h>
#include <string>
#include <vector>
#include <array>
#include <cstdint>

class SaeedDx11AvatarRenderer {
public:
    SaeedDx11AvatarRenderer() = default;
    ~SaeedDx11AvatarRenderer();

    SaeedDx11AvatarRenderer(const SaeedDx11AvatarRenderer&) = delete;
    SaeedDx11AvatarRenderer& operator=(const SaeedDx11AvatarRenderer&) = delete;

    bool Initialize(ID3D11Device* device, ID3D11DeviceContext* context);
    void Shutdown();
    bool LoadGlb(const std::wstring& path);
    void ClearAvatar();
    void Update(float deltaSeconds);
    void Render(ID3D11RenderTargetView* target, UINT width, UINT height);

    bool HasAvatar() const { return m_loaded; }
    const std::wstring& LoadedPath() const { return m_loadedPath; }

private:
    struct SourceVertex {
        DirectX::XMFLOAT3 position{};
        DirectX::XMFLOAT3 normal{0,1,0};
        DirectX::XMFLOAT2 uv{};
        DirectX::XMFLOAT4 color{1,1,1,1};
        std::array<uint16_t,4> joints{};
        DirectX::XMFLOAT4 weights{0,0,0,0};
    };
    struct Vertex {
        DirectX::XMFLOAT3 position{};
        DirectX::XMFLOAT3 normal{0,1,0};
        DirectX::XMFLOAT2 uv{};
        DirectX::XMFLOAT4 color{1,1,1,1};
    };
    struct Joint {
        int parent=-1;
        DirectX::XMMATRIX local=DirectX::XMMatrixIdentity();
        DirectX::XMMATRIX inverseBind=DirectX::XMMatrixIdentity();
    };
    struct ConstantBuffer {
        DirectX::XMMATRIX world;
        DirectX::XMMATRIX view;
        DirectX::XMMATRIX projection;
        DirectX::XMFLOAT4 lightDirection;
    };

    bool CreateShaders();
    bool CreateBuffers();
    void UpdateSkin(float timeSeconds);
    void DrawMesh();

    Microsoft::WRL::ComPtr<ID3D11Device> m_device;
    Microsoft::WRL::ComPtr<ID3D11DeviceContext> m_context;
    Microsoft::WRL::ComPtr<ID3D11VertexShader> m_vertexShader;
    Microsoft::WRL::ComPtr<ID3D11PixelShader> m_pixelShader;
    Microsoft::WRL::ComPtr<ID3D11InputLayout> m_inputLayout;
    Microsoft::WRL::ComPtr<ID3D11Buffer> m_vertexBuffer;
    Microsoft::WRL::ComPtr<ID3D11Buffer> m_indexBuffer;
    Microsoft::WRL::ComPtr<ID3D11Buffer> m_constantBuffer;

    std::vector<SourceVertex> m_sourceVertices;
    std::vector<Vertex> m_vertices;
    std::vector<uint32_t> m_indices;
    std::vector<Joint> m_joints;
    std::vector<DirectX::XMMATRIX> m_jointWorld;
    int m_rootJoint=-1;
    float m_time=0.0f;
    std::wstring m_loadedPath;
    bool m_loaded=false;
};
