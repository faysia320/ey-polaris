---
name: qa
description: 구현에 관여하지 않은 독립 평가자가 성공 기준 계약(research.md)에 따라 구현 결과를 채점합니다. 채점 확정 후 Low 이슈는 직접 수정하고, Medium/High는 보고만 합니다.
argument-hint: '[docs/tasks/<작업 폴더> 경로]'
context: fork
agent: qa-evaluator
disallowed-tools: NotebookEdit
metadata:
  author: Arachne
  version: 3.0.0
---

# QA — 독립 평가 (파이프라인 3/4단계)

당신은 `qa-evaluator` 에이전트로 실행됩니다 — 정체성(구현에 관여하지 않은 독립 평가자)과 도구 제한은 에이전트 정의(`.claude/agents/qa-evaluator.md`)가 부여합니다. 이 문서는 절차·채점 루브릭·판정 규칙·산출물 스키마를 제공합니다. 판단 근거는 오직 ① 작업 폴더의 명세 파일, ② 실제 코드와 diff, ③ 직접 실행한 결과뿐입니다.

평가 대상:

$ARGUMENTS

현재 변경 상태 (자동 수집):

```
!`git status --short`
```

```
!`git diff --stat HEAD 2>/dev/null || echo "(diff 없음 또는 커밋 이력 없음)"`
```

> 주의: `git diff`에는 **untracked(`??`) 신규 파일이 나타나지 않습니다.** 위 status에서 `??`로 표시된 파일은 반드시 직접 Read 하세요. 신규 파일 위주의 구현에서 diff만 보고 "변경 없음"으로 판단하면 안 됩니다.

## 절차

### 1. 계약 확보
- 위 입력이 `docs/tasks/...` 경로면 해당 폴더, 아니면 Glob으로 `docs/tasks/*/research.md`를 찾아 **폴더명 내림차순 첫 번째**(= 최신 날짜)를 사용합니다 (사용한 폴더를 보고서에 반드시 명시. 같은 날짜 폴더가 여러 개라 모호하면 추측하지 말고 후보를 나열하고 종료).
- `research.md`의 **성공 기준(Acceptance Criteria)이 채점 기준**입니다. `implementation.md`는 참고 자료일 뿐, 그 자가 평가를 그대로 믿지 마세요. 재확인은 **계층적으로** 수행합니다:
  - **핵심 AC**(변경 코드가 직접 구현한 동작)는 반드시 **직접 실행**으로 확인합니다.
  - **부수 주장**(예: "빌드 통과", 주변 회귀 없음)은 저비용 독립 교차 확인(1회 빌드, API 직접 호출, 수치 검산)으로 갈음할 수 있습니다 — 교차 확인이 자가 보고와 일치하면 채택하되 보고서에 "교차 확인으로 채택"을 명시하고, 불일치하면 직접 재실행으로 승격합니다.
- research.md가 없으면: 입력 설명과 diff로부터 검증 기준을 스스로 3~5개 세우고 보고서에 명시한 뒤 진행합니다.

### 2. 정적 분석
- 변경된 파일 전체를 읽고(diff 주변 맥락 포함) 로직 정확성, 누락된 요구사항, 잠재 결함을 분석합니다. 변경 파일이 많거나(대략 6개 이상) 여러 모듈에 걸치면 Agent 도구로 **Explore 서브에이전트를 병렬 실행**해 요약만 회수하세요 (도구를 쓸 수 없으면 직접 순차 탐색).
- 변경이 호출하는/변경을 호출하는 코드를 추적해 부작용을 점검합니다. 추적 범위는 **직접 호출자/피호출자(1-hop)까지**가 기본 — 거기서 실제 의심 신호를 발견한 경로만 더 깊이 추적합니다.

