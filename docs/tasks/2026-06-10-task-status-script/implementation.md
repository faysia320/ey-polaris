# Implementation: docs/tasks 파이프라인 작업 현황 스크립트

- 날짜: 2026-06-10
- 기반 명세: docs/tasks/2026-06-10-task-status-script/research.md

## 변경 파일
- `scripts/task-status.py` — 신규. docs/tasks 폴더 순회 → 산출물 존재 여부 + qa 판정 파싱 → 고정폭 표 출력

## 주요 결정
- 존재 표시는 `O` / `-` 사용 (research.md의 ✅ 예시 대신): Windows 콘솔 코드페이지에서 이모지 폭 계산이 어긋나 표 정렬이 깨지는 것을 피하기 위함. research.md가 "기호는 구현 재량"으로 허용한 범위 내의 결정
- 판정 매칭은 `("CONDITIONAL PASS", "PASS", "FAIL")` 순서로 startswith 검사 — "CONDITIONAL PASS"가 "PASS"로 오인되지 않도록 긴 토큰 우선
- 규약 외 판정 값은 버리지 않고 그대로 표에 노출 (정보 손실 방지)
- `sys.stdout.reconfigure(encoding="utf-8")` 추가: Windows에서 stdout이 파이프일 때 로케일 인코딩(cp949)으로 한글이 깨지는 문제를 실행 중 발견해 수정

## QA 수정 라운드 1 (1차 판정 FAIL → 수정)
- [High] `parse_verdict`가 비UTF-8 qa-report.md에서 `UnicodeDecodeError`로 전체 크래시 → `except UnicodeDecodeError` 분기 추가, `"읽기 실패(인코딩)"` 표시로 처리. cp949 픽스처로 수정 확인 (크래시 없음, exit 0)
- [Low] 읽기 실패와 판정 라인 부재가 동일하게 `-` 표시 → 읽기 실패는 `"읽기 실패"`/`"읽기 실패(인코딩)"`으로 구분 표시
- [Low] 한글 표시 폭으로 인한 컬럼 정렬 어긋남 → 미수정 (코스메틱, 변경 최소화 원칙. East Asian Width 처리는 범위 외로 판단)

## 자체 검증 결과
- 실행 명령: `python scripts/task-status.py` (레포 루트) → 통과 (표 출력, exit 0)
- 실행 명령: 픽스처(qa-report만 존재: CONDITIONAL PASS / 판정 라인 없음 / cp949 인코딩) 생성 후 실행 → 통과 (판정 추출, `-`, `읽기 실패(인코딩)` 각각 정상. 이후 픽스처 삭제)
- 실행 명령: `cd /tmp && python /d/repos/ey-polaris/scripts/task-status.py` → 통과 (cwd 비의존)
- 실행 명령: `docs/tasks` 임시 제거/빈 폴더 상태에서 실행 → 통과 (안내 메시지 + exit 0, 이후 원복)
- 빌드/테스트/린트 툴체인: 레포에 미구성 (research.md 확인과 일치) → 직접 실행 검증으로 대체

## 성공 기준 자가 체크
- [x] AC-1: 레포 루트에서 실행, 5컬럼 표 출력 확인
- [x] AC-2: 단계 파일 일부만 있는 픽스처에서 O/- 구분 표시 확인
- [x] AC-3: CONDITIONAL PASS 추출, 판정 라인 없음 → `-` 확인
- [x] AC-4: 폴더 부재·빈 폴더 모두 안내 메시지 + exit 0 확인
- [x] AC-5: import는 re, sys, pathlib 뿐 (grep으로 확인)
- [x] AC-6: /tmp에서 절대 경로 실행으로 확인

## 보류/미완 항목
- [Low] 한글 컬럼 폭 정렬 — 위 사유로 보류
