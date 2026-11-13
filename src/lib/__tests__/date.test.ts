import { describe, expect, it } from 'vitest'
import {
  addMonths,
  billingDateInMonth,
  clampDate,
  daysBetweenISO,
  isActiveInMonth,
  lastNMonths,
  monthBounds,
  monthKeyOf,
  nextChargeDate,
  toISO,
} from '../date'

describe('clampDate', () => {
  it('把 31 號夾到短月最後一天', () => {
    expect(toISO(clampDate(2026, 2, 31))).toBe('2026-02-28')
    expect(toISO(clampDate(2026, 4, 31))).toBe('2026-04-30')
  })

  it('閏年 2 月是 29 天', () => {
    expect(toISO(clampDate(2024, 2, 31))).toBe('2024-02-29')
  })
})

describe('月份工具', () => {
  it('monthKeyOf 取前 7 碼', () => {
    expect(monthKeyOf('2026-11-14')).toBe('2026-11')
  })

  it('addMonths 跨年份', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
  })

  it('monthBounds 給出該月首尾', () => {
    expect(monthBounds('2026-02')).toEqual({ y: 2026, m: 2, start: '2026-02-01', end: '2026-02-28' })
  })

  it('lastNMonths 由舊到新', () => {
    expect(lastNMonths(3, '2026-03')).toEqual(['2026-01', '2026-02', '2026-03'])
  })

  it('daysBetweenISO', () => {
    expect(daysBetweenISO('2026-11-01', '2026-11-14')).toBe(13)
  })
})

describe('billingDateInMonth', () => {
  const monthly = { cycle: 'monthly', anchorDay: 31, anchorMonth: null, startedAt: '2026-01-01', endedAt: null }

  it('月繳每個月都有，短月自動夾', () => {
    expect(billingDateInMonth(monthly, '2026-02')).toBe('2026-02-28')
    expect(billingDateInMonth(monthly, '2026-11')).toBe('2026-11-30')
  })

  it('年繳只在指定月份扣款', () => {
    const yearly = { ...monthly, cycle: 'yearly', anchorDay: 12, anchorMonth: 5 }
    expect(billingDateInMonth(yearly, '2026-05')).toBe('2026-05-12')
    expect(billingDateInMonth(yearly, '2026-06')).toBeNull()
  })

  it('早於開始日就不扣', () => {
    const sub = { ...monthly, anchorDay: 8, startedAt: '2026-11-20' }
    expect(billingDateInMonth(sub, '2026-11')).toBeNull()
  })

  it('單次不重複扣款', () => {
    expect(billingDateInMonth({ ...monthly, cycle: 'once' }, '2026-11')).toBeNull()
  })
})

describe('nextChargeDate', () => {
  it('月繳：本月已過就跳下個月', () => {
    const sub = { cycle: 'monthly', anchorDay: 8, anchorMonth: null, startedAt: '2026-01-01', endedAt: null }
    expect(nextChargeDate(sub, '2026-11-10')).toBe('2026-12-08')
    expect(nextChargeDate(sub, '2026-11-08')).toBe('2026-11-08')
  })

  it('年繳：抓下一個年度的同名月份', () => {
    const sub = { cycle: 'yearly', anchorDay: 12, anchorMonth: 5, startedAt: '2024-05-12', endedAt: null }
    expect(nextChargeDate(sub, '2026-11-10')).toBe('2027-05-12')
  })

  it('已結束就沒有下次扣款', () => {
    const sub = {
      cycle: 'monthly',
      anchorDay: 8,
      anchorMonth: null,
      startedAt: '2026-01-01',
      endedAt: '2026-10-01',
    }
    expect(nextChargeDate(sub, '2026-11-10')).toBeNull()
  })
})

describe('isActiveInMonth', () => {
  const sub = { cycle: 'monthly', anchorDay: 8, anchorMonth: null, startedAt: '2026-03-15', endedAt: '2026-08-31' }
  it('開始日之前不計', () => {
    expect(isActiveInMonth(sub, '2026-02')).toBe(false)
  })
  it('期間內計入', () => {
    expect(isActiveInMonth(sub, '2026-03')).toBe(true)
    expect(isActiveInMonth(sub, '2026-08')).toBe(true)
  })
  it('結束日之後不計', () => {
    expect(isActiveInMonth(sub, '2026-09')).toBe(false)
  })
})
