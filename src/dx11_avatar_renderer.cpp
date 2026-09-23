#define CGLTF_IMPLEMENTATION
#include <cgltf.h>
#include "dx11_avatar_renderer.h"
#include <d3dcompiler.h>
#include <algorithm>
#include <cstdint>
#include <cstring>
#include <cmath>
#include <limits>
#include <cctype>

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

bool CompileShader(const char* source,const char* entry,const char* target,ID3DBlob** blob){
    UINT flags=D3DCOMPILE_ENABLE_STRICTNESS;
    ComPtr<ID3DBlob> errors;
    return SUCCEEDED(D3DCompile(source,strlen(source),nullptr,nullptr,nullptr,entry,target,flags,0,blob,errors.GetAddressOf()));
}
XMFLOAT4 MaterialColor(const cgltf_material* m){
    if(!m||!m->has_pbr_metallic_roughness)return {0.78f,0.78f,0.82f,1};
    const auto& f=m->pbr_metallic_roughness.base_color_factor;
    return {f[0],f[1],f[2],f[3]};
}
bool ReadFloats(const cgltf_accessor* a,size_t i,float* out,size_t n){
    return a && cgltf_accessor_read_float(a,i,out,n)!=0;
}
const cgltf_accessor* Attr(const cgltf_primitive& p,cgltf_attribute_type t,int index=0){
    int found=0;
    for(cgltf_size i=0;i<p.attributes_count;i++){
        const auto& a=p.attributes[i];
        if(a.type==t && found++==index)return a.data;
    }
    return nullptr;
}
const cgltf_accessor* MorphAttr(const cgltf_morph_target& target,cgltf_attribute_type t){
    for(cgltf_size i=0;i<target.attributes_count;i++)
        if(target.attributes[i].type==t)return target.attributes[i].data;
    return nullptr;
}
XMMATRIX NodeLocal(const cgltf_node& n){
    if(n.has_matrix){
        XMFLOAT4X4 m{};
        std::memcpy(&m,n.matrix,sizeof(m));
        return XMMatrixTranspose(XMLoadFloat4x4(&m));
    }
    const XMMATRIX s=XMMatrixScaling(n.has_scale?n.scale[0]:1.0f,n.has_scale?n.scale[1]:1.0f,n.has_scale?n.scale[2]:1.0f);
    const XMMATRIX r=n.has_rotation
        ? XMMatrixRotationQuaternion(XMVectorSet(n.rotation[0],n.rotation[1],n.rotation[2],n.rotation[3]))
        : XMMatrixIdentity();
    const XMMATRIX t=XMMatrixTranslation(n.has_translation?n.translation[0]:0.0f,n.has_translation?n.translation[1]:0.0f,n.has_translation?n.translation[2]:0.0f);
    return s*r*t;
}
std::string Lower(std::string s){
    std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return static_cast<char>(std::tolower(c));});
    return s;
}
bool NameContains(const std::string& value,const char* needle){
    return Lower(value).find(Lower(needle))!=std::string::npos;
}
}

SaeedDx11AvatarRenderer::~SaeedDx11AvatarRenderer(){Shutdown();}

bool SaeedDx11AvatarRenderer::Initialize(ID3D11Device* d,ID3D11DeviceContext* c){
    if(!d||!c)return false;
    m_device=d;
    m_context=c;
    return CreateShaders();
}

void SaeedDx11AvatarRenderer::Shutdown(){
    ClearAvatar();
    m_constantBuffer.Reset();
    m_inputLayout.Reset();
    m_vertexShader.Reset();
    m_pixelShader.Reset();
    m_context.Reset();
    m_device.Reset();
}

bool SaeedDx11AvatarRenderer::CreateShaders(){
    ComPtr<ID3DBlob> vs,ps;
    if(!CompileShader(kVs,"main","vs_5_0",vs.GetAddressOf())||
       !CompileShader(kPs,"main","ps_5_0",ps.GetAddressOf()))return false;
    if(FAILED(m_device->CreateVertexShader(vs->GetBufferPointer(),vs->GetBufferSize(),nullptr,m_vertexShader.GetAddressOf())))return false;
    if(FAILED(m_device->CreatePixelShader(ps->GetBufferPointer(),ps->GetBufferSize(),nullptr,m_pixelShader.GetAddressOf())))return false;
    const D3D11_INPUT_ELEMENT_DESC layout[]={
        {"POSITION",0,DXGI_FORMAT_R32G32B32_FLOAT,0,0,D3D11_INPUT_PER_VERTEX_DATA,0},
        {"NORMAL",0,DXGI_FORMAT_R32G32B32_FLOAT,0,12,D3D11_INPUT_PER_VERTEX_DATA,0},
        {"TEXCOORD",0,DXGI_FORMAT_R32G32_FLOAT,0,24,D3D11_INPUT_PER_VERTEX_DATA,0},
        {"COLOR",0,DXGI_FORMAT_R32G32B32A32_FLOAT,0,32,D3D11_INPUT_PER_VERTEX_DATA,0}};
    if(FAILED(m_device->CreateInputLayout(layout,4,vs->GetBufferPointer(),vs->GetBufferSize(),m_inputLayout.GetAddressOf())))return false;
    D3D11_BUFFER_DESC cb{};
    cb.ByteWidth=sizeof(ConstantBuffer);
    cb.Usage=D3D11_USAGE_DYNAMIC;
    cb.BindFlags=D3D11_BIND_CONSTANT_BUFFER;
    cb.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
    return SUCCEEDED(m_device->CreateBuffer(&cb,nullptr,m_constantBuffer.GetAddressOf()));
}

