'use client'

import type { MoverDto } from '@kaligula/contracts'
import { ASSET_CLASS_LABELS, ASSET_CLASSES, type AssetClass } from '@kaligula/domain'
import { ArrowDownRight, ArrowUpRight, ExternalLink, Info } from 'lucide-react'
import { useState } from 'react'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Sparkline } from '@/components/ui/sparkline'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { cn } from '@/lib/cn'
import { useNow } from './use-fx-stream'
import { useMovers } from './use-movers'

const usd = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', currencyDisplay: 'symbol', maximumFractionDigits: 2 })
const usdSmall = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD', currencyDisplay: 'symbol', maximumSignificantDigits: 4 })
const percent = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const relative = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto', style: 'short' })
const tradeTime = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const HIGHLIGHTS = 'destacados'

function ago(iso: string, now: number): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  return minutes < 60 ? relative.format(-minutes, 'minute') : relative.format(-Math.round(minutes / 60), 'hour')
}

function price(value: number): string {
  return value >= 1 ? usd.format(value) : usdSmall.format(value)
}

function Change({ value, className }: { value: number; className?: string }) {
  const up = value > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center justify-end gap-0.5 font-semibold tabular-nums', up ? 'text-positive' : value < 0 ? 'text-negative' : 'text-ink-2', className)}>
      <Icon size={15} aria-hidden />
      <span className="sr-only">{up ? 'Sube' : 'Baja'}</span>
      {percent.format(value)} %
    </span>
  )
}

function MoverRow({ mover, rank, showNiche }: { mover: MoverDto; rank: number; showNiche: boolean }) {
  return (
    <li
      className="grid grid-cols-[1.25rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 py-2.5 sm:grid-cols-[1.25rem_auto_minmax(0,1fr)_5rem_6.5rem_6rem]"
      title={`${mover.name} · ${price(mover.priceUsd)}${mover.priceTime ? ` (operación del ${tradeTime.format(new Date(mover.priceTime))})` : ''} · ${percent.format(mover.changePct)} % en 30 días`}
    >
      <span className="font-mono text-[12px] text-muted tabular-nums">{rank}</span>
      <span className="grid h-8 min-w-14 place-items-center rounded-lg border-2 border-outline bg-bezel px-1.5 font-mono text-[11px] font-medium text-white">
        {mover.symbol.length > 7 ? `${mover.symbol.slice(0, 6)}…` : mover.symbol}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">{mover.name}</span>
        <span className="block truncate text-[12px] text-muted">
          {/* On phones the price column is hidden, so the price moves under the name (first, so it is never cut). */}
          <span className="tabular-nums sm:hidden">{price(mover.priceUsd)}</span>
          {showNiche && <span className="sm:hidden"> · </span>}
          {showNiche && mover.niche}
        </span>
      </span>
      <span className="hidden justify-self-center text-ink-2 sm:block">
        {mover.sparkline.length > 1 ? (
          <Sparkline values={mover.sparkline} />
        ) : mover.change7dPct !== null ? (
          <span className="font-mono text-[11px] text-muted tabular-nums">7 d {percent.format(mover.change7dPct)} %</span>
        ) : null}
      </span>
      <span className="hidden text-right text-[13px] text-ink-2 tabular-nums sm:block">{price(mover.priceUsd)}</span>
      <Change value={mover.changePct} className="text-[14px]" />
    </li>
  )
}

