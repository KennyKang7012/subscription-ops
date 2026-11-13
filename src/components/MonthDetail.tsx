import { Pencil, Trash2 } from 'lucide-react'
import type { MonthStat } from '../lib/analytics'
import { CATEGORY_META, fmtMoney } from '../lib/money'
import { shortDate } from '../lib/date'
import type { Charge } from '../types'
import { Badge, Card, CardTitle, Empty } from './ui'

export function MonthDetail({
  stat,
  charges,
  basis,
  onEditCharge,
  onDeleteCharge,
}: {
  stat: MonthStat
  charges: Charge[]
  basis: 'cash' | 'accrual'
  onEditCharge: (charge: Charge) => void
  onDeleteCharge: (chargeId: string) => void
}) {
  const sorted = [...stat.items].sort((a, b) => b.twd - a.twd)
  const isAccrual = basis === 'accrual'

  return (
    <Card>
      <CardTitle
        title="本月帳單明細"
        hint={
          isAccrual
            ? '攤提模式：依訂閱定義把年繳平均分到 12 個月'
            : '實際 = 已入帳；預估 = 依扣款日推算，補登後會轉為實際'
        }
        right={
          <div className="flex items-center gap-2">
            {isAccrual ? (
              <Badge className="bg-ai/12 text-ai ring-ai/30">
                攤提合計 NT${Math.round(stat.totalTwd).toLocaleString()}
              </Badge>
            ) : (
              <>
                <Badge className="bg-emerald-400/12 text-emerald-300 ring-emerald-400/30">
                  實際 NT${Math.round(stat.actualTwd).toLocaleString()}
                </Badge>
                <Badge className="bg-amber-400/12 text-amber-300 ring-amber-400/30">
                  預估 NT${Math.round(stat.estimatedTwd).toLocaleString()}
                </Badge>
              </>
            )}
          </div>
        }
      />
      {sorted.length === 0 ? (
        <Empty title="本月沒有支出" hint="新增訂閱，或從「即將扣款」清單補登一筆" />
      ) : (
        <ul className="divide-y divide-line/50">
          {sorted.map((it) => {
            const meta = CATEGORY_META[it.category]
            return (
              <li key={it.key} className="group flex items-center gap-3 px-5 py-2">
                <span className="w-10 shrink-0 font-mono text-[11px] text-muted">{shortDate(it.date)}</span>
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{it.name}</span>
                <Badge
                  className={
                    isAccrual
                      ? 'bg-ai/10 text-ai ring-ai/25'
                      : it.kind === 'actual'
                        ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25'
                        : 'bg-amber-400/10 text-amber-300 ring-amber-400/25'
                  }
                >
                  {isAccrual ? '攤提' : it.kind === 'actual' ? '實際' : '預估'}
                </Badge>
                <span className="w-24 text-right font-mono text-xs text-slate-200 tabular-nums">
                  {fmtMoney(it.twd, 'TWD')}
                </span>
                <div className="flex w-14 justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                  {it.kind === 'actual' && !isAccrual ? (
                    <>
                      <button
                        title="編輯"
                        onClick={() => {
                          const charge = charges.find((c) => c.id === it.key)
                          if (charge) onEditCharge(charge)
                        }}
                        className="cursor-pointer rounded-md p-1 text-muted hover:bg-white/5 hover:text-slate-100"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        title="刪除"
                        onClick={() => onDeleteCharge(it.key)}
                        className="cursor-pointer rounded-md p-1 text-muted hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
