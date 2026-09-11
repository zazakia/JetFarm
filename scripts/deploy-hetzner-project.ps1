#Requires -Version 5.1
<#
.SYNOPSIS
    Deploys the POSCursor web export to a Hetzner VPS.

.DESCRIPTION
    1. Builds the production web export (npm run export:web:production).
    2. Uploads the dist/ folder contents to the remote server via SCP.
    3. Cleans the remote web root before uploading.
    4. Prints a Caddy/nginx configuration snippet for serving the static SPA.

.PARAMETER HostName
    Hetzner server IP or hostname.

.PARAMETER User
    SSH username (default: deploy).

.PARAMETER AppName
    Application name used for the remote directory (default: poscursor).

.PARAMETER PublicPort
    Public port the app should be served on (default: 8080).

.PARAMETER Domain
    Domain name for the app (optional).

.EXAMPLE
    .\deploy-hetzner.bat
    HETZNER_HOST=my-server HETZNER_USER=root .\deploy-hetzner.bat
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$HostName,

    [Parameter(Mandatory = $true)]
    [string]$User,

    [Parameter(Mandatory = $true)]
    [string]$AppName,

    [int]$PublicPort = 8080,

    [string]$Domain
)

$ErrorActionPreference = "Stop"

$Server     = "$User@$HostName"
$RemoteRoot = "/var/www/$AppName"

function Test-CommandAvailable {
    param([string]$Name)
    $null -ne (Get-Command -Name $Name -ErrorAction SilentlyContinue)
}

# ---------- Step 1: Build ----------
Write-Host "[deploy-hetzner] Building production web export..." -ForegroundColor Cyan

$npmCmd = if (Test-CommandAvailable "npm.cmd") { "npm.cmd" } else { "npm" }
$build = Start-Process -FilePath $npmCmd -ArgumentList "run", "export:web:production" -NoNewWindow -Wait -PassThru
if ($build.ExitCode -ne 0) {
    throw "Build failed with exit code $($build.ExitCode). Fix the errors above and retry."
}

if (-not (Test-Path "dist\index.html")) {
    throw "dist\index.html not found. The build may have failed silently."
}
Write-Host "[deploy-hetzner] Build successful." -ForegroundColor Green

# ---------- Step 2: Check prerequisites ----------
if (-not (Test-CommandAvailable "ssh")) {
    throw "ssh command not found. Install OpenSSH client (Windows Settings > Apps > Optional features)."
}
if (-not (Test-CommandAvailable "scp")) {
    throw "scp command not found. Install OpenSSH client."
}

Write-Host "[deploy-hetzner] Target: $Server | Remote path: $RemoteRoot" -ForegroundColor Cyan

# ---------- Step 3: Prepare remote directory ----------
Write-Host "[deploy-hetzner] Preparing remote directory..." -ForegroundColor DarkGray
ssh $Server "sudo mkdir -p $RemoteRoot && sudo rm -rf $RemoteRoot/*"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare remote directory via SSH. Check credentials, sudo access, and that the server is reachable."
}

# ---------- Step 4: Upload ----------
Write-Host "[deploy-hetzner] Uploading dist/ contents..." -ForegroundColor Cyan

# Collect every item inside dist/ so scp receives explicit paths (avoids wildcard quirks)
$distItems = Get-ChildItem -Path "dist" | Select-Object -ExpandProperty FullName
if (-not $distItems) {
    throw "dist/ folder appears to be empty."
}

scp -r $distItems "${Server}:${RemoteRoot}/"
if ($LASTEXITCODE -ne 0) {
    throw "SCP upload failed. If you use password auth, ensure the password prompt is interactive. For automation, use an SSH key."
}

# Fix ownership so the web server can read the files
ssh $Server "sudo chown -R www-data:www-data $RemoteRoot 2>/dev/null || sudo chown -R root:root $RemoteRoot" | Out-Null
Write-Host "[deploy-hetzner] Upload complete." -ForegroundColor Green

# ---------- Step 5: Guidance ----------
Write-Host ""
Write-Host "[deploy-hetzner] -------------------------------------------------------------" -ForegroundColor Yellow
Write-Host "  Deployed to: $RemoteRoot on $HostName" -ForegroundColor Yellow
Write-Host "  Ensure a web server (Caddy, nginx, Apache) is installed on the server." -ForegroundColor Yellow
Write-Host "  Remember to configure SPA fallback so client-side routes reach index.html." -ForegroundColor Yellow
Write-Host "[deploy-hetzner] -------------------------------------------------------------" -ForegroundColor Yellow
Write-Host ""

if ($Domain) {
    Write-Host "Suggested Caddyfile block:" -ForegroundColor DarkCyan
    Write-Host @"
$Domain {
    root * $RemoteRoot
    file_server
    try_files {path} /index.html
}
"@
}
else {
    Write-Host "Suggested Caddyfile block (no domain):" -ForegroundColor DarkCyan
    Write-Host @"
:$PublicPort {
    root * $RemoteRoot
    file_server
    try_files {path} /index.html
}
"@
}

Write-Host ""
Write-Host "[deploy-hetzner] Done." -ForegroundColor Green
