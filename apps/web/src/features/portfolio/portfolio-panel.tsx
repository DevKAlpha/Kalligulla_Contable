'use client'

import type { PortfolioDto } from '@kaligula/contracts'
import { formatMoney, toMinor } from '@kaligula/domain'
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, FileSpreadsheet, Radio, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { Button } from '@/components/ui/button'
import { EmptyState, Eyebrow, Panel, PanelHeader } from '@/components/ui/panel'
import { ErrorState, Skeleton } from '@/components/ui/states'
import { useDeletePortfolioImport, usePortfolio } from '@/features/finance/queries'
import { useUiStore } from '@/features/ui/ui-store'
import { errorMessage } from '@/lib/api-client'
import { cn, plural } from '@/lib/cn'

type Holding = PortfolioDto['holdings'][number]
type Totals = PortfolioDto['totals'][number]

const percent = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1, signDisplay: 'exceptZero' })
const quantityFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 })
const dateTime = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const currencyFormats = new Map<string, Intl.NumberFormat>()

/** Amount in a foreign account currency (USD, EUR…), labeled with its code to avoid confusion with pesos. */
function money(value: number, currency: string | null): string {
  if (!currency) return quantityFormat.format(value)
  let format = currencyFormats.get(currency)
  if (!format) {
    format = new Intl.NumberFormat('es-CO', { style: 'currency', currency, currencyDisplay: 'code', maximumFractionDigits: 2 })
    currencyFormats.set(currency, format)
  }
  return format.format(value)
}

function ProfitBadge({ profit, pct, currency, className }: { profit: number; pct: number | null; currency: string | null; className?: string }) {
  const up = profit > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', up ? 'text-positive' : profit < 0 ? 'text-negative' : 'text-ink-2', className)}>
      {profit !== 0 && <Icon size={14} aria-hidden />}
      <span className="sr-only">{up ? 'Ganancia' : 'Pérdida'}:</span>
      {money(profit, currency)}
      {pct !== null && <span className="font-medium opacity-80"> ({percent.format(pct)} %)</span>}
    </span>
  )
}

function TotalsTiles({ totals }: { totals: Totals }) {
  const cop = totals.copPerUnit ? formatMoney(toMinor(totals.value * totals.copPerUnit)) : null
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <article className="relative overflow-hidden rounded-2xl border-2 border-outline bg-bezel p-4 text-white sm:p-5">
        <Eyebrow className="text-bezel-text">Valor actual</Eyebrow>
        <AnimatedNumber value={totals.value} format={(value) => money(value, totals.currency)} className="mt-2 block truncate text-2xl font-semibold tracking-tight tabular-nums" />
        <span className="mt-1 block text-[12px] text-bezel-text">{cop ? `≈ ${cop}` : plural(totals.positions, 'activo')}</span>
      </article>
      <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <Eyebrow>Invertido</Eyebrow>
        <AnimatedNumber value={totals.cost} format={(value) => money(value, totals.currency)} className="mt-2 block truncate text-2xl font-semibold tracking-tight tabular-nums" />
        <span className="mt-1 block text-[12px] text-muted">{plural(totals.positions, 'activo')}</span>
      </article>
      <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <Eyebrow>Ganancia / pérdida</Eyebrow>
        <ProfitBadge profit={totals.profit} pct={totals.profitPct} currency={totals.currency} className="mt-2 text-xl" />
        <span className="mt-1 block text-[12px] text-muted">Sin realizar, antes de impuestos</span>
      </article>
    </div>
  )
}

function HoldingRow({ holding, realtime }: { holding: Holding; realtime: boolean }) {
  const live = holding.priceSource === 'live'
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 md:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_7rem]">
      <span className="grid h-9 min-w-16 place-items-center rounded-lg border-2 border-outline bg-bezel px-1.5 font-mono text-[11px] font-medium text-white">
        {holding.symbol.replace(/\.US$/, '')}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold">{holding.name}</span>
        <span className="block truncate text-[12px] text-muted">
          {quantityFormat.format(holding.quantity)} {holding.side === 'sell' ? 'en corto' : holding.quantity === 1 ? 'unidad' : 'unidades'} · compra prom. {quantityFormat.format(holding.avgOpenPrice)}
          {holding.category ? ` · ${holding.category}` : ''}
        </span>
      </span>
      <span className="text-right md:text-left">
        <span className="block text-[14px] font-semibold tabular-nums">{money(holding.value, holding.accountCurrency)}</span>
        <ProfitBadge profit={holding.profit} pct={holding.profitPct} currency={holding.accountCurrency} className="text-[12px]" />
      </span>
      <span className="col-span-3 flex items-center gap-1.5 text-[12px] text-muted md:col-span-1" title={holding.priceTime ? `Operación del ${dateTime.format(new Date(holding.priceTime))}` : undefined}>
        {live ? <Radio size={13} aria-hidden className={realtime ? 'text-positive' : undefined} /> : <FileSpreadsheet size={13} aria-hidden />}
        <span className="tabular-nums">{quantityFormat.format(holding.price)}</span>
        <span>{live ? (realtime ? 'en vivo' : 'actual') : holding.priceSource === 'report' ? 'del reporte' : 'de compra'}</span>
      </span>
      <span className="col-span-3 grid gap-1 md:col-span-1">
        <span className="text-right text-[12px] text-ink-2 tabular-nums">{percent.format(holding.weightPct).replace('+', '')} %</span>
        <span className="h-1.5 rounded-full bg-surface-2"><span className="grow-x block h-full rounded-full bg-invest" style={{ width: `${Math.max(2, holding.weightPct)}%` }} /></span>
      </span>
    </li>
  )
}

