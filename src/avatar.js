import * as THREE from "three";
import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";

const canvas=document.getElementById("avatar");
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,.1,100);
camera.position.set(0,1.55,4.2);camera.lookAt(0,1.25,0);
let renderer=null;
let rendererBackend="initializing";
async function initRenderer(){
 try{
  const candidate=new THREE.WebGPURenderer({canvas,alpha:true,antialias:true,premultipliedAlpha:false});
  await candidate.init();
  renderer=candidate;
  rendererBackend="WebGPU";
 }catch(error){
  console.warn("WebGPU renderer unavailable; using WebGL2 fallback.",error);
  renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,premultipliedAlpha:false});
  rendererBackend="WebGL2";
 }
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));
 renderer.setClearColor(0,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 window.saeedAvatarBackend=()=>rendererBackend;
}
scene.add(new THREE.HemisphereLight(0xffffff,0x334455,2.2));
const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(2,4,3);scene.add(key);

const root=new THREE.Group();scene.add(root);
const mat=new THREE.MeshStandardMaterial({color:0x3f6fbd,roughness:.55,metalness:.05});
function part(g,p,s){const m=new THREE.Mesh(g,mat);m.position.set(...p);m.scale.set(...s);root.add(m);return m}
part(new THREE.SphereGeometry(.46,32,20),[0,1.82,0],[1,1.08,.95]);
part(new THREE.CapsuleGeometry(.28,.75,8,16),[0,.95,0],[1.15,1.15,.8]);
part(new THREE.CapsuleGeometry(.11,.75,8,12),[-.52,1.0,0],[1,1,1]);
part(new THREE.CapsuleGeometry(.11,.75,8,12),[.52,1.0,0],[1,1,1]);
part(new THREE.CapsuleGeometry(.13,.8,8,12),[-.18,.05,0],[1,1,1]);
part(new THREE.CapsuleGeometry(.13,.8,8,12),[.18,.05,0],[1,1,1]);
const eyeMat=new THREE.MeshBasicMaterial({color:0xffffff});
for(const x of [-.16,.16]){const e=new THREE.Mesh(new THREE.SphereGeometry(.075,16,12),eyeMat);e.position.set(x,1.88,.43);root.add(e)}

let mixer=null,clips=[],actions=new Map(),activeAction=null,clock=new THREE.Clock();
let avatarState="idle",moveTimer=null,moveEnd=0,moveDirection=1,bodyYaw=0,bodyYawTarget=0,gestureTimer=null;
let facialTime=0,blinkUntil=0,nextBlink=2+Math.random()*4,expression={smile:0,jawopen:0};
let visemeValues={aa:0,ee:0,oo:0,oh:0,fv:0,mbp:0},visemeTargets={aa:0,ee:0,oo:0,oh:0,fv:0,mbp:0},visemeTimer=null;
let model=null,bones=new Map(),boneBase=new Map();
const lookTarget=new THREE.Vector3(0,1.5,1);

const aliases={
 idle:["idle","stand","breathing"],walk:["walk","walking","locomotion"],talk:["talk","talking","speak"],
 think:["think","thinking"],happy:["happy","wave"],sad:["sad"],alert:["alert","surprised"]
};
function findClip(name){
 const q=String(name||"").toLowerCase(),names=aliases[q]||[q];
 return clips.find(x=>names.some(n=>x.name.toLowerCase().includes(n)));
}
function playAnimation(name,{loop=true,crossFade=.18}={}){
 if(!mixer)return false;
 const clip=findClip(name);if(!clip)return false;
 let action=actions.get(clip.uuid);
 if(!action){action=mixer.clipAction(clip);actions.set(clip.uuid,action)}
 if(activeAction&&activeAction!==action)activeAction.fadeOut(crossFade);
 action.reset().fadeIn(crossFade);action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
 if(!loop)action.clampWhenFinished=true;action.play();activeAction=action;return true;
}

