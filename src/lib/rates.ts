import { todayISO } from './date'
import { useStore } from '../store/useStore'

const ENDPOINT = 'https://open.er-api.com/v6/latest/USD'
const TIMEOUT_MS = 10_000

export interface RateSyncResult {
  ok: boolean
  rate?: number
  /** 給 UI 顯示的一句話 */
  message: string
  /** 今天已經有市場匯率，沒有真的發請求 */
  skipped?: boolean
}

/**
 * 抓當日 USD/TWD 並寫入匯率紀錄（source: market）。
 * 同一天只會有一筆，重複呼叫會覆蓋。失敗時不打斷任何計算，
 * 匯率解析會自動回退到既有資料或預設值。
 */
export async function syncMarketRate(opts: { force?: boolean } = {}): Promise<RateSyncResult> {
  const store = useStore.getState()
  const today = todayISO()
  const existing = store.fxRates.find((r) => r.date === today && r.source === 'market')

  if (existing && !opts.force) {
    return { ok: true, rate: existing.rate, message: '今天已同步', skipped: true }
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, message: '目前離線，使用既有匯率' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(ENDPOINT, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as {
      result?: string
      rates?: Record<string, number>
      time_last_update_utc?: string
    }
    if (json.result !== 'success') throw new Error('匯率服務回應失敗')
    const raw = json.rates?.TWD
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
      throw new Error('回應中沒有 TWD 匯率')
    }
    const rate = Math.round(raw * 100) / 100

    if (existing) store.updateFxRate(existing.id, { rate })
    else store.addFxRate({ date: today, pair: 'USD/TWD', rate, source: 'market' })

    return { ok: true, rate, message: `已更新為 ${rate}` }
  } catch (err) {
    const reason =
      err instanceof DOMException && err.name === 'AbortError'
        ? '連線逾時'
        : err instanceof Error
          ? err.message
          : '未知錯誤'
    return { ok: false, message: `更新失敗（${reason}），沿用既有匯率` }
  } finally {
    clearTimeout(timer)
  }
}

/** 距離上次市場匯率更新幾天（沒有紀錄回傳 null） */
export function marketRateAgeDays(fxRates: Array<{ date: string; source: string }>): number | null {
  const markets = fxRates.filter((r) => r.source === 'market').sort((a, b) => a.date.localeCompare(b.date))
  const last = markets[markets.length - 1]
  if (!last) return null
  const today = todayISO()
  return Math.round((Date.parse(today) - Date.parse(last.date)) / 86_400_000)
}