function Accounts({ data }: { data: PortfolioDto }) {
  const remove = useDeletePortfolioImport()
  const notify = useUiStore((state) => state.notify)
  const [confirming, setConfirming] = useState<string | null>(null)
  return (
    <ul className="grid gap-2">
      {data.imports.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
          <FileSpreadsheet size={15} aria-hidden className="shrink-0" />
          <span className="min-w-0 flex-1">
            XTB{item.accountNumber ? ` · cuenta ${item.accountNumber}` : ''}{item.accountCurrency ? ` · ${item.accountCurrency}` : ''}
            {item.reportTime ? ` · reporte del ${dateTime.format(new Date(item.reportTime))}` : ''} · {item.fileName}
          </span>
          {confirming === item.id ? (
            <span className="flex items-center gap-2">
              <span>¿Quitar este portafolio?</span>
              <Button
                size="sm"
                variant="danger"
                disabled={remove.isPending}
                onClick={() => remove.mutateAsync(item.id).then(() => notify('Portafolio quitado'), (error) => notify(errorMessage(error), 'error'))}
              >
                Quitar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>Cancelar</Button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(item.id)} className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 hover:bg-loan-soft hover:text-loan" aria-label={`Quitar el portafolio ${item.fileName}`}>
              <Trash2 size={14} aria-hidden />
              Quitar
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Read-only portfolio imported from XTB statements, valued with live prices. */
export function PortfolioPanel({ className }: { className?: string }) {
  const portfolio = usePortfolio()
  const openDialog = useUiStore((state) => state.openDialog)
  const data = portfolio.data

  return (
    <Panel className={className} aria-labelledby="portfolio-title">
      <PanelHeader
        id="portfolio-title"
        eyebrow="Portafolio XTB · solo consulta"
        title="Tus inversiones"
        action={data && data.imports.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => openDialog('portfolio-import')}>
            <FileSpreadsheet size={15} aria-hidden />
            Actualizar reporte
          </Button>
        )}
      />

      {portfolio.isPending ? (
        <div className="grid gap-3"><Skeleton className="h-24" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : portfolio.isError && !data ? (
        <ErrorState error={portfolio.error} onRetry={() => portfolio.refetch()} />
      ) : !data || data.imports.length === 0 ? (
        <EmptyState
          icon={<BriefcaseBusiness size={20} aria-hidden />}
          title="Consulta tu portafolio de XTB"
          action={<Button onClick={() => openDialog('portfolio-import')}><FileSpreadsheet size={17} aria-hidden />Importar reporte de XTB</Button>}
        >
          XTB no ofrece una API pública desde marzo de 2025. Exporta tu historial de cuenta desde xStation 5 y Kaligula mostrará tus
          posiciones con precios en vivo. Solo lectura: nunca opera ni mueve dinero.
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {data.totals.map((totals) => <TotalsTiles key={totals.currency ?? 'sin-moneda'} totals={totals} />)}
          <p className="flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
            {data.prices.realtime ? <Radio size={13} aria-hidden className="text-positive" /> : <FileSpreadsheet size={13} aria-hidden />}
            {data.prices.source
              ? `Precios ${data.prices.realtime ? 'en vivo' : 'recientes'} de ${data.prices.source} para acciones y ETF de EE. UU.; el resto usa el precio del reporte.`
              : 'Valores según el precio del reporte.'}
            {data.prices.error && <span className="text-negative">{data.prices.error}</span>}
          </p>
          <ol className={cn('divide-y divide-line', portfolio.isFetching && 'opacity-80')} aria-label="Posiciones">
            {data.holdings.map((holding) => <HoldingRow key={holding.key} holding={holding} realtime={data.prices.realtime} />)}
          </ol>
          <Accounts data={data} />
        </div>
      )}
    </Panel>
  )
}
