import type { AppData, Basis, Category, Subscription } from '../types'
import {
  billingDateInMonth,
  daysBetweenISO,
  isActiveInMonth,
  monthBounds,
  monthKeyOf,
  nextChargeDate,
  todayISO,
  addMonths,
  monthLabel,
  parseISO,
} from './date'
import { resolveRate, type ResolvedRate } from './fx'
import { CATEGORY_ORDER, round2, splitCharge } from './money'

export function emptyByCategory(): Record<Category, number> {
  return { ai: 0, writing: 0, video: 0, infra: 0, other: 0 }
}

/** 這個月要不要算它 */
export function isBillableInMonth(sub: Subscription, monthKey: string): boolean {
  if (!isActiveInMonth(sub, monthKey)) return false
  // 被標成暫停／取消但沒有結束日（舊資料，或表單直接改狀態）：
  // 一律視為「從今天起停止」，歷史月份仍然計入，避免整段歷史消失
  if ((sub.status === 'cancelled' || sub.status === 'paused') && !sub.endedAt) {
    return monthKey < monthKeyOf(todayISO())
  }
  return true
}

/** 該訂閱在該月是否已經有扣款紀錄（一鍵補登的去重依據） */
export function hasChargeInMonth(data: AppData, subscriptionId: string, monthKey: string): boolean {
  return data.charges.some(
    (c) => c.subscriptionId === subscriptionId && monthKeyOf(c.chargedAt) === monthKey,
  )
}

/** 估算一筆扣款會扣多少台幣（含國外交易手續費，與實帳口徑一致） */
export function estimateChargeTwd(sub: Subscription, rate: number, feeRate: number): number {
  return splitCharge(sub.amount, sub.currency, rate, feeRate).total
}

/** 攤提後的等效月費（原幣） */
export function monthlyEquivalent(sub: Subscription): number {
  if (sub.cycle === 'yearly') return round2(sub.amount / 12)
  if (sub.cycle === 'monthly') return sub.amount
  return 0
}

export interface MonthItem {
  key: string
  subscriptionId: string | null
  name: string
  category: Category
  /** 台幣金額（含手續費） */
  twd: number
  kind: 'actual' | 'estimate'
  date: string
}

export interface MonthStat {
  month: string
  items: MonthItem[]
  actualTwd: number
  estimatedTwd: number
  totalTwd: number
  byCategory: Record<Category, number>
  rate: ResolvedRate
  /** 美金訂閱的原始金額合計，方便看「不被匯率干擾」的漲幅 */
  usdOriginal: number
}

/**
 * 單月統計
 *  cash    = 實際扣款為主，未扣款的當月訂閱用估算補上（看現金流）
 *  accrual = 完全依訂閱定義攤提，年繳 ÷ 12（看真實訂閱成本）
 */
