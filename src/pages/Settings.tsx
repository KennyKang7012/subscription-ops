import { useRef, useState } from 'react'
import { Download, FileText, History, Printer, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useStore, snapshot } from '../store/useStore'
import { downloadJSON, readJSONFile, readBackup, saveBackup, type BackupSlot } from '../lib/file'
import { buildChargesCsv, csvFilename, downloadText, CSV_RANGE_LABEL, type CsvRange } from '../lib/csv'
import { printMonthlyReport, reportTotals } from '../lib/report'
import { currentMonthKey, monthLabelFull } from '../lib/date'
import { fmtMoney } from '../lib/money'
import { Badge, Button, Card, CardTitle, Field, Input, Segmented, cn } from '../components/ui'
import { FxPanel } from '../components/FxPanel'

export function SettingsPage() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const replaceAll = useStore((s) => s.replaceAll)
  const resetToSeed = useStore((s) => s.resetToSeed)
  const clearAll = useStore((s) => s.clearAll)
  const subscriptions = useStore((s) => s.subscriptions)
  const charges = useStore((s) => s.charges)

  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [backup, setBackup] = useState<BackupSlot | null>(() => readBackup())
  // 匯率與手續費用草稿字串：邊打字邊清空時不會把 0 送進 store
  const [rateDraft, setRateDraft] = useState(String(settings.defaultRate))
  const [feeDraft, setFeeDraft] = useState(String(Number((settings.feeRate * 100).toFixed(2))))
  const [csvRange, setCsvRange] = useState<CsvRange>('month')
  const [csvMonth, setCsvMonth] = useState(currentMonthKey())

  const totalTwd = charges.reduce((s, c) => s + c.amountTwd, 0)
  const report = reportTotals(snapshot(useStore.getState()), csvMonth)

  const onImport = async (file: File | undefined) => {
    if (!file) return
    try {
      const data = await readJSONFile(file)
      // 匯入會直接覆蓋本機資料，先留一份快照，匯錯還能救回來
      const backed = saveBackup(snapshot(useStore.getState()))
      setBackup(readBackup())
      replaceAll(data)
      setStatus({
        kind: backed ? 'ok' : 'err',
        msg: backed
          ? `已匯入 ${data.subscriptions.length} 筆訂閱、${data.charges.length} 筆扣款；匯入前的資料已存成快照，可用「還原匯入前」回復`
          : `已匯入 ${data.subscriptions.length} 筆訂閱、${data.charges.length} 筆扣款，但快照寫入失敗（瀏覽器儲存空間可能已滿），無法還原`,
      })
    } catch (err) {
      setStatus({ kind: 'err', msg: err instanceof Error ? err.message : '匯入失敗' })
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardTitle title="顯示與計算" hint="影響整個儀表板的換算邏輯" />
        <div className="space-y-4 px-5 pb-5">
          <Field label="顯示幣別" hint="清單仍以原幣顯示">
            <Segmented
              value={settings.displayCurrency}
              onChange={(v) => setSettings({ displayCurrency: v })}
              options={[
                { value: 'TWD', label: '新台幣 NT$' },
                { value: 'USD', label: '美金 US$' },
              ]}
            />
          </Field>

          <Field label="計算基準" hint="圖表與 KPI 共用">
            <Segmented
              value={settings.basis}
              onChange={(v) => setSettings({ basis: v })}
              options={[
                { value: 'cash', label: '現金流（實際扣款）' },
                { value: 'accrual', label: '攤提（年繳 ÷ 12）' },
              ]}
            />
            <p className="mt-2 text-[11px] leading-relaxed text-muted">
              現金流＝這個月真的從帳戶扣掉多少，年繳會在扣款那個月爆量；
              攤提＝把年繳平均分到 12 個月，看的是「真實訂閱成本」。兩個都要看才不會被帳單嚇到。
            </p>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="預設匯率 USD/TWD" hint="查無資料時使用">
              <Input
                type="number"
                step="0.01"
                value={rateDraft}
                onChange={(e) => {
                  setRateDraft(e.target.value)
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v > 0) setSettings({ defaultRate: v })
                }}
                onBlur={() => {
                  if (!(Number(rateDraft) > 0)) setRateDraft(String(settings.defaultRate))
                }}
                className="font-mono"
              />
            </Field>
            <Field label="國外刷卡手續費" hint="%">
              <Input
                type="number"
                step="0.1"
                value={feeDraft}
                onChange={(e) => {
                  setFeeDraft(e.target.value)
                  const v = Number(e.target.value)
                  if (Number.isFinite(v) && v >= 0 && v <= 20) setSettings({ feeRate: v / 100 })
                }}
                onBlur={() => {
                  const v = Number(feeDraft)
                  if (!(v >= 0 && v <= 20)) setFeeDraft(String(Number((settings.feeRate * 100).toFixed(2))))
                }}
                className="font-mono"
              />
            </Field>
          </div>

          <Field label="每月支出上限" hint="台幣，0 表示不設限">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={100}
                value={settings.monthlyBudgetTwd}
                onChange={(e) => setSettings({ monthlyBudgetTwd: Math.max(0, Number(e.target.value) || 0) })}
                className="font-mono"
              />
              <span className="shrink-0 text-[11px] text-muted">
                {settings.monthlyBudgetTwd > 0
                  ? `≈ US$${Math.round(settings.monthlyBudgetTwd / (settings.defaultRate || 1)).toLocaleString()}`
                  : '未設定'}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-muted">
              設定後，戰情室會在支出接近或超過上限時提醒，趨勢圖也會畫一條預算線。
            </p>
          </Field>
        </div>
      </Card>

      <FxPanel />

      <Card className="lg:col-span-2">
        <CardTitle
          title="報帳與匯出"
          hint="扣款明細匯成 Excel 可開的 CSV，或列印成 A4 月報（可另存 PDF）"
          right={
            <div className="flex items-center gap-2">
              <Badge className="bg-white/5 text-slate-300 ring-white/10">{report.count} 筆</Badge>
              <Badge className="bg-brand/12 text-brand ring-brand/30">
                {monthLabelFull(csvMonth)} · {fmtMoney(report.total, 'TWD')}
              </Badge>
            </div>
          }
        />
        <div className="flex flex-wrap items-end gap-3 px-5 pb-5">
          <Field label="匯出範圍">
            <Segmented
              value={csvRange}
              onChange={setCsvRange}
              options={(['month', 'year', 'all'] as CsvRange[]).map((r) => ({
                value: r,
                label: CSV_RANGE_LABEL[r],
              }))}
            />
          </Field>
          <Field label="基準月份" hint={csvRange === 'all' ? '不影響' : undefined}>
            <Input
              type="month"
              value={csvMonth}
              onChange={(e) => setCsvMonth(e.target.value || currentMonthKey())}
              className="w-[150px] font-mono"
            />
          </Field>
          <Button
            variant="primary"
            onClick={() => {
              const data = snapshot(useStore.getState())
              downloadText(csvFilename(csvRange, csvMonth), buildChargesCsv(data, csvRange, csvMonth), 'text/csv;charset=utf-8')
              setStatus({ kind: 'ok', msg: `已匯出 ${CSV_RANGE_LABEL[csvRange]}扣款明細 CSV` })
            }}
          >
            <FileText size={14} /> 匯出 CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const ok = printMonthlyReport(snapshot(useStore.getState()), csvMonth)
              if (!ok)
                setStatus({ kind: 'err', msg: '無法開啟列印視窗，請檢查瀏覽器是否封鎖彈出視窗' })
            }}
          >
            <Printer size={14} /> 列印月報
          </Button>
          <span className="ml-auto max-w-[320px] text-[11px] leading-relaxed text-muted">
            CSV 含 UTF-8 BOM，Excel 直開中文不亂碼；月報是獨立頁面，用 Ctrl+P 可另存 PDF。
          </span>
        </div>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle
          title="資料備份"
          hint="資料存在這台電腦的瀏覽器 localStorage，清快取會消失，請定期匯出"
          right={
            <div className="flex gap-2 text-[11px] text-muted">
              <Badge className="bg-white/5 text-slate-300 ring-white/10">{subscriptions.length} 筆訂閱</Badge>
              <Badge className="bg-white/5 text-slate-300 ring-white/10">{charges.length} 筆扣款</Badge>
              <Badge className="bg-white/5 text-slate-300 ring-white/10">
                累計 {fmtMoney(totalTwd, 'TWD')}
              </Badge>
            </div>
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
          <Button variant="primary" onClick={() => downloadJSON(snapshot(useStore.getState()))}>
            <Download size={14} /> 匯出 JSON
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> 匯入 JSON
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              void onImport(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button
            variant="outline"
            disabled={!backup}
            title={backup ? `快照時間：${new Date(backup.savedAt).toLocaleString('zh-TW')}` : '目前沒有快照'}
            onClick={() => {
              if (!backup) return
              replaceAll(backup.data)
              setStatus({
                kind: 'ok',
                msg: `已還原 ${new Date(backup.savedAt).toLocaleString('zh-TW')} 的快照（${backup.data.subscriptions.length} 筆訂閱、${backup.data.charges.length} 筆扣款）`,
              })
            }}
          >
            <History size={14} /> 還原匯入前
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              resetToSeed()
              setStatus({ kind: 'ok', msg: '已重新載入示範資料' })
            }}
          >
            <RotateCcw size={14} /> 載入示範資料
          </Button>
          <div className="ml-auto">
            {confirmClear ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-rose-300">確定清空所有資料？</span>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClear(false)}>
                  取消
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    clearAll()
                    setConfirmClear(false)
                    setStatus({ kind: 'ok', msg: '已清空，可以從空白開始記帳' })
                  }}
                >
                  確定清空
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmClear(true)}>
                <Trash2 size={14} /> 清空全部
              </Button>
            )}
          </div>
        </div>
        {status ? (
          <div
            className={cn(
              'border-t px-5 py-2.5 text-[11px]',
              status.kind === 'ok'
                ? 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300'
                : 'border-rose-400/20 bg-rose-400/5 text-rose-300',
            )}
          >
            {status.msg}
          </div>
        ) : null}
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle title="關於這套計算邏輯" />
        <div className="grid gap-3 px-5 pb-5 text-[11px] leading-relaxed text-muted sm:grid-cols-2">
          <p>
            <span className="text-slate-200">匯率解析優先序：</span>
            該月實際扣款的平均匯率 → 該月手動設定 → 該月最後一筆市場匯率 → 全域預設值。
            KPI 上的徽章會顯示目前用的是哪一種。
          </p>
          <p>
            <span className="text-slate-200">金額儲存：</span>
            一律以「原幣」儲存（US$20、NT$650），台幣換算只在顯示時發生，
            所以調匯率不會污染歷史紀錄。已補登的扣款永遠以當時的匯率與入帳金額為準。
          </p>
          <p>
            <span className="text-slate-200">年繳處理：</span>
            現金流模式在扣款月份一次計入；攤提模式則 ÷12 平均分攤。
            兩者差異就是「帳單痛感」與「真實成本」的差別。
          </p>
          <p>
            <span className="text-slate-200">下一階段可以做：</span>
            自動抓匯率、多幣別（EUR/JPY）、扣款日曆、家庭方案分攤、發票／報帳匯出。
          </p>
        </div>
      </Card>
    </div>
  )
}
