const fs = require('fs');
const path = require('path');

const projectDir = __dirname;
const electronExe = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
const icoPath = path.join(__dirname, 'assets', 'icon3.ico');

const psContent = `$desktop = [Environment]::GetFolderPath('Desktop')

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
$s.TargetPath = '${electronExe.replace(/\\/g, '\\\\')}'
$s.Arguments = '.'
$s.WorkingDirectory = '${projectDir.replace(/\\/g, '\\\\')}'
$s.IconLocation = '${icoPath.replace(/\\/g, '\\\\')},0'
$s.Save()

Write-Host "Created: $lnk"`;

const bom = Buffer.from([0xEF, 0xBB, 0xBF]);
fs.writeFileSync(path.join(__dirname, 'create-shortcut.ps1'), bom.toString() + psContent, 'utf-8');
console.log('Script updated');
