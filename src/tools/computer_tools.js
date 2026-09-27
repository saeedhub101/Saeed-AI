// computer tool handlers. This module owns only computer capability dispatch.
async function handle(registry,n,a){
 if(n==="focus_window")return registry.computer.focusWindow(a.pid);
  
 if(n==="open_application")return registry.computer.openApp(a.application);
  
 if(n==="mouse_move")return registry.computer.mouseMove(a.x,a.y);
  
 if(n==="mouse_click")return registry.computer.clickAndObserve(a.x,a.y,a.button||"left");
  
 if(n==="type_text")return registry.computer.typeAndObserve(a.text);
  
 if(n==="key_press")return registry.computer.keyAndObserve(a.key);
  
 if(n==="run_command")return registry.computer.runCommand(a.command,a.workingDirectory||process.cwd());
  
 if(n==="discover_application")return registry.appAdapter.discover(a.target);
  
 if(n==="inspect_application_ui")return registry.appAdapter.inspectUI(a.pid);
  
 if(n==="ui_automation_action")return registry.appAdapter.actUI(a.pid,a.action,a.selector||{});
  
 return undefined;
}
module.exports={handle};
