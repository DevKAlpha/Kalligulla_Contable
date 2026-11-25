'use client'

import { initials } from '@kaligula/domain'
import { Newspaper } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProfile } from '@/features/finance/queries'
import { useNews, useNewsSeen } from '@/features/news/use-news'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'

const FIRST_VISIT_WINDOW_MS = 2 * 3_600_000

/** Header entry to the news section: live dot and stories published since the last visit. */
function NewsKey() {
  const { snapshot, status } = useNews()
  const [seenAt] = useNewsSeen()
  const active = usePathname() === '/noticias'
  // First visit: only the last two hours count as new, not the whole backlog.
  const since = seenAt ?? (snapshot ? new Date(Date.parse(snapshot.updatedAt) - FIRST_VISIT_WINDOW_MS).toISOString() : null)
  const fresh = active || !snapshot || !since ? 0 : snapshot.items.filter((item) => item.publishedAt > since).length
  const label = fresh > 0 ? `Noticias: ${fresh} nuevas` : 'Noticias'
  return (
    <Link
      href="/noticias"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title="Noticias que mueven COP, USD, EUR y KRW"
      className={cn(
        'relative inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border-2 px-3 font-mono text-[12px] font-medium tracking-[0.06em] uppercase transition-transform duration-100 active:translate-y-px',
        active ? 'border-outline bg-accent text-on-accent' : 'border-line-strong bg-surface text-ink-2 hover:border-outline',
      )}
    >
      <span aria-hidden className={cn('size-2 rounded-full', status === 'live' ? 'animate-pulse bg-[#5fd394]' : status === 'offline' ? 'bg-negative' : 'bg-muted')} />
      <Newspaper size={15} aria-hidden />
      <span className="max-[380px]:sr-only">Noticias</span>
      {fresh > 0 && (
        <span aria-hidden className="rounded-full bg-loan px-1.5 py-0.5 text-[10px] leading-none text-white tabular-nums">{fresh > 99 ? '99+' : fresh}</span>
      )}
    </Link>
  )
}

export function ScreenHeader() {
  const profile = useProfile()
  const name = profile.data?.name ?? ''
  const ready = profile.isSuccess
  const openDialog = useUiStore((state) => state.openDialog)

  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line bg-screen/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={() => openDialog('profile')}
        className="flex min-w-0 cursor-pointer items-center gap-3 rounded-xl text-left"
        aria-label="Editar perfil"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg border-2 border-outline bg-income font-mono text-[13px] font-medium text-white shadow-[3px_3px_0_var(--outline)]">
          {ready ? initials(name) : ''}
        </span>
        <span className="min-w-0">
          <span className="hidden font-mono text-[11px] tracking-[0.1em] text-muted uppercase sm:block">{name ? 'Bienvenido de nuevo' : 'Configura tu perfil'}</span>
          <strong className="block truncate text-[15px] font-semibold">{ready ? name || 'Invitado' : ' '}</strong>
        </span>
      </button>

      {/* Other actions live on the console controls. */}
      <NewsKey />
    </header>
  )
}
