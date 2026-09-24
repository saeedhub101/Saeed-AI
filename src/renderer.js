const $=id=>document.getElementById(id),messages=$("messages");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function markdown(s){return escapeHtml(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\`([^\`]+)\`/g,"<code>$1</code>").split("\n").join("<br>")}
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.innerHTML=role==="assistant"?markdown(text):escapeHtml(text).split("\n").join("<br>");messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
let busy=false,pendingImage=null,attachments=[],muted=false,micOpen=false,recognition=null,micHadResult=false;
let speechTimer=null,aiProviders=[],aiSettings=null;
const phonemeMap={a:"aa",e:"ee",i:"ee",o:"oh",u:"oo",y:"ee",b:"mbp",m:"mbp",p:"mbp",f:"fv",v:"fv",q:"oh",w:"oo",j:"ee"};
function stopSpeaking(){if("speechSynthesis" in window)window.speechSynthesis.cancel();if(speechTimer){clearInterval(speechTimer);speechTimer=null}["aa","ee","oo","oh","fv","mbp"].forEach(v=>window.saeedAvatar?.setViseme(v,0))}
function speakSaeed(text){
 if(muted||!text||!("speechSynthesis" in window))return;stopSpeaking();
 const clean=String(text).replace(/[ *_#]/g,""),u=new SpeechSynthesisUtterance(clean);u.lang="en-US";u.rate=.98;u.pitch=1;
 const chars=Array.from(clean);let pos=0;u.onstart=()=>{window.saeedAvatar?.play("talk");speechTimer=setInterval(()=>{if(pos>=chars.length){clearInterval(speechTimer);speechTimer=null;return}const ch=chars[pos++],v=phonemeMap[String(ch).toLowerCase()]||"aa";["aa","ee","oo","oh","fv","mbp"].forEach(x=>window.saeedAvatar?.setViseme(x,0));window.saeedAvatar?.setViseme(v,/\s/.test(ch)?0:.72)},Math.max(45,70/u.rate))};
 u.onend=()=>{stopSpeaking();window.saeedAvatar?.play("idle")};u.onerror=()=>{stopSpeaking();window.saeedAvatar?.play("idle")};window.speechSynthesis.speak(u);
}
function updateVoiceUi(){ $("muteBtn").textContent=muted?"Unmute":"Mute";$("micBtn").textContent=micOpen?"Close mic":"Open mic"; }
function showListeningMessage(text){const b=$("notificationBubble");b.textContent=text;b.classList.remove("hidden");setTimeout(()=>b.classList.add("hidden"),3500)}
function updateVoiceUi(){$("muteBtn").textContent=muted?"Unmute":"Mute";$("micBtn").textContent=micOpen?"Stop listening":"Listen";$("listening").classList.toggle("hidden",!micOpen)}
function setupMic(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){$("micBtn").title="Speech recognition is not available in this Electron build.";return false}recognition=new SR();recognition.lang="en-US";recognition.continuous=false;recognition.interimResults=true;recognition.onstart=()=>{micHadResult=false;micOpen=true;updateVoiceUi()};recognition.onresult=e=>{let text="";for(const r of e.results)text+=r[0].transcript;if(e.results[e.results.length-1].isFinal){micHadResult=true;$("input").value=text.trim();if(text.trim())send();else{showListeningMessage("I didn't understand that.");speakSaeed("I didn't understand that.")}}};recognition.onend=()=>{micOpen=false;updateVoiceUi();if(!micHadResult&&!busy){showListeningMessage("I didn't hear anything.");speakSaeed("I didn't hear anything.")}};recognition.onerror=e=>{micOpen=false;updateVoiceUi();if(e.error!=="aborted"){showListeningMessage("I couldn't understand you. Please try again.");speakSaeed("I couldn't understand you. Please try again.")}};return true}
function setMic(open){if(!open){micOpen=false;try{recognition?.stop()}catch{}updateVoiceUi();return}if(!recognition&&!setupMic())return;try{recognition.start()}catch{}}
async function send(){
 if(busy)return;let t=$("input").value.trim();if(!t&&!attachments.length)return;
 if(attachments.length){t=(t?t+"\n\n":"")+"[Attachments]\n"+attachments.map(a=>"--- "+a.name+" ---\n"+a.text).join("\n");attachments=[];renderAttachments()}
 busy=true;$("input").value="";add("user",t);$("status").textContent="Thinking...";
 const image=pendingImage;pendingImage=null;
 try{const answer=await window.saeed.chat(t,image);if(answer?.error)add("assistant","Error: "+answer.error);else if(answer){add("assistant",answer);speakSaeed(answer)}}catch(e){add("assistant","Error: "+e.message)}
 finally{busy=false;$("status").textContent="Ready"}
}
function renderAttachments(){$("attachments").textContent=attachments.length?attachments.map(a=>a.name).join(" • "):""}
function showMenu(){ $("quickMenu").classList.toggle("hidden");window.saeedAvatar?.lookAt(0,1.5,1);window.saeed.setIgnoreMouseEvents(false)}
function faceUser(){window.saeedAvatar?.lookAt(0,1.5,1);window.saeedAvatar?.setState("idle");$("quickMenu").classList.add("hidden")}
async function loadAIProviders(){
 try{
  aiProviders=await window.saeed.getAIProviders();aiSettings=await window.saeed.getAISettings();
  const sel=$("aiProvider");sel.innerHTML=aiProviders.map(p=>`<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join("");
  sel.value=aiSettings.provider||aiProviders[0]?.id||"openrouter";applyProviderUi();
 }catch(e){$("aiStatus").textContent="Could not load AI providers: "+e.message}
}
function applyProviderUi(){const p=aiProviders.find(x=>x.id===$("aiProvider").value);if(!p)return;$("aiModel").value=p.id===aiSettings?.provider?(aiSettings.model||p.model):p.model;$("aiBaseUrl").value=p.id===aiSettings?.provider?(aiSettings.baseUrl||p.baseUrl):p.baseUrl;$("aiKey").value="";$("aiStatus").textContent=aiSettings?.provider===p.id&&aiSettings.hasApiKey?"Connected — saved key is protected on this PC.":"Not connected";$("providerKeyLink").disabled=!p.keyUrl}
$("aiProvider").onchange=applyProviderUi;
$("providerKeyLink").onclick=()=>{const p=aiProviders.find(x=>x.id===$("aiProvider").value);if(p?.keyUrl)window.saeed.openAIProvider(p.keyUrl)};
$("saveAi").onclick=async()=>{const p=aiProviders.find(x=>x.id===$("aiProvider").value);const key=$("aiKey").value;const settings={provider:p.id,model:$("aiModel").value.trim(),baseUrl:$("aiBaseUrl").value.trim(),maxSteps:aiSettings?.maxSteps||32};if(key)settings.apiKey=key;else if(aiSettings?.provider===p.id&&aiSettings.hasApiKey)settings.apiKey="";const result=await window.saeed.saveAISettings(settings);if(result.ok){aiSettings=result.settings;$("aiKey").value="";$("aiStatus").textContent="Connected and saved securely."}else $("aiStatus").textContent=result.error||"Could not save connection."};
$("aiBtn").onclick=async()=>{$("aiPanel").classList.remove("hidden");await loadAIProviders();};
$("closeAi").onclick=()=>$("aiPanel").classList.add("hidden");
loadAIProviders();
$("send").onclick=send;$("muteBtn").onclick=()=>{muted=!muted;if(muted)stopSpeaking();updateVoiceUi()};$("micBtn").onclick=()=>setMic(!micOpen);
$("chatBtn").onclick=()=>window.saeed.showChat();$("changeCharacter").onclick=()=>$("characterFile").click();$("characterFile").onchange=e=>handleCharacterDrop(e.target.files);$("exitBtn").onclick=()=>window.saeed.exit();$("togglePanel").onclick=()=>window.saeed.hideChat();$("history").onclick=()=>{$("notifications").classList.toggle("hidden")};
$("capture").onclick=async()=>{try{pendingImage=await window.saeed.capture();add("tool",pendingImage?"Screen capture ready.":"Screen capture failed.")}catch(e){add("tool","Capture failed: "+e.message)}};
async function openUpdatePanel(){
 $("updatePanel").classList.remove("hidden");$("updateState").textContent="Checking for updates…";$("updateVersion").textContent="Checking…";$("updateBar").style.width="4%";$("updatePercent").textContent="4%";$("updateDetails").textContent="Connecting to GitHub…";$("downloadUpdate").disabled=true;
 try{window.saeed.setIgnoreMouseEvents(false)}catch{}
 let result;
 try{result=await window.saeed.checkForUpdates()}catch(e){result={ok:false,error:e?.message||String(e)}}
 if(!result?.ok){$("updateState").textContent="Update check failed";$("updateDetails").textContent=result?.error||"Could not check for updates.";return}
 if(result.updateAvailable){$("updateState").textContent="Update available";$("updateVersion").textContent="Version "+result.latest+" is available";$("updateBar").style.width="0%";$("updatePercent").textContent="Ready";$("updateDetails").textContent="Current version: "+result.current+" • New version: "+result.latest;$("downloadUpdate").disabled=false;$("openRelease").dataset.url=result.releaseUrl||""}
 else{$("updateState").textContent="You're up to date";$("updateVersion").textContent="Version "+result.current;$("updateBar").style.width="100%";$("updatePercent").textContent="100%";$("updateDetails").textContent="Saeed AI is already using the latest published version.";$("openRelease").dataset.url=result.releaseUrl||""}
}
$("updateBtn").onclick=openUpdatePanel;
$("closeUpdate").onclick=()=>$("updatePanel").classList.add("hidden");
$("openRelease").onclick=()=>{const u=$("openRelease").dataset.url;if(u)window.saeed.openAIProvider(u)};
$("downloadUpdate").onclick=async()=>{ $("downloadUpdate").disabled=true;$("updateState").textContent="Starting update…";$("updateVersion").textContent="Preparing";$("updateBar").style.width="2%";$("updatePercent").textContent="2%";$("updateDetails").textContent="Preparing the Windows installer download…";try{const result=await window.saeed.installUpdate();if(result?.ok){$("updateState").textContent="Installer started";$("updateVersion").textContent="Version "+result.version;$("updateBar").style.width="100%";$("updatePercent").textContent="100%";$("updateDetails").textContent="The installer has started. Saeed will close and the new version will finish installation."}else{throw new Error(result?.error||"The update could not be started.")}}catch(e){$("updateState").textContent="Update failed";$("updateVersion").textContent="Installation did not start";$("updateBar").style.width="0%";$("updatePercent").textContent="Failed";$("updateDetails").textContent=e?.message||String(e);$("downloadUpdate").disabled=false}};
window.saeed.onUpdateProgress(p=>{if(!$("updatePanel").classList.contains("hidden")){const stage=String(p.stage||"preparing");const pct=Math.max(0,Math.min(100,Number(p.percent)||0));const labels={checking:"Checking for updates…",preparing:"Preparing update…",downloading:"Downloading update…",verifying:"Verifying downloaded installer…",ready:"Installer ready",launched:"Installer started",failed:"Update failed"};$("updateState").textContent=labels[stage]||"Updating…";$("updateBar").style.width=pct+"%";$("updatePercent").textContent=stage==="failed"?"Failed":Math.round(pct)+"%";$("updateDetails").textContent=p.message||"";if(stage==="ready")$("downloadUpdate").disabled=false}});

