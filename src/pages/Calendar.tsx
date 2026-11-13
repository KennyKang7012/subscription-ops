import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { computeMonth, type MonthItem } from '../lib/analytics'
import { addMonths, currentMonthKey, monthBounds, monthLabelFull, parseISO, toISO, todayISO } from '../lib/date'
import { CATEGORY_META, CATEGORY_ORDER, fmtMoney } from '../lib/money'
import { conv, type ModalHandlers } from '../handlers'
import { Badge, Button, Card, CardTitle, Empty, cn } from '../components/ui'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function CalendarPage({ handlers }: { handlers: ModalHandlers }) {
  const subscriptions = useStore((s) => s.subscriptions)
  const charges = useStore((s) => s.charges)
  const fxRates = useStore((s) => s.fxRates)
  const settings = useStore((s) => s.settings)

  const [month, setMonth] = useState(currentMonthKey())
  const data = useMemo(() => ({ subscriptions, charges, fxRates, settings }), [subscriptions, charges, fxRates, settings])
  const stat = useMemo(() => computeMonth(data, month), [data, month])

  const dc = settings.displayCurrency
  const rate = stat.rate.rate
  const digits = dc === 'USD' ? 2 : 0
  const money = (twd: number) => fmtMoney(conv(twd, dc, rate), dc, digits)

  const cells = useMemo(() => {
    const { y, m } = monthBounds(month)
    const daysInMonth = new Date(y, m, 0).getDate()
    const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7 // 週一為第一天
    const total = Math.ceil((offset + daysInMonth) / 7) * 7

    const byDate = new Map<string, MonthItem[]>()
    for (const it of stat.items) {
      const list = byDate.get(it.date) ?? []
      list.push(it)
      byDate.set(it.date, list)
    }

    const cells = Array.from({ length: total }, (_, i) => {
      const dayNum = i - offset + 1
      const d = new Date(y, m - 1, dayNum)
      const iso = toISO(d)
      const inMonth = d.getMonth() === m - 1
      const items = inMonth ? [...(byDate.get(iso) ?? [])].sort((a, b) => b.twd - a.twd) : []
      return {
        key: iso,
        date: iso,
        day: d.getDate(),
        inMonth,
        items,
        total: items.reduce((s, it) => s + it.twd, 0),
        isToday: iso === todayISO(),
      }
    })
    return cells
  }, [month, stat])

  const totalTwd = stat.totalTwd
  const daysWithSpend = cells.filter((c) => c.inMonth && c.items.length > 0).length
  const monthDayCount = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()

  const pickDay = (date: string, items: MonthItem[]) => {
    if (items.length === 1 && items[0].subscriptionId) {
      handlers.openCharge({ subscriptionId: items[0].subscriptionId, date })
      return
    }
    handlers.openCharge({ date })
  }

  return (
    <div className="space-y-4">
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
        {month !== currentMonthKey() ? (
          <Button size="sm" variant="ghost" onClick={() => setMonth(currentMonthKey())}>
            回本月
          </Button>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Badge className="bg-white/5 text-slate-300 ring-white/10">
            合計 {money(totalTwd)}
          </Badge>
          <Badge className="bg-emerald-400/12 text-emerald-300 ring-emerald-400/30">
            實際 {money(stat.actualTwd)}
          </Badge>
          <Badge className="bg-amber-400/12 text-amber-300 ring-amber-400/30">
            預估 {money(stat.estimatedTwd)}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => handlers.openCharge()}>
            <Plus size={13} /> 補登扣款
          </Button>
        </div>
      </div>

      <Card>
        <CardTitle
          title="扣款日曆"
          hint="點任何一天可以補登該日扣款；只有一筆時會自動帶入那個訂閱"
          right={
            <div className="flex flex-wrap items-center gap-2.5">
              {CATEGORY_ORDER.map((c) => (
                <span key={c} className="flex items-center gap-1.5 text-[11px] text-muted">
                  <span className={cn('h-1.5 w-1.5 rounded-full', CATEGORY_META[c].dot)} />
                  {CATEGORY_META[c].label}
                </span>
              ))}
            </div>
          }
        />

        <div className="grid grid-cols-7 border-t border-line/70">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn(
                'border-b border-line/70 py-1.5 text-center text-[11px] font-medium',
                i >= 5 ? 'text-rose-300/60' : 'text-muted',
              )}
            >
              {w}
            </div>
          ))}

          {cells.map((cell, i) => (
            <button
              key={cell.key}
              onClick={() => pickDay(cell.date, cell.items)}
              className={cn(
                'group relative flex min-h-[96px] cursor-pointer flex-col border-line/50 p-1.5 text-left transition-colors',
                (i + 1) % 7 !== 0 ? 'border-r' : '',
                i < cells.length - 7 ? 'border-b' : '',
                cell.inMonth ? 'hover:bg-white/[0.035]' : 'bg-black/20',
                cell.isToday && 'bg-brand/[0.06]',
              )}
            >
              <div className="flex items-start justify-between gap-1">
                <span
                  className={cn(
                    'grid h-5 min-w-5 place-items-center rounded-md px-1 font-mono text-[11px]',
                    !cell.inMonth
                      ? 'text-muted/40'
                      : cell.isToday
                        ? 'bg-brand/20 font-semibold text-brand'
                        : 'text-slate-400',
                  )}
                >
                  {cell.day}
                </span>
                {cell.total > 0 ? (
                  <span className="font-mono text-[10px] text-slate-300 tabular-nums">{money(cell.total)}</span>
                ) : null}
              </div>

              <div className="mt-1 space-y-0.5">
                {cell.items.slice(0, 3).map((it) => (
                  <div key={it.key} className="flex items-center gap-1">
                    <span className={cn('h-1 w-1 shrink-0 rounded-full', CATEGORY_META[it.category].dot)} />
                    <span className="truncate text-[10px] leading-tight text-slate-300">{it.name}</span>
                    <span
                      className={cn(
                        'ml-auto shrink-0 font-mono text-[9px]',
                        it.kind === 'actual' ? 'text-emerald-300/80' : 'text-amber-300/80',
                      )}
                    >
                      {it.kind === 'actual' ? '實' : '估'}
                    </span>
                  </div>
                ))}
                {cell.items.length > 3 ? (
                  <div className="text-[9px] text-muted">+{cell.items.length - 3} 筆</div>
                ) : null}
              </div>

              {cell.inMonth ? (
                <span className="absolute right-1.5 bottom-1 text-muted opacity-0 transition group-hover:opacity-100">
                  <Plus size={11} />
                </span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 px-5 py-2.5 text-[11px] text-muted">
          <span>
            本月 {daysWithSpend} / {monthDayCount} 天有扣款　·　實 = 已入帳、估 = 依扣款日推算
          </span>
          <span className="font-mono">
            平均每日 NT${daysWithSpend > 0 ? Math.round(totalTwd / monthDayCount).toLocaleString() : 0}
          </span>
        </div>
      </Card>

      {stat.items.length === 0 ? (
        <Empty
          title="這個月還沒有任何支出"
          hint="點日曆上的任何一天就能補登一筆扣款，或到「訂閱管理」新增訂閱。"
          action={
            <Button size="sm" variant="primary" onClick={() => handlers.openCharge()} className="mt-2">
              <Plus size={13} /> 補登扣款
            </Button>
          }
        />
      ) : null}

      <Card>
        <CardTitle title="本月應扣款項目" hint="依日期排序，尚未到期的會標示預估" />
        <ul className="divide-y divide-line/50">
          {[...stat.items]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((it) => (
              <li key={it.key} className="flex items-center gap-3 px-5 py-2">
                <span className="w-14 shrink-0 font-mono text-[11px] text-muted">
                  {parseISO(it.date).getMonth() + 1}/{parseISO(it.date).getDate()}
                </span>
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', CATEGORY_META[it.category].dot)} />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{it.name}</span>
                <Badge
                  className={
                    it.kind === 'actual'
                      ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                      : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                  }
                >
                  {it.kind === 'actual' ? '實際' : '預估'}
                </Badge>
                <span className="w-24 text-right font-mono text-xs text-slate-200 tabular-nums">
                  {fmtMoney(it.twd, 'TWD')}
                </span>
              </li>
            ))}
          {stat.items.length === 0 ? <li className="px-5 py-6 text-center text-xs text-muted">尚無資料</li> : null}
        </ul>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted/70">
        <CalendarDays size={12} />
        「預估」會在補登實際扣款後自動變成「實際」，並改用當下的真實匯率。
      </p>
    </div>
  )
}
