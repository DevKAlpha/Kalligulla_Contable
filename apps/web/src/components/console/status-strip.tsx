'use client'

import { useEffect, useState } from 'react'
import { useTrm } from '@/features/market/use-trm'
import { cn } from '@/lib/cn'

const clockFormat = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
const rateFormat = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dayFormat = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })

function Clock() {
  const [time, setTime] = useState<string | null>(null)
  useEffect(() => {
    const update = () => setTime(clockFormat.format(new Date()))
    update()
    const timer = window.setInterval(update, 15_000)
    return () => window.clearInterval(timer)
  }, [])
  return <time className="tabular-nums">{time ?? '--:--'}</time>
}

function TrmIndicator() {
  const trm = useTrm()
  if (trm.status === 'loading') return <span className="text-bezel-text/70">TRM …</span>
  if (trm.status === 'error') {
    return <span title="No fue posible consultar la TRM oficial">TRM sin conexión</span>
  }
  const { quote } = trm
  const validity = `Vigente ${dayFormat.format(new Date(`${quote.validFrom}T00:00:00Z`))} – ${dayFormat.format(new Date(`${quote.validTo}T00:00:00Z`))}`
  return (
    <span title={`${validity} · ${quote.source}${quote.stale ? ' · valor en caché' : ''}`} className="tabular-nums">
      <span className="text-bezel-text/70">TRM</span>{' '}
      <span className="text-white">{rateFormat.format(quote.rate)}</span>
    </span>
  )
}

/** Thin hardware-style status line printed on the bezel above the screen. */
export function StatusStrip({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-2 pt-0.5 pb-2 font-mono text-[11px] tracking-[0.08em] text-bezel-text uppercase', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="size-2 shrink-0 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" />
        <span className="truncate">Kaligula K-1</span>
        <span className="hidden text-bezel-text/60 md:inline">· Finance terminal</span>
      </div>
      <div className="flex shrink-0 items-center gap-3" aria-label="Estado del sistema">
        <span className="hidden items-center gap-1.5 sm:flex" title="Tus datos se guardan en este dispositivo">
          <span aria-hidden className="size-1.5 rounded-full bg-[#5fd394]" />
          Datos locales
        </span>
        <TrmIndicator />
        <span aria-hidden className="h-3 w-px bg-bezel-text/30" />
        <Clock />
      </div>
    </div>
  )
}
