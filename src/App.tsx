import { useMemo, useState } from 'react'
import { Activity, Download, LayoutDashboard, ListChecks, Settings2 } from 'lucide-react'
import type { Charge, Subscription } from './types'
import { snapshot, useStore } from './store/useStore'
import { downloadJSON } from './lib/file'
import { Button, Segmented, cn } from './components/ui'
import { Dashboard } from './pages/Dashboard'
import { SubscriptionsPage } from './pages/Subscriptions'
import { SettingsPage } from './pages/Settings'
import { SubscriptionForm } from './components/SubscriptionForm'
import { ChargeForm } from './components/ChargeForm'
import type { ModalHandlers } from './handlers'

type Tab = 'dashboard' | 'subs' | 'settings'

const TABS: Array<{ key: Tab; label: string; icon: typeof Activity }> = [
  { key: 'dashboard', label: '戰情室', icon: LayoutDashboard },
  { key: 'subs', label: '訂閱管理', icon: ListChecks },
  { key: 'settings', label: '設定', icon: Settings2 },
]

export default function App() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const removeCharge = useStore((s) => s.removeCharge)

  const [tab, setTab] = useState<Tab>('dashboard')

  const [subOpen, setSubOpen] = useState(false)
  const [subEditing, setSubEditing] = useState<Subscription | null>(null)
  const [chargeOpen, setChargeOpen] = useState(false)
  const [chargeEditing, setChargeEditing] = useState<Charge | null>(null)
  const [chargePreset, setChargePreset] = useState<{ subscriptionId?: string; date?: string }>({})

  const handlers = useMemo<ModalHandlers>(
    () => ({
      openNewSubscription: () => {
        setSubEditing(null)
        setSubOpen(true)
      },
      openEditSubscription: (sub) => {
        setSubEditing(sub)
        setSubOpen(true)
      },
      openCharge: (opts) => {
        setChargeEditing(opts?.initial ?? null)
        setChargePreset({ subscriptionId: opts?.subscriptionId, date: opts?.date })
        setChargeOpen(true)
      },
      deleteCharge: removeCharge,
    }),
    [removeCharge],
  )

  return (
    <div className="min-h-screen bg-bg">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[280px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(34,211,238,0.08),transparent_70%)]" />

      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand/12 text-brand ring-1 ring-brand/25">
              <Activity size={17} />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide text-slate-100">訂閱戰情室</div>
              <div className="hidden text-[10px] tracking-widest text-muted uppercase sm:block">
                Subscription Ops
              </div>
            </div>
          </div>

          <nav className="ml-2 flex items-center gap-0.5 sm:ml-6">
            {TABS.map((t) => {
              const Icon = t.icon
              const active = tab === t.key
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'bg-white/[0.07] text-slate-100 ring-1 ring-inset ring-white/10'
                      : 'text-muted hover:bg-white/5 hover:text-slate-200',
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{t.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Segmented
              size="sm"
              value={settings.displayCurrency}
              onChange={(v) => setSettings({ displayCurrency: v })}
              options={[
                { value: 'TWD', label: 'NT$', title: '以新台幣顯示' },
                { value: 'USD', label: 'US$', title: '以美金顯示' },
              ]}
            />
            <Button
              size="sm"
              variant="ghost"
              title="匯出 JSON 備份"
              onClick={() => downloadJSON(snapshot(useStore.getState()))}
            >
              <Download size={14} />
              <span className="hidden md:inline">備份</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6">
        {tab === 'dashboard' ? <Dashboard handlers={handlers} /> : null}
        {tab === 'subs' ? <SubscriptionsPage handlers={handlers} /> : null}
        {tab === 'settings' ? <SettingsPage /> : null}
      </main>

      <footer className="mx-auto max-w-[1440px] px-4 pb-8 text-[11px] text-muted/70 sm:px-6">
        資料儲存在本機瀏覽器（localStorage），清除瀏覽器資料會遺失，請定期使用右上角「備份」匯出 JSON。
      </footer>

      {subOpen ? (
        <SubscriptionForm
          key={subEditing?.id ?? 'new-sub'}
          open
          initial={subEditing}
          onClose={() => setSubOpen(false)}
        />
      ) : null}

      {chargeOpen ? (
        <ChargeForm
          key={chargeEditing?.id ?? `new-charge-${chargePreset.subscriptionId ?? ''}-${chargePreset.date ?? ''}`}
          open
          initial={chargeEditing}
          presetSubscriptionId={chargePreset.subscriptionId}
          presetDate={chargePreset.date}
          onClose={() => setChargeOpen(false)}
        />
      ) : null}
    </div>
  )
}
