'use client'

import type { ReactNode } from 'react'
import { useFinanceHydrated } from '@/features/finance/finance-store'

function Skeleton() {
  return (
    <div aria-hidden className="grid animate-pulse gap-3">
      <div className="h-10 w-2/3 rounded-xl bg-surface-2" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-32 rounded-2xl bg-surface-2 first:col-span-2 xl:first:col-span-1" />)}
      </div>
      <div className="h-64 rounded-2xl bg-surface-2" />
    </div>
  )
}

/** Page wrapper: consistent padding, entrance animation and a skeleton until local data loads. */
export function PageFrame({ children, label }: { children: ReactNode; label: string }) {
  const hydrated = useFinanceHydrated()
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 pt-5 pb-8 sm:px-6 sm:pt-6 lg:px-8" aria-busy={!hydrated} aria-label={label}>
      {hydrated ? <div className="animate-[view-in_.3s_ease-out]">{children}</div> : <Skeleton />}
    </div>
  )
}
