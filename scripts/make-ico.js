const fs=require("fs"),path=require("path");
const src=path.join(__dirname,"..","Saeed.png"),out=path.join(__dirname,"..","Saeed.ico");
const png=fs.readFileSync(src);
if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error("Saeed.png is not a valid PNG");
const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
if(width<1||height<1||width>256||height>256)throw new Error("Saeed.png must be between 1 and 256 pixels for the generated ICO");
const header=Buffer.alloc(6);header.writeUInt16LE(0,0);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);
const entry=Buffer.alloc(16);entry[0]=width===256?0:width;entry[1]=height===256?0:height;entry[2]=0;entry[3]=0;entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);entry.writeUInt32LE(png.length,8);entry.writeUInt32LE(22,12);
fs.writeFileSync(out,Buffer.concat([header,entry,png]));console.log("Generated",out,width+"x"+height);