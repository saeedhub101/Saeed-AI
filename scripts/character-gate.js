const fs=require("fs"),path=require("path"),{spawn}=require("child_process");
const {listPackage}=require("@electron/asar");
const root=path.resolve(__dirname,".."),dist=path.join(root,"dist"),version=fs.readFileSync(path.join(root,"VERSION"),"utf8").trim(),expected="Saeed.AI.Setup."+version+".0.exe";
const appExe=path.join(dist,"win-unpacked","Saeed AI.exe"),asar=path.join(dist,"win-unpacked","resources","app.asar");
if(!fs.existsSync(appExe)||!fs.existsSync(asar))throw new Error("Packaged application missing");
const entries=listPackage(asar).map(p=>String(p).replace(/\\/g,"/").replace(/^\/+ /,""));
for(const p of ["src/main.js","src/preload.js","src/avatar.js","src/character.html","src/character.css","assets/Saeed_AI-3D.glb"])if(!entries.includes(p))throw new Error("Character package file missing: "+p);
const logFile=path.join(dist,"character-smoke-runtime.log"),userData=path.join(dist,"character-smoke-user-data");
try{fs.rmSync(logFile,{force:true});fs.rmSync(userData,{recursive:true,force:true});fs.mkdirSync(userData,{recursive:true})}catch(e){}
const args=["--no-sandbox","--disable-gpu-sandbox","--user-data-dir="+userData,"--enable-logging=file","--log-file="+logFile];
const child=spawn(appExe,args,{env:{...process.env,SAEED_SMOKE_TEST:"1",SAEED_CHARACTER_ONLY:"1",ELECTRON_ENABLE_LOGGING:"1"},stdio:["ignore","pipe","pipe"],windowsHide:true});
let out="",err="";child.stdout.on("data",d=>out+=d);child.stderr.on("data",d=>err+=d);
const timer=setTimeout(()=>{console.error("CHARACTER SMOKE TEST TIMED OUT AFTER 30S");console.error((out+"\n"+err).slice(-12000));try{require("child_process").execFileSync("taskkill",["/PID",String(child.pid),"/T","/F"],{stdio:"ignore"})}catch(e){}process.exit(1)},30000);
child.on("error",e=>{clearTimeout(timer);console.error("Character smoke failed to start: "+e.message);process.exit(1)});
child.on("close",code=>{clearTimeout(timer);const log=out+"\n"+err;if(code!==0||/startup failed|uncaught|rejection|Cannot find module|MODULE_NOT_FOUND|smoke test failed/i.test(log)){console.error("CHARACTER SMOKE TEST FAILED");console.error(log.slice(-12000));process.exit(1)}console.log("Isolated character renderer smoke test passed.")});
