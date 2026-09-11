@echo off
setlocal
REM Reusable Hetzner deploy wrapper for this project.
REM Optional env vars before running:
REM   HETZNER_DEPLOY_PASSWORD, HETZNER_HOST, HETZNER_USER, HETZNER_APP_NAME, HETZNER_DOMAIN, HETZNER_PUBLIC_PORT

if "%HETZNER_HOST%"=="" set "HETZNER_HOST=46.225.190.206"
if "%HETZNER_USER%"=="" set "HETZNER_USER=deploy"
if "%HETZNER_APP_NAME%"=="" set "HETZNER_APP_NAME=poscursor"
if "%HETZNER_PUBLIC_PORT%"=="" set "HETZNER_PUBLIC_PORT=8080"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-hetzner-project.ps1" -HostName "%HETZNER_HOST%" -User "%HETZNER_USER%" -AppName "%HETZNER_APP_NAME%" -PublicPort %HETZNER_PUBLIC_PORT% -Domain "%HETZNER_DOMAIN%"
exit /b %ERRORLEVEL%