export function computeMonth(data: AppData, monthKey: string, basis: Basis = data.settings.basis): MonthStat {
  const rate = resolveRate(data, monthKey)
  const { end } = monthBounds(monthKey)
  const items: MonthItem[] = []
  const charged = new Set<string>()
  let usdOriginal = 0

  const charges = data.charges
    .filter((c) => monthKeyOf(c.chargedAt) === monthKey)
    .sort((a, b) => a.chargedAt.localeCompare(b.chargedAt))

  // 摊提模式不看實帳，完全依訂閱定義計算，避免重複計入
  if (basis === 'cash') {
    for (const c of charges) {
      const sub = data.subscriptions.find((s) => s.id === c.subscriptionId)
      items.push({
        key: c.id,
        subscriptionId: c.subscriptionId,
        name: sub?.name ?? '未分類扣款',
        category: sub?.category ?? 'other',
        twd: c.amountTwd,
        kind: 'actual',
        date: c.chargedAt,
      })
      charged.add(c.subscriptionId)
      if (c.currency === 'USD') usdOriginal += c.amountOriginal
    }
  }

  if (basis === 'accrual') {
    // 攤提：不看實帳，只看訂閱定義，年繳平均分到 12 個月
    for (const sub of data.subscriptions) {
      if (!isBillableInMonth(sub, monthKey)) continue
      if (sub.status === 'trial') continue
      // 暫停中的訂閱不再產生攤提費用
      if (sub.status === 'paused') continue
      const per = monthlyEquivalent(sub)
      if (per <= 0) continue
      items.push({
        key: `acc-${sub.id}`,
        subscriptionId: sub.id,
        name: sub.name,
        category: sub.category,
        twd: splitCharge(per, sub.currency, rate.rate, data.settings.feeRate).total,
        kind: 'estimate',
        date: end,
      })
      if (sub.currency === 'USD') usdOriginal += per
    }
  } else {
    // 現金流：本月該扣但還沒記錄的，補上估算
    for (const sub of data.subscriptions) {
      if (!isBillableInMonth(sub, monthKey)) continue
      if (charged.has(sub.id)) continue
      // 暫停中的訂閱不排入估算（當月若真的扣了，會靠補登的實際紀錄出現）
      if (sub.status === 'paused') continue
      const billDate = billingDateInMonth(sub, monthKey)
      if (!billDate) continue
      items.push({
        key: `est-${sub.id}`,
        subscriptionId: sub.id,
        name: sub.name,
        category: sub.category,
        twd: estimateChargeTwd(sub, rate.rate, data.settings.feeRate),
        kind: 'estimate',
        date: billDate,
      })
      if (sub.currency === 'USD') usdOriginal += sub.amount
    }
  }

  const byCategory = emptyByCategory()
  let actualTwd = 0
  let estimatedTwd = 0
  for (const it of items) {
    byCategory[it.category] = round2(byCategory[it.category] + it.twd)
    if (it.kind === 'actual') actualTwd += it.twd
    else estimatedTwd += it.twd
  }

  return {
    month: monthKey,
    items,
    actualTwd: round2(actualTwd),
    estimatedTwd: round2(estimatedTwd),
    totalTwd: round2(actualTwd + estimatedTwd),
    byCategory,
    rate,
    usdOriginal: round2(usdOriginal),
  }
}

export interface TrendPoint {
  month: string
  label: string
  total: number
  actual: number
  estimated: number
  rateSource: ResolvedRate['source']
  usdOriginal: number
  byCategory: Record<Category, number>
}

export function computeTrend(data: AppData, months: number, endMonth: string): TrendPoint[] {
  const out: TrendPoint[] = []
  for (let i = months - 1; i >= 0; i--) {
    const mk = addMonths(endMonth, -i)
    const stat = computeMonth(data, mk)
    out.push({
      month: mk,
      label: monthLabel(mk),
      total: stat.totalTwd,
      actual: stat.actualTwd,
      estimated: stat.estimatedTwd,
      rateSource: stat.rate.source,
      usdOriginal: stat.usdOriginal,
      byCategory: stat.byCategory,
    })
  }
  return out
}

/** 年化：直接把未來 12 個月的預估加總，比 total×12 準（含年繳月份） */
export function annualizedTwd(data: AppData): { total: number; byCategory: Record<Category, number> } {
  const byCategory = emptyByCategory()
  let total = 0
  const start = monthKeyOf(todayISO())
  for (let i = 0; i < 12; i++) {
    const stat = computeMonth(data, addMonths(start, i), 'accrual')
    total += stat.totalTwd
    for (const c of CATEGORY_ORDER) byCategory[c] = round2(byCategory[c] + stat.byCategory[c])
  }
  return { total: round2(total), byCategory }
}

export interface UpcomingItem {
  subscriptionId: string
  name: string
  category: Category
  currency: Subscription['currency']
  amount: number
  date: string
  days: number
  twd: number
}

