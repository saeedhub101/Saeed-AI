#include <windows.h>
#include <filesystem>
#include <fstream>
#include <vector>
#include <string>
#include <cgltf.h>
#include <bgfx/bgfx.h>
#include <bx/math.h>
static HWND g_hwnd{};
static LRESULT CALLBACK proc(HWND h,UINT m,WPARAM w,LPARAM l){if(m==WM_CLOSE){DestroyWindow(h);return 0;}if(m==WM_DESTROY){PostQuitMessage(0);return 0;}return DefWindowProcW(h,m,w,l);}
static std::wstring dir(){wchar_t b[MAX_PATH]{};DWORD n=GetModuleFileNameW(nullptr,b,MAX_PATH);return n?std::filesystem::path(b,b+n).parent_path().wstring():L".";}
static const bgfx::Memory* readBin(const std::filesystem::path& p){std::ifstream f(p,std::ios::binary);if(!f)return nullptr;std::vector<uint8_t>b((std::istreambuf_iterator<char>(f)),{});auto*m=bgfx::alloc((uint32_t)b.size());memcpy(m->data,b.data(),b.size());return m;}
int WINAPI wWinMain(HINSTANCE hi,HINSTANCE,LPWSTR cmd,int){
std::wstring arg=cmd?cmd:L"";bgfx::RendererType::Enum type=arg.find(L"vulkan")!=std::wstring::npos?bgfx::RendererType::Vulkan:bgfx::RendererType::Direct3D11;bool vk=type==bgfx::RendererType::Vulkan;
auto root=std::filesystem::path(dir()),glb=root/L"saeed.ai.glb";if(GetFileAttributesW(glb.c_str())==INVALID_FILE_ATTRIBUTES)return 10;
WNDCLASSW wc{};wc.hInstance=hi;wc.lpfnWndProc=proc;wc.lpszClassName=L"Saeed3ScreenV2Child";RegisterClassW(&wc);
g_hwnd=CreateWindowExW(0,wc.lpszClassName,vk?L"2 — Vulkan (bgfx backend)":L"1 — bgfx (DirectX 11 backend)",WS_OVERLAPPEDWINDOW,40+(vk?540:0),60,500,720,nullptr,nullptr,hi,nullptr);ShowWindow(g_hwnd,SW_SHOW);
bgfx::Init in{};in.type=type;in.platformData.nwh=g_hwnd;in.resolution.width=500;in.resolution.height=720;in.resolution.reset=BGFX_RESET_VSYNC;if(!bgfx::init(in)){MessageBoxW(nullptr,vk?L"Vulkan initialization failed.":L"bgfx/DirectX 11 initialization failed.",L"Saeed 3Screen V2",MB_OK|MB_ICONERROR);return 20;}
bgfx::setViewClear(0,BGFX_CLEAR_COLOR|BGFX_CLEAR_DEPTH,0x0b1020ff,1,0);bgfx::VertexLayout layout;layout.begin().add(bgfx::Attrib::Position,3,bgfx::AttribType::Float).end();
std::vector<float>pos;cgltf_options o{};cgltf_data*d=nullptr;std::string gp=glb.string();if(cgltf_parse_file(&o,gp.c_str(),&d)!=cgltf_result_success)return 21;
for(size_t m=0;m<d->meshes_count && pos.empty();++m)for(size_t p=0;p<d->meshes[m].primitives_count && pos.empty();++p)for(size_t a=0;a<d->meshes[m].primitives[p].attributes_count;++a){auto&at=d->meshes[m].primitives[p].attributes[a];if(at.type==cgltf_attribute_type_position){pos.resize(at.data->count*3);for(size_t i=0;i<at.data->count;++i)cgltf_accessor_read_float(at.data,i,&pos[i*3],3);break;}}
cgltf_free(d);if(pos.empty())return 22;auto vb=bgfx::createVertexBuffer(bgfx::makeRef(pos.data(),(uint32_t)(pos.size()*sizeof(float))),layout);
auto sdir=root/L"shaders";auto*vs=readBin(sdir/(vk?L"vulkan/vs_model.bin":L"dx11/vs_model.bin"));auto*fs=readBin(sdir/(vk?L"vulkan/fs_model.bin":L"dx11/fs_model.bin"));if(!vs||!fs)return 23;auto prog=bgfx::createProgram(bgfx::createShader(vs),bgfx::createShader(fs),true);if(!bgfx::isValid(prog))return 24;
MSG msg{};while(msg.message!=WM_QUIT){while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){TranslateMessage(&msg);DispatchMessageW(&msg);}RECT r{};GetClientRect(g_hwnd,&r);uint16_t W=(uint16_t)max(1L,r.right-r.left),H=(uint16_t)max(1L,r.bottom-r.top);bgfx::setViewRect(0,0,0,W,H);float view[16],proj[16],mtx[16];bx::mtxLookAt(view,{0,0,-4},{0,0,0});bx::mtxProj(proj,60,float(W)/float(H),.1f,100,bgfx::getCaps()->homogeneousDepth);bx::mtxIdentity(mtx);bgfx::setViewTransform(0,view,proj);bgfx::setTransform(mtx);bgfx::setVertexBuffer(0,vb);bgfx::setState(BGFX_STATE_DEFAULT);bgfx::submit(0,prog);bgfx::frame();Sleep(1);}bgfx::shutdown();return 0;}