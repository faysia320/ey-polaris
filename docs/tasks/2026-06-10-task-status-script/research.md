# Research: docs/tasks 파이프라인 작업 현황 스크립트 (scripts/task-status.py)

- 날짜: 2026-06-10
- 요청 원문: docs/tasks/ 폴더의 파이프라인 작업 현황을 표로 출력하는 스크립트(scripts/task-status.py)를 추가하고 싶다. 각 작업 폴더별로 research.md / implementation.md / qa-report.md 존재 여부와 qa-report.md의 판정(PASS 등)을 한 줄씩 표로 보여줘야 한다. Python 3 표준 라이브러리만 사용.

## 요약
이 레포는 아직 소스 코드가 없는 초기 상태로, `scripts/` 와 `docs/tasks/` 폴더 모두 존재하지 않는다 (Glob 전체 탐색 결과: `.claude/`, `CLAUDE.md`만 존재). 따라서 이번 작업은 기존 코드와의 통합 없이 신규 스크립트 1개를 추가하는 작업이다. 로컬 환경은 Python 3.12.4가 확인되었다. 작업 폴더 구조와 산출물 파일명 규약은 `.claude/skills/README.md`의 인계 계약에, qa 판정 형식은 `.claude/skills/qa/SKILL.md`의 산출물 스키마에 정의되어 있으므로 이 두 문서가 파싱 규칙의 근거다.

## 관련 파일 및 근거
- `.claude/skills/README.md:19-24` — 인계 계약: 작업 폴더는 `docs/tasks/<YYYY-MM-DD>-<slug>/`, 단계 산출물은 `research.md` / `implementation.md` / `qa-report.md`
- `.claude/skills/qa/SKILL.md:82` — 판정 라인 형식: `- 판정: PASS | CONDITIONAL PASS | FAIL` (qa-report.md 상단 메타 목록에 위치)
- `scripts/` — 미존재. 신규 생성 필요
- `docs/tasks/` — 미존재 (이 research.md가 첫 파일). 스크립트는 폴더 자체가 없거나 비어 있는 경우를 처리해야 함

## 영향도
- 없음 — 기존 소스 코드가 없고(전체 파일 탐색으로 확인), 신규 파일 추가만 수행하므로 기존 동작에 영향을 줄 대상이 없다.

## 성공 기준 (Acceptance Criteria)
- [ ] AC-1: `python scripts/task-status.py` 실행 시 `docs/tasks/` 하위 각 작업 폴더가 한 줄씩, 폴더명 / research / implementation / qa 존재 여부 / 판정 컬럼을 가진 표로 출력된다 — 실제 실행으로 확인
- [ ] AC-2: 산출물 파일 존재 여부가 ✅(있음)/-(없음) 등 일관된 기호로 구분 표시된다 — 단계 파일이 일부만 있는 폴더를 만들어 실행으로 확인
- [ ] AC-3: qa-report.md가 있으면 `- 판정:` 라인에서 PASS / CONDITIONAL PASS / FAIL 값을 추출해 표시하고, 없거나 판정 라인이 없으면 `-` 로 표시한다 — 판정 라인이 있는/없는 케이스를 각각 실행으로 확인
- [ ] AC-4: `docs/tasks/`가 없거나 비어 있어도 예외 없이 안내 메시지를 출력하고 종료 코드 0으로 끝난다 — 폴더 부재 상태에서 실행으로 확인
- [ ] AC-5: Python 3 표준 라이브러리만 import 한다 — 소스의 import 문 육안 확인
- [ ] AC-6: 레포 루트가 아닌 디렉터리에서 실행해도 동작한다 (스크립트 위치 기준으로 레포 루트를 계산) — 다른 cwd에서 실행으로 확인

## Action Items
- [ ] `scripts/task-status.py` 신규 작성: `docs/tasks/*/` 폴더 순회 → 3개 산출물 존재 여부 수집 → qa-report.md 판정 라인 파싱 → 고정폭 텍스트 표 출력
- [ ] 경로 기준을 스크립트 파일 위치(`__file__`) 기준 상위 폴더로 계산해 cwd 비의존으로 구현
- [ ] 엣지 케이스 처리: docs/tasks 부재·빈 폴더·판정 라인 누락·UTF-8 읽기
- [ ] AC-1~6을 수동 실행으로 검증 (테스트 프레임워크 없음 — 레포에 툴체인 미구성)

## 미해결 질문
- 없음 (출력 형식의 세부 — 기호, 컬럼 폭 — 는 구현 재량으로 충분)