export function upcomingCharges(data: AppData, withinDays = 45): UpcomingItem[] {
  const today = todayISO()
  const out: UpcomingItem[] = []
  for (const sub of data.subscriptions) {
    if (sub.status !== 'active' && sub.status !== 'trial') continue
    const next = nextChargeDate(sub, today)
    if (!next) continue
    const days = daysBetweenISO(today, next)
    if (days < 0 || days > withinDays) continue
    const rate = resolveRate(data, monthKeyOf(next))
    out.push({
      subscriptionId: sub.id,
      name: sub.name,
      category: sub.category,
      currency: sub.currency,
      amount: sub.amount,
      date: next,
      days,
      twd: estimateChargeTwd(sub, rate.rate, data.settings.feeRate),
    })
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** 月度預算狀態；未設定預算回傳 null */
export interface BudgetStatus {
  budget: number
  spent: number
  remaining: number
  ratio: number
  over: boolean
}

export function budgetStatus(data: AppData, monthKey: string = monthKeyOf(todayISO())): BudgetStatus | null {
  const budget = data.settings.monthlyBudgetTwd
  if (!(budget > 0)) return null
  const spent = computeMonth(data, monthKey).totalTwd
  return {
    budget,
    spent,
    remaining: round2(budget - spent),
    ratio: spent / budget,
    over: spent > budget,
  }
}

export type InsightLevel = 'warn' | 'tip' | 'info'

export interface Insight {
  id: string
  level: InsightLevel
  title: string
  detail: string
}

/** 自動洞察：漲價、功能重疊、未補登、試用到期、匯率可信度… */
export function buildInsights(data: AppData): Insight[] {
  const out: Insight[] = []
  const today = todayISO()
  const thisMonth = monthKeyOf(today)
  const rate = resolveRate(data, thisMonth)

  // 1) 漲價偵測：追「最近一次價格變動」，而不是只比最後兩筆
  for (const sub of data.subscriptions) {
    const list = data.charges
      .filter((c) => c.subscriptionId === sub.id && c.currency === sub.currency)
      .sort((a, b) => a.chargedAt.localeCompare(b.chargedAt))
    if (list.length < 2) continue
    const last = list[list.length - 1]
    const before = [...list].reverse().find((c) => c.amountOriginal !== last.amountOriginal)
    if (!before || before.amountOriginal <= 0) continue
    // 用 epsilon 吸收浮點誤差（10 → 10.3 算出來是 0.030000000000000027），
    // 不要四捨五入：把比例量化到小數 4 位的話，3.004% 會被誤判成沒漲。
    const diff = (last.amountOriginal - before.amountOriginal) / before.amountOriginal
    if (diff <= 0.03 + 1e-9) continue
    const yearlyImpact =
      diff * before.amountOriginal * (sub.cycle === 'yearly' ? 1 : 12) * (sub.currency === 'USD' ? rate.rate : 1)
    out.push({
      id: `hike-${sub.id}`,
      level: 'warn',
      title: `${sub.name} 漲價了`,
      detail: `自 ${before.chargedAt} 之後由 ${before.amountOriginal} → ${last.amountOriginal} ${sub.currency}（${(
        diff * 100
      ).toFixed(1)}%），一年多花約 NT$${Math.round(yearlyImpact).toLocaleString()}`,
    })
  }

  // 2) 同類功能重疊
  const active = data.subscriptions.filter((s) => s.status === 'active')
  for (const cat of CATEGORY_ORDER) {
    if (cat === 'other' || cat === 'infra') continue
    const sameCat = active.filter((s) => s.category === cat)
    if (sameCat.length >= 2) {
      const names = sameCat.map((s) => s.name).join('、')
      const monthly = sameCat.map((s) => splitCharge(monthlyEquivalent(s), s.currency, rate.rate, data.settings.feeRate).total)
      const keep = Math.max(...monthly)
      const save = (monthly.reduce((a, b) => a + b, 0) - keep) * 12
      out.push({
        id: `overlap-${cat}`,
        level: 'tip',
        title: `同類工具 ${sameCat.length} 個並存`,
        detail: `${names} — 若只留最貴的那一個，每年可省 NT$${Math.round(save).toLocaleString()}`,
      })
    }
  }

  // 3) 本月該扣款卻還沒補登
  const missing = data.subscriptions.filter((sub) => {
    if (!isBillableInMonth(sub, thisMonth)) return false
    const billDate = billingDateInMonth(sub, thisMonth)
    if (!billDate || billDate > today) return false
    if (daysBetweenISO(billDate, today) < 3) return false
    return !data.charges.some((c) => c.subscriptionId === sub.id && monthKeyOf(c.chargedAt) === thisMonth)
  })
  if (missing.length) {
    out.push({
      id: 'missing-charge',
      level: 'warn',
      title: `${missing.length} 筆扣款尚未補登`,
      detail: `${missing.map((s) => s.name).join('、')} — 補登後本月數字才會從「預估」變成「實際」`,
    })
  }

  // 4) 試用期倒數
  for (const sub of data.subscriptions) {
    if (!sub.trialEndsAt) continue
    const d = daysBetweenISO(today, sub.trialEndsAt)
    if (d >= 0 && d <= 7) {
      out.push({
        id: `trial-${sub.id}`,
        level: 'warn',
        title: `${sub.name} 試用剩 ${d} 天`,
        detail: `到期日 ${sub.trialEndsAt}，不想續訂記得先取消，否則自動扣 ${sub.amount} ${sub.currency}`,
      })
    }
  }

  // 5) 匯率可信度
  const budget = budgetStatus(data, thisMonth)
  if (budget) {
    if (budget.over) {
      out.push({
        id: 'budget-over',
        level: 'warn',
        title: `本月超出預算 NT$${Math.round(budget.spent - budget.budget).toLocaleString()}`,
        detail: `預算 NT$${Math.round(budget.budget).toLocaleString()}，目前已用 NT$${Math.round(
          budget.spent,
        ).toLocaleString()}（${Math.round(budget.ratio * 100)}%）。若不該花的可以到「訂閱管理」暫停它`,
      })
    } else if (budget.ratio >= 0.9) {
      out.push({
        id: 'budget-near',
        level: 'tip',
        title: `預算已用 ${Math.round(budget.ratio * 100)}%`,
        detail: `剩 NT$${Math.round(budget.remaining).toLocaleString()}，本月還有 ${upcomingCharges(data, 45).filter((u) => monthKeyOf(u.date) === thisMonth).length} 筆扣款要來`,
      })
    }
  }

  if (rate.source === 'default') {
    out.push({
      id: 'rate-default',
      level: 'info',
      title: '目前用預設匯率估算',
      detail: `查無匯率紀錄，暫用 ${rate.rate}。到「設定」補一筆 USD/TWD 會準很多`,
    })
  } else if (rate.source === 'market') {
    const age = daysBetweenISO(rate.from, today)
    if (age > 30) {
      out.push({
        id: 'rate-stale',
        level: 'info',
        title: `匯率已 ${age} 天沒更新`,
        detail: `目前用 ${rate.rate}（${rate.from}），美金漲跌會讓估算失真`,
      })
    }
  }

  // 6) 近期大額年繳
  for (const item of upcomingCharges(data, 45)) {
    const sub = data.subscriptions.find((s) => s.id === item.subscriptionId)
    if (sub?.cycle === 'yearly' && item.twd >= 3000) {
      out.push({
        id: `annual-${sub.id}`,
        level: 'info',
        title: `${shortName(sub.name)} 年繳將扣 NT$${Math.round(item.twd).toLocaleString()}`,
        detail: `${item.date}（${item.days} 天後），記得預留現金`,
      })
    }
  }

  const order: Record<InsightLevel, number> = { warn: 0, tip: 1, info: 2 }
  return out.sort((a, b) => order[a.level] - order[b.level]).slice(0, 6)
}

function shortName(n: string): string {
  return n.length > 18 ? `${n.slice(0, 18)}…` : n
}

/** 跟上月比較（回傳比例，上月為 0 時回傳 null） */
export function monthDelta(data: AppData, monthKey: string): { diff: number; pct: number | null; prev: number } {
  const cur = computeMonth(data, monthKey).totalTwd
  const prev = computeMonth(data, addMonths(monthKey, -1)).totalTwd
  return {
    diff: round2(cur - prev),
    pct: prev > 0 ? (cur - prev) / prev : null,
    prev,
  }
}

/** 訂閱的等效年費（台幣，給清單頁排序用） */
export function annualCostTwd(data: AppData, sub: Subscription): number {
  const rate = resolveRate(data, monthKeyOf(todayISO()))
  const per = monthlyEquivalent(sub)
  return round2(splitCharge(per, sub.currency, rate.rate, data.settings.feeRate).total * 12)
}

/** 產生一段可讀的日期區間，例如 3/8 起 */
export function sinceLabel(iso: string): string {
  const d = parseISO(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}`
}
