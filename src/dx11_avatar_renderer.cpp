#define CGLTF_IMPLEMENTATION
#include <cgltf.h>
#include "dx11_avatar_renderer.h"
#include <d3dcompiler.h>
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <cmath>

#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "d3dcompiler.lib")

using namespace DirectX;
using Microsoft::WRL::ComPtr;

namespace {
static const char* kVs=R"(
cbuffer Scene:register(b0){matrix world;matrix view;matrix projection;float4 lightDirection;};
struct VSIn{float3 position:POSITION;float3 normal:NORMAL;float2 uv:TEXCOORD0;float4 color:COLOR0;};
struct VSOut{float4 position:SV_POSITION;float3 normal:NORMAL;float2 uv:TEXCOORD0;float4 color:COLOR0;};
VSOut main(VSIn i){VSOut o;float4 p=float4(i.position,1);o.position=mul(mul(mul(p,world),view),projection);o.normal=normalize(mul(float4(i.normal,0),world).xyz);o.uv=i.uv;o.color=i.color;return o;})";
static const char* kPs=R"(
struct PSIn{float4 position:SV_POSITION;float3 normal:NORMAL;float2 uv:TEXCOORD0;float4 color:COLOR0;};
float4 main(PSIn i):SV_TARGET{float3 n=normalize(i.normal);float3 l=normalize(float3(-.35,.75,-.55));float d=saturate(dot(n,l))*.72+.28;return float4(i.color.rgb*d,i.color.a);})";

bool CompileShader(const char* s,const char* e,const char* t,ID3DBlob** b){
 UINT f=D3DCOMPILE_ENABLE_STRICTNESS;
 ComPtr<ID3DBlob> er;
 return SUCCEEDED(D3DCompile(s,strlen(s),nullptr,nullptr,nullptr,e,t,f,0,b,er.GetAddressOf()));
}
XMFLOAT4 MaterialColor(const cgltf_material* m){
 if(!m||!m->has_pbr_metallic_roughness)return {0.78f,0.78f,0.82f,1};
 auto& f=m->pbr_metallic_roughness.base_color_factor;return {f[0],f[1],f[2],f[3]};
}
bool Read(const cgltf_accessor* a,size_t i,float* o,size_t n){return a&&cgltf_accessor_read_float(a,i,o,n)!=0;}
const cgltf_accessor* Attr(const cgltf_primitive& p,cgltf_attribute_type t,int idx=0){
 int found=0;for(cgltf_size i=0;i<p.attributes_count;i++){auto&a=p.attributes[i];if(a.type==t&&found++==idx)return a.data;}return nullptr;
}
XMMATRIX NodeLocal(const cgltf_node& n){
 if(n.has_matrix){XMFLOAT4X4 m{};std::memcpy(&m,n.matrix,sizeof(m));return XMMatrixTranspose(XMLoadFloat4x4(&m));}
 XMMATRIX s=XMMatrixScaling(n.has_scale?n.scale[0]:1,n.has_scale?n.scale[1]:1,n.has_scale?n.scale[2]:1);
 XMMATRIX r=XMMatrixIdentity();
 if(n.has_rotation)r=XMMatrixRotationQuaternion(XMVectorSet(n.rotation[0],n.rotation[1],n.rotation[2],n.rotation[3]));
 XMMATRIX t=XMMatrixTranslation(n.has_translation?n.translation[0]:0,n.has_translation?n.translation[1]:0,n.has_translation?n.translation[2]:0);
 return s*r*t;
}
}

