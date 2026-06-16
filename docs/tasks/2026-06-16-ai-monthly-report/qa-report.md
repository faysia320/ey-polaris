# QA Report: 대시보드 월간 AI 리포트 기능 (재검증 / 2차)

- 날짜: 2026-06-16
- 작업 폴더: `docs/tasks/2026-06-16-ai-monthly-report/`
- 판정: CONDITIONAL PASS

## 요약
2차 구현(1차 QA 피드백 반영)을 실행 중인 docker 스택(ey-polaris-{db,backend,frontend}, 2분 전 재빌드·현재 소스 번들 서빙 확인)에서 재검증했다. 등록된 유효 OpenAI 키로 실제 리포트 생성·누적·최신 조회·마크다운 렌더·DB 마스킹을 라이브로 확인했다. 1차 피드백 4건(코드 이중 배경, 외부 링크 안전 속성, 모델 maxLength, TabsList 오버플로)은 코드에 반영되어 있으나, TabsList 오버플로 수정(`overflow-x-auto`)이 **데스크톱 포함 전 뷰포트에서 탭 목록에 세로 스크롤바 아티팩트**를 새로 유발함(Low, 신규 회귀). AC-6(375px 모바일)은 이 환경에서 `resize_window`가 실제 뷰포트를 좁히지 못해(창이 디스플레이에 최대화 → 스크린샷이 일관되게 1512×803) **동적 미검증**이며 정적 분석으로 갈음했다. High 0건, Medium 1건(AC-6 동적 미검증), Low 3건.

## 성공 기준 채점
- ✅ AC-1: `POST /api/v1/analytics/ai-report?month=2026-05` → HTTP 201, `model=gpt-4.1-mini`, 한국어 마크다운 본문(1037자, `# … 🌟`, `## …`, 목록 포함). 실제 OpenAI 호출 성공(DB 등록 키 사용). curl로 직접 확인.
- ✅ AC-2: 같은 월(2026-05) 2회 POST 후 `ai_reports`에 2행 잔존(`SELECT … ORDER BY created_at DESC` 확인, id 3·4), `GET ?month=2026-05`이 최신(id 4) 반환. year_month 인덱스만 있고 유니크 없음(`\d ai_reports`로 확인).
- ✅ AC-3: 브라우저(데스크톱)에서 2026-05 리포트가 제목(`#`→큰 볼드)·섹션(`##`)·불릿·`**볼드**`로 서식 렌더되고 raw `#`/`**` 미노출. 카드 하단에 `2026-05 · gpt-4.1-mini · 2026. 6. 16. …` 메타 표시. "다시 생성"/"리포트 생성" 버튼 존재, `disabled={reportLoading}`.
- ✅ AC-4: 2026-06(리포트 없음) 전환 시 "아직 이 달의 AI 리포트가 없어요. 버튼을 눌러 생성해 보세요 ✨" 빈 상태 + "리포트 생성" 버튼, 2026-05는 리포트 렌더. 월별 `byMonth` 캐시 키잉 정상.
- ✅ AC-5: 데이터 전무 월(2030-02) 생성도 500 없이 201 정상("활동 없음" 톤 리포트). 잘못된 month 파라미터(`?month=bad`)는 422. 키 미등록 400 분기는 `create_ai_report`가 `_generate_report_content` 이전에 `raise HTTPException(400)`로 부분 저장 없이 처리됨을 정적 확인(라이브 키 삭제 시 사용자 데이터 훼손되어 미수행). 프론트는 `reportError` 표시 경로 존재(`DashboardPage.tsx:218-220`).
- ⚠️ AC-6(모바일 375px): 환경 제약으로 **동적 미검증**(아래 [Medium]). 정적 분석상 결함 없음 — 앱 셸이 모바일 대응(`AppLayout.tsx`: 사이드바 `hidden md:flex`, 하단 내비 `md:hidden`, main `min-w-0 flex-1 p-4 pb-20 md:ml-60`), AI 카드 헤더 `flex-row justify-between gap-2`(짧은 제목 + sm 버튼), `MarkdownView` `break-words`·`pre`/`table` `overflow-x-auto`·목록 `pl-5`, 설정 탭 `max-w-md` 세로 스택, 고정 px 너비 없음. 정적만으로는 PASS 단정 불가로 보수 판정.
- ✅ AC-7: `GET /api/v1/settings/ai` 응답 `{"model":"gpt-4.1-mini","api_key_set":true,"api_key_hint":"…OuAA"}` — 원문 키 미반환(네트워크/DB 양쪽 확인, `app_settings`에 `openai_api_key` 164자·`openai_model` 12자 저장). 브라우저에서 /settings 새로 진입 시 AI 설정 탭이 "키가 등록되어 있습니다 (…OuAA)" + 모델 `gpt-4.1-mini` 표시(DB 조회 기반 → 새로고침 유지). env 미사용(`config.py` DATABASE_URL만).
- ✅ AC-8: 생성 리포트 `model`=`gpt-4.1-mini`, 카드 메타·설정 탭 동일. `settings_store.get_openai_config`가 DB값 우선·미설정 시 `DEFAULT_OPENAI_MODEL` 폴백(정적 확인).

