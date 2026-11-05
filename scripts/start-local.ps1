# Arranca el entorno local de Alaia en tres ventanas.
# Uso:  pwsh -File scripts/start-local.ps1
# Requiere: Node.js >= 22 y un JDK >= 11 (el emulador de Firestore lo necesita).

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$jdkCandidates = @(
  'C:\Users\Usuario\Downloads\_tools\jdk21\jdk-21.0.13+9',
  $env:JAVA_HOME
) | Where-Object { $_ -and (Test-Path (Join-Path $_ 'bin\java.exe')) }

$javaHome = $jdkCandidates | Select-Object -First 1
if (-not $javaHome) {
  Write-Host 'No encontre un JDK >= 11. Instala uno o ajusta $jdkCandidates.' -ForegroundColor Yellow
  Write-Host 'Firestore puede usar JAVA_HOME si ya esta configurado.'
} else {
  Write-Host "Usando JAVA_HOME=$javaHome"
}

if (-not (Test-Path (Join-Path $repo '.env'))) {
  Copy-Item (Join-Path $repo '.env.example') (Join-Path $repo '.env')
  Write-Host 'Cree .env a partir de .env.example'
}

$prefix = if ($javaHome) { "`$env:JAVA_HOME='$javaHome'; `$env:PATH=`"`$env:JAVA_HOME\bin;`$env:PATH`"; " } else { '' }

Write-Host 'Abriendo ventanas: emuladores, API y panel...' -ForegroundColor Cyan
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "$prefix cd '$repo'; npm run emulators"

Start-Sleep -Seconds 3
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd '$repo'; npm run dev:api"

Start-Sleep -Seconds 2
Start-Process pwsh -ArgumentList '-NoExit', '-Command', "cd '$repo'; npm run dev:web"

Write-Host ''
Write-Host 'Cuando los emuladores terminen de cargar:' -ForegroundColor Green
Write-Host '  Panel:  http://localhost:5173'
Write-Host '  API:    http://localhost:3001/health'
Write-Host '  Datos:  http://127.0.0.1:4000'
Write-Host '  Verificación: npm run verify'
