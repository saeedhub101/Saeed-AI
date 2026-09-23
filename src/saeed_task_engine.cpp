#include "saeed_task_engine.h"
#include <algorithm>
#include <chrono>
#include <ctime>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>

using json=nlohmann::json;

namespace {
std::string Lower(std::string s){std::transform(s.begin(),s.end(),s.begin(),[](unsigned char c){return (char)std::tolower(c);});return s;}
std::string Id(){static std::mt19937_64 rng{std::random_device{}()};std::ostringstream o;o<<"task-"<<std::hex<<rng();return o.str();}
}

SaeedTaskEngine::SaeedTaskEngine(std::filesystem::path statePath):m_path(std::move(statePath)){}

std::string SaeedTaskEngine::NowIso(){
    const auto now=std::chrono::system_clock::now();
    const std::time_t t=std::chrono::system_clock::to_time_t(now);
    std::tm tm{}; gmtime_s(&tm,&t);
    std::ostringstream o;o<<std::put_time(&tm,"%Y-%m-%dT%H:%M:%SZ");return o.str();
}
bool SaeedTaskEngine::IsValidState(const std::string& s){
    return s=="queued"||s=="running"||s=="waiting"||s=="completed"||s=="failed"||s=="cancelled";
}
bool SaeedTaskEngine::Load(){
    m_tasks=json::array();
    std::error_code ec;
    std::filesystem::create_directories(m_path.parent_path(),ec);
    std::ifstream in(m_path);
    if(!in)return Save();
    try{in>>m_tasks;if(!m_tasks.is_array())m_tasks=json::array();}catch(...){m_tasks=json::array();return Save();}
    return true;
}
bool SaeedTaskEngine::Save() const{
    std::error_code ec;
    std::filesystem::create_directories(m_path.parent_path(),ec);
    const auto tmp=m_path.wstring()+L".tmp";
    {std::ofstream out(tmp,std::ios::trunc);if(!out)return false;out<<m_tasks.dump(2);out.flush();if(!out)return false;}
    std::filesystem::remove(m_path,ec);
    std::filesystem::rename(tmp,m_path,ec);
    return !ec;
}
std::string SaeedTaskEngine::Create(const std::string& title,const std::string& payload,const std::string& scheduleIso){
    if(title.empty())return {};
    const std::string id=Id(), now=NowIso();
    m_tasks.push_back({{"id",id},{"title",title},{"payload",payload},{"state","queued"},{"created_at",now},{"updated_at",now},{"schedule_at",scheduleIso},{"attempts",0},{"max_attempts",3},{"dependencies",json::array()},{"result",""}});
    return Save()?id:std::string{};
}
bool SaeedTaskEngine::Update(const std::string& id,const std::string& state,const std::string& result){
    if(id.empty()||!IsValidState(state))return false;
    for(auto& t:m_tasks)if(t.value("id","")==id){
        t["state"]=state;t["updated_at"]=NowIso();t["result"]=result;
        if(state=="running")t["attempts"]=t.value("attempts",0)+1;
        return Save();
    }
    return false;
}
bool SaeedTaskEngine::Cancel(const std::string& id){return Update(id,"cancelled","Cancelled by user.");}
bool SaeedTaskEngine::SetDependencies(const std::string& id,const std::vector<std::string>& dependencies){
    for(auto& t:m_tasks) if(t.value("id","")==id){
        json a=json::array(); for(const auto& d:dependencies) if(!d.empty()&&d!=id) a.push_back(d);
        t["dependencies"]=a; t["updated_at"]=NowIso(); return Save();
    } return false;
}
bool SaeedTaskEngine::CanRun(const std::string& id) const{
    const auto task=Get(id); if(task.empty()) return false;
    if(task.value("state","")!="queued"&&task.value("state","")!="waiting") return false;
    if(task.contains("dependencies")&&task["dependencies"].is_array()){
        for(const auto& d:task["dependencies"]) {
            const auto dep=Get(d.get<std::string>());
            if(dep.empty()||dep.value("state","")!="completed") return false;
        }
    }
    return true;
}
bool SaeedTaskEngine::Retry(const std::string& id){
    for(auto& t:m_tasks) if(t.value("id","")==id){
        const int attempts=t.value("attempts",0), maxAttempts=t.value("max_attempts",3);
        if((t.value("state","")!="failed"&&t.value("state","")!="cancelled")||attempts>=maxAttempts) return false;
        t["state"]="queued"; t["updated_at"]=NowIso(); t["result"]="Retry queued.";
        return Save();
    } return false;
}
json SaeedTaskEngine::List(bool includeCompleted) const{
    json out=json::array();
    for(const auto& t:m_tasks)if(includeCompleted||t.value("state","")!="completed")out.push_back(t);
    return out;
}
json SaeedTaskEngine::Get(const std::string& id) const{
    for(const auto& t:m_tasks)if(t.value("id","")==id)return t;
    return {};
}
json SaeedTaskEngine::Due() const{
    const std::string now=NowIso();json out=json::array();
    for(const auto& t:m_tasks){
        const std::string at=t.value("schedule_at","");
        const std::string st=t.value("state","");
        if(!at.empty()&&at<=now&&(st=="queued"||st=="waiting"))out.push_back(t);
    }
    return out;
}
size_t SaeedTaskEngine::RecoverInterrupted(){
    size_t n=0;
    for(auto& t:m_tasks)if(t.value("state","")=="running"){t["state"]="queued";t["updated_at"]=NowIso();++n;}
    if(n)Save();
    return n;
}
