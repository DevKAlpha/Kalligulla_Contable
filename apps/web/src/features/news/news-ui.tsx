'use client'

import type { NewsCurrencyCode, NewsItem, NewsSnapshot, NewsSourceStatus } from '@kaligula/contracts'
import { NEWS_TOPIC_LABELS } from '@kaligula/domain'
import { BadgeCheck, ExternalLink, Globe } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { NewsStatus } from './use-news'

export const CURRENCY_NAMES: Record<NewsCurrencyCode, string> = {
  COP: 'Peso colombiano',
  USD: 'Dólar',
  EUR: 'Euro',
  KRW: 'Won surcoreano',
}

const relative = new Intl.RelativeTimeFormat('es-CO', { numeric: 'auto', style: 'short' })
const fullDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export function ago(iso: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (seconds < 60) return relative.format(-seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relative.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 48) return relative.format(-hours, 'hour')
  return relative.format(-Math.round(hours / 24), 'day')
}

const STATUS: Record<NewsStatus, { label: string; dot: string }> = {
  connecting: { label: 'Conectando', dot: 'bg-muted' },
  live: { label: 'En vivo', dot: 'bg-[#5fd394] animate-pulse' },
  reconnecting: { label: 'Reconectando', dot: 'bg-expense' },
  offline: { label: 'Sin conexión', dot: 'bg-negative' },
}

export function NewsLiveBadge({ status }: { status: NewsStatus }) {
  const meta = STATUS[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-2.5 py-1 font-mono text-[11px] tracking-[0.08em] text-ink-2 uppercase">
      <span aria-hidden className={cn('size-2 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 font-mono text-[11px] leading-none text-ink-2', className)}>{children}</span>
}

/** One story: source, time, headline linking to the original, feed excerpt and what it affects. */
export function NewsCard({ item, source, now, compact = false }: { item: NewsItem; source?: NewsSourceStatus; now: number; compact?: boolean }) {
  return (
    <article className="grid gap-1.5 py-3 first:pt-0 last:pb-0">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
        {source?.official && (
          <span className="inline-flex items-center gap-1 rounded-full bg-positive/12 px-2 py-0.5 font-medium text-positive">
            <BadgeCheck size={13} aria-hidden />
            Oficial
          </span>
        )}
        <span className="font-semibold text-ink-2">{source?.name ?? item.sourceId}</span>
        <span aria-hidden>·</span>
        <time dateTime={item.publishedAt} title={`${item.dated ? 'Publicado' : 'Visto por primera vez'}: ${fullDate.format(new Date(item.publishedAt))}`}>
          {ago(item.publishedAt, now)}
        </time>
        {source?.lang === 'en' && <span className="rounded border border-line px-1 font-mono text-[10px]" title="Artículo en inglés">EN</span>}
      </p>
      <h3 className={cn('leading-snug font-semibold', compact ? 'text-[14px]' : 'text-[15px]')}>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="rounded-sm underline-offset-4 hover:underline">
          {item.title}
          <ExternalLink size={12} aria-hidden className="ml-1 inline-block align-baseline text-muted" />
          <span className="sr-only"> (abre el artículo original en otra pestaña)</span>
        </a>
      </h3>
      {!compact && item.summary && <p className="line-clamp-2 text-[13px] leading-relaxed text-ink-2">{item.summary}</p>}
      {(item.currencies.length > 0 || item.global || (!compact && item.topics.length > 0)) && (
        <p className="flex flex-wrap gap-1" aria-label="Relacionada con">
          {item.currencies.map((currency) => <Chip key={currency} className="font-medium text-ink">{currency}</Chip>)}
          {item.global && <Chip><Globe size={11} aria-hidden />Mundo</Chip>}
          {!compact && item.topics.slice(0, 2).map((topic) => <Chip key={topic} className="border-transparent bg-surface-2">{NEWS_TOPIC_LABELS[topic]}</Chip>)}
        </p>
      )}
    </article>
  )
}

export function sourceMap(snapshot: NewsSnapshot | null): Map<string, NewsSourceStatus> {
  return new Map(snapshot?.sources.map((source) => [source.id, source]) ?? [])
}
