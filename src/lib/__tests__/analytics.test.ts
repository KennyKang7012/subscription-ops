import { describe, expect, it } from 'vitest'
import {
  budgetStatus,
  computeMonth,
  estimateChargeTwd,
  hasChargeInMonth,
  isBillableInMonth,
  monthlyEquivalent,
  upcomingCharges,
} from '../analytics'
import { addMonths, currentMonthKey, monthKeyOf, todayISO } from '../date'
import { makeCharge, makeData, makeSub } from './fixtures'

describe('estimateChargeTwd', () => {
  it('美金訂閱的估算含 1.5% 手續費（與實帳口徑一致）', () => {
    const sub = makeSub({ amount: 20, currency: 'USD' })
    // 20 * 32 = 640，手續費 9.6 → 649.6
    expect(estimateChargeTwd(sub, 32, 0.015)).toBe(649.6)
  })

  it('台幣訂閱不收國外交易手續費', () => {
    const sub = makeSub({ amount: 650, currency: 'TWD' })
    expect(estimateChargeTwd(sub, 32, 0.015)).toBe(650)
  })
})

describe('computeMonth（現金流）', () => {
  it('沒補登的當月訂閱用估算，且估算也含手續費（回歸測試）', () => {
    const data = makeData({
      subscriptions: [makeSub({ amount: 20, currency: 'USD', anchorDay: 8 })],
      charges: [],
      fxRates: [{ id: 'f1', date: '2026-11-01', pair: 'USD/TWD', rate: 32, source: 'market' }],
    })
    const stat = computeMonth(data, '2026-11', 'cash')
    expect(stat.actualTwd).toBe(0)
    expect(stat.estimatedTwd).toBe(649.6)
    expect(stat.totalTwd).toBe(649.6)
    expect(stat.items[0].kind).toBe('estimate')
  })

  it('已有扣款紀錄時就不重複估算', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      charges: [makeCharge({ chargedAt: '2026-11-08', amountTwd: 658 })],
    })
    const stat = computeMonth(data, '2026-11', 'cash')
    expect(stat.items).toHaveLength(1)
    expect(stat.actualTwd).toBe(658)
    expect(stat.estimatedTwd).toBe(0)
  })

  it('該月不扣款的訂閱（年繳月份不符）不會被估算', () => {
    const data = makeData({
      subscriptions: [makeSub({ cycle: 'yearly', anchorMonth: 5, anchorDay: 12, amount: 96 })],
      fxRates: [{ id: 'f1', date: '2026-11-01', pair: 'USD/TWD', rate: 32, source: 'market' }],
    })
    expect(computeMonth(data, '2026-11', 'cash').totalTwd).toBe(0)
    expect(computeMonth(data, '2026-05', 'cash').totalTwd).toBeGreaterThan(0)
  })
})

describe('computeMonth（攤提）', () => {
  it('年繳 ÷ 12，且不把實帳再加一次（回歸測試：避免重複計入）', () => {
    const data = makeData({
      subscriptions: [makeSub({ cycle: 'yearly', anchorMonth: 5, anchorDay: 12, amount: 120 })],
      charges: [makeCharge({ id: 'c9', chargedAt: '2026-05-12', amountOriginal: 120, amountTwd: 3900 })],
      fxRates: [{ id: 'f1', date: '2026-05-01', pair: 'USD/TWD', rate: 32, source: 'market' }],
    })
    const stat = computeMonth(data, '2026-05', 'accrual')
    // 120/12 = 10 USD → 320 + 4.8 手續費 = 324.8，而不是 3900 + 324.8
    expect(stat.totalTwd).toBe(324.8)
    expect(stat.actualTwd).toBe(0)
    expect(stat.items).toHaveLength(1)
  })

  it('monthlyEquivalent：年繳變月費、單次為 0', () => {
    expect(monthlyEquivalent(makeSub({ cycle: 'yearly', amount: 120 }))).toBe(10)
    expect(monthlyEquivalent(makeSub({ cycle: 'monthly', amount: 20 }))).toBe(20)
    expect(monthlyEquivalent(makeSub({ cycle: 'once', amount: 99 }))).toBe(0)
  })
})

