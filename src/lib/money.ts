import type { Category, Currency } from '../types'

/** 四捨五入到小數 2 位，避免浮點誤差累積 */
export const round2 = (n: number): number =>
  Math.round((n + Number.EPSILON) * 100) / 100

export const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n)

export function toTwd(amount: number, currency: Currency, usdTwd: number): number {
  return round2(currency === 'TWD' ? amount : amount * usdTwd)
}

export function fromTwd(twd: number, currency: Currency, usdTwd: number): number {
  if (currency === 'TWD') return round2(twd)
  return round2(twd / (usdTwd || 1))
}

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: 'US$',
  TWD: 'NT$',
}

/** NT$2,137 / US$66.4 */
export function fmtMoney(amount: number, currency: Currency, digits = 0): string {
  const sign = amount < 0 ? '-' : ''
  const abs = Math.abs(amount)
  const body = abs.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${sign}${CURRENCY_SYMBOL[currency]}${body}`
}

/** 給圖表 tooltip 用的完整格式（美金保留 2 位） */
export function fmtByCurrency(amount: number, currency: Currency): string {
  return fmtMoney(amount, currency, currency === 'USD' ? 2 : 0)
}

export function formatPercent(n: number, digits = 1): string {
  const v = n * 100
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}%`
}

/* ── 分類中繼資料 ───────────────────────────────────────── */

export const CATEGORY_ORDER: Category[] = ['ai', 'writing', 'video', 'infra', 'other']

export interface CategoryMeta {
  label: string
  /** 圖表用的色碼（Recharts 無法吃 Tailwind class） */
  hex: string
  /** 徽章樣式，必須是完整字串，Tailwind 才掃得到 */
  badge: string
  dot: string
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  ai: {
    label: 'AI 工具',
    hex: '#818cf8',
    badge: 'bg-ai/12 text-ai ring-ai/30',
    dot: 'bg-ai',
  },
  writing: {
    label: '文章撰寫',
    hex: '#fbbf24',
    badge: 'bg-writing/12 text-writing ring-writing/30',
    dot: 'bg-writing',
  },
  video: {
    label: '影音平台',
    hex: '#fb7185',
    badge: 'bg-video/12 text-video ring-video/30',
    dot: 'bg-video',
  },
  infra: {
    label: '基礎設施',
    hex: '#34d399',
    badge: 'bg-infra/12 text-infra ring-infra/30',
    dot: 'bg-infra',
  },
  other: {
    label: '其他',
    hex: '#94a3b8',
    badge: 'bg-other/12 text-other ring-other/30',
    dot: 'bg-other',
  },
}

export const CYCLE_LABEL: Record<string, string> = {
  monthly: '月繳',
  yearly: '年繳',
  once: '單次',
}

export const STATUS_LABEL: Record<string, string> = {
  active: '訂閱中',
  trial: '試用中',
  paused: '已暫停',
  cancelled: '已取消',
}

export const STATUS_STYLE: Record<string, string> = {
  active: 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30',
  trial: 'bg-amber-400/12 text-amber-300 ring-amber-400/30',
  paused: 'bg-slate-400/10 text-slate-300 ring-slate-400/25',
  cancelled: 'bg-rose-400/10 text-rose-300 ring-rose-400/25',
}
