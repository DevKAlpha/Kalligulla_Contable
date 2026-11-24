import type { Metadata } from 'next'
import { Suspense } from 'react'
import { ComparisonView } from '@/features/finance/views/comparison-view'

export const metadata: Metadata = { title: 'Comparar gastos' }

/** The selected months live in the query string (`?base=2026-10&target=2026-11`), read on the client. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ComparisonView />
    </Suspense>
  )
}
