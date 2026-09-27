const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../assets/Saeed_AI-3D.glb");
const b=fs.readFileSync(file),errors=[];

function fail(message){errors.push(message)}
function hasArray(value){return Array.isArray(value)}

if(b.length<12) fail("GLB is empty or truncated");
if(b.length>=4&&b.toString("ascii",0,4)!=="glTF") fail("Invalid GLB magic header");
if(b.length>=8&&b.readUInt32LE(4)!==2) fail("Unsupported GLB version");
if(b.length>=12&&b.readUInt32LE(8)!==b.length) fail("GLB declared length does not match file size");

let off=12,json=null,jsonChunks=0,binChunks=0;
while(errors.length===0&&off<b.length){
  if(off+8>b.length){fail("GLB chunk header is truncated");break}
  const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4);off+=8;
  if(len%4!==0){fail("GLB chunk length is not 4-byte aligned");break}
  if(off+len>b.length){fail("GLB chunk exceeds file bounds");break}
  if(type===0x4e4f534a){
    jsonChunks++;
    try{
      const text=b.toString("utf8",off,off+len).replace(/\u0000+$/g,"").trim();
      json=JSON.parse(text);
    }catch(e){fail("GLB JSON chunk is invalid: "+e.message)}
  }else if(type===0x004e4942){
    binChunks++;
  }
  off+=len;
}
if(off!==b.length) fail("GLB chunk structure does not end at the declared file length");
if(jsonChunks!==1) fail(jsonChunks===0?"GLB JSON chunk missing":"GLB must contain exactly one JSON chunk");
if(json===null||typeof json!=="object"||Array.isArray(json)) fail("GLB JSON root is invalid");

/*
 * Character capabilities are optional. A valid GLB does not need a rig,
 * bones, animation, morph targets, SkinnedMesh, or any particular node names.
 * The only runtime-content requirement is that the asset contains something
 * renderable. For glTF that means at least one mesh primitive referenced by a
 * node. BIN is optional at the format level and is only required when the
 * JSON declares buffers that need external/binary data.
 */
if(json){
  const meshes=hasArray(json.meshes)?json.meshes:[];
  const nodes=hasArray(json.nodes)?json.nodes:[];
  const scenes=hasArray(json.scenes)?json.scenes:[];
  const hasMesh=meshes.some(m=>m&&hasArray(m.primitives)&&m.primitives.length>0);
  const referencedMesh=nodes.some(n=>n&&Number.isInteger(n.mesh)&&n.mesh>=0&&n.mesh<meshes.length);
  if(!hasMesh) fail("GLB contains no renderable mesh primitive");
  if(!referencedMesh) fail("GLB contains no node referencing a renderable mesh");

  if(scenes.length){
    const sceneIndex=Number.isInteger(json.scene)?json.scene:0;
    if(sceneIndex<0||sceneIndex>=scenes.length) fail("GLB default scene index is invalid");
  }

  const buffers=hasArray(json.buffers)?json.buffers:[];
  if(buffers.length){
    if(binChunks===0){
      const externalOnly=buffers.every(x=>x&&typeof x.uri==="string"&&x.uri.length>0);
      if(!externalOnly) fail("GLB declares a buffer that has no embedded BIN chunk");
    }
    const bufferViews=hasArray(json.bufferViews)?json.bufferViews:[];
    for(const v of bufferViews){
      if(!v||!Number.isInteger(v.buffer)||v.buffer<0||v.buffer>=buffers.length){
        fail("GLB contains an invalid bufferView reference");break;
      }
    }
    const accessors=hasArray(json.accessors)?json.accessors:[];
    for(const a of accessors){
      if(a&&a.bufferView!==undefined&&(!Number.isInteger(a.bufferView)||a.bufferView<0||a.bufferView>=bufferViews.length)){
        fail("GLB contains an invalid accessor bufferView reference");break;
      }
    }
  }
}

if(errors.length){
  console.error("GLB PREFLIGHT FAILED");
  for(const e of errors) console.error(" - "+e);
  process.exit(1);
}
console.log("GLB PREFLIGHT PASSED: valid GLB v2 with renderable content; rig/animation/morphs are optional.");
