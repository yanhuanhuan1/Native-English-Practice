param(
  [string]$ProjectRoot
)

$ErrorActionPreference = "SilentlyContinue"
$resolvedRoot = (Resolve-Path -LiteralPath $ProjectRoot).Path
$currentPid = $PID
$currentProcess = Get-CimInstance Win32_Process -Filter "ProcessId=$currentPid"
$parentPid = $currentProcess.ParentProcessId

$processes = Get-CimInstance Win32_Process | Where-Object {
  $_.ProcessId -ne $currentPid -and
  $_.ProcessId -ne $parentPid -and
  $_.CommandLine -and
  (
    ($_.CommandLine.Contains($resolvedRoot) -and (
      $_.CommandLine.Contains("next") -or
      $_.CommandLine.Contains("npm") -or
      $_.CommandLine.Contains("node_modules")
    )) -or
    ($_.CommandLine.Contains("next") -and $_.CommandLine.Contains("dev") -and $_.CommandLine.Contains("127.0.0.1"))
  )
}

foreach ($process in $processes) {
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}
