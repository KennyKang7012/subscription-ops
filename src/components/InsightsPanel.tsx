import { AlertTriangle, Info, Lightbulb } from 'lucide-react'
import type { Insight, InsightLevel } from '../lib/analytics'
import { Card, CardTitle, Empty } from './ui'

const LEVEL: Record<InsightLevel, { icon: typeof Info; ring: string; text: string; bg: string }> = {
  warn: { icon: AlertTriangle, ring: 'ring-amber-400/25', text: 'text-amber-300', bg: 'bg-amber-400/8' },
  tip: { icon: Lightbulb, ring: 'ring-sky-400/25', text: 'text-sky-300', bg: 'bg-sky-400/8' },
  info: { icon: Info, ring: 'ring-slate-400/20', text: 'text-slate-300', bg: 'bg-slate-400/6' },
}

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  return (
    <Card className="flex flex-col">
      <CardTitle
        title="省錢洞察"
        hint="由匯率、扣款紀錄與訂閱結構自動推算"
        right={<span className="text-[11px] text-muted">{insights.length} 則</span>}
      />
      {insights.length === 0 ? (
        <Empty title="沒有需要注意的事" hint="沒有漲價、沒有重疊、匯率也是最新的。維持下去。" />
      ) : (
        <ul className="grid gap-2 px-4 pb-4 md:grid-cols-2">
          {insights.map((i) => {
            const L = LEVEL[i.level]
            const Icon = L.icon
            return (
              <li key={i.id} className={`flex gap-2.5 rounded-xl p-3 ring-1 ring-inset ${L.bg} ${L.ring}`}>
                <Icon size={15} className={`mt-0.5 shrink-0 ${L.text}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-100">{i.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{i.detail}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