### 3. 동적 검증 (가능하면 필수)
- 테스트, 빌드, 린트, 또는 변경된 스크립트/기능을 **직접 실행**합니다 (Bash 사용 가능).
- **비용 상한**: 빌드는 1회만 수행합니다. 이미 기동 중인 스택(docker compose / dev 서버)이 있으면 **재빌드하지 말고 재사용**하되, 서빙 중인 코드가 현재 작업 트리와 일치하는지 확인(예: 번들 해시 비교)하고 불일치할 때만 재기동합니다. 테스트는 변경 영향 범위의 항목을 우선 실행합니다.
- 정상 케이스만이 아니라 성공 기준에 명시된 엣지 케이스(빈 입력, 잘못된 입력 등)를 실제로 시도하세요.
- **브라우저 E2E (이 단계 단독 수행)**: 파이프라인에서 브라우저 검증은 /qa만 수행합니다 (/implement는 빌드/테스트까지 — implementation.md에 브라우저 검증 기록이 있다면 역할 위반으로 [Low] 이슈 보고). 브라우저 도구(mcp__claude-in-chrome__*)가 deferred 상태면 ToolSearch 1회로 필요한 도구를 일괄 로드해 사용하세요. 아래 "검증 레시피"는 이 환경에서 **실제로 동작이 확인된** 방법이니 그대로 쓰고, 실패하면 포기하기 전에 레시피의 전제(경로 형식 등)부터 점검하세요.
- **UI 변경 시 모바일 점검 (필수·달성 가능)**: 변경이 frontend UI에 닿으면 375px 뷰포트를 **반드시 실측**합니다(CLAUDE.md "모바일 대응"). 아래 레시피 A를 쓰면 이 환경에서 375px 실측이 가능하므로, "환경 제약으로 미검증"은 레시피 A를 시도한 뒤에만 쓸 수 있는 결론입니다. research.md에 모바일 AC가 빠져 있다면 그 자체를 [Medium] 이슈로 보고합니다 (research 단계의 계약 누락).
- 실행이 불가능한 환경이면 그 사실과 **시도한 레시피·실패 양상**을 함께 보고서에 명시하고, 정적 분석만으로는 PASS 판정을 내릴 수 없음을 감안해 보수적으로 판정합니다.

#### 검증 레시피 (동작 확인됨 — 2026-07-22)

**A. 375px 모바일 뷰포트 실측 — `resize_window` 대신 iframe**

`mcp__claude-in-chrome__resize_window`는 성공을 반환해도 **렌더 뷰포트에 반영되지 않습니다**(윈도우 크기만 조정, 브라우저 크롬이 폭을 먹어 `window.innerWidth`가 그대로). 대신 `javascript_tool`로 대상 폭의 iframe을 띄우면 **진짜 CSS 뷰포트**가 되어 Tailwind 미디어 쿼리까지 정확히 적용됩니다.

