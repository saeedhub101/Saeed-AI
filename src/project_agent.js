const fs=require("fs"),path=require("path"),cp=require("child_process");
class ProjectAgent{
 constructor({tools}={}){this.tools=tools}
 safeRoot(root){return path.resolve(root||process.cwd())}
 inside(root,p){const b=this.safeRoot(root),x=path.resolve(p);return x===b||x.startsWith(b+path.sep)}
 write(root,filePath,content){const b=this.safeRoot(root),p=path.resolve(b,filePath);if(!this.inside(b,p))return{ok:false,error:"Path escapes project root."};fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,String(content),"utf8");return{ok:true,path:p,bytes:Buffer.byteLength(String(content))}}
 command(root,command){const r=cp.spawnSync("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command","Set-Location -LiteralPath '"+this.safeRoot(root).replace(/'/g,"''")+"'; "+String(command||"")],{encoding:"utf8",timeout:120000,windowsHide:true,maxBuffer:32*1024*1024});return{ok:r.status===0,exitCode:r.status,stdout:String(r.stdout||"").slice(0,30000),stderr:String(r.stderr||"").slice(0,20000),command:String(command||""),root:this.safeRoot(root)}}
 build(root,command){return this.command(root,command||"if (Test-Path package.json) { npm run build } elseif (Test-Path CMakeLists.txt) { cmake --build build --config Release } elseif (Test-Path Cargo.toml) { cargo build } else { Write-Error 'No supported build manifest found'; exit 2 }")}
 test(root,command){return this.command(root,command||"if (Test-Path package.json) { npm test } elseif (Test-Path Cargo.toml) { cargo test } elseif (Test-Path CMakeLists.txt) { ctest --test-dir build -C Release } else { Write-Error 'No supported test manifest found'; exit 2 }")}
 diagnose(root){const status=this.command(root,"git status --short --branch");const diff=this.command(root,"git diff --check");return{ok:status.ok&&diff.ok,status,diff};}
}
module.exports={ProjectAgent};