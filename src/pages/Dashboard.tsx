import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Layers,
  Minus,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import {
  annualizedTwd,
  buildInsights,
  computeMonth,
  computeTrend,
  monthDelta,
  upcomingCharges,
} from '../lib/analytics'
import { RATE_SOURCE_META } from '../lib/fx'
import { addMonths, currentMonthKey, monthLabelFull } from '../lib/date'
import { CATEGORY_META, CATEGORY_ORDER, fmtMoney, formatPercent } from '../lib/money'
import { conv, type ModalHandlers } from '../handlers'
import { Badge, Button, Segmented, cn } from '../components/ui'
import { KpiCard } from '../components/KpiCard'
import { TrendChart } from '../components/TrendChart'
import { CategoryDonut } from '../components/CategoryDonut'
import { UpcomingCharges } from '../components/UpcomingCharges'
import { InsightsPanel } from '../components/InsightsPanel'
import { MonthDetail } from '../components/MonthDetail'

export function Dashboard({ handlers }: { handlers: ModalHandlers }) {
  const subscriptions = useStore((s) => s.subscriptions)
  const charges = useStore((s) => s.charges)
  const fxRates = useStore((s) => s.fxRates)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const removeCharge = useStore((s) => s.removeCharge)
  const logChargeFor = useStore((s) => s.logChargeFor)

  const [month, setMonth] = useState(currentMonthKey())
  const data = useMemo(() => ({ subscriptions, charges, fxRates, settings }), [subscriptions, charges, fxRates, settings])

  const stat = useMemo(() => computeMonth(data, month), [data, month])
  const trend = useMemo(() => computeTrend(data, 12, month), [data, month])
  const annual = useMemo(() => annualizedTwd(data), [data])
  const upcoming = useMemo(() => upcomingCharges(data, 45), [data])
  const insights = useMemo(() => buildInsights(data), [data])
  const delta = useMemo(() => monthDelta(data, month), [data, month])

  const dc = settings.displayCurrency
  const isAccrual = settings.basis === 'accrual'
  const rate = stat.rate.rate
  const digits = dc === 'USD' ? 2 : 0
  const fmt = (twd: number) => fmtMoney(conv(twd, dc, rate), dc, digits)

  const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial')
  const trialCount = subscriptions.filter((s) => s.status === 'trial').length
  const pausedCount = subscriptions.filter((s) => s.status === 'paused').length
  const pendingCount = stat.items.filter((i) => i.kind === 'estimate').length
  const isCurrent = month === currentMonthKey()

  const rateMeta = RATE_SOURCE_META[stat.rate.source]
  const topCategory = CATEGORY_ORDER.map((c) => ({ c, v: annual.byCategory[c] })).sort((a, b) => b.v - a.v)[0]
  const topShare = annual.total > 0 ? (topCategory.v / annual.total) * 100 : 0

  const deltaPct = delta.pct
  const deltaTone = delta.diff > 0 ? 'warn' : delta.diff < 0 ? 'good' : 'flat'

  return (
    <div className="space-y-4">
      {/* ── 工具列 ───────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-line bg-panel">
          <button
            onClick={() => setMonth(addMonths(month, -1))}
            className="cursor-pointer rounded-l-lg px-2 py-2 text-muted transition-colors hover:bg-white/5 hover:text-slate-100"
            aria-label="上個月"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[104px] px-1 text-center text-xs font-medium text-slate-200">
            {monthLabelFull(month)}
          </span>
          <button
            onClick={() => setMonth(addMonths(month, 1))}
            className="cursor-pointer rounded-r-lg px-2 py-2 text-muted transition-colors hover:bg-white/5 hover:text-slate-100"
            aria-label="下個月"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        {!isCurrent ? (
          <Button size="sm" variant="ghost" onClick={() => setMonth(currentMonthKey())}>
            回本月
          </Button>
        ) : null}

        <Badge className={rateMeta.badge} title={rateMeta.hint}>
          匯率 {rate} · {rateMeta.label}
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Segmented
            value={settings.basis}
            onChange={(v) => setSettings({ basis: v })}
            options={[
              { value: 'cash', label: '現金流', title: '實際扣款為主，未扣款用估算補上' },
              { value: 'accrual', label: '攤提', title: '年繳 ÷ 12，看真實訂閱成本' },
            ]}
          />
          <Button size="sm" variant="outline" onClick={() => handlers.openCharge()}>
            <Plus size={13} /> 補登扣款
          </Button>
          <Button size="sm" variant="primary" onClick={handlers.openNewSubscription}>
            <Plus size={13} /> 新增訂閱
          </Button>
        </div>
      </div>

      {/* ── KPI ─────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={isCurrent ? '本月支出' : '當月支出'}
          value={fmt(stat.totalTwd)}
          icon={<Wallet size={16} />}
          badge={
            isAccrual ? (
              <Badge className="bg-ai/12 text-ai ring-ai/30">攤提計算</Badge>
            ) : (
              <Badge className={rateMeta.badge}>匯率 {rate}</Badge>
            )
          }
          hint={isAccrual ? '年繳已攤入每月' : stat.estimatedTwd > 0 ? '含預估' : '全部為實際扣款'}
        >
          {isAccrual ? (
            <div className="space-y-1.5">
              <Row label="月繳訂閱" value={`${activeSubs.filter((s) => s.cycle === 'monthly').length} 個`} tone="text-slate-300" />
              <Row label="年繳訂閱" value={`${activeSubs.filter((s) => s.cycle === 'yearly').length} 個`} tone="text-slate-300" />
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
                {CATEGORY_ORDER.map((c) => {
                  const pct = stat.totalTwd > 0 ? (stat.byCategory[c] / stat.totalTwd) * 100 : 0
                  if (pct <= 0) return null
                  return (
                    <div key={c} className="h-full" style={{ width: `${pct}%`, background: CATEGORY_META[c].hex }} />
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Row label="實際" value={fmt(stat.actualTwd)} tone="text-emerald-300" />
              <Row label="預估" value={fmt(stat.estimatedTwd)} tone="text-amber-300" />
              <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full bg-emerald-400/70"
                  style={{ width: `${stat.totalTwd > 0 ? (stat.actualTwd / stat.totalTwd) * 100 : 0}%` }}
                />
                <div
                  className="h-full bg-amber-400/70"
                  style={{ width: `${stat.totalTwd > 0 ? (stat.estimatedTwd / stat.totalTwd) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}
        </KpiCard>

        <KpiCard
          label="年化支出"
          value={fmt(annual.total)}
          accent="ai"
          icon={<TrendingUp size={16} />}
          hint="未來 12 個月攤提"
        >
          <div className="space-y-1.5">
            <Row label={`${CATEGORY_META[topCategory.c].label} 最多`} value={`${topShare.toFixed(0)}%`} tone="text-ai" />
            <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
              {CATEGORY_ORDER.map((c) => {
                const pct = annual.total > 0 ? (annual.byCategory[c] / annual.total) * 100 : 0
                if (pct <= 0) return null
                return (
                  <div key={c} className="h-full" style={{ width: `${pct}%`, background: CATEGORY_META[c].hex }} />
                )
              })}
            </div>
          </div>
        </KpiCard>

        <KpiCard
          label="訂閱項目"
          value={String(activeSubs.length)}
          accent="infra"
          icon={<Layers size={16} />}
          badge={
            trialCount > 0 ? (
              <Badge className="bg-amber-400/12 text-amber-300 ring-amber-400/30">{trialCount} 個試用</Badge>
            ) : undefined
          }
          hint={pausedCount > 0 ? `${pausedCount} 個暫停中` : '全部啟用中'}
        >
          <div className="flex flex-wrap gap-1">
            {CATEGORY_ORDER.map((c) => {
              const n = activeSubs.filter((s) => s.category === c).length
              if (n === 0) return null
              return (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-muted"
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', CATEGORY_META[c].dot)} />
                  {CATEGORY_META[c].label} {n}
                </span>
              )
            })}
          </div>
        </KpiCard>

        <KpiCard
          label="較上月"
          value={deltaPct === null ? '—' : formatPercent(deltaPct)}
          accent={deltaTone === 'good' ? 'infra' : deltaTone === 'warn' ? 'video' : 'writing'}
          icon={
            delta.diff > 0 ? (
              <ArrowUpRight size={16} />
            ) : delta.diff < 0 ? (
              <ArrowDownRight size={16} />
            ) : (
              <Minus size={16} />
            )
          }
          badge={
            <Badge
              className={
                deltaTone === 'warn'
                  ? 'bg-rose-400/12 text-rose-300 ring-rose-400/30'
                  : deltaTone === 'good'
                    ? 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30'
                    : 'bg-slate-400/10 text-slate-300 ring-slate-400/25'
              }
            >
              {delta.diff === 0 ? '持平' : `${delta.diff > 0 ? '+' : '−'}${fmt(Math.abs(delta.diff))}`}
            </Badge>
          }
          hint={`上月 ${fmt(delta.prev)}`}
        >
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <CalendarDays size={12} />
            <span>
              {isAccrual
                ? `${isCurrent ? '本月' : '該月'}共 ${stat.items.length} 筆攤提項目`
                : `${isCurrent ? '本月' : '該月'}共 ${stat.items.length} 筆，其中 ${pendingCount} 筆為預估`}
            </span>
          </div>
        </KpiCard>
      </div>

      {/* ── 趨勢 ────────────────────────────────── */}
      <TrendChart
        points={trend}
        displayCurrency={dc}
        rate={rate}
        selectedMonth={month}
        onSelectMonth={setMonth}
      />

      {/* ── 佔比 / 即將扣款 ─────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryDonut stat={stat} displayCurrency={dc} rate={rate} />
        <UpcomingCharges
          items={upcoming}
          basis={settings.basis}
          displayCurrency={dc}
          rate={rate}
          onLog={(id, date) => logChargeFor(id, date)}
        />
      </div>

      {/* ── 洞察 ────────────────────────────────── */}
      <InsightsPanel insights={insights} />

      {/* ── 明細 ────────────────────────────────── */}
      <MonthDetail
        stat={stat}
        charges={charges}
        basis={settings.basis}
        onEditCharge={(c) => handlers.openCharge({ initial: c })}
        onDeleteCharge={removeCharge}
      />
    </div>
  )
}

function Row({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px]">
      <span className="text-muted">{label}</span>
      <span className={cn('font-mono tabular-nums', tone)}>{value}</span>
    </div>
  )
}
