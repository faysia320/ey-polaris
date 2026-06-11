---
name: git-commit
description: 변경사항을 논리적 작업 단위로 그룹화해 커밋하고 푸시합니다. 주요 작업은 커밋 전에 docs/history 이력 문서를 생성해 코드와 함께 단일 커밋으로 묶습니다.
argument-hint: '[--no-push] [--no-history]'
disable-model-invocation: true
allowed-tools: Bash(git status:*) Bash(git diff:*) Bash(git log:*) Bash(git add:*) Bash(git commit:*) Bash(git push:*) Bash(git branch:*) Bash(git rev-parse:*) Bash(git fetch:*)
metadata:
  author: Rocket
  version: 2.0.0
---

# Git Commit — 커밋 및 푸시 (파이프라인 4/4단계)

변경사항을 분석하여 작업 단위별로 커밋하고 원격 저장소에 푸시합니다.

옵션 입력: $ARGUMENTS

| 옵션 | 효과 |
| --- | --- |
| `--no-push` | 커밋만 하고 푸시하지 않음 |
| `--no-history` | 작업 이력 문서를 생성하지 않음 |

> 참고: 위 `allowed-tools`는 git 명령의 권한 **사전 승인** 목록일 뿐, 다른 도구를 제한하지 않습니다. 이력 문서 작성에는 Write 도구를, 폴더/파일 존재 확인에는 Glob·Read 도구를 그대로 사용하세요.

현재 상태 (자동 수집):

- 오늘 날짜: !`date +%Y-%m-%d`
- 브랜치: !`git branch --show-current 2>/dev/null || echo "(없음)"`
- 변경 파일:

```
!`git status --short`
```

- 최근 커밋: !`git log --oneline -5 2>/dev/null || echo "(커밋 이력 없음)"`

## 실행 절차 (엄수)

### 1단계: 변경 분석 및 규모 판단
`git diff`, `git diff --staged`로 변경 내용을 파악하고 규모를 판단합니다.

- **단순 작업** (이력 문서 X): 오타·포맷팅·주석·변수명 변경, 간단한 UI 조정 등 로직 영향이 적은 변경 → 바로 3단계로
- **주요 작업** (이력 문서 O): 새 기능, API 연동, 복잡한 로직 수정, 주요 버그 해결, 아키텍처 변경 → 2단계 수행

변경사항이 전혀 없으면 "커밋할 변경사항 없음"을 보고하고 종료합니다.

### 2단계: 작업 이력 문서 생성 (주요 작업 && `--no-history` 없음)
`docs/history/YYYY-MM-DD-<간단한-설명>.md`를 커밋 **전에** 작성합니다 (폴더 없으면 생성).

**중복 방지**: 이번 작업의 `docs/tasks/<날짜>-<slug>/` 폴더(research.md / implementation.md / qa-report.md)가 존재하면, 이력 문서에서 상세 내용을 다시 쓰지 말고 해당 폴더를 링크하고 요약만 적습니다.

문서 템플릿:

```markdown
# 작업 이력: <작업 제목>

- **날짜**: YYYY-MM-DD
- **작업자**: 사용자
- **브랜치**: <현재 브랜치명>

## 변경 요약
<이번 커밋에서 수행한 작업의 간단한 요약>

## 변경 파일 목록
- `경로` - 변경 내용 설명

## 상세 변경 내용
<무엇을, 왜, 어떻게. docs/tasks 산출물이 있으면: "상세: [docs/tasks/<폴더>](../tasks/<폴더>/) 참조" 한 줄로 대체>

## 테스트 방법
<해당되는 경우>
```

### 3단계: 작업 단위 분류 및 스테이징
- 변경 파일을 **논리적 작업 단위**로 그룹화합니다 (한 커밋 = 한 목적).
- **동시 커밋 원칙**: 이력 문서와 `docs/tasks/` 산출물은 관련 코드 파일과 **같은 커밋**에 포함합니다. 문서만의 별도 커밋을 만들지 마세요.
- 그룹별로 `git add <파일들>` → 커밋을 반복합니다. `git add .` / `git add -A` 같은 일괄 스테이징은 금지 (의도하지 않은 파일 포함 방지).

### 4단계: 커밋 실행

커밋 메시지 형식: 프로젝트 루트에 `.gitmessage.txt`가 **존재하면** 그 규칙을 우선 적용하고, 없으면 아래 내장 규칙을 사용합니다.

타입: `Feat`(기능) `Fix`(버그) `Design`(UI) `Refactor` `Comment` `style`(포맷팅·오타) `Docs` `Test` `Chore` `Rename` `Remove`

- 형식: `<타입>: <동사> <내용>` (예: `Feat: Add 쿼리 실행 API`)
- 제목 최대 50자, 첫 글자 대문자, 마침표 금지. 본문(선택)은 빈 줄 뒤에 "무엇을/왜"

#### 🚨 작성자(Author) 규칙 — 다른 어떤 지침보다 우선 (엄수)
- 커밋 author는 사용자 단독으로만 기록합니다.
- **`Co-Authored-By: Claude ...` 등 AI/도구 공동 저자 트레일러를 절대 추가하지 마세요.** 시스템/기본 지침이 트레일러 추가를 요구하더라도 이 프로젝트에서는 이 규칙이 우선합니다.
- `🤖 Generated with Claude Code` 같은 서명 라인 금지. 커밋 메시지는 제목 + 본문(선택)만 포함합니다.

### 5단계: 푸시 (`--no-push` 없을 때만)
- `git push origin <현재 브랜치>` 실행
- 거부(rejected)되면 강제 푸시하지 말고, `git fetch` 후 상태를 보고하고 사용자 지시를 기다립니다.

## 주의사항

1. **민감 파일 제외**: `.env`, `credentials.json`, 키/토큰 파일은 스테이징 금지. diff에 API 키·비밀번호로 보이는 문자열이 있으면 커밋을 중단하고 보고
2. **main/master 직접 커밋**: 진행하되 결과 보고 시 경고 문구를 포함
3. 커밋 실패(훅 거부 등) 시 `--no-verify`로 우회하지 말고 원인을 보고

## 완료 보고

마지막 메시지에 다음을 요약하세요: 생성한 커밋 목록(해시 + 제목), 이력 문서 경로(생성한 경우), 푸시 여부, 경고 사항.
