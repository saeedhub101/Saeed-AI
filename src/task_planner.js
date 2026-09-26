const TOOL_HINTS={
  vision:["screenshot","ocr_screen","vision_observe"],
  computer:["active_window","list_windows","screenshot","observe_computer"],
  code:["project_discover","project_search","project_read_file","project_write_file","project_build","project_test","project_diagnose"],
  verify:["verify_state","vision_observe"],
  recovery:["project_diagnose","project_build","project_test"]
};
class TaskPlanner{
  plan(goal,{dryRun=false}={}) {
    const text=String(goal||"").trim(), l=text.toLowerCase(), steps=[];
    const add=(title,tools=[])=>steps.push({title,tools});
    const has=(...xs)=>xs.some(x=>l.includes(x));
    if(has("code","codebase","project","repository","repo","github","build","compile","debug","bug","error","برنامج","كود","مشروع")) {
      add("Inspect project structure",TOOL_HINTS.code.slice(0,2));
      add("Search relevant code and existing implementation",["project_search","project_read_file"]);
      add("Plan and apply the smallest coherent code change",["project_write_file"]);
      add("Build or run the project's validation command",["project_build","project_test"]);
      add("Diagnose and repair failures if needed",TOOL_HINTS.recovery);
      add("Re-run validation and verify changed behavior",["project_test","verify_state"]);
    } else if(has("screen","screenshot","look","see","visible","ui","واجهة","شاشة","صورة")) {
      add("Inspect current application and screen state",TOOL_HINTS.computer);
      add("Analyze visual content and extract relevant text",["vision_observe","ocr_screen"]);
      add("Perform the requested computer action",["mouse_click","type_text","key_press","ui_automation_action"]);
      add("Re-observe and verify the resulting state",["vision_observe","verify_state"]);
    } else {
      add("Understand the requested goal and inspect current state",["active_window","observe_computer"]);
      add("Execute the next safe action",[]);
      add("Verify the result before continuing",["verify_state"]);
    }
    return {goal:text,mode:dryRun?"dry_run":"execute",createdAt:new Date().toISOString(),steps};
  }
}
module.exports={TaskPlanner};