window.saeed.onScreenCapture(data=>{if(data){pendingImage=data;add("tool","Screen capture ready for the next message.")}});
window.saeed.onShowChat(()=>{$("panel").classList.add("visible");window.saeed.setIgnoreMouseEvents(false)});window.saeed.onHideChat(()=>{$("panel").classList.remove("visible");window.saeed.setIgnoreMouseEvents(true)});
window.saeed.onMute(v=>{muted=v;if(v)stopSpeaking();updateVoiceUi()});
window.saeed.onMic(v=>setMic(v));
function addNotification(n){const badge=$("badge");badge.textContent=String(Math.min(99,Number(badge.textContent||0)+1));badge.classList.remove("hidden");const bubble=$("notificationBubble");bubble.textContent=n.title+": "+n.body;bubble.classList.remove("hidden");setTimeout(()=>bubble.classList.add("hidden"),6000);if(!muted)speakSaeed(n.title+". "+n.body);add("tool","Notification: "+n.title+" — "+n.body)}
window.saeed.onNotification(addNotification);
window.saeed.onNotificationList(list=>{if(list.length){$("badge").textContent=String(Math.min(99,list.length));$("badge").classList.remove("hidden");$("notifications").innerHTML=list.map(n=>`<div class="notificationItem"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.body)}</span></div>`).join("");$("notifications").classList.remove("hidden")}});
$("notifications").onclick=async()=>{$("notifications").classList.toggle("hidden");if(!$("notifications").classList.contains("hidden")){const list=await window.saeed.getNotifications();$("notifications").innerHTML=list.map(n=>`<div class="notificationItem"><b>${escapeHtml(n.title)}</b><span>${escapeHtml(n.body)}</span></div>`).join("")}else{await window.saeed.clearNotifications();$("badge").classList.add("hidden")}};
const character=$("character");let dragging=false,lastX=0,lastY=0;
character.addEventListener("mouseenter",()=>window.saeed.setIgnoreMouseEvents(false));character.addEventListener("mouseleave",()=>{if(!$("panel").classList.contains("visible"))window.saeed.setIgnoreMouseEvents(true)});
character.addEventListener("click",e=>{if(e.button===0){faceUser();showMenu()}});
character.addEventListener("dblclick",()=>window.saeed.showChat());
character.addEventListener("mousedown",e=>{if(e.button!==0)return;dragging=true;lastX=e.screenX;lastY=e.screenY;character.classList.add("dragging")});
window.addEventListener("mousemove",e=>{if(!dragging)return;const dx=e.screenX-lastX,dy=e.screenY-lastY;lastX=e.screenX;lastY=e.screenY;window.saeed.moveWindowBy(dx,dy)});
window.addEventListener("mouseup",()=>{dragging=false;character.classList.remove("dragging")});
["dragenter","dragover"].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();character.classList.add("drop")}));
["dragleave","drop"].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();if(ev==="drop")handleCharacterDrop(e.dataTransfer.files);character.classList.remove("drop")}));
async function handleCharacterDrop(files){const file=[...files].find(f=>/\.glb$/i.test(f.name));if(!file)return;try{const result=await window.saeedAvatar?.getController().loadFile(file);add("tool",result?.hasRig?(`Character loaded. Rig detected; pose: ${result.pose}.`):"Character loaded without a detected rig; displayed as imported.");}catch(e){add("tool","Character load failed: "+e.message)}}
$("chatBtn").onclick=()=>window.saeed.showChat();$("capture").onclick=async()=>{pendingImage=await window.saeed.capture();add("tool","Screen capture ready.")};
$("send").onclick=send;$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
updateVoiceUi();setupMic();
