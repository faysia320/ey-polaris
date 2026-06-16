# 작업 이력: 대시보드 월간 AI 리포트 기능

- **날짜**: 2026-06-16
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
대시보드에 해당 월의 가계부 데이터를 기반으로 한 AI 리포트(OpenAI) 생성·표시 기능을 추가했다. 리포트는 마크다운으로 렌더링되며 DB에 이력으로 누적 저장되고 월별 최신 1건이 표시된다. OpenAI API 키와 모델은 `.env`가 아니라 DB(`app_settings`)에 저장하며, 설정 화면의 "AI 설정" 탭에서 등록·변경한다.

## 변경 파일 목록
### 백엔드
- `backend/requirements.txt` - `openai` 의존성 추가
- `backend/app/models.py` - `AppSetting`(키-값), `AIReport`(월별 리포트 누적) 모델 추가
- `backend/alembic/versions/0009_ai_reports_and_app_settings.py` - `app_settings`·`ai_reports` 테이블 생성 마이그레이션 (신규)
- `backend/app/schemas.py` - `AIReportOut`, `AISettingsOut`(키 마스킹), `AISettingsUpdate`, 기본 모델 상수 추가
- `backend/app/settings_store.py` - app_settings 읽기/쓰기 및 OpenAI 설정 로드 헬퍼 (신규)
- `backend/app/routers/settings.py` - `GET/PUT /settings/ai` 라우터 (신규)
- `backend/app/main.py` - settings 라우터 등록
- `backend/app/routers/analytics.py` - 리포트 생성/조회 엔드포인트 + 월 집계 컨텍스트 빌더 + OpenAI 호출

### 프론트엔드
- `frontend/package.json`, `frontend/package-lock.json` - `react-markdown`, `remark-gfm` 추가
- `frontend/src/types.ts` - `AIReport`, `AISettings`, `AISettingsUpdate` 타입 추가
- `frontend/src/stores/aiReport.ts` - 리포트 조회/생성 스토어 (신규)
- `frontend/src/stores/aiSettings.ts` - AI 설정 조회/저장 스토어 (신규)
- `frontend/src/components/MarkdownView.tsx` - 안전한 마크다운 렌더 컴포넌트 (신규)
- `frontend/src/pages/DashboardPage.tsx` - AI 리포트 카드(생성 버튼/마크다운/빈 상태/에러) 추가
- `frontend/src/pages/SettingsPage.tsx` - "AI 설정" 탭(API 키·모델 입력) 추가

## 상세 변경 내용
- 저장 정책: `ai_reports`는 유니크 제약 없이 생성마다 누적, 조회는 `created_at DESC, id DESC` 최신 1건.
- 보안: API 키는 DB 평문 저장하되 조회 응답에는 원문을 노출하지 않고 등록 여부·끝 4자리 힌트만 반환.
- 모델 기본값 `gpt-4.1-mini`(DB 미설정 시 폴백), 설정 탭에서 교체 가능.
- 마크다운은 react-markdown + remark-gfm(raw HTML 비허용), 모바일 대응 스타일링.
- 상세 산출물: [docs/tasks/2026-06-16-ai-monthly-report](../tasks/2026-06-16-ai-monthly-report/) 참조 (research / implementation / qa-report)

## 테스트 방법
1. `docker compose up -d --build`로 스택 기동 (마이그레이션 0009 자동 적용)
2. 설정 → "AI 설정" 탭에서 OpenAI API 키 등록 (모델 비우면 `gpt-4.1-mini`)
3. 대시보드 → "AI 리포트" 카드 → "리포트 생성" 클릭 → 마크다운 리포트 생성·표시 확인
4. 월 전환 시 해당 월 최신 리포트/빈 상태 표시 확인

## QA 결과
CONDITIONAL PASS — 기능 AC 7건(1·2·3·4·5·7·8) 라이브 통과. AC-6(375px 모바일)은 QA 자동화 도구의 뷰포트 제약으로 동적 미검증이나 정적 분석상 결함 없음. 상세: [qa-report.md](../tasks/2026-06-16-ai-monthly-report/qa-report.md)
