const fs=require("fs"),path=require("path"),crypto=require("crypto"),{spawn}=require("child_process");
const {listPackage}=require("@electron/asar");
const root=path.resolve(__dirname,".."),dist=path.join(root,"dist");
const errors=[];
const version=fs.readFileSync(path.join(root,"VERSION"),"utf8").trim();
const expected="Saeed.AI.Setup."+version+".0.exe";
const exes=fs.readdirSync(dist).filter(n=>n.toLowerCase().endsWith(".exe")&&!/uninstaller/i.test(n));
if(exes.length!==1||exes[0]!==expected) errors.push("Installer identity/count failed");
const exe=path.join(dist,expected);
if(!fs.existsSync(exe)||fs.statSync(exe).size<10000000) errors.push("Installer missing or unexpectedly small");
const unpacked=path.join(dist,"win-unpacked");
const appExe=path.join(unpacked,"Saeed AI.exe");
if(!fs.existsSync(appExe)) errors.push("win-unpacked application executable missing");
const asar=path.join(unpacked,"resources","app.asar");
if(!fs.existsSync(asar)) errors.push("resources/app.asar missing");
if(fs.existsSync(asar)){
 try{
  const entries=listPackage(asar).map(p=>String(p).replace(/\\/g,"/").replace(/^\/+/,""));
  const required=["src/main.js","src/preload.js","src/renderer.js","src/avatar.js","src/agent.js","src/tools.js","src/tools/dispatcher.js","src/tools/schemas.js","assets/Saeed_AI-3D.glb","src/index.html"];
  for(const p of required) if(!entries.includes(p)) errors.push("Packaged file missing: "+p);
  if(entries.some(p=>/\.csharp|godot|\.vrm$/i.test(p))) errors.push("Forbidden legacy/VRM asset found in package");
 }catch(e){errors.push("app.asar inspection failed: "+e.message);}
}
if(errors.length){console.error("PACKAGED GATE FAILED");for(const e of errors) console.error(" - "+e);process.exit(1);}
const sha=crypto.createHash("sha256").update(fs.readFileSync(exe)).digest("hex");
fs.writeFileSync(path.join(dist,"Saeed-AI-Setup-x64.exe.sha256"),sha+"  "+expected+"\n");
console.log("Packaged integrity gate passed. SHA256="+sha);
const child=spawn(appExe,[],{env:{...process.env,SAEED_SMOKE_TEST:"1"},stdio:["ignore","pipe","pipe"],windowsHide:true});
let out="",err="";
child.stdout.on("data",d=>out+=d); child.stderr.on("data",d=>err+=d);
const timer=setTimeout(()=>{console.error("Packaged smoke test timed out.");console.error(("STDOUT:\n"+out+"\nSTDERR:\n"+err).slice(-12000));try{require("child_process").execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"});}catch(e){try{child.kill();}catch(_){}}process.exit(1);},20000);
child.on("error",e=>{console.error("Packaged smoke process failed to start:",e.message);});
child.on("close",code=>{
 clearTimeout(timer);
 const log=out+"\n"+err;
 if(code!==0||/Saeed startup failed|uncaught|rejection|Cannot find module|MODULE_NOT_FOUND|Saeed smoke test failed/i.test(log)){
  console.error("PACKAGED SMOKE TEST FAILED");console.error(log.slice(-12000));process.exit(1);
 }
 console.log("Packaged Electron startup/IPC/agent/tool/permission smoke test passed.");
});
