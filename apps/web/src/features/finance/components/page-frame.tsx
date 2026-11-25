import type { ReactNode } from 'react'

/** Page wrapper: consistent padding; its sections rise one after another. Sections handle their own loading states. */
export function PageFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="mx-auto w-full max-w-[1280px] stagger px-4 pt-5 pb-8 sm:px-6 sm:pt-6 lg:px-8" aria-label={label}>
      {children}
    </div>
  )
}