bool SaeedDx11AvatarRenderer::CreateBuffers(){
    if(m_vertices.empty()||m_indices.empty())return false;
    D3D11_BUFFER_DESC vb{};
    vb.ByteWidth=static_cast<UINT>(m_vertices.size()*sizeof(Vertex));
    vb.Usage=D3D11_USAGE_DYNAMIC;
    vb.BindFlags=D3D11_BIND_VERTEX_BUFFER;
    vb.CPUAccessFlags=D3D11_CPU_ACCESS_WRITE;
    D3D11_SUBRESOURCE_DATA vd{};
    vd.pSysMem=m_vertices.data();
    if(FAILED(m_device->CreateBuffer(&vb,&vd,m_vertexBuffer.GetAddressOf())))return false;

    D3D11_BUFFER_DESC ib{};
    ib.ByteWidth=static_cast<UINT>(m_indices.size()*sizeof(uint32_t));
    ib.Usage=D3D11_USAGE_DEFAULT;
    ib.BindFlags=D3D11_BIND_INDEX_BUFFER;
    D3D11_SUBRESOURCE_DATA id{};
    id.pSysMem=m_indices.data();
    return SUCCEEDED(m_device->CreateBuffer(&ib,&id,m_indexBuffer.GetAddressOf()));
}

void SaeedDx11AvatarRenderer::RecalculateBounds(){
    if(m_sourceVertices.empty()){
        m_boundsMin={0,0,0};m_boundsMax={0,1,0};m_boundsCenter={0,0.5f,0};m_boundsRadius=1.0f;
        return;
    }
    XMFLOAT3 mn{std::numeric_limits<float>::max(),std::numeric_limits<float>::max(),std::numeric_limits<float>::max()};
    XMFLOAT3 mx{std::numeric_limits<float>::lowest(),std::numeric_limits<float>::lowest(),std::numeric_limits<float>::lowest()};
    for(const auto& v:m_sourceVertices){
        mn.x=std::min(mn.x,v.position.x);mn.y=std::min(mn.y,v.position.y);mn.z=std::min(mn.z,v.position.z);
        mx.x=std::max(mx.x,v.position.x);mx.y=std::max(mx.y,v.position.y);mx.z=std::max(mx.z,v.position.z);
    }
    m_boundsMin=mn;m_boundsMax=mx;
    m_boundsCenter={(mn.x+mx.x)*0.5f,(mn.y+mx.y)*0.5f,(mn.z+mx.z)*0.5f};
    const XMFLOAT3 e{mx.x-mn.x,mx.y-mn.y,mx.z-mn.z};
    m_boundsRadius=std::max(0.001f,std::sqrt(e.x*e.x+e.y*e.y+e.z*e.z)*0.5f);
}

void SaeedDx11AvatarRenderer::ResetOptionalMotion(){
    m_eyeX=m_eyeZ=m_headX=m_headY=m_headZ=0;
    m_neckX=m_neckY=m_neckZ=m_spineX=m_spineY=m_spineZ=0;
    m_leftShoulder=m_rightShoulder=m_leftArm=m_rightArm=0;
    m_leftForearm=m_rightForearm=m_leftThigh=m_rightThigh=0;
    m_leftShin=m_rightShin=m_leftFoot=m_rightFoot=0;
    m_walking=false;
}

