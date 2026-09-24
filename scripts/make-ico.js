const fs=require("fs"),path=require("path"),zlib=require("zlib");
const src=path.join(__dirname,"..","Saeed.png"),out=path.join(__dirname,"..","Saeed.ico"),png=fs.readFileSync(src);
if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error("Saeed.png is not a valid PNG");
let pos=8,w=0,h=0,bit=0,color=0,interlace=0,idat=[];
while(pos<png.length){const len=png.readUInt32BE(pos),type=png.toString("ascii",pos+4,pos+8),data=png.subarray(pos+8,pos+8+len);pos+=12+len;if(type==="IHDR"){w=data.readUInt32BE(0);h=data.readUInt32BE(4);bit=data[8];color=data[9];interlace=data[12]}else if(type==="IDAT")idat.push(data);else if(type==="IEND")break}
if(!w||!h||bit!==8||color!==6||interlace!==0)throw new Error("Saeed.png must be non-interlaced 8-bit RGBA");
const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*4,rgba=Buffer.alloc(w*h*4);let rp=0,prev=Buffer.alloc(stride);
for(let y=0;y<h;y++){const f=raw[rp++],cur=Buffer.alloc(stride);for(let x=0;x<stride;x++){const a=x>=4?cur[x-4]:0,b=prev[x],c=x>=4?prev[x-4]:0,v=raw[rp++];let p=v;if(f===1)p=(v+a)&255;else if(f===2)p=(v+b)&255;else if(f===3)p=(v+Math.floor((a+b)/2))&255;else if(f===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);p=(v+(pa<=pb&&pa<=pc?a:pb<=pc?b:c))&255}else if(f!==0)throw new Error("Unsupported PNG filter "+f);cur[x]=p}cur.copy(rgba,y*stride);prev=cur}
function dib(size){
 const maskRow=Math.ceil(size/32)*4,data=Buffer.alloc(40+size*size*4+maskRow*size);
 data.writeUInt32LE(40,0);data.writeInt32LE(size,4);data.writeInt32LE(size*2,8);data.writeUInt16LE(1,12);data.writeUInt16LE(32,14);
 const sample=(fx,fy)=>{
  const x=Math.max(0,Math.min(w-1,fx)),y=Math.max(0,Math.min(h-1,fy));
  const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(w-1,x0+1),y1=Math.min(h-1,y0+1),tx=x-x0,ty=y-y0;
  const p00=(y0*w+x0)*4,p10=(y0*w+x1)*4,p01=(y1*w+x0)*4,p11=(y1*w+x1)*4;
  const a00=rgba[p00+3]/255,a10=rgba[p10+3]/255,a01=rgba[p01+3]/255,a11=rgba[p11+3]/255;
  const a=a00*(1-tx)*(1-ty)+a10*tx*(1-ty)+a01*(1-tx)*ty+a11*tx*ty;
  const out=[0,0,0,a*255];
  if(a>1e-6)for(let c=0;c<3;c++)out[c]=Math.max(0,Math.min(255,Math.round(((rgba[p00+c]*a00*(1-tx)*(1-ty)+rgba[p10+c]*a10*tx*(1-ty)+rgba[p01+c]*a01*(1-tx)*ty+rgba[p11+c]*a11*tx*ty)/a))));
  return out;
 };
 for(let dy=0;dy<size;dy++)for(let dx=0;dx<size;dx++){
  const sx=(dx+.5)*w/size-.5,sy=(dy+.5)*h/size-.5,p=sample(sx,sy),di=40+((size-1-dy)*size+dx)*4;
  data[di]=p[2];data[di+1]=p[1];data[di+2]=p[0];data[di+3]=Math.round(p[3]);
 }
 return data;
}
const sizes=[16,20,24,28,32,36,40,48,64,96,128,256],images=sizes.map(dib),header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);const entries=[];let offset=6+16*images.length;
for(let i=0;i<sizes.length;i++){const s=sizes[i],e=Buffer.alloc(16);e.writeUInt8(s===256?0:s,0);e.writeUInt8(s===256?0:s,1);e.writeUInt16LE(1,4);e.writeUInt16LE(32,6);e.writeUInt32LE(images[i].length,8);e.writeUInt32LE(offset,12);entries.push(e);offset+=images[i].length}
fs.writeFileSync(out,Buffer.concat([header,...entries,...images]));console.log("Generated valid multi-size Saeed.ico from Saeed.png",w+"x"+h);