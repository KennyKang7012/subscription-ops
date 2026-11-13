import { useState } from 'react'
import type { Category, Currency, Cycle, Subscription, SubStatus } from '../types'
import { CATEGORY_META, CATEGORY_ORDER, CYCLE_LABEL, STATUS_LABEL, splitCharge } from '../lib/money'
import { currentMonthKey, todayISO } from '../lib/date'
import { resolveRate } from '../lib/fx'
import { useStore } from '../store/useStore'
import { Button, Field, Input, Modal, Select, cn } from './ui'

const blank = (): Omit<Subscription, 'id' | 'createdAt'> => ({
  name: '',
  vendor: '',
  category: 'ai',
  amount: 20,
  currency: 'USD',
  cycle: 'monthly',
  anchorDay: Number(todayISO().slice(8, 10)),
  anchorMonth: null,
  startedAt: todayISO(),
  endedAt: null,
  trialEndsAt: null,
  status: 'active',
  seats: 1,
  note: '',
})

export function SubscriptionForm({
  open,
  initial,
  onClose,
}: {
  open: boolean
  initial: Subscription | null
  onClose: () => void
}) {
  const addSubscription = useStore((s) => s.addSubscription)
  const updateSubscription = useStore((s) => s.updateSubscription)
  const settings = useStore((s) => s.settings)
  const fxRates = useStore((s) => s.fxRates)
  const charges = useStore((s) => s.charges)
  const subscriptions = useStore((s) => s.subscriptions)

  const [form, setForm] = useState<Omit<Subscription, 'id' | 'createdAt'>>(() =>
    initial ? stripMeta(initial) : blank(),
  )
  const [error, setError] = useState('')

  // 跟儀表板用同一套匯率解析，避免表單顯示的數字跟 KPI 不一樣
  const rate = resolveRate(
    { subscriptions, charges, fxRates, settings },
    currentMonthKey(),
  ).rate

  const set = <K extends keyof Omit<Subscription, 'id' | 'createdAt'>>(
    key: K,
    value: Omit<Subscription, 'id' | 'createdAt'>[K],
  ) => setForm((f) => ({ ...f, [key]: value }))

  const submit = () => {
    if (!form.name.trim()) return setError('請填寫工具名稱')
    if (!(form.amount > 0)) return setError('金額必須大於 0')
    if (form.anchorDay < 1 || form.anchorDay > 31) return setError('扣款日需介於 1 到 31')
    if (form.cycle === 'yearly' && (form.anchorMonth ?? 0) < 1) return setError('年繳請選擇扣款月份')

    if (initial) {
      updateSubscription(initial.id, { ...form, name: form.name.trim(), vendor: form.vendor.trim() })
    } else {
      addSubscription({ ...form, name: form.name.trim(), vendor: form.vendor.trim() })
    }
    onClose()
  }

  // 等效月支出與儀表板同口徑：年繳 ÷12，且含國外交易手續費
  const monthlyHint = splitCharge(
    form.cycle === 'yearly' ? form.amount / 12 : form.cycle === 'monthly' ? form.amount : 0,
    form.currency,
    rate,
    settings.feeRate,
  ).total

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial ? '編輯訂閱' : '新增訂閱'}
      subtitle={initial ? initial.name : '金額請填「原幣」，台幣換算會自動處理'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={submit}>
            {initial ? '儲存變更' : '新增訂閱'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="工具名稱" className="sm:col-span-1">
          <Input
            autoFocus
            value={form.name}
            placeholder="例：ChatGPT Plus"
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <Field label="供應商" hint="選填">
          <Input value={form.vendor} placeholder="例：OpenAI" onChange={(e) => set('vendor', e.target.value)} />
        </Field>

        <Field label="分類">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_ORDER.map((c: Category) => (
              <button
                key={c}
                type="button"
                onClick={() => set('category', c)}
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors',
                  form.category === c
                    ? 'border-brand/50 bg-brand/10 text-slate-100'
                    : 'border-line text-muted hover:text-slate-200',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', CATEGORY_META[c].dot)} />
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="狀態">
          <Select value={form.status} onChange={(e) => set('status', e.target.value as SubStatus)}>
            {(Object.keys(STATUS_LABEL) as SubStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="金額" hint="原幣">
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.amount}
              onChange={(e) => set('amount', Number(e.target.value))}
              className="font-mono"
            />
            <Select
              value={form.currency}
              onChange={(e) => set('currency', e.target.value as Currency)}
              className="w-24"
            >
              <option value="USD">US$</option>
              <option value="TWD">NT$</option>
            </Select>
          </div>
        </Field>

        <Field label="計費週期">
          <Select value={form.cycle} onChange={(e) => set('cycle', e.target.value as Cycle)}>
            {(Object.keys(CYCLE_LABEL) as Cycle[]).map((c) => (
              <option key={c} value={c}>
                {CYCLE_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="每月扣款日" hint="遇到短月自動夾到月底">
          <Input
            type="number"
            min={1}
            max={31}
            value={form.anchorDay}
            onChange={(e) => set('anchorDay', Number(e.target.value))}
            className="font-mono"
          />
        </Field>

        {form.cycle === 'yearly' ? (
          <Field label="年繳扣款月份">
            <Select
              value={String(form.anchorMonth ?? 1)}
              onChange={(e) => set('anchorMonth', Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m} 月
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field label="開始訂閱日">
          <Input type="date" value={form.startedAt} onChange={(e) => set('startedAt', e.target.value)} />
        </Field>

        <Field label="結束日" hint="選填，取消時留空即可">
          <Input
            type="date"
            value={form.endedAt ?? ''}
            onChange={(e) => set('endedAt', e.target.value || null)}
          />
        </Field>

        <Field label="試用到期日" hint="選填">
          <Input
            type="date"
            value={form.trialEndsAt ?? ''}
            onChange={(e) => set('trialEndsAt', e.target.value || null)}
          />
        </Field>

        <Field label="席位數" hint="多人分攤用">
          <Input
            type="number"
            min={1}
            value={form.seats}
            onChange={(e) => set('seats', Math.max(1, Number(e.target.value)))}
            className="font-mono"
          />
        </Field>

        <Field label="備註" className="sm:col-span-2">
          <Input value={form.note} placeholder="例：含 2TB 雲端空間" onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line/70 bg-panel2/50 px-3.5 py-2.5">
        <span className="text-[11px] text-muted">
          等效月支出（含手續費）
          <span className="ml-1.5 font-mono text-slate-200">NT${Math.round(monthlyHint).toLocaleString()}</span>
          <span className="ml-1.5">（匯率 {rate}）</span>
        </span>
        {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
      </div>
    </Modal>
  )
}

function stripMeta(s: Subscription): Omit<Subscription, 'id' | 'createdAt'> {
  return {
    name: s.name,
    vendor: s.vendor,
    category: s.category,
    amount: s.amount,
    currency: s.currency,
    cycle: s.cycle,
    anchorDay: s.anchorDay,
    anchorMonth: s.anchorMonth,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    trialEndsAt: s.trialEndsAt,
    status: s.status,
    seats: s.seats,
    note: s.note,
  }
}