/** Home item: best 30-day performers per niche for stocks, ETFs and crypto. Educational, not advice. */
export function MarketMovers({ className }: { className?: string }) {
  const [assetClass, setAssetClass] = useState<AssetClass>('stocks')
  const [niche, setNiche] = useState(HIGHLIGHTS)
  const movers = useMovers(assetClass)
  const now = useNow(30_000)

  const data = movers.data
  const active = data?.niches.find((item) => item.id === niche)
  const items = niche === HIGHLIGHTS ? data?.highlights ?? [] : active?.items ?? []
  const universe = data?.niches.reduce((sum, item) => sum + item.universe, 0) ?? 0
  const allDown = items.length > 0 && items.every((item) => item.changePct <= 0)

  return (
    <Panel className={className} aria-labelledby="movers-title">
      <PanelHeader
        id="movers-title"
        eyebrow={data?.source.realtime ? 'Mercados en vivo · rendimiento de 30 días' : 'Mercados · rendimiento de 30 días'}
        title="Mejores rendimientos"
        action={
          <div role="tablist" aria-label="Tipo de activo" className="flex gap-1 rounded-xl border border-line-strong bg-surface p-1">
            {ASSET_CLASSES.map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={assetClass === value}
                onClick={() => {
                  setAssetClass(value)
                  setNiche(HIGHLIGHTS)
                }}
                className="h-8 cursor-pointer rounded-lg px-3 text-[13px] font-semibold text-ink-2 aria-selected:bg-bezel aria-selected:text-white"
              >
                {ASSET_CLASS_LABELS[value]}
              </button>
            ))}
          </div>
        }
      />

      <div role="group" aria-label="Nicho" className="scroll-area -mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {[{ id: HIGHLIGHTS, label: 'Destacados' }, ...(data?.niches ?? [])].map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={niche === item.id}
            onClick={() => setNiche(item.id)}
            className="h-8 shrink-0 cursor-pointer rounded-full border border-line-strong px-3 text-[13px] font-medium whitespace-nowrap text-ink-2 hover:border-outline aria-pressed:border-outline aria-pressed:bg-accent aria-pressed:font-semibold aria-pressed:text-on-accent"
          >
            {item.label}
          </button>
        ))}
      </div>

      {movers.isPending ? (
        <div className="grid gap-2">{[0, 1, 2, 3, 4].map((key) => <Skeleton key={key} className="h-11" />)}</div>
      ) : movers.isError && !data ? (
        <ErrorState error={movers.error} onRetry={() => movers.refetch()} />
      ) : (
        <>
          {allDown && (
            <p className="mb-1 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
              <Info size={16} aria-hidden className="mt-0.5 shrink-0" />
              Ningún activo de {niche === HIGHLIGHTS ? 'esta selección' : 'este nicho'} sube en los últimos 30 días: se muestran los que menos caen.
            </p>
          )}
          <ol className={cn('divide-y divide-line transition-opacity', movers.isFetching && 'opacity-60')} aria-label={`Ranking de ${ASSET_CLASS_LABELS[assetClass].toLowerCase()}`}>
            {items.map((mover, index) => <MoverRow key={mover.symbol} mover={mover} rank={index + 1} showNiche={niche === HIGHLIGHTS} />)}
          </ol>
        </>
      )}

      {data && assetClass !== 'crypto' && !data.source.official && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-dashed border-line-strong px-3 py-2 text-[12px] text-ink-2">
          <Info size={15} aria-hidden className="mt-0.5 shrink-0" />
          <span>
            Precios de una fuente pública no oficial, con posible retraso. Para precios oficiales en tiempo real, agrega tus llaves gratuitas de
            Alpaca (<code className="font-mono">ALPACA_API_KEY_ID</code> y <code className="font-mono">ALPACA_API_SECRET_KEY</code>); el README explica cómo.
          </span>
        </p>
      )}

      {data && (
        <div className="mt-3 grid gap-1 text-[12px] text-muted">
          <p className="flex flex-wrap items-center gap-x-2">
            {data.source.realtime && !data.stale && (
              <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-[#5fd394]" />
                En vivo
              </span>
            )}
            <span>Actualizado {ago(data.fetchedAt, now)}{data.stale ? ' (la fuente no respondió; último valor)' : ''}</span>
            <span aria-hidden className="max-sm:hidden">·</span>
            <span>
              Datos de{' '}
              <a href={data.source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 underline-offset-2 hover:text-ink hover:underline">
                {data.source.name}
                <ExternalLink size={11} aria-hidden />
              </a>
              : {data.source.note}
            </span>
            <span aria-hidden className="max-sm:hidden">·</span>
            <span>Ranking entre {universe} activos líderes seleccionados{assetClass === 'crypto' ? ' con capitalización mayor a US$ 200 M' : ''}</span>
          </p>
          <p>Rendimientos pasados no garantizan resultados futuros. Información educativa, no es asesoría de inversión.</p>
        </div>
      )}
    </Panel>
  )
}
