const $=id=>document.getElementById(id),messages=$("messages");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function markdown(s){let x=escapeHtml(s);x=x.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>").split("\n").join("<br>");return x}
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.innerHTML=role==="assistant"?markdown(text):escapeHtml(text).split("\n").join("<br>");messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
let busy=false,pendingImage=null,attachments=[];
// Voice output + lightweight real-time viseme driver.
let speechTimer=null;
const phonemeMap={a:"aa",e:"ee",i:"ee",o:"oh",u:"oo",y:"ee",b:"mbp",m:"mbp",p:"mbp",f:"fv",v:"fv",q:"oh",w:"oo",j:"ee"};
function visemeForChar(ch){return phonemeMap[String(ch||"").toLowerCase()]||"aa"}
function stopSpeaking(){if("speechSynthesis" in window)window.speechSynthesis.cancel();if(speechTimer){clearInterval(speechTimer);speechTimer=null}["aa","ee","oo","oh","fv","mbp"].forEach(v=>window.saeedAvatar?.setViseme(v,0));}
function speakSaeed(text){
 if(!text||!("speechSynthesis" in window))return;
 stopSpeaking();
 const clean=String(text).replace(/[ *_#]/g,"");
 const u=new SpeechSynthesisUtterance(clean);u.lang="ar-SA";u.rate=.98;u.pitch=1;
 const chars=Array.from(clean);let pos=0,lastIndex=-1;
 u.onstart=()=>{
  window.saeedAvatar?.play("talk");
  speechTimer=setInterval(()=>{
   if(pos>=chars.length){clearInterval(speechTimer);speechTimer=null;return}
   const ch=chars[pos++];lastIndex=pos;
   const v=visemeForChar(ch);
   ["aa","ee","oo","oh","fv","mbp"].forEach(x=>window.saeedAvatar?.setViseme(x,0));
   window.saeedAvatar?.setViseme(v,/\s/.test(ch)?0:.72);
  },Math.max(45,70/u.rate));
 };
 u.onboundary=e=>{
  if(typeof e.charIndex!=="number"||e.charIndex<lastIndex)return;
  pos=Math.min(chars.length,e.charIndex);
 };
 u.onend=()=>{stopSpeaking();window.saeedAvatar?.play("idle")};
 u.onerror=()=>{stopSpeaking();window.saeedAvatar?.play("idle")};
 window.speechSynthesis.speak(u);
}

async function send(){
 if(busy)return;let t=$("input").value.trim();if(!t&&!attachments.length)return;
 if(attachments.length){t=(t?t+"\n\n":"")+"[مرفقات]\n"+attachments.map(a=>"--- "+a.name+" ---\n"+a.text).join("\n");attachments=[];renderAttachments()}
 busy=true;$("input").value="";add("user",t);$("status").textContent="يفكر...";
 const image=pendingImage;pendingImage=null;
 try{const answer=await window.saeed.chat(t,image);if(answer?.error)add("assistant","حدث خطأ: "+answer.error);else if(answer){add("assistant",answer);if(!realtimeConnected)speakSaeed(answer)}}
 catch(e){add("assistant","حدث خطأ: "+e.message)}
 finally{busy=false;$("status").textContent="جاهز"}
}
function renderAttachments(){$("attachments").textContent=attachments.length?attachments.map(a=>a.name).join(" • "):""}
$("send").onclick=send;
$("togglePanel").onclick=()=>{$("panel").classList.toggle("collapsed")};
$("input").ondblclick=()=>window.saeed.showChat();
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
async function showSettings(){const s=await window.saeed.getSettings();if(!s)return;$("provider").value=s.provider||"openrouter";$("baseUrl").value=s.baseUrl||"";$("model").value=s.model||"";$("key").value="";$("key").placeholder=s.hasApiKey?"مفتاح محفوظ — اتركه فارغًا للإبقاء عليه":"أدخل API key";$("steps").value=s.maxSteps||32;$("realtimeModel").value=s.realtimeModel||"gpt-realtime-2.1";$("realtimeVoice").value=s.realtimeVoice||"marin";$("micMode").value=s.micMode||(s.alwaysListening===false?"off":"always");$("speakResponses").checked=s.speakResponses!==false;$("modal").classList.remove("hidden")}
$("settings").onclick=showSettings;
$("history").onclick=async()=>{const h=await window.saeed.getHistory();const q=$("historySearch").value.trim().toLowerCase();const rows=h.filter(x=>!q||String(x.content||"").toLowerCase().includes(q)).slice().reverse();$("historyList").innerHTML=rows.map(x=>`<div class="historyRow"><b>${x.role==="user"?"أنت":"سعيد"}</b><span>${escapeHtml(String(x.content||"").slice(0,240))}</span></div>`).join("")||"لا توجد نتائج";$("historyModal").classList.remove("hidden")};
$("historySearch").oninput=()=>$("history").click();
$("historyClose").onclick=()=>$("historyModal").classList.add("hidden");
$("save").onclick=async()=>{const payload={provider:$("provider").value,baseUrl:$("baseUrl").value,model:$("model").value,maxSteps:Number($("steps").value),realtimeModel:$("realtimeModel").value.trim()||"gpt-realtime-2.1",realtimeVoice:$("realtimeVoice").value,micMode:$("micMode").value,alwaysListening:$("micMode").value==="always",speakResponses:$("speakResponses").checked};const key=$("key").value.trim();if(key)payload.apiKey=key;await window.saeed.setSettings(payload);$("settingsStatus").textContent="تم الحفظ والتطبيق";setTimeout(()=>$("modal").classList.add("hidden"),250)};
$("capture").onclick=async()=>{try{pendingImage=await window.saeed.capture();add("tool",pendingImage?"تم التقاط الشاشة. اكتب الآن ما تريد تحليله.":"تعذر التقاط الشاشة.")}catch(e){add("tool","تعذر التقاط الشاشة: "+e.message)}};
window.saeed.onScreenCapture(data=>{if(data){pendingImage=data;add("tool","التقاط الشاشة جاهز للرسالة التالية.")}});
window.saeed.onShowChat(()=>{$("panel").classList.remove("collapsed");$("panel").classList.add("visible")});
window.saeed.onShowSettings(showSettings);
window.saeed.onEvent(e=>{if(e.type==="tool")add("tool","تنفيذ: "+e.name);if(e.type==="tool_error")add("tool","فشل: "+e.name+" — "+e.error);if(e.type==="tool_result")$("status").textContent="تحقق من النتيجة...";if(e.type==="thinking"){ $("status").textContent="يخطط / ينفذ..."; window.saeedAvatar?.setState("think"); }if(e.type==="tool"){const n=String(e.name||"");if(n==="open_application"||n==="open_url")window.saeedAvatar?.move("forward",900);else if(n==="mouse_move")window.saeedAvatar?.gesture("happy")}if(e.type==="tool_result"){const n=String(e.name||"");if(n==="open_application"||n==="open_url")window.saeedAvatar?.stop()}if(e.type==="answer"){ $("status").textContent="جاهز"; window.saeedAvatar?.setState("talk"); window.saeedAvatar?.nod(); }});
$("settingsClose").onclick=()=>$("modal").classList.add("hidden");$("settingsCancel").onclick=()=>$("modal").classList.add("hidden");$("testRealtime").onclick=async()=>{await window.saeed.startRealtime({});$("settingsStatus").textContent="جاري الاتصال بـ OpenAI Realtime..."};$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")});
const character=$("character");let dragging=false,lastX=0,lastY=0;
character.addEventListener("dblclick",()=>{$("panel").classList.remove("collapsed");$("panel").classList.add("visible");window.saeed.showChat()});
character.addEventListener("mousedown",e=>{if(e.button!==0)return;dragging=true;lastX=e.screenX;lastY=e.screenY;character.classList.add("dragging");e.preventDefault()});
window.addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.screenX-lastX,dy=e.screenY-lastY;lastX=e.screenX;lastY=e.screenY;window.saeed.moveWindowBy(dx,dy)});
window.addEventListener("mouseup",()=>{dragging=false;character.classList.remove("dragging")});
["dragenter","dragover"].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();character.classList.add("drop")}));
["dragleave","drop"].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();if(ev==="drop")handleDrop(e.dataTransfer.files);character.classList.remove("drop")}));
async function handleDrop(files){let total=attachments.reduce((n,a)=>n+a.size,0);for(const f of [...files]){if(!/^(text\/(plain|csv|markdown)|application\/json|application\/xml)/i.test(f.type)&&!/[.](txt|md|csv|json|xml|log)$/i.test(f.name))continue;if(f.size>256*1024||total+f.size>1024*1024)continue;const text=await f.text();attachments.push({name:f.name,text,size:f.size});total+=f.size}renderAttachments()}
let moodTimer=setInterval(()=>{if(!busy){const moods=["neutral","happy","curious","sleep","excited","thinking","sad","alert"];const mood=moods[Math.floor(Math.random()*moods.length)];window.saeedAvatar?.setMood(mood)}},12000);
window.saeed.onConfirmation(async e=>{const label={write_file:"تعديل ملف",remove_task:"حذف مهمة",mouse_click:"نقرة بالماوس",type_text:"كتابة نص",key_press:"ضغط مفتاح"}[e.name]||e.name;const ok=confirm(`سعيد يريد تنفيذ: ${label}\n\n${JSON.stringify(e.args,null,2)}\n\nهل تسمح؟`);await window.saeed.respondConfirmation(e.id,ok);});
class RealtimeMic {
 constructor(){this.stream=null;this.ctx=null;this.source=null;this.processor=null;this.active=false;this.mode="always";this.playCtx=null;this.nextPlayTime=0}
 async start(mode="always"){
  this.mode=mode;
  if(mode==="off"){this.stop();return}
  if(this.active)return;
  this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true,channelCount:1}});
  this.ctx=new AudioContext();
  this.source=this.ctx.createMediaStreamSource(this.stream);
  this.processor=this.ctx.createScriptProcessor(4096,1,1);
  this.processor.onaudioprocess=e=>{
   if(!this.active)return;
   const input=e.inputBuffer.getChannelData(0);
   const ratio=24000/this.ctx.sampleRate;
   const n=Math.max(1,Math.floor(input.length*ratio));
   const pcm=new Int16Array(n);
   for(let i=0;i<n;i++){const x=input[Math.min(input.length-1,Math.floor(i/ratio))];pcm[i]=Math.max(-1,Math.min(1,x))*32767}
   let binary="";const bytes=new Uint8Array(pcm.buffer);for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+0x8000,bytes.length)));
   window.saeed.sendRealtimeAudio(btoa(binary));
  };
  this.source.connect(this.processor);
  const mute=this.ctx.createGain();
  mute.gain.value=0;
  this.processor.connect(mute);
  mute.connect(this.ctx.destination);
  this.monitorGain=mute;
  this.active=true;
 }
 stop(){this.active=false;try{this.processor?.disconnect()}catch{}
  try{this.monitorGain?.disconnect()}catch{}
  try{this.source?.disconnect()}catch{}
  try{this.stream?.getTracks().forEach(t=>t.stop())}catch{}
  try{this.ctx?.close()}catch{}
  this.monitorGain=null;
  this.processor=null;this.source=null;this.stream=null;this.ctx=null;window.saeed.stopRealtime()}
 playPCM(base64){
  try{
   if(!this.playCtx)this.playCtx=new AudioContext();
   const raw=atob(base64),pcm=new Int16Array(raw.length/2);for(let i=0;i<pcm.length;i++)pcm[i]=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);
   const buffer=this.playCtx.createBuffer(1,pcm.length,24000),ch=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)ch[i]=pcm[i]/32768;
   const src=this.playCtx.createBufferSource();src.buffer=buffer;src.connect(this.playCtx.destination);
   const now=this.playCtx.currentTime;this.nextPlayTime=Math.max(now,this.nextPlayTime);src.start(this.nextPlayTime);this.nextPlayTime+=buffer.duration;
   window.saeedAvatar?.play("talk");
   src.onended=()=>{if(this.playCtx.currentTime>=this.nextPlayTime-.02)window.saeedAvatar?.play("idle")};
  }catch(e){console.warn("Realtime audio playback failed",e)}
 }
}
const realtimeMic=new RealtimeMic();
let realtimeAssistant="";
let realtimeConnected=false;
window.saeed.onRealtimeState(async(state,message)=>{
 const badge=$("micBadge");badge.className="micBadge "+state;
 realtimeConnected=state==="connected";
 $("status").textContent=state==="connected"?"يستمع الآن":state==="connecting"?"يتصل بالصوت...":state==="not-configured"?"أدخل OpenAI API key":"الصوت: "+state;
 if(state==="connected"){const cfg=await window.saeed.getSettings();const mode=cfg?.micMode||(cfg?.alwaysListening===false?"off":"always");if(mode!=="off")try{await realtimeMic.start(mode)}catch(e){$("status").textContent="تعذر تشغيل المايك: "+e.message}}
});
window.saeed.onRealtimeAudio(b=>realtimeMic.playPCM(b));
window.saeed.onRealtimeAssistantDelta(t=>{realtimeAssistant+=t;window.saeedAvatar?.play("talk");});
window.saeed.onRealtimeAssistantFinal(t=>{if(t){add("assistant",t);realtimeAssistant="";}});
window.saeed.onRealtimeUserFinal(t=>{if(t&&$("input").value.trim()==="")add("user",t)});
window.saeed.onRealtimeError(e=>{console.error("Realtime:",e);$("status").textContent="Realtime: "+e});
window.addEventListener("load",async()=>{try{const cfg=await window.saeed.getSettings();const mode=cfg?.micMode||(cfg?.alwaysListening===false?"off":"always");if(cfg?.apiKey&&mode!=="off")await window.saeed.startRealtime({});}catch(e){console.warn("Realtime startup:",e)}});
