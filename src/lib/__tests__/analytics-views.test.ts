import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  annualCostTwd,
  annualizedTwd,
  buildInsights,
  computeTrend,
  monthDelta,
  sinceLabel,
  upcomingCharges,
} from '../analytics'
import { makeCharge, makeData, makeSub } from './fixtures'
import type { AppData } from '../../types'

/** 把「今天」固定成 2026-11-14，讓所有跟當月有關的規則可重現 */
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0))
})

afterEach(() => {
  vi.useRealTimers()
})

const ids = (data: AppData): string[] => buildInsights(data).map((i) => i.id)
const settings = (over: Partial<AppData['settings']> = {}) => ({
  displayCurrency: 'TWD' as const,
  basis: 'cash' as const,
  defaultRate: 32,
  feeRate: 0.015,
  monthlyBudgetTwd: 0,
  ...over,
})

describe('computeTrend', () => {
  it('回傳指定月數、由舊到新，最後一筆是結束月份', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      charges: [makeCharge({ chargedAt: '2026-11-08', amountTwd: 658 })],
    })
    const trend = computeTrend(data, 12, '2026-11')
    expect(trend).toHaveLength(12)
    expect(trend[0].month).toBe('2025-12')
    expect(trend[11].month).toBe('2026-11')
    expect(trend[11].total).toBe(658)
    expect(trend[11].actual).toBe(658)
    expect(trend[11].byCategory.ai).toBe(658)
  })

  it('沒扣款的月份靠估算補上，並標記匯率來源', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      fxRates: [{ id: 'f1', date: '2026-11-01', pair: 'USD/TWD', rate: 32, source: 'market' }],
    })
    const trend = computeTrend(data, 2, '2026-11')
    expect(trend[1].estimated).toBe(649.6)
    expect(trend[1].rateSource).toBe('market')
  })
})

describe('annualizedTwd', () => {
  it('以未來 12 個月的攤提加總，年繳不會在單月爆量', () => {
    const data = makeData({
      subscriptions: [
        makeSub({ id: 'm', cycle: 'monthly', amount: 20, anchorDay: 8 }),
        makeSub({ id: 'y', cycle: 'yearly', amount: 120, anchorDay: 12, anchorMonth: 5 }),
      ],
    })
    const annual = annualizedTwd(data)
    // 月繳 20 + 年繳 120/12 = 10 → 30 USD/月 → (960 + 14.4) * 12
    expect(annual.total).toBe(11692.8)
    expect(annual.byCategory.ai).toBe(11692.8)
  })

  it('沒有訂閱就是 0', () => {
    expect(annualizedTwd(makeData({ subscriptions: [] })).total).toBe(0)
  })
})

describe('monthDelta', () => {
  it('算得出與上月的差額與百分比', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      charges: [
        makeCharge({ id: 'a', chargedAt: '2026-10-08', amountTwd: 600 }),
        makeCharge({ id: 'b', chargedAt: '2026-11-08', amountTwd: 660 }),
      ],
    })
    const d = monthDelta(data, '2026-11')
    expect(d.prev).toBe(600)
    expect(d.diff).toBe(60)
    expect(d.pct).toBeCloseTo(0.1, 5)
  })

  it('上月為 0 時百分比給 null 而不是 Infinity', () => {
    const data = makeData({
      // 11 月才開始訂閱 → 10 月完全沒有支出（含估算）
      subscriptions: [makeSub({ anchorDay: 8, startedAt: '2026-11-01' })],
      charges: [makeCharge({ chargedAt: '2026-11-08', amountTwd: 660 })],
    })
    const d = monthDelta(data, '2026-11')
    expect(d.prev).toBe(0)
    expect(d.pct).toBeNull()
  })
})

describe('annualCostTwd', () => {
  it('等效年費含手續費', () => {
    const data = makeData({ subscriptions: [makeSub({ amount: 20, currency: 'USD' })] })
    // (640 + 9.6) * 12
    expect(annualCostTwd(data, data.subscriptions[0])).toBe(7795.2)
  })

  it('年繳是原價，不是月費 ×12', () => {
    const data = makeData({ subscriptions: [makeSub({ cycle: 'yearly', amount: 120 })] })
    // 120 USD/年 → 3840 + 57.6
    expect(annualCostTwd(data, data.subscriptions[0])).toBe(3897.6)
  })
})

describe('upcomingCharges', () => {
  it('依日期排序，且排除超過窗口的項目', () => {
    const data = makeData({
      subscriptions: [
        makeSub({ id: 'late', anchorDay: 28 }),
        makeSub({ id: 'soon', anchorDay: 15 }),
      ],
    })
    const list = upcomingCharges(data, 45)
    expect(list.map((i) => i.subscriptionId)).toEqual(['soon', 'late'])
    expect(list[0].days).toBe(1)
  })

  it('已暫停或取消的不列進即將扣款', () => {
    const data = makeData({
      subscriptions: [
        makeSub({ id: 'p', anchorDay: 15, status: 'paused', endedAt: '2026-11-01' }),
        makeSub({ id: 'c', anchorDay: 15, status: 'cancelled', endedAt: '2026-11-01' }),
      ],
    })
    expect(upcomingCharges(data, 45)).toHaveLength(0)
  })
})

