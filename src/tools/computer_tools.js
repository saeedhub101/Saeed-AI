// computer tool handlers. This module owns only computer capability dispatch.
async function handle(registry,n,a){
 if(n==="focus_window")return this.computer.focusWindow(a.pid);
  
 if(n==="open_application")return this.computer.openApp(a.application);
  
 if(n==="mouse_move")return this.computer.mouseMove(a.x,a.y);
  
 if(n==="mouse_click")return this.computer.clickAndObserve(a.x,a.y,a.button||"left");
  
 if(n==="type_text")return this.computer.typeAndObserve(a.text);
  
 if(n==="key_press")return this.computer.keyAndObserve(a.key);
  
 if(n==="run_command")return this.computer.runCommand(a.command,a.workingDirectory||process.cwd());
  
 if(n==="discover_application")return this.appAdapter.discover(a.target);
  
 if(n==="inspect_application_ui")return this.appAdapter.inspectUI(a.pid);
  
 if(n==="ui_automation_action")return this.appAdapter.actUI(a.pid,a.action,a.selector||{});
  
 return undefined;
}
module.exports={handle};