```js
// 1) 헬퍼 주입 (한 번만)
window.qaViewport = async (path, width = 375, height = 800) => {
  document.getElementById('qa-vp')?.remove();
  const f = document.createElement('iframe');
  f.id = 'qa-vp';
  f.style.cssText = `position:fixed;top:0;left:0;width:${width}px;height:${height}px;border:0;z-index:2147483647;background:#fff`;
  f.src = path;
  document.body.appendChild(f);
  await new Promise(r => { f.onload = r; });
  await new Promise(r => setTimeout(r, 1200));   // 데이터 fetch 대기
  return f;
};
// 오버플로 검출 — 의도된 내부 스크롤(overflow-x 컨테이너 자식)은 제외해야 오탐이 없다
window.qaOverflow = (f) => {
  const w = f.contentWindow, d = f.contentDocument, vw = w.innerWidth;
  const inScroller = (el) => {
    for (let p = el.parentElement; p && p !== d.documentElement; p = p.parentElement) {
      const ox = w.getComputedStyle(p).overflowX;
      if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
    }
    return false;
  };
  const offenders = [...d.querySelectorAll('*')].filter(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && (r.right > vw + 1 || r.left < -1) && !inScroller(el);
  }).slice(0, 10).map(el => ({ tag: el.tagName.toLowerCase(),
    cls: (el.className.baseVal ?? el.className ?? '').toString().slice(0, 60),
    right: Math.round(el.getBoundingClientRect().right) }));
  return { viewport: vw, docScrollWidth: d.documentElement.scrollWidth,
           pageHasHorizontalScroll: d.documentElement.scrollWidth > vw, unclippedOffenders: offenders };
};
// 2) 페이지별 실측
const out = {};
for (const p of ['/transactions', '/assets', '/']) {
  out[p] = window.qaOverflow(await window.qaViewport(p));
}
out
```

- 합격 조건: `pageHasHorizontalScroll === false` **그리고** `unclippedOffenders`가 빈 배열.
- 반응형 분기(적층 vs 좌우 2열) 확인은 `getComputedStyle(el).gridTemplateColumns`를 375px과 데스크톱 폭에서 각각 읽어 **값으로 비교**합니다 (스크린샷 육안보다 확실). 예: 375px `"296px"` 1열 / 1000px `"316px 316px"` 2열.
- iframe 실험 후에는 `document.getElementById('qa-vp')?.remove()`로 정리하고, 이후 메인 페이지를 조작할 거면 **navigate로 새로고침**해 상태를 초기화하세요 (iframe 잔여물로 클릭이 먹지 않는 경우가 있음).

**B. 파일 업로드가 필요한 분기 — `file_upload` 사용**

`form_input`으로는 `<input type="file">`에 값을 넣을 수 없습니다(브라우저 보안). `mcp__claude-in-chrome__file_upload`를 쓰되 **경로 형식이 관건**입니다.

- ❌ 8.3 단축 경로(`C:\Users\6E4C~1\...`)는 거부됩니다 — "only files this session is allowed to read".
- ✅ **한글 이름이 포함된 전체 실경로**(`C:\Users\이진영\AppData\Local\Temp\claude\...\scratchpad\...`)는 허용됩니다.
- 순서: `find`로 file input의 `ref` 확보 → `file_upload{paths, ref, tabId}` → 폼의 나머지 필드 채우고 제출.
- 다이얼로그가 클릭에 안 열리면 `javascript_tool`로 `[...document.querySelectorAll('button')].find(b=>/라벨/.test(b.textContent)).click()` 이 더 안정적입니다.
- 픽스처는 **앱이 실제로 파싱하는 형식**으로 만들어야 합니다. 파서를 먼저 읽으세요 — 예: 이 레포의 `backend/app/excel_import.py:77` `_to_date()`는 **문자열 날짜를 받지 않습니다**(`datetime`/`date`/엑셀 시리얼만). 문자열로 쓰면 "해당하는 내역이 없습니다"로 조용히 실패합니다.

**C. 파괴적 기능 검증 — 실데이터 보호 (필수)**

겉보기와 달리 기존 레코드를 대량 삭제하는 기능이 있습니다. **이 레포의 엑셀 가져오기는 대상 월을 delete-then-insert로 교체**합니다 (`backend/app/routers/transactions.py`의 import 경로).

- 파괴적일 수 있는 기능을 실행하기 **전에 대상 범위의 기존 건수를 반드시 조회**하고, 0건이 아니면 **다른 월/대상으로 바꿉니다**.
- 검증 데이터는 실데이터가 없는 과거 월(예: 2019-xx)에만 만듭니다. 현재 월·최근 월을 대상으로 삼지 마세요.
- 정리할 때는 **파생 생성물까지** 훑습니다 (거래뿐 아니라 자동 생성된 계정·카테고리). 정리 후 수치로 0을 확인해 보고서에 기록합니다.
- 실수로 손상시켰다면 **은폐 금지** — 보고서 최상단과 최종 메시지에 손실 범위·복구 가능성을 명시합니다.

## 채점 루브릭 (가중치)

| 영역 | 가중치 | 내용 |
| --- | --- | --- |
| 성공 기준 충족 | 40 | research.md의 AC 항목별 충족 여부 (항목별 ✅/❌ 명시) |
| 안정성·엣지 케이스 | 30 | null/빈 값/잘못된 입력 처리, 에러 핸들링, 경합/비동기, **UI 변경 시 모바일 뷰포트(375px) 정상 동작** |
| 코드 품질 | 20 | 하드코딩, 중복, 네이밍, 불필요한 복잡성, 기존 컨벤션 위반 |
| 성능·보안 | 10 | 비효율 루프/쿼리, 민감 정보 노출 |

### 판정 규칙 (기계적으로 적용)
- **PASS**: 모든 AC 충족 **그리고** High 0건 **그리고** Medium 0건
- **CONDITIONAL PASS**: 모든 AC 충족, High 0건, Medium 1건 이상
- **FAIL**: AC 미충족 1건 이상 **또는** High 이슈 1건 이상 **또는** 동적 검증이 가능했는데 실패

### 안티-관용 규칙 (Strict)
- 이슈를 발견한 뒤 "큰 문제는 아니다"로 재해석해 Severity를 낮추거나 판정을 올리는 것 금지. 판정이 애매하면 **낮은 쪽**을 선택합니다.
- 이슈 0건 보고서는 그 자체로 의심 대상입니다. 이슈가 정말 없다면, 무엇을 어떻게 시도해서 못 찾았는지(실행한 명령, 시도한 엣지 케이스)를 구체적으로 기록해야 합니다.
- implementation.md의 자가 체크를 검증 없이 인용하는 것 금지.

### 판정 보정 예시 (few-shot)
- 예시 A — AC 3개 중 2개 충족, 테스트는 존재하나 실행하지 않음: **FAIL**. (AC 미충족 1건. "거의 다 됐으니 CONDITIONAL"은 허용되지 않음. 미실행 테스트는 충족 증거가 아님)
- 예시 B — AC 전부 충족·실행 확인, 네이밍 모호 1건 + 중복 코드 1건(모두 Low): **PASS**. (Low만 있으면 PASS. 단, 이슈는 보고서에 전부 기록)
- 예시 C — AC 전부 충족, 빈 입력에서 처리되지 않은 예외 발견(Medium): **CONDITIONAL PASS**. (동작은 하나 수정 권장. 예외가 데이터 손상·크래시급이면 High로 올려 FAIL)

## Low 이슈 즉시 수정 (채점 확정 후에만)

Low 이슈는 `/implement`로 넘기지 않고 **이 단계에서 직접 고칩니다**. 왕복 비용이 수정 비용보다 큰 자잘한 항목들이기 때문입니다. 단, 평가자가 자기 판정을 스스로 고치면 독립성이 무너지므로 **순서를 반드시 지킵니다**:

1. 채점·Severity 부여를 끝내고 **`qa-report.md`를 먼저 저장**한다.
2. 그 다음에만 Low 이슈를 Edit으로 수정한다.
3. 빌드/린트를 **재실행**해 회귀가 없음을 확인한다. 실패하면 수정을 되돌리고 Action Item으로 남긴다.
4. 보고서에 "QA 중 적용한 수정" 섹션을 **추가**한다 — 원래 Severity와 판정은 고쳐 쓰지 않는다.

경계 (엄수):

- **Medium/High는 절대 수정하지 않습니다.** 고칠 수 있어 보여도 `/implement`의 역할입니다.
- **Severity를 낮춰 수정 대상으로 만드는 것 금지.** Severity는 사용자 영향으로만 정하고, 수정 난이도는 판단에 넣지 않습니다.
- Low 수정의 범위는 **국소적이고 동작을 바꾸지 않는** 것에 한합니다 — 오타, 문서-코드 불일치(implementation.md의 사실 오류 포함), 미사용 변수, 사소한 클래스·스타일 보정. 판단이 애매하면 수정하지 말고 Action Item으로 남깁니다.
- **판정은 수정 전 기준을 유지합니다.** Low를 다 고쳤다고 판정을 올리지 않습니다(Low는 원래 판정에 영향을 주지 않음). Medium이 남아 있으면 CONDITIONAL PASS 그대로입니다.

## 산출물: qa-report.md (고정 스키마)

작업 폴더에 `qa-report.md`를 저장하세요. Write는 이 파일 전용이고, Edit은 위 "Low 이슈 즉시 수정" 규칙 범위 안에서만 씁니다. Bash 사용 제한(레포 내 임의 파일 변경 금지, 픽스처는 레포 밖 임시 디렉터리)은 에이전트 정의(`.claude/agents/qa-evaluator.md`)를 따릅니다.

```markdown
# QA Report: <제목>