bool SaeedDx11AvatarRenderer::LoadGlb(const std::wstring& path){
    ClearAvatar();
    const int n=WideCharToMultiByte(CP_UTF8,0,path.c_str(),-1,nullptr,0,nullptr,nullptr);
    if(n<=0)return false;
    std::string p(static_cast<size_t>(n),'\0');
    WideCharToMultiByte(CP_UTF8,0,path.c_str(),-1,p.data(),n,nullptr,nullptr);
    p.resize(static_cast<size_t>(n-1));

    cgltf_options options{};
    cgltf_data* data=nullptr;
    if(cgltf_parse_file(&options,p.c_str(),&data)!=cgltf_result_success||!data)return false;
    if(cgltf_load_buffers(&options,data,p.c_str())!=cgltf_result_success){
        cgltf_free(data);return false;
    }

    // A character may be a simple static mesh. Rig, animation and facial morphs
    // are optional capabilities; absence never makes a valid mesh unusable.
    m_hasFacialMorphs=false;
    for(cgltf_size mi=0;mi<data->meshes_count;mi++){
        for(cgltf_size pi=0;pi<data->meshes[mi].primitives_count;pi++){
            const auto& prim=data->meshes[mi].primitives[pi];
            if(prim.targets_count>0)m_hasFacialMorphs=true;
        }
    }

    if(data->skins_count>0){
        const cgltf_skin& skin=data->skins[0];
        m_hasRig=skin.joints_count>0;
        m_joints.resize(static_cast<size_t>(skin.joints_count));
        for(cgltf_size i=0;i<skin.joints_count;i++){
            const cgltf_node* node=skin.joints[i];
            Joint& joint=m_joints[static_cast<size_t>(i)];
            joint.nodeIndex=node?static_cast<int>(node-data->nodes):-1;
            joint.name=node&&node->name?node->name:"";
            joint.bindLocal=node?NodeLocal(*node):XMMatrixIdentity();
            joint.local=joint.bindLocal;
            joint.parent=-1;
            if(node){
                for(cgltf_size j=0;j<skin.joints_count;j++){
                    if(node->parent==skin.joints[j]){joint.parent=static_cast<int>(j);break;}
                }
                joint.baseTranslation={node->has_translation?node->translation[0]:0.0f,node->has_translation?node->translation[1]:0.0f,node->has_translation?node->translation[2]:0.0f};
                joint.baseScale={node->has_scale?node->scale[0]:1.0f,node->has_scale?node->scale[1]:1.0f,node->has_scale?node->scale[2]:1.0f};
                joint.baseRotation={node->has_rotation?node->rotation[0]:0.0f,node->has_rotation?node->rotation[1]:0.0f,node->has_rotation?node->rotation[2]:0.0f,node->has_rotation?node->rotation[3]:1.0f};
                joint.restTranslation=joint.baseTranslation;
                joint.restScale=joint.baseScale;
                joint.restRotation=joint.baseRotation;
            }
            if(skin.inverse_bind_matrices){
                float a[16]{};
                if(cgltf_accessor_read_float(skin.inverse_bind_matrices,i,a,16)){
                    XMFLOAT4X4 im{};
                    std::memcpy(&im,a,sizeof(im));
                    joint.inverseBind=XMMatrixTranspose(XMLoadFloat4x4(&im));
                }
            }
            if(!joint.name.empty())m_jointLookup[Lower(joint.name)]=static_cast<int>(i);
        }
        m_jointWorld.resize(m_joints.size(),XMMatrixIdentity());
    }

    // Import all mesh nodes that can be rendered. If a file contains no skin,
    // it remains a perfectly valid static avatar.
    size_t base=0;
    for(cgltf_size ni=0;ni<data->nodes_count;ni++){
        const cgltf_node* node=&data->nodes[ni];
        if(!node->mesh)continue;
        const cgltf_mesh& mesh=*node->mesh;
        for(cgltf_size pi=0;pi<mesh.primitives_count;pi++){
            const auto& prim=mesh.primitives[pi];
            if(prim.type!=cgltf_primitive_type_triangles)continue;
            const cgltf_accessor* pos=Attr(prim,cgltf_attribute_type_position);
            if(!pos)continue;
            const cgltf_accessor* normal=Attr(prim,cgltf_attribute_type_normal);
            const cgltf_accessor* uv=Attr(prim,cgltf_attribute_type_texcoord,0);
            const cgltf_accessor* joints=Attr(prim,cgltf_attribute_type_joints,0);
            const cgltf_accessor* weights=Attr(prim,cgltf_attribute_type_weights,0);
            const XMFLOAT4 color=MaterialColor(prim.material);

            // Morph target storage is kept CPU-side because this native renderer
            // performs skinning on the CPU. This also lets facial morphs work for
            // both rigged and unrigged characters without requiring a second renderer.
            const size_t targetCount=static_cast<size_t>(prim.targets_count);
            if(targetCount>0){
                for(auto& mt:m_morphTargets){
                    mt.positionDelta.resize(m_sourceVertices.size()+static_cast<size_t>(pos->count));
                    mt.normalDelta.resize(m_sourceVertices.size()+static_cast<size_t>(pos->count));
                }
                for(size_t ti=0;ti<targetCount;ti++){
                    std::string name;
                    if(mesh.target_names&&ti<mesh.target_names_count&&mesh.target_names[ti])
                        name=mesh.target_names[ti];
                    if(name.empty())name="morph_"+std::to_string(ti);
                    int mi=FindMorph(name);
                    if(mi<0){
                        MorphTarget mt; mt.name=name;
                        mt.positionDelta.resize(m_sourceVertices.size()+static_cast<size_t>(pos->count));
                        mt.normalDelta.resize(m_sourceVertices.size()+static_cast<size_t>(pos->count));
                        m_morphTargets.push_back(std::move(mt));
                        mi=static_cast<int>(m_morphTargets.size()-1);
                    }
                }
            }
            const size_t count=static_cast<size_t>(pos->count);
            base=m_sourceVertices.size();
            m_sourceVertices.resize(base+count);
            m_vertices.resize(base+count);
            for(size_t i=0;i<count;i++){
                float pp[3]{},nn[3]{0,1,0},tt[2]{},jj[4]{},ww[4]{};
                ReadFloats(pos,i,pp,3);
                if(normal)ReadFloats(normal,i,nn,3);
                if(uv)ReadFloats(uv,i,tt,2);
                if(joints)ReadFloats(joints,i,jj,4);
                if(weights)ReadFloats(weights,i,ww,4);
                SourceVertex& sv=m_sourceVertices[base+i];
                sv.position={pp[0],pp[1],pp[2]};
                sv.normal={nn[0],nn[1],nn[2]};
                sv.uv={tt[0],tt[1]};
                sv.color=color;
                for(int k=0;k<4;k++)sv.joints[k]=static_cast<uint16_t>(std::max(0.0f,jj[k]));
                sv.weights={ww[0],ww[1],ww[2],ww[3]};
                m_vertices[base+i]={sv.position,sv.normal,sv.uv,sv.color};
            }
            for(size_t ti=0;ti<targetCount;ti++){
                std::string name;
                if(mesh.target_names&&ti<mesh.target_names_count&&mesh.target_names[ti])
                    name=mesh.target_names[ti];
                if(name.empty())name="morph_"+std::to_string(ti);
                const int mi=FindMorph(name);
                if(mi<0)continue;
                const cgltf_accessor* mp=MorphAttr(prim.targets[ti],cgltf_attribute_type_position);
                const cgltf_accessor* mn=MorphAttr(prim.targets[ti],cgltf_attribute_type_normal);
                if(mp){
                    float v[3]{};
                    if(cgltf_accessor_read_float(mp,i,v,3))
                        m_morphTargets[static_cast<size_t>(mi)].positionDelta[base+i]={v[0],v[1],v[2]};
                }
                if(mn){
                    float v[3]{};
                    if(cgltf_accessor_read_float(mn,i,v,3))
                        m_morphTargets[static_cast<size_t>(mi)].normalDelta[base+i]={v[0],v[1],v[2]};
                }
            }
            if(prim.indices){
                for(size_t i=0;i<static_cast<size_t>(prim.indices->count);i++)
                    m_indices.push_back(static_cast<uint32_t>(cgltf_accessor_read_index(prim.indices,i)+base));
            }else{
                for(size_t i=0;i+2<count;i+=3){
                    m_indices.push_back(static_cast<uint32_t>(base+i));
                    m_indices.push_back(static_cast<uint32_t>(base+i+1));
                    m_indices.push_back(static_cast<uint32_t>(base+i+2));
                }
            }
        }
    }

    // Import the first usable glTF animation. If no animation exists, the mesh
    // remains static; this is intentional for user-supplied characters.
    if(data->animations_count>0 && m_hasRig){
        const cgltf_animation& anim=data->animations[0];
        for(cgltf_size si=0;si<anim.samplers_count;si++){
            const cgltf_animation_sampler& s=anim.samplers[si];
            if(!s.input||!s.output)continue;
            AnimationChannel channel;
            channel.input.resize(static_cast<size_t>(s.input->count));
            for(size_t i=0;i<channel.input.size();i++)cgltf_accessor_read_float(s.input,i,&channel.input[i],1);
            channel.step=s.interpolation==cgltf_interpolation_type_step;
            const size_t components=cgltf_num_components(s.output->type);
            if(components!=3&&components!=4)continue;
            channel.components=components;
            channel.output.resize(static_cast<size_t>(s.output->count)*components);
            for(size_t i=0;i<static_cast<size_t>(s.output->count);i++){
                float values[4]{};
                cgltf_accessor_read_float(s.output,i,values,components);
                std::copy(values,values+components,channel.output.begin()+i*components);
            }
            // Channels are attached below from animation.channels.
            for(cgltf_size ci=0;ci<anim.channels_count;ci++){
                const auto& src=anim.channels[ci];
                if(src.sampler!=&s||!src.target_node)continue;
                channel.nodeIndex=static_cast<int>(src.target_node-data->nodes);
                if(src.target_path==cgltf_animation_path_type_translation)channel.path=AnimPath::Translation;
                else if(src.target_path==cgltf_animation_path_type_rotation)channel.path=AnimPath::Rotation;
                else if(src.target_path==cgltf_animation_path_type_scale)channel.path=AnimPath::Scale;
                else continue;
                m_animation.push_back(channel);
                if(!channel.input.empty())m_animationDuration=std::max(m_animationDuration,channel.input.back());
            }
        }
    }
    m_hasAnimation=!m_animation.empty()&&m_animationDuration>0.0f;

    cgltf_free(data);
    if(m_sourceVertices.empty()||m_indices.empty()){
        ClearAvatar();
        return false;
    }
    RecalculateBounds();
    if(!CreateBuffers()){
        ClearAvatar();
        return false;
    }
    m_loadedPath=path;
    m_loaded=true;
    ResetOptionalMotion();
    return true;
}

