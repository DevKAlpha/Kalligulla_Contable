'use client'

import type { NewsCurrencyCode, NewsItem } from '@kaligula/contracts'
import { NEWS_CURRENCIES, NEWS_TOPIC_LABELS, NEWS_TOPICS, type NewsTopic } from '@kaligula/domain'
import { ArrowDownRight, ArrowUpRight, BadgeCheck, CircleAlert, Globe, Newspaper } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EmptyState, Eyebrow, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/states'
import { PageFrame } from '@/features/finance/components/page-frame'
import { useFxStream, useNow } from '@/features/market/use-fx-stream'
import { useTrm } from '@/features/market/use-trm'
import { cn } from '@/lib/cn'
import { ago, CURRENCY_NAMES, NewsCard, NewsLiveBadge, sourceMap } from './news-ui'
import { useNews, useNewsSeen } from './use-news'

type Filter = 'all' | NewsCurrencyCode | 'global'

const PAGE = 20
const rate = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 })
const percent = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function matches(item: NewsItem, filter: Filter, topic: NewsTopic | 'all') {
  const byFilter = filter === 'all' || (filter === 'global' ? item.global : item.currencies.includes(filter))
  return byFilter && (topic === 'all' || item.topics.includes(topic))
}

/** Live price next to each currency filter: the news and the market move together. */
function useQuotes() {
  const { snapshot } = useFxStream()
  const trm = useTrm()
  const quotes = new Map<NewsCurrencyCode, { value: string; change: number | null; title: string }>()
  for (const quote of snapshot?.quotes ?? []) {
    if (quote.currency === 'USD' || quote.currency === 'EUR' || quote.currency === 'KRW') {
      quotes.set(quote.currency, { value: rate.format(quote.copPerUnit), change: quote.changePct, title: `1 ${quote.currency} en pesos (${snapshot?.source.name})` })
    }
  }
  if (trm.data) quotes.set('COP', { value: `TRM ${rate.format(trm.data.rate)}`, change: null, title: 'Tasa Representativa del Mercado oficial' })
  return quotes
}

function FilterChip({ active, onClick, label, count, children }: { active: boolean; onClick: () => void; label: string; count: number; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'grid min-w-[7.5rem] shrink-0 cursor-pointer gap-0.5 rounded-xl border-2 px-3 py-2 text-left transition-[transform,background-color] duration-100 active:translate-y-px',
        active ? 'border-outline bg-accent text-on-accent shadow-[2px_2px_0_var(--outline)]' : 'border-line bg-surface hover:border-line-strong',
      )}
    >
      <span className="flex items-center justify-between gap-2 font-mono text-[12px] font-medium tracking-[0.06em] uppercase">
        {label}
        <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-on-accent/15' : 'bg-surface-2 text-muted')}>{count}</span>
      </span>
      {children}
    </button>
  )
}

function Quote({ quote, active }: { quote?: { value: string; change: number | null; title: string }; active: boolean }) {
  if (!quote) return <span className={cn('text-[11px]', active ? 'opacity-70' : 'text-muted')}>—</span>
  const Icon = (quote.change ?? 0) >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span title={quote.title} className={cn('flex items-center gap-1 text-[11px] tabular-nums', active ? 'opacity-80' : 'text-muted')}>
      {quote.value}
      {quote.change !== null && (
        <span className="inline-flex items-center">
          <Icon size={11} aria-hidden />
          {percent.format(Math.abs(quote.change))} %
        </span>
      )}
    </span>
  )
}

