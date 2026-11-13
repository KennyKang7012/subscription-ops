import type { AppData, Charge, Currency, FxRate, Subscription } from '../types'
import { addMonths, clampDate, currentMonthKey, toISO, todayISO } from './date'
import { round2 } from './money'
import { uid } from './id'

/**
 * 示範資料：以「今天」為基準往前推 6 個月自動生成，
 * 所以第一次打開儀表板就有趨勢圖可看，不是空畫面。
 */
export function createSeedData(): AppData {
  const today = todayISO()
  const thisMonth = currentMonthKey()
  const mk = (delta: number) => addMonths(thisMonth, delta)

  const dateIn = (monthKey: string, day: number) => {
    const [y, m] = monthKey.split('-').map(Number)
    return toISO(clampDate(y, m, day))
  }

  const subs: Subscription[] = []
  const push = (s: Omit<Subscription, 'id' | 'createdAt'>, id: string) => {
    subs.push({ ...s, id, createdAt: s.startedAt })
    return id
  }

  const chatgpt = push(
    {
      name: 'ChatGPT Plus',
      vendor: 'OpenAI',
      category: 'ai',
      amount: 20,
      currency: 'USD',
      cycle: 'monthly',
      anchorDay: 8,
      anchorMonth: null,
      startedAt: '2024-03-08',
      endedAt: null,
      trialEndsAt: null,
      status: 'active',
      seats: 1,
      note: 'GPT-5 額度 + 進階語音',
    },
    'sub_chatgpt',
  )

  const claude = push(
    {
      name: 'Claude Code Max 5x',
      vendor: 'Anthropic',
      category: 'ai',
      amount: 100,
      currency: 'USD',
      cycle: 'monthly',
      anchorDay: 15,
      anchorMonth: null,
      startedAt: '2025-01-20',
      endedAt: null,
      trialEndsAt: null,
      status: 'active',
      seats: 1,
      note: 'CLI 開發主力',
    },
    'sub_claude',
  )

  const google = push(
    {
      name: 'Google AI Pro',
      vendor: 'Google',
      category: 'ai',
      amount: 650,
      currency: 'TWD',
      cycle: 'monthly',
      anchorDay: 3,
      anchorMonth: null,
      startedAt: '2025-06-03',
      endedAt: null,
      trialEndsAt: null,
      status: 'active',
      seats: 1,
      note: '含 2TB 雲端空間',
    },
    'sub_google',
  )

  const youtube = push(
    {
      name: 'YouTube Premium',
      vendor: 'Google',
      category: 'video',
      amount: 199,
      currency: 'TWD',
      cycle: 'monthly',
      anchorDay: 22,
      anchorMonth: null,
      startedAt: '2023-11-22',
      endedAt: null,
      trialEndsAt: null,
      status: 'active',
      seats: 1,
      note: '家庭方案分母',
    },
    'sub_youtube',
  )

  const medium = push(
    {
      name: 'Medium',
      vendor: 'Medium',
      category: 'writing',
      amount: 5,
      currency: 'USD',
      cycle: 'monthly',
      anchorDay: 27,
      anchorMonth: null,
      startedAt: '2024-09-27',
      endedAt: null,
      trialEndsAt: null,
      status: 'active',
      seats: 1,
      note: '每月 5 篇付費牆文章',
    },
    'sub_medium',
  )

  const notion = push(
    {
      name: 'Notion Plus',
      vendor: 'Notion',
      category: 'infra',
      amount: 96,
      currency: 'USD',
      cycle: 'yearly',
      anchorDay: 12,
      anchorMonth: 5,
      startedAt: '2024-05-12',
      endedAt: null,
      trialEndsAt: null,
      status: 'active',
      seats: 1,
      note: '年繳，攤提每月 US$8',
    },
    'sub_notion',
  )

  push(
    {
      name: 'Perplexity Pro',
      vendor: 'Perplexity',
      category: 'ai',
      amount: 20,
      currency: 'USD',
      cycle: 'monthly',
      anchorDay: 20,
      anchorMonth: null,
      startedAt: dateIn(addMonths(thisMonth, 0), 5),
      endedAt: null,
      trialEndsAt: toISO(
        new Date(
          Number(today.slice(0, 4)),
          Number(today.slice(5, 7)) - 1,
          Number(today.slice(8, 10)) + 5,
        ),
      ),
      status: 'trial',
      seats: 1,
      note: '試用中，到期前要決定',
    },
    'sub_perplexity',
  )

  /* ── 匯率：過去 7 個月的市場匯率 ─────────────────────── */
  const rateSeries: Array<[number, number]> = [
    [-6, 31.32],
    [-5, 31.58],
    [-4, 31.85],
    [-3, 32.04],
    [-2, 31.76],
    [-1, 32.18],
    [0, 32.42],
  ]
  const fxRates: FxRate[] = rateSeries.map(([delta, rate]) => ({
    id: uid('fx'),
    date: dateIn(mk(delta), 1),
    pair: 'USD/TWD',
    rate,
    source: 'market',
  }))

  /* ── 實際扣款：每月依扣款日生成，本月的未來扣款不生成 ───── */
  const feeRate = 0.015
  const charges: Charge[] = []

  const addCharge = (
    subId: string,
    monthKey: string,
    day: number,
    amount: number,
    currency: Currency,
    fx: number,
  ) => {
    const chargedAt = dateIn(monthKey, day)
    if (chargedAt > today) return
    const base = currency === 'TWD' ? amount : round2(amount * fx)
    const feeTwd = currency === 'TWD' ? 0 : round2(base * feeRate)
    charges.push({
      id: uid('chg'),
      subscriptionId: subId,
      chargedAt,
      amountOriginal: amount,
      currency,
      fxRate: currency === 'TWD' ? 1 : fx,
      feeTwd,
      amountTwd: round2(base + feeTwd),
      source: 'manual',
      note: '',
    })
  }

  for (let i = -5; i <= 0; i++) {
    const m = mk(i)
    const fx = rateSeries.find(([d]) => d === i)?.[1] ?? 32
    addCharge(chatgpt, m, 8, 20, 'USD', fx)
    // Claude Code 前三個月是 Pro（US$20），九月升級 Max 5x（US$100）
    addCharge(claude, m, 15, i < -2 ? 20 : 100, 'USD', fx)
    addCharge(google, m, 3, 650, 'TWD', 1)
    // YouTube 從 9 月起漲價 179 → 199
    addCharge(youtube, m, 22, i < -2 ? 179 : 199, 'TWD', 1)
    addCharge(medium, m, 27, 5, 'USD', fx)
  }
  // Notion 年繳：今年 5 月一筆
  const notionYear = `${today.slice(0, 4)}-05`
  if (notionYear <= thisMonth) addCharge(notion, notionYear, 12, 96, 'USD', 31.9)

  return {
    subscriptions: subs,
    charges: charges.sort((a, b) => a.chargedAt.localeCompare(b.chargedAt)),
    fxRates,
    settings: {
      displayCurrency: 'TWD',
      basis: 'cash',
      defaultRate: 32,
      feeRate: 0.015,
      monthlyBudgetTwd: 6000,
    },
  }
}