void SaeedDx11AvatarRenderer::ClearAvatar(){
    m_vertexBuffer.Reset();
    m_indexBuffer.Reset();
    m_sourceVertices.clear();
    m_vertices.clear();
    m_indices.clear();
    m_joints.clear();
    m_jointWorld.clear();
    m_animation.clear();
    m_morphTargets.clear();
    m_jointLookup.clear();
    m_loaded=false;
    m_hasRig=false;
    m_hasAnimation=false;
    m_hasFacialMorphs=false;
    m_animationDuration=0.0f;
    m_loadedPath.clear();
    m_time=0.0f;
    m_boundsRadius=1.0f;
    ResetOptionalMotion();
}

int SaeedDx11AvatarRenderer::FindJoint(const std::string& key) const{
    const std::string wanted=Lower(key);
    for(const auto& kv:m_jointLookup){
        if(kv.first==wanted||kv.first.find(wanted)!=std::string::npos)return kv.second;
    }
    return -1;
}
int SaeedDx11AvatarRenderer::FindMorph(const std::string& key) const{
    const std::string wanted=Lower(key);
    for(size_t i=0;i<m_morphTargets.size();i++){
        const std::string n=Lower(m_morphTargets[i].name);
        if(n==wanted||n.find(wanted)!=std::string::npos)return static_cast<int>(i);
    }
    return -1;
}
float SaeedDx11AvatarRenderer::MorphWeightFor(const std::string& name) const{
    const std::string n=Lower(name);
    if(n.find("blink")!=std::string::npos||n.find("eyeclose")!=std::string::npos||n.find("eyesclosed")!=std::string::npos)return m_faceBlink;
    if(n.find("smile")!=std::string::npos||n.find("grin")!=std::string::npos||n.find("happy")!=std::string::npos)return m_faceSmile;
    if(n.find("brow")!=std::string::npos||n.find("eyebrow")!=std::string::npos){
        const bool down=n.find("down")!=std::string::npos;
        return down?std::max(0.0f,-m_faceBrow):std::max(0.0f,m_faceBrow);
    }
    if(n.find("jaw")!=std::string::npos||n.find("mouthopen")!=std::string::npos||n.find("viseme")!=std::string::npos){
        if(m_faceEmotion=="speaking")return 0.35f;
        if(m_faceEmotion=="surprised")return 0.55f;
    }
    const bool emotionMatch=(m_faceEmotion!="neutral"&&
        ((m_faceEmotion=="happy"&&(n.find("happy")!=std::string::npos||n.find("joy")!=std::string::npos))||
         (m_faceEmotion=="sad"&&(n.find("sad")!=std::string::npos||n.find("frown")!=std::string::npos))||
         (m_faceEmotion=="angry"&&(n.find("angry")!=std::string::npos||n.find("mad")!=std::string::npos))||
         (m_faceEmotion=="thinking"&&(n.find("think")!=std::string::npos))||
         (m_faceEmotion=="surprised"&&(n.find("surpris")!=std::string::npos))||
         (m_faceEmotion=="greeting"&&(n.find("smile")!=std::string::npos))));
    return emotionMatch?1.0f:0.0f;
}
void SaeedDx11AvatarRenderer::ApplyFacialWeights(){
    for(auto& mt:m_morphTargets)mt.weight=std::clamp(MorphWeightFor(mt.name),0.0f,1.0f);
}
void SaeedDx11AvatarRenderer::SetFacialCommand(const std::string& action,double blink,double smile,double brow,const std::string& emotion){
    if(!m_hasFacialMorphs)return;
    if(action=="face"){
        m_faceBlink=static_cast<float>(std::clamp(blink,0.0,1.0));
        m_faceSmile=static_cast<float>(std::clamp(smile,0.0,1.0));
        m_faceBrow=static_cast<float>(std::clamp(brow,-1.0,1.0));
        if(!emotion.empty())m_faceEmotion=emotion;
    }else if(action=="emotion"){
        m_faceEmotion=emotion.empty()?"neutral":emotion;
    }else if(action=="blink"){
        m_blinkDuration=std::max(0.08f,static_cast<float>(blink));
        m_blinkRemaining=m_blinkDuration;
    }
    ApplyFacialWeights();
}

