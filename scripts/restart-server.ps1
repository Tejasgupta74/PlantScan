# Kill any process listening on port 5001 and start the app
$port = 5001
try {
  $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if ($conn) {
    $pids = $conn | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
      Write-Output "Stopping process $pid on port $port"
      Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
  } else {
    Write-Output "No process found on port $port"
  }
} catch {
  Write-Output "Get-NetTCPConnection not available or failed — attempting fallback"
  $proc = Get-Process -Name node -ErrorAction SilentlyContinue
  if ($proc) { $proc | Stop-Process -Force }
}

Write-Output "Starting server: node app.js"
Start-Process -FilePath node -ArgumentList 'app.js' -NoNewWindow
Write-Output "Server start command issued (check terminal)."