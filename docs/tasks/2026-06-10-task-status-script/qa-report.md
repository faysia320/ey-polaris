# QA Report: docs/tasks 파이프라인 작업 현황 스크립트 (scripts/task-status.py)

- 날짜: 2026-06-10
- 작업 폴더: docs/tasks/2026-06-10-task-status-script
- 판정: PASS
- 비고: 재검증 (1차 FAIL → High 이슈 수정 후 2차 평가. 본 보고서가 1차 보고서를 대체)

## 성공 기준 채점
- ✅ AC-1: 레포 루트에서 `python scripts/task-status.py` 실행 → 작업 폴더/research/implementation/qa/판정 5컬럼 표 출력, exit 0 직접 확인
- ✅ AC-2: 임시 샌드박스(스크립트 복사본 + 픽스처 10종)에서 research만 있는 폴더 `O - -`, 전부 있는 폴더 `O O O`, 빈 폴더 `- - -`로 일관 표시 확인. 비폴더 stray.txt는 무시됨 (기호 `O`/`-`는 research.md가 재량 허용한 범위)
- ✅ AC-3: `CONDITIONAL PASS`(PASS로 오인 없음)/`PASS`/`FAIL` 각각 정상 추출, 판정 라인 없는 qa-report → `-`, qa-report 부재 → `-`, 규약 외 값(`보류`) → 그대로 노출. 전부 실행으로 확인
- ✅ AC-4: docs/tasks 빈 상태 → "작업 폴더가 없습니다" + exit 0, 부재 상태 → "docs/tasks 폴더가 없습니다" + exit 0 확인
- ✅ AC-5: import는 `re`, `sys`, `pathlib` 뿐 (scripts/task-status.py:9-11 육안 확인) — 모두 표준 라이브러리
- ✅ AC-6: cwd를 /tmp로 옮겨 절대 경로로 실행 → 레포의 docs/tasks를 올바르게 찾아 동일 출력, exit 0 확인

## 검증 시나리오
- `python scripts/task-status.py` (레포 루트, Python 3.12.4) → 표 출력, exit 0
- 임시 디렉터리(mktemp)에 스크립트 복사 + docs/tasks 픽스처 10종 구성 후 실행 (레포 무변경):
  - research만 / 3개 전부(CONDITIONAL PASS) / 판정 라인 없는 qa-report / PASS / FAIL / 규약 외 값 `보류` / 완전 빈 폴더 / stray.txt → 모두 기대대로 출력, exit 0
  - **1차 High 재현 케이스 — cp949 인코딩 qa-report.md** (`iconv -t CP949`) → 크래시 없이 `읽기 실패(인코딩)` 표시, 다른 행 전부 정상 출력, exit 0. **1차 High 이슈 수정 확인됨** (scripts/task-status.py:28-31의 `except UnicodeDecodeError` 분기)
  - UTF-16 인코딩 qa-report.md (PowerShell 5.1 `Out-File` 기본값) → 동일하게 `읽기 실패(인코딩)`, exit 0
  - UTF-8 BOM qa-report.md: 실제 스키마 형태(첫 줄 `# QA Report:` 헤딩, 판정 라인은 3행) → `PASS` 정상 추출. 단, 판정 라인이 파일 첫 줄인 비정형 파일에서는 BOM(﻿)이 정규식 매칭을 막아 `-`로 표시됨 (아래 Low)
- docs/tasks 빈 상태 / 부재 상태 → 각각 안내 메시지 + exit 0
- 다른 cwd(/tmp)에서 절대 경로 실행 → exit 0, 동일 출력
- 파이프 출력(`| grep`) → 한글 깨짐 없음 (`sys.stdout.reconfigure(encoding="utf-8")` 동작 확인)
- 1차 Low 이슈(읽기 실패와 판정 부재의 구분 불가) → `읽기 실패`/`읽기 실패(인코딩)` 별도 표기로 수정 확인
- 검증 후 임시 픽스처 전부 삭제, `git status`로 레포 작업 트리 무변경 확인

## 발견 이슈
- [Low] `scripts/task-status.py:27,33` — UTF-8 BOM 파일에서 판정 라인이 파일의 **첫 줄**이면 `﻿` 접두로 정규식이 매칭되지 않아 `-`로 표시됨 (`str.strip()`은 ﻿를 제거하지 않음). 단, qa-report.md 고정 스키마상 첫 줄은 항상 `# QA Report:` 헤딩이라 정상 파일에서는 발생하지 않으며, 발생해도 크래시 없이 `-`로 우아하게 강등됨. `encoding="utf-8-sig"` 사용 시 근본 해결
- [Low] `scripts/task-status.py:66-71` — 컬럼 폭을 `len()`(코드포인트 수)으로 계산해 한글(표시 폭 2칸) 셀(`보류`, `읽기 실패(인코딩)`)이 있으면 정렬이 어긋남 (1차 보고서의 Low와 동일, 구현이 코스메틱으로 보류 명시. research.md가 출력 형식 세부를 재량 허용)
- [Low] `scripts/task-status.py:36-38` — `startswith` 매칭이 느슨해 `FAILED`/`PASSED` 같은 규약 외 값이 `FAIL`/`PASS`로 정규화됨. 규약 3값에 대해서는 정확하며 실해는 없음

## 수정 Action Items (FAIL/CONDITIONAL 시)
- (해당 없음 — PASS. 위 Low 3건은 선택적 개선 사항)

## 다음 단계
/git-commit 진행 가능