void SaeedDx11AvatarRenderer::UpdateAnimation(float timeSeconds){
    if(!m_hasAnimation)return;
    for(auto& j:m_joints){
        j.baseTranslation=j.restTranslation;
        j.baseRotation=j.restRotation;
        j.baseScale=j.restScale;
        j.local=j.bindLocal;
    }
    const float t=m_animationDuration>0.0f?std::fmod(timeSeconds,m_animationDuration):0.0f;
    for(const auto& ch:m_animation){
        if(ch.nodeIndex<0||ch.input.empty()||ch.output.empty())continue;
        int jointIndex=-1;
        for(size_t ji=0;ji<m_joints.size();ji++)if(m_joints[ji].nodeIndex==ch.nodeIndex){jointIndex=static_cast<int>(ji);break;}
        if(jointIndex<0)continue;
        size_t hi=0;
        while(hi+1<ch.input.size()&&ch.input[hi+1]<=t)++hi;
        size_t lo=hi;
        size_t next=std::min(hi+1,ch.input.size()-1);
        float alpha=0.0f;
        if(next!=lo && ch.input[next]>ch.input[lo])alpha=(t-ch.input[lo])/(ch.input[next]-ch.input[lo]);
        if(ch.step)alpha=0.0f;
        const size_t stride=ch.components;
        size_t outputStride=stride;
        if(ch.output.size()>=ch.input.size()*stride*3 && ch.output.size()%ch.input.size()==0){
            // CUBICSPLINE: [in tangent, value, out tangent] per key.
            outputStride=stride*3;
        }
        const size_t a0=lo*outputStride+(outputStride==stride?0:stride);
        const size_t a1=next*outputStride+(outputStride==stride?0:stride);
        if(a0+stride>ch.output.size()||a1+stride>ch.output.size())continue;
        Joint& j=m_joints[static_cast<size_t>(jointIndex)];
        float v[4]{};
        for(size_t c=0;c<stride;c++)v[c]=ch.output[a0+c]*(1.0f-alpha)+ch.output[a1+c]*alpha;
        if(ch.path==AnimPath::Translation){
            j.baseTranslation={v[0],v[1],v[2]};
        }else if(ch.path==AnimPath::Scale){
            j.baseScale={v[0],v[1],v[2]};
        }else if(ch.path==AnimPath::Rotation){
            XMVECTOR q=XMQuaternionNormalize(XMVectorSet(v[0],v[1],v[2],v[3]));
            XMStoreFloat4(&j.baseRotation,q);
        }
        j.local=XMMatrixScaling(j.baseScale.x,j.baseScale.y,j.baseScale.z)*
                 XMMatrixRotationQuaternion(XMLoadFloat4(&j.baseRotation))*
                 XMMatrixTranslation(j.baseTranslation.x,j.baseTranslation.y,j.baseTranslation.z);
    }
}