function Sources({ snapshot, now }: { snapshot: NonNullable<ReturnType<typeof useNews>['snapshot']>; now: number }) {
  const failing = snapshot.sources.filter((source) => source.status === 'error').length
  return (
    <Panel aria-labelledby="news-sources-title">
      <PanelHeader id="news-sources-title" eyebrow="Transparencia" title="Fuentes" />
      <ul className="grid gap-2">
        {snapshot.sources.map((source) => (
          <li key={source.id} className="flex items-start gap-2 text-[13px]">
            <span
              aria-hidden
              className={cn('mt-1.5 size-2 shrink-0 rounded-full', source.status === 'ok' ? 'bg-[#5fd394]' : source.status === 'error' ? 'bg-negative' : 'bg-muted')}
            />
            <span className="min-w-0 flex-1">
              <a href={source.homepage} target="_blank" rel="noopener noreferrer" className="font-semibold underline-offset-4 hover:underline">{source.name}</a>
              {source.official && <BadgeCheck size={13} aria-label="Fuente oficial" className="ml-1 inline text-positive" />}
              <span className="block text-[12px] text-muted">
                {source.status === 'error' ? source.error : source.checkedAt ? `Revisada ${ago(source.checkedAt, now)} · ${source.items} relevantes` : 'Pendiente'}
                {source.lang === 'en' ? ' · en inglés' : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {failing > 0 && (
        <p className="mt-3 flex items-start gap-2 text-[12px] text-ink-2">
          <CircleAlert size={14} aria-hidden className="mt-0.5 shrink-0 text-negative" />
          Las fuentes con error conservan sus últimas noticias y se reintentan solas.
        </p>
      )}
      <p className="mt-4 border-t border-line pt-3 text-[12px] leading-relaxed text-muted">
        Kaligula muestra el titular y el extracto que cada medio publica en su feed y enlaza al artículo original. Las etiquetas de divisa y tema se
        asignan con reglas automáticas de palabras clave, así que pueden no ser exactas. Los bancos centrales aparecen como fuente oficial. El Banco
        de la República y el Banco de Corea no publican un feed vigente, así que el peso y el won se cubren con medios colombianos y coreanos.
      </p>
    </Panel>
  )
}

export function NewsView() {
  const { snapshot, status } = useNews()
  const now = useNow(15_000)
  const quotes = useQuotes()
  const [, markSeen] = useNewsSeen()
  const [filter, setFilter] = useState<Filter>('all')
  const [topic, setTopic] = useState<NewsTopic | 'all'>('all')
  const [shown, setShown] = useState(PAGE)
  const sources = useMemo(() => sourceMap(snapshot), [snapshot])

  // Opening this page marks every story on it as read for the header counter.
  const latest = snapshot?.items[0]?.publishedAt
  useEffect(() => {
    if (latest) markSeen(latest)
  }, [latest, markSeen])

  const items = useMemo(() => snapshot?.items.filter((item) => matches(item, filter, topic)) ?? [], [snapshot, filter, topic])
  const count = (value: Filter) => snapshot?.items.filter((item) => matches(item, value, topic)).length ?? 0
  const okSources = snapshot?.sources.filter((source) => source.status === 'ok').length ?? 0
  const select = (next: Filter) => {
    setFilter(next)
    setShown(PAGE)
  }

  return (
    <PageFrame label="Noticias">
      <section className="relative mb-3 overflow-hidden rounded-3xl border-2 border-outline bg-bezel px-5 pt-6 pb-6 text-white shadow-[4px_4px_0_var(--outline)] sm:px-8 sm:pt-8">
        <Eyebrow className="text-bezel-text">Contexto global · COP · USD · EUR · KRW</Eyebrow>
        <h1 className="mt-2 text-[clamp(1.9rem,5vw,3rem)] leading-[0.95] font-semibold tracking-[-0.04em]">Lo que mueve tus divisas</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-bezel-text">
          <NewsLiveBadge status={status} />
          {snapshot && (
            <span>
              Actualizado {ago(snapshot.updatedAt, now)} · {okSources} de {snapshot.sources.length} fuentes en línea · se revisan cada {Math.round(snapshot.refreshMs / 60_000)} min
            </span>
          )}
        </div>
        <Newspaper aria-hidden className="pointer-events-none absolute -right-4 -bottom-6 size-36 text-white/[0.06]" strokeWidth={1.2} />
      </section>

      <div className="scroll-area -mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar por divisa">
        <FilterChip active={filter === 'all'} onClick={() => select('all')} label="Todas" count={count('all')}>
          <span className={cn('text-[11px]', filter === 'all' ? 'opacity-80' : 'text-muted')}>Todas las fuentes</span>
        </FilterChip>
        {NEWS_CURRENCIES.map((currency) => (
          <FilterChip key={currency} active={filter === currency} onClick={() => select(currency)} label={currency} count={count(currency)}>
            <Quote quote={quotes.get(currency)} active={filter === currency} />
          </FilterChip>
        ))}
        <FilterChip active={filter === 'global'} onClick={() => select('global')} label="Mundo" count={count('global')}>
          <span className={cn('flex items-center gap-1 text-[11px]', filter === 'global' ? 'opacity-80' : 'text-muted')}><Globe size={11} aria-hidden />Petróleo, China, FMI…</span>
        </FilterChip>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel aria-labelledby="news-list-title">
          <PanelHeader
            id="news-list-title"
            eyebrow={filter === 'all' ? 'Últimas noticias' : filter === 'global' ? 'Contexto mundial' : CURRENCY_NAMES[filter]}
            title={`${items.length} ${items.length === 1 ? 'noticia' : 'noticias'}`}
            action={
              <label className="flex items-center gap-2 text-[13px] text-ink-2">
                <span className="sr-only">Tema</span>
                <select
                  value={topic}
                  onChange={(event) => {
                    setTopic(event.target.value as NewsTopic | 'all')
                    setShown(PAGE)
                  }}
                  className="h-9 cursor-pointer rounded-lg border border-line-strong bg-surface px-2 text-[13px]"
                >
                  <option value="all">Todos los temas</option>
                  {NEWS_TOPICS.map((value) => <option key={value} value={value}>{NEWS_TOPIC_LABELS[value]}</option>)}
                </select>
              </label>
            }
          />
          {!snapshot ? (
            <div className="grid gap-3">{[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-20" />)}</div>
          ) : items.length === 0 ? (
            <EmptyState icon={<Newspaper size={20} aria-hidden />} title="No hay noticias con este filtro">
              Prueba con otra divisa o tema. Las fuentes se revisan cada pocos minutos.
            </EmptyState>
          ) : (
            <>
              <div className="divide-y divide-line" aria-live="polite" aria-relevant="additions">
                {items.slice(0, shown).map((item) => <NewsCard key={item.id} item={item} source={sources.get(item.sourceId)} now={now} />)}
              </div>
              {items.length > shown && (
                <button type="button" onClick={() => setShown((value) => value + PAGE)} className="mt-4 w-full cursor-pointer rounded-xl border border-line-strong py-2.5 text-[13px] font-semibold hover:border-outline">
                  Mostrar más ({items.length - shown})
                </button>
              )}
            </>
          )}
        </Panel>
        {snapshot ? <Sources snapshot={snapshot} now={now} /> : <Skeleton className="h-80 rounded-2xl" />}
      </div>
    </PageFrame>
  )
}
