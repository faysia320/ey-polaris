# 작업 이력: 자산 내역 삭제 · 주식 엑셀 제외 및 총합 직접 입력

- **날짜**: 2026-07-22
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

사용자 요청 2건을 한 사이클로 처리했다.

1. **자산 상태에서 자산 내역 삭제** — 자산 계정과 평가액 스냅샷 양쪽을 삭제 가능하게 (사용자 결정: 둘 다)
2. **주식을 엑셀 업로드 대상에서 제외하고 보유 총합을 직접 입력** — 개별 종목 계정 대신 구성원별 "주식 총합" 계정 1개로 통합 (사용자 결정)

두 요청은 맞물려 있다. 엑셀이 종목·증권사 단위로 만들어 둔 주식 계정 10개를 정리해야 총합 입력 방식이 성립하는데, 그 정리 수단이 1번의 계정 삭제 UI다.

## 변경 파일 목록

- `backend/app/excel_import.py` — `VALUATION_ITEM_TYPES`에서 `"투자성 자산": "stock"` 제거(부동산만 매핑), `parse_valuations` docstring·`ParsedValuation` 주석 갱신
- `backend/app/routers/transactions.py` — `_effective_valuations`의 동명 계정 유형 가드를 `!= "real_estate"`로 축소, 확정 경로 주석 갱신
- `backend/app/schemas.py` — `ImportValuationRow.account_type`를 `Literal["real_estate"]`로 축소, 미리보기/결과 필드 설명에서 주식 제거
- `frontend/src/types.ts` — `ImportValuationRow.account_type`를 백엔드와 동기화
- `frontend/src/pages/TransactionsPage.tsx` — `VALUATION_TYPE_LABEL` 키 축소, 미리보기·결과 문구 "부동산·주식" → "부동산"
- `frontend/src/pages/AssetsPage.tsx` — 계정 카드 삭제 버튼, 계정 삭제 확인 다이얼로그, 평가액 삭제 확인 다이얼로그, 주식 전용 문구(`isStock`) 분기, `CardTitle`에 `min-w-0`

## 상세 변경 내용

상세: [docs/tasks/2026-07-22-asset-delete-and-stock-manual-total](../tasks/2026-07-22-asset-delete-and-stock-manual-total/) 참조 (research.md / implementation.md / qa-report.md)

핵심 설계 판단만 옮기면:

- **주식 제외의 차단 지점은 파싱 단계 한 곳**: `VALUATION_ITEM_TYPES`에서 분류 매핑만 지우면 `parse_valuations`가 매핑에 없는 분류를 이미 건너뛰므로 미리보기·확정·계정 자동생성 어디에도 주식이 도달하지 않는다. 여기에 `_effective_valuations`의 유형 가드 축소를 더해, 엑셀의 *부동산* 행이 기존 *stock* 계정과 동명인 우회 경로까지 막았다 (QA가 이 케이스를 픽스처로 실증).
- **`VALUATION_TYPES`에 `stock`은 유지**: 주식은 여전히 평가액 스냅샷으로 잔액을 관리한다. 달라진 건 값의 출처(엑셀 → 직접 입력)뿐이라, 유형에서 빼면 총합 입력 UI 자체가 사라진다.
- **계정 통합 시 날짜별 합계를 이관**: 최신 평가액만 옮기면 6월 스냅샷이 사라져 "월별 자산 추이" 차트가 왜곡된다. `(날짜, 합계)` 단위로 전부 승계해 2026-06-17·2026-07-21 두 시점을 보존했고, 최신 기준 합계가 통합 전 21,657,436원과 정확히 일치함을 확인했다.
- **계정 삭제와 평가액 삭제의 파급이 다르다**: 평가액은 `ondelete=CASCADE`라 계정과 함께 사라지지만, 거래는 `RESTRICT`라 참조 중이면 409로 막힌다. 확인 다이얼로그가 "평가 이력도 함께 삭제된다"를 명시하고, 409 시에는 다이얼로그를 유지한 채 백엔드 메시지를 그대로 보여준다.
- **모바일 잘림의 원인은 grid track**: 계정명 span에만 `min-w-0 truncate`를 걸었더니 375px에서 삭제 버튼이 잘렸다. shadcn `CardHeader`가 `display:grid`이고 그리드 아이템인 `CardTitle`의 `min-width`가 `auto`라 트랙이 max-content(293.4px)로 부풀어, 안쪽 span에는 애초에 넘칠 폭이 없어 truncate가 발동하지 않은 것. **그리드 아이템 자신**에 `min-w-0`을 줘야 트랙이 가용 폭(264px)으로 제한된다. 공용 `card.tsx`는 다른 화면 회귀를 피해 건드리지 않았다.

## 데이터 변경 (코드 외)

개발 DB의 주식 계정 10개를 구성원별 2개(`주식(으니)` / `주식(영이)`)로 통합했다. 거래 참조가 0건이라 FK 제약에 걸리지 않았고, 실행 전 `pg_dump` 백업을 떴다.

**1회성 작업이라 Alembic 마이그레이션도 스크립트 파일도 레포에 두지 않았다** — 재실행하면 통합 계정이 중복 생성되기 때문이다. 실행한 SQL 원문과 적용 결과는 `implementation.md`의 "통합 SQL 기록" 절에 남겼다.

## 테스트 방법

```bash
cd frontend && npm run build && npm run lint
docker compose up -d --build backend frontend   # 소스 볼륨 마운트가 없어 재빌드 필요
```

- **자산 계정 삭제**: 자산 상태 → 계정 카드 우상단 휴지통 → 확인 문구에 계정명·"평가 이력도 함께 삭제" 안내가 있는지, 취소 시 계정이 유지되는지 확인. 거래가 있는 계정은 409 메시지가 다이얼로그 안에 뜨고 닫히지 않아야 한다
- **평가액 삭제**: 평가액 갱신 다이얼로그 → 평가 이력의 휴지통 → 중첩 확인 다이얼로그에서 날짜·금액 확인 후 삭제. 이력·총자산이 즉시 갱신되는지 확인
- **주식 총합 입력**: 주식 계정 카드의 "총합 입력" → 기준일·총합 저장 → 카드 금액과 평가 기준일, 총자산 반영 확인
- **엑셀 주식 제외**: 뱅샐현황에 "투자성 자산" 행이 있는 .xlsx 업로드 → 미리보기·결과에 부동산만 나오고, 주식 계정의 잔액·평가 기준일이 업로드 전후 동일한지 확인
- **모바일**: 375px 뷰포트에서 자산 페이지의 계정 카드(특히 계정명이 긴 카드)와 두 확인 다이얼로그에 가로 스크롤·겹침·잘림이 없는지 확인

## 참고

`/qa` 1차에서 모바일 잘림으로 FAIL(Medium 1건) → 수정 후 2차 PASS. 남은 Low 4건(아이콘 터치 크기 28px, `deleteAccount`의 삭제/재조회 실패 미구분, 닫힘 애니메이션 중 계정명 공백 렌더, 설정 페이지 계정 삭제는 여전히 확인 없음)은 사유와 함께 `implementation.md`에 후속 항목으로 기록했다.
