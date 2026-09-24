const fs=require("fs"),path=require("path");
const src=path.join(__dirname,"..","Saeed.png");
const png=fs.readFileSync(src);
if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error("Saeed.png is not a valid PNG");
const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
if(width<1||height<1)throw new Error("Saeed.png has invalid dimensions");
console.log("Validated Saeed.png",width+"x"+height,"— electron-builder will generate the Windows icon.");
