import { useEffect, useMemo, useState } from "react";
import type { EChartsOption } from "echarts";
import { Pencil, Plus, Target, Trash2 } from "lucide-react";

import { EChart } from "@/components/charts/EChart";
import { MemberFilterSelect } from "@/components/members/MemberFilterSelect";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { formatKRW, todayISO } from "@/lib/format";
import { touchTarget } from "@/lib/utils";
import { useAnalyticsStore } from "@/stores/analytics";
import { useGoalStore } from "@/stores/goals";
import { useMasterDataStore } from "@/stores/masterData";
import { useMemberFilterStore } from "@/stores/memberFilter";
import type { AccountBalance, AccountType, Goal, Valuation } from "@/types";

// 그룹 표시 순서 = 이 맵의 키 순서. 대출(부채)은 맨 끝에 두어 자산 그룹 아래에 노출한다.
const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: "은행",
  cash: "현금",
  card: "카드",
  easy_pay: "간편결제",
  e_money: "전자금융자산",
  investment: "투자",
  stock: "주식",
  real_estate: "부동산",
  deposit: "보증금",
  other: "기타",
  loan: "대출",
};

// 간편결제 계정은 패스스루로 잔액이 연결 카드/은행에 귀속(잔액 0으로 수렴)되므로
// 자체 그룹으로 노출하지 않는다.
const HIDDEN_GROUP_TYPES: AccountType[] = ["easy_pay"];

/** 평가액 스냅샷으로 잔액을 관리하는 시세형 계정 유형 */
const VALUATION_TYPES: AccountType[] = ["stock", "real_estate"];

/** 주식은 개별 종목이 아니라 보유 총합을 직접 입력한다 (엑셀 업로드 반영 대상 아님) */
const isStock = (type: AccountType) => type === "stock";

