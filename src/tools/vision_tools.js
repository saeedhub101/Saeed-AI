// vision tool handlers. This module owns only vision capability dispatch.
async function handle(registry,n,a){
 if(n==="vision_observe")return registry.vision.observe();
  
 if(n==="ocr_screen")return registry.vision.ocrScreen();
  
 if(n==="screenshot")return{ok:true,image:await registry.captureScreen()};
  
 if(n==="observe_computer")return registry.computer.observe();
  
 if(n==="verify_state")return registry.verifier.verify(a.kind,a.expected||{},a.before||null,a.after||null);
  
 return undefined;
}
module.exports={handle};
