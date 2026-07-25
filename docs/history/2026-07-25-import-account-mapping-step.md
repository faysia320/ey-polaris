# 작업 이력: 엑셀 업로드 자산계정 매핑 스텝 분리

- **날짜**: 2026-07-25
- **작업자**: 사용자
- **브랜치**: main

## 변경 요약
엑셀 업로드를 `입력 → 자산계정 매핑 → 이체 검토 → 결과` 4스텝으로 분리했다. 종전에는 업로드 확정 시점에 결제수단·부동산·대출 계정이 사용자 개입 없이 이름 완전일치/휴리스틱으로 자동 생성됐다. 이제 매핑 스텝에서 엑셀에 등장하는 모든 계정 소스를 소스마다 **기존 계정 연결 / 새로 만들기(유형 지정) / 이번엔 제외** 중 골라 확정하고, 확정된 계정 id로 거래·평가액을 적재한다. `account_mappings`를 보내지 않는 기존 API 호출은 종전 자동 생성 동작을 그대로 유지한다(하위호환).

## 변경 파일 목록
- `backend/app/schemas.py` - 계정 소스/매핑 스키마(`ImportAccountSource`·`ImportAccountMapping`·`ImportAccountMapRequest`·`ImportAccountResolved`·`ImportAccountMapResult`)와 `ImportPreview.account_sources` 추가
- `backend/app/routers/transactions.py` - preview에 계정 소스 반환, 매핑 확정 엔드포인트 `POST /transactions/import/accounts` 신설, `import_transactions`에 `account_mappings` 반영(연결/신규/제외 + 미전달 폴백), 자기 이체·페어 제외 처리
- `frontend/src/types.ts` - 위 스키마에 대응하는 프론트 타입 추가
- `frontend/src/lib/format.ts` - `ACCOUNT_TYPES`·`accountTypeLabel()` 공용화
- `frontend/src/pages/SettingsPage.tsx` - 로컬 `ACCOUNT_TYPES` 제거하고 공용 import
- `frontend/src/pages/TransactionsPage.tsx` - 업로드 다이얼로그 스텝 재구성 및 매핑 스텝 UI, 확정 매핑을 최종 임포트에 전달

## 상세 변경 내용
파이프라인 산출물(research/implementation/qa)로 관리한 작업이다. 설계 근거·성공 기준·검증 내역은 아래 폴더 참조.

상세: [docs/tasks/2026-07-24-import-account-mapping-step](../tasks/2026-07-24-import-account-mapping-step/) 참조

- QA 3회차에서 PASS(AC 14/14, High/Medium 0). 재작업 과정에서 해소한 주요 이슈: 자기 이체 적재(M-1), 제외 항목 표시 정합(M-2), 비활성 계정 매칭 불일치(M-3), 매핑 미전달 임포트의 유령 계정 생성 회귀(H-1), 페어 한쪽 제외 시 422(M-5).

## 테스트 방법
- 백엔드: `docker compose up -d --build` 후 `POST /transactions/import/preview`가 `account_sources`를 반환하는지, `POST /transactions/import/accounts`가 유형 제약(부동산=real_estate, 대출=loan)·구성원 스코프·easy_pay 신규 금지를 검증하는지 확인. `account_mappings` 생략 임포트는 실제 적재되는 계정만 생성.
- 프론트: 업로드 다이얼로그가 매핑 스텝을 거치고, 매핑 확정으로 만든 계정이 이체 검토 스텝의 상대 계정 드롭다운에 즉시 나타나는지 확인. 375px 뷰포트 오버플로 없음.
- `cd frontend && npm run build && npm run lint`
