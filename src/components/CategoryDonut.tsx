import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { MonthStat } from '../lib/analytics'
import { CATEGORY_META, CATEGORY_ORDER, fmtMoney, round2 } from '../lib/money'
import type { Category, Currency } from '../types'
import { Card, CardTitle, Empty } from './ui'

export function CategoryDonut({
  stat,
  displayCurrency,
  rate,
}: {
  stat: MonthStat
  displayCurrency: Currency
  rate: number
}) {
  const conv = (twd: number) => (displayCurrency === 'USD' ? round2(twd / (rate || 1)) : twd)
  const rows = CATEGORY_ORDER.map((c) => ({
    key: c,
    name: CATEGORY_META[c].label,
    value: conv(stat.byCategory[c]),
    twd: stat.byCategory[c],
    hex: CATEGORY_META[c].hex,
  })).filter((r) => r.value > 0)

  const total = rows.reduce((s, r) => s + r.value, 0)
  const digit = displayCurrency === 'USD' ? 2 : 0
  const topItems = [...stat.items].sort((a, b) => b.twd - a.twd).slice(0, 2)

  return (
    <Card className="flex flex-col">
      <CardTitle title="分類佔比" hint="本月支出結構，找出錢包黑洞" />
      {rows.length === 0 ? (
        <Empty title="本月還沒有支出" hint="新增訂閱或補登一筆扣款就會出現在這裡" />
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-center">
          <div className="relative mx-auto h-[168px] w-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={54}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                >
                  {rows.map((r) => (
                    <Cell key={r.key} fill={r.hex} />
                  ))}
                </Pie>
                <Tooltip
                  content={(props: any) => {
                    const p = props?.payload?.[0]
                    if (!props?.active || !p) return null
                    return (
                      <div className="rounded-lg border border-line bg-panel/95 px-2.5 py-1.5 text-[11px] shadow-xl">
                        <span className="text-slate-200">{p.name}</span>
                        <span className="ml-2 font-mono text-brand">
                          {fmtMoney(p.value, displayCurrency, digit)}
                        </span>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] tracking-widest text-muted uppercase">Total</span>
              <span className="font-mono text-base font-semibold text-white">
                {fmtMoney(total, displayCurrency, digit)}
              </span>
              <span className="mt-0.5 text-[10px] text-muted">{rows.length} 類</span>
            </div>
          </div>

          <ul className="flex-1 space-y-2">
            {rows
              .slice()
              .sort((a, b) => b.value - a.value)
              .map((r) => {
                const pct = total > 0 ? r.value / total : 0
                return (
                  <li key={r.key}>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: r.hex }} />
                      <span className="text-slate-300">{r.name}</span>
                      <span className="ml-auto font-mono text-[11px] text-muted tabular-nums">
                        {(pct * 100).toFixed(0)}%
                      </span>
                      <span className="w-20 text-right font-mono text-[11px] text-slate-200 tabular-nums">
                        {fmtMoney(r.value, displayCurrency, digit)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(pct * 100, 2)}%`, background: r.hex }}
                      />
                    </div>
                  </li>
                )
              })}
          </ul>
        </div>
      )}
      {topItems.length > 0 ? (
        <div className="mt-auto space-y-1 border-t border-line/60 px-5 py-2.5">
          {topItems.map((it, i) => (
            <div key={it.key} className="flex items-center gap-2 text-[11px]">
              <span className="w-12 shrink-0 text-muted">{i === 0 ? '最貴' : '次之'}</span>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${CATEGORY_META[it.category].dot}`} />
              <span className="truncate text-slate-300">{it.name}</span>
              <span className="ml-auto font-mono text-slate-200 tabular-nums">
                {fmtMoney(conv(it.twd), displayCurrency, digit)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Card>
  )
}

export type { Category }
