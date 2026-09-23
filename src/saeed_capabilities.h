#pragma once
#include <filesystem>
#include <string>
#include <vector>
#include <nlohmann/json.hpp>

class SaeedCapabilityRegistry {
public:
    using json=nlohmann::json;
    bool Register(const std::string& name,const std::string& description,const std::string& version="1.0.0");
    bool Remove(const std::string& name);
    bool Has(const std::string& name) const;
    json List() const;
    bool LoadPlugins(const std::filesystem::path& root);
    size_t LoadedPluginCount() const;
    static bool IsValidCapabilityName(const std::string& name);
private:
    struct Capability { std::string name,description,version; };
    std::vector<Capability> m_capabilities;
};
