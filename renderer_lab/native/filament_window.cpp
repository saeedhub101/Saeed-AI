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
bool FilamentWindow::Create(HINSTANCE hi,const wchar_t*cls,const wchar_t*title,int x,int y,int w,int h,const wchar_t*glb){WNDCLASSW wc{};wc.hInstance=hi;wc.lpfnWndProc=fProc;wc.lpszClassName=cls;RegisterClassW(&wc);hwnd_=CreateWindowExW(0,cls,title,WS_OVERLAPPEDWINDOW,x,y,w,h,nullptr,nullptr,hi,nullptr);ShowWindow(hwnd_,SW_SHOW);e=Engine::create();r=e->createRenderer();sc=e->createSwapChain(hwnd_);s=e->createScene();v=e->createView();c=e->createCamera(EntityManager::get().create());v->setScene(s);v->setCamera(c);c->lookAt({0,0,4},{0,0,0});materials=createJitShaderProvider(e,true,{});loader=AssetLoader::create({e,materials});std::ifstream f(glb,std::ios::binary);std::vector<uint8_t>b((std::istreambuf_iterator<char>(f)),{});if(b.empty())return false;asset=loader->createAsset(b.data(),uint32_t(b.size()));if(!asset)return false;ResourceConfiguration cfg{}; cfg.engine=e; resources=new ResourceLoader(cfg); resources->asyncBeginLoad(asset);s->addEntities(asset->getEntities(),asset->getEntityCount());return true;}
void FilamentWindow::Frame(){if(resources)resources->asyncUpdateLoad();if(!r||!r->beginFrame(sc))return;r->render(v);r->endFrame();}
