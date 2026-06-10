# 작업 이력: docs/tasks 파이프라인 작업 현황 스크립트

- **날짜**: 2026-06-10
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
docs/tasks/ 작업 폴더별로 research/implementation/qa-report 존재 여부와 QA 판정을 표로 출력하는 `scripts/task-status.py` 추가 (Python 3 표준 라이브러리만 사용). 파이프라인 스킬 v2의 첫 E2E 검증 과제를 겸함.

## 변경 파일 목록
- `scripts/task-status.py` - 신규. 작업 현황 표 출력 스크립트
- `docs/tasks/2026-06-10-task-status-script/` - 파이프라인 산출물 (research.md / implementation.md / qa-report.md)

## 상세 변경 내용
상세: [docs/tasks/2026-06-10-task-status-script](../tasks/2026-06-10-task-status-script/) 참조 (QA 1차 FAIL — 비UTF-8 인코딩 크래시 — 수정 후 2차 PASS).

## 테스트 방법
`python scripts/task-status.py` 실행 — 현재 작업 폴더 1건이 표로 출력되고 exit 0.
