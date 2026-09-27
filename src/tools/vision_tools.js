// vision tool handlers. This module owns only vision capability dispatch.
async function handle(registry,n,a){
 if(n==="vision_observe")return this.vision.observe();
  
 if(n==="ocr_screen")return this.vision.ocrScreen();
  
 if(n==="screenshot")return{ok:true,image:await this.captureScreen()};
  
 if(n==="observe_computer")return this.computer.observe();
  
 if(n==="verify_state")return this.verifier.verify(a.kind,a.expected||{},a.before||null,a.after||null);
  
 return undefined;
}
module.exports={handle};
