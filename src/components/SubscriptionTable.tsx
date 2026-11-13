import { useMemo, useState } from 'react'
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react'
import type { Category, Subscription } from '../types'
import { CATEGORY_META, CATEGORY_ORDER, CYCLE_LABEL, STATUS_LABEL, STATUS_STYLE, fmtMoney } from '../lib/money'
import {
  billingDateInMonth,
  currentMonthKey,
  daysBetweenISO,
  nextChargeDate,
  shortDate,
  todayISO,
} from '../lib/date'
import { annualCostTwd } from '../lib/analytics'
import { useStore } from '../store/useStore'
import { Badge, Button, Card, CardTitle, Empty, cn } from './ui'

export function SubscriptionTable({
  onEdit,
  onNew,
  displayCurrency,
  rate,
}: {
  onEdit: (sub: Subscription) => void
  onNew: () => void
  displayCurrency: 'USD' | 'TWD'
  rate: number
}) {
  const subscriptions = useStore((s) => s.subscriptions)
  const charges = useStore((s) => s.charges)
  const fxRates = useStore((s) => s.fxRates)
  const settings = useStore((s) => s.settings)
  const removeSubscription = useStore((s) => s.removeSubscription)
  const logChargeFor = useStore((s) => s.logChargeFor)

  const [filter, setFilter] = useState<Category | 'all'>('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const thisMonth = currentMonthKey()

  const rows = useMemo(() => {
    const list = subscriptions.filter((s) => (filter === 'all' ? true : s.category === filter))
    return list
      .map((s) => {
        const billDate = billingDateInMonth(s, thisMonth)
        const loggedThisMonth = charges.some(
          (c) => c.subscriptionId === s.id && c.chargedAt.slice(0, 7) === thisMonth,
        )
        return {
          sub: s,
          next: nextChargeDate(s),
          annual: annualCostTwd({ subscriptions, charges, fxRates, settings }, s),
          loggedThisMonth,
          billDate,
          // 只有「本月有扣款日、已到期、而且還沒補登」才能一鍵補登，避免提前製造假帳
          canLog: Boolean(billDate && billDate <= todayISO() && !loggedThisMonth),
        }
      })
      .sort((a, b) => b.annual - a.annual)
  }, [subscriptions, charges, fxRates, settings, filter, thisMonth])

  const monthlyTotal = rows
    .filter((r) => r.sub.status === 'active' || r.sub.status === 'trial')
    .reduce((n, r) => n + r.annual / 12, 0)

  return (
    <Card>
      <CardTitle
        title="訂閱清單"
        hint={`${rows.length} 筆 · 等效月支出 NT$${Math.round(monthlyTotal).toLocaleString()}（依年費攤提）`}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'cursor-pointer rounded-md px-2 py-1 text-[11px] transition-colors',
                filter === 'all' ? 'bg-brand/15 text-brand' : 'text-muted hover:text-slate-200',
              )}
            >
              全部
            </button>
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={cn(
                  'flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                  filter === c ? 'bg-white/10 text-slate-100' : 'text-muted hover:text-slate-200',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', CATEGORY_META[c].dot)} />
                {CATEGORY_META[c].label}
              </button>
            ))}
            <Button size="sm" variant="primary" onClick={onNew} className="ml-1">
              + 新增訂閱
            </Button>
          </div>
        }
      />

      {rows.length === 0 ? (
        <Empty
          title="還沒有訂閱"
          hint="新增第一個 AI 工具、寫作或影音訂閱，戰情室就會開始計算。"
          action={
            <Button size="sm" variant="primary" onClick={onNew} className="mt-2">
              + 新增訂閱
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line/70 text-[11px] tracking-wider text-muted uppercase">
                <th className="px-5 py-2 text-left font-medium">工具</th>
                <th className="px-3 py-2 text-left font-medium">分類</th>
                <th className="px-3 py-2 text-right font-medium">原幣金額</th>
                <th className="px-3 py-2 text-left font-medium">週期</th>
                <th className="px-3 py-2 text-left font-medium">下次扣款</th>
                <th className="px-3 py-2 text-right font-medium">等效年費</th>
                <th className="px-3 py-2 text-left font-medium">狀態</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {rows.map(({ sub, next, annual, loggedThisMonth, billDate, canLog }) => {
                const meta = CATEGORY_META[sub.category]
                const days = next ? daysBetweenISO(todayISO(), next) : null
                return (
                  <tr key={sub.id} className="group transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-2.5">
                      <div className="font-medium text-slate-100">{sub.name}</div>
                      <div className="text-[11px] text-muted">
                        {sub.vendor}
                        {sub.seats > 1 ? ` · ${sub.seats} 人分攤` : ''}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={meta.badge}>{meta.label}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-200 tabular-nums">
                      {fmtMoney(sub.amount, sub.currency, sub.currency === 'USD' ? 2 : 0)}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {CYCLE_LABEL[sub.cycle]}
                      {sub.cycle !== 'once' ? ` · ${sub.anchorDay} 號` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {next ? (
                        <span className="text-slate-300">
                          {shortDate(next)}
                          {days !== null ? (
                            <span className={cn('ml-1.5 text-[10px]', days <= 3 ? 'text-amber-300' : 'text-muted')}>
                              {days === 0 ? '今天' : `${days} 天後`}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-200 tabular-nums">
                      {displayCurrency === 'TWD'
                        ? `NT$${Math.round(annual).toLocaleString()}`
                        : `US$${Math.round(annual / (rate || 1)).toLocaleString()}`}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge className={STATUS_STYLE[sub.status]}>{STATUS_LABEL[sub.status]}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title={
                            canLog
                              ? '補登本月扣款'
                              : loggedThisMonth
                                ? '本月已補登過'
                                : billDate
                                  ? `${shortDate(billDate)} 才扣款`
                                  : '本月不扣款'
                          }
                          disabled={!canLog}
                          onClick={() => logChargeFor(sub.id, billDate ?? undefined)}
                          className={cn(
                            'rounded-md p-1.5 transition-colors',
                            canLog
                              ? 'cursor-pointer text-muted hover:bg-white/5 hover:text-brand'
                              : 'cursor-not-allowed text-muted/30',
                          )}
                        >
                          <CalendarPlus size={14} />
                        </button>
                        <button
                          title="編輯"
                          onClick={() => onEdit(sub)}
                          className="cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-white/5 hover:text-slate-100"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          title="刪除"
                          onClick={() => setConfirmId(sub.id)}
                          className="cursor-pointer rounded-md p-1.5 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirmId ? (
        <div className="flex items-center justify-between gap-3 border-t border-rose-500/20 bg-rose-500/5 px-5 py-3">
          <p className="text-xs text-rose-200">
            刪除訂閱會一併刪除它的所有扣款紀錄，這個動作無法復原。
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
              取消
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                removeSubscription(confirmId)
                setConfirmId(null)
              }}
            >
              確定刪除
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  )
}
