#pragma once
#include "renderer_lab_window.h"
class OpenGLWindow final: public IRenderLabWindow{
 HWND hwnd_{}; HDC dc_{}; HGLRC rc_{};
public:
 ~OpenGLWindow();
 bool Create(HINSTANCE,const wchar_t*,const wchar_t*,int,int,int,int,const wchar_t*) override;
 void Frame() override;
};