#define CGLTF_IMPLEMENTATION
#include <cgltf.h>
#include "dx11_avatar_renderer.h"
#include <d3dcompiler.h>
#include <algorithm>
#include <cstdint>
#include <cstring>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "d3dcompiler.lib")

using namespace DirectX;
using Microsoft::WRL::ComPtr;

namespace {
static const char* kVs = R"(
cbuffer Scene : register(b0) {
    matrix world;
    matrix view;
    matrix projection;
    float4 lightDirection;
};
struct VSIn {
    float3 position : POSITION;
    float3 normal : NORMAL;
    float2 uv : TEXCOORD0;
    float4 color : COLOR0;
};
struct VSOut {
    float4 position : SV_POSITION;
    float3 normal : NORMAL;
    float2 uv : TEXCOORD0;
    float4 color : COLOR0;
};
VSOut main(VSIn i) {
    VSOut o;
    float4 p = float4(i.position, 1.0);
    o.position = mul(p, world);
    o.position = mul(o.position, view);
    o.position = mul(o.position, projection);
    o.normal = normalize(mul(float4(i.normal,0), world).xyz);
    o.uv = i.uv;
    o.color = i.color;
    return o;
})";

static const char* kPs = R"(
struct PSIn {
    float4 position : SV_POSITION;
    float3 normal : NORMAL;
    float2 uv : TEXCOORD0;
    float4 color : COLOR0;
};
float4 main(PSIn i) : SV_TARGET {
    float3 n = normalize(i.normal);
    float3 l = normalize(float3(-0.35, 0.75, -0.55));
    float diffuse = saturate(dot(n,l)) * 0.72 + 0.28;
    return float4(i.color.rgb * diffuse, i.color.a);
})";

bool CompileShader(const char* source, const char* entry, const char* target, ID3DBlob** blob) {
    UINT flags = D3DCOMPILE_ENABLE_STRICTNESS;
#if defined(_DEBUG)
    flags |= D3DCOMPILE_DEBUG | D3DCOMPILE_SKIP_OPTIMIZATION;
#endif
    ComPtr<ID3DBlob> errors;
    return SUCCEEDED(D3DCompile(source, strlen(source), nullptr, nullptr, nullptr,
                                 entry, target, flags, 0, blob, errors.GetAddressOf()));
}

XMFLOAT4 MaterialColor(const cgltf_material* material) {
    if (!material || material->has_pbr_metallic_roughness == 0) return {0.78f,0.78f,0.82f,1.0f};
    const auto& f = material->pbr_metallic_roughness.base_color_factor;
    return {f[0], f[1], f[2], f[3]};
}

bool ReadAttribute(const cgltf_accessor* accessor, size_t index, float* out, size_t count) {
    if (!accessor) return false;
    return cgltf_accessor_read_float(accessor, index, out, count) != 0;
}

const cgltf_accessor* FindAttribute(const cgltf_primitive& primitive, cgltf_attribute_type type, int index = 0) {
    int found = 0;
    for (cgltf_size i=0; i<primitive.attributes_count; ++i) {
        const auto& a = primitive.attributes[i];
        if (a.type == type && found++ == index) return a.data;
    }
    return nullptr;
}
}

SaeedDx11AvatarRenderer::~SaeedDx11AvatarRenderer() { Shutdown(); }

bool SaeedDx11AvatarRenderer::Initialize(ID3D11Device* device, ID3D11DeviceContext* context) {
    if (!device || !context) return false;
    m_device = device;
    m_context = context;
    return CreateShaders();
}

void SaeedDx11AvatarRenderer::Shutdown() {
    ClearAvatar();
    m_constantBuffer.Reset();
    m_inputLayout.Reset();
    m_vertexShader.Reset();
    m_pixelShader.Reset();
    m_context.Reset();
    m_device.Reset();
}

