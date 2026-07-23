<#
.SYNOPSIS
  ey-polaris 로컬 앱(localhost:3000)을 Cloudflare Quick Tunnel로 외부에 노출/중단한다.

.DESCRIPTION
  frontend nginx가 /api를 backend로 프록시하므로 :3000 하나만 터널로 열면
  프론트+API가 통째로 동작한다. Quick Tunnel은 계정·도메인이 필요 없고,
  실행할 때마다 https://<랜덤>.trycloudflare.com URL이 새로 발급된다(임시).

  전제: docker 스택이 떠 있어야 함  ->  docker compose up -d
  전제: cloudflared 설치           ->  winget install --id Cloudflare.cloudflared

.PARAMETER Action
  start   : 터널 시작 후 외부 URL 출력 (이미 실행 중이면 기존 URL 표시)
  stop    : 터널 중단 (외부 접속 차단)
  status  : 실행 여부와 현재 URL 확인 (기본값)
  restart : 중단 후 재시작 (URL이 새로 발급됨)

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\tunnel.ps1 start
  powershell -ExecutionPolicy Bypass -File scripts\tunnel.ps1 status
  powershell -ExecutionPolicy Bypass -File scripts\tunnel.ps1 stop
#>
param(
  [ValidateSet('start', 'stop', 'status', 'restart')]
  [string]$Action = 'status',
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

$StateDir  = Join-Path $env:TEMP 'ey-polaris-tunnel'
$LogFile   = Join-Path $StateDir 'tunnel.log'
$OutFile   = Join-Path $StateDir 'tunnel.out'
$TargetUrl = "http://localhost:$Port"
# URL 조회 시 참고할 로그 후보 (스크립트 로그 + 수동 실행 시 쓰던 임시 로그)
$LogCandidates = @($LogFile, (Join-Path $env:TEMP 'cf-tunnel.log'))

function Find-Cloudflared {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @(
      "$env:ProgramFiles\cloudflared\cloudflared.exe",
      "${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

# quick tunnel = cloudflared 프로세스 중 커맨드라인에 '--url' 이 포함된 것
function Get-TunnelProcs {
  Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -match '--url' }
}

function Get-TunnelUrl {
  foreach ($log in $LogCandidates) {
    if (Test-Path $log) {
      $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
        Select-Object -Last 1
      if ($m) { return ([regex]::Match($m.Line, 'https://[a-z0-9-]+\.trycloudflare\.com')).Value }
    }
  }
  return $null
}

switch ($Action) {
  'start' {
    if (Get-TunnelProcs) {
      Write-Host "이미 터널이 실행 중입니다." -ForegroundColor Yellow
      $u = Get-TunnelUrl
      if ($u) { Write-Host "외부 접속 URL: $u" -ForegroundColor Cyan }
      break
    }
    $exe = Find-Cloudflared
    if (-not $exe) {
      throw "cloudflared를 찾을 수 없습니다. 'winget install --id Cloudflare.cloudflared'로 설치하세요."
    }
    New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
    Remove-Item $LogFile -ErrorAction SilentlyContinue

    Start-Process -FilePath $exe `
      -ArgumentList 'tunnel', '--url', $TargetUrl `
      -RedirectStandardError $LogFile `
      -RedirectStandardOutput $OutFile `
      -WindowStyle Hidden

    Write-Host "터널을 시작하는 중... (URL 발급 대기)" -ForegroundColor Green
    $u = $null
    for ($i = 0; $i -lt 20 -and -not $u; $i++) {
      Start-Sleep -Milliseconds 700
      $u = Get-TunnelUrl
    }
    if ($u) {
      Write-Host ""
      Write-Host "외부 접속 URL: $u" -ForegroundColor Cyan
      Write-Host "(이 URL은 터널이 떠 있는 동안만 유효하며, 재시작하면 바뀝니다)" -ForegroundColor DarkGray
    }
    else {
      Write-Host "URL을 아직 못 읽었습니다. 잠시 후 'status'로 확인하세요. 로그: $LogFile" -ForegroundColor Yellow
    }
  }

  'stop' {
    $procs = @(Get-TunnelProcs)
    if ($procs.Count -eq 0) {
      Write-Host "실행 중인 터널이 없습니다." -ForegroundColor Yellow
      break
    }
    $procs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "터널을 중단했습니다. 외부 접속이 차단됩니다. (PID: $($procs.ProcessId -join ', '))" -ForegroundColor Green
  }

  'status' {
    $procs = @(Get-TunnelProcs)
    if ($procs.Count -gt 0) {
      Write-Host "터널 실행 중 (PID: $($procs.ProcessId -join ', '))" -ForegroundColor Green
      $u = Get-TunnelUrl
      if ($u) { Write-Host "외부 접속 URL: $u" -ForegroundColor Cyan }
      else { Write-Host "URL 미확인 (로그 없음)" -ForegroundColor Yellow }
    }
    else {
      Write-Host "터널 미실행" -ForegroundColor Yellow
    }
  }

  'restart' {
    & $PSCommandPath -Action stop -Port $Port
    Start-Sleep -Seconds 1
    & $PSCommandPath -Action start -Port $Port
  }
}