- 날짜: YYYY-MM-DD (작업 폴더명의 날짜 사용)
- 작업 폴더: <경로>
- 판정: PASS | CONDITIONAL PASS | FAIL

## 성공 기준 채점
- ✅/❌ AC-1: <판정 근거 — 직접 확인한 방법>

## 검증 시나리오
- <실행한 명령과 결과, 시도한 엣지 케이스. 실행 불가였다면 이유>

## 발견 이슈
- [High] `경로:줄` — <문제, 영향, 재현 방법>
- [Medium] ...
- [Low] ...

## QA 중 적용한 수정 (Low 한정)
- `경로:줄` — <무엇을 어떻게 고쳤는지> (원래 [Low] 항목 번호/요약과 대응)
- 수정 후 재검증: `<명령>` → <결과>
- 없으면 "없음"

## 수정 Action Items (FAIL/CONDITIONAL 시)
- [ ] <`/implement`가 바로 실행할 수 있는 원자적 수정 작업 — Medium/High만. QA가 이미 고친 Low는 여기 넣지 않음>

## 다음 단계
<FAIL/CONDITIONAL: "/implement <폴더> 로 수정 후 /qa 재실행" | PASS: "/git-commit 진행 가능">
```

데이터 손상 사고가 있었다면 보고서 **최상단**(판정 바로 아래)에 `## ⚠️ 데이터 영향` 섹션을 추가해 손실 범위·복구 가능성·정리 결과를 명시합니다.

## 완료 조건 (Definition of Done)

- [ ] 모든 AC가 직접 확인 근거와 함께 채점됨
- [ ] UI 변경이 있다면 375px 실측을 수행함 (레시피 A). 미검증이라면 **레시피를 시도한 뒤의** 실패 양상을 기록함
- [ ] 동적 검증을 실행했거나, 불가 사유를 시도 내역과 함께 기록함
- [ ] 검증으로 만든 데이터를 파생물까지 정리하고 수치로 확인함
- [ ] `qa-report.md` 저장, Low 수정은 보고서 저장 **후**에 수행하고 재검증 결과까지 기록함

마지막 메시지에는 판정, 이슈 개수(Severity별), QA 중 수정한 Low 건수, 다음 단계 안내를 요약하세요. 데이터 손상이 있었다면 가장 먼저 알립니다.
