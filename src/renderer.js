const $=id=>document.getElementById(id),messages=$("messages");
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function markdown(s){let x=escapeHtml(s);x=x.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/\`([^\`]+)\`/g,"<code>$1</code>").replace(/\n/g,"<br>");return x}
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.innerHTML=role==="assistant"?markdown(text):escapeHtml(text).replace(/\n/g,"<br>");messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
let busy=false,pendingImage=null,attachments=[];
async function send(){
 if(busy)return;let t=$("input").value.trim();if(!t&&!attachments.length)return;
 if(attachments.length){t=(t?t+"\n\n":"")+"[مرفقات]\n"+attachments.map(a=>"--- "+a.name+" ---\n"+a.text).join("\n");attachments=[];renderAttachments()}
 busy=true;$("input").value="";add("user",t);$("status").textContent="يفكر...";
 const image=pendingImage;pendingImage=null;
 try{const answer=await window.saeed.chat(t,image);if(answer?.error)add("assistant","حدث خطأ: "+answer.error);else if(answer)add("assistant",answer)}
 catch(e){add("assistant","حدث خطأ: "+e.message)}
 finally{busy=false;$("status").textContent="جاهز"}
}
function renderAttachments(){$("attachments").textContent=attachments.length?attachments.map(a=>a.name).join(" • "):""}
$("send").onclick=send;
$("togglePanel").onclick=()=>{$("panel").classList.toggle("collapsed")};
$("input").ondblclick=()=>window.saeed.showChat();
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
async function showSettings(){const s=await window.saeed.getSettings();if(!s)return;$("provider").value=s.provider||"openrouter";$("baseUrl").value=s.baseUrl||"";$("model").value=s.model||"";$("key").value="";$("key").placeholder=s.hasApiKey?"مفتاح محفوظ — اتركه فارغًا للإبقاء عليه":"أدخل API key";$("steps").value=s.maxSteps||32;$("modal").classList.remove("hidden")}
$("settings").onclick=showSettings;
$("history").onclick=async()=>{const h=await window.saeed.getHistory();const q=$("historySearch").value.trim().toLowerCase();const rows=h.filter(x=>!q||String(x.content||"").toLowerCase().includes(q)).slice().reverse();$("historyList").innerHTML=rows.map(x=>`<div class="historyRow"><b>${x.role==="user"?"أنت":"سعيد"}</b><span>${escapeHtml(String(x.content||"").slice(0,240))}</span></div>`).join("")||"لا توجد نتائج";$("historyModal").classList.remove("hidden")};
$("historySearch").oninput=()=>$("history").click();
$("historyClose").onclick=()=>$("historyModal").classList.add("hidden");
$("save").onclick=async()=>{const payload={provider:$("provider").value,baseUrl:$("baseUrl").value,model:$("model").value,maxSteps:Number($("steps").value)};const key=$("key").value.trim();if(key)payload.apiKey=key;await window.saeed.setSettings(payload);$("modal").classList.add("hidden")};
$("capture").onclick=async()=>{try{pendingImage=await window.saeed.capture();add("tool",pendingImage?"تم التقاط الشاشة. اكتب الآن ما تريد تحليله.":"تعذر التقاط الشاشة.")}catch(e){add("tool","تعذر التقاط الشاشة: "+e.message)}};
window.saeed.onScreenCapture(data=>{if(data){pendingImage=data;add("tool","التقاط الشاشة جاهز للرسالة التالية.")}});
window.saeed.onShowChat(()=>{$("panel").classList.remove("collapsed");$("panel").classList.add("visible")});
window.saeed.onShowSettings(showSettings);
window.saeed.onEvent(e=>{if(e.type==="tool")add("tool","تنفيذ: "+e.name);if(e.type==="tool_error")add("tool","فشل: "+e.name+" — "+e.error);if(e.type==="tool_result")$("status").textContent="تحقق من النتيجة...";if(e.type==="thinking")$("status").textContent="يخطط / ينفذ...";if(e.type==="answer")$("status").textContent="جاهز"});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")});
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