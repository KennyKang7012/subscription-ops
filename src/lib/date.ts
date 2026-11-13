/** 全部日期都用本地時區的 'YYYY-MM-DD' 字串，避免 UTC 位移一天 */

export const pad2 = (n: number): string => String(n).padStart(2, '0')

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function todayISO(): string {
  return toISO(new Date())
}

export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7)
}

export function currentMonthKey(): string {
  return monthKeyOf(todayISO())
}

export function monthBounds(monthKey: string): { y: number; m: number; start: string; end: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { y, m, start: `${monthKey}-01`, end: `${monthKey}-${pad2(last)}` }
}

export function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
}

export function lastNMonths(n: number, end: string = currentMonthKey()): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, -(n - 1 - i)))
}

/** '10月' */
export function monthLabel(monthKey: string): string {
  const [, m] = monthKey.split('-').map(Number)
  return `${m}月`
}

/** '2026 年 10 月' */
export function monthLabelFull(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return `${y} 年 ${m} 月`
}

/** 把「幾號」夾到當月最後一天，處理 31 號遇到 2 月 */
export function clampDate(y: number, m: number, day: number): Date {
  const lastDay = new Date(y, m, 0).getDate()
  return new Date(y, m - 1, Math.min(Math.max(day, 1), lastDay))
}

export function daysBetweenISO(from: string, to: string): number {
  const a = parseISO(from)
  const b = parseISO(to)
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

/** '11/18' */
export function shortDate(iso: string): string {
  const d = parseISO(iso)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** '2026/11/18 週二' */
export function longDate(iso: string): string {
  const d = parseISO(iso)
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} 週${wd}`
}

export interface Billable {
  cycle: string
  anchorDay: number
  anchorMonth: number | null
  startedAt: string
  endedAt: string | null
}

/** 這個訂閱在指定月份是否為「計費中」 */
export function isActiveInMonth(sub: Billable, monthKey: string): boolean {
  const { start, end } = monthBounds(monthKey)
  const from = sub.startedAt || '1970-01-01'
  const to = sub.endedAt ?? '9999-12-31'
  return from <= end && to >= start
}

/**
 * 該訂閱在某月的扣款日；月繳每月都有，年繳只有 anchorMonth 那個月有。
 * 回傳 null 表示該月不扣款。
 */
export function billingDateInMonth(sub: Billable, monthKey: string): string | null {
  if (sub.cycle === 'once') return null
  const { y, m } = monthBounds(monthKey)
  if (sub.cycle === 'yearly') {
    const am = sub.anchorMonth ?? 1
    if (am !== m) return null
  }
  const d = clampDate(y, m, sub.anchorDay)
  const iso = toISO(d)
  if (iso < sub.startedAt) return null
  if (sub.endedAt && iso > sub.endedAt) return null
  return iso
}

/** 下一次扣款日（含今天），抓不到就 null */
export function nextChargeDate(sub: Billable, from: string = todayISO()): string | null {
  if (sub.cycle === 'once') return null
  if (sub.endedAt && sub.endedAt < from) return null

  if (sub.cycle === 'monthly') {
    for (let k = 0; k < 14; k++) {
      const mk = addMonths(monthKeyOf(from), k)
      const d = billingDateInMonth(sub, mk)
      if (d && d >= from) return d
    }
    return null
  }

  const year = Number(from.slice(0, 4))
  for (let k = 0; k < 3; k++) {
    const mk = `${year + k}-${pad2(sub.anchorMonth ?? 1)}`
    const d = billingDateInMonth(sub, mk)
    if (d && d >= from) return d
  }
  return null
}
