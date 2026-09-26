// Central Character Controller + Three.js avatar runtime.
import * as THREE from "../node_modules/three/build/three.module.js";
import {GLTFLoader} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

const canvas=document.getElementById("avatar"),scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,.1,100),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
scene.add(new THREE.HemisphereLight(0xffffff,0x334455,2.2));const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(2,4,3);scene.add(key);
const root=new THREE.Group();scene.add(root);let model=null,mixer=null,clips=[],activeAction=null,clock=new THREE.Clock();
const actions=new Map(),bones=new Map(),boneBase=new Map(),facialMeshes=[];let avatarState="idle",emotion="neutral",facialTime=0,blinkUntil=0,nextBlink=2+Math.random()*4;
let moveTimer=null,moveEnd=0,moveDirection=1,bodyYaw=0,bodyYawTarget=0,gestureTimer=null;
const lookTarget=new THREE.Vector3(0,1.5,1),visemeValues={aa:0,ee:0,oo:0,oh:0,fv:0,mbp:0},visemeTargets={aa:0,ee:0,oo:0,oh:0,fv:0,mbp:0};let visemeTimer=null;
const aliasMap={idle:["idle","stand","breathing"],walk:["walk","walking","locomotion"],talk:["talk","talking","speak"],think:["think","thinking"],listen:["listen","listening"],wave:["wave","waving"],point:["point","pointing"],jump:["jump","jumping"],happy:["happy"],sad:["sad"],alert:["alert","surprised"]};
const morphAliases={aa:["viseme_aa","aa","jawopen","mouthopen"],ee:["viseme_ee","ee"],oo:["viseme_oo","oo","ou"],oh:["viseme_oh","oh"],fv:["viseme_fv","fv"],mbp:["viseme_mbp","mbp","closed"],smile:["smile"],blink:["blink","eyeclose"]};
function normalize(n){return String(n||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
function fitCamera(){const box=new THREE.Box3().setFromObject(root);if(box.isEmpty())return;const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),aspect=Math.max(.2,canvas.clientWidth/Math.max(1,canvas.clientHeight)),vertical=Math.max(size.y,size.x/aspect),distance=(vertical/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))))*1.28;camera.aspect=aspect;camera.position.set(center.x,center.y+size.y*.02,center.z+distance);camera.lookAt(center.x,center.y+size.y*.02,center.z);camera.near=Math.max(.01,distance/100);camera.far=Math.max(100,distance*20);camera.updateProjectionMatrix()}
function findClip(name){const q=normalize(name),names=aliasMap[q]||[q];return clips.find(c=>names.some(n=>normalize(c.name).includes(normalize(n))))}
function play(name,{loop=true,crossFade=.18}={}){if(!mixer)return false;const clip=findClip(name);if(!clip)return false;let a=actions.get(clip.uuid);if(!a){a=mixer.clipAction(clip);actions.set(clip.uuid,a)}if(activeAction&&activeAction!==a)activeAction.fadeOut(crossFade);a.reset().fadeIn(crossFade).setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);if(!loop)a.clampWhenFinished=true;a.play();activeAction=a;return true}
function mapBones(){bones.clear();boneBase.clear();const groups={hips:["hips","pelvis","root"],spine:["spine"],spine1:["spine1"],spine2:["spine2","chest"],neck:["neck"],head:["head"],jaw:["jaw"],leftUpperArm:["leftarm","leftupperarm"],rightUpperArm:["rightarm","rightupperarm"],leftForeArm:["leftforearm","leftlowerarm"],rightForeArm:["rightforearm","rightlowerarm"],leftHand:["lefthand"],rightHand:["righthand"],leftThigh:["leftupleg","leftthigh"],rightThigh:["rightupleg","rightthigh"],leftShin:["leftleg","leftlowerleg"],rightShin:["rightleg","rightlowerleg"],leftFoot:["leftfoot"],rightFoot:["rightfoot"],leftEye:["lefteye"],rightEye:["righteye"]};const all=[];model.traverse(o=>{if(o.isBone)all.push([normalize(o.name),o])});for(const [slot,names] of Object.entries(groups)){const hit=all.find(([n])=>names.some(a=>n.includes(normalize(a))));if(hit){bones.set(slot,hit[1]);boneBase.set(slot,{x:hit[1].rotation.x,y:hit[1].rotation.y,z:hit[1].rotation.z})}}}
function restore(slot){const b=bones.get(slot),base=boneBase.get(slot);if(b&&base)b.rotation.set(base.x,base.y,base.z)}
function rotate(slot,x=0,y=0,z=0){const b=bones.get(slot),base=boneBase.get(slot);if(b&&base)b.rotation.set(base.x+x,base.y+y,base.z+z)}
function collectFace(){facialMeshes.length=0;model.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences)facialMeshes.push(o)})}
function morph(name,value){const v=Math.max(0,Math.min(1,Number(value)||0)),keys=morphAliases[name]||[name];for(const m of facialMeshes)for(const k of keys){const i=m.morphTargetDictionary[k];if(i!==undefined)m.morphTargetInfluences[i]=v}}
function setViseme(n,v){const k=String(n||"").toLowerCase();if(k in visemeTargets)visemeTargets[k]=Math.max(0,Math.min(1,Number(v)||0));else morph(k,v);return true}
function resetVisemes(){Object.keys(visemeTargets).forEach(k=>{visemeTargets[k]=0;visemeValues[k]=0;morph(k,0)});return true}
function playVisemeTimeline(t){if(!Array.isArray(t)||!t.length)return false;if(visemeTimer)clearTimeout(visemeTimer);resetVisemes();const start=performance.now(),items=t.map(x=>({timeMs:Math.max(0,Number(x.timeMs)||0),durationMs:Math.max(30,Number(x.durationMs)||80),viseme:String(x.viseme||"aa").toLowerCase(),value:Math.max(0,Math.min(1,Number(x.value)==null?.8:Number(x.value)))})).sort((a,b)=>a.timeMs-b.timeMs);let i=0;const tick=()=>{const e=performance.now()-start;while(i<items.length&&items[i].timeMs<=e){const x=items[i++];setViseme(x.viseme,x.value);setTimeout(()=>setViseme(x.viseme,0),x.durationMs)}if(i<items.length)visemeTimer=setTimeout(tick,Math.max(12,Math.min(40,items[i].timeMs-e)))};tick();return true}
function blink(){morph("blink",1);blinkUntil=facialTime+.14;return true}
function setExpression(n,v){morph(n,v);return true}
function procedural(t){if(!bones.size)return;const moving=!!(moveTimer&&performance.now()<moveEnd),talk=avatarState==="talk",w=moving?Math.sin(t*10.5):0,s=Math.sin(t*1.7);const walkClip=!!findClip("walk"),talkClip=!!findClip("talk");if(!walkClip&&moving){["leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot","leftUpperArm","rightUpperArm"].forEach(restore);rotate("leftThigh",w*.65);rotate("rightThigh",-w*.65);rotate("leftShin",-Math.max(0,-w)*.8);rotate("rightShin",Math.max(0,w)*.8);rotate("leftFoot",Math.max(0,-w)*.45);rotate("rightFoot",Math.max(0,w)*.45);rotate("leftUpperArm",-w*.28);rotate("rightUpperArm",w*.28)}if(!talkClip&&talk){["leftUpperArm","rightUpperArm","leftForeArm","rightForeArm"].forEach(restore);const p=Math.sin(t*7.5),q=Math.sin(t*5.1+.8);rotate("leftUpperArm",-.12,0,p*.08);rotate("rightUpperArm",-.12,0,-p*.08);rotate("leftForeArm",q*.12);rotate("rightForeArm",-q*.12)}if(!activeAction){restore("spine1");restore("spine2");rotate("spine1",0,0,s*.012);rotate("spine2",0,0,s*.02)}}
function lookAt(x=0,y=1.5,z=1){lookTarget.set(Number(x)||0,Number(y)||1.5,Number(z)||1);const dx=lookTarget.x-root.position.x,dz=lookTarget.z-root.position.z;if(Math.abs(dx)+Math.abs(dz)>.05)bodyYawTarget=Math.atan2(dx,dz);return true}
function setState(s){avatarState=String(s||"idle").toLowerCase();if(avatarState==="stop"||avatarState==="cancel")avatarState="idle";return play(avatarState)||play("idle")}
function setEmotion(e){emotion=String(e||"neutral").toLowerCase();return true}
function move(direction="forward",duration=1200){const d=String(direction).toLowerCase();moveDirection=(d==="left"||d==="backward"||d==="back")?-1:1;bodyYawTarget=d==="left"?-Math.PI/2:d==="right"?Math.PI/2:d==="backward"||d==="back"?Math.PI:bodyYawTarget;play("walk");const ms=Math.max(150,Number(duration)||1200);moveEnd=performance.now()+ms;if(moveTimer)clearTimeout(moveTimer);moveTimer=setTimeout(()=>{moveTimer=null;avatarState="idle";play("idle")},ms);return true}
function gesture(name="wave"){if(gestureTimer)clearTimeout(gestureTimer);const ok=play(name,{loop:false,crossFade:.15});gestureTimer=setTimeout(()=>play(avatarState==="talk"?"talk":"idle"),1200);return ok}
function nod(){const b=bones.get("head"),base=boneBase.get("head");if(b&&base){b.rotation.x=base.x+.12;setTimeout(()=>restore("head"),180);return true}return false}
function stop(){if(moveTimer){clearTimeout(moveTimer);moveTimer=null}avatarState="idle";return play("idle")}
async function applyLoadedAvatar(gltf){
 if(!gltf?.scene)throw new Error("GLB loaded without a scene");
 if(moveTimer){clearTimeout(moveTimer);moveTimer=null}
 root.clear();root.position.set(0,0,0);root.rotation.set(0,0,0);
 model=gltf.scene;root.add(model);model.visible=true;model.position.y=-.95;model.scale.setScalar(1.55);
 model.traverse(o=>{if(o.isObject3D)o.visible=true});
 fitCamera();mapBones();collectFace();mixer=new THREE.AnimationMixer(model);clips=gltf.animations||[];actions.clear();activeAction=null;
 avatarState="idle";emotion="neutral";play("idle");
 window.saeedCharacter?.emit?.("avatar_loaded",{animations:clips.map(x=>x.name),bones:getBones()});
 return true;
}
async function loadAvatar(path="../assets/Saeed_AI-3D.glb"){
 try{
  const gltf=await new GLTFLoader().loadAsync(path);
  return await applyLoadedAvatar(gltf);
 }catch(e){
  console.error("Avatar load failed",e);const s=document.getElementById("status");if(s)s.textContent="Saeed 3D character failed to load";return false;
 }
}
async function loadAvatarData(data){
 try{
  const bytes=data?.data||data;
  if(!bytes)throw new Error("No GLB data received");
  const gltf=await new GLTFLoader().parseAsync(bytes instanceof ArrayBuffer?bytes:bytes.buffer,"");
  return await applyLoadedAvatar(gltf);
 }catch(e){
  console.error("Avatar data load failed",e);const s=document.getElementById("status");if(s)s.textContent="Selected 3D character failed to load";return false;
 }
}
function getBones(){return Object.fromEntries([...bones].map(([k,b])=>[k,b.name]))}
const adapter={setState,move,gesture,lookAt,nod,stop,setEmotion,play,setViseme,playVisemeTimeline,resetVisemes,blink,setExpression,getBones,getAnimations:()=>clips.map(c=>c.name),getFacialTargets:()=>facialMeshes.flatMap(m=>Object.keys(m.morphTargetDictionary||{})),loadAvatar,loadAvatarData};
class CharacterController{
 constructor(a){this.adapter=a;this.state="idle";this.emotion="neutral";this.listeners=new Set();this.look={x:0,y:1.5,z:1};this.activePriority=10;this.timers=new Set();this.priorities={idle:10,listen:20,think:30,talk:40,walk:50,gesture:70,jump:80,stop:100}}
 onChange(fn){if(typeof fn==="function")this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 emit(type,data={}){const e={type,state:this.state,emotion:this.emotion,priority:this.activePriority,...data};for(const f of this.listeners){try{f(e)}catch{}}return e}
 clearTimers(){for(const t of this.timers)clearTimeout(t);this.timers.clear()}
 later(fn,ms){const t=setTimeout(()=>{this.timers.delete(t);fn()},ms);this.timers.add(t);return t}
 priorityFor(n){n=String(n||"").toLowerCase();if(n==="stop"||n==="cancel")return 100;if(n==="jump")return 80;if(["wave","point","greet","hello","nod"].includes(n))return 70;if(n==="walk")return 50;return this.priorities[n]||10}
 command(name,args={}){const n=String(name||"").toLowerCase();if(["idle","rest"].includes(n))return this.setState("idle");if(["listen","listening"].includes(n))return this.setState("listen");if(["think","thinking"].includes(n))return this.setState("think");if(["talk","speaking"].includes(n))return this.setState("talk");if(n==="walk")return this.move(args.direction||"forward",args.duration||1200);if(["stop","cancel"].includes(n))return this.stop();if(n==="nod")return this.nod();if(["look","lookat"].includes(n))return this.lookAt(args.x,args.y,args.z);if(["emotion","mood"].includes(n))return this.setEmotion(args.value||args.mood);return this.action(n,args)}
setState(s){const n=String(s||"idle").toLowerCase();const p=this.priorityFor(n);this.activePriority=p;this.state=n==="stop"||n==="cancel"?"idle":n;this.adapter.setState(this.state);this.emit("state",{value:this.state});return true}
setEmotion(e){this.emotion=String(e||"neutral").toLowerCase();this.adapter.setEmotion(this.emotion);this.emit("emotion",{value:this.emotion});return true}
play(name,args={}){const n=String(name||"").toLowerCase();this.activePriority=args.priority||this.priorityFor(n);if(["idle","listen","think","talk"].includes(n))this.state=n;return this.adapter.play(n,args)}
move(direction="forward",duration=1200){this.activePriority=50;this.state="walk";this.emit("state",{value:"walk"});const ok=this.adapter.move(direction,duration);this.later(()=>{if(this.state==="walk"){this.state="idle";this.activePriority=10;this.adapter.setState("idle");this.emit("state",{value:"idle",reason:"movement_complete")}}},Math.max(150,Number(duration)||1200)+30);return ok}
gesture(name="wave",args={}){this.activePriority=70;this.emit("gesture",{value:name});const ok=this.adapter.gesture(name,args);this.later(()=>{if(this.state!=="talk"&&this.state!=="think"){this.state="idle";this.activePriority=10;this.adapter.setState("idle");this.emit("state",{value:"idle",reason:"gesture_complete"})}},Number(args.duration)||1250);return ok}
nod(){return this.adapter.nod()}
setViseme(name,value){return this.adapter.setViseme(name,value)}
blink(){return this.adapter.blink()}
setExpression(name,value){return this.adapter.setExpression(name,value)}
action(n,args){if(n==="greet"||n==="hello"||n==="wave")return this.gesture("wave",args);if(n==="jump")return this.play("jump",{...args,loop:false,priority:80});return this.gesture(n,args)}
stop(){this.clearTimers();this.adapter.stop();this.state="idle";this.activePriority=10;this.emit("stop");return true}
async loadAvatar(path){const file=await window.saeed?.readCharacter?.(path);if(!file?.ok)return false;const ok=await this.adapter.loadAvatarData?.(file.data);if(ok){this.state="idle";this.activePriority=10;this.emit("avatar_loaded",{path})}return ok}
lookAt(x=0,y=1.5,z=1){this.look={x:Number(x)||0,y:Number(y)||1.5,z:Number(z)||1};this.adapter.lookAt(this.look.x,this.look.y,this.look.z);this.emit("look",{target:{...this.look}});return true}
inspect(){return{state:this.state,emotion:this.emotion,priority:this.activePriority,look:{...this.look},bones:this.adapter.getBones(),animations:this.adapter.getAnimations(),facialTargets:this.adapter.getFacialTargets()}}
}
const character=new CharacterController(adapter);window.saeedCharacter=character;window.saeedAvatar=adapter;
loadAvatar();
function resize(){const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(model)fitCamera()}new ResizeObserver(resize).observe(canvas);resize();
function frame(){requestAnimationFrame(frame);const dt=clock.getDelta();facialTime+=dt;if(mixer)mixer.update(dt);procedural(facialTime);Object.keys(visemeTargets).forEach(k=>{visemeValues[k]+=(visemeTargets[k]-visemeValues[k])*Math.min(1,dt*18);morph(k,visemeValues[k])});bodyYaw+=(bodyYawTarget-bodyYaw)*Math.min(1,dt*4);root.rotation.y=bodyYaw;if(facialTime>=nextBlink){blink();nextBlink=facialTime+2.5+Math.random()*5}if(blinkUntil&&facialTime>=blinkUntil){morph("blink",0);blinkUntil=0}if(moveTimer&&performance.now()<moveEnd){root.position.x+=dt*.22*moveDirection;if(root.position.x>.7)root.position.x=-.7;if(root.position.x<-.7)root.position.x=.7}if(avatarState!=="talk"&&avatarState!=="think")root.position.y+=(Math.sin(facialTime*1.8)*.009-root.position.y)*Math.min(1,dt*2);renderer.render(scene,camera)}frame();