'use client'

import { useEffect, useState } from 'react'
import { useHealth } from '@/features/finance/queries'
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
  const { data: quote, isError, isPending } = useTrm()
  if (isPending) return <span className="text-bezel-text/70">TRM …</span>
  if (isError || !quote) return <span title="No fue posible consultar la TRM oficial">TRM sin conexión</span>
  const validity = `Vigente ${dayFormat.format(new Date(`${quote.validFrom}T00:00:00Z`))} – ${dayFormat.format(new Date(`${quote.validTo}T00:00:00Z`))}`
  return (
    <span title={`${validity} · ${quote.source}${quote.stale ? ' · valor en caché' : ''}`} className="tabular-nums">
      <span className="text-bezel-text/70">TRM</span>{' '}
      <span className="text-white">{rateFormat.format(quote.rate)}</span>
    </span>
  )
}

/** Storage status: where data is saved and whether the database answers. */
function DatabaseIndicator() {
  const { data, isError, isPending } = useHealth()
  const up = data?.database.status === 'ok'
  const engine = data?.database.engine === 'postgres' ? 'PostgreSQL' : 'BD local'
  const label = isPending ? 'BD …' : up ? engine : 'BD sin conexión'
  return (
    <span
      className="hidden items-center gap-1.5 sm:flex"
      title={up ? `Tus datos se guardan en ${data?.database.engine === 'postgres' ? 'PostgreSQL' : 'la base de datos local (PGlite)'}` : 'No hay conexión con la base de datos'}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', isPending ? 'bg-bezel-text/50' : up && !isError ? 'bg-[#5fd394]' : 'bg-[#ff8a6b]')} />
      {label}
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
        <DatabaseIndicator />
        <TrmIndicator />
        <span aria-hidden className="h-3 w-px bg-bezel-text/30" />
        <Clock />
      </div>
    </div>
  )
}
