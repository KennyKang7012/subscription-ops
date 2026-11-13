import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AppData, Charge, FxRate, Settings, Subscription } from '../types'
import { createSeedData } from '../lib/seed'
import { uid } from '../lib/id'
import { round2 } from '../lib/money'
import { monthKeyOf, todayISO } from '../lib/date'

export interface Actions {
  addSubscription: (input: Omit<Subscription, 'id' | 'createdAt'>) => string
  updateSubscription: (id: string, patch: Partial<Subscription>) => void
  removeSubscription: (id: string) => void
  /** 暫停 / 取消時自動標記結束日，讓歷史月份仍算得對 */
  setStatus: (id: string, status: Subscription['status']) => void

  addCharge: (input: Omit<Charge, 'id'>) => string
  updateCharge: (id: string, patch: Partial<Charge>) => void
  removeCharge: (id: string) => void
  /** 依訂閱定義 + 匯率自動補一筆當月扣款 */
  logChargeFor: (subscriptionId: string, dateISO?: string) => void

  addFxRate: (rate: Omit<FxRate, 'id'>) => void
  removeFxRate: (id: string) => void

  setSettings: (patch: Partial<Settings>) => void
  replaceAll: (data: AppData) => void
  resetToSeed: () => void
  clearAll: () => void
}

export type Store = AppData & Actions

const emptyData = (): AppData => ({
  subscriptions: [],
  charges: [],
  fxRates: [],
  settings: { displayCurrency: 'TWD', basis: 'cash', defaultRate: 32, feeRate: 0.015 },
})

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...createSeedData(),

      addSubscription: (input) => {
        const id = uid('sub')
        const sub: Subscription = { ...input, id, createdAt: todayISO() }
        set((s) => ({ subscriptions: [...s.subscriptions, sub] }))
        return id
      },

      updateSubscription: (id, patch) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),

      removeSubscription: (id) =>
        set((s) => ({
          subscriptions: s.subscriptions.filter((x) => x.id !== id),
          charges: s.charges.filter((c) => c.subscriptionId !== id),
        })),

      setStatus: (id, status) =>
        set((s) => ({
          subscriptions: s.subscriptions.map((x) => {
            if (x.id !== id) return x
            if (status === 'paused' || status === 'cancelled') {
              const alreadyEnded = x.endedAt && x.endedAt < todayISO()
              return { ...x, status, endedAt: alreadyEnded ? x.endedAt : todayISO() }
            }
            return { ...x, status, endedAt: null }
          }),
        })),

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
        if (!sub) return
        const date = dateISO ?? todayISO()
        const month = monthKeyOf(date)
        // 沿用該訂閱最近一筆的匯率，沒有就用解析出來的
        const past = state.charges
          .filter((c) => c.subscriptionId === subscriptionId && c.currency === 'USD')
          .sort((a, b) => b.chargedAt.localeCompare(a.chargedAt))
        const fallback = state.fxRates
          .filter((r) => r.date <= date)
          .sort((a, b) => a.date.localeCompare(b.date))
          .pop()
        const fx = sub.currency === 'TWD' ? 1 : (past[0]?.fxRate ?? fallback?.rate ?? state.settings.defaultRate)
        const base = sub.currency === 'TWD' ? sub.amount : round2(sub.amount * fx)
        const feeTwd = sub.currency === 'TWD' ? 0 : round2(base * state.settings.feeRate)
        get().addCharge({
          subscriptionId,
          chargedAt: date > todayISO() ? todayISO() : date,
          amountOriginal: sub.amount,
          currency: sub.currency,
          fxRate: fx,
          feeTwd,
          amountTwd: round2(base + feeTwd),
          source: 'manual',
          note: `自動補登（${month}）`,
        })
      },

      addFxRate: (rate) => set((s) => ({ fxRates: [...s.fxRates, { ...rate, id: uid('fx') }] })),

      removeFxRate: (id) => set((s) => ({ fxRates: s.fxRates.filter((r) => r.id !== id) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      replaceAll: (data) => set(() => ({ ...data })),

      resetToSeed: () => set(() => ({ ...createSeedData() })),

      clearAll: () => set(() => emptyData()),
    }),
    {
      name: 'ai-tools-subscription-v1',
      version: 1,
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
