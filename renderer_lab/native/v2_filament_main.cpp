#include <windows.h>
#include <filesystem>
#include <fstream>
#include <vector>
#include <filament/Engine.h>
#include <filament/Renderer.h>
#include <filament/SwapChain.h>
#include <filament/View.h>
#include <filament/Scene.h>
#include <filament/Camera.h>
#include <gltfio/AssetLoader.h>
#include <gltfio/ResourceLoader.h>
#include <gltfio/MaterialProvider.h>
#include <utils/EntityManager.h>
using namespace filament;using namespace filament::gltfio;
static HWND h{};static Engine*e{};static Renderer*r{};static SwapChain*sc{};static View*v{};static Scene*s{};static Camera*c{};static AssetLoader*l{};static FilamentAsset*a{};static MaterialProvider*m{};static ResourceLoader*res{};
static LRESULT CALLBACK p(HWND x,UINT msg,WPARAM w,LPARAM q){if(msg==WM_CLOSE){DestroyWindow(x);return 0;}if(msg==WM_DESTROY){PostQuitMessage(0);return 0;}return DefWindowProcW(x,msg,w,q);}
static std::wstring d(){wchar_t b[MAX_PATH]{};DWORD n=GetModuleFileNameW(nullptr,b,MAX_PATH);return n?std::filesystem::path(b,b+n).parent_path().wstring():L".";}
int WINAPI wWinMain(HINSTANCE hi,HINSTANCE,LPWSTR,int){auto root=std::filesystem::path(d()),glb=root/L"saeed.ai.glb";if(GetFileAttributesW(glb.c_str())==INVALID_FILE_ATTRIBUTES)return 10;WNDCLASSW wc{};wc.hInstance=hi;wc.lpfnWndProc=p;wc.lpszClassName=L"Saeed3ScreenV2Filament";RegisterClassW(&wc);h=CreateWindowExW(0,wc.lpszClassName,L"3 — Google Filament",WS_OVERLAPPEDWINDOW,1080,60,500,720,nullptr,nullptr,hi,nullptr);ShowWindow(h,SW_SHOW);e=Engine::create();r=e->createRenderer();sc=e->createSwapChain(h);s=e->createScene();v=e->createView();c=e->createCamera(utils::EntityManager::get().create());v->setScene(s);v->setCamera(c);c->lookAt({0,0,4},{0,0,0});m=createJitShaderProvider(e,true,{});l=AssetLoader::create({e,m});std::ifstream f(glb,std::ios::binary);std::vector<uint8_t>b((std::istreambuf_iterator<char>(f)),{});if(b.empty())return 11;a=l->createAsset(b.data(),(uint32_t)b.size());if(!a)return 12;ResourceConfiguration cfg{};cfg.engine=e;res=new ResourceLoader(cfg);res->asyncBeginLoad(a);s->addEntities(a->getEntities(),a->getEntityCount());MSG msg{};while(msg.message!=WM_QUIT){while(PeekMessageW(&msg,nullptr,0,0,PM_REMOVE)){TranslateMessage(&msg);DispatchMessageW(&msg);}if(res)res->asyncUpdateLoad();if(r&&r->beginFrame(sc)){r->render(v);r->endFrame();}Sleep(1);}return 0;}