let facialMeshes=[];
const visemeAliases={
 aa:["viseme_aa","aa","jawopen","mouthopen"],ee:["viseme_ee","ee"],oo:["viseme_oo","oo","ou"],
 oh:["viseme_oh","oh"],fv:["viseme_fv","fv"],mbp:["viseme_mbp","mbp","closed"],
 smile:["smile"],blink:["blink","eyeclose"]
};
function mapHumanoidBones(model){
 bones.clear();boneBase.clear();
 const aliases={
  hips:["hips","pelvis","root"],spine:["spine","spine1","spine2","chest"],chest:["chest","upperchest"],
  neck:["neck"],head:["head"],jaw:["jaw","jawbone"],
  leftUpperArm:["leftarm","leftupperarm","upperarm_l","lupperarm"],rightUpperArm:["rightarm","rightupperarm","upperarm_r","rupperarm"],
  leftForeArm:["leftforearm","leftlowerarm","forearm_l","lowerarm_l"],rightForeArm:["rightforearm","rightlowerarm","forearm_r","lowerarm_r"],
  leftHand:["lefthand","hand_l"],rightHand:["righthand","hand_r"],
  leftThigh:["leftupleg","leftthigh","thigh_l","upperleg_l"],rightThigh:["rightupleg","rightthigh","thigh_r","upperleg_r"],
  leftShin:["leftleg","leftlowerleg","calf_l","shin_l"],rightShin:["rightleg","rightlowerleg","calf_r","shin_r"],
  leftFoot:["leftfoot","foot_l"],rightFoot:["rightfoot","foot_r"]
 };
 const all=[];model.traverse(o=>{if(o.isBone)all.push([o.name.toLowerCase().replace(/[^a-z0-9]/g,""),o])});
 for(const [slot,names] of Object.entries(aliases)){
  const hit=all.find(([n])=>names.some(a=>n.includes(a.replace(/[^a-z0-9]/g,""))));
  if(hit){bones.set(slot,hit[1]);boneBase.set(slot,{x:hit[1].rotation.x,y:hit[1].rotation.y,z:hit[1].rotation.z})}
 }
 return Object.fromEntries([...bones].map(([k,b])=>[k,b.name]));
}
function restoreBone(slot){
 const b=bones.get(slot),base=boneBase.get(slot);if(b&&base)b.rotation.set(base.x,base.y,base.z);
}
function addBoneRotation(slot,x=0,y=0,z=0){
 const b=bones.get(slot),base=boneBase.get(slot);if(!b||!base)return;
 b.rotation.x=base.x+x;b.rotation.y=base.y+y;b.rotation.z=base.z+z;
}
function proceduralBody(t){
 if(!bones.size)return;
 const moving=Boolean(moveTimer&&performance.now()<moveEnd),talking=avatarState==="talk",w=moving?Math.sin(t*10.5):0,sway=Math.sin(t*1.7);
 ["leftUpperArm","rightUpperArm","leftForeArm","rightForeArm","leftThigh","rightThigh","leftShin","rightShin","leftFoot","rightFoot","spine","chest"].forEach(restoreBone);
 if(moving){
  addBoneRotation("leftThigh",w*.65);addBoneRotation("rightThigh",-w*.65);
  addBoneRotation("leftShin",-Math.max(0,-w)*.8);addBoneRotation("rightShin",Math.max(0,w)*.8);
  addBoneRotation("leftFoot",Math.max(0,-w)*.45);addBoneRotation("rightFoot",Math.max(0,w)*.45);
  addBoneRotation("leftUpperArm",-w*.28);addBoneRotation("rightUpperArm",w*.28);
 }
 addBoneRotation("spine",0,0,sway*.018);addBoneRotation("chest",0,0,sway*.025);
 if(talking){
  const p=Math.sin(t*7.5),q=Math.sin(t*5.1+.8);
  addBoneRotation("leftUpperArm",-.12,0,p*.08);addBoneRotation("rightUpperArm",-.12,0,-p*.08);
  addBoneRotation("leftForeArm",q*.12);addBoneRotation("rightForeArm",-q*.12);
 }
}
function collectFacialMeshes(model){
 facialMeshes=[];model.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences)facialMeshes.push(o)});
}
function setMorph(name,value){
 const keys=visemeAliases[name]||[name],v=Math.max(0,Math.min(1,Number(value)||0));
 for(const mesh of facialMeshes)for(const key of keys){const i=mesh.morphTargetDictionary[key];if(i!==undefined)mesh.morphTargetInfluences[i]=v}
}
function setViseme(name,value){const k=String(name||"").toLowerCase();if(visemeTargets[k]!==undefined)visemeTargets[k]=Math.max(0,Math.min(1,Number(value)||0));else setMorph(k,value)}
function playVisemeTimeline(timeline){
 if(!Array.isArray(timeline)||!timeline.length)return false;
 if(visemeTimer)clearTimeout(visemeTimer);
 resetVisemes();
 const started=performance.now();
 const items=timeline.map(x=>({timeMs:Math.max(0,Number(x.timeMs)||0),durationMs:Math.max(30,Number(x.durationMs)||80),viseme:String(x.viseme||"aa").toLowerCase(),value:Math.max(0,Math.min(1,Number(x.value)==null?0.8:Number(x.value)))})).sort((a,b)=>a.timeMs-b.timeMs);
 let i=0;
 const tick=()=>{
  const elapsed=performance.now()-started;
  while(i<items.length&&items[i].timeMs<=elapsed){
   const item=items[i++];
   setViseme(item.viseme,item.value);
   setTimeout(()=>setViseme(item.viseme,0),item.durationMs);
  }
  if(i<items.length)visemeTimer=setTimeout(tick,Math.max(12,Math.min(40,items[i].timeMs-elapsed)));
  else visemeTimer=null;
 };
 tick();return true;
}
function setExpression(name,value){expression[String(name).toLowerCase()]=Math.max(0,Math.min(1,Number(value)||0));setMorph(name,value);return true}
function blink(){setMorph("blink",1);blinkUntil=facialTime+.14;return true}
function resetVisemes(){["aa","ee","oo","oh","fv","mbp"].forEach(v=>{visemeTargets[v]=0;visemeValues[v]=0;setMorph(v,0)});return true}

