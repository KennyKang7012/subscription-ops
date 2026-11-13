import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useStore } from '../store/useStore'
import { resolveRate } from '../lib/fx'
import { currentMonthKey } from '../lib/date'
import type { ModalHandlers } from '../handlers'
import { Button } from '../components/ui'
import { SubscriptionTable } from '../components/SubscriptionTable'
import { ChargeLog } from '../components/ChargeLog'

export function SubscriptionsPage({ handlers }: { handlers: ModalHandlers }) {
  const subscriptions = useStore((s) => s.subscriptions)
  const charges = useStore((s) => s.charges)
  const fxRates = useStore((s) => s.fxRates)
  const settings = useStore((s) => s.settings)
  const [showCharges, setShowCharges] = useState(true)

  const rate = resolveRate({ subscriptions, charges, fxRates, settings }, currentMonthKey()).rate

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-slate-100">訂閱管理</h1>
        <span className="text-[11px] text-muted">新增、編輯、暫停，以及補登每一筆真實扣款</span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowCharges((v) => !v)}>
            {showCharges ? '隱藏扣款紀錄' : '顯示扣款紀錄'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => handlers.openCharge()}>
            <Plus size={13} /> 補登扣款
          </Button>
        </div>
      </div>

      <SubscriptionTable
        onEdit={handlers.openEditSubscription}
        onNew={handlers.openNewSubscription}
        displayCurrency={settings.displayCurrency}
        rate={rate}
      />

      {showCharges ? (
        <ChargeLog onEdit={(c) => handlers.openCharge({ initial: c })} onNew={() => handlers.openCharge()} />
      ) : null}
    </div>
  )
}
