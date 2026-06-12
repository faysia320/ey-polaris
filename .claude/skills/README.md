# 개발 파이프라인 스킬 (하네스 엔지니어링)

이 폴더의 4개 스킬은 하나의 개발 파이프라인을 구성한다. 설계 기반: [Anthropic — Harness design for long-running agents](https://www.anthropic.com/engineering/harness-design-long-running-apps).

```
/research ──→ /implement ──→ /qa ──→ /git-commit
 (플래너·조사)   (생성자)      (독립 평가자)   (기록·커밋)
                    ↑              │
                    └── FAIL 시 루프 ┘
```

| 스킬 | 역할 | 산출물 |
| --- | --- | --- |
| `/research <요청>` | 읽기 전용 조사 + 검증 가능한 성공 기준(계약) 수립 | `docs/tasks/<날짜>-<slug>/research.md` |
| `/implement [폴더]` | 계약 기반 구현 + 자체 검증(빌드/테스트) | `implementation.md` |
| `/qa [폴더]` | 포크된 `qa-evaluator` 에이전트가 계약 채점 (PASS/CONDITIONAL/FAIL) | `qa-report.md` |
| `/git-commit [옵션]` | 논리 단위 커밋 + docs/history 이력 문서 + 푸시 | 커밋 |

## 인계 계약 (파일 기반 상태)

모든 단계는 `docs/tasks/<YYYY-MM-DD>-<slug>/` 폴더의 파일로 상태를 주고받는다. 따라서:

- 각 단계는 **새 세션(/clear 후)에서도 독립 실행 가능**하다. 단계 사이에 컨텍스트를 리셋하는 것을 권장한다 (긴 대화 누적보다 깨끗한 컨텍스트 + 구조화된 인계가 품질이 높음).
- 인자 없이 실행하면 가장 최근 작업 폴더를 자동 탐색한다 (통일 규칙: **폴더명 사전식 내림차순 첫 번째** = 최신 날짜. 같은 날짜 폴더가 여럿이면 자동 선택하지 않고 사용자에게 확인). 명시적으로 폴더를 넘기는 것이 항상 더 안전하다.
- `/qa`가 FAIL/CONDITIONAL PASS를 내면 qa-report.md의 "수정 Action Items"를 입력으로 `/implement`를 재실행한다 (생성자↔평가자 루프).

## 하네스 가정 테이블 (load-bearing 점검표)

하네스의 모든 구성요소는 "모델이 스스로 못 한다"는 가정을 인코딩한다. 가정은 모델이 좋아지면 낡는다. **모델을 교체(예: Fable → Opus 차기 버전)하면 아래 항목을 하나씩 제거해 보며 여전히 필요한지(load-bearing) 확인하라.**

| 구성요소 | 인코딩된 가정 | 제거 실험 방법 |
| --- | --- | --- |
| `disallowed-tools`로 읽기 전용 강제 (research/qa) | 모델이 프롬프트 지시만으로는 "수정 금지"를 일관되게 지키지 못함 | frontmatter에서 제거 후 10회 실행, 위반 0이면 프롬프트 규칙만으로 충분. ※ Bash·Write는 차단되지 않음(보고서 저장·검증 실행에 필요) — 이 부분은 프롬프트 규칙으로만 제한되는 알려진 빈틈 |
| `qa-evaluator` 전용 에이전트 (`.claude/agents/`, 도구 **allowlist**) | blocklist(`disallowed-tools`)는 명시한 도구만 막는다 — 평가자에게는 필요한 도구만 여는 allowlist가 안전하고, 시스템 프롬프트의 평가자 정체성은 스킬 프롬프트보다 오래 유지됨 | qa 스킬의 `agent:`를 `general-purpose`로 되돌려 같은 결함 세트에 대한 판정·도구 사용을 비교. ※ Bash 리다이렉트·Write 오용은 allowlist로도 못 막는 잔여 빈틈(프롬프트 제한 유지) |
| 파일 기반 인계 (docs/tasks) | 긴 대화 누적 시 컨텍스트 품질 저하·세션 단절 취약 | 같은 세션에서 파일 없이 연속 실행해 품질 비교. 단, 세션 간 재개·감사 기록 가치는 모델 무관 |
| `/qa`의 `context: fork` (독립 평가자) | 자기 작업을 자기 컨텍스트에서 평가하면 자기 관용(self-lenience) 발생 | fork 제거 후 같은 결함 세트에 대한 판정 엄격도 비교 |
| qa의 수치 루브릭 + 판정 규칙 + few-shot 예시 | 추상적 품질 판단은 모델·실행마다 드리프트함 | 예시/가중치 제거 후 동일 입력 반복 실행으로 판정 분산 측정 |
| Action Item 단위 점진 구현 + TodoWrite | 큰 작업을 한 번에 구현하면 일관성 상실 | 작은 과제부터 분해 없이 실행해 품질 비교 (신형 모델은 분해 불필요해지는 경향) |
| `!`git ...`` 동적 컨텍스트 주입 | 모델이 상태 확인 명령을 가끔 빠뜨림 | 주입 제거 후 상태 확인을 스스로 수행하는지 관찰 |
| 모바일 AC 강제 (research: UI 작업이면 모바일 AC 필수, qa: 루브릭에 375px 점검) | CLAUDE.md의 일반 지시("모바일 신경 쓰기")만으로는 횡단 품질 요구가 일관되게 계약·채점에 반영되지 않음 | 스킬 규칙을 제거하고 CLAUDE.md 지시만 남긴 뒤 UI 작업 N회에서 모바일 AC 포함률·qa 검출률 비교 |
| `disable-model-invocation` (implement/git-commit) | — (모델 능력 가정이 아니라 **권한 정책**: 부작용 있는 단계는 사용자가 타이밍을 통제) | 제거 대상 아님 |

## 에이전트 정의 (.claude/agents/)

스킬과 에이전트 정의는 다른 축이다 — **스킬은 절차와 계약**(순서, 루브릭, 산출물 스키마), **에이전트는 실행자**(정체성, 도구 집합)를 정의한다. 같은 내용을 양쪽에 두면 드리프트하므로, 루브릭·판정 규칙은 스킬에만, 도구 제한·정체성은 에이전트에만 둔다.

| 에이전트 | 용도 | 도구 |
| --- | --- | --- |
| `qa-evaluator` | `/qa`의 포크 실행자. Edit·NotebookEdit이 구조적으로 없는 독립 평가자 | Read, Grep, Glob, Bash, Write (allowlist) |

새 에이전트는 "범용 에이전트로는 안 된다"는 가정이 실제로 확인될 때만 추가한다 (예: 구현 병렬화가 필요해지면 `frontend-dev`/`backend-dev`). 추가 시 위 하네스 가정 테이블에도 행을 추가할 것.

## 운영 메모

- 스킬 frontmatter는 공식 스펙 키만 사용한다 (`mode:` 같은 비표준 키는 조용히 무시되므로 금지). 스펙: https://code.claude.com/docs/en/skills.md
- `!`...`` 동적 주입은 기본적으로 **bash**로 실행된다 (Windows에서도 git-bash). PowerShell 문법을 쓰지 말 것.
- 각 SKILL.md는 500줄 이하 유지. 상세 자료가 커지면 스킬 폴더에 보조 파일로 분리.
- 커밋 author는 사용자 단독 — AI 공동 저자 트레일러 금지 (git-commit 스킬 참조).
