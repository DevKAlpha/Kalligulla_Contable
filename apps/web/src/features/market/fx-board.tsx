'use client'

import type { FxQuote } from '@kaligula/contracts'
import { FX_WATCHLIST } from '@kaligula/domain'
import { ArrowDownRight, ArrowUpRight, ExternalLink, Minus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { useFxStream, useNow, type FxStreamStatus } from './use-fx-stream'
import { useTrm } from './use-trm'

const rate = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 2, maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const clock = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
const relative = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto', style: 'short' })

function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 60) return relative.format(-seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  return relative.format(-Math.round(minutes / 60), 'hour')
}

const STATUS: Record<FxStreamStatus, { label: string; dot: string }> = {
  connecting: { label: 'Conectando', dot: 'bg-muted' },
  live: { label: 'En vivo', dot: 'bg-[#5fd394] animate-pulse' },
  reconnecting: { label: 'Reconectando', dot: 'bg-expense' },
  offline: { label: 'Sin conexión', dot: 'bg-negative' },
}

function LiveBadge({ status, stale }: { status: FxStreamStatus; stale: boolean }) {
  const meta = stale && status === 'live' ? { label: 'Fuente en pausa', dot: 'bg-expense' } : STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
      <span aria-hidden className={cn('size-2 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[12px] text-muted">Sin variación diaria</span>
  const flat = Math.abs(value) < 0.005
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-0.5 text-[12px] font-medium text-ink-2 tabular-nums">
      <Icon size={14} aria-hidden />
      <span className="sr-only">{flat ? 'Sin cambio' : value > 0 ? 'Sube' : 'Baja'}</span>
      {percent.format(Math.abs(value))} % hoy
    </span>
  )
}

/** Briefly highlights a value when it changes, so live updates are noticeable. */
function useFlash(value: number | undefined): boolean {
  const previous = useRef(value)
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (value === undefined || previous.current === undefined || previous.current === value) {
      previous.current = value
      return
    }
    previous.current = value
    setFlash(true)
    const timer = window.setTimeout(() => setFlash(false), 1200)
    return () => window.clearTimeout(timer)
  }, [value])
  return flash
}

function QuoteTile({ meta, quote, trm }: { meta: (typeof FX_WATCHLIST)[number]; quote?: FxQuote; trm?: number }) {
  const flash = useFlash(quote?.copPerUnit)
  return (
    // Phones: one row (code · name · price) with the TRM below. From `sm`: a vertical tile.
    <article
      className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-2xl border border-line bg-surface p-3.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-y-2 sm:p-4"
      aria-label={quote ? `${meta.name}: ${rate.format(quote.copPerUnit)}` : meta.name}
      title={quote ? `Cotización de mercado: ${clock.format(new Date(quote.asOf))}` : undefined}
    >
      <span className="grid h-9 w-12 shrink-0 place-items-center rounded-lg border-2 border-outline bg-bezel font-mono text-[12px] font-medium text-white">
        {meta.code}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-ink-2">{meta.name}</span>
        <span className="block truncate font-mono text-[11px] text-muted">1 {meta.symbol} en pesos</span>
      </span>
      <div className="text-right sm:col-span-2 sm:text-left">
        {quote ? (
          <>
            <strong
              className={cn(
                'block rounded-md text-lg font-semibold tracking-tight tabular-nums transition-colors duration-700 sm:text-2xl',
                flash && 'bg-accent/40',
              )}
            >
              {rate.format(quote.copPerUnit)}
            </strong>
            <Change value={quote.changePct} />
          </>
        ) : (
          <Skeleton className="ml-auto h-7 w-28 sm:ml-0" />
        )}
      </div>
      {meta.code === 'USD' && trm !== undefined && (
        <span className="col-span-3 border-t border-line pt-1.5 text-[12px] text-muted sm:col-span-2">TRM oficial {rate.format(trm)}</span>
      )}
    </article>
  )
}

/** Home item with USD, EUR and KRW in COP, updated live from the server stream. */
export function FxBoard({ className }: { className?: string }) {
  const { snapshot, status } = useFxStream()
  const trm = useTrm()
  const now = useNow(1000)
  const quotes = new Map(snapshot?.quotes.map((quote) => [quote.currency, quote]))

  return (
    <Panel className={className} aria-labelledby="fx-title" aria-busy={!snapshot}>
      <PanelHeader
        id="fx-title"
        eyebrow="Divisas · en pesos colombianos"
        title="Tipo de cambio"
        action={<LiveBadge status={status} stale={Boolean(snapshot?.stale)} />}
      />
      <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
        {FX_WATCHLIST.map((meta) => (
          <QuoteTile key={meta.code} meta={meta} quote={quotes.get(meta.code)} trm={meta.code === 'USD' ? trm.data?.rate : undefined} />
        ))}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted" aria-live="polite">
        {snapshot ? (
          <>
            <span>Actualizado {ago(snapshot.fetchedAt, now)}</span>
            <span aria-hidden>·</span>
            <span>
              {snapshot.source.cadence === 'daily' ? 'Tasa diaria de respaldo' : 'Precio medio de mercado'} vía{' '}
              <a href={snapshot.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline-offset-2 hover:text-ink hover:underline">
                {snapshot.source.name}
                <ExternalLink size={11} aria-hidden />
              </a>
            </span>
          </>
        ) : status === 'offline' ? (
          <span>No fue posible conectar con la fuente de divisas. Reintentando…</span>
        ) : (
          <span>Conectando con el mercado…</span>
        )}
      </p>
    </Panel>
  )
}
