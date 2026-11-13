import { useMemo, useState } from 'react'
import type { Charge, Currency } from '../types'
import { billingDateInMonth, currentMonthKey, monthKeyOf, todayISO } from '../lib/date'
import { resolveRate } from '../lib/fx'
import { fmtMoney, round2 } from '../lib/money'
import { useStore } from '../store/useStore'
import { Button, Field, Input, Modal, Select } from './ui'

export function ChargeForm({
  open,
  initial,
  presetSubscriptionId,
  presetDate,
  onClose,
}: {
  open: boolean
  initial: Charge | null
  presetSubscriptionId?: string
  presetDate?: string
  onClose: () => void
}) {
  const subscriptions = useStore((s) => s.subscriptions)
  const charges = useStore((s) => s.charges)
  const fxRates = useStore((s) => s.fxRates)
  const settings = useStore((s) => s.settings)
  const addCharge = useStore((s) => s.addCharge)
  const updateCharge = useStore((s) => s.updateCharge)

  const presetSub = subscriptions.find((s) => s.id === (initial?.subscriptionId ?? presetSubscriptionId))
  const selected = presetSub ?? subscriptions[0]

  const defaultDate = (() => {
    if (initial?.chargedAt) return initial.chargedAt
    if (presetDate) return presetDate
    if (selected) {
      const billDate = billingDateInMonth(selected, currentMonthKey())
      if (billDate && billDate <= todayISO()) return billDate
    }
    return todayISO()
  })()

  const [subscriptionId, setSubscriptionId] = useState(selected?.id ?? '')
  const [chargedAt, setChargedAt] = useState(defaultDate)
  const [amountOriginal, setAmountOriginal] = useState(initial?.amountOriginal ?? selected?.amount ?? 0)
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? selected?.currency ?? 'USD')
  const [fxTouched, setFxTouched] = useState(Boolean(initial))
  const [fxInput, setFxInput] = useState(String(initial?.fxRate ?? 0))
  const [feeInput, setFeeInput] = useState(String(initial?.feeTwd ?? 0))
  const [feeTouched, setFeeTouched] = useState(Boolean(initial))
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  const resolved = useMemo(
    () => resolveRate({ subscriptions, charges, fxRates, settings }, monthKeyOf(chargedAt)),
    [subscriptions, charges, fxRates, settings, chargedAt],
  )

  const fxRate = currency === 'TWD' ? 1 : fxTouched ? Number(fxInput) || resolved.rate : resolved.rate
  const base = currency === 'TWD' ? amountOriginal : round2(amountOriginal * fxRate)
  const feeTwd = feeTouched ? Number(feeInput) || 0 : currency === 'TWD' ? 0 : round2(base * settings.feeRate)
  const amountTwd = round2(base + feeTwd)

  const pickSubscription = (id: string) => {
    setSubscriptionId(id)
    const sub = subscriptions.find((s) => s.id === id)
    if (sub) {
      setAmountOriginal(sub.amount)
      setCurrency(sub.currency)
      setFxTouched(false)
      setFeeTouched(false)
    }
  }

  const submit = () => {
    if (!subscriptionId) return setError('請先建立一個訂閱，或選擇要補登的訂閱')
    if (!(amountOriginal > 0)) return setError('金額必須大於 0')
    if (currency === 'USD' && !(fxRate > 0)) return setError('匯率必須大於 0')

    const payload = {
      subscriptionId,
      chargedAt,
      amountOriginal,
      currency,
      fxRate,
      feeTwd,
      amountTwd,
      source: 'manual' as const,
      note,
    }
    if (initial) updateCharge(initial.id, payload)
    else addCharge(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? '編輯扣款紀錄' : '補登一筆扣款'}
      subtitle="以實際入帳金額為準，之後的估算會自動改用這裡的匯率"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={submit}>
            {initial ? '儲存變更' : '新增紀錄'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="訂閱項目" className="sm:col-span-2">
          <Select value={subscriptionId} onChange={(e) => pickSubscription(e.target.value)}>
            {subscriptions.length === 0 ? <option value="">（尚無訂閱）</option> : null}
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.currency}）
              </option>
            ))}
          </Select>
        </Field>

        <Field label="扣款日期">
          <Input type="date" value={chargedAt} onChange={(e) => setChargedAt(e.target.value)} />
        </Field>

        <Field label="原幣金額">
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              value={amountOriginal}
              onChange={(e) => setAmountOriginal(Number(e.target.value))}
              className="font-mono"
            />
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="w-24">
              <option value="USD">US$</option>
              <option value="TWD">NT$</option>
            </Select>
          </div>
        </Field>

        <Field label="匯率 USD/TWD" hint={currency === 'TWD' ? '台幣扣款固定為 1' : `建議 ${resolved.rate}`}>
          <Input
            type="number"
            step="0.01"
            disabled={currency === 'TWD'}
            value={currency === 'TWD' ? 1 : fxTouched ? fxInput : resolved.rate}
            onChange={(e) => {
              setFxTouched(true)
              setFxInput(e.target.value)
            }}
            className="font-mono disabled:opacity-50"
          />
        </Field>

        <Field label="國外交易手續費" hint="台幣">
          <Input
            type="number"
            step="0.01"
            value={feeTouched ? feeInput : feeTwd}
            onChange={(e) => {
              setFeeTouched(true)
              setFeeInput(e.target.value)
            }}
            className="font-mono"
          />
        </Field>

        <Field label="備註" className="sm:col-span-2">
          <Input value={note} placeholder="選填" onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl border border-brand/25 bg-brand/5 px-4 py-3">
        <div className="text-[11px] text-muted">
          入帳台幣
          <div className="mt-0.5 text-[10px] text-muted/80">
            {currency === 'USD'
              ? `${fmtMoney(amountOriginal, 'USD', 2)} × ${fxRate} + 手續費 ${feeTwd}`
              : `台幣扣款，無匯率轉換`}
          </div>
        </div>
        <span className="font-mono text-lg font-semibold text-brand">{fmtMoney(amountTwd, 'TWD')}</span>
      </div>

      {error ? <p className="mt-2 text-[11px] text-rose-300">{error}</p> : null}
    </Modal>
  )
}
