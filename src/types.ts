/** 幣別：目前支援美金與台幣，新增幣別只要擴這裡 */
export type Currency = 'USD' | 'TWD'

/** 分類：戰情室的分類佔比與趨勢堆疊都靠這個 */
export type Category = 'ai' | 'writing' | 'video' | 'infra' | 'other'

/** 計費週期 */
export type Cycle = 'monthly' | 'yearly' | 'once'

export type SubStatus = 'active' | 'trial' | 'paused' | 'cancelled'

export type ChargeSource = 'manual' | 'auto' | 'imported'

/** 現金流 / 攤提 */
export type Basis = 'cash' | 'accrual'

/** 訂閱定義：你「訂了什麼」 */
export interface Subscription {
  id: string
  name: string
  vendor: string
  category: Category
  /** 原幣金額（主要單位，例如 20 = US$20 / 179 = NT$179） */
  amount: number
  currency: Currency
  cycle: Cycle
  /** 每月幾號扣款（1-31，遇到短月自動夾到月底） */
  anchorDay: number
  /** 年繳時扣款的月份（1-12），月繳時為 null */
  anchorMonth: number | null
  startedAt: string
  endedAt: string | null
  trialEndsAt: string | null
  status: SubStatus
  seats: number
  note: string
  createdAt: string
}

/** 實際扣款紀錄：你「真的付了多少」 */
export interface Charge {
  id: string
  subscriptionId: string
  chargedAt: string
  amountOriginal: number
  currency: Currency
  /** 當下的 USD/TWD；TWD 扣款固定為 1 */
  fxRate: number
  /** 國外交易手續費（台幣） */
  feeTwd: number
  /** 最終入帳台幣含手續費 */
  amountTwd: number
  source: ChargeSource
  note: string
}

export interface FxRate {
  id: string
  date: string
  pair: 'USD/TWD'
  rate: number
  source: 'manual' | 'market'
}

export interface Settings {
  displayCurrency: Currency
  basis: Basis
  /** 全部匯率來源都拿不到時的最後防線 */
  defaultRate: number
  /** 國外刷卡手續費率，預設 1.5% */
  feeRate: number
  /** 每月支出上限（台幣），0 表示不設限 */
  monthlyBudgetTwd: number
}

/** 整個 App 的可持久化狀態 */
export interface AppData {
  subscriptions: Subscription[]
  charges: Charge[]
  fxRates: FxRate[]
  settings: Settings
}
