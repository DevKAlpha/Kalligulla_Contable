'use client'

import { useEffect, type ReactNode } from 'react'
import { ConsoleShell } from '@/components/console/console-shell'
import { Toaster } from '@/components/ui/toast'
import { useFinanceStore } from '@/features/finance/finance-store'
import { BackupDialog } from '@/features/finance/components/backup-dialog'
import { GoalDialog } from '@/features/finance/components/goal-dialog'
import { MovementDialog } from '@/features/finance/components/movement-dialog'
import { ProfileDialog } from '@/features/finance/components/profile-dialog'

function useClientBootstrap() {
  useEffect(() => {
    void useFinanceStore.persist.rehydrate()

    // Keep data consistent across open tabs/windows.
    const onStorage = (event: StorageEvent) => {
      if (event.key === useFinanceStore.persist.getOptions().name) void useFinanceStore.persist.rehydrate()
    }
    window.addEventListener('storage', onStorage)

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
    return () => window.removeEventListener('storage', onStorage)
  }, [])
}

export function Providers({ children }: { children: ReactNode }) {
  useClientBootstrap()
  return (
    <>
      <ConsoleShell>{children}</ConsoleShell>
      <MovementDialog />
      <GoalDialog />
      <BackupDialog />
      <ProfileDialog />
      <Toaster />
    </>
  )
}
