import { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { useStore } from '../store/useStore'
import { RATE_SOURCE_META, latestRate } from '../lib/fx'
import { marketRateAgeDays, syncMarketRate } from '../lib/rates'
import { round2 } from '../lib/money'
import { todayISO } from '../lib/date'
import { Badge, Button, Card, CardTitle, Field, Input, Select, cn } from './ui'

export function FxPanel() {
  const fxRates = useStore((s) => s.fxRates)
  const addFxRate = useStore((s) => s.addFxRate)
  const removeFxRate = useStore((s) => s.removeFxRate)
  const subscriptions = useStore((s) => s.subscriptions)
  const charges = useStore((s) => s.charges)
  const settings = useStore((s) => s.settings)

  const [date, setDate] = useState(todayISO())
  const [rate, setRate] = useState('32')
  const [source, setSource] = useState<'manual' | 'market'>('manual')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const run = async (force: boolean) => {
    setSyncing(true)
    const res = await syncMarketRate({ force })
    setSyncMsg({ ok: res.ok, text: res.message })
    if (res.ok && res.rate) setRate(String(res.rate))
    setSyncing(false)
  }

  const current = latestRate({ subscriptions, charges, fxRates, settings })
  const sorted = [...fxRates].sort((a, b) => b.date.localeCompare(a.date))
  const ageDays = marketRateAgeDays(fxRates)
  const usdMonthly = round2(
    subscriptions
      .filter((s) => s.currency === 'USD' && s.status === 'active')
      .reduce((n, s) => n + (s.cycle === 'yearly' ? s.amount / 12 : s.amount), 0),
  )

  return (
    <Card>
      <CardTitle
        title="匯率管理"
        hint="USD/TWD。優先序：該月實際扣款 → 手動設定 → 最新市場 → 全域預設"
        right={
          <div className="text-right">
            <div className="font-mono text-lg leading-none text-brand">{current.rate}</div>
            <Badge className={cn('mt-1', RATE_SOURCE_META[current.source].badge)}>
              {RATE_SOURCE_META[current.source].label}
            </Badge>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-line/60 px-5 py-2.5">
        <Button size="sm" variant="outline" disabled={syncing} onClick={() => void run(true)}>
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          {syncing ? '更新中…' : '立即更新'}
        </Button>
        <span className="text-[11px] text-muted">
          來源 open.er-api.com ·{' '}
          {syncMsg ? (
            <span className={syncMsg.ok ? 'text-emerald-300' : 'text-amber-300'}>{syncMsg.text}</span>
          ) : ageDays === null ? (
            '尚無市場匯率'
          ) : ageDays === 0 ? (
            '今天已同步'
          ) : (
            `${ageDays} 天前更新`
          )}
        </span>
      </div>

      <div className="grid gap-2 px-5 pb-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label="日期">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="匯率">
          <Input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="來源">
          <Select value={source} onChange={(e) => setSource(e.target.value as 'manual' | 'market')}>
            <option value="manual">手動（預算用）</option>
            <option value="market">市場紀錄</option>
          </Select>
        </Field>
        <div className="flex items-end">
          <Button
            variant="primary"
            onClick={() => {
              const v = Number(rate)
              if (!(v > 0)) return
              addFxRate({ date, pair: 'USD/TWD', rate: v, source })
            }}
          >
            <Plus size={14} /> 新增
          </Button>
        </div>
      </div>

      <div className="max-h-[260px] overflow-y-auto border-t border-line/60">
        {sorted.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-muted">還沒有任何匯率紀錄，目前使用預設值</p>
        ) : (
          <ul className="divide-y divide-line/40">
            {sorted.map((r) => (
              <li key={r.id} className="group flex items-center gap-3 px-5 py-2">
                <span className="font-mono text-[11px] text-muted">{r.date}</span>
                <Badge
                  className={
                    r.source === 'manual'
                      ? 'bg-brand/12 text-brand ring-brand/30'
                      : 'bg-ai/12 text-ai ring-ai/30'
                  }
                >
                  {r.source === 'manual' ? '手動' : '市場'}
                </Badge>
                <span className="ml-auto font-mono text-xs text-slate-200">{r.rate}</span>
                <button
                  onClick={() => removeFxRate(r.id)}
                  className="cursor-pointer rounded-md p-1 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-300"
                  title="刪除"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-line/60 px-5 py-2.5 text-[11px] text-muted">
        美金訂閱原幣合計{' '}
        <span className="font-mono text-slate-300">US${usdMonthly.toFixed(2)}</span> / 月 ≈{' '}
        <span className="font-mono text-slate-300">NT${Math.round(usdMonthly * current.rate).toLocaleString()}</span>
        （匯率 {current.rate}）
      </div>
    </Card>
  )
}
