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
import { useAnalyticsStore } from "@/stores/analytics";
import { useGoalStore } from "@/stores/goals";
import { useMemberFilterStore } from "@/stores/memberFilter";
import type { AccountBalance, AccountType, Goal, Valuation } from "@/types";

const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  bank: "은행",
  cash: "현금",
  card: "카드",
  easy_pay: "간편결제",
  investment: "투자",
  stock: "주식",
  real_estate: "부동산",
  other: "기타",
};

// 간편결제 계정은 패스스루로 잔액이 연결 카드/은행에 귀속(잔액 0으로 수렴)되므로
// 자체 그룹으로 노출하지 않는다.
const HIDDEN_GROUP_TYPES: AccountType[] = ["easy_pay"];

/** 평가액 스냅샷으로 잔액을 관리하는 시세형 계정 유형 */
const VALUATION_TYPES: AccountType[] = ["stock", "real_estate"];

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
  const [error, setError] = useState<string | null>(null);
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

  // 목표 추가/수정 다이얼로그
  const [goalDialogOpen, setGoalDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalDate, setGoalDate] = useState("");
  const [goalError, setGoalError] = useState<string | null>(null);

  useEffect(() => {
    fetchAssets(memberId).catch((e: Error) => setError(e.message));
  }, [fetchAssets, memberId]);

  useEffect(() => {
    if (!goalsLoaded)
      fetchGoals().catch((e: Error) => setGoalListError(e.message));
  }, [fetchGoals, goalsLoaded]);

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

  const deleteValuation = async (valuationId: number) => {
    if (!valuationTarget) return;
    try {
      await api.delete(
        `/accounts/${valuationTarget.id}/valuations/${valuationId}`,
      );
      setValuationError(null);
      await Promise.all([
        loadValuationHistory(valuationTarget.id),
        fetchAssets(memberId),
      ]);
    } catch (e) {
      setValuationError((e as Error).message);
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
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Target className="size-4 text-yellow-300" /> 목표 달성 현황
              <span className="text-xs font-normal text-muted-foreground">
                부부 공동 목표 — 전체 자산 기준
              </span>
            </span>
            <Button size="sm" onClick={openGoalCreate}>
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
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {g.name}
                    {g.target_date && (
                      <span className="text-xs text-muted-foreground">
                        ~{g.target_date}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground">
                      {formatKRW(grandTotal)} / {formatKRW(g.target_amount)} (
                      {Math.round(rate * 100)}%)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openGoalEdit(g)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
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
          간편결제는 연결 계정으로 귀속되므로 그룹으로 표시하지 않는다 */}
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.map((a) => (
                  <Card key={a.id} className={a.is_active ? "" : "opacity-50"}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span>{a.name}</span>
                        {!a.is_active && (
                          <Badge variant="secondary">비활성</Badge>
                        )}
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
                          평가액 갱신
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
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
            <DialogTitle>평가액 갱신 — {valuationTarget?.name}</DialogTitle>
            <DialogDescription>
              기준일의 평가액을 기록해요. 같은 날짜에 다시 기록하면 값이
              갱신돼요.
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
              <Label htmlFor="val-value">평가액 (원)</Label>
              <Input
                id="val-value"
                type="number"
                min={0}
                placeholder="예: 50000000"
                value={valuationValue}
                onChange={(e) => setValuationValue(e.target.value)}
              />
            </div>
            {valuationHistory.length > 0 && (
              <div className="space-y-1">
                <Label>평가 이력</Label>
                <ScrollArea className="max-h-40 rounded-md border">
                  <div className="space-y-1 p-2">
                    {valuationHistory.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground">{v.date}</span>
                        <span className="flex items-center gap-1">
                          {formatKRW(v.value)}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => deleteValuation(v.id)}
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
