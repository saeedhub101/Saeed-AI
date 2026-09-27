// computer tool handlers. Execution ownership stays in ToolRegistry; this module only groups related tools.
async function handle(registry,n,a){
 if(n==="focus_window")return this.computer.focusWindow(a.pid);
 if(n==="open_application")return this.computer.openApp(a.application);
 return undefined;
}
module.exports={handle};
