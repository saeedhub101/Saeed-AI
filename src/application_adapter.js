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
}
module.exports={ApplicationAdapter};