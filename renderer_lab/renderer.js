import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { WebGPURenderer } from "three/webgpu";

const q=new URLSearchParams(location.search),index=q.get("index")||"?",title=q.get("title")||"Renderer",mode=q.get("mode")||"unknown";
document.getElementById("label").textContent=index+". "+title;
if(mode==="backend-status"){
  const label=document.getElementById("label"),status=document.getElementById("status");
  label.textContent="7. Backend Capability Monitor";
  const rows=[["WebGL",!!document.createElement("canvas").getContext("webgl2")||!!document.createElement("canvas").getContext("webgl")],["WebGPU",!!navigator.gpu],["Native DirectX 11","built-in"],["Native OpenGL","built-in"],["Filament","built-in"],["bgfx","shader/compiler probe only"],["Vulkan","device probe only"]];
  status.textContent="Backend verification";
  document.body.innerHTML += `<section style="padding:24px;color:#e8edf3;font:16px system-ui"><h2 style="margin-top:0">Saeed Renderer Backends</h2>${rows.map(([n,v])=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #2a3038"><span>${n}</span><strong>${v===true?"Available":v===false?"Unavailable":v}</strong></div>`).join("")}</section>`;
  throw new Error("backend-status-screen");
}
const canvas=document.getElementById("view"),status=document.getElementById("status");
let renderer;
async function createRenderer(){
  if(mode==="three-webgpu"){
    if(!navigator.gpu){status.textContent="WebGPU unavailable";throw new Error("WebGPU unavailable");}
    renderer=new WebGPURenderer({canvas,antialias:true});
    await renderer.init();
    status.textContent="Three.js WebGPU active";
  }else{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});
    status.textContent="Three.js WebGL active";
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setClearColor(0x101318,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1;
}
const scene=new THREE.Scene();scene.background=new THREE.Color(0x101318);
scene.add(new THREE.HemisphereLight(0xffffff,0x303846,2));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(2,4,3);scene.add(key);
const fill=new THREE.DirectionalLight(0x9bb7ff,1.2);fill.position.set(-3,2,1);scene.add(fill);
const camera=new THREE.PerspectiveCamera(32,1,.01,100);
async function boot(){
  await createRenderer();
  new GLTFLoader().load("saeed.ai.glb",gltf=>{
    const root=gltf.scene;scene.add(root);
    const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),maxDim=Math.max(size.x,size.y,size.z);
    root.position.sub(center);root.position.y+=size.y*.5;
    camera.position.set(0,size.y*.52,Math.max(maxDim*1.8,2.2));camera.lookAt(0,size.y*.5,0);
    root.traverse(o=>{if(o.isMesh){o.frustumCulled=true;if(o.material)o.material.needsUpdate=true;}});
    status.textContent=mode==="three-webgpu"?"Three.js WebGPU + GLB loaded":"Three.js WebGL + GLB loaded";
  },undefined,()=>status.textContent="GLB load failed");
}
function resize(){if(!renderer)return;const w=canvas.clientWidth||1,h=canvas.clientHeight||1;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
window.addEventListener("resize",resize);
boot().catch(e=>{console.error(e);status.textContent="Renderer error: "+(e?.message||e);});
(function frame(){requestAnimationFrame(frame);if(renderer)renderer.render(scene,camera);})();