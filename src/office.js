const {execFile}=require("child_process"),{promisify}=require("util");
const run=promisify(execFile);

class OfficeTools{
 async ps(script){
  try{
   const r=await run("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command",script],{windowsHide:true,maxBuffer:16*1024*1024});
   return {ok:true,stdout:r.stdout,stderr:r.stderr};
  }catch(e){return {ok:false,error:e.message,stdout:e.stdout||"",stderr:e.stderr||""}}
 }
 q(v){return "'"+String(v).replace(/'/g,"''")+"'";}
 async excel(action,args={}){
  const file=this.q(args.filePath||"");
  const sheet=this.q(args.sheet||"");
  const cell=this.q(args.cell||"");
  const value=JSON.stringify(args.value===undefined?null:args.value);
  let body="";
  if(action==="inspect"){
   body=`$p=${file};$xl=$null;$wb=$null;try{$xl=New-Object -ComObject Excel.Application;$xl.Visible=$false;$wb=$xl.Workbooks.Open((Resolve-Path $p).Path,$false,$true);$s=@();foreach($ws in $wb.Worksheets){$s+=([pscustomobject]@{name=$ws.Name;usedRange=$ws.UsedRange.Address()})};[pscustomobject]@{ok=$true,path=(Resolve-Path $p).Path,sheets=$s}|ConvertTo-Json -Depth 5 -Compress}finally{if($wb){$wb.Close($false)};if($xl){$xl.Quit()}}`;
  }else if(action==="read_cell"){
   body=`$p=${file};$wsName=${sheet};$addr=${cell};$xl=$null;$wb=$null;try{$xl=New-Object -ComObject Excel.Application;$xl.Visible=$false;$wb=$xl.Workbooks.Open((Resolve-Path $p).Path,$false,$true);$ws=$wb.Worksheets.Item($wsName);$v=$ws.Range($addr).Value2;[pscustomobject]@{ok=$true,value=$v}|ConvertTo-Json -Depth 5 -Compress}finally{if($wb){$wb.Close($false)};if($xl){$xl.Quit()}}`;
  }else if(action==="write_cell"){
   body=`$p=${file};$wsName=${sheet};$addr=${cell};$val=ConvertFrom-Json '${String(value).replace(/'/g,"''")}';$xl=$null;$wb=$null;try{$xl=New-Object -ComObject Excel.Application;$xl.Visible=$false;$wb=$xl.Workbooks.Open((Resolve-Path $p).Path,$false,$false);$ws=$wb.Worksheets.Item($wsName);$ws.Range($addr).Value2=$val;$wb.Save();$check=$ws.Range($addr).Value2;[pscustomobject]@{ok=$true,value=$check,path=(Resolve-Path $p).Path}|ConvertTo-Json -Depth 5 -Compress}finally{if($wb){$wb.Close($false)};if($xl){$xl.Quit()}}`;
  }else if(action==="append_rows"){
   const rows=JSON.stringify(args.rows||[]);
   body=`$p=${file};$wsName=${sheet};$rows=ConvertFrom-Json '${rows.replace(/'/g,"''")}';$xl=$null;$wb=$null;try{$xl=New-Object -ComObject Excel.Application;$xl.Visible=$false;$wb=$xl.Workbooks.Open((Resolve-Path $p).Path,$false,$false);$ws=$wb.Worksheets.Item($wsName);$next=$ws.UsedRange.Row+$ws.UsedRange.Rows.Count;if($ws.UsedRange.Count -eq 1 -and [string]::IsNullOrWhiteSpace([string]$ws.UsedRange.Value2)){$next=1};$r=$next;foreach($row in $rows){$c=1;foreach($v in $row){$ws.Cells.Item($r,$c).Value2=$v;$c++};$r++};$wb.Save();[pscustomobject]@{ok=$true,rowsAdded=$rows.Count}|ConvertTo-Json -Compress}finally{if($wb){$wb.Close($false)};if($xl){$xl.Quit()}}`;
  }else if(action==="create"){
   const out=this.q(args.outputPath||args.filePath||"");
   body=`$out=${out};$xl=New-Object -ComObject Excel.Application;$xl.Visible=$false;$wb=$xl.Workbooks.Add();$ws=$wb.Worksheets.Item(1);$ws.Name='Sheet1';$wb.SaveAs((Resolve-Path (Split-Path $out)).Path+'\\'+(Split-Path $out -Leaf),51);$wb.Close($false);$xl.Quit();[pscustomobject]@{ok=$true,path=$out}|ConvertTo-Json -Compress`;
  }else return {ok:false,error:"Unknown Excel action"};
  return this.ps(body).then(r=>{if(!r.ok)return r;try{return JSON.parse(r.stdout)}catch{return {ok:false,error:r.stderr||r.stdout||"Excel operation failed"}}});
 }
 async word(action,args={}){
  const file=this.q(args.filePath||"");
  if(action!=="read_text"&&action!=="replace_text")return{ok:false,error:"Unknown Word action"};
  const find=JSON.stringify(String(args.findText||"")).replace(/'/g,"''");
  const repl=JSON.stringify(String(args.replaceText||"")).replace(/'/g,"''");
  const script=action==="read_text"
   ? `$p=${file};$w=New-Object -ComObject Word.Application;$d=$w.Documents.Open((Resolve-Path $p).Path,$false,$true);$t=$d.Content.Text;$d.Close();$w.Quit();[pscustomobject]@{ok=$true,text=$t}|ConvertTo-Json -Compress`
   : `$p=${file};$w=New-Object -ComObject Word.Application;$d=$w.Documents.Open((Resolve-Path $p).Path);$f=$d.Content.Find;$f.ClearFormatting();$f.Replacement.ClearFormatting();$f.Text=ConvertFrom-Json '${find}';$f.Replacement.Text=ConvertFrom-Json '${repl}';$null=$f.Execute(\$true,\$false,\$false,\$false,\$false,\$false,\$true,1,\$false,\$null,2);$d.Save();$d.Close();$w.Quit();[pscustomobject]@{ok=$true,path=$p}|ConvertTo-Json -Compress`;
  return this.ps(script).then(r=>{if(!r.ok)return r;try{return JSON.parse(r.stdout)}catch{return{ok:false,error:r.stderr||r.stdout}}});
 }
}
module.exports={OfficeTools};