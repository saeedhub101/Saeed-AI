param([int]$Seconds=10)
$ErrorActionPreference="Stop"
function Get-SaeedProcesses {
  $root=@(Get-Process -ErrorAction SilentlyContinue | Where-Object {$_.ProcessName -match '^Saeed( AI)?$|^SaeedAI$'})
  $all=@{}
  $queue=New-Object System.Collections.Generic.Queue[object]
  foreach($p in $root){$all[$p.Id]=$p;$queue.Enqueue($p.Id)}
  while($queue.Count -gt 0){
    $pid=$queue.Dequeue()
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$pid" -ErrorAction SilentlyContinue | ForEach-Object {
      if(-not $all.ContainsKey([int]$_.ProcessId)){
        $p=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
        if($p){$all[$p.Id]=$p;$queue.Enqueue($p.Id)}
      }
    }
  }
  return @($all.Values)
}
function Snapshot {
 $ps=Get-SaeedProcesses
 [pscustomobject]@{
   timestamp=(Get-Date).ToString("o")
   processes=$ps.Count
   ram_mb=[math]::Round((($ps|Measure-Object WorkingSet64 -Sum).Sum/1MB),1)
   cpu_seconds=[math]::Round((($ps|ForEach-Object {$_.CPU}|Measure-Object -Sum).Sum),3)
   pids=($ps|ForEach-Object {$_.Id})
 }
}
$before=Snapshot
Start-Sleep -Seconds $Seconds
$after=Snapshot
$elapsed=$Seconds
$logical=(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors
$cpuPct=[math]::Round((($after.cpu_seconds-$before.cpu_seconds)/$elapsed/$logical)*100,2)
$gpu=0;$gpuAvailable=$false
try {
 $counters=Get-Counter 'GPU Engine(*)Utilization Percentage' -ErrorAction Stop
 foreach($sample in $counters.CounterSamples){
   if($sample.InstanceName -match 'pid_(d+)_'){
     $pid=[int]$Matches[1]
     if($after.pids -contains $pid){$gpu += [double]$sample.CookedValue}
   }
 }
 $gpuAvailable=$true;$gpu=[math]::Round($gpu,2)
}catch{}
$result=[pscustomobject]@{
  sample_seconds=$Seconds
  cpu_percent_total=$cpuPct
  ram_mb=$after.ram_mb
  gpu_percent_total=$gpu
  gpu_counter_available=$gpuAvailable
  process_count=$after.processes
  timestamp=$after.timestamp
}
$result | ConvertTo-Json -Depth 4 | Tee-Object -FilePath "saeed-resource-metrics.json"
if($cpuPct -gt 25){throw "Saeed CPU usage exceeded 25% during idle/resource test: $cpuPct%"}
if($after.ram_mb -gt 700){throw "Saeed RAM usage exceeded 700 MB during idle/resource test: $($after.ram_mb) MB"}