export function AssetsPage() {
  const { assets, fetchAssets } = useAnalyticsStore();
  const memberId = useMemberFilterStore((s) => s.memberId);
  const {
    items: goalItems,
    loaded: goalsLoaded,
    fetch: fetchGoals,
    create: createGoal,
    update: updateGoal,
    remove: removeGoal,
  } = useGoalStore();
  // 자산 조회 자체가 실패한 치명적 상태 — 페이지를 통째로 대체한다
  const [error, setError] = useState<string | null>(null);
  // 삭제는 성공했으나 목록 재조회만 실패한 비치명적 알림 — 페이지는 그대로 두고 배너로만 알린다
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  // 목표 조회/삭제 실패는 페이지 전체가 아니라 목표 카드 안에서만 보여준다
  const [goalListError, setGoalListError] = useState<string | null>(null);

  // 평가액 갱신 다이얼로그
  const [valuationTarget, setValuationTarget] = useState<AccountBalance | null>(
    null,
  );
  const [valuationDate, setValuationDate] = useState(todayISO());
  const [valuationValue, setValuationValue] = useState("");
  const [valuationError, setValuationError] = useState<string | null>(null);
  const [valuationHistory, setValuationHistory] = useState<Valuation[]>([]);
  // 평가액 삭제 확인 — 평가액 갱신 다이얼로그 위에 겹쳐 뜬다.
  // 계정 id를 열 때 함께 캡처해 두면 바깥 다이얼로그가 먼저 닫혀도 삭제가 성립한다.
  const [valuationToDelete, setValuationToDelete] = useState<{
    accountId: number;
    valuation: Valuation;
  } | null>(null);
  const [valuationDeleteError, setValuationDeleteError] = useState<
    string | null
  >(null);
  const [valuationDeleting, setValuationDeleting] = useState(false);

  // 자산 계정 삭제 확인
  // 삭제는 api를 직접 호출하고(위 confirmAccountDelete 주석 참조) 마스터 데이터만 재동기화한다
  const fetchAllMasterData = useMasterDataStore((s) => s.fetchAll);
  const [accountToDelete, setAccountToDelete] = useState<AccountBalance | null>(
    null,
  );
  const [accountDeleteError, setAccountDeleteError] = useState<string | null>(
    null,
  );
  const [accountDeleting, setAccountDeleting] = useState(false);

  // 목표 추가/수정 다이얼로그
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    // 자산 조회가 성공하면 이전 실패 상태를 모두 해제한다 — error(전면 에러 화면)와
    // refreshNotice(삭제 후 재조회 실패 배너) 둘 다. 해제 경로가 없으면 일시적 장애가
    // 풀린 뒤에도 경고가 계속 남는다. error 화면일 때는 MemberFilterSelect까지 대체되어
    // 필터로는 재조회를 못 하므로, 그 경우의 복구는 라우팅 이동→복귀(리마운트) 시 이 effect
    // 재실행으로 이뤄진다. refreshNotice는 페이지가 살아 있어 필터 변경으로도 해제된다.
    fetchAssets(memberId)
      .then(() => {
        setError(null);
        setRefreshNotice(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [fetchAssets, memberId]);

  useEffect(() => {
    if (!goalsLoaded)
      fetchGoals().catch((e: Error) => setGoalListError(e.message));
  }, [fetchGoals, goalsLoaded]);

  // 구성원 필터가 "전체"일 때만 자산 유형 안에서 구성원별로 나눠 보여준다.
  // 구성원 목록은 응답에서 도출하므로 이름을 하드코딩하지 않는다 (id 오름차순 = 좌→우).
  const splitMembers = useMemo(() => {
    if (memberId !== null || !assets) return [];
    const byId = new Map<number, string>();
    for (const a of assets.accounts) byId.set(a.member_id, a.member_name);
    return [...byId.entries()]
      .sort(([a], [b]) => a - b)
      .map(([id, name]) => ({ id, name }));
  }, [memberId, assets]);

  const trendOption = useMemo<EChartsOption>(() => {
    const trend = assets?.trend ?? [];
    return {
      tooltip: { trigger: "axis", valueFormatter: (v) => formatKRW(Number(v)) },
      grid: { left: 80, right: 24, top: 24, bottom: 32 },
      xAxis: { type: "category", data: trend.map((p) => p.month) },
      yAxis: {
        type: "value",
        axisLabel: { formatter: (v: number) => `${v / 10000}만` },
      },
      series: [
        {
          name: "총자산",
          type: "line",
          smooth: true,
          symbolSize: 6,
          areaStyle: { opacity: 0.15 },
          lineStyle: { width: 2, color: "#fde047" },
          itemStyle: { color: "#fde047" },
          data: trend.map((p) => p.total),
        },
      ],
    };
  }, [assets]);

  // 이력 조회/삭제 실패는 다이얼로그 내 에러로만 표시한다 (페이지 전역으로 흘리지 않기)
  const loadValuationHistory = (accountId: number) =>
    api
      .get<Valuation[]>(`/accounts/${accountId}/valuations`)
      .then(setValuationHistory)
      .catch((e: Error) =>
        setValuationError(`이력을 불러오지 못했습니다: ${e.message}`),
      );

  const openValuation = (account: AccountBalance) => {
    setValuationTarget(account);
    setValuationDate(todayISO());
    setValuationValue(account.valued_at ? String(account.balance) : "");
    setValuationError(null);
    setValuationHistory([]);
    void loadValuationHistory(account.id);
  };

  // 유형별 그리드와 구성원별 분할 양쪽에서 같은 계정 카드를 쓴다
  const renderAccountCard = (a: AccountBalance) => (
    <Card key={a.id} className={a.is_active ? "" : "opacity-50"}>
      <CardHeader>
        {/* CardHeader가 grid라 CardTitle(그리드 아이템)의 min-width:auto가 트랙을
            max-content로 밀어올린다 — min-w-0을 여기에도 줘야 안쪽 truncate가 작동한다 */}
        <CardTitle className="flex min-w-0 items-center justify-between gap-2 text-base">
          <span className="min-w-0 truncate">{a.name}</span>
          <span className="flex shrink-0 items-center gap-1">
            {!a.is_active && <Badge variant="secondary">비활성</Badge>}
            {/* 시각적 크기는 앱 전역 icon-sm(28px) 관례를 따르되, 터치 히트 영역만
                의사요소로 44px까지 넓힌다 (touchTarget = 28 + inset 8*2) */}
            <Button
              variant="ghost"
              size="icon-sm"
              className={touchTarget}
              title={`${a.name} 삭제`}
              aria-label={`${a.name} 삭제`}
              onClick={() => openAccountDelete(a)}
            >
              <Trash2 className="text-destructive" />
            </Button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={`text-xl font-semibold ${a.balance < 0 ? "text-rose-400" : ""}`}
        >
          {formatKRW(a.balance)}
        </p>
        {a.valued_at && (
          <p className="mt-1 text-xs text-muted-foreground">
            평가 기준일 {a.valued_at}
          </p>
        )}
        {VALUATION_TYPES.includes(a.type) && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => openValuation(a)}
          >
            {isStock(a.type) ? "총합 입력" : "평가액 갱신"}
          </Button>
        )}
      </CardContent>
    </Card>
  );

  const openAccountDelete = (account: AccountBalance) => {
    setAccountToDelete(account);
    setAccountDeleteError(null);
  };

  // 삭제 실패(거래 참조 409 등)는 다이얼로그를 닫지 않고 사유를 그대로 보여준다.
  // 삭제 호출과 목록 재조회를 분리하는 이유: 스토어의 deleteAccount는 성공 후 fetchAll을
  // 이어서 부르므로, 재조회만 실패해도 catch에 걸려 "삭제 실패"처럼 보인다(실제로는 삭제됨).
  // 삭제가 확정된 뒤의 재조회 실패는 화면을 갈아엎지 않고 배너(refreshNotice)로만 알린다 —
  // 이때 화면의 자산 데이터는 (조금 낡았을 뿐) 여전히 유효하므로 전면 에러로 올리면 안 된다.
  const confirmAccountDelete = async () => {
    if (!accountToDelete) return;
    setAccountDeleting(true);
    try {
      await api.delete(`/accounts/${accountToDelete.id}`);
    } catch (e) {
      setAccountDeleteError((e as Error).message);
      return;
    } finally {
      setAccountDeleting(false);
    }
    setAccountToDelete(null);
    try {
      await Promise.all([fetchAllMasterData(), fetchAssets(memberId)]);
      setRefreshNotice(null);
    } catch (e) {
      setRefreshNotice(
        `계정은 삭제됐지만 목록을 새로고침하지 못했습니다: ${(e as Error).message}`,
      );
    }
  };

  const openValuationDelete = (accountId: number, valuation: Valuation) => {
    setValuationToDelete({ accountId, valuation });
    setValuationDeleteError(null);
  };

  const confirmValuationDelete = async () => {
    if (!valuationToDelete) return; // 다이얼로그가 열려 있으면 항상 non-null
    const { accountId, valuation } = valuationToDelete;
    setValuationDeleting(true);
    try {
      await api.delete(`/accounts/${accountId}/valuations/${valuation.id}`);
      setValuationError(null);
      setValuationToDelete(null);
      await Promise.all([
        loadValuationHistory(accountId),
        fetchAssets(memberId),
      ]);
    } catch (e) {
      // 계정 삭제와 동일하게 — 실패 시 확인 다이얼로그를 유지하고 그 안에 사유를 보여준다
      setValuationDeleteError((e as Error).message);
    } finally {
      setValuationDeleting(false);
    }
  };

  const submitValuation = async () => {
    if (!valuationTarget) return;
    // Number('') === 0 이므로 변환 전에 빈 입력을 거른다 (명시적 0원 입력은 허용)
    if (valuationValue.trim() === "")
      return setValuationError("평가액을 입력해주세요");
    const value = Number(valuationValue);
    if (!valuationDate) return setValuationError("기준일을 입력해주세요");
    if (valuationDate > todayISO())
      return setValuationError("기준일은 미래 날짜일 수 없습니다");
    if (!Number.isInteger(value) || value < 0)
      return setValuationError("평가액은 0원 이상의 정수여야 합니다");
    try {
      await api.put(`/accounts/${valuationTarget.id}/valuations`, {
        date: valuationDate,
        value,
      });
      setValuationTarget(null);
      await fetchAssets(memberId);
    } catch (e) {
      setValuationError((e as Error).message);
    }
  };

  const openGoalCreate = () => {
    setEditingGoal(null);
    setGoalName("");
    setGoalAmount("");
    setGoalDate("");
    setGoalError(null);
    setGoalDialogOpen(true);
  };

  const openGoalEdit = (g: Goal) => {
    setEditingGoal(g);
    setGoalName(g.name);
    setGoalAmount(String(g.target_amount));
    setGoalDate(g.target_date ?? "");
    setGoalError(null);
    setGoalDialogOpen(true);
  };

  const submitGoal = async () => {
    const amount = Number(goalAmount);
    if (!goalName.trim()) return setGoalError("목표 이름을 입력해주세요");
    if (!Number.isInteger(amount) || amount <= 0)
      return setGoalError("목표금액은 1원 이상의 정수여야 합니다");
    const input = {
      name: goalName.trim(),
      target_amount: amount,
      target_date: goalDate || null,
    };
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, input);
      } else {
        await createGoal(input);
      }
      setGoalDialogOpen(false);
    } catch (e) {
      setGoalError((e as Error).message);
    }
  };

  if (error) {
    return (
      <p className="text-destructive">
        자산 상태를 불러오지 못했습니다: {error}
      </p>
    );
  }

  const total = assets?.total ?? 0;
  // 목표는 부부 공동 — 구성원 필터와 무관하게 항상 가구 전체 총자산 기준
  const grandTotal = assets?.grand_total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">자산 상태</h1>
        <MemberFilterSelect />
      </div>

      {refreshNotice && (
        <p className="text-sm text-destructive">{refreshNotice}</p>
      )}

      <Card className="border-yellow-300/30">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            총자산
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-semibold">{formatKRW(total)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="flex items-center gap-2">
                <Target className="size-4 text-yellow-300" /> 목표 달성 현황
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                부부 공동 목표 — 전체 자산 기준
              </span>
            </span>
            <Button size="sm" className="shrink-0" onClick={openGoalCreate}>
              <Plus /> 목표 추가
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {goalListError && (
            <p className="text-sm text-destructive">
              목표를 처리하지 못했습니다: {goalListError}
            </p>
          )}
          {goalItems.length === 0 && (
            <p className="text-sm text-muted-foreground">
              아직 목표가 없어요. 목표금액을 정하면 총자산 대비 달성률을
              보여드려요 🌟
            </p>
          )}
          {goalItems.map((g) => {
            const rate = grandTotal / g.target_amount;
            return (
              <div key={g.id}>
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate">{g.name}</span>
                    {g.target_date && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        ~{g.target_date}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground">
                      {formatKRW(grandTotal)} / {formatKRW(g.target_amount)} (
                      {Math.round(rate * 100)}%)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={touchTarget}
                      aria-label="목표 수정"
                      onClick={() => openGoalEdit(g)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={touchTarget}
                      aria-label="목표 삭제"
                      onClick={() =>
                        removeGoal(g.id)
                          .then(() => setGoalListError(null))
                          .catch((e: Error) => setGoalListError(e.message))
                      }
                    >
                      <Trash2 className="text-destructive" />
                    </Button>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${
                      rate >= 1 ? "bg-emerald-400" : "bg-yellow-300"
                    }`}
                    style={{ width: `${Math.min(rate, 1) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 계정 카드 — 유형(카테고리)별 그룹 카드 안에 중첩. 계정이 없는 유형은 표시하지 않는다.
          간편결제는 연결 계정으로 귀속되므로 그룹으로 표시하지 않는다.
          구성원 필터가 "전체"면 유형 안에서 다시 구성원별로 나눠 보여준다 */}
      {(Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[]).map((type) => {
        if (HIDDEN_GROUP_TYPES.includes(type)) return null;
        const group = assets?.accounts.filter((a) => a.type === type) ?? [];
        if (group.length === 0) return null;
        const subtotal = group.reduce((sum, a) => sum + a.balance, 0);
        return (
          <Card key={type}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{ACCOUNT_TYPE_LABEL[type]}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  {formatKRW(subtotal)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {splitMembers.length > 1 ? (
                // 모바일은 세로 적층, sm 이상에서 구성원별 좌/우 분할
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {splitMembers.map((m) => {
                    const owned = group.filter((a) => a.member_id === m.id);
                    const ownedTotal = owned.reduce(
                      (sum, a) => sum + a.balance,
                      0,
                    );
                    return (
                      <div key={m.id} className="space-y-2">
                        <div className="flex items-baseline justify-between border-b pb-1">
                          <span className="text-sm font-medium">{m.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatKRW(ownedTotal)}
                          </span>
                        </div>
                        {owned.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            계정 없음
                          </p>
                        ) : (
                          // 분할로 폭이 절반이라 xl 이상에서만 2열로 늘린다
                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            {owned.map(renderAccountCard)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {group.map(renderAccountCard)}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>월별 자산 추이 (최근 12개월)</CardTitle>
        </CardHeader>
        <CardContent>
          <EChart option={trendOption} height={320} />
        </CardContent>
      </Card>

      <Dialog
        open={valuationTarget !== null}
        onOpenChange={(open) => !open && setValuationTarget(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {valuationTarget && isStock(valuationTarget.type)
                ? "보유 주식 총합 입력"
                : "평가액 갱신"}{" "}
              — {valuationTarget?.name}
            </DialogTitle>
            <DialogDescription>
              {valuationTarget && isStock(valuationTarget.type)
                ? "기준일의 보유 주식 평가 총합을 직접 입력해요. 주식은 엑셀 업로드로 갱신되지 않아요."
                : "기준일의 평가액을 기록해요. 같은 날짜에 다시 기록하면 값이 갱신돼요."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="val-date">기준일</Label>
              <DatePicker
                id="val-date"
                disableFuture
                value={valuationDate}
                onChange={setValuationDate}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="val-value">
                {valuationTarget && isStock(valuationTarget.type)
                  ? "보유 주식 총합 (원)"
                  : "평가액 (원)"}
              </Label>
              <Input
                id="val-value"
                type="number"
                min={0}
                placeholder="예: 50000000"
                value={valuationValue}
                onChange={(e) => setValuationValue(e.target.value)}
              />
            </div>
            {valuationTarget && valuationHistory.length > 0 && (
              <div className="space-y-1">
                <Label>평가 이력</Label>
                <ScrollArea className="max-h-40 rounded-md border">
                  <div className="space-y-1.5 p-2">
                    {valuationHistory.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="text-muted-foreground">{v.date}</span>
                        <span className="flex items-center gap-2">
                          {formatKRW(v.value)}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className={touchTarget}
                            title={`${v.date} 평가액 삭제`}
                            aria-label={`${v.date} 평가액 삭제`}
                            onClick={() =>
                              openValuationDelete(valuationTarget.id, v)
                            }
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <p className="text-xs text-muted-foreground">
                  이력을 모두 삭제하면 잔액이 거래 기반 계산으로 돌아가요.
                </p>
              </div>
            )}
            {valuationError && (
              <p className="text-sm text-destructive">{valuationError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setValuationTarget(null)}>
              취소
            </Button>
            <Button onClick={submitValuation}>기록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 평가액 삭제 확인 — 평가액 갱신 다이얼로그 위에 겹쳐 뜬다 */}
      <Dialog
        open={valuationToDelete !== null}
        onOpenChange={(open) => !open && setValuationToDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>평가액 삭제</DialogTitle>
            <DialogDescription>
              {valuationToDelete?.valuation.date} 기준{" "}
              {valuationToDelete && formatKRW(valuationToDelete.valuation.value)}{" "}
              기록을 삭제할게요. 되돌릴 수 없어요.
            </DialogDescription>
          </DialogHeader>
          {valuationDeleteError && (
            <p className="text-sm text-destructive">{valuationDeleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setValuationToDelete(null)}
              disabled={valuationDeleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={confirmValuationDelete}
              disabled={valuationDeleting}
            >
              {valuationDeleting ? "삭제 중…" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 자산 계정 삭제 확인 — 평가 이력이 함께 사라지고, 거래가 있으면 백엔드가 409로 막는다 */}
      <Dialog
        open={accountToDelete !== null}
        onOpenChange={(open) => !open && setAccountToDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>자산 계정 삭제</DialogTitle>
            <DialogDescription>
              {accountToDelete?.name} 계정을 삭제할게요. 이 계정의 평가 이력도
              함께 삭제되며 되돌릴 수 없어요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              현재 잔액 {accountToDelete && formatKRW(accountToDelete.balance)} —
              삭제하면 총자산에서 빠져요.
            </p>
            {accountDeleteError && (
              <p className="text-destructive">{accountDeleteError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAccountToDelete(null)}
              disabled={accountDeleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={confirmAccountDelete}
              disabled={accountDeleting}
            >
              {accountDeleting ? "삭제 중…" : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={goalDialogOpen} onOpenChange={setGoalDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingGoal ? "목표 수정" : "목표 추가"}</DialogTitle>
            <DialogDescription>
              달성률은 가구 전체 총자산(부부 공동) 기준으로 계산돼요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="goal-name">목표 이름</Label>
              <Input
                id="goal-name"
                placeholder="예: 내집마련 1억"
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-amount">목표금액 (원)</Label>
              <Input
                id="goal-amount"
                type="number"
                min={1}
                placeholder="예: 100000000"
                value={goalAmount}
                onChange={(e) => setGoalAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="goal-date">목표일 (선택)</Label>
              <DatePicker
                id="goal-date"
                placeholder="목표일 없음"
                clearable
                value={goalDate}
                onChange={setGoalDate}
              />
            </div>
            {goalError && (
              <p className="text-sm text-destructive">{goalError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGoalDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={submitGoal}>
              {editingGoal ? "수정" : "추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
