const fs=require("fs"),path=require("path");
class DatabaseAdapter{
  constructor(computer){this.computer=computer}
  extension(file){return path.extname(String(file||"")).toLowerCase()}
  detect(file){
    const ext=this.extension(file);
    const map={".db":"sqlite",".sqlite":"sqlite",".sqlite3":"sqlite",".mdb":"access",".accdb":"access"};
    return map[ext]||"unknown";
  }
  async inspect(file){
    const p=path.resolve(String(file||""));
    if(!fs.existsSync(p))return{ok:false,error:"Database file not found",path:p};
    const type=this.detect(p);
    if(type==="sqlite")return this.sqliteInspect(p);
    if(type==="access")return{ok:true,path:p,type,readOnly:true,status:"Access database identified; schema inspection requires an installed Access/ACE provider."};
    return{ok:true,path:p,type:"unknown",readOnly:true,status:"Database format not identified; no write operation performed."};
  }
  async sqliteInspect(p){
    const cmd='if(Get-Command sqlite3 -ErrorAction SilentlyContinue){$tables=sqlite3 -json "'+p.replace(/"/g,'""')+'" "SELECT name,type FROM sqlite_master WHERE type IN (''table'',''view'') ORDER BY name;";$cols=sqlite3 -json "'+p.replace(/"/g,'""')+'" "SELECT m.name AS table_name,p.name AS column_name,p.type AS data_type,p.pk,p.notnull FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type=''table'' ORDER BY m.name,p.cid;";[pscustomobject]@{available=$true;tables=$tables;columns=$cols}|ConvertTo-Json -Compress}else{[pscustomobject]@{available=$false}|ConvertTo-Json -Compress}';
    try{
      const r=await this.computer.powershell(cmd),raw=JSON.parse(r.stdout||"{}");
      if(!raw.available)return{ok:true,path:p,type:"sqlite",readOnly:true,toolAvailable:false,status:"sqlite3 CLI is not installed; no write operation performed."};
      const parse=v=>{try{return JSON.parse(v||"[]")}catch{return[]}};
      return{ok:true,path:p,type:"sqlite",readOnly:true,toolAvailable:true,tables:parse(raw.tables),columns:parse(raw.columns)};
    }catch(e){return{ok:false,path:p,type:"sqlite",error:e.message}};
  }
  async readSqlite(file,sql){
    const p=path.resolve(String(file||"")),q=String(sql||"").trim();
    if(this.detect(p)!=="sqlite")return{ok:false,error:"Only SQLite is supported by this read adapter."};
    if(!/^select\\b/i.test(q)&&!/^pragma\\b/i.test(q))return{ok:false,error:"Read adapter accepts SELECT or PRAGMA only."};
    if(/;/.test(q.replace(/;\\s*$/,"")))return{ok:false,error:"Multiple SQL statements are not allowed."};
    const cmd='sqlite3 -json "'+p.replace(/"/g,'""')+'" "'+q.replace(/"/g,'""')+'"';
    try{const r=await this.computer.powershell(cmd);if(r.stderr)return{ok:false,error:r.stderr,stdout:r.stdout};return{ok:true,rows:JSON.parse(r.stdout||"[]")}}catch(e){return{ok:false,error:e.message}};
  }
}
module.exports={DatabaseAdapter};