describe('isBillableInMonth（回歸測試：狀態改動不可清空歷史）', () => {
  const thisMonth = currentMonthKey()
  const lastMonth = addMonths(thisMonth, -1)

  it('取消但沒有結束日的舊資料，歷史月份仍然計入', () => {
    const sub = makeSub({
      status: 'cancelled',
      endedAt: null,
      startedAt: '2026-01-01',
    })
    expect(isBillableInMonth(sub, lastMonth)).toBe(true)
    expect(isBillableInMonth(sub, thisMonth)).toBe(false)
  })

  it('取消且有結束日：只算到結束那個月', () => {
    const sub = makeSub({ status: 'cancelled', endedAt: todayISO(), startedAt: '2026-01-01' })
    expect(isBillableInMonth(sub, lastMonth)).toBe(true)
    expect(isBillableInMonth(sub, thisMonth)).toBe(true)
  })

  it('暫停中：當月可能已經扣過款所以仍計入，但不再產生估算', () => {
    const sub = makeSub({ status: 'paused', endedAt: todayISO(), startedAt: '2026-01-01' })
    expect(isBillableInMonth(sub, thisMonth)).toBe(true)
    expect(isBillableInMonth(sub, addMonths(thisMonth, 1))).toBe(false)

    const data = makeData({ subscriptions: [sub], charges: [] })
    expect(computeMonth(data, thisMonth, 'cash').estimatedTwd).toBe(0)
    expect(computeMonth(data, thisMonth, 'accrual').totalTwd).toBe(0)
  })
})

describe('hasChargeInMonth（一鍵補登去重）', () => {
  it('同訂閱同月份已有紀錄就回報 true', () => {
    const data = makeData({
      charges: [makeCharge({ subscriptionId: 's1', chargedAt: '2026-11-08' })],
    })
    expect(hasChargeInMonth(data, 's1', '2026-11')).toBe(true)
    expect(hasChargeInMonth(data, 's1', '2026-12')).toBe(false)
    expect(hasChargeInMonth(data, 's2', '2026-11')).toBe(false)
  })
})

describe('upcomingCharges', () => {
  it('未來扣款金額也含手續費', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 20, amount: 20, currency: 'USD' })],
      fxRates: [{ id: 'f1', date: monthKeyOf(todayISO()) + '-01', pair: 'USD/TWD', rate: 32, source: 'market' }],
    })
    const list = upcomingCharges(data, 60)
    expect(list.length).toBeGreaterThan(0)
    expect(list[0].twd).toBe(649.6)
  })
})

describe('budgetStatus', () => {
  const dataWith = (budget: number): ReturnType<typeof makeData> =>
    makeData({
      subscriptions: [makeSub({ anchorDay: 8, amount: 20 })],
      charges: [makeCharge({ chargedAt: `${currentMonthKey()}-08`, amountTwd: 650 })],
      settings: {
        displayCurrency: 'TWD',
        basis: 'cash',
        defaultRate: 32,
        feeRate: 0.015,
        monthlyBudgetTwd: budget,
      },
    })

  it('未設定預算回傳 null', () => {
    expect(budgetStatus(dataWith(0))).toBeNull()
  })

  it('超支會標記 over', () => {
    const s = budgetStatus(dataWith(500))
    expect(s).not.toBeNull()
    expect(s!.over).toBe(true)
    expect(s!.remaining).toBe(-150)
  })

  it('未超支時算得出剩餘與比例', () => {
    const s = budgetStatus(dataWith(1000))
    expect(s!.over).toBe(false)
    expect(s!.remaining).toBe(350)
    expect(s!.ratio).toBeCloseTo(0.65, 5)
  })
})
