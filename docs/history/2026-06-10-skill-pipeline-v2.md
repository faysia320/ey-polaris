# 작업 이력: 개발 파이프라인 스킬 v2 (하네스 엔지니어링 기반 재설계)

- **날짜**: 2026-06-10
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
기존 4개 스킬(research/implement/qa/git-commit)을 하네스 엔지니어링 원칙에 따라 전면 재작성. 비표준 frontmatter(`mode:`) 제거, 선언적 제약(disallowed-tools/allowed-tools/disable-model-invocation/context: fork) 도입, docs/tasks 파일 기반 단계 인계 계약 수립, 생성자/평가자 분리(qa 포크 실행), 검증 가능한 성공 기준(계약) 우선 개발 절차 도입. 설계 기반: Anthropic "Harness design for long-running agents".

## 변경 파일 목록
- `.claude/skills/research/SKILL.md` - v2.0.0 재작성 (읽기 전용 강제, 성공 기준 계약, Explore fan-out)
- `.claude/skills/implement/SKILL.md` - v2.0.0 재작성 (계약 기반 구현, 자체 검증 필수, 자동 호출 차단)
- `.claude/skills/qa/SKILL.md` - v2.0.0 재작성 (context: fork 독립 평가자, 가중치 루브릭, 안티-관용 규칙)
- `.claude/skills/git-commit/SKILL.md` - v2.0.0 재작성 (동적 컨텍스트 주입, 권한 사전 승인, 엣지 케이스 보강)
- `.claude/skills/README.md` - 신규 (파이프라인 다이어그램, 인계 계약, 하네스 가정 테이블)
- `.gitignore` - 신규 (로컬 전용 설정 제외)

## 상세 변경 내용
Opus 모델 리뷰 패스(모호성·자기모순·실행 불가 지점 점검)와 Fable E2E 파이프라인 테스트(research → implement → qa FAIL → 수정 → qa PASS → git-commit)를 거쳐 검증됨. 테스트 상세: [docs/tasks/2026-06-10-task-status-script](../tasks/2026-06-10-task-status-script/) 참조.

## 테스트 방법
임의 작업으로 `/research <요청>` → `/implement` → `/qa` → `/git-commit --no-push` 순서 실행, docs/tasks 산출물 3종 생성 및 qa 판정 확인.
