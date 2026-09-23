#pragma once
#include <windows.h>
#include <d3d11.h>
#include <DirectXMath.h>
#include <wrl.h>
#include <string>
#include <vector>
#include <array>
#include <cstdint>
#include <unordered_map>

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
    bool HasRig() const { return m_hasRig; }
    bool HasAnimation() const { return m_hasAnimation; }
    bool HasFacialMorphs() const { return m_hasFacialMorphs; }
    bool HasMorphTargets() const { return m_hasFacialMorphs; }
    const std::wstring& LoadedPath() const { return m_loadedPath; }

    void ApplyCharacterCommand(const std::string& action, double x=0.0, double y=0.0, double z=0.0,
                               double left=0.0, double right=0.0, double leftForearm=0.0,
                               double rightForearm=0.0, double leftThigh=0.0, double rightThigh=0.0,
                               double leftShin=0.0, double rightShin=0.0, double leftFoot=0.0,
                               double rightFoot=0.0);

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
        int nodeIndex=-1;
        std::string name;
        DirectX::XMMATRIX bindLocal=DirectX::XMMatrixIdentity();
        DirectX::XMMATRIX local=DirectX::XMMatrixIdentity();
        DirectX::XMMATRIX inverseBind=DirectX::XMMatrixIdentity();
        DirectX::XMFLOAT3 baseTranslation{0,0,0};
        DirectX::XMFLOAT4 baseRotation{0,0,0,1};
        DirectX::XMFLOAT3 baseScale{1,1,1};
        DirectX::XMFLOAT3 restTranslation{0,0,0};
        DirectX::XMFLOAT4 restRotation{0,0,0,1};
        DirectX::XMFLOAT3 restScale{1,1,1};
    };
    enum class AnimPath { Translation, Rotation, Scale };
    struct AnimationChannel {
        int nodeIndex=-1;
        AnimPath path=AnimPath::Translation;
        std::vector<float> input;
        std::vector<float> output;
        size_t components=3;
        bool step=false;
    };
    struct ConstantBuffer {
        DirectX::XMMATRIX world;
        DirectX::XMMATRIX view;
        DirectX::XMMATRIX projection;
        DirectX::XMFLOAT4 lightDirection;
    };

    bool CreateShaders();
    bool CreateBuffers();
    void UpdateAnimation(float timeSeconds);
    void UpdateSkin(float timeSeconds);
    void DrawMesh();
    void ResetOptionalMotion();
    int FindJoint(const std::string& key) const;
    void RecalculateBounds();
    void UploadVertices();

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
    std::vector<AnimationChannel> m_animation;
    std::unordered_map<std::string,int> m_jointLookup;

    DirectX::XMFLOAT3 m_boundsMin{0,0,0};
    DirectX::XMFLOAT3 m_boundsMax{0,1,0};
    DirectX::XMFLOAT3 m_boundsCenter{0,0.5f,0};
    float m_boundsRadius=1.0f;

    int m_rootJoint=-1;
    float m_time=0.0f;
    float m_animationDuration=0.0f;
    std::wstring m_loadedPath;
    bool m_loaded=false;
    bool m_hasRig=false;
    bool m_hasAnimation=false;
    bool m_hasFacialMorphs=false;
    bool m_walking=false;

    float m_eyeX=0.0f,m_eyeZ=0.0f;
    float m_headX=0.0f,m_headY=0.0f,m_headZ=0.0f;
    float m_neckX=0.0f,m_neckY=0.0f,m_neckZ=0.0f;
    float m_spineX=0.0f,m_spineY=0.0f,m_spineZ=0.0f;
    float m_leftShoulder=0.0f,m_rightShoulder=0.0f;
    float m_leftArm=0.0f,m_rightArm=0.0f,m_leftForearm=0.0f,m_rightForearm=0.0f;
    float m_leftThigh=0.0f,m_rightThigh=0.0f,m_leftShin=0.0f,m_rightShin=0.0f;
    float m_leftFoot=0.0f,m_rightFoot=0.0f;
};