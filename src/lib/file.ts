import type { AppData, Charge, Currency, FxRate, Settings, Subscription } from '../types'
import { todayISO } from './date'

/* ── JSON 匯出 ─────────────────────────────────────── */

export function downloadJSON(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-tools-subscription-${todayISO()}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* ── 匯入驗證 ─────────────────────────────────────── */

const CURRENCIES: Currency[] = ['USD', 'TWD']
const CYCLES = ['monthly', 'yearly', 'once']
const STATUSES = ['active', 'trial', 'paused', 'cancelled']
const BASIS = ['cash', 'accrual']

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isDate = (v: unknown): v is string => isStr(v) && /^\d{4}-\d{2}-\d{2}$/.test(v)

export type ValidationResult = { ok: true; data: AppData } | { ok: false; error: string }

/**
 * 匯入前驗證。必要欄位缺漏或型別錯誤就直接拒絕，
 * 選填欄位則補上預設值（讓舊版備份也能匯入）。
 */
export function validateAppData(raw: unknown): ValidationResult {
  if (!isObj(raw)) return { ok: false, error: '檔案根層級不是物件' }
  const { subscriptions, charges, fxRates, settings } = raw

  if (!Array.isArray(subscriptions)) return { ok: false, error: '缺少 subscriptions 陣列' }
  if (!Array.isArray(charges)) return { ok: false, error: '缺少 charges 陣列' }
  if (!Array.isArray(fxRates)) return { ok: false, error: '缺少 fxRates 陣列' }
  if (!isObj(settings)) return { ok: false, error: '缺少 settings 物件' }

  const subs: Subscription[] = []
  for (let i = 0; i < subscriptions.length; i++) {
    const s = subscriptions[i]
    const at = `subscriptions[${i}]`
    if (!isObj(s)) return { ok: false, error: `${at} 不是物件` }
    if (!isStr(s.id) || !s.id) return { ok: false, error: `${at} 缺少 id` }
    if (!isStr(s.name) || !s.name) return { ok: false, error: `${at} 缺少 name` }
    if (!isNum(s.amount)) return { ok: false, error: `${at} 的 amount 不是數字` }
    if (!CURRENCIES.includes(s.currency as Currency)) {
      return { ok: false, error: `${at} 的 currency 不支援（只接受 USD / TWD）` }
    }
    subs.push({
      id: s.id,
      name: s.name,
      vendor: isStr(s.vendor) ? s.vendor : '',
      category: (isStr(s.category) ? s.category : 'other') as Subscription['category'],
      amount: s.amount,
      currency: s.currency as Currency,
      cycle: (CYCLES.includes(s.cycle as string) ? s.cycle : 'monthly') as Subscription['cycle'],
      anchorDay: isNum(s.anchorDay) ? s.anchorDay : 1,
      anchorMonth: isNum(s.anchorMonth) ? s.anchorMonth : null,
      startedAt: isDate(s.startedAt) ? s.startedAt : todayISO(),
      endedAt: isDate(s.endedAt) ? s.endedAt : null,
      trialEndsAt: isDate(s.trialEndsAt) ? s.trialEndsAt : null,
      status: (STATUSES.includes(s.status as string) ? s.status : 'active') as Subscription['status'],
      seats: isNum(s.seats) && s.seats > 0 ? s.seats : 1,
      note: isStr(s.note) ? s.note : '',
      createdAt: isDate(s.createdAt) ? s.createdAt : todayISO(),
    })
  }

  const chgs: Charge[] = []
  for (let i = 0; i < charges.length; i++) {
    const c = charges[i]
    const at = `charges[${i}]`
    if (!isObj(c)) return { ok: false, error: `${at} 不是物件` }
    if (!isStr(c.id) || !c.id) return { ok: false, error: `${at} 缺少 id` }
    if (!isStr(c.subscriptionId)) return { ok: false, error: `${at} 缺少 subscriptionId` }
    if (!isDate(c.chargedAt)) return { ok: false, error: `${at} 的 chargedAt 不是 YYYY-MM-DD` }
    if (!isNum(c.amountTwd)) return { ok: false, error: `${at} 的 amountTwd 不是數字` }
    chgs.push({
      id: c.id,
      subscriptionId: c.subscriptionId,
      chargedAt: c.chargedAt,
      amountOriginal: isNum(c.amountOriginal) ? c.amountOriginal : 0,
      currency: CURRENCIES.includes(c.currency as Currency) ? (c.currency as Currency) : 'TWD',
      fxRate: isNum(c.fxRate) ? c.fxRate : 1,
      feeTwd: isNum(c.feeTwd) ? c.feeTwd : 0,
      amountTwd: c.amountTwd,
      source: (['manual', 'auto', 'imported'].includes(c.source as string)
        ? c.source
        : 'imported') as Charge['source'],
      note: isStr(c.note) ? c.note : '',
    })
  }

  const rates: FxRate[] = []
  for (let i = 0; i < fxRates.length; i++) {
    const r = fxRates[i]
    const at = `fxRates[${i}]`
    if (!isObj(r)) return { ok: false, error: `${at} 不是物件` }
    if (!isDate(r.date)) return { ok: false, error: `${at} 的 date 不是 YYYY-MM-DD` }
    if (!isNum(r.rate) || r.rate <= 0) return { ok: false, error: `${at} 的 rate 不是正數` }
    rates.push({
      id: isStr(r.id) && r.id ? r.id : `fx_import_${i}`,
      date: r.date,
      pair: 'USD/TWD',
      rate: r.rate,
      source: r.source === 'manual' ? 'manual' : 'market',
    })
  }

  const s = settings
  if (!isNum(s.defaultRate) || s.defaultRate <= 0) {
    return { ok: false, error: 'settings.defaultRate 不是正數' }
  }
  const safeSettings: Settings = {
    displayCurrency: CURRENCIES.includes(s.displayCurrency as Currency)
      ? (s.displayCurrency as Currency)
      : 'TWD',
    basis: BASIS.includes(s.basis as string) ? (s.basis as Settings['basis']) : 'cash',
    defaultRate: s.defaultRate,
    feeRate: isNum(s.feeRate) && s.feeRate >= 0 ? s.feeRate : 0.015,
    monthlyBudgetTwd: isNum(s.monthlyBudgetTwd) && s.monthlyBudgetTwd >= 0 ? s.monthlyBudgetTwd : 0,
  }

  return {
    ok: true,
    data: { subscriptions: subs, charges: chgs, fxRates: rates, settings: safeSettings },
  }
}

export function readJSONFile(file: File): Promise<AppData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(reader.result))
      } catch {
        reject(new Error('檔案不是合法的 JSON'))
        return
      }
      const result = validateAppData(parsed)
      if (!result.ok) {
        reject(new Error(`檔案格式不符：${result.error}`))
        return
      }
      resolve(result.data)
    }
    reader.onerror = () => reject(new Error('讀取檔案失敗'))
    reader.readAsText(file)
  })
}

/* ── 匯入前快照（單一插槽，存最近一次） ─────────────── */

const BACKUP_KEY = 'ai-tools-subscription-v1:backup'

export interface BackupSlot {
  savedAt: string
  data: AppData
}

export function saveBackup(data: AppData): void {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), data }))
  } catch {
    // 容量不足或隱私模式：備份失敗不該擋住匯入，只是少一層保險
  }
}

export function readBackup(): BackupSlot | null {
  try {
    const raw = localStorage.getItem(BACKUP_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BackupSlot
    return isStr(parsed?.savedAt) && parsed.data ? parsed : null
  } catch {
    return null
  }
}

export function clearBackup(): void {
  try {
    localStorage.removeItem(BACKUP_KEY)
  } catch {
    /* 忽略 */
  }
}
