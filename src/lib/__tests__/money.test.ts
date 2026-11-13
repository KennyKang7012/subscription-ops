import { afterEach, describe, expect, it } from 'vitest'
import { splitCharge } from '../money'
import { clearBackup, readBackup, saveBackup, validateAppData } from '../file'
import { makeCharge, makeData, makeSub } from './fixtures'

describe('splitCharge', () => {
  it('美金：原幣換算 + 1.5% 手續費', () => {
    expect(splitCharge(20, 'USD', 32, 0.015)).toEqual({ base: 640, feeTwd: 9.6, total: 649.6 })
  })

  it('台幣：沒有國外交易手續費', () => {
    expect(splitCharge(650, 'TWD', 32, 0.015)).toEqual({ base: 650, feeTwd: 0, total: 650 })
  })

  it('四捨五入到小數 2 位', () => {
    const r = splitCharge(19.99, 'USD', 31.876, 0.015)
    expect(r.base).toBe(637.2)
    expect(r.feeTwd).toBe(9.56)
    expect(r.total).toBe(646.76)
  })
})

describe('validateAppData（匯入防護）', () => {
  it('接受完整資料並原樣保留', () => {
    const data = makeData({ charges: [makeCharge()] })
    const r = validateAppData(data)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.subscriptions).toHaveLength(1)
      expect(r.data.charges[0].amountTwd).toBe(649.6)
    }
  })

  it('拒絕缺少 subscriptions 的檔案', () => {
    const r = validateAppData({ charges: [], fxRates: [], settings: { defaultRate: 32 } })
    expect(r).toEqual({ ok: false, error: '缺少 subscriptions 陣列' })
  })

  it('拒絕不支援的幣別', () => {
    const bad = makeData({ subscriptions: [makeSub({ currency: 'EUR' as never })] })
    const r = validateAppData(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('currency 不支援')
  })

  it('拒絕壞掉的日期', () => {
    const bad = makeData({ charges: [makeCharge({ chargedAt: '2026/11/08' })] })
    const r = validateAppData(bad)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('chargedAt')
  })

  it('舊版備份缺 monthlyBudgetTwd 也能匯入，並補上預設值', () => {
    const legacy = {
      subscriptions: [makeSub()],
      charges: [],
      fxRates: [],
      settings: { displayCurrency: 'TWD', basis: 'cash', defaultRate: 32, feeRate: 0.015 },
    }
    const r = validateAppData(legacy)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.settings.monthlyBudgetTwd).toBe(0)
  })

  it('category 不在已知值內就退成 other（否則 CATEGORY_META 會是 undefined）', () => {
    const bad = makeData({ subscriptions: [makeSub({ category: 'foo' as never })] })
    const r = validateAppData(bad)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.subscriptions[0].category).toBe('other')
  })

  it('anchorDay 超出 1–31 會被夾回合法範圍', () => {
    const bad = makeData({ subscriptions: [makeSub({ anchorDay: 99 })] })
    const r = validateAppData(bad)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.subscriptions[0].anchorDay).toBe(31)
  })

  it('補齊選填欄位，不讓 undefined 流入計算', () => {
    const sparse = {
      subscriptions: [{ id: 'x', name: 'A', amount: 5, currency: 'USD' }],
      charges: [],
      fxRates: [],
      settings: { defaultRate: 32 },
    }
    const r = validateAppData(sparse)
    expect(r.ok).toBe(true)
    if (r.ok) {
      const s = r.data.subscriptions[0]
      expect(s.vendor).toBe('')
      expect(s.cycle).toBe('monthly')
      expect(s.status).toBe('active')
      expect(s.seats).toBe(1)
      expect(r.data.settings.displayCurrency).toBe('TWD')
      expect(r.data.settings.feeRate).toBe(0.015)
    }
  })
})

describe('匯入前快照', () => {
  afterEach(() => clearBackup())

  it('存了之後讀得回來，並帶著時間戳', () => {
    expect(readBackup()).toBeNull()
    const data = makeData({ charges: [makeCharge()] })
    saveBackup(data)
    const slot = readBackup()
    expect(slot).not.toBeNull()
    expect(slot!.data.charges).toHaveLength(1)
    expect(Number.isNaN(Date.parse(slot!.savedAt))).toBe(false)
  })

  it('清掉之後就讀不到', () => {
    saveBackup(makeData())
    clearBackup()
    expect(readBackup()).toBeNull()
  })

  it('快照內容壞掉時回傳 null，不會讓呼叫端爆掉', () => {
    localStorage.setItem('ai-tools-subscription-v1:backup', '{not json')
    expect(readBackup()).toBeNull()
  })
})

describe('匯入驗證對不存在的日期', () => {
  it('2026-02-30 這種「格式對但不存在」的日期會被擋下', () => {
    const bad = makeData({ charges: [makeCharge({ chargedAt: '2026-02-30' })] })
    const r = validateAppData(bad)
    expect(r.ok).toBe(false)
  })

  it('2026-13-01 會被擋下', () => {
    const bad = makeData({ subscriptions: [makeSub({ startedAt: '2026-13-01' })] })
    const r = validateAppData(bad)
    expect(r.ok).toBe(false)
  })
})