async function loadAvatar(){
 try{
  const gltf=await new GLTFLoader().loadAsync("../assets/Saeed_AI-3D.glb");
  root.clear();model=gltf.scene;root.add(model);model.position.y=-.95;model.scale.setScalar(1.55);
  mapHumanoidBones(model);collectFacialMeshes(model);mixer=new THREE.AnimationMixer(model);clips=gltf.animations||[];actions.clear();activeAction=null;playAnimation("idle");
 }catch(e){console.warn("Avatar GLB not loaded:",e)}
}
function smoothTurnTo(yaw){
 bodyYawTarget=Number(yaw)||0;
}
function setState(state){
 const next=String(state||"idle").toLowerCase();avatarState=next;
 if(next==="stop"){avatarState="idle";return playAnimation("idle")}
 return playAnimation(next)||playAnimation("idle");
}
function move(direction="forward",duration=1200){
 const d=String(direction).toLowerCase();
 moveDirection=(d==="left"||d==="backward"||d==="back")?-1:1;
 smoothTurnTo(d==="left"?-Math.PI/2:d==="right"?Math.PI/2:d==="backward"||d==="back"?Math.PI:bodyYawTarget);
 playAnimation("walk");
 const ms=Math.max(150,Number(duration)||1200);moveEnd=performance.now()+ms;
 if(moveTimer)clearTimeout(moveTimer);
 moveTimer=setTimeout(()=>{moveTimer=null;avatarState="idle";playAnimation("idle")},ms);
 return true;
}
function gesture(name="happy"){
 if(gestureTimer)clearTimeout(gestureTimer);
 const ok=playAnimation(name,{loop:false,crossFade:.15});
 gestureTimer=setTimeout(()=>playAnimation(avatarState==="talk"?"talk":"idle"),1200);return ok;
}
function lookAt(x=0,y=1.5,z=1){
 lookTarget.set(Number(x)||0,Number(y)||1.5,Number(z)||1);
 const dx=lookTarget.x-root.position.x,dz=lookTarget.z-root.position.z;
 if(Math.abs(dx)+Math.abs(dz)>.05)smoothTurnTo(Math.atan2(dx,dz));
 return true;
}
function turn(direction){
 const d=String(direction).toLowerCase();
 const yaw=d==="left"?bodyYaw-Math.PI/2:d==="right"?bodyYaw+Math.PI/2:d==="back"||d==="backward"?bodyYaw+Math.PI:Number(direction)||0;
 smoothTurnTo(yaw);return true;
}
function nod(){
 const head=bones.get("head"),base=boneBase.get("head");
 if(head&&base){head.rotation.x=base.x+.12;setTimeout(()=>head.rotation.set(base.x,base.y,base.z),180);return true;}
 const base=root.rotation.x;root.rotation.x=base+.12;setTimeout(()=>root.rotation.x=base,180);return true;
}
window.saeedAvatar={
 setState,move,turn,gesture,lookAt,nod,
 stop(){if(moveTimer){clearTimeout(moveTimer);moveTimer=null}avatarState="idle";return playAnimation("idle")},
 setMood(mood){root.rotation.z=0;root.position.y=mood==="sleep"?-.05:0;root.scale.setScalar(mood==="excited"?1.04:mood==="sad"?.97:1);if(mood==="alert")root.rotation.z=.02},
 play(name,options){return playAnimation(name,options)},
 hasAnimation(name){return Boolean(findClip(name))},
 getAnimations(){return clips.map(c=>c.name)},
 getBones(){return Object.fromEntries([...bones].map(([k,b])=>[k,b.name]))},
 walk(){return playAnimation("walk")},idle(){return playAnimation("idle")},talk(){return playAnimation("talk")},think(){return playAnimation("think")},
 setViseme,playVisemeTimeline,resetVisemes,setExpression,blink,setMorph,
 getFacialTargets(){return facialMeshes.flatMap(m=>Object.keys(m.morphTargetDictionary||{}))}
};

