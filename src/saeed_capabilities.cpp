#include "saeed_capabilities.h"
#include <algorithm>
#include <cctype>
#include <fstream>

using json=nlohmann::json;

namespace {
std::string Lower(std::string s){
    std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return static_cast<char>(std::tolower(c));});
    return s;
}
}

bool SaeedCapabilityRegistry::IsValidCapabilityName(const std::string& name){
    if(name.empty()||name.size()>64)return false;
    for(char c:name) if(!(std::isalnum(static_cast<unsigned char>(c))||c=='_'||c=='-'||c=='.')) return false;
    return true;
}

bool SaeedCapabilityRegistry::Register(const std::string& name,const std::string& description,const std::string& version){
    if(!IsValidCapabilityName(name)||description.empty()||description.size()>512)return false;
    auto it=std::find_if(m_capabilities.begin(),m_capabilities.end(),[&](const Capability& c){return Lower(c.name)==Lower(name);});
    if(it!=m_capabilities.end()){
        it->description=description;
        it->version=version.empty()?"1.0.0":version;
        return true;
    }
    m_capabilities.push_back({name,description,version.empty()?"1.0.0":version,"",true,{}});
    return true;
}

bool SaeedCapabilityRegistry::Remove(const std::string& name){
    const auto old=m_capabilities.size();
    m_capabilities.erase(std::remove_if(m_capabilities.begin(),m_capabilities.end(),[&](const Capability& c){return Lower(c.name)==Lower(name);}),m_capabilities.end());
    return old!=m_capabilities.size();
}

bool SaeedCapabilityRegistry::Has(const std::string& name) const{
    return std::any_of(m_capabilities.begin(),m_capabilities.end(),[&](const Capability& c){return Lower(c.name)==Lower(name);});
}

json SaeedCapabilityRegistry::List() const{
    json out=json::array();
    for(const auto& c:m_capabilities){
        out.push_back({{"name",c.name},{"description",c.description},{"version",c.version},
                       {"path",c.path},{"enabled",c.enabled},{"permissions",c.permissions}});
    }
    return out;
}

bool SaeedCapabilityRegistry::LoadPlugins(const std::filesystem::path& root){
    if(root.empty())return false;
    std::error_code ec;
    std::filesystem::create_directories(root,ec);
    if(ec)return false;
    bool any=false;
    for(const auto& e:std::filesystem::directory_iterator(root,std::filesystem::directory_options::skip_permission_denied,ec)){
        if(ec){ec.clear();continue;}
        if(!e.is_directory(ec)){ec.clear();continue;}
        const auto manifest=e.path()/"manifest.json";
        if(!std::filesystem::is_regular_file(manifest,ec)){ec.clear();continue;}
        try{
            std::ifstream in(manifest);
            if(!in)continue;
            json j;in>>j;
            const std::string name=j.value("name","");
            const std::string description=j.value("description","");
            const std::string version=j.value("version","1.0.0");
            const bool enabled=j.value("enabled",true);
            if(!IsValidCapabilityName(name)||description.empty()||version.size()>32)continue;
            std::vector<std::string> permissions;
            if(j.contains("permissions")&&j["permissions"].is_array()){
                for(const auto& p:j["permissions"]){
                    if(p.is_string()){
                        const std::string v=p.get<std::string>();
                        if(v.size()<=64)permissions.push_back(v);
                    }
                }
            }
            // Manifests are declarative. No DLL/EXE is loaded or executed here.
            if(Register(name,description,version)){
                for(auto& cap:m_capabilities){
                    if(Lower(cap.name)==Lower(name)){
                        cap.path=e.path().string();
                        cap.enabled=enabled;
                        cap.permissions=permissions;
                        break;
                    }
                }
                any=true;
            }
        }catch(...){}
    }
    return any;
}

size_t SaeedCapabilityRegistry::LoadedPluginCount() const{return m_capabilities.size();}

bool SaeedCapabilityRegistry::SetEnabled(const std::string& name,bool enabled){
    for(auto& c:m_capabilities){
        if(Lower(c.name)==Lower(name)){c.enabled=enabled;return true;}
    }
    return false;
}