void SaeedDx11AvatarRenderer::ApplyCharacterCommand(const std::string& action,double x,double y,double z,double left,double right,double leftForearm,double rightForearm,double leftThigh,double rightThigh,double leftShin,double rightShin,double leftFoot,double rightFoot,double leftWrist,double rightWrist){
    if(action=="eye_rotation"){
        if(!m_hasRig)return;
        m_eyeX=static_cast<float>(std::clamp(x,-15.0,15.0));m_eyeZ=static_cast<float>(std::clamp(z,-15.0,15.0));
    }
    else if(action=="face"||action=="emotion"||action=="blink"){
        if(!m_hasFacialMorphs)return;
        if(action=="face")SetFacialCommand(action,x,y,z);
        else if(action=="emotion")SetFacialCommand(action,0,0,0, std::to_string(static_cast<int>(x)));
        else SetFacialCommand(action,x);
        return;
    }
    if(!m_hasRig)return; // Static characters deliberately ignore body movement commands.
    if(action=="head_rotation"){m_headX=static_cast<float>(x);m_headY=static_cast<float>(y);m_headZ=static_cast<float>(z);}
    else if(action=="head_rotation"){m_headX=static_cast<float>(x);m_headY=static_cast<float>(y);m_headZ=static_cast<float>(z);}
    else if(action=="neck"){m_neckX=static_cast<float>(x);m_neckY=static_cast<float>(y);m_neckZ=static_cast<float>(z);}
    else if(action=="spine"){m_spineX=static_cast<float>(x);m_spineY=static_cast<float>(y);m_spineZ=static_cast<float>(z);}
    else if(action=="shoulders"){m_leftShoulder=static_cast<float>(left);m_rightShoulder=static_cast<float>(right);}
    else if(action=="arms"){m_leftArm=static_cast<float>(left);m_rightArm=static_cast<float>(right);m_leftForearm=static_cast<float>(leftForearm);m_rightForearm=static_cast<float>(rightForearm);}
    else if(action=="legs"){m_leftThigh=static_cast<float>(leftThigh);m_rightThigh=static_cast<float>(rightThigh);m_leftShin=static_cast<float>(leftShin);m_rightShin=static_cast<float>(rightShin);m_leftFoot=static_cast<float>(leftFoot);m_rightFoot=static_cast<float>(rightFoot);}
    else if(action=="wrists"){m_leftWrist=static_cast<float>(left);m_rightWrist=static_cast<float>(right);}
    else if(action=="walking")m_walking=(x>0.5);
    else if(action=="reset")ResetOptionalMotion();
}