function resize(){
 if(!renderer)return;
 const r=canvas.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

async function startRenderer(){
 await initRenderer();
 resize();
 await loadAvatar();
 renderer.setAnimationLoop(frame);
}
startRenderer();

function frame(){
 const dt=clock.getDelta();facialTime+=dt;
 proceduralBody(facialTime);
 Object.keys(visemeTargets).forEach(k=>{visemeValues[k]+=(visemeTargets[k]-visemeValues[k])*Math.min(1,dt*18);setMorph(k,visemeValues[k])});
 if(mixer)mixer.update(dt);
 else root.position.y=Math.sin(performance.now()/900)*.025;
 if(moveTimer&&performance.now()<moveEnd){
  root.position.x+=dt*.22*moveDirection;
  if(root.position.x>.7)root.position.x=-.7;
  if(root.position.x<-.7)root.position.x=.7;
 }
 bodyYaw+=(bodyYawTarget-bodyYaw)*Math.min(1,dt*4);
 root.rotation.y=bodyYaw;
 if(facialTime>=nextBlink){blink();nextBlink=facialTime+2.5+Math.random()*5}
 if(blinkUntil&&facialTime>=blinkUntil){setMorph("blink",0);blinkUntil=0}
 if(avatarState!=="talk"&&avatarState!=="think"){
  const breathe=(Math.sin(facialTime*1.8)+1)*.5;
  root.position.y+=(breathe*.018-root.position.y)*Math.min(1,dt*2);
 }
 renderer.render(scene,camera);
}
frame();