describe('buildInsights — 個別規則', () => {
  it('漲價：比對最近一次價格變動，而不是只看最後兩筆', () => {
    const data = makeData({
      subscriptions: [makeSub({ id: 's1', anchorDay: 8 })],
      charges: [
        makeCharge({ id: 'c1', chargedAt: '2026-06-08', amountOriginal: 20 }),
        makeCharge({ id: 'c2', chargedAt: '2026-10-08', amountOriginal: 100 }),
        makeCharge({ id: 'c3', chargedAt: '2026-11-08', amountOriginal: 100 }),
      ],
    })
    const list = buildInsights(data)
    const hike = list.find((i) => i.id === 'hike-s1')
    expect(hike).toBeDefined()
    expect(hike!.level).toBe('warn')
    expect(hike!.detail).toContain('20 → 100')
  })

  it('漲幅在 3% 以內不算漲價', () => {
    const data = makeData({
      subscriptions: [makeSub({ id: 's1', anchorDay: 8 })],
      charges: [
        makeCharge({ id: 'c1', chargedAt: '2026-10-08', amountOriginal: 20 }),
        makeCharge({ id: 'c2', chargedAt: '2026-11-08', amountOriginal: 20.5 }),
      ],
    })
    expect(ids(data)).not.toContain('hike-s1')
  })

  it('降價不觸發漲價提示', () => {
    const data = makeData({
      subscriptions: [makeSub({ id: 's1', anchorDay: 8 })],
      charges: [
        makeCharge({ id: 'c1', chargedAt: '2026-10-08', amountOriginal: 100 }),
        makeCharge({ id: 'c2', chargedAt: '2026-11-08', amountOriginal: 20 }),
      ],
    })
    expect(ids(data)).not.toContain('hike-s1')
  })

  it('同類工具重疊會算出只留最貴一個能省多少', () => {
    const data = makeData({
      subscriptions: [
        makeSub({ id: 'a', name: 'A', anchorDay: 8, amount: 20 }),
        makeSub({ id: 'b', name: 'B', anchorDay: 9, amount: 10 }),
      ],
      charges: [
        makeCharge({ id: 'c1', chargedAt: '2026-11-08', amountTwd: 658 }),
        makeCharge({ id: 'c2', chargedAt: '2026-11-09', amountTwd: 329 }),
      ],
    })
    const overlap = buildInsights(data).find((i) => i.id === 'overlap-ai')
    expect(overlap).toBeDefined()
    // 留最貴（20 USD）→ 砍掉 10 USD/月 = (320 + 4.8 手續費) * 12 = 3897.6
    expect(overlap!.detail).toContain('每年可省 NT$3,898')
  })

  it('只有一個工具時不會提示重疊', () => {
    const data = makeData({ subscriptions: [makeSub({ anchorDay: 8 })] })
    expect(ids(data)).not.toContain('overlap-ai')
  })

  it('扣款日已過 3 天以上卻沒紀錄 → 提示補登', () => {
    const data = makeData({ subscriptions: [makeSub({ anchorDay: 8, status: 'active' })] })
    const ins = buildInsights(data).find((i) => i.id === 'missing-charge')
    expect(ins).toBeDefined()
    expect(ins!.detail).toContain('Test Tool')
  })

  it('扣款日還沒到就不算漏登', () => {
    const data = makeData({ subscriptions: [makeSub({ anchorDay: 20 })] })
    expect(ids(data)).not.toContain('missing-charge')
  })

  it('已經有扣款紀錄就不再提示補登', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      charges: [makeCharge({ chargedAt: '2026-11-08' })],
    })
    expect(ids(data)).not.toContain('missing-charge')
  })

  it('試用期剩 7 天內會提醒，並寫出到期日', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 20, status: 'trial', trialEndsAt: '2026-11-19' })],
    })
    const ins = buildInsights(data).find((i) => i.id === 'trial-s1')
    expect(ins).toBeDefined()
    expect(ins!.detail).toContain('2026-11-19')
  })

  it('試用期還很久就不提醒', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 20, status: 'trial', trialEndsAt: '2026-12-20' })],
    })
    expect(ids(data)).not.toContain('trial-s1')
  })

  it('超出預算 → budget-over，並算出超支金額', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      charges: [makeCharge({ chargedAt: '2026-11-08', amountTwd: 5000 })],
      settings: settings({ monthlyBudgetTwd: 4000 }),
    })
    const ins = buildInsights(data).find((i) => i.id === 'budget-over')
    expect(ins).toBeDefined()
    expect(ins!.title).toContain('1,000')
  })

  it('預算用掉 9 成以上 → budget-near', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      charges: [makeCharge({ chargedAt: '2026-11-08', amountTwd: 3800 })],
      settings: settings({ monthlyBudgetTwd: 4000 }),
    })
    const ins = buildInsights(data).find((i) => i.id === 'budget-near')
    expect(ins).toBeDefined()
    expect(ins!.level).toBe('tip')
  })

  it('預算還很寬裕就不提', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 8 })],
      charges: [makeCharge({ chargedAt: '2026-11-08', amountTwd: 1000 })],
      settings: settings({ monthlyBudgetTwd: 4000 }),
    })
    expect(ids(data)).not.toContain('budget-near')
  })

  it('只用預設匯率時提醒可信度', () => {
    const data = makeData({ subscriptions: [makeSub({ anchorDay: 20 })] })
    const ins = buildInsights(data).find((i) => i.id === 'rate-default')
    expect(ins).toBeDefined()
    expect(ins!.level).toBe('info')
  })

  it('市場匯率超過 30 天沒更新 → rate-stale', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 20, currency: 'TWD', amount: 650 })],
      fxRates: [{ id: 'f1', date: '2026-09-01', pair: 'USD/TWD', rate: 32, source: 'market' }],
    })
    const ins = buildInsights(data).find((i) => i.id === 'rate-stale')
    expect(ins).toBeDefined()
    expect(ins!.title).toContain('74 天')
  })

  it('45 天內有年繳大筆扣款 → 提前提醒現金流', () => {
    const data = makeData({
      subscriptions: [
        makeSub({ id: 'y', cycle: 'yearly', amount: 120, anchorDay: 20, anchorMonth: 11 }),
      ],
    })
    const ins = buildInsights(data).find((i) => i.id === 'annual-y')
    expect(ins).toBeDefined()
    expect(ins!.detail).toContain('2026-11-20')
  })

  it('結果依嚴重度排序，且最多 6 則', () => {
    // 刻意造出 8 個候選：2 個漲價、漏登、試用、重疊、超支、年繳、匯率過期
    const data = makeData({
      subscriptions: [
        makeSub({ id: 'h1', name: 'H1', anchorDay: 8, amount: 40 }),
        makeSub({ id: 'h2', name: 'H2', anchorDay: 9, amount: 40 }),
        makeSub({ id: 'y', cycle: 'yearly', amount: 120, anchorDay: 20, anchorMonth: 11 }),
        makeSub({ id: 't', anchorDay: 21, status: 'trial', trialEndsAt: '2026-11-18' }),
        makeSub({ id: 'v', category: 'video', anchorDay: 5, amount: 5000, currency: 'TWD' }),
      ],
      charges: [
        makeCharge({ id: 'p1', subscriptionId: 'h1', chargedAt: '2026-09-08', amountOriginal: 10 }),
        makeCharge({ id: 'p2', subscriptionId: 'h1', chargedAt: '2026-10-08', amountOriginal: 40 }),
        makeCharge({ id: 'p3', subscriptionId: 'h2', chargedAt: '2026-09-09', amountOriginal: 10 }),
        makeCharge({ id: 'p4', subscriptionId: 'h2', chargedAt: '2026-10-09', amountOriginal: 40 }),
        makeCharge({ id: 'p5', subscriptionId: 'v', chargedAt: '2026-11-05', amountOriginal: 5000 }),
      ],
      fxRates: [{ id: 'f1', date: '2026-09-01', pair: 'USD/TWD', rate: 32, source: 'market' }],
      settings: settings({ monthlyBudgetTwd: 100 }),
    })
    const list = buildInsights(data)
    expect(list.length).toBe(6)
    const order = { warn: 0, tip: 1, info: 2 } as const
    const levels = list.map((i) => order[i.level])
    expect(levels).toEqual([...levels].sort((x, y) => x - y))
  })

  it('乾淨的資料不會硬擠出洞察', () => {
    const data = makeData({
      subscriptions: [makeSub({ anchorDay: 20, category: 'video', amount: 650, currency: 'TWD' })],
      charges: [makeCharge({ id: 'c1', chargedAt: '2026-11-01', amountTwd: 650 })],
      fxRates: [{ id: 'f1', date: '2026-11-13', pair: 'USD/TWD', rate: 32, source: 'market' }],
      settings: settings({ monthlyBudgetTwd: 5000 }),
    })
    expect(buildInsights(data)).toHaveLength(0)
  })
})

describe('sinceLabel', () => {
  it('給出年月', () => {
    expect(sinceLabel('2026-03-08')).toBe('2026/3')
  })
})
