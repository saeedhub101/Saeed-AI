const fs=require("fs"),path=require("path");
class ApplicationAdapter{
  constructor(computer){this.computer=computer}
  async discover(target=""){
    const q=String(target||"").trim().toLowerCase();
    const windows=(await this.computer.listWindows()).windows||[];
    const matches=windows.filter(w=>!q||String(w.ProcessName||"").toLowerCase().includes(q)||String(w.MainWindowTitle||"").toLowerCase().includes(q));
    const apps=[];
    for(const w of matches.slice(0,12)){
      let info={pid:w.Id,processName:w.ProcessName,title:w.MainWindowTitle,handle:w.MainWindowHandle};
      try{
        const ps=await this.computer.powershell("$p=Get-CimInstance Win32_Process -Filter \"ProcessId="+Number(w.Id)+"\";[pscustomobject]@{path=$p.ExecutablePath;commandLine=$p.CommandLine}|ConvertTo-Json -Compress");
        info={...info,...JSON.parse(ps.stdout||"{}")};
      }catch{}
      info.databaseCandidates=this.findDatabaseCandidates(info.path);
      apps.push(info);
    }
    return {ok:true,target,applications:apps,strategies:["api_or_database","windows_ui_automation","mouse_keyboard","vision_ocr"]};
  }
  findDatabaseCandidates(exe){
    if(!exe)return[];
    const root=path.dirname(exe),out=[];
    const walk=(dir,depth=0)=>{
      if(depth>2||out.length>=40)return;
      let ents=[];try{ents=fs.readdirSync(dir,{withFileTypes:true})}catch{return}
      for(const e of ents){
        if(out.length>=40)break;
        const p=path.join(dir,e.name);
        if(e.isDirectory()&&!["node_modules","cache","temp"].includes(e.name.toLowerCase()))walk(p,depth+1);
        else if(/\.(db|sqlite|sqlite3|mdb|accdb)$/i.test(e.name))out.push(p);
      }
    };
    walk(root);return out;
  }
  async inspectUI(pid){
    const p=Math.round(Number(pid));if(!Number.isFinite(p))return{ok:false,error:"Invalid pid"};
    const script='Add-Type -AssemblyName UIAutomationClient;Add-Type -AssemblyName UIAutomationTypes;$proc=Get-Process -Id '+p+' -ErrorAction Stop;$root=[System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle);if(-not $root){throw "No automation root"};$walker=[System.Windows.Automation.TreeWalker]::ControlViewWalker;$items=New-Object System.Collections.Generic.List[object];$walk={param($el,$depth)if($null -eq $el -or $depth -gt 7 -or $items.Count -ge 1000){return};$name="";$type="";$aid="";$val="";$enabled=$true;$offscreen=$false;$patterns=New-Object System.Collections.Generic.List[string];try{$name=$el.Current.Name;$type=$el.Current.ControlType.ProgrammaticName;$aid=$el.Current.AutomationId;$enabled=$el.Current.IsEnabled;$offscreen=$el.Current.IsOffscreen}catch{};try{$pat=$el.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern);$val=$pat.Current.Value;$patterns.Add("ValuePattern")}catch{};try{$null=$el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern);$patterns.Add("InvokePattern")}catch{};try{$null=$el.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern);$patterns.Add("SelectionItemPattern")}catch{};try{$null=$el.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern);$patterns.Add("TogglePattern")}catch{};try{$pat=$el.GetCurrentPattern([System.Windows.Automation.RangeValuePattern]::Pattern);$val=if([string]::IsNullOrWhiteSpace($val)){[string]$pat.Current.Value}else{$val};$patterns.Add("RangeValuePattern")}catch{};try{$null=$el.GetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern);$patterns.Add("TextPattern")}catch{};$items.Add([pscustomobject]@{name=$name;controlType=$type;automationId=$aid;value=$val;enabled=$enabled;offscreen=$offscreen;patterns=@($patterns);depth=$depth});$child=$walker.GetFirstChild($el);while($child){&$walk $child ($depth+1);$child=$walker.GetNextSibling($child)}};&$walk $root 0;$items|ConvertTo-Json -Depth 8 -Compress';
    try{const r=await this.computer.powershell(script);return{ok:true,pid:p,elements:JSON.parse(r.stdout||"[]")}}catch(e){return{ok:false,error:e.message}}
  }
  async actUI(pid,action="invoke",selector={}){
    const p=Math.round(Number(pid));if(!Number.isFinite(p))return{ok:false,error:"Invalid pid"};
    const safeAction=String(action||"").toLowerCase();
    if(!["invoke","set_value","select","toggle"].includes(safeAction))return{ok:false,error:"Unsupported UI action"};
    const name=String(selector.name||"");
    const aid=String(selector.automationId||"");
    const controlType=String(selector.controlType||"");
    if(!name&&!aid)return{ok:false,error:"A name or automationId selector is required"};
    const value=String(selector.value??"");
    const esc=s=>String(s).replace(/'/g,"''");
    const script='Add-Type -AssemblyName UIAutomationClient;Add-Type -AssemblyName UIAutomationTypes;$proc=Get-Process -Id '+p+' -ErrorAction Stop;$root=[System.Windows.Automation.AutomationElement]::FromHandle($proc.MainWindowHandle);if(-not $root){throw "No automation root"};$items=$root.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.Condition]::TrueCondition);$target=$null;for($i=0;$i -lt $items.Count;$i++){ $el=$items.Item($i);try{$n=$el.Current.Name;$a=$el.Current.AutomationId;$t=$el.Current.ControlType.ProgrammaticName;if((("'+esc(aid)+'" -and $a -eq "'+esc(aid)+'") -or ("'+esc(name)+'" -and $n -eq "'+esc(name)+'")) -and ("'+esc(controlType)+'" -eq "" -or $t -eq "'+esc(controlType)+'")){$target=$el;break}}catch{}};if(-not $target){throw "UI element not found"};if(-not $target.Current.IsEnabled){throw "UI element is disabled"};$result=[ordered]@{action="'+esc(safeAction)+'";name=$target.Current.Name;automationId=$target.Current.AutomationId;controlType=$target.Current.ControlType.ProgrammaticName};switch("'+esc(safeAction)+'"){ "invoke" {$pat=$target.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern);$pat.Invoke();$result.performed=$true} "set_value" {$pat=$target.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern);$pat.SetValue("'+esc(value)+'");$result.performed=$true;$result.value="'+esc(value)+'"} "select" {$pat=$target.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern);$pat.Select();$result.performed=$true} "toggle" {$pat=$target.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern);$pat.Toggle();$result.performed=$true}};$result|ConvertTo-Json -Compress';
    try{const r=await this.computer.powershell(script);return{ok:true,...JSON.parse(r.stdout||"{}")}}catch(e){return{ok:false,error:e.message}}
  }
}
module.exports={ApplicationAdapter};