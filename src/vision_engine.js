const fs=require("fs"),path=require("path");
class VisionEngine{
  constructor({captureScreen,computer,userDataPath}={}){this.captureScreen=captureScreen;this.computer=computer;this.userDataPath=userDataPath||process.cwd()}
  async observe(options={}){
    const image=await this.captureScreen?.();
    if(!image)return{ok:false,error:"Screen capture unavailable"};
    const data=String(image);
    const comma=data.indexOf(",");
    let bytes=Buffer.alloc(0);
    try{if(comma>0)bytes=Buffer.from(data.slice(comma+1),"base64")}catch{}
    const file=path.join(this.userDataPath,"vision-"+Date.now()+".png");
    try{if(bytes.length)fs.writeFileSync(file,bytes)}catch{}
    return{ok:true,kind:"screen_observation",image:data,path:bytes.length?file:null,capturedAt:new Date().toISOString(),note:"Visual observation is time-scoped and must not be treated as current after other actions."};
  }
  async ocrScreen(){
    const observed=await this.observe();
    if(!observed.ok)return observed;
    const candidates=["tesseract.exe","tesseract"];
    for(const exe of candidates){
      try{
        const r=await this.computer.runCommand(exe+" \""+String(observed.path).replace(/"/g,'""')+"\" stdout -l eng+ara",process.cwd());
        if(r.ok&&String(r.stdout||"").trim())return{ok:true,text:String(r.stdout).slice(0,100000),source:observed.path,capturedAt:observed.capturedAt,engine:"tesseract"};
      }catch{}
    }
    return{ok:false,error:"OCR engine is not installed or not available on PATH. The screenshot is still available for multimodal vision analysis.",image:observed.image,path:observed.path,capturedAt:observed.capturedAt};
  }
}
module.exports={VisionEngine};