## 검증 시나리오
- 스택: `docker ps`로 ey-polaris-{db,backend,frontend} 기동(frontend/backend 2분 전 재빌드). `curl http://localhost:3000/`의 `<script src>`가 `/static/index-DmedwzEc.js`를 참조하고 해당 번들에 `AI 리포트` 문자열 포함(서빙 번들 = 현재 소스 교차 확인).
- 백엔드 API(curl): `POST /analytics/ai-report`(2026-05 2회, 2030-02 1회), `GET /analytics/ai-report`(2026-05 최신·2099-01 null), `GET /settings/ai`(마스킹), 잘못된 month 422.
- DB(`docker exec … psql`): `alembic current`=`0009 (head)`, `app_settings`·`ai_reports` 테이블·`ix_ai_reports_year_month` 인덱스 존재, 2026-05 2행 누적·최신 조회, app_settings 키/모델 저장.
- 브라우저 E2E(데스크톱): 대시보드 AI 카드 빈 상태(2026-06)·마크다운 렌더(2026-05)·메타 표시, Settings AI 설정 탭 마스킹 상태를 스크린샷으로 확인. 최초 진입 시 카드가 안 보였으나 브라우저 캐시 잔존이었고 캐시 무효화 로드 후 정상 렌더(코드 결함 아님).
- 모바일 375px: `resize_window(375×760)`가 성공을 반환하나 스크린샷이 일관되게 1512×803 데스크톱 레이아웃(사이드바·3열 그리드) → 창이 디스플레이에 최대화되어 뷰포트가 좁혀지지 않음. **동적 검증 불가**, 정적 분석으로 대체.
- 정리: 검증 중 생성한 `ai_reports` 행 전부 DELETE(최종 0행 = 초기 GET null 상태 복원), `git status`로 레포에 신규/수정 파일 없음(구현 파일 외 변경 없음) 확인. 사용자 OpenAI 키/모델은 보존.

## 발견 이슈
- [Medium] AC-6 모바일 375px 동적 미검증 — 브라우저 창이 디스플레이에 최대화되어 `resize_window`(375px)가 실제 뷰포트에 반영되지 않음(스크린샷 항상 1512×803). 정적 근거(반응형 앱 셸·`break-words`·`overflow-x-auto`·`max-w-md`)는 강하나, 모바일 AC는 정적만으로 PASS를 단정할 수 없어 Medium 유지. 실제 기기/DevTools 디바이스 에뮬레이션에서 1회 실측 권장.
- [Low] `frontend/src/pages/SettingsPage.tsx:709` — TabsList `overflow-x-auto`가 **세로 스크롤바 아티팩트**를 유발(신규 회귀). CSS 규약상 `overflow-x:auto`는 `overflow-y`를 `auto`로 승격시키는데, 탭 트리거 높이가 TabsList 컨테이너 높이를 근소하게 초과해 **데스크톱(1512px) 포함 전 뷰포트**에서 탭 목록 우측에 ▲▼ 세로 스크롤바 nub이 항상 표시됨(스크린샷·zoom 확인). 기능 무해, 시각적 결함. (원래 의도는 375px 가로 오버플로 흡수였으나 부작용 발생 — `overflow-x-auto`만으로는 세로축까지 auto가 되므로 컨테이너 높이/`overflow-y-hidden` 조정 필요.)
- [Low] `backend/app/routers/analytics.py:382` — OpenAI 예외 메시지를 `detail`에 그대로 노출(`f"…: {e}"`). 자가 호스팅 개인 앱 전제로 implementation에서 의도적 유지. 외부 오류 원문이 프론트로 전달됨.
- [Low] `frontend/src/stores/aiReport.ts:9,21,32` — `loading`이 fetch/generate·전 월 공용 단일 불리언. 빠른 월 전환 시 stale 응답이 `loading`을 흔들 수 있음(콘텐츠는 `byMonth` 키잉으로 격리되어 표시 정합성은 유지). implementation에서 효익 낮음으로 보류 명시.
- (해소 확인) 1차 [Low] 코드 이중 배경 → `pre`에 `[&>code]:bg-transparent [&>code]:p-0` 적용 확인. 외부 링크 → `a`에 `target="_blank" rel="noopener noreferrer"` 확인. 모델 422 → 모델 `Input` `maxLength={50}` 확인.

## 수정 Action Items (CONDITIONAL)
- [ ] 실제 375px 환경(기기 또는 DevTools 디바이스 에뮬레이션)에서 대시보드 AI 리포트 카드(헤더 버튼·마크다운 본문)·Settings AI 설정 탭·TabsList(4탭) 가로 스크롤/겹침/잘림 없음을 1회 실측.
- [ ] `SettingsPage.tsx:709` TabsList의 세로 스크롤바 아티팩트 제거 — `overflow-x-auto`와 함께 `overflow-y-hidden`(또는 컨테이너 높이/패딩 조정)으로 세로축 auto 승격을 차단.
- [ ] (선택) OpenAI 502 `detail`의 외부 예외 원문 노출을 사용자용 메시지로 일반화(현재 의도적 유지).

## 다음 단계
CONDITIONAL PASS — High 0건, Medium 1건(AC-6 375px 동적 미검증), Low 3건. 375px 실측 확인 + TabsList 세로 스크롤바 정리 후 문제 없으면 `/git-commit` 진행 가능. 코드 수정이 필요하면 `/implement docs/tasks/2026-06-16-ai-monthly-report` 후 `/qa` 재실행.
