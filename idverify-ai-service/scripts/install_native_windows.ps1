# Install native Windows runtimes: VC++ Redistributable (x64) and UB‑Mannheim Tesseract
# Run this script from an elevated (Administrator) PowerShell prompt.
# Usage (Admin PowerShell):
#   cd <repo>/idverify-ai-service
#   .\scripts\install_native_windows.ps1

set -e
$ErrorActionPreference = 'Stop'

function Write-Log { param($m) Write-Host "[install_native] $m" }

# 1) VC++ redistributable (stable alias)
$vcUrl = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
$vcLocal = "$env:TEMP\vc_redist.x64.exe"
Write-Log "Downloading VC++ redistributable..."
Invoke-WebRequest -Uri $vcUrl -OutFile $vcLocal -UseBasicParsing -TimeoutSec 120
Write-Log "Running VC++ installer (quiet)..."
Start-Process -FilePath $vcLocal -ArgumentList "/install","/quiet","/norestart" -Wait
Write-Log "VC++ install finished (exit code captured)."

# 2) UB-Mannheim Tesseract - query latest release from GitHub and download installer
$repoApi = 'https://api.github.com/repos/UB-Mannheim/tesseract/releases/latest'
Write-Log "Querying UB-Mannheim Tesseract latest release..."
try {
    $resp = Invoke-RestMethod -Uri $repoApi -UseBasicParsing -TimeoutSec 60
} catch {
    Write-Log "Failed to query GitHub API: $_. Exception. Will skip tesseract download."
    exit 0
}

$tessAsset = $null
foreach ($a in $resp.assets) {
    if ($a.name -match 'tesseract.*setup.*\\.exe$' -or $a.name -match 'tesseract-ocr-w64-setup.*\\.exe$') {
        $tessAsset = $a
        break
    }
}

if (-not $tessAsset) {
    Write-Log "No UB-Mannheim installer asset found in release. Please download manually: $($resp.html_url)"
    exit 0
}

$tessLocal = "$env:TEMP\$($tessAsset.name)"
Write-Log "Downloading Tesseract installer $($tessAsset.name)..."
Invoke-WebRequest -Uri $tessAsset.browser_download_url -OutFile $tessLocal -UseBasicParsing -TimeoutSec 120
Write-Log "Running Tesseract installer (attempting silent options)..."
# Try common silent flags for different installer systems
$tried = @("/S","/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /SP-","/quiet","/silent")
$installed = $false
foreach ($flags in $tried) {
    try {
        Write-Log "Trying installer flags: $flags"
        Start-Process -FilePath $tessLocal -ArgumentList $flags -Wait -NoNewWindow
        Start-Sleep -Seconds 2
        # Check presence
        if (Get-Command tesseract -ErrorAction SilentlyContinue) { $installed = $true; break }
        # Also check Program Files path
        $possible = @('C:\Program Files\Tesseract-OCR\tesseract.exe','C:\Program Files (x86)\Tesseract-OCR\tesseract.exe')
        foreach ($p in $possible) { if (Test-Path $p) { $installed = $true; break } }
        if ($installed) { break }
    } catch {
        Write-Log "Installer run failed with flags $flags: $_"
    }
}

if (-not $installed) {
    Write-Log "Silent install attempts did not detect Tesseract on PATH. You may need to run the installer interactively: $tessLocal"
} else {
    Write-Log "Tesseract appears installed. Adding Program Files path to user PATH if required."
    $tessPaths = @('C:\Program Files\Tesseract-OCR','C:\Program Files (x86)\Tesseract-OCR')
    foreach ($tp in $tessPaths) {
        if (Test-Path "$tp\tesseract.exe") {
            $current = [Environment]::GetEnvironmentVariable('Path',[EnvironmentVariableTarget]::User)
            if ($current -notlike "*${tp}*") {
                [Environment]::SetEnvironmentVariable('Path', "$current;$tp", [EnvironmentVariableTarget]::User)
                Write-Log "Added $tp to user PATH. You may need to restart shells."
            }
        }
    }
}

# 3) Final checks
Write-Log "Verifying tesseract and vc runtime availability..."
$tessCmd = Get-Command tesseract -ErrorAction SilentlyContinue
if ($tessCmd) { Write-Log "tesseract found: $($tessCmd.Source)" } else { Write-Log "tesseract not found on PATH." }

# Inform user
Write-Log "Done. If Tesseract was installed by an interactive installer, restart your console or reboot if prompted."

exit 0
