import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { marketRateAgeDays, syncMarketRate } from '../rates'
import { useStore, defaultSettings } from '../../store/useStore'
import { addMonths, currentMonthKey, todayISO } from '../date'

const today = todayISO()
const thisMonth = currentMonthKey()

const reset = () =>
  useStore.setState({
    subscriptions: [],
    charges: [],
    fxRates: [],
    settings: { ...defaultSettings },
  })

const todayRates = () =>
  useStore.getState().fxRates.filter((r) => r.date === today && r.source === 'market')

const okResponse = (twd = 32.98) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ result: 'success', rates: { TWD: twd } }),
  } as Response)

beforeEach(() => {
  reset()
  vi.unstubAllGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('syncMarketRate', () => {
  it('成功時寫入當日市場匯率，並四捨五入到小數 2 位', async () => {
    const fetchMock = vi.fn(() => okResponse(32.9876))
    vi.stubGlobal('fetch', fetchMock)
    const res = await syncMarketRate()

    expect(res.ok).toBe(true)
    expect(res.rate).toBe(32.99)
    const saved = todayRates()
    expect(saved).toHaveLength(1)
    expect(saved[0].rate).toBe(32.99)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('同一天已有市場匯率就不重複發請求', async () => {
    const fetchMock = vi.fn(() => okResponse(32.98))
    vi.stubGlobal('fetch', fetchMock)

    await syncMarketRate()
    const second = await syncMarketRate()

    expect(second.skipped).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(todayRates()).toHaveLength(1)
  })

  it('force 時會重新抓，並覆蓋同一天那一筆（不會長出重複資料）', async () => {
    vi.stubGlobal('fetch', vi.fn(() => okResponse(31.5)))
    await syncMarketRate()

    vi.stubGlobal('fetch', vi.fn(() => okResponse(33.1)))
    const res = await syncMarketRate({ force: true })

    expect(res.rate).toBe(33.1)
    const saved = todayRates()
    expect(saved).toHaveLength(1)
    expect(saved[0].rate).toBe(33.1)
  })

  it('HTTP 錯誤時回報失敗，且不寫入任何匯率', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, status: 503 } as Response)),
    )
    const res = await syncMarketRate()

    expect(res.ok).toBe(false)
    expect(res.message).toContain('503')
    expect(useStore.getState().fxRates).toHaveLength(0)
  })

  it('回應不是 success 時視為失敗', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ result: 'error' }),
        } as Response),
      ),
    )
    const res = await syncMarketRate()
    expect(res.ok).toBe(false)
    expect(res.message).toContain('匯率服務')
  })

  it('回應裡沒有 TWD 時視為失敗', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ result: 'success', rates: { JPY: 150 } }),
        } as Response),
      ),
    )
    const res = await syncMarketRate()
    expect(res.ok).toBe(false)
    expect(res.message).toContain('TWD')
  })

  it('網路失敗時給出可讀訊息，不丟例外', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('getaddrinfo ENOTFOUND open.er-api.com'))),
    )
    const res = await syncMarketRate()
    expect(res.ok).toBe(false)
    expect(res.message).toContain('沿用既有匯率')
  })

  it('AbortError 會轉成「連線逾時」', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new DOMException('aborted', 'AbortError'))),
    )
    const res = await syncMarketRate()
    expect(res.ok).toBe(false)
    expect(res.message).toContain('連線逾時')
  })

  it('真的等滿 10 秒會 abort 請求（不是只測錯誤訊息對應）', async () => {
    vi.useFakeTimers()
    let aborted = false
    const fetchMock = vi.fn((_url: string, init: RequestInit) => {
      const signal = init.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          aborted = true
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const pending = syncMarketRate()
    // 還沒到 10 秒：請求應該還掛著
    await vi.advanceTimersByTimeAsync(9_000)
    expect(aborted).toBe(false)

    await vi.advanceTimersByTimeAsync(1_500)
    const res = await pending
    vi.useRealTimers()

    expect(aborted).toBe(true)
    expect(res.ok).toBe(false)
    expect(res.message).toContain('連線逾時')
  })

  it('離線時直接跳過，連 fetch 都不發', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('navigator', { onLine: false })

    const res = await syncMarketRate()

    expect(res.ok).toBe(false)
    expect(res.message).toContain('離線')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('失敗不會破壞既有匯率資料', async () => {
    useStore.getState().addFxRate({ date: `${thisMonth}-01`, pair: 'USD/TWD', rate: 31.2, source: 'market' })
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('boom'))))

    await syncMarketRate()

    expect(useStore.getState().fxRates).toHaveLength(1)
    expect(useStore.getState().fxRates[0].rate).toBe(31.2)
  })
})

describe('marketRateAgeDays', () => {
  it('沒有市場匯率回傳 null', () => {
    expect(marketRateAgeDays([])).toBeNull()
    expect(marketRateAgeDays([{ date: today, source: 'manual' }])).toBeNull()
  })

  it('今天更新過就是 0', () => {
    expect(marketRateAgeDays([{ date: today, source: 'market' }])).toBe(0)
  })

  it('取最近一筆算天數', () => {
    const twoMonthsAgo = `${addMonths(thisMonth, -2)}-01`
    expect(marketRateAgeDays([{ date: twoMonthsAgo, source: 'market' }])).toBeGreaterThan(30)
    expect(
      marketRateAgeDays([
        { date: twoMonthsAgo, source: 'market' },
        { date: today, source: 'market' },
      ]),
    ).toBe(0)
  })
})
