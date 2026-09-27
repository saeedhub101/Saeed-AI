const fs=require("fs"),http=require("http"),{spawn}=require("child_process"),WebSocket=require("ws");
const exe=process.argv[2];
if(!exe||!fs.existsSync(exe))throw new Error("Packaged Saeed executable not found: "+exe);
const port=9229;
const out=fs.openSync("saeed-e2e-stdout.log","w"),err=fs.openSync("saeed-e2e-stderr.log","w");
const child=spawn(exe,[`--remote-debugging-port=${port}`],{stdio:["ignore",out,err]});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function getJson(path){return new Promise((resolve,reject)=>{const req=http.get({host:"127.0.0.1",port,path},res=>{let b="";res.on("data",d=>b+=d);res.on("end",()=>{try{resolve(JSON.parse(b))}catch(e){reject(e)}})});req.on("error",reject);req.setTimeout(2000,()=>{req.destroy(new Error("timeout"))})})}
async function waitPage(){const end=Date.now()+20000;while(Date.now()<end){try{const pages=await getJson("/json/list");const page=pages.find(x=>x.type==="page"&&x.webSocketDebuggerUrl);if(page)return page}catch{}await sleep(500)}throw new Error("Saeed renderer page did not become available")}
function evaluate(url,expression){return new Promise((resolve,reject)=>{const ws=new WebSocket(url);const timer=setTimeout(()=>{try{ws.close()}catch{};reject(new Error("CDP timeout"))},5000);ws.on("open",()=>ws.send(JSON.stringify({id:1,method:"Runtime.evaluate",params:{expression,returnByValue:true,awaitPromise:true}})));ws.on("message",raw=>{try{const m=JSON.parse(raw);if(m.id===1){clearTimeout(timer);try{ws.close()}catch{};if(m.error)reject(new Error(m.error.message));else resolve(m.result?.result?.value)}}catch{}});ws.on("error",e=>{clearTimeout(timer);reject(e)})})}
(async()=>{let failed=false;try{
 const page=await waitPage();
 const readyEnd=Date.now()+15000;
 let ready=false;
 while(Date.now()<readyEnd){
   try{
     ready=!!(await evaluate(page.webSocketDebuggerUrl,'document.readyState==="complete"&&document.title==="Saeed AI"'));
     if(ready)break;
   }catch{}
   await sleep(300);
 }
 if(!ready)throw new Error("Saeed renderer did not reach the expected document title before timeout");
 const checks=[
  ["title",'document.title==="Saeed AI"'],
  ["chat UI",'!!document.querySelector("#messages")&&!!document.querySelector("#input")&&!!document.querySelector("#send")'],
  ["settings UI",'!!document.querySelector("#settings")&&!!document.querySelector("#modal")&&!!document.querySelector("#provider")'],
  ["microphone controls",'!!document.querySelector("#micAlways")&&!!document.querySelector("#micPush")&&!!document.querySelector("#micOff")'],
  ["agent bridge",'!!window.saeed&&typeof window.saeed.chat==="function"&&typeof window.saeed.getSettings==="function"']
 ];
 for(const [name,expr] of checks){if(!(await evaluate(page.webSocketDebuggerUrl,expr)))throw new Error("Runtime UI check failed: "+name)}
 await evaluate(page.webSocketDebuggerUrl,'document.querySelector("#settings").click();true');
 await sleep(500);
 if(!(await evaluate(page.webSocketDebuggerUrl,'!document.querySelector("#modal").classList.contains("hidden")')))throw new Error("Settings did not open");
 await evaluate(page.webSocketDebuggerUrl,'document.querySelector("#settingsClose").click();true');
 await sleep(300);
 console.log("Windows E2E smoke passed: launch + renderer + IPC bridge + chat UI + settings UI + microphone controls.");
}catch(e){failed=true;console.error("Windows E2E smoke failed:",e.stack||e)}
finally{try{child.kill()}catch{};await sleep(1000);try{process.kill(child.pid)}catch{};if(failed)process.exitCode=1}})();