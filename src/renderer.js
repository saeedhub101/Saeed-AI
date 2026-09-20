const $=id=>document.getElementById(id),messages=$("messages");
function add(role,text){const d=document.createElement("div");d.className="msg "+role;d.textContent=text;messages.appendChild(d);messages.scrollTop=messages.scrollHeight}
let busy=false,pendingImage=null;

async function send(){
 if(busy)return;const t=$("input").value.trim();if(!t)return;
 busy=true;$("input").value="";add("user",t);$("status").textContent="يعمل...";
 const image=pendingImage;pendingImage=null;
 try{const answer=await window.saeed.chat(t,image);if(answer)add("assistant",answer)}
 catch(e){add("assistant","حدث خطأ: "+e.message)}
 finally{busy=false;$("status").textContent="جاهز"}
}

$("send").onclick=send;
$("togglePanel").onclick=()=>$("panel").classList.toggle("collapsed");
$("input").onkeydown=e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}};
$("settings").onclick=async()=>{
 const s=await window.saeed.getSettings();if(!s)return;
 $("provider").value=s.provider||"openrouter";$("baseUrl").value=s.baseUrl||"";$("model").value=s.model||"";
 $("key").value="";$("key").placeholder=s.hasApiKey?"مفتاح محفوظ — اتركه فارغًا للإبقاء عليه":"أدخل API key";
 $("steps").value=s.maxSteps||32;$("modal").classList.toggle("hidden");
};
$("save").onclick=async()=>{
 const payload={provider:$("provider").value,baseUrl:$("baseUrl").value,model:$("model").value,maxSteps:Number($("steps").value)};
 const key=$("key").value.trim();if(key)payload.apiKey=key;
 await window.saeed.setSettings(payload);$("modal").classList.add("hidden");
};
$("capture").onclick=async()=>{
 try{pendingImage=await window.saeed.capture();add("tool",pendingImage?"تم التقاط الشاشة. اكتب الآن ما تريد تحليله.":"تعذر التقاط الشاشة.")}
 catch(e){add("tool","تعذر التقاط الشاشة: "+e.message)}
};
window.saeed.onEvent(e=>{
 if(e.type==="tool")add("tool","تنفيذ: "+e.name);
 if(e.type==="thinking")$("status").textContent="يفكر / ينفذ...";
 if(e.type==="answer"&&e.text)$("status").textContent="جاهز";
});
window.saeed.onScreenCapture(data=>{if(data){pendingImage=data;add("tool","التقاط الشاشة جاهز للاستخدام في الرسالة التالية.")}});
$("modal").addEventListener("click",e=>{if(e.target===$("modal"))$("modal").classList.add("hidden")});

let drag=false,ox=0,oy=0,c=$("character");
c.onmousedown=e=>{if(e.button!==0)return;drag=true;ox=e.clientX-c.offsetLeft;oy=e.clientY-c.offsetTop;c.style.cursor="grabbing"};
window.onmousemove=e=>{if(drag){c.style.left=Math.max(0,e.clientX-ox)+"px";c.style.top=Math.max(0,e.clientY-oy)+"px"}};
window.onmouseup=()=>{drag=false;c.style.cursor="grab"};