# 작업 이력: NAS(Portainer) 배포 파이프라인 구성

- **날짜**: 2026-07-31
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

로컬에서만 `docker compose up` 하던 앱을 원격 Synology NAS의 Portainer 스택으로 배포할 수 있게 했다.
같은 NAS에서 이미 운영 중인 `stock-flow`와 동일한 방식(로컬 빌드 → Docker Hub push → Portainer에서 pull)을 따른다.

## 변경 파일 목록

- `docker-compose.prod.yml` (신규) - Portainer 스택용 정의. `build:` 대신 Docker Hub 이미지 참조
- `scripts/deploy.ps1` (신규) - amd64 빌드 → Docker Hub push → 로컬 이미지 정리
- `frontend/nginx.conf` - `/api` 프록시의 upstream 런타임 재해석, 업로드 크기 한도 상향

## 상세 변경 내용

### 배포용 compose 분리

로컬 개발용 `docker-compose.yml`은 `build:` 를 쓰므로 Portainer에서 그대로 쓸 수 없다.
배포 전용 파일을 따로 두고 다음을 반영했다.

- 이미지: `faysia320/ey_polaris-backend:latest`, `faysia320/ey_polaris-frontend:latest`
- 컨테이너명 `polaris_db` / `polaris_backend` / `polaris_frontend` — 컨테이너명은 호스트 전역이라
  같은 NAS의 `stock_flow_*` 스택과 충돌하지 않도록 명시했다
- 포트는 frontend `9100:80` 하나만 노출. nginx가 `/api`를 backend로 프록시하므로 backend·db는
  스택 내부 네트워크로만 접근한다 (stock-flow가 쓰는 9000/9010/9020과 분리)
- `restart: unless-stopped`, db/backend healthcheck 추가.
  backend는 기동 시 `alembic upgrade head`(스키마 + 기준정보 시드)가 먼저 돌기 때문에
  `start_period: 40s`로 여유를 뒀다
- DB 계정·비밀번호는 `POSTGRES_PASSWORD` 등 환경변수로 덮어쓸 수 있게 하고 기본값은 기존과 동일하게 유지

### nginx `/api` 프록시 개선

기존 `proxy_pass http://backend:8000;` 은 nginx가 기동 시점에 DNS를 한 번만 해석한다.
NAS에서 backend 컨테이너만 재배포하면 IP가 바뀌어도 nginx가 옛 IP를 계속 물고 있어 502가 고착될 수 있다.
Docker 내장 DNS(`resolver 127.0.0.11`)와 변수 upstream을 써서 10초 TTL로 재해석되도록 바꿨다 (stock-flow와 동일한 방식).

함께 `client_max_body_size 20M`을 넣었다. nginx 기본값 1M이면 엑셀 업로드가 413으로 거부된다.

## 테스트 방법

1. `powershell -ExecutionPolicy Bypass -File scripts\deploy.ps1` — 빌드 및 Hub push
2. Portainer > Stacks > Add stack > `docker-compose.prod.yml` 내용 붙여넣기 > Deploy
3. `http://<NAS-IP>:9100` 접속 — 대시보드 표시, 설정 화면의 기준정보(카테고리) 시드 확인
4. 갱신 시: deploy.ps1 재실행 → Portainer에서 "Update the stack" + Re-pull image

로컬 사전 검증은 별도 프로젝트명으로 격리 실행해 확인했다.

```
docker compose -p polaris-smoke -f docker-compose.prod.yml up -d
# http://localhost:9100/ → 200, /api/v1/categories → 200 (시드 데이터 확인)
docker compose -p polaris-smoke -f docker-compose.prod.yml down -v
```
