[CmdletBinding()]
param(
  [switch]$SkipNpmInstall,
  [string]$NodeRuntimeVersion = "20.18.1"
)

$ErrorActionPreference = "Stop"

function Assert-Command {
  param(
    [string]$Name,
    [string]$InstallHint
  )

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found. $InstallHint"
  }
}

function Find-InnoSetupCompiler {
  $command = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidates = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return $candidate
    }
  }

  throw "Inno Setup compiler was not found. Install Inno Setup 6, or run: choco install innosetup -y"
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..\..")
$PackageJson = Get-Content (Join-Path $RepoRoot "package.json") -Raw | ConvertFrom-Json
$AppVersion = $PackageJson.version

$ReleaseRoot = Join-Path $RepoRoot "release\windows"
$WorkDir = Join-Path $ReleaseRoot "work"
$AppDir = Join-Path $ReleaseRoot "CareApp"
$InstallerDir = Join-Path $ReleaseRoot "installer"

Assert-Command -Name "node" -InstallHint "Install Node.js 20 LTS from https://nodejs.org/"
Assert-Command -Name "npm" -InstallHint "Install Node.js 20 LTS from https://nodejs.org/"
Assert-Command -Name "python" -InstallHint "Install Python 3.11 or newer from https://www.python.org/downloads/windows/"

Write-Host "Cleaning Windows packaging output..."
if (Test-Path $ReleaseRoot) {
  Remove-Item $ReleaseRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $WorkDir, $AppDir, $InstallerDir | Out-Null

if (-not $SkipNpmInstall) {
  Write-Host "Installing npm dependencies..."
  Push-Location $RepoRoot
  npm install
  Pop-Location
}

Write-Host "Building React frontend..."
Push-Location $RepoRoot
npm run build --workspace client
Pop-Location

Write-Host "Preparing application bundle..."
$ServerDest = Join-Path $AppDir "server"
$ClientDest = Join-Path $AppDir "client"
New-Item -ItemType Directory -Force -Path $ServerDest, $ClientDest | Out-Null

Copy-Item -Path (Join-Path $RepoRoot "server\package.json") -Destination $ServerDest
Copy-Item -Path (Join-Path $RepoRoot "server\src") -Destination (Join-Path $ServerDest "src") -Recurse
Copy-Item -Path (Join-Path $RepoRoot "client\dist") -Destination (Join-Path $ClientDest "dist") -Recurse
Copy-Item -Path (Join-Path $RepoRoot "server.py") -Destination (Join-Path $AppDir "server.py")
New-Item -ItemType Directory -Force -Path (Join-Path $ServerDest "data"), (Join-Path $ServerDest "uploads") | Out-Null

@"
CareApp Windows Package

Start CareApp from the Start Menu shortcut or by running CareApp.exe.
The app opens at http://127.0.0.1:4000/

Default super administrator:
Username: superadmin
Password: ChangeMeNow!2026

Keep the CareApp launcher window open while using the app.
"@ | Set-Content -Path (Join-Path $AppDir "README-Windows.txt") -Encoding UTF8

Write-Host "Installing production backend dependencies..."
npm install --omit=dev --prefix $ServerDest

Write-Host "Downloading portable Windows Node.js runtime..."
$NodeZip = Join-Path $WorkDir "node-v$NodeRuntimeVersion-win-x64.zip"
$NodeUrl = "https://nodejs.org/dist/v$NodeRuntimeVersion/node-v$NodeRuntimeVersion-win-x64.zip"
Invoke-WebRequest -Uri $NodeUrl -OutFile $NodeZip
Expand-Archive -Path $NodeZip -DestinationPath $WorkDir
Move-Item -Path (Join-Path $WorkDir "node-v$NodeRuntimeVersion-win-x64") -Destination (Join-Path $AppDir "node")

Write-Host "Ensuring PyInstaller is installed..."
python -m pip install --upgrade pip pyinstaller

Write-Host "Building CareApp launcher executable..."
python -m PyInstaller `
  --noconfirm `
  --clean `
  --onefile `
  --name CareApp `
  --distpath $AppDir `
  --workpath (Join-Path $WorkDir "pyinstaller-build") `
  --specpath (Join-Path $WorkDir "pyinstaller-spec") `
  (Join-Path $RepoRoot "server.py")

$Iscc = Find-InnoSetupCompiler
Write-Host "Building Windows installer with Inno Setup..."
& $Iscc `
  (Join-Path $ScriptDir "careapp.iss") `
  "/DSourceDir=$AppDir" `
  "/DOutputDir=$InstallerDir" `
  "/DAppVersion=$AppVersion"

$Installer = Get-ChildItem -Path $InstallerDir -Filter "*.exe" | Select-Object -First 1
if (-not $Installer) {
  throw "Installer build completed but no .exe was found in $InstallerDir"
}

Write-Host ""
Write-Host "Windows installer created:"
Write-Host $Installer.FullName
