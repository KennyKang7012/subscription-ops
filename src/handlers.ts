import type { Charge, Currency, Subscription } from './types'

export interface ModalHandlers {
  openNewSubscription: () => void
  openEditSubscription: (sub: Subscription) => void
  openCharge: (opts?: { initial?: Charge; subscriptionId?: string; date?: string }) => void
  deleteCharge: (id: string) => void
}

/** 依顯示幣別換算台幣金額 */
export function conv(twd: number, currency: Currency, rate: number): number {
  if (currency === 'TWD') return twd
  return Math.round((twd / (rate || 1)) * 100) / 100
}
