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
let mixer=null,clips=[],clock=new THREE.Clock();

async function loadAvatar(){
 try{
  const gltf=await new GLTFLoader().loadAsync("../assets/avatars/saeed.glb");
  root.clear();const model=gltf.scene;root.add(model);model.position.y=-.95;model.scale.setScalar(1.55);
  mixer=new THREE.AnimationMixer(model);clips=gltf.animations||[];
 }catch{}
}
loadAvatar();
window.saeedAvatar={
 setMood(mood){root.rotation.z=0;root.position.y=mood==="sleep"?-.05:0;root.scale.setScalar(mood==="excited"?1.04:mood==="sad"?.97:1);if(mood==="alert")root.rotation.z=.02;},
 play(name){if(!mixer)return;const c=clips.find(x=>x.name.toLowerCase().includes(String(name).toLowerCase()));if(c)mixer.clipAction(c).reset().play()}
};
function resize(){const r=canvas.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(canvas);resize();
function frame(){requestAnimationFrame(frame);const dt=clock.getDelta();if(mixer)mixer.update(dt);else{root.rotation.y=Math.sin(performance.now()/2600)*.06;root.position.y=Math.sin(performance.now()/900)*.025}renderer.render(scene,camera)}
frame();