import type { Metadata } from 'next'
import { ModuleView } from '@/features/finance/views/module-view'

export const metadata: Metadata = { title: 'Gastos' }

export default function Page() {
  return <ModuleView id="gastos" />
}
