#pragma once
#include <nlohmann/json.hpp>
#include <windows.h>
#include <string>

namespace SaeedWindows {
nlohmann::json EnumerateWindows();
nlohmann::json GetWindow(const std::string& title);
nlohmann::json SetWindowGeometry(const std::string& title,int x,int y,int width,int height,bool maximize,bool restore);
nlohmann::json RestoreWindow(const std::string& title);
nlohmann::json SearchFiles(const std::wstring& root,const std::wstring& query,int maxResults=100);
nlohmann::json EnumerateProcesses();
nlohmann::json TerminateProcessByPid(DWORD pid);
}