SaeedDx11AvatarRenderer::~SaeedDx11AvatarRenderer(){Shutdown();}
bool SaeedDx11AvatarRenderer::Initialize(ID3D11Device* d,ID3D11DeviceContext* c){if(!d||!c)return false;m_device=d;m_context=c;return CreateShaders();}
void SaeedDx11AvatarRenderer::Shutdown(){ClearAvatar();m_constantBuffer.Reset();m_inputLayout.Reset();m_vertexShader.Reset();m_pixelShader.Reset();m_context.Reset();m_device.Reset();}
bool SaeedDx11AvatarRenderer::CreateShaders(){
 ComPtr<ID3DBlob> vs,ps;if(!CompileShader(kVs,"main","vs_5_0",vs.GetAddressOf())||!CompileShader(kPs,"main","ps_5_0",ps.GetAddressOf()))return false;
 if(FAILED(m_device->CreateVertexShader(vs->GetBufferPointer(),vs->GetBufferSize(),nullptr,m_vertexShader.GetAddressOf())))return false;
 if(FAILED(m_device->CreatePixelShader(ps->GetBufferPointer(),ps->GetBufferSize(),nullptr,m_pixelShader.GetAddressOf())))return false;
 const D3D11_INPUT_ELEMENT_DESC l[]={{"POSITION",0,DXGI_FORMAT_R32G32B32_FLOAT,0,0,D3D11_INPUT_PER_VERTEX_DATA,0},{"NORMAL",0,DXGI_FORMAT_R32G32B32_FLOAT,0,12,D3D11_INPUT_PER_VERTEX_DATA,0},{"TEXCOORD",0,DXGI_FORMAT_R32G32_FLOAT,0,24,D3D11_INPUT_PER_VERTEX_DATA,0},{"COLOR",0,DXGI_FORMAT_R32G32B32A32_FLOAT,0,32,D3D11_INPUT_PER_VERTEX_DATA,0}};
 if(FAILED(m_device->CreateInputLayout(l,4,vs->GetBufferPointer(),vs->GetBufferSize(),m_inputLayout.GetAddressOf())))return false;
 D3D11_BUFFER_DESC cb{};cb.ByteWidth=sizeof(ConstantBuffer);cb.Usage=D3D11_USAGE_DYNAMIC;cb.BindFlags=D3D11_BIND_CONSTANT_BUFFER;cb.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
 return SUCCEEDED(m_device->CreateBuffer(&cb,nullptr,m_constantBuffer.GetAddressOf()));
}
bool SaeedDx11AvatarRenderer::CreateBuffers(){
 if(m_vertices.empty()||m_indices.empty())return false;
 D3D11_BUFFER_DESC vb{};vb.ByteWidth=(UINT)(m_vertices.size()*sizeof(Vertex));vb.Usage=D3D11_USAGE_DYNAMIC;vb.BindFlags=D3D11_BIND_VERTEX_BUFFER;vb.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
 D3D11_SUBRESOURCE_DATA vd{};vd.pSysMem=m_vertices.data();if(FAILED(m_device->CreateBuffer(&vb,&vd,m_vertexBuffer.GetAddressOf())))return false;
 D3D11_BUFFER_DESC ib{};ib.ByteWidth=(UINT)(m_indices.size()*sizeof(uint32_t));ib.Usage=D3D11_USAGE_DEFAULT;ib.BindFlags=D3D11_BIND_INDEX_BUFFER;
 D3D11_SUBRESOURCE_DATA id{};id.pSysMem=m_indices.data();return SUCCEEDED(m_device->CreateBuffer(&ib,&id,m_indexBuffer.GetAddressOf()));
}
bool SaeedDx11AvatarRenderer::LoadGlb(const std::wstring& path){
 ClearAvatar();int n=WideCharToMultiByte(CP_UTF8,0,path.c_str(),-1,nullptr,0,nullptr,nullptr);if(n<=0)return false;
 std::string p((size_t)n,'\0');WideCharToMultiByte(CP_UTF8,0,path.c_str(),-1,p.data(),n,nullptr,nullptr);p.resize((size_t)n-1);
 cgltf_options o{};cgltf_data* d=nullptr;if(cgltf_parse_file(&o,p.c_str(),&d)!=cgltf_result_success||!d)return false;
 auto fail=[&](){cgltf_free(d);ClearAvatar();return false;};if(cgltf_load_buffers(&o,d,p.c_str())!=cgltf_result_success)return fail();

 // Build joint hierarchy from every skin in the GLB. The current Saeed model uses one
 // humanoid skin; using the first skin keeps the native renderer deterministic.
 if(d->skins_count){
   const cgltf_skin& s=d->skins[0];m_joints.resize((size_t)s.joints_count);
   for(cgltf_size i=0;i<s.joints_count;i++){
     const cgltf_node* node=s.joints[i];m_joints[i].local=NodeLocal(*node);
     m_joints[i].parent=-1;
     for(cgltf_size j=0;j<s.joints_count;j++)if(node->parent==s.joints[j]){m_joints[i].parent=(int)j;break;}
     if(s.inverse_bind_matrices){
       float a[16]{};cgltf_accessor_read_float(s.inverse_bind_matrices,i,a,16);
       XMFLOAT4X4 im{};std::memcpy(&im,a,sizeof(im));m_joints[i].inverseBind=XMMatrixTranspose(XMLoadFloat4x4(&im));
     }
   }
   m_jointWorld.resize(m_joints.size(),XMMatrixIdentity());
 }
 // Resolve the mesh node carrying the skin. If there is no skin, the mesh is still rendered normally.
 const cgltf_node* meshNode=nullptr;const cgltf_skin* skin=nullptr;
 for(cgltf_size ni=0;ni<d->nodes_count&&!meshNode;ni++)if(d->nodes[ni].mesh){
   meshNode=&d->nodes[ni];skin=meshNode->skin;break;
 }
 size_t meshIndex=meshNode&&meshNode->mesh? (size_t)(meshNode->mesh-d->meshes):0;
 size_t base=0;
 if(d->meshes_count){
   const cgltf_mesh& mesh=d->meshes[meshIndex];
   for(cgltf_size pi=0;pi<mesh.primitives_count;pi++){
    const auto& prim=mesh.primitives[pi];if(prim.type!=cgltf_primitive_type_triangles)continue;
    auto pos=Attr(prim,cgltf_attribute_type_position);if(!pos)continue;
    auto normal=Attr(prim,cgltf_attribute_type_normal);auto uv=Attr(prim,cgltf_attribute_type_texcoord,0);
    auto joints=Attr(prim,cgltf_attribute_type_joints,0);auto weights=Attr(prim,cgltf_attribute_type_weights,0);
    XMFLOAT4 color=MaterialColor(prim.material);size_t count=(size_t)pos->count;base=m_sourceVertices.size();m_sourceVertices.resize(base+count);m_vertices.resize(base+count);
    for(size_t i=0;i<count;i++){
      float pp[3]={},nn[3]={0,1,0},tt[2]={},jj[4]={},ww[4]={};
      Read(pos,i,pp,3);if(normal)Read(normal,i,nn,3);if(uv)Read(uv,i,tt,2);if(joints)Read(joints,i,jj,4);if(weights)Read(weights,i,ww,4);
      auto& sv=m_sourceVertices[base+i];sv.position={pp[0],pp[1],pp[2]};sv.normal={nn[0],nn[1],nn[2]};sv.uv={tt[0],tt[1]};sv.color=color;
      for(int k=0;k<4;k++)sv.joints[k]=(uint16_t)std::max(0.0f,jj[k]);sv.weights={ww[0],ww[1],ww[2],ww[3]};
      m_vertices[base+i]={sv.position,sv.normal,sv.uv,sv.color};
    }
    if(prim.indices){for(size_t i=0;i<(size_t)prim.indices->count;i++)m_indices.push_back((uint32_t)cgltf_accessor_read_index(prim.indices,i)+(uint32_t)base);}
    else for(size_t i=0;i+2<count;i+=3){m_indices.push_back((uint32_t)(base+i));m_indices.push_back((uint32_t)(base+i+1));m_indices.push_back((uint32_t)(base+i+2));}
   }
 }
 cgltf_free(d);if(m_sourceVertices.empty()||m_indices.empty()||!CreateBuffers()){ClearAvatar();return false;}
 m_loadedPath=path;m_loaded=true;return true;
}
void SaeedDx11AvatarRenderer::ClearAvatar(){m_vertexBuffer.Reset();m_indexBuffer.Reset();m_sourceVertices.clear();m_vertices.clear();m_indices.clear();m_joints.clear();m_jointWorld.clear();m_loaded=false;m_loadedPath.clear();m_time=0;}
void SaeedDx11AvatarRenderer::UpdateSkin(float t){
 if(m_joints.empty()){m_vertices=m_sourceVertices;return;}
 for(size_t i=0;i<m_joints.size();i++){int p=m_joints[i].parent;m_jointWorld[i]=m_joints[i].local*(p>=0?m_jointWorld[(size_t)p]:XMMatrixIdentity());}
 // Subtle native idle motion. This is intentionally additive and leaves the GLB's
 // authored standing pose intact while providing a real bone-driven breathing/idle cycle.
 float breathe=std::sin(t*2.0f)*0.012f;
 for(size_t i=0;i<m_sourceVertices.size();i++){
   const auto& s=m_sourceVertices[i];XMVECTOR p=XMLoadFloat3(&s.position),n=XMLoadFloat3(&s.normal);
   XMVECTOR outP=XMVectorZero(),outN=XMVectorZero();float sum=0;
   for(int k=0;k<4;k++){float w=((&s.weights.x)[k]);if(w<=0||s.joints[k]>=m_jointWorld.size())continue;XMMATRIX m=m_joints[s.joints[k]].inverseBind*m_jointWorld[s.joints[k]];outP+=XMVector3TransformCoord(p,m)*w;outN+=XMVector3TransformNormal(n,m)*w;sum+=w;}
   if(sum<0.001f){outP=p;outN=n;}else{outP/=sum;outN=XMVector3Normalize(outN/sum);}
   XMFLOAT3 fp,fn;XMStoreFloat3(&fp,outP);XMStoreFloat3(&fn,outN);
   m_vertices[i].position=fp;m_vertices[i].normal=fn;
   if(std::fabs(breathe)>0.0001f && i<m_vertices.size())m_vertices[i].position.y+=breathe*(1.0f-std::min(1.0f,std::fabs(fp.y)*0.02f));
 }
 if(m_vertexBuffer){D3D11_MAPPED_SUBRESOURCE map{};if(SUCCEEDED(m_context->Map(m_vertexBuffer.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&map))){std::memcpy(map.pData,m_vertices.data(),m_vertices.size()*sizeof(Vertex));m_context->Unmap(m_vertexBuffer.Get(),0);}}
}
void SaeedDx11AvatarRenderer::Update(float dt){if(!m_loaded)return;m_time+=std::max(0.0f,dt);UpdateSkin(m_time);}
void SaeedDx11AvatarRenderer::DrawMesh(){if(!m_vertexBuffer||!m_indexBuffer)return;UINT stride=sizeof(Vertex),off=0;ID3D11Buffer* vb=m_vertexBuffer.Get();m_context->IASetVertexBuffers(0,1,&vb,&stride,&off);m_context->IASetIndexBuffer(m_indexBuffer.Get(),DXGI_FORMAT_R32_UINT,0);m_context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);m_context->IASetInputLayout(m_inputLayout.Get());m_context->VSSetShader(m_vertexShader.Get(),nullptr,0);m_context->PSSetShader(m_pixelShader.Get(),nullptr,0);m_context->DrawIndexed((UINT)m_indices.size(),0,0);}
void SaeedDx11AvatarRenderer::Render(ID3D11RenderTargetView* target,UINT width,UINT height){
 if(!target||!width||!height||!m_loaded)return;float aspect=(float)width/(float)height;XMMATRIX world=XMMatrixIdentity();
 XMMATRIX view=XMMatrixLookAtLH(XMVectorSet(0,1,-3,1),XMVectorSet(0,1,0,1),XMVectorSet(0,1,0,0));XMMATRIX projection=XMMatrixPerspectiveFovLH(XMConvertToRadians(35),aspect,.01f,100);
 D3D11_MAPPED_SUBRESOURCE m{};if(SUCCEEDED(m_context->Map(m_constantBuffer.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&m))){auto* cb=(ConstantBuffer*)m.pData;cb->world=XMMatrixTranspose(world);cb->view=XMMatrixTranspose(view);cb->projection=XMMatrixTranspose(projection);cb->lightDirection={-.35f,.75f,-.55f,0};m_context->Unmap(m_constantBuffer.Get(),0);}
 m_context->VSSetConstantBuffers(0,1,m_constantBuffer.GetAddressOf());DrawMesh();
}