bool SaeedDx11AvatarRenderer::CreateShaders() {
    ComPtr<ID3DBlob> vs, ps;
    if (!CompileShader(kVs,"main","vs_5_0",vs.GetAddressOf())) return false;
    if (!CompileShader(kPs,"main","ps_5_0",ps.GetAddressOf())) return false;

    if (FAILED(m_device->CreateVertexShader(vs->GetBufferPointer(),vs->GetBufferSize(),nullptr,m_vertexShader.GetAddressOf()))) return false;
    if (FAILED(m_device->CreatePixelShader(ps->GetBufferPointer(),ps->GetBufferSize(),nullptr,m_pixelShader.GetAddressOf()))) return false;

    const D3D11_INPUT_ELEMENT_DESC layout[] = {
        {"POSITION",0,DXGI_FORMAT_R32G32B32_FLOAT,0,0,D3D11_INPUT_PER_VERTEX_DATA,0},
        {"NORMAL",0,DXGI_FORMAT_R32G32B32_FLOAT,0,12,D3D11_INPUT_PER_VERTEX_DATA,0},
        {"TEXCOORD",0,DXGI_FORMAT_R32G32_FLOAT,0,24,D3D11_INPUT_PER_VERTEX_DATA,0},
        {"COLOR",0,DXGI_FORMAT_R32G32B32A32_FLOAT,0,32,D3D11_INPUT_PER_VERTEX_DATA,0}
    };
    if (FAILED(m_device->CreateInputLayout(layout,ARRAYSIZE(layout),vs->GetBufferPointer(),vs->GetBufferSize(),m_inputLayout.GetAddressOf()))) return false;

    D3D11_BUFFER_DESC cb{};
    cb.ByteWidth=sizeof(ConstantBuffer);
    cb.Usage=D3D11_USAGE_DYNAMIC;
    cb.BindFlags=D3D11_BIND_CONSTANT_BUFFER;
    cb.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
    return SUCCEEDED(m_device->CreateBuffer(&cb,nullptr,m_constantBuffer.GetAddressOf()));
}

bool SaeedDx11AvatarRenderer::CreateGeometryFromGlb() {
    return !m_vertices.empty() && !m_indices.empty();
}

bool SaeedDx11AvatarRenderer::CreateBuffers() {
    if (m_vertices.empty() || m_indices.empty()) return false;

    D3D11_BUFFER_DESC vb{};
    vb.ByteWidth=static_cast<UINT>(m_vertices.size()*sizeof(Vertex));
    vb.Usage=D3D11_USAGE_DEFAULT;
    vb.BindFlags=D3D11_BIND_VERTEX_BUFFER;
    D3D11_SUBRESOURCE_DATA vd{};
    vd.pSysMem=m_vertices.data();
    if (FAILED(m_device->CreateBuffer(&vb,&vd,m_vertexBuffer.GetAddressOf()))) return false;

    D3D11_BUFFER_DESC ib{};
    ib.ByteWidth=static_cast<UINT>(m_indices.size()*sizeof(uint32_t));
    ib.Usage=D3D11_USAGE_DEFAULT;
    ib.BindFlags=D3D11_BIND_INDEX_BUFFER;
    D3D11_SUBRESOURCE_DATA id{};
    id.pSysMem=m_indices.data();
    return SUCCEEDED(m_device->CreateBuffer(&ib,&id,m_indexBuffer.GetAddressOf()));
}

