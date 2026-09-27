const fs=require("fs"),path=require("path"),crypto=require("crypto"),{spawn}=require("child_process");
const {listPackage}=require("@electron/asar");
const root=path.resolve(__dirname,".."),dist=path.join(root,"dist"),errors=[];
const version=fs.readFileSync(path.join(root,"VERSION"),"utf8").trim(),expected="Saeed.AI.Setup."+version+".0.exe";
const exes=fs.readdirSync(dist).filter(n=>n.toLowerCase().endsWith(".exe")&&!/uninstaller/i.test(n));
if(exes.length!==1||exes[0]!==expected)errors.push("Installer identity/count failed");
const exe=path.join(dist,expected),unpacked=path.join(dist,"win-unpacked"),appExe=path.join(unpacked,"Saeed AI.exe"),asar=path.join(unpacked,"resources","app.asar");
if(!fs.existsSync(exe)||fs.statSync(exe).size<10000000)errors.push("Installer missing or unexpectedly small");
if(!fs.existsSync(appExe)||!fs.existsSync(asar))errors.push("Packaged application executable/app.asar missing");
if(fs.existsSync(asar)){try{
 const entries=listPackage(asar).map(p=>String(p).replace(/\\/g,"/").replace(/^\/+ /,""));
 const required=["src/main.js","src/preload.js","src/renderer.js","src/avatar.js","src/character.html","src/character.css","src/agent.js","src/tools.js","src/tools/dispatcher.js","src/tools/schemas.js","assets/Saeed_AI-3D.glb"];
 for(const p of required)if(!entries.includes(p))errors.push("Packaged file missing: "+p);
 if(entries.some(p=>/\.csharp|godot|\.vrm$/i.test(p)))errors.push("Forbidden legacy/VRM asset found in package");
}catch(e){errors.push("app.asar inspection failed: "+e.message)}}
if(errors.length){console.error("PACKAGED GATE FAILED");errors.forEach(e=>console.error(" - "+e));process.exit(1)}
const sha=crypto.createHash("sha256").update(fs.readFileSync(exe)).digest("hex");
fs.writeFileSync(path.join(dist,"Saeed-AI-Setup-x64.exe.sha256"),sha+"  "+expected+"\n");
const logFile=path.join(dist,"packaged-smoke-runtime.log"),userData=path.join(dist,"packaged-smoke-user-data");
try{fs.rmSync(logFile,{force:true});fs.rmSync(userData,{recursive:true,force:true});fs.mkdirSync(userData,{recursive:true})}catch(e){}
const args=["--no-sandbox","--disable-gpu-sandbox","--user-data-dir="+userData,"--enable-logging=file","--log-file="+logFile,"--crash-dumps-dir="+path.join(dist,"crash-dumps")];
const child=spawn(appExe,args,{env:{...process.env,SAEED_SMOKE_TEST:"1",ELECTRON_ENABLE_LOGGING:"1"},stdio:["ignore","pipe","pipe"],windowsHide:true});
let out="",err="";child.stdout.on("data",d=>out+=d);child.stderr.on("data",d=>err+=d);
const timer=setTimeout(()=>{console.error("PACKAGED SMOKE TEST TIMED OUT AFTER 45S");console.error((out+"\n"+err).slice(-12000));try{if(fs.existsSync(logFile))console.error(("ELECTRON LOG:\n"+fs.readFileSync(logFile,"utf8")).slice(-12000))}catch(e){}try{require("child_process").execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"})}catch(e){}process.exit(1)},45000);
child.on("error",e=>{clearTimeout(timer);console.error("Smoke process failed to start: "+e.message);process.exit(1)});
child.on("close",code=>{clearTimeout(timer);const log=out+"\n"+err;if(code!==0||/startup failed|uncaught|rejection|Cannot find module|MODULE_NOT_FOUND|smoke test failed/i.test(log)){console.error("PACKAGED SMOKE TEST FAILED");console.error(log.slice(-12000));process.exit(1)}console.log("Packaged integration smoke test passed. SHA256="+sha)});
