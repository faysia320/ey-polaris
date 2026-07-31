<#
.SYNOPSIS
  ey-polaris 이미지를 빌드해 Docker Hub에 push 한다 (NAS/Portainer 배포용).

.DESCRIPTION
  로컬에서 backend/frontend 이미지를 linux/amd64로 빌드 → Docker Hub push 까지 수행한다.
  push 이후에는 NAS의 Portainer에서 해당 스택을 "Update the stack"(Re-pull image 체크)
  하거나 `docker compose -f docker-compose.prod.yml pull && up -d` 로 반영한다.

  전제: docker desktop 실행 중, `docker login` 가능한 Docker Hub 계정.

.PARAMETER Tag
  이미지 태그 (기본값 latest). 릴리스 고정이 필요하면 날짜 태그를 준다.

.PARAMETER SkipLogin
  이미 로그인된 상태라면 docker login 단계를 건너뛴다.

.PARAMETER KeepLocal
  push 후 로컬 이미지를 삭제하지 않는다.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1
  powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1 -Tag 2026-07-31 -SkipLogin
#>
param(
  [string]$Tag = 'latest',
  [switch]$SkipLogin,
  [switch]$KeepLocal
)

$ErrorActionPreference = 'Stop'

$Registry      = 'faysia320'
$BackendImage  = "${Registry}/ey_polaris-backend:${Tag}"
$FrontendImage = "${Registry}/ey_polaris-frontend:${Tag}"
# NAS가 x86_64이므로 amd64 고정 (ARM NAS로 바뀌면 linux/arm64 + buildx 필요)
$Platform      = 'linux/amd64'

# 스크립트 위치 기준으로 레포 루트 이동 — 어디서 실행하든 동일하게 동작
$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
  Write-Host "[1/4] 이미지 빌드 ($Platform, tag=$Tag)" -ForegroundColor Cyan

  docker build --platform $Platform -t $BackendImage ./backend
  if ($LASTEXITCODE -ne 0) { throw 'Backend 빌드 실패' }

  docker build --platform $Platform -t $FrontendImage ./frontend
  if ($LASTEXITCODE -ne 0) { throw 'Frontend 빌드 실패' }

  if (-not $SkipLogin) {
    Write-Host "[2/4] Docker Hub 로그인" -ForegroundColor Cyan
    docker login
    if ($LASTEXITCODE -ne 0) { throw 'Docker login 실패' }
  }
  else {
    Write-Host "[2/4] 로그인 생략 (-SkipLogin)" -ForegroundColor DarkGray
  }

  Write-Host "[3/4] 이미지 push" -ForegroundColor Cyan

  docker push $BackendImage
  if ($LASTEXITCODE -ne 0) { throw 'Backend push 실패' }

  docker push $FrontendImage
  if ($LASTEXITCODE -ne 0) { throw 'Frontend push 실패' }

  if (-not $KeepLocal) {
    Write-Host "[4/4] 로컬 이미지 정리" -ForegroundColor Cyan
    docker rmi $BackendImage | Out-Null
    docker rmi $FrontendImage | Out-Null
  }
  else {
    Write-Host "[4/4] 로컬 이미지 유지 (-KeepLocal)" -ForegroundColor DarkGray
  }

  Write-Host ''
  Write-Host "완료: $BackendImage / $FrontendImage" -ForegroundColor Green
  Write-Host 'NAS에서 Portainer > Stacks > polaris > Update the stack (Re-pull image 체크) 후 배포하세요.'
}
finally {
  Pop-Location
}
