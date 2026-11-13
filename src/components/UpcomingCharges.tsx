import { CalendarClock } from 'lucide-react'
import type { UpcomingItem } from '../lib/analytics'
import { CATEGORY_META, CYCLE_LABEL, fmtMoney } from '../lib/money'
import { shortDate } from '../lib/date'
import { Card, CardTitle, Empty, cn } from './ui'

export function UpcomingCharges({
  items,
  onLog,
  basis,
  displayCurrency,
  rate,
}: {
  items: UpcomingItem[]
  onLog: (subscriptionId: string, date: string) => void
  basis: 'cash' | 'accrual'
  displayCurrency: 'USD' | 'TWD'
  rate: number
}) {
  const totalTwd = items.reduce((s, i) => s + i.twd, 0)
  const total = displayCurrency === 'USD' ? Math.round((totalTwd / (rate || 1)) * 100) / 100 : Math.round(totalTwd)
  const totalLabel =
    displayCurrency === 'USD'
      ? `US$${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      : `NT$${total.toLocaleString()}`

  return (
    <Card className="flex flex-col">
      <CardTitle
        title="即將扣款"
        hint={basis === 'accrual' ? '攤提模式下僅供參考' : '未來 45 天現金流'}
        right={
          <span className="font-mono text-xs text-muted">
            合計 <span className="text-slate-200">{totalLabel}</span>
          </span>
        }
      />
      {items.length === 0 ? (
        <Empty title="45 天內沒有扣款" hint="所有訂閱的下次扣款都在 45 天之後" />
      ) : (
        <ul className="divide-y divide-line/60">
          {items.map((it) => {
            const meta = CATEGORY_META[it.category]
            const urgent = it.days <= 3
            return (
              <li key={`${it.subscriptionId}-${it.date}`} className="group flex items-center gap-3 px-5 py-2.5">
                <div
                  className={cn(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[11px] font-semibold',
                    urgent ? 'bg-amber-400/15 text-amber-300' : 'bg-white/5 text-muted',
                  )}
                >
                  {it.days === 0 ? '今天' : `${it.days}d`}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
                    <span className="truncate text-xs font-medium text-slate-200">{it.name}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {shortDate(it.date)} · {meta.label}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-slate-200">
                    {fmtMoney(it.amount, it.currency, it.currency === 'USD' ? 2 : 0)}
                  </div>
                  <div className="font-mono text-[10px] text-muted">≈ NT${Math.round(it.twd).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => onLog(it.subscriptionId, it.date)}
                  title="直接補登這筆扣款"
                  className="cursor-pointer rounded-md p-1.5 text-muted opacity-0 transition hover:bg-white/5 hover:text-brand group-hover:opacity-100"
                >
                  <CalendarClock size={14} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-auto border-t border-line/60 px-5 py-2 text-[10px] text-muted">
        {CYCLE_LABEL.monthly} / {CYCLE_LABEL.yearly} 依下次扣款日推算 · 滑過列可補登
      </div>
    </Card>
  )
}
