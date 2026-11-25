'use client'

import { Newspaper } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import { EmptyState, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/states'
import { useNow } from '@/features/market/use-fx-stream'
import { NewsCard, NewsLiveBadge, sourceMap } from './news-ui'
import { useNews } from './use-news'

/** Home: the latest stories that move COP, USD, EUR and KRW. */
export function NewsPanel({ className, limit = 5 }: { className?: string; limit?: number }) {
  const { snapshot, status } = useNews()
  const now = useNow(30_000)
  const sources = useMemo(() => sourceMap(snapshot), [snapshot])
  const items = snapshot?.items.slice(0, limit) ?? []

  return (
    <Panel className={className} aria-labelledby="news-home-title">
      <PanelHeader
        id="news-home-title"
        eyebrow="Contexto global"
        title="Noticias que mueven tus divisas"
        action={
          <div className="flex items-center gap-3">
            <NewsLiveBadge status={status} />
            <Link href="/noticias" className="text-[13px] font-semibold text-ink-2 underline-offset-4 hover:text-ink hover:underline">Ver todas →</Link>
          </div>
        }
      />
      {!snapshot ? (
        <div className="grid gap-3">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-14" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Newspaper size={20} aria-hidden />} title="Sin noticias por ahora">
          Las fuentes no respondieron todavía. Kaligula vuelve a intentarlo cada pocos minutos.
        </EmptyState>
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => <NewsCard key={item.id} item={item} source={sources.get(item.sourceId)} now={now} compact />)}
        </div>
      )}
    </Panel>
  )
}