void SaeedDx11AvatarRenderer::UpdateSkin(float t){
    if(m_blinkRemaining>0.0f){
        m_blinkRemaining=std::max(0.0f,m_blinkRemaining-1.0f/60.0f);
        const float phase=1.0f-(m_blinkRemaining/std::max(0.001f,m_blinkDuration));
        m_faceBlink=std::sin(std::clamp(phase,0.0f,1.0f)*3.14159265f);
    }else if(m_faceBlink>0.0f && m_faceEmotion!="speaking"){
        m_faceBlink=0.0f;
    }
    if(m_hasFacialMorphs)ApplyFacialWeights();

    if(m_joints.empty()){
        for(size_t i=0;i<m_sourceVertices.size();i++){
            XMFLOAT3 p=m_sourceVertices[i].position,n=m_sourceVertices[i].normal;
            for(const auto& mt:m_morphTargets){
                if(mt.weight==0.0f||i>=mt.positionDelta.size())continue;
                p.x+=mt.positionDelta[i].x*mt.weight;
                p.y+=mt.positionDelta[i].y*mt.weight;
                p.z+=mt.positionDelta[i].z*mt.weight;
                if(i<mt.normalDelta.size()){
                    n.x+=mt.normalDelta[i].x*mt.weight;
                    n.y+=mt.normalDelta[i].y*mt.weight;
                    n.z+=mt.normalDelta[i].z*mt.weight;
                }
            }
            m_vertices[i].position=p;
            m_vertices[i].normal=n;
            m_vertices[i].uv=m_sourceVertices[i].uv;
            m_vertices[i].color=m_sourceVertices[i].color;
        }
        UploadVertices();
        return;
    }

    // Apply authored animation only when the GLB actually contains both a rig and
    // an animation. A rig without animation is still valid and remains in its
    // authored standing pose.
    if(m_hasAnimation)UpdateAnimation(t);
    else for(auto& j:m_joints)j.local=j.bindLocal;

    // Optional procedural motion is only applied to bones that exist. If a requested
    // bone is absent, the character simply keeps its authored/animated pose.
    const float breathe=std::sin(t*2.0f)*0.008f;
    const float walk=m_walking?std::sin(t*7.2f):0.0f;
    auto rotateJoint=[&](const std::string& key,float rx,float ry,float rz){
        const int idx=FindJoint(key);
        if(idx<0)return;
        m_joints[static_cast<size_t>(idx)].local=
            m_joints[static_cast<size_t>(idx)].local*
            XMMatrixRotationRollPitchYaw(XMConvertToRadians(rx),XMConvertToRadians(ry),XMConvertToRadians(rz));
    };
    if(!m_hasAnimation){
        if(std::fabs(breathe)>0.00001f){
            const int spine=FindJoint("spine");
            if(spine>=0)rotateJoint("spine",breathe*10.0f,0,0);
        }
        if(m_walking){
            rotateJoint("leftupleg",walk*24.0f,0,0);rotateJoint("rightupleg",-walk*24.0f,0,0);
            rotateJoint("leftleg",std::max(0.0f,-walk)*34.0f,0,0);rotateJoint("rightleg",std::max(0.0f,walk)*34.0f,0,0);
            rotateJoint("leftfoot",-walk*8.0f,0,0);rotateJoint("rightfoot",walk*8.0f,0,0);
        }
    }
    rotateJoint("lefteye",m_eyeX,0,m_eyeZ);rotateJoint("righteye",m_eyeX,0,m_eyeZ);
    rotateJoint("head",m_headX,m_headY,m_headZ);
    rotateJoint("neck",m_neckX,m_neckY,m_neckZ);
    rotateJoint("spine",m_spineX,m_spineY,m_spineZ);
    rotateJoint("leftshoulder",0,0,m_leftShoulder);rotateJoint("rightshoulder",0,0,m_rightShoulder);
    rotateJoint("leftarm",0,0,m_leftArm);rotateJoint("rightarm",0,0,m_rightArm);
    rotateJoint("leftforearm",m_leftForearm,0,0);rotateJoint("rightforearm",m_rightForearm,0,0);
    rotateJoint("lefthand",0,0,m_leftWrist);rotateJoint("righthand",0,0,m_rightWrist);
    rotateJoint("leftupleg",m_leftThigh,0,0);rotateJoint("rightupleg",m_rightThigh,0,0);
    rotateJoint("leftleg",m_leftShin,0,0);rotateJoint("rightleg",m_rightShin,0,0);
    rotateJoint("leftfoot",m_leftFoot,0,0);rotateJoint("rightfoot",m_rightFoot,0,0);

    // Rebuild joint world matrices after authored/manual motion has been applied.
    for(size_t i=0;i<m_joints.size();i++){
        const int p=m_joints[i].parent;
        m_jointWorld[i]=m_joints[i].local*(p>=0?m_jointWorld[static_cast<size_t>(p)]:XMMatrixIdentity());
    }

    for(size_t i=0;i<m_sourceVertices.size();i++){
        const auto& s=m_sourceVertices[i];
        XMFLOAT3 morphedP=s.position,morphedN=s.normal;
        for(const auto& mt:m_morphTargets){
            if(mt.weight==0.0f||i>=mt.positionDelta.size())continue;
            morphedP.x+=mt.positionDelta[i].x*mt.weight;
            morphedP.y+=mt.positionDelta[i].y*mt.weight;
            morphedP.z+=mt.positionDelta[i].z*mt.weight;
            if(i<mt.normalDelta.size()){
                morphedN.x+=mt.normalDelta[i].x*mt.weight;
                morphedN.y+=mt.normalDelta[i].y*mt.weight;
                morphedN.z+=mt.normalDelta[i].z*mt.weight;
            }
        }
        XMVECTOR p=XMLoadFloat3(&morphedP),n=XMLoadFloat3(&morphedN);
        XMVECTOR outP=XMVectorZero(),outN=XMVectorZero();
        float sum=0.0f;
        for(int k=0;k<4;k++){
            const float w=(&s.weights.x)[k];
            if(w<=0.00001f||s.joints[k]>=m_jointWorld.size())continue;
            const XMMATRIX m=m_joints[s.joints[k]].inverseBind*m_jointWorld[s.joints[k]];
            outP+=XMVector3TransformCoord(p,m)*w;
            outN+=XMVector3TransformNormal(n,m)*w;
            sum+=w;
        }
        if(sum<0.001f){outP=p;outN=n;}
        else{outP/=sum;outN=XMVector3Normalize(outN/sum);}
        XMFLOAT3 fp,fn;XMStoreFloat3(&fp,outP);XMStoreFloat3(&fn,outN);
        m_vertices[i].position=fp;
        m_vertices[i].normal=fn;
        m_vertices[i].uv=s.uv;
        m_vertices[i].color=s.color;
    }
    UploadVertices();
}

