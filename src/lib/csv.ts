import type { AppData } from '../types'
import { CATEGORY_META, round2 } from './money'
import { monthKeyOf } from './date'

export type CsvRange = 'month' | 'year' | 'all'

export const CSV_RANGE_LABEL: Record<CsvRange, string> = {
  month: '本月',
  year: '今年',
  all: '全部',
}

const BOM = '\uFEFF'

function esc(value: string | number): string {
  const s = String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.map(esc).join(',')).join('\r\n')
}

export function filterChargesByRange(data: AppData, range: CsvRange, anchorMonth: string) {
  const year = anchorMonth.slice(0, 4)
  return [...data.charges]
    .filter((c) => {
      if (range === 'all') return true
      if (range === 'month') return monthKeyOf(c.chargedAt) === anchorMonth
      return c.chargedAt.slice(0, 4) === year
    })
    .sort((a, b) => a.chargedAt.localeCompare(b.chargedAt))
}

/** 報帳用的扣款明細 CSV（Excel 可直接開，含 UTF-8 BOM） */
export function buildChargesCsv(data: AppData, range: CsvRange, anchorMonth: string): string {
  const rows: Array<Array<string | number>> = [
    ['日期', '訂閱', '供應商', '分類', '原幣金額', '幣別', '匯率', '手續費(TWD)', '入帳台幣', '備註'],
  ]

  const list = filterChargesByRange(data, range, anchorMonth)
  for (const c of list) {
    const sub = data.subscriptions.find((s) => s.id === c.subscriptionId)
    rows.push([
      c.chargedAt,
      sub?.name ?? '（已刪除的訂閱）',
      sub?.vendor ?? '',
      sub ? CATEGORY_META[sub.category].label : '',
      c.amountOriginal,
      c.currency,
      c.currency === 'USD' ? c.fxRate : 1,
      c.feeTwd,
      c.amountTwd,
      c.note,
    ])
  }

  const total = round2(list.reduce((s, c) => s + c.amountTwd, 0))
  rows.push([])
  rows.push(['合計', `${list.length} 筆`, '', '', '', '', '', '', total, ''])

  return BOM + toCsv(rows)
}

export function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function csvFilename(range: CsvRange, anchorMonth: string): string {
  if (range === 'all') return 'ai-tools-subscription-全部扣款.csv'
  if (range === 'year') return `ai-tools-subscription-${anchorMonth.slice(0, 4)}年.csv`
  return `ai-tools-subscription-${anchorMonth}.csv`
}
