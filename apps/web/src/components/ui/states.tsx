'use client'

import { CircleAlert, RotateCw } from 'lucide-react'
import { errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('shimmer rounded-xl bg-surface-2', className)} />
}

/** Inline error with a retry button for failed queries. */
export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-negative/50 px-4 py-4 text-[13px]', className)}>
      <CircleAlert size={18} aria-hidden className="shrink-0 text-negative" />
      <span className="min-w-0 flex-1 text-ink-2">{errorMessage(error, 'No fue posible cargar esta información.')}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1.5 font-semibold hover:border-outline">
          <RotateCw size={14} aria-hidden />
          Reintentar
        </button>
      )}
    </div>
  )
}
