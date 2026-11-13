import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, Charge, FxRate, Settings, Subscription } from '../types'
import { createSeedData } from '../lib/seed'
import { uid } from '../lib/id'
import { splitCharge } from '../lib/money'
import { monthKeyOf, todayISO } from '../lib/date'
import { hasChargeInMonth } from '../lib/analytics'

export interface Actions {
  addSubscription: (input: Omit<Subscription, 'id' | 'createdAt'>) => string
  updateSubscription: (id: string, patch: Partial<Subscription>) => void
  removeSubscription: (id: string) => void
  /** 暫停 / 取消時自動標記結束日，讓歷史月份仍算得對 */
  setStatus: (id: string, status: Subscription['status']) => void

  addCharge: (input: Omit<Charge, 'id'>) => string
  updateCharge: (id: string, patch: Partial<Charge>) => void
  removeCharge: (id: string) => void
  /**
   * 依訂閱定義 + 匯率自動補一筆當月扣款。
   * 同一個訂閱、同一個月份只會有一筆，重複呼叫不會重複計入。
   * @returns true 表示真的新增了，false 表示該月已有紀錄或找不到訂閱
   */
  logChargeFor: (subscriptionId: string, dateISO?: string) => boolean

  addFxRate: (rate: Omit<FxRate, 'id'>) => void
  updateFxRate: (id: string, patch: Partial<FxRate>) => void
  removeFxRate: (id: string) => void

  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: AppData) => void
  resetToSeed: () => void
  clearAll: () => void
}

export type Store = AppData & Actions

export const defaultSettings: Settings = {
  displayCurrency: 'TWD',
  basis: 'cash',
  defaultRate: 32,
  feeRate: 0.015,
  monthlyBudgetTwd: 0,
}

const emptyData = (): AppData => ({
  subscriptions: [],
  charges: [],
  fxRates: [],
  settings: { ...defaultSettings },
})

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createSeedData(),

      addSubscription: (input) => {
        const id = uid('sub')
        const sub: Subscription = normalizeEndedAt({ ...input, id, createdAt: todayISO() })
        set((s) => ({ subscriptions: [...s.subscriptions, sub] }))
        return id
      },

      updateSubscription: (id, patch) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((x) => {
            if (x.id !== id) return x
            const next = { ...x, ...patch }
            const wasStopped = x.status === 'cancelled' || x.status === 'paused'
            const isStopped = next.status === 'cancelled' || next.status === 'paused'

            // 從暫停／取消恢復成訂閱中：清除當初自動補上的結束日。
            // 這裡不看日期，隔天才恢復也要能清掉，否則整筆訂閱會繼續被排除。
            if (wasStopped && !isStopped) {
              return { ...next, endedAt: patch.endedAt ?? null }
            }

            return normalizeEndedAt(next)
          }),
        })),

      removeSubscription: (id) =>
        set((s) => ({
          subscriptions: s.subscriptions.filter((x) => x.id !== id),
          charges: s.charges.filter((c) => c.subscriptionId !== id),
        })),

      // 結束日的補值統一由 updateSubscription → normalizeEndedAt 處理
      setStatus: (id, status) => get().updateSubscription(id, { status }),

      addCharge: (input) => {
        const id = uid('chg')
        set((s) => ({ charges: [...s.charges, { ...input, id }] }))
        return id
      },

      updateCharge: (id, patch) =>
        set((s) => ({ charges: s.charges.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      removeCharge: (id) => set((s) => ({ charges: s.charges.filter((c) => c.id !== id) })),

      logChargeFor: (subscriptionId, dateISO) => {
        const state = get()
        const sub = state.subscriptions.find((s) => s.id === subscriptionId)
        if (!sub) return false

        const date = dateISO && dateISO <= todayISO() ? dateISO : todayISO()
        const month = monthKeyOf(date)
        // 一鍵補登要去重：同一個訂閱在同一個月只算一次，避免連點重複計入
        if (hasChargeInMonth(state, subscriptionId, month)) return false

        // 沿用該訂閱最近一筆的匯率，沒有就用最近一筆市場匯率
        const past = state.charges
          .filter((c) => c.subscriptionId === subscriptionId && c.currency === 'USD')
          .sort((a, b) => b.chargedAt.localeCompare(a.chargedAt))
        const fallback = state.fxRates
          .filter((r) => r.date <= date)
          .sort((a, b) => a.date.localeCompare(b.date))
          .pop()
        const fx =
          sub.currency === 'TWD'
            ? 1
            : (past[0]?.fxRate ?? fallback?.rate ?? state.settings.defaultRate)
        const { feeTwd, total } = splitCharge(sub.amount, sub.currency, fx, state.settings.feeRate)

        get().addCharge({
          subscriptionId,
          chargedAt: date,
          amountOriginal: sub.amount,
          currency: sub.currency,
          fxRate: fx,
          feeTwd,
          amountTwd: total,
          source: 'manual',
          note: `自動補登（${month}）`,
        })
        return true
      },

      // 同一天、同來源的匯率視為同一筆（自動更新重複呼叫時不會長出重複資料）
      addFxRate: (rate) =>
        set((s) => ({
          fxRates: [
            ...s.fxRates.filter(
              (r) => !(r.date === rate.date && r.source === rate.source && r.pair === rate.pair),
            ),
            { ...rate, id: uid('fx') },
          ],
        })),

      updateFxRate: (id, patch) =>
        set((s) => ({ fxRates: s.fxRates.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

      removeFxRate: (id) => set((s) => ({ fxRates: s.fxRates.filter((r) => r.id !== id) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      replaceAll: (data) => set(() => ({ ...data })),

      resetToSeed: () => set(() => ({ ...createSeedData() })),

      clearAll: () => set(() => emptyData()),
    }),
    {
      name: 'ai-tools-subscription-v1',
      version: 2,
      // v1 → v2：Settings 多了 monthlyBudgetTwd，舊資料要補上預設值
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Partial<AppData>
        return {
          subscriptions: p.subscriptions ?? [],
          charges: p.charges ?? [],
          fxRates: p.fxRates ?? [],
          settings: { ...defaultSettings, ...(p.settings ?? {}) },
        }
      },
      partialize: (s) => ({
        subscriptions: s.subscriptions,
        charges: s.charges,
        fxRates: s.fxRates,
        settings: s.settings,
      }),
    },
  ),
)

/** 匯出成純 JSON（不含函式） */
export function snapshot(state: Store): AppData {
  return {
    subscriptions: state.subscriptions,
    charges: state.charges,
    fxRates: state.fxRates,
    settings: state.settings,
  }
}

/**
 * 狀態改成暫停／取消時，若沒有結束日就補上今天。
 * 少了這個，歷史月份會被整個排除（isBillableInMonth 的舊資料防線只是備援）。
 */
function normalizeEndedAt(sub: Subscription): Subscription {
  if ((sub.status === 'cancelled' || sub.status === 'paused') && !sub.endedAt) {
    return { ...sub, endedAt: todayISO() }
  }
  return sub
}
