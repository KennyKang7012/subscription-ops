import { beforeEach, describe, expect, it } from 'vitest'
import { useStore, defaultSettings } from '../useStore'
import { makeSub } from '../../lib/__tests__/fixtures'
import { computeMonth, estimateChargeTwd } from '../../lib/analytics'
import { addMonths, currentMonthKey, todayISO } from '../../lib/date'
import type { AppData } from '../../types'

const reset = (data: Partial<AppData> = {}) =>
  useStore.setState({
    subscriptions: [],
    charges: [],
    fxRates: [],
    settings: { ...defaultSettings },
    ...data,
  })

const state = (): AppData => {
  const s = useStore.getState()
  return {
    subscriptions: s.subscriptions,
    charges: s.charges,
    fxRates: s.fxRates,
    settings: s.settings,
  }
}

beforeEach(() => reset())

describe('updateSubscription：狀態與結束日', () => {
  it('改成已取消會自動補上今天的結束日', () => {
    const id = useStore.getState().addSubscription(makeSub({ status: 'active' }))
    useStore.getState().updateSubscription(id, { status: 'cancelled' })

    const sub = useStore.getState().subscriptions.find((s) => s.id === id)!
    expect(sub.endedAt).toBe(todayISO())
    expect(sub.status).toBe('cancelled')
  })

  it('改成已暫停也會補結束日', () => {
    const id = useStore.getState().addSubscription(makeSub({ status: 'active' }))
    useStore.getState().updateSubscription(id, { status: 'paused' })
    expect(useStore.getState().subscriptions.find((s) => s.id === id)!.endedAt).toBe(todayISO())
  })

  it('跨日後恢復訂閱中，仍然會清掉結束日（回歸測試）', () => {
    const id = useStore.getState().addSubscription(makeSub({ status: 'active' }))
    useStore.getState().updateSubscription(id, { status: 'cancelled' })

    // 模擬「昨天取消、今天才恢復」：把結束日改成前一天
    const d = new Date(todayISO())
    d.setDate(d.getDate() - 1)
    const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    useStore.getState().updateSubscription(id, { endedAt: prev })
    expect(useStore.getState().subscriptions.find((s) => s.id === id)!.endedAt).toBe(prev)

    // 恢復啟用
    useStore.getState().updateSubscription(id, { status: 'active' })
    const sub = useStore.getState().subscriptions.find((s) => s.id === id)!
    expect(sub.status).toBe('active')
    expect(sub.endedAt).toBeNull()
  })

  it('恢復啟用時使用者若明確指定結束日，則保留', () => {
    const id = useStore.getState().addSubscription(makeSub({ status: 'active' }))
    useStore.getState().updateSubscription(id, { status: 'cancelled' })
    useStore.getState().updateSubscription(id, { status: 'active', endedAt: '2026-12-31' })
    expect(useStore.getState().subscriptions.find((s) => s.id === id)!.endedAt).toBe('2026-12-31')
  })

  it('取消後歷史月份仍算得出來（回歸測試）', () => {
    const id = useStore.getState().addSubscription(
      makeSub({ status: 'active', startedAt: '2026-01-01', anchorDay: 8 }),
    )
    const lastMonth = addMonths(currentMonthKey(), -1)
    const before = computeMonth(state(), lastMonth, 'cash').totalTwd
    expect(before).toBeGreaterThan(0)

    useStore.getState().updateSubscription(id, { status: 'cancelled' })
    expect(computeMonth(state(), lastMonth, 'cash').totalTwd).toBe(before)
  })
})

describe('logChargeFor：一鍵補登', () => {
  const sub = makeSub({ id: 's1', amount: 20, currency: 'USD', anchorDay: 8 })

  it('同一訂閱同一個月只會補一次', () => {
    reset({ subscriptions: [sub] })
    const first = useStore.getState().logChargeFor('s1', `${currentMonthKey()}-08`)
    const second = useStore.getState().logChargeFor('s1', `${currentMonthKey()}-09`)

    expect(first).toBe(true)
    expect(second).toBe(false)
    expect(useStore.getState().charges).toHaveLength(1)
  })

  it('不同月份可以各補一筆（過去月份）', () => {
    reset({ subscriptions: [sub] })
    useStore.getState().logChargeFor('s1', `${addMonths(currentMonthKey(), -1)}-08`)
    useStore.getState().logChargeFor('s1', `${currentMonthKey()}-08`)
    expect(useStore.getState().charges).toHaveLength(2)
    expect(useStore.getState().charges.map((c) => c.chargedAt.slice(0, 7))).toEqual([
      addMonths(currentMonthKey(), -1),
      currentMonthKey(),
    ])
  })

  it('找不到訂閱時回傳 false', () => {
    reset({ subscriptions: [] })
    expect(useStore.getState().logChargeFor('nope')).toBe(false)
  })

  it('補登金額與估算同口徑，皆含手續費', () => {
    reset({
      subscriptions: [sub],
      fxRates: [{ id: 'f1', date: `${currentMonthKey()}-01`, pair: 'USD/TWD', rate: 32, source: 'market' }],
    })
    useStore.getState().logChargeFor('s1', `${currentMonthKey()}-08`)
    const charge = useStore.getState().charges[0]
    expect(charge.feeTwd).toBe(9.6)
    expect(charge.amountTwd).toBe(649.6)
    expect(charge.amountTwd).toBe(estimateChargeTwd(sub, 32, defaultSettings.feeRate))
  })

  it('未來日期會被夾回今天，不會記到未來', () => {
    reset({ subscriptions: [sub] })
    useStore.getState().logChargeFor('s1', '2099-01-01')
    expect(useStore.getState().charges[0].chargedAt).toBe(todayISO())
  })
})

describe('removeSubscription', () => {
  it('會連同該訂閱的扣款紀錄一起刪除', () => {
    reset({
      subscriptions: [makeSub({ id: 's1' })],
      charges: [
        {
          id: 'c1',
          subscriptionId: 's1',
          chargedAt: `${currentMonthKey()}-08`,
          amountOriginal: 20,
          currency: 'USD',
          fxRate: 32,
          feeTwd: 9.6,
          amountTwd: 649.6,
          source: 'manual',
          note: '',
        },
      ],
    })
    useStore.getState().removeSubscription('s1')
    expect(useStore.getState().subscriptions).toHaveLength(0)
    expect(useStore.getState().charges).toHaveLength(0)
  })
})
