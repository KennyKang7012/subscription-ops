import type { AppData, Charge, Subscription } from '../../types'

export const makeSub = (over: Partial<Subscription> = {}): Subscription => ({
  id: 's1',
  name: 'Test Tool',
  vendor: 'Vendor',
  category: 'ai',
  amount: 20,
  currency: 'USD',
  cycle: 'monthly',
  anchorDay: 8,
  anchorMonth: null,
  startedAt: '2026-01-01',
  endedAt: null,
  trialEndsAt: null,
  status: 'active',
  seats: 1,
  note: '',
  createdAt: '2026-01-01',
  ...over,
})

export const makeCharge = (over: Partial<Charge> = {}): Charge => ({
  id: 'c1',
  subscriptionId: 's1',
  chargedAt: '2026-11-08',
  amountOriginal: 20,
  currency: 'USD',
  fxRate: 32,
  feeTwd: 9.6,
  amountTwd: 649.6,
  source: 'manual',
  note: '',
  ...over,
})

export const makeData = (over: Partial<AppData> = {}): AppData => ({
  subscriptions: [makeSub()],
  charges: [],
  fxRates: [],
  settings: {
    displayCurrency: 'TWD',
    basis: 'cash',
    defaultRate: 32,
    feeRate: 0.015,
    monthlyBudgetTwd: 0,
  },
  ...over,
})
