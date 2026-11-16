'use client'

import { LEGACY_STORAGE_KEY, LOCAL_STORAGE_KEY_V3, snapshotFromLocalStorage, type FinanceSnapshot } from '@kaligula/domain'
import { DatabaseZap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useUiStore } from '@/features/ui/ui-store'
import { errorMessage } from '@/lib/api-client'
import { plural } from '@/lib/cn'
import { useGoals, useOverview, useRestoreBackup } from '../queries'

const DECISION_KEY = 'kaligula.localImport'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/**
 * Earlier versions kept data only in this browser. When the database is still empty and such data exists,
 * offer to move it into the database. Nothing is imported without the user's click, and the old copy is kept.
 */
export function LocalImportBanner() {
  const [local, setLocal] = useState<FinanceSnapshot | null>(null)
  const overview = useOverview()
  const goals = useGoals()
  const restoreBackup = useRestoreBackup()
  const notify = useUiStore((state) => state.notify)

  useEffect(() => {
    if (readStorage(DECISION_KEY)) return
    // Reading browser storage must happen after mount (it does not exist during server rendering).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(snapshotFromLocalStorage({ v3: readStorage(LOCAL_STORAGE_KEY_V3), v2: readStorage(LEGACY_STORAGE_KEY) }))
  }, [])

  const databaseEmpty = overview.isSuccess && goals.isSuccess
    && Object.values(overview.data.counts).every((count) => count === 0) && goals.data.length === 0
  if (!local || !databaseEmpty) return null

  const decide = (decision: 'imported' | 'dismissed') => {
    try {
      localStorage.setItem(DECISION_KEY, decision)
    } catch {
      /* storage unavailable: the banner may show again next time */
    }
    setLocal(null)
  }

  const importNow = () => {
    restoreBackup.mutate(local, {
      onSuccess: (result) => {
        decide('imported')
        notify(`Importaste ${plural(result.movements, 'registro')} y ${plural(result.goals, 'meta')} a la base de datos`, 'success')
      },
      onError: (error) => notify(errorMessage(error, 'No fue posible importar los datos.'), 'error'),
    })
  }

  return (
    <section role="region" aria-label="Datos de una versión anterior" className="mb-4 flex flex-col gap-3 rounded-2xl border-2 border-outline bg-income-soft p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-income text-white"><DatabaseZap size={20} aria-hidden /></span>
      <p className="min-w-0 flex-1 text-[14px] text-ink">
        Encontramos <b>{plural(local.movements.length, 'registro')}</b>{local.goals.length ? ` y ${plural(local.goals.length, 'meta')}` : ''} guardados
        solo en este navegador por una versión anterior. ¿Los pasamos a la base de datos?
      </p>
      <div className="flex shrink-0 gap-2">
        <Button onClick={importNow} disabled={restoreBackup.isPending}>{restoreBackup.isPending ? 'Importando…' : 'Importar'}</Button>
        <Button variant="ghost" onClick={() => decide('dismissed')}>Ahora no</Button>
      </div>
    </section>
  )
}
