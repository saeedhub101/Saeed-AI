#pragma once
#include "renderer_lab_window.h"
class FilamentWindow final: public IRenderLabWindow{
 HWND hwnd_{};
public:
 bool Create(HINSTANCE,const wchar_t*,const wchar_t*,int,int,int,int,const wchar_t*) override;
 void Frame() override;
};