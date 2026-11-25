'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { ConsoleMenuDialog } from '@/components/console/console-menu'
import { ConsoleShell } from '@/components/console/console-shell'
import { Toaster } from '@/components/ui/toast'
import { BackupDialog } from '@/features/finance/components/backup-dialog'
import { CategoriesDialog } from '@/features/finance/components/categories-dialog'
import { GoalsDialog } from '@/features/finance/components/goals-dialog'
import { MovementDialog } from '@/features/finance/components/movement-dialog'
import { ProfileDialog } from '@/features/finance/components/profile-dialog'
import { PortfolioImportDialog } from '@/features/portfolio/portfolio-import-dialog'
import { ApiError } from '@/lib/api-client'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: true,
        // Client errors (4xx) will not fix themselves; retry only network/server failures.
        retry: (failures, error) => failures < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  })
}

function useServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
  }, [])
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient)
  useServiceWorker()
  return (
    <QueryClientProvider client={queryClient}>
      <ConsoleShell>{children}</ConsoleShell>
      <MovementDialog />
      <GoalsDialog />
      <CategoriesDialog />
      <BackupDialog />
      <ProfileDialog />
      <PortfolioImportDialog />
      <ConsoleMenuDialog />
      <Toaster />
    </QueryClientProvider>
  )
}
