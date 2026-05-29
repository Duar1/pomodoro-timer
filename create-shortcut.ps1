$desktop = [Environment]::GetFolderPath('Desktop')

# Remove all existing pomodoro shortcuts
@('番茄钟.lnk', 'Pomodoro.lnk', 'PomodoroTomato.lnk') | ForEach-Object {
  $p = Join-Path $desktop $_
  if (Test-Path $p) {
    Remove-Item $p -Force
    Write-Host "Removed: $_"
  }
}

# Clear icon cache
ie4uinit.exe -ClearIconCache

# Brief pause
Start-Sleep -Milliseconds 500

# Create brand new shortcut
$lnk = Join-Path $desktop '番茄钟.lnk'
$shell = New-Object -ComObject WScript.Shell
$s = $shell.CreateShortcut($lnk)
$s.TargetPath = 'C:\\Users\\Lenovo\\Downloads\\FIRST-CC\\node_modules\\electron\\dist\\electron.exe'
$s.Arguments = '.'
$s.WorkingDirectory = 'C:\\Users\\Lenovo\\Downloads\\FIRST-CC'
$s.IconLocation = 'C:\\Users\\Lenovo\\Downloads\\FIRST-CC\\assets\\icon3.ico,0'
$s.Save()

Write-Host "Created: $lnk"