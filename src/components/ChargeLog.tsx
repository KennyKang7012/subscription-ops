import { useMemo } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { Charge } from '../types'
import { useStore } from '../store/useStore'
import { fmtMoney } from '../lib/money'
import { monthLabelFull, shortDate } from '../lib/date'
import { Badge, Button, Card, CardTitle, Empty } from './ui'

export function ChargeLog({ onEdit, onNew }: { onEdit: (c: Charge) => void; onNew: () => void }) {
  const charges = useStore((s) => s.charges)
  const subscriptions = useStore((s) => s.subscriptions)
  const removeCharge = useStore((s) => s.removeCharge)

  const groups = useMemo(() => {
    const sorted = [...charges].sort((a, b) => b.chargedAt.localeCompare(a.chargedAt))
    const map = new Map<string, Charge[]>()
    for (const c of sorted) {
      const mk = c.chargedAt.slice(0, 7)
      const arr = map.get(mk) ?? []
      arr.push(c)
      map.set(mk, arr)
    }
    return Array.from(map.entries())
  }, [charges])

  return (
    <Card>
      <CardTitle
        title="扣款紀錄"
        hint="實帳來源。有紀錄的月份，匯率與金額都會以這裡為準"
        right={
          <Button size="sm" variant="outline" onClick={onNew}>
            <Plus size={13} /> 補登扣款
          </Button>
        }
      />
      {groups.length === 0 ? (
        <Empty title="還沒有任何扣款紀錄" hint="每次收到信用卡帳單就來補登一筆，數字才會準" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line/70 text-[11px] tracking-wider text-muted uppercase">
                <th className="px-5 py-2 text-left font-medium">日期</th>
                <th className="px-3 py-2 text-left font-medium">訂閱</th>
                <th className="px-3 py-2 text-right font-medium">原幣</th>
                <th className="px-3 py-2 text-right font-medium">匯率</th>
                <th className="px-3 py-2 text-right font-medium">手續費</th>
                <th className="px-3 py-2 text-right font-medium">入帳台幣</th>
                <th className="px-3 py-2 text-right font-medium">操作</th>
              </tr>
            </thead>
            {groups.map(([mk, list]) => {
              const subtotal = list.reduce((s, c) => s + c.amountTwd, 0)
              return (
                <tbody key={mk}>
                  <tr className="bg-white/[0.02]">
                    <td colSpan={5} className="px-5 py-1.5 text-[11px] font-medium text-slate-300">
                      {monthLabelFull(mk)}
                      <span className="ml-2 text-muted">{list.length} 筆</span>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[11px] text-brand">
                      {fmtMoney(subtotal, 'TWD')}
                    </td>
                    <td />
                  </tr>
                  {list.map((c) => {
                    const sub = subscriptions.find((s) => s.id === c.subscriptionId)
                    return (
                      <tr key={c.id} className="group border-b border-line/40 hover:bg-white/[0.02]">
                        <td className="px-5 py-2 font-mono text-[11px] text-muted">{shortDate(c.chargedAt)}</td>
                        <td className="px-3 py-2 text-xs text-slate-200">{sub?.name ?? '（已刪除的訂閱）'}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-slate-300">
                          {fmtMoney(c.amountOriginal, c.currency, c.currency === 'USD' ? 2 : 0)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-muted">
                          {c.currency === 'USD' ? c.fxRate : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px] text-muted">
                          {c.feeTwd > 0 ? `NT$${c.feeTwd}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-slate-100">
                          {fmtMoney(c.amountTwd, 'TWD')}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100">
                            <button
                              title="編輯"
                              onClick={() => onEdit(c)}
                              className="cursor-pointer rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-slate-100"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              title="刪除"
                              onClick={() => removeCharge(c.id)}
                              className="cursor-pointer rounded-md p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-300"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )
            })}
          </table>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-line/60 px-5 py-2.5">
        <Badge className="bg-emerald-400/12 text-emerald-300 ring-emerald-400/30">
          累計 {charges.length} 筆
        </Badge>
        <span className="text-[11px] text-muted">
          全部 NT${Math.round(charges.reduce((s, c) => s + c.amountTwd, 0)).toLocaleString()}
        </span>
      </div>
    </Card>
  )
}
