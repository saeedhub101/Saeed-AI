import * as THREE from "../node_modules/three/build/three.module.js";
import {GLTFLoader} from "../node_modules/three/examples/jsm/loaders/GLTFLoader.js";

const canvas=document.getElementById("avatar");
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(32,1,.1,100);
camera.position.set(0,1.55,4.2);camera.lookAt(0,1.25,0);
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
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
let avatarState="idle",moveTimer=null,moveEnd=0,moveDirection=1,turnTarget=0;
const aliases={
 idle:["idle","stand","breathing"],
 walk:["walk","walking","locomotion"],
 talk:["talk","talking","speak"],
 think:["think","thinking"],
 happy:["happy","wave"],
 sad:["sad"],
 alert:["alert","surprised"],
};
function findClip(name){
 const q=String(name||"").toLowerCase();
 const names=aliases[q]||[q];
 return clips.find(x=>names.some(n=>x.name.toLowerCase().includes(n)));
}
function stopAllActions(){for(const a of actions.values())a.fadeOut(.12)}
function playAnimation(name,{loop=true,crossFade=.18}={}){
 if(!mixer)return false;
 const clip=findClip(name); if(!clip)return false;
 let action=actions.get(clip.uuid);
 if(!action){action=mixer.clipAction(clip);actions.set(clip.uuid,action);}
 if(activeAction&&activeAction!==action)activeAction.fadeOut(crossFade);
 action.reset().fadeIn(crossFade);
 action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);
 if(!loop)action.clampWhenFinished=true;
 action.play();activeAction=action;return true;
}

let facialMeshes=[];
const visemeAliases={
  aa:["viseme_aa","aa","jawopen","mouthopen"],
  ee:["viseme_ee","ee"],
  oo:["viseme_oo","oo","ou"],
  oh:["viseme_oh","oh"],
  fv:["viseme_fv","fv"],
  mbp:["viseme_mbp","mbp","closed"],
  smile:["smile"],
  blink:["blink","eyeclose"]
};
function collectFacialMeshes(model){
 facialMeshes=[];
 model.traverse(o=>{if(o.isMesh&&o.morphTargetDictionary&&o.morphTargetInfluences)facialMeshes.push(o)});
}
function setMorph(name,value){
 const keys=visemeAliases[name]||[name];
 for(const mesh of facialMeshes){
  for(const key of keys){const i=mesh.morphTargetDictionary[key];if(i!==undefined)mesh.morphTargetInfluences[i]=Math.max(0,Math.min(1,value));}
 }
}
function setViseme(name,value){setMorph(name,value)}
async function loadAvatar(){
 try{
  const gltf=await new GLTFLoader().loadAsync("../assets/avatars/saeed.glb");
  root.clear();const model=gltf.scene;root.add(model);model.position.y=-.95;model.scale.setScalar(1.55);
  collectFacialMeshes(model);mixer=new THREE.AnimationMixer(model);clips=gltf.animations||[];actions.clear();activeAction=null;playAnimation("idle");
 }catch{}
}
loadAvatar();
function setState(state){const next=String(state||"idle").toLowerCase();avatarState=next;if(next==="stop")return playAnimation("idle");return playAnimation(next)||playAnimation("idle")}
function move(direction="forward",duration=1200){const d=String(direction).toLowerCase();moveDirection=(d==="left"||d==="backward"||d==="back")?-1:1;turnTarget=d==="left"?-.45:d==="right"?.45:d==="backward"||d==="back"?Math.PI:0;root.rotation.y=turnTarget;playAnimation("walk");moveEnd=performance.now()+Math.max(150,Number(duration)||1200);if(moveTimer)clearTimeout(moveTimer);moveTimer=setTimeout(()=>{moveTimer=null;avatarState="idle";playAnimation("idle")},Math.max(150,Number(duration)||1200));return true}
function gesture(name="happy"){return playAnimation(name,{loop:false,crossFade:.15})}
window.saeedAvatar={
 setState,
 move,
 stop(){if(moveTimer){clearTimeout(moveTimer);moveTimer=null}avatarState="idle";return playAnimation("idle")},
 turn(direction){const d=String(direction).toLowerCase();root.rotation.y=d==="left"?-.45:d==="right"?.45:0;return true},
 gesture,
 setMood(mood){root.rotation.z=0;root.position.y=mood==="sleep"?-.05:0;root.scale.setScalar(mood==="excited"?1.04:mood==="sad"?.97:1);if(mood==="alert")root.rotation.z=.02;},
 play(name,options){return playAnimation(name,options)},
  stop(){if(activeAction){activeAction.fadeOut(.15);activeAction=null}},
  hasAnimation(name){return Boolean(findClip(name))},\n  getAnimations(){return clips.map(c=>c.name)},
  walk(){return playAnimation("walk")},
  idle(){return playAnimation("idle")},
  talk(){return playAnimation("talk")},
  think(){return playAnimation("think")},
  setViseme,
  setMorph,
  getFacialTargets(){return facialMeshes.flatMap(m=>Object.keys(m.morphTargetDictionary||{}))}
};
function resize(){const r=canvas.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(canvas);resize();
function frame(){requestAnimationFrame(frame);const dt=clock.getDelta();if(mixer)mixer.update(dt);else{root.rotation.y=Math.sin(performance.now()/2600)*.06;root.position.y=Math.sin(performance.now()/900)*.025}if(moveTimer&&performance.now()<moveEnd){root.position.x+=dt*.22*moveDirection;if(root.position.x>.7)root.position.x=-.7;if(root.position.x<-.7)root.position.x=.7}renderer.render(scene,camera)}
frame();