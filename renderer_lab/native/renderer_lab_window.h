#pragma once
#include <windows.h>
class IRenderLabWindow{
public:
 virtual ~IRenderLabWindow()=default;
 virtual bool Create(HINSTANCE,const wchar_t*,const wchar_t*,int,int,int,int,const wchar_t*)=0;
 virtual void Frame()=0;
};