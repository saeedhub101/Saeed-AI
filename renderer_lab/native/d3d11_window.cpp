#include "d3d11_window.h"
#include <windows.h>
#include <d3d11.h>
#include <d3dcompiler.h>
#include <cgltf.h>
#include <fstream>
#include <vector>
#include <cmath>
#pragma comment(lib,"d3d11.lib")
#pragma comment(lib,"d3dcompiler.lib")

struct V { float x,y,z; };
struct C { float m[16]; };
static D3D11Window* g_d3d=nullptr;
static LRESULT CALLBACK Proc(HWND h,UINT m,WPARAM w,LPARAM l){if(m==WM_CLOSE||m==WM_DESTROY){DestroyWindow(h);if(m==WM_DESTROY)PostQuitMessage(0);return 0;}return DefWindowProcW(h,m,w,l);}
class D3DImpl {
public: ID3D11Device* dev{}; ID3D11DeviceContext* ctx{}; IDXGISwapChain* sc{}; ID3D11RenderTargetView* rtv{}; ID3D11Buffer* vb{}; ID3D11Buffer* cb{}; ID3D11VertexShader* vs{}; ID3D11PixelShader* ps{}; ID3D11InputLayout* il{}; UINT count{};
 void destroy(){if(il)il->Release();if(ps)ps->Release();if(vs)vs->Release();if(cb)cb->Release();if(vb)vb->Release();if(rtv)rtv->Release();if(sc)sc->Release();if(ctx)ctx->Release();if(dev)dev->Release();}
};
static D3DImpl* impl=nullptr;
static bool loadVerts(const wchar_t* path,std::vector<V>& out){
 cgltf_options o{}; cgltf_data*d=nullptr; if(cgltf_parse_file(&o,path,&d)!=cgltf_result_success)return false;
 bool ok=false; for(size_t mi=0;mi<d->meshes_count&&!ok;++mi)for(size_t pi=0;pi<d->meshes[mi].primitives_count&&!ok;++pi){auto&p=d->meshes[mi].primitives[pi];for(size_t ai=0;ai<p.attributes_count;++ai)if(p.attributes[ai].type==cgltf_attribute_type_position){auto*a=p.attributes[ai].data;size_t n=a->count;out.reserve(n);for(size_t i=0;i<n;++i){float q[3]{};if(cgltf_accessor_read_float(a,i,q,3)){out.push_back({q[0],q[1],q[2]});}}ok=!out.empty();break;}}
 cgltf_free(d); return ok;
}
static bool compile(const char*s,const char*entry,const char*target,ID3DBlob**b){ID3DBlob*e=nullptr;HRESULT h=D3DCompile(s,strlen(s),nullptr,nullptr,nullptr,entry,target,0,0,b,&e);if(e)e->Release();return SUCCEEDED(h);}
bool D3D11Window::Create(HINSTANCE hi,const wchar_t* cls,const wchar_t* title,int x,int y,int w,int h,const wchar_t* glb){
 WNDCLASSW wc{};wc.hInstance=hi;wc.lpfnWndProc=Proc;wc.lpszClassName=cls;wc.hCursor=LoadCursor(nullptr,IDC_ARROW);RegisterClassW(&wc);
 hwnd_=CreateWindowExW(0,cls,title,WS_OVERLAPPEDWINDOW,x,y,w,h,nullptr,nullptr,hi,nullptr);if(!hwnd_)return false;ShowWindow(hwnd_,SW_SHOW);
 DXGI_SWAP_CHAIN_DESC sd{};sd.BufferCount=2;sd.BufferDesc.Format=DXGI_FORMAT_R8G8B8A8_UNORM;sd.BufferUsage=DXGI_USAGE_RENDER_TARGET_OUTPUT;sd.OutputWindow=hwnd_;sd.SampleDesc.Count=1;sd.Windowed=TRUE;sd.SwapEffect=DXGI_SWAP_EFFECT_DISCARD;
 D3D_FEATURE_LEVEL fl; if(FAILED(D3D11CreateDeviceAndSwapChain(nullptr,D3D_DRIVER_TYPE_HARDWARE,nullptr,0,nullptr,0,D3D11_SDK_VERSION,&sd,&impl->sc,&impl->dev,&fl,&impl->ctx)))return false;
 ID3D11Texture2D*bb=nullptr;impl->sc->GetBuffer(0,__uuidof(ID3D11Texture2D),(void**)&bb);impl->dev->CreateRenderTargetView(bb,nullptr,&impl->rtv);bb->Release();
 const char*vsSrc="cbuffer C:register(b0){float4x4 mvp;}struct I{float3 p:POSITION;};struct O{float4 p:SV_POSITION;};O main(I i){O o;o.p=mul(mvp,float4(i.p,1));return o;}";
 const char*psSrc="float4 main():SV_TARGET{return float4(0.18,0.62,0.95,1);}";
 ID3DBlob*b1=nullptr,*b2=nullptr;if(!compile(vsSrc,"main","vs_5_0",&b1)||!compile(psSrc,"main","ps_5_0",&b2))return false;impl->dev->CreateVertexShader(b1->GetBufferPointer(),b1->GetBufferSize(),nullptr,&impl->vs);impl->dev->CreatePixelShader(b2->GetBufferPointer(),b2->GetBufferSize(),nullptr,&impl->ps);D3D11_INPUT_ELEMENT_DESC id{"POSITION",0,DXGI_FORMAT_R32G32B32_FLOAT,0,0,D3D11_INPUT_PER_VERTEX_DATA,0};impl->dev->CreateInputLayout(&id,1,b1->GetBufferPointer(),b1->GetBufferSize(),&impl->il);b1->Release();b2->Release();
 std::vector<V>v;if(!loadVerts(glb,v))return false;impl->count=(UINT)v.size();D3D11_BUFFER_DESC bd{};bd.Usage=D3D11_USAGE_DEFAULT;bd.ByteWidth=UINT(v.size()*sizeof(V));bd.BindFlags=D3D11_BIND_VERTEX_BUFFER;D3D11_SUBRESOURCE_DATA init{v.data(),0,0};impl->dev->CreateBuffer(&bd,&init,&impl->vb);bd.ByteWidth=sizeof(C);bd.BindFlags=D3D11_BIND_CONSTANT_BUFFER;impl->dev->CreateBuffer(&bd,nullptr,&impl->cb);return impl->vb&&impl->cb;
}
void D3D11Window::Frame(){if(!impl)return;float bg[4]={0.035f,0.045f,0.065f,1};impl->ctx->OMSetRenderTargets(1,&impl->rtv,nullptr);impl->ctx->ClearRenderTargetView(impl->rtv,bg);RECT r;GetClientRect(hwnd_,&r);D3D11_VIEWPORT vp{0,0,float(r.right),float(r.bottom),0,1};impl->ctx->RSSetViewports(1,&vp);UINT s=sizeof(V),off=0;impl->ctx->IASetInputLayout(impl->il);impl->ctx->IASetVertexBuffers(0,1,&impl->vb,&s,&off);impl->ctx->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST);impl->ctx->VSSetShader(impl->vs,nullptr,0);impl->ctx->PSSetShader(impl->ps,nullptr,0);float aspect=vp.Width/vp.Height;float f=1.0f/tanf(0.5f);C c{};c.m[0]=f/aspect;c.m[5]=f;c.m[10]=1;c.m[11]=1;c.m[14]=2.5f;c.m[15]=1;impl->ctx->UpdateSubresource(impl->cb,0,nullptr,&c,0,0);impl->ctx->VSSetConstantBuffers(0,1,&impl->cb);impl->ctx->Draw(impl->count,0);impl->sc->Present(1,0);}
