import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '../lib/analytics'
import { CATEGORY_META, CATEGORY_ORDER, round2 } from '../lib/money'
import { Card, CardTitle } from './ui'

interface Props {
  points: TrendPoint[]
  displayCurrency: 'USD' | 'TWD'
  rate: number
  selectedMonth: string
  onSelectMonth: (month: string) => void
}

export function TrendChart({ points, displayCurrency, rate, selectedMonth, onSelectMonth }: Props) {
  const conv = (twd: number) => (displayCurrency === 'USD' ? round2(twd / (rate || 1)) : Math.round(twd))

  const data = points.map((p) => {
    const row: Record<string, number | string> = { month: p.month, label: p.label }
    for (const c of CATEGORY_ORDER) row[c] = conv(p.byCategory[c])
    row.total = conv(p.total)
    return row
  })

  const avg = data.length ? Math.round(data.reduce((s, d) => s + Number(d.total), 0) / data.length) : 0
  const symbol = displayCurrency === 'USD' ? 'US$' : 'NT$'
  const tick = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : String(v))

  const renderTip = (props: any) => {
    const { active, payload, label } = props
    if (!active || !payload?.length) return null
    const rows = (payload as any[]).filter((p) => Number(p.value) > 0)
    const total = rows.reduce((s: number, p: any) => s + Number(p.value), 0)
    return (
      <div className="rounded-xl border border-line bg-panel/95 px-3 py-2.5 shadow-xl backdrop-blur">
        <div className="mb-1.5 flex items-baseline justify-between gap-4">
          <span className="text-xs font-semibold text-slate-200">{label}</span>
          <span className="font-mono text-xs text-brand">
            {symbol}
            {total.toLocaleString()}
          </span>
        </div>
        <div className="space-y-1">
          {rows.map((p) => (
            <div key={p.dataKey} className="flex items-center gap-2 text-[11px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
              <span className="text-muted">{CATEGORY_META[p.dataKey as keyof typeof CATEGORY_META]?.label ?? p.dataKey}</span>
              <span className="ml-auto font-mono text-slate-300">
                {symbol}
                {Number(p.value).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardTitle
        title="12 個月支出趨勢"
        hint={`點長條或下方月份可切換　·　虛線為月均 ${symbol}${avg.toLocaleString()}`}
        right={
          <div className="flex flex-wrap items-center gap-3">
            {CATEGORY_ORDER.map((c) => (
              <span key={c} className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="h-2 w-2 rounded-sm" style={{ background: CATEGORY_META[c].hex }} />
                {CATEGORY_META[c].label}
              </span>
            ))}
          </div>
        }
      />
      <div className="h-[260px] px-1 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }} barCategoryGap="26%">
            <CartesianGrid vertical={false} stroke="#1b2537" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8b9bb4', fontSize: 11 }}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickFormatter={tick}
            />
            <Tooltip content={renderTip} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
            <ReferenceLine y={avg} stroke="#334155" strokeDasharray="4 4" />
            {CATEGORY_ORDER.map((c, i) => (
              <Bar
                key={c}
                dataKey={c}
                stackId="cost"
                fill={CATEGORY_META[c].hex}
                radius={i === CATEGORY_ORDER.length - 1 ? [4, 4, 0, 0] : undefined}
                cursor="pointer"
                onClick={(_entry: unknown, index: number) => {
                  const target = points[index]
                  if (target) onSelectMonth(target.month)
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-1.5 overflow-x-auto border-t border-line/70 px-4 py-2.5">
        {points.map((p) => (
          <button
            key={p.month}
            onClick={() => onSelectMonth(p.month)}
            className={
              'shrink-0 cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ' +
              (p.month === selectedMonth
                ? 'bg-brand/15 text-brand ring-1 ring-brand/30'
                : 'text-muted hover:bg-white/5 hover:text-slate-200')
            }
          >
            {p.label}
          </button>
        ))}
      </div>
    </Card>
  )
}
