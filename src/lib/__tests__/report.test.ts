import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMonthlyReportHtml, printMonthlyReport, reportTotals } from '../report'
import { makeCharge, makeData, makeSub } from './fixtures'

const data = makeData({
  subscriptions: [
    makeSub({ id: 's1', name: 'ChatGPT Plus', vendor: 'OpenAI', category: 'ai' }),
    makeSub({ id: 's2', name: 'YouTube', vendor: 'Google', category: 'video', amount: 199, currency: 'TWD' }),
  ],
  charges: [
    makeCharge({ id: 'c1', subscriptionId: 's1', chargedAt: '2026-11-08', amountTwd: 658.13 }),
    makeCharge({
      id: 'c2',
      subscriptionId: 's2',
      chargedAt: '2026-11-22',
      currency: 'TWD',
      fxRate: 1,
      feeTwd: 0,
      amountTwd: 199,
    }),
  ],
})

describe('reportTotals', () => {
  it('與儀表板同一套計算（實際 + 預估）', () => {
    const t = reportTotals(data, '2026-11')
    expect(t.count).toBe(2)
    expect(t.actual).toBe(857.13)
    expect(t.total).toBe(857.13)
  })
})

describe('buildMonthlyReportHtml', () => {
  const html = buildMonthlyReportHtml(data, '2026-11')

  it('是完整的 HTML 文件，並帶月份標題', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('2026 年 11 月')
    expect(html).toContain('訂閱支出月報')
  })

  it('帶入合計與各筆金額', () => {
    expect(html).toContain('NT$857')
    expect(html).toContain('NT$658')
    expect(html).toContain('ChatGPT Plus')
    expect(html).toContain('YouTube')
  })

  it('美金顯示匯率、台幣顯示破折號', () => {
    expect(html).toContain('US$20.00')
    expect(html).toContain('>32<')
    expect(html).toContain('NT$199')
  })

  it('分類佔比只列出有金額的分類', () => {
    expect(html).toContain('AI 工具')
    expect(html).toContain('影音平台')
    // 沒有寫作與基礎設施的支出
    const catSection = html.slice(html.indexOf('分類佔比'), html.indexOf('扣款明細'))
    expect(catSection).not.toContain('文章撰寫')
  })

  it('標示實際／預估狀態', () => {
    expect(html).toContain('badge actual')
    expect(html).toContain('實際')
  })

  it('名稱中的 HTML 字元會被跳脫，不會注入到報表', () => {
    const evil = makeData({
      subscriptions: [makeSub({ id: 'x', name: 'A&B <script>alert(1)</script>' })],
      charges: [makeCharge({ id: 'c1', subscriptionId: 'x', chargedAt: '2026-11-08', amountTwd: 100 })],
    })
    const out = buildMonthlyReportHtml(evil, '2026-11')
    expect(out).not.toContain('<script>alert(1)</script>')
    expect(out).toContain('A&amp;B')
    expect(out).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('沒有支出的月份仍是一份完整報表', () => {
    const empty = buildMonthlyReportHtml(makeData({ subscriptions: [], charges: [] }), '2026-11')
    expect(empty).toContain('本月尚無支出')
  })

  it('含列印按鈕與 A4 頁面設定', () => {
    expect(html).toContain('window.print()')
    expect(html).toContain('@page')
  })
})

describe('printMonthlyReport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('彈窗被瀏覽器封鎖時回傳 false，讓 UI 能提示使用者', () => {
    vi.stubGlobal('window', { ...globalThis, open: () => null })
    expect(printMonthlyReport(data, '2026-11')).toBe(false)
  })
})
