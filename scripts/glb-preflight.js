const fs=require("fs"),path=require("path");
const file=path.resolve(__dirname,"../assets/Saeed_AI-3D.glb"),b=fs.readFileSync(file),errors=[];
if(b.length<20)errors.push("GLB is empty or truncated");
if(b.toString("ascii",0,4)!=="glTF")errors.push("Invalid GLB magic header");
if(b.readUInt32LE(4)!==2)errors.push("Unsupported GLB version");
if(b.readUInt32LE(8)!==b.length)errors.push("GLB declared length does not match file size");
let off=12,json=null,bin=false;
while(off+8<=b.length){const len=b.readUInt32LE(off),type=b.readUInt32LE(off+4);off+=8;if(off+len>b.length){errors.push("GLB chunk exceeds file bounds");break}if(type===0x4e4f534a){try{json=JSON.parse(b.toString("utf8",off,off+len).replace(/\u0000+$/g,"").trim())}catch(e){errors.push("GLB JSON chunk is invalid: "+e.message)}}if(type===0x004e4942)bin=true;off+=len}
if(!json)errors.push("GLB JSON chunk missing");
if(json&&(!Array.isArray(json.scenes)||!Array.isArray(json.nodes)))errors.push("GLB scene/node structure missing");
if(json&&(!Array.isArray(json.meshes)||!json.meshes.length))errors.push("GLB contains no mesh");
if(json&&(!Array.isArray(json.nodes)||!json.nodes.some(n=>n.mesh!==undefined)))errors.push("GLB has no node referencing a mesh");
if(!bin)errors.push("GLB binary buffer chunk missing");
if(errors.length){console.error("GLB PREFLIGHT FAILED");for(const e of errors)console.error(" - "+e);process.exit(1)}
console.log("GLB PREFLIGHT PASSED: valid GLB v2, scene/nodes/mesh/binary buffer verified.");