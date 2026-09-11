# run_memu.ps1
# This script automates running the Expo app on MEmu simulator by:
# 1. Aligning ADB versions (using Android SDK's ADB)
# 2. Connecting to MEmu's ADB port (21503)
# 3. Running 'npx expo run:android' targeting the specific device

$ANDROID_SDK_PATH = "C:\Users\cyber\AppData\Local\Android\Sdk"
$ADB_PATH = "$ANDROID_SDK_PATH\platform-tools\adb.exe"

Write-Host "--- MEmu ADB Setup & Run ---" -ForegroundColor Cyan

# 1. Set environment variables
$env:ANDROID_HOME = $ANDROID_SDK_PATH
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-21.0.9.10-hotspot"
$env:PATH = "$ANDROID_SDK_PATH\platform-tools;$env:JAVA_HOME\bin;$env:PATH"

# 2. Kill all adb servers to avoid version mismatch issues
Write-Host "Killing existing ADB servers..."
taskkill /F /IM adb.exe 2>$null
Start-Sleep -Seconds 1

# 3. Connect to MEmu
Write-Host "Connecting to MEmu at 127.0.0.1:21503..."
& $ADB_PATH connect 127.0.0.1:21503

# 4. Verify connection
$devices = & $ADB_PATH devices
Write-Host $devices

if ($devices -like "*127.0.0.1:21503*device*") {
    Write-Host "Successfully connected to MEmu!" -ForegroundColor Green
    
    # 5. Run Expo app on the device
    Write-Host "Launching Expo app on MEmu..." -ForegroundColor Yellow
    npx expo run:android
} else {
    Write-Host "Error: Could not connect to MEmu. Ensure MEmu is running." -ForegroundColor Red
}
