import type { AppData } from '../types'
import { monthBounds, monthKeyOf, parseISO, toISO } from './date'

/**
 * 匯率可信度：
 *  actual  = 該月已有實際扣款，用真實入帳匯率
 *  manual  = 你手動設定的當月預算匯率
 *  market  = 市場匯率紀錄中，該月最後一筆
 *  default = 全域預設值（僅供估算，最不準）
 */
export type RateSource = 'actual' | 'manual' | 'market' | 'default'

export interface ResolvedRate {
  rate: number
  source: RateSource
  /** 'YYYY-MM-DD'，說明這數字從哪來 */
  from: string
}

export const RATE_SOURCE_META: Record<RateSource, { label: string; hex: string; badge: string; hint: string }> = {
  actual: {
    label: '實際',
    hex: '#34d399',
    badge: 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30',
    hint: '該月已有實際扣款，採真實入帳匯率',
  },
  manual: {
    label: '手動',
    hex: '#22d3ee',
    badge: 'bg-brand/12 text-brand ring-brand/30',
    hint: '採用手動填入的匯率（該月或最近一次設定）',
  },
  market: {
    label: '市場',
    hex: '#818cf8',
    badge: 'bg-ai/12 text-ai ring-ai/30',
    hint: '採用該月最後一筆市場匯率紀錄',
  },
  default: {
    label: '預設',
    hex: '#94a3b8',
    badge: 'bg-slate-400/10 text-slate-300 ring-slate-400/25',
    hint: '查無任何匯率資料，暫用全域預設值估算',
  },
}

/**
 * 匯率解析優先序：
 * 1. 該月實際扣款的平均匯率（最真實）
 * 2. 該月手動設定的預算匯率
 * 3. 該月（含之前）最後一筆市場匯率
 * 4. 全域預設匯率
 */
export function resolveRate(data: AppData, monthKey: string): ResolvedRate {
  const month = monthKey || monthKeyOf(toISO(new Date()))

  const actual = data.charges.filter(
    (c) => c.currency === 'USD' && c.fxRate > 0 && monthKeyOf(c.chargedAt) === month,
  )
  if (actual.length > 0) {
    const weighted = actual.reduce((sum, c) => sum + c.fxRate * c.amountOriginal, 0)
    const weight = actual.reduce((sum, c) => sum + c.amountOriginal, 0)
    const rate = weight > 0 ? weighted / weight : actual[0].fxRate
    return { rate: Math.round(rate * 1000) / 1000, source: 'actual', from: actual[actual.length - 1].chargedAt }
  }

  const sorted = [...data.fxRates].sort((a, b) => a.date.localeCompare(b.date))
  const manual = sorted.filter((r) => r.source === 'manual' && monthKeyOf(r.date) === month)
  if (manual.length) {
    const last = manual[manual.length - 1]
    return { rate: last.rate, source: 'manual', from: last.date }
  }

  const { end } = monthBounds(month)

  // 3) 該月（含之前）最後一筆「市場」匯率
  const marketBefore = sorted.filter((r) => r.source === 'market' && r.date <= end)
  if (marketBefore.length) {
    const last = marketBefore[marketBefore.length - 1]
    return { rate: last.rate, source: 'market', from: last.date }
  }

  // 3.5) 沒有市場匯率時，沿用「該月或之前」最近一次手動設定的值（但標示為手動，不可冒充市場）
  const manualBefore = sorted.filter((r) => r.source === 'manual' && r.date <= end)
  if (manualBefore.length) {
    const last = manualBefore[manualBefore.length - 1]
    return { rate: last.rate, source: 'manual', from: last.date }
  }

  return { rate: data.settings.defaultRate, source: 'default', from: toISO(parseISO(month + '-01')) }
}

/** 目前最新的一筆匯率（不管月份），給「美金台幣換算」小工具用 */
export function latestRate(data: AppData): ResolvedRate {
  const month = monthKeyOf(toISO(new Date()))
  return resolveRate(data, month)
}
