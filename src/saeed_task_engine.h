#pragma once
#include <filesystem>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

class SaeedTaskEngine {
public:
    using json=nlohmann::json;
    explicit SaeedTaskEngine(std::filesystem::path statePath);
    bool Load();
    bool Save() const;
    std::string Create(const std::string& title,const std::string& payload,const std::string& scheduleIso="");
    bool Update(const std::string& id,const std::string& state,const std::string& result="");
    bool Cancel(const std::string& id);
    bool SetDependencies(const std::string& id,const std::vector<std::string>& dependencies);
    bool Retry(const std::string& id);
    bool CanRun(const std::string& id) const;
    json List(bool includeCompleted=true) const;
    json Get(const std::string& id) const;
    json Due() const;
    size_t RecoverInterrupted();
private:
    std::filesystem::path m_path;
    json m_tasks=json::array();
    static std::string NowIso();
    static bool IsValidState(const std::string& state);
};