void SaeedDx11AvatarRenderer::UploadVertices(){
    if(!m_vertexBuffer||m_vertices.empty())return;
    D3D11_MAPPED_SUBRESOURCE map{};
    if(SUCCEEDED(m_context->Map(m_vertexBuffer.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&map))){
        std::memcpy(map.pData,m_vertices.data(),m_vertices.size()*sizeof(Vertex));
        m_context->Unmap(m_vertexBuffer.Get(),0);
    }
}

void SaeedDx11AvatarRenderer::Update(float dt){
    if(!m_loaded)return;
    m_time+=std::max(0.0f,dt);
    UpdateSkin(m_time);
}

void SaeedDx11AvatarRenderer::DrawMesh(){
    if(!m_vertexBuffer||!m_indexBuffer)return;
    const UINT stride=sizeof(Vertex),offset=0;
    ID3D11Buffer* vb=m_vertexBuffer.Get();
    m_context->IASetVertexBuffers(0,1,&vb,&stride,&offset);
    m_context->IASetIndexBuffer(m_indexBuffer.Get(),DXGI_FORMAT_R32_UINT,0);
    m_context->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);
    m_context->IASetInputLayout(m_inputLayout.Get());
    m_context->VSSetShader(m_vertexShader.Get(),nullptr,0);
    m_context->PSSetShader(m_pixelShader.Get(),nullptr,0);
    m_context->DrawIndexed(static_cast<UINT>(m_indices.size()),0,0);
}

void SaeedDx11AvatarRenderer::Render(ID3D11RenderTargetView* target,UINT width,UINT height){
    if(!target||!width||!height||!m_loaded)return;
    const float aspect=static_cast<float>(width)/static_cast<float>(height);
    constexpr float fov=35.0f;
    const float distance=std::max(0.5f,m_boundsRadius/std::tan(XMConvertToRadians(fov*0.5f))*1.28f);
    const XMVECTOR targetPoint=XMVectorSet(m_boundsCenter.x,m_boundsCenter.y,m_boundsCenter.z,1.0f);
    const XMVECTOR eye=XMVectorSet(m_boundsCenter.x,m_boundsCenter.y,m_boundsCenter.z-distance,1.0f);
    const XMMATRIX world=XMMatrixIdentity();
    const XMMATRIX view=XMMatrixLookAtLH(eye,targetPoint,XMVectorSet(0,1,0,0));
    const XMMATRIX projection=XMMatrixPerspectiveFovLH(XMConvertToRadians(fov),aspect,std::max(0.001f,distance-m_boundsRadius*1.5f),distance+m_boundsRadius*2.5f);
    D3D11_MAPPED_SUBRESOURCE map{};
    if(SUCCEEDED(m_context->Map(m_constantBuffer.Get(),0,D3D11_MAP_WRITE_DISCARD,0,&map))){
        auto* cb=static_cast<ConstantBuffer*>(map.pData);
        cb->world=XMMatrixTranspose(world);
        cb->view=XMMatrixTranspose(view);
        cb->projection=XMMatrixTranspose(projection);
        cb->lightDirection={-.35f,.75f,-.55f,0};
        m_context->Unmap(m_constantBuffer.Get(),0);
    }
    m_context->VSSetConstantBuffers(0,1,m_constantBuffer.GetAddressOf());
    DrawMesh();
}
