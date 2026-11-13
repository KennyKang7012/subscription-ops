import type { AppData, Category } from '../types'
import { CATEGORY_META, CATEGORY_ORDER, fmtMoney, round2 } from './money'
import { annualizedTwd, computeMonth } from './analytics'
import { longDate, monthLabelFull, todayISO } from './date'
import { RATE_SOURCE_META } from './fx'

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const ntd = (n: number) => `NT$${Math.round(n).toLocaleString()}`

/** 產生可列印 / 另存 PDF 的月報 HTML（獨立視窗，不受 app 樣式影響） */
export function buildMonthlyReportHtml(data: AppData, monthKey: string): string {
  const stat = computeMonth(data, monthKey, 'cash')
  const items = [...stat.items].sort((a, b) => a.date.localeCompare(b.date))
  const rateMeta = RATE_SOURCE_META[stat.rate.source]
  const annual = annualizedTwd(data).total

  const catRows = CATEGORY_ORDER.filter((c: Category) => stat.byCategory[c] > 0)
    .map((c) => {
      const twd = stat.byCategory[c]
      const pct = stat.totalTwd > 0 ? (twd / stat.totalTwd) * 100 : 0
      return `<tr>
        <td><span class="swatch" style="background:${CATEGORY_META[c].hex}"></span>${CATEGORY_META[c].label}</td>
        <td class="num">${pct.toFixed(1)}%</td>
        <td class="num">${ntd(twd)}</td>
      </tr>`
    })
    .join('')

  const itemRows = items
    .map((it) => {
      const sub = data.subscriptions.find((s) => s.id === it.subscriptionId)
      const orig = (() => {
        const charge = data.charges.find((c) => c.id === it.key)
        if (charge) return fmtMoney(charge.amountOriginal, charge.currency, charge.currency === 'USD' ? 2 : 0)
        if (sub) return fmtMoney(sub.amount, sub.currency, sub.currency === 'USD' ? 2 : 0)
        return '—'
      })()
      const fx = (() => {
        const charge = data.charges.find((c) => c.id === it.key)
        if (charge) return charge.currency === 'USD' ? String(charge.fxRate) : '—'
        return sub?.currency === 'USD' ? String(stat.rate.rate) : '—'
      })()
      return `<tr>
        <td class="mono">${esc(it.date)}</td>
        <td>${esc(it.name)}</td>
        <td>${esc(sub ? CATEGORY_META[sub.category].label : '其他')}</td>
        <td class="num">${esc(orig)}</td>
        <td class="num">${esc(fx)}</td>
        <td class="num">${ntd(it.twd)}</td>
        <td class="center"><span class="badge ${it.kind}">${it.kind === 'actual' ? '實際' : '預估'}</span></td>
      </tr>`
    })
    .join('')

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8" />
<title>${monthLabelFull(monthKey)} 訂閱支出月報</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Microsoft JhengHei", "Noto Sans TC", "PingFang TC", system-ui, sans-serif;
    color: #111827; font-size: 11px; line-height: 1.5; margin: 0; padding: 24px;
    max-width: 820px; margin-inline: auto;
  }
  header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
  h1 { font-size: 19px; margin: 0 0 2px; letter-spacing: .02em; }
  .meta { color: #6b7280; font-size: 10px; }
  .cards { display: flex; gap: 10px; margin: 0 0 16px; }
  .card { flex: 1; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 11px; }
  .card .label { color: #6b7280; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
  .card .value { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }
  .card .sub { color: #9ca3af; font-size: 9px; }
  h2 { font-size: 12px; margin: 18px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #e5e7eb; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9.5px; color: #6b7280; font-weight: 600; letter-spacing: .04em;
       border-bottom: 1px solid #d1d5db; padding: 5px 6px; }
  td { border-bottom: 1px solid #f1f3f5; padding: 5px 6px; vertical-align: top; }
  tfoot td { border-top: 1px solid #d1d5db; border-bottom: none; font-weight: 600; padding-top: 6px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .center { text-align: center; }
  .mono { font-family: ui-monospace, Consolas, monospace; font-size: 10px; color: #6b7280; white-space: nowrap; }
  .swatch { display: inline-block; width: 7px; height: 7px; border-radius: 2px; margin-right: 5px; vertical-align: 1px; }
  .badge { display: inline-block; padding: 0 5px; border-radius: 3px; font-size: 9px; border: 1px solid; }
  .badge.actual { color: #047857; border-color: #a7f3d0; background: #ecfdf5; }
  .badge.estimate { color: #b45309; border-color: #fde68a; background: #fffbeb; }
  tr { page-break-inside: avoid; }
  footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 9px; }
  .note { color: #6b7280; font-size: 10px; margin-top: 6px; }
  @media print { body { padding: 0; } .no-print { display: none; } }
  .no-print { margin-bottom: 14px; }
  .no-print button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 1px solid #d1d5db; background: #f9fafb; cursor: pointer; }
</style>
</head>
<body>
  <div class="no-print"><button onclick="window.print()">列印 / 另存 PDF（Ctrl+P）</button></div>

  <header>
    <h1>訂閱支出月報 · ${monthLabelFull(monthKey)}</h1>
    <div class="meta">產生時間 ${longDate(todayISO())} · 匯率 USD/TWD ${stat.rate.rate}（${rateMeta.label}） · 基準：現金流</div>
  </header>

  <div class="cards">
    <div class="card">
      <div class="label">本月合計</div>
      <div class="value">${ntd(stat.totalTwd)}</div>
      <div class="sub">${items.length} 筆</div>
    </div>
    <div class="card">
      <div class="label">已入帳（實際）</div>
      <div class="value">${ntd(stat.actualTwd)}</div>
      <div class="sub">有扣款紀錄</div>
    </div>
    <div class="card">
      <div class="label">待扣款（預估）</div>
      <div class="value">${ntd(stat.estimatedTwd)}</div>
      <div class="sub">依扣款日推算</div>
    </div>
    <div class="card">
      <div class="label">年化（攤提）</div>
      <div class="value">${ntd(annual)}</div>
      <div class="sub">未來 12 個月平均</div>
    </div>
  </div>

  <h2>分類佔比</h2>
  <table>
    <thead><tr><th>分類</th><th class="num">佔比</th><th class="num">金額</th></tr></thead>
    <tbody>${catRows || '<tr><td colspan="3" class="note">本月尚無支出</td></tr>'}</tbody>
  </table>

  <h2>扣款明細</h2>
  <table>
    <thead>
      <tr>
        <th>日期</th><th>項目</th><th>分類</th>
        <th class="num">原幣</th><th class="num">匯率</th><th class="num">台幣</th><th class="center">狀態</th>
      </tr>
    </thead>
    <tbody>${itemRows || '<tr><td colspan="7" class="note">本月尚無支出</td></tr>'}</tbody>
    <tfoot>
      <tr>
        <td colspan="5">合計</td>
        <td class="num">${ntd(stat.totalTwd)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  <p class="note">
    原幣金額為各服務實際計價幣別；美金訂閱以扣款當日匯率換算，含國外交易手續費。
    「預估」表示該筆尚未補登實際帳單，補登後會轉為「實際」。
  </p>

  <footer>訂閱戰情室 · 資料來源：本機記帳紀錄（localStorage） · 共 ${data.subscriptions.length} 筆訂閱、${data.charges.length} 筆扣款紀錄</footer>
</body>
</html>`
}

/** 開新視窗並自動叫出列印對話框 */
export function printMonthlyReport(data: AppData, monthKey: string) {
  const win = window.open('', '_blank', 'width=900,height=1000')
  if (!win) return false
  win.document.open()
  win.document.write(buildMonthlyReportHtml(data, monthKey))
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 350)
  return true
}

/** 月報合計，給 UI 預覽用 */
export function reportTotals(data: AppData, monthKey: string) {
  const stat = computeMonth(data, monthKey, 'cash')
  return {
    total: round2(stat.totalTwd),
    actual: round2(stat.actualTwd),
    estimated: round2(stat.estimatedTwd),
    count: stat.items.length,
  }
}
