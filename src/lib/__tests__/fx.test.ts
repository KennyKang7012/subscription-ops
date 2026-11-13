import { describe, expect, it } from 'vitest'
import { resolveRate } from '../fx'
import { makeCharge, makeData } from './fixtures'

describe('resolveRate 匯率優先序', () => {
  it('1. 該月有實際扣款 → actual，並以金額加權平均', () => {
    const data = makeData({
      charges: [
        makeCharge({ id: 'c1', amountOriginal: 20, fxRate: 32 }),
        makeCharge({ id: 'c2', amountOriginal: 80, fxRate: 33, chargedAt: '2026-11-15' }),
      ],
      fxRates: [{ id: 'f1', date: '2026-11-01', pair: 'USD/TWD', rate: 31, source: 'market' }],
    })
    const r = resolveRate(data, '2026-11')
    expect(r.source).toBe('actual')
    // (20*32 + 80*33) / 100 = 32.8
    expect(r.rate).toBe(32.8)
  })

  it('2. 該月有手動匯率 → manual', () => {
    const data = makeData({
      fxRates: [{ id: 'f1', date: '2026-11-05', pair: 'USD/TWD', rate: 31.5, source: 'manual' }],
    })
    expect(resolveRate(data, '2026-11')).toMatchObject({ source: 'manual', rate: 31.5 })
  })

  it('3. 只看該月或之前的市場匯率 → market', () => {
    const data = makeData({
      fxRates: [
        { id: 'f1', date: '2026-10-01', pair: 'USD/TWD', rate: 32.2, source: 'market' },
        { id: 'f2', date: '2026-12-01', pair: 'USD/TWD', rate: 33.9, source: 'market' },
      ],
    })
    expect(resolveRate(data, '2026-11')).toMatchObject({ source: 'market', rate: 32.2 })
  })

  it('3.5 只有過期的手動匯率時，不可冒充成 market（回歸測試）', () => {
    const data = makeData({
      fxRates: [{ id: 'f1', date: '2026-08-01', pair: 'USD/TWD', rate: 30.5, source: 'manual' }],
    })
    const r = resolveRate(data, '2026-11')
    expect(r.source).toBe('manual')
    expect(r.rate).toBe(30.5)
    expect(r.from).toBe('2026-08-01')
  })

  it('4. 完全沒有匯率資料 → default', () => {
    const data = makeData()
    expect(resolveRate(data, '2026-11')).toMatchObject({ source: 'default', rate: 32 })
  })

  it('市場匯率優先於更早的手動匯率', () => {
    const data = makeData({
      fxRates: [
        { id: 'f1', date: '2026-09-01', pair: 'USD/TWD', rate: 30, source: 'manual' },
        { id: 'f2', date: '2026-10-20', pair: 'USD/TWD', rate: 32.6, source: 'market' },
      ],
    })
    expect(resolveRate(data, '2026-11')).toMatchObject({ source: 'market', rate: 32.6 })
  })
})
