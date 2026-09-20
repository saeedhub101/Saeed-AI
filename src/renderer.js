const $=id=>document.getElementById(id),messages=$("messages");
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.textContent=text;messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
let busy=false;
async function send(){
 if(busy)return;const t=$("input").value.trim();if(!t)return;busy=true;$("input").value="";add("user",t);$("status").textContent="يعمل...";
 try{const answer=await window.saeed.chat(t);if(answer)add("assistant",answer)}catch(e){add("assistant","حدث خطأ: "+e.message)}finally{busy=false;$("status").textContent="جاهز"}
}
$("send").onclick=send;
$("togglePanel").onclick=()=>{$("panel").classList.toggle("collapsed")};
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
$("settings").onclick=async()=>{const s=await window.saeed.getSettings();$("provider").value=s.provider||"openrouter";$("baseUrl").value=s.baseUrl||"";$("model").value=s.model||"";$("key").value=s.apiKey||"";$("steps").value=s.maxSteps||32;$("modal").classList.toggle("hidden")};
$("save").onclick=async()=>{await window.saeed.setSettings({provider:$("provider").value,baseUrl:$("baseUrl").value,model:$("model").value,apiKey:$("key").value,maxSteps:Number($("steps").value)});$("modal").classList.add("hidden")};
$("capture").onclick=async()=>{await window.saeed.capture();add("tool","تم التقاط الشاشة وإرسالها عند طلب التحليل.")};
window.saeed.onEvent(e=>{
 if(e.type==="tool")add("tool","تنفيذ: "+e.name);
 if(e.type==="thinking")$("status").textContent="يفكر / ينفذ...";
 if(e.type==="answer"&&e.text)$("status").textContent="جاهز";
});
window.saeed.onScreenCapture(data=>{if(data)add("tool","التقاط شاشة جاهز للاستخدام في المهمة التالية.")});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")});
let drag=false,ox=0,oy=0,c=$("character");
c.onmousedown=e=>{if(e.button!==0)return;drag=true;ox=e.clientX-c.offsetLeft;oy=e.clientY-c.offsetTop;c.style.cursor="grabbing"};
window.onmousemove=e=>{if(drag){c.style.left=Math.max(0,e.clientX-ox)+"px";c.style.top=Math.max(0,e.clientY-oy)+"px"}};
window.onmouseup=()=>{drag=false;c.style.cursor="grab"};
