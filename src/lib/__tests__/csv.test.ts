import { describe, expect, it } from 'vitest'
import { buildChargesCsv, csvFilename, filterChargesByRange } from '../csv'
import { makeCharge, makeData, makeSub } from './fixtures'

const sub = makeSub({ id: 's1', name: 'ChatGPT Plus', vendor: 'OpenAI', category: 'ai' })
const twdSub = makeSub({ id: 's2', name: 'YouTube', vendor: 'Google', category: 'video', amount: 199, currency: 'TWD' })

const data = makeData({
  subscriptions: [sub, twdSub],
  charges: [
    makeCharge({
      id: 'c1',
      subscriptionId: 's1',
      chargedAt: '2026-11-08',
      amountOriginal: 20,
      currency: 'USD',
      fxRate: 32.42,
      feeTwd: 9.73,
      amountTwd: 658.13,
      note: '',
    }),
    makeCharge({
      id: 'c2',
      subscriptionId: 's2',
      chargedAt: '2026-11-22',
      amountOriginal: 199,
      currency: 'TWD',
      fxRate: 1,
      feeTwd: 0,
      amountTwd: 199,
      note: '',
    }),
    makeCharge({ id: 'c3', subscriptionId: 's1', chargedAt: '2025-12-08', amountTwd: 600 }),
  ],
})

const lines = (csv: string) => csv.replace(/^\uFEFF/, '').split('\r\n')

describe('filterChargesByRange', () => {
  it('本月只留當月，並依日期排序', () => {
    const list = filterChargesByRange(data, 'month', '2026-11')
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('今年只留同年', () => {
    expect(filterChargesByRange(data, 'year', '2026-11').map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('全部就全給', () => {
    expect(filterChargesByRange(data, 'all', '2026-11')).toHaveLength(3)
  })
})

describe('buildChargesCsv', () => {
  it('開頭有 UTF-8 BOM，Excel 直開中文才不亂碼', () => {
    const csv = buildChargesCsv(data, 'month', '2026-11')
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('使用 CRLF 換行', () => {
    expect(buildChargesCsv(data, 'month', '2026-11')).toContain('\r\n')
  })

  it('表頭欄位固定', () => {
    const [header] = lines(buildChargesCsv(data, 'month', '2026-11'))
    expect(header).toBe('日期,訂閱,供應商,分類,原幣金額,幣別,匯率,手續費(TWD),入帳台幣,備註')
  })

  it('美金扣款帶匯率與手續費，台幣扣款的匯率寫 1', () => {
    const [, usd, twd] = lines(buildChargesCsv(data, 'month', '2026-11'))
    expect(usd).toBe('2026-11-08,ChatGPT Plus,OpenAI,AI 工具,20,USD,32.42,9.73,658.13,')
    expect(twd).toBe('2026-11-22,YouTube,Google,影音平台,199,TWD,1,0,199,')
  })

  it('最後有合計列，含筆數與總額', () => {
    const rows = lines(buildChargesCsv(data, 'month', '2026-11'))
    expect(rows[rows.length - 2]).toBe('')
    expect(rows[rows.length - 1]).toBe('合計,2 筆,,,,,,,857.13,')
  })

  it('備註含逗號、引號、換行時會被正確跳脫', () => {
    const tricky = makeData({
      subscriptions: [sub],
      charges: [
        makeCharge({
          id: 'c1',
          chargedAt: '2026-11-08',
          amountTwd: 100,
          note: '含,逗號 "引號"\n換行',
        }),
      ],
    })
    const row = lines(buildChargesCsv(tricky, 'month', '2026-11'))[1]
    expect(row).toContain('"含,逗號 ""引號""\n換行"')
  })

  it('已刪除訂閱的扣款仍會匯出，並標示來源不明', () => {
    const orphan = makeData({
      subscriptions: [],
      charges: [makeCharge({ id: 'c1', chargedAt: '2026-11-08', amountTwd: 100 })],
    })
    const row = lines(buildChargesCsv(orphan, 'month', '2026-11'))[1]
    expect(row).toContain('（已刪除的訂閱）')
  })

  it('沒有資料時只有表頭、空行與合計', () => {
    const empty = makeData({ subscriptions: [], charges: [] })
    const rows = lines(buildChargesCsv(empty, 'month', '2026-11'))
    expect(rows).toHaveLength(3)
    expect(rows[2]).toBe('合計,0 筆,,,,,,,0,')
  })
})

describe('csvFilename', () => {
  it('依範圍給不同檔名', () => {
    expect(csvFilename('month', '2026-11')).toBe('subscription-ops-2026-11.csv')
    expect(csvFilename('year', '2026-11')).toBe('subscription-ops-2026年.csv')
    expect(csvFilename('all', '2026-11')).toBe('subscription-ops-全部扣款.csv')
  })
})
