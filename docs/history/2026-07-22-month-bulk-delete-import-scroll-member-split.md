# 작업 이력: 월 일괄 삭제 · 업로드 모달 스크롤 · 자산 구성원별 분할

- **날짜**: 2026-07-22
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약

사용자 요청 3건을 한 사이클로 처리했다.

1. **지출/수입 내역에 해당 월 일괄 삭제 기능 추가** — 현재 조회 필터에 걸리는 거래만 삭제 (사용자 결정 Q1 = 2번)
2. **엑셀 업로드 확인 모달 스크롤 문제 수정** — 평가액이 많으면 모달이 뷰포트를 벗어나 잘리던 문제
3. **자산 상태 "전체" 보기에서 자산 유형별 카드 안을 구성원별로 좌/우 분할** (구성원 2명 고정 — 사용자 결정 Q6)

## 변경 파일 목록

- `backend/app/routers/transactions.py` — 필터 조건 빌더 `_filter_conditions()` 추출(목록 조회와 삭제가 공유), `DELETE /transactions` 월 일괄 삭제 엔드포인트 추가
- `backend/app/schemas.py` — `BulkDeleteResult` 추가, `AccountBalance`에 `member_id`/`member_name` 추가
- `backend/app/routers/analytics.py` — 계정 조회에 `selectinload(Account.member)`(N+1 방지), `AccountBalance` 조립부에 구성원 주입
- `frontend/src/lib/api.ts` — `api.delete`를 `<T = void>`로 제네릭화 (204/200+본문 모두 지원)
- `frontend/src/stores/transactions.ts` — `removeMonth()` 액션 추가 (현재 필터 그대로 전송, 삭제 건수 반환)
- `frontend/src/pages/TransactionsPage.tsx` — 툴바 "월 전체 삭제" 버튼, 확인 다이얼로그, 삭제 안내(`pageNotice`)와 실패 에러(`bulkDeleteError`), 업로드 다이얼로그 본문 `ScrollArea`화
- `frontend/src/pages/AssetsPage.tsx` — `renderAccountCard` 헬퍼 추출, 자산 유형 카드 내부 구성원별 분할
- `frontend/src/types.ts` — `AccountBalance`에 구성원 필드 동기화

## 상세 변경 내용

상세: [docs/tasks/2026-07-22-month-bulk-delete-import-scroll-member-split](../tasks/2026-07-22-month-bulk-delete-import-scroll-member-split/) 참조 (research.md / implementation.md / qa-report.md)

핵심 설계 판단만 옮기면:

- **삭제 조건을 한 곳에서 정의한 이유**: "현재 필터 적용분만 삭제"가 계약이므로 목록 조회와 삭제의 조건이 어긋나면 "화면에 보이는 것만 지운다"가 즉시 깨진다. `_filter_conditions()`를 두 엔드포인트가 공유한다.
- **전체 삭제 사고 3중 방어**: API `month` 필수(422) + store `removeMonth()` 가드 + 버튼 비활성. 월 미선택("전체 기간") 상태에서 전 기간이 삭제되는 것을 막는다.
- **삭제는 단일 쿼리**: `major` 필터가 EXISTS 상관 서브쿼리지만 `delete().where(*conditions)` 한 문장에 실린다. 초기 2단계(`select id` → `delete ... IN`) 구현은 TOCTOU 구간과 bind 파라미터 상한 문제가 있어 단순화했다.
- **모달 스크롤의 진짜 원인**: `DialogContent`에 `max-h`/`overflow`가 없어 Radix의 `top-1/2 -translate-y-1/2` 고정 배치와 겹치면 화면 밖으로 잘리고 스크롤로도 닿지 않았다. 해당 다이얼로그에만 `max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]`를 적용하고 본문을 `ScrollArea`로 감쌌다(`ui/dialog.tsx` 전역 수정은 다이얼로그 9곳이 회귀 대상이 되어 배제). 내부 중첩 `ScrollArea` 2개는 휠 이벤트가 갇히므로 제거했다.
- **구성원 목록을 응답에서 도출**: 이름을 하드코딩하지 않고 `assets.accounts`의 `member_id`→`member_name`으로 만든다. `member_id` 오름차순이라 좌측 으니(id=1) / 우측 영이(id=2)가 자연히 성립한다.

## 테스트 방법

```bash
cd frontend && npm run build && npm run lint
docker compose up -d --build db backend       # 백엔드 코드 변경분 반영 필요
```

- **월 일괄 삭제**: 지출/수입 내역 → 조회 월 선택 → "월 전체 삭제" → 확인 문구의 월·건수 확인 후 실행. 필터(구분/대분류/구성원)를 걸면 그 조건에 맞는 거래만 삭제되는지 확인. 월을 비우면("전체 기간") 버튼이 비활성인지 확인
- **업로드 모달**: 부동산·주식 평가액이 많은 .xlsx를 업로드해 확인 화면이 뷰포트 안에 들어오고 본문만 스크롤되며 헤더/푸터가 고정되는지 확인
- **자산 분할**: 자산 상태에서 구성원 필터를 "전체"로 두고 은행/현금/카드 등 카드 안이 좌/우로 나뉘는지, 특정 구성원 선택 시 분할이 사라지는지 확인
- **모바일**: 375px 뷰포트에서 위 3개 화면 모두 가로 스크롤·겹침·잘림이 없는지 확인

## 참고

이번 사이클에서 `/qa` 파이프라인 도구도 함께 개선했다(별도 커밋). 375px 실측이 `resize_window`로는 불가능하고 iframe 방식이 필요하다는 점, `file_upload`에 8.3 단축 경로가 거부된다는 점, 그리고 **엑셀 가져오기가 대상 월을 delete-then-insert로 교체**하므로 검증 시 실데이터를 파괴할 수 있다는 점이 검증 과정에서 드러나 규칙으로 명문화했다.
