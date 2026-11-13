import type { ReactNode } from 'react'
import { Card, cn } from './ui'

export function KpiCard({
  label,
  value,
  hint,
  badge,
  icon,
  accent = 'brand',
  children,
}: {
  label: string
  value: string
  hint?: string
  badge?: ReactNode
  icon?: ReactNode
  accent?: 'brand' | 'ai' | 'video' | 'writing' | 'infra'
  children?: ReactNode
}) {
  const accents: Record<string, { bar: string; glow: string; text: string }> = {
    brand: { bar: 'via-brand/70', glow: 'bg-brand/10', text: 'text-brand' },
    ai: { bar: 'via-ai/70', glow: 'bg-ai/10', text: 'text-ai' },
    video: { bar: 'via-video/70', glow: 'bg-video/10', text: 'text-video' },
    writing: { bar: 'via-writing/70', glow: 'bg-writing/10', text: 'text-writing' },
    infra: { bar: 'via-infra/70', glow: 'bg-infra/10', text: 'text-infra' },
  }
  const a = accents[accent]

  return (
    <Card className="p-5">
      <div className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent', a.bar)} />
      <div className={cn('pointer-events-none absolute -top-16 -right-10 h-32 w-32 rounded-full blur-3xl', a.glow)} />
      <div className="relative flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium tracking-widest text-muted uppercase">{label}</span>
        {icon ? <span className={cn('shrink-0', a.text)}>{icon}</span> : null}
      </div>
      <div className="relative mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tracking-tight text-white tabular-nums">{value}</span>
      </div>
      <div className="relative mt-2 flex min-h-[22px] flex-wrap items-center gap-1.5">
        {badge}
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      </div>
      {children ? <div className="relative mt-3 border-t border-line/70 pt-3">{children}</div> : null}
    </Card>
  )
}