bool SaeedDx11AvatarRenderer::LoadGlb(const std::wstring& path) {
    ClearAvatar();

    int utf8Len=WideCharToMultiByte(CP_UTF8,0,path.c_str(),-1,nullptr,0,nullptr,nullptr);
    if(utf8Len<=0) return false;
        std::string utf8Path(static_cast<size_t>(utf8Len),'\0');
    WideCharToMultiByte(CP_UTF8,0,path.c_str(),-1,utf8Path.data(),utf8Len,nullptr,nullptr);
    utf8Path.resize(static_cast<size_t>(utf8Len-1));

    cgltf_options options{};
    cgltf_data* data=nullptr;
    if (cgltf_parse_file(&options,utf8Path.c_str(),&data) != cgltf_result_success || !data) return false;
    const auto cleanup=[&](){ cgltf_free(data); };

    if (cgltf_load_buffers(&options,data,utf8Path.c_str()) != cgltf_result_success) {
        cleanup(); return false;
    }

    size_t vertexBase=0;
    for (cgltf_size mi=0; mi<data->meshes_count; ++mi) {
        const cgltf_mesh& mesh=data->meshes[mi];
        for (cgltf_size pi=0; pi<mesh.primitives_count; ++pi) {
            const cgltf_primitive& primitive=mesh.primitives[pi];
            if (primitive.type != cgltf_primitive_type_triangles) continue;

            const cgltf_accessor* pos=FindAttribute(primitive,cgltf_attribute_type_position);
            if (!pos) continue;
            const cgltf_accessor* normal=FindAttribute(primitive,cgltf_attribute_type_normal);
            const cgltf_accessor* uv=FindAttribute(primitive,cgltf_attribute_type_texcoord,0);
            XMFLOAT4 color=MaterialColor(primitive.material);

            const size_t count=static_cast<size_t>(pos->count);
            const size_t base=m_vertices.size();
            m_vertices.resize(base+count);

            for (size_t i=0;i<count;++i) {
                float p[3]={0,0,0}, n[3]={0,1,0}, t[2]={0,0};
                ReadAttribute(pos,i,p,3);
                if (normal) ReadAttribute(normal,i,n,3);
                if (uv) ReadAttribute(uv,i,t,2);
                m_vertices[base+i].position={p[0],p[1],p[2]};
                m_vertices[base+i].normal={n[0],n[1],n[2]};
                m_vertices[base+i].uv={t[0],t[1]};
                m_vertices[base+i].color=color;
            }

            if (primitive.indices) {
                const size_t icount=static_cast<size_t>(primitive.indices->count);
                m_indices.reserve(m_indices.size()+icount);
                for (size_t i=0;i<icount;++i)
                    m_indices.push_back(static_cast<uint32_t>(cgltf_accessor_read_index(primitive.indices,i))+static_cast<uint32_t>(base));
            } else {
                for (size_t i=0;i+2<count;i+=3) {
                    m_indices.push_back(static_cast<uint32_t>(base+i));
                    m_indices.push_back(static_cast<uint32_t>(base+i+1));
                    m_indices.push_back(static_cast<uint32_t>(base+i+2));
                }
            }
        }
    }

    cleanup();
    if (!CreateGeometryFromGlb() || !CreateBuffers()) {
        ClearAvatar();
        return false;
    }

    m_loadedPath=path;
    m_loaded=true;
    return true;
}

void SaeedDx11AvatarRenderer::ClearAvatar() {
    m_vertexBuffer.Reset();
    m_indexBuffer.Reset();
    m_vertices.clear();
    m_indices.clear();
    m_loaded=false;
    m_loadedPath.clear();
}

void SaeedDx11AvatarRenderer::Update(float) {}

void SaeedDx11AvatarRenderer::DrawMesh() {
    if (!m_vertexBuffer || !m_indexBuffer) return;
    UINT stride=sizeof(Vertex),offset=0;
    ID3D11Buffer* vb=m_vertexBuffer.Get();
    m_context->IASetVertexBuffers(0,1,&vb,&stride,&offset);
    m_context->IASetIndexBuffer(m_indexBuffer.Get(),DXGI_FORMAT_R32_UINT,0);
    m_context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    m_context->IASetInputLayout(m_inputLayout.Get());
    m_context->VSSetShader(m_vertexShader.Get(),nullptr,0);
    m_context->PSSetShader(m_pixelShader.Get(),nullptr,0);
    m_context->DrawIndexed(static_cast<UINT>(m_indices.size()),0,0);
}

void SaeedDx11AvatarRenderer::Render(ID3D11RenderTargetView* target,UINT width,UINT height) {
    if (!target || width==0 || height==0 || !m_loaded) return;

    const float aspect=static_cast<float>(width)/static_cast<float>(height);
    XMMATRIX world=XMMatrixIdentity();
    XMMATRIX view=XMMatrixLookAtLH(XMVectorSet(0,1.0f,-3.0f,1),XMVectorSet(0,1.0f,0,1),XMVectorSet(0,1,0,0));
    XMMATRIX projection=XMMatrixPerspectiveFovLH(XMConvertToRadians(35.0f),aspect,0.01f,100.0f);

    D3D11_MAPPED_SUBRESOURCE mapped{};
    if (SUCCEEDED(m_context->Map(m_constantBuffer.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&mapped))) {
        auto* cb=static_cast<ConstantBuffer*>(mapped.pData);
        cb->world=XMMatrixTranspose(world);
        cb->view=XMMatrixTranspose(view);
        cb->projection=XMMatrixTranspose(projection);
        cb->lightDirection=XMFLOAT4(-0.35f,0.75f,-0.55f,0);
        m_context->Unmap(m_constantBuffer.Get(),0);
    }
    m_context->VSSetConstantBuffers(0,1,m_constantBuffer.GetAddressOf());
    DrawMesh();
}
