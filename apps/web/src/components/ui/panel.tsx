import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Eyebrow({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('block font-mono text-[11px] font-medium tracking-[0.12em] text-muted uppercase', className)} {...props} />
}

export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('min-w-0 rounded-2xl border border-line bg-surface p-4 sm:p-5', className)} {...props} />
}

export function PanelHeader({ eyebrow, title, action, id }: { eyebrow: string; title: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 id={id} className="mt-1 truncate text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  )
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-line-strong px-4 py-8 text-center">
      {icon && <span className="grid size-10 place-items-center rounded-lg bg-surface-2 text-muted">{icon}</span>}
      <p className="text-sm font-semibold">{title}</p>
      {children && <p className="max-w-xs text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
