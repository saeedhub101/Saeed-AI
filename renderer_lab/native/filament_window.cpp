#include "filament_window.h"
#include <windows.h>
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
#include <fstream>
#include <vector>
using namespace filament; using namespace filament::gltfio;
static LRESULT CALLBACK fProc(HWND h,UINT m,WPARAM w,LPARAM l){if(m==WM_CLOSE){DestroyWindow(h);return 0;}if(m==WM_DESTROY){PostQuitMessage(0);return 0;}return DefWindowProcW(h,m,w,l);}
static Engine* e=nullptr;static Renderer*r=nullptr;static SwapChain*sc=nullptr;static View*v=nullptr;static Scene*s=nullptr;static Camera*c=nullptr;static AssetLoader*loader=nullptr;static FilamentAsset*asset=nullptr;static MaterialProvider*materials=nullptr;static ResourceLoader*resources=nullptr;
bool FilamentWindow::Create(HINSTANCE hi,const wchar_t*cls,const wchar_t*title,int x,int y,int w,int h,const wchar_t*glb){
    WNDCLASSW wc{};wc.hInstance=hi;wc.lpfnWndProc=fProc;wc.lpszClassName=cls;RegisterClassW(&wc);
    hwnd_=CreateWindowExW(0,cls,title,WS_OVERLAPPEDWINDOW,x,y,w,h,nullptr,nullptr,hi,nullptr);if(!hwnd_)return false;ShowWindow(hwnd_,SW_SHOW);
    e=Engine::create();if(!e){OutputDebugStringW(L"Filament Engine::create failed.\n");return false;}
    r=e->createRenderer();if(!r){OutputDebugStringW(L"Filament createRenderer failed.\n");return false;}
    sc=e->createSwapChain(hwnd_);if(!sc){OutputDebugStringW(L"Filament createSwapChain(HWND) failed.\n");return false;}
    s=e->createScene();if(!s){OutputDebugStringW(L"Filament createScene failed.\n");return false;}
    v=e->createView();if(!v){OutputDebugStringW(L"Filament createView failed.\n");return false;}
    c=e->createCamera(utils::EntityManager::get().create());if(!c){OutputDebugStringW(L"Filament createCamera failed.\n");return false;}
    v->setScene(s);v->setCamera(c);c->lookAt({0,0,4},{0,0,0});
    materials=createJitShaderProvider(e,true,{});if(!materials){OutputDebugStringW(L"Filament JIT MaterialProvider failed.\n");return false;}
    loader=AssetLoader::create({e,materials});if(!loader){OutputDebugStringW(L"Filament AssetLoader::create failed.\n");return false;}
    std::ifstream f(glb,std::ios::binary);if(!f){OutputDebugStringW(L"Filament could not open GLB.\n");return false;}
    std::vector<uint8_t>b((std::istreambuf_iterator<char>(f)),{});if(b.empty())return false;
    asset=loader->createAsset(b.data(),uint32_t(b.size()));if(!asset){OutputDebugStringW(L"Filament createAsset failed.\n");return false;}
    ResourceConfiguration cfg{};cfg.engine=e;resources=new ResourceLoader(cfg);if(!resources)return false;
    resources->asyncBeginLoad(asset);s->addEntities(asset->getEntities(),asset->getEntityCount());return true;
}
void FilamentWindow::Frame(){if(resources)resources->asyncUpdateLoad();if(!r||!sc||!v||!r->beginFrame(sc))return;r->render(v);r->endFrame();}
