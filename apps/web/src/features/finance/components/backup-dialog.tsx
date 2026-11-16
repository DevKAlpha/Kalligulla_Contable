'use client'

import { DomainError, exportSnapshotCsv, importSnapshotCsv, toIsoDate, type FinanceSnapshot } from '@kaligula/domain'
import { Download, TriangleAlert, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useUiStore } from '@/features/ui/ui-store'
import { api, errorMessage } from '@/lib/api-client'
import { plural } from '@/lib/cn'
import { useRestoreBackup } from '../queries'

const MAX_FILE_BYTES = 20 * 1024 * 1024

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function BackupContent({ onDone }: { onDone: () => void }) {
  const restoreBackup = useRestoreBackup()
  const notify = useUiStore((state) => state.notify)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ fileName: string; snapshot: FinanceSnapshot } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setExporting(true)
    setError('')
    try {
      downloadText(`kaligula-respaldo-${toIsoDate(new Date())}.csv`, exportSnapshotCsv(await api.exportBackup()))
      notify('Respaldo CSV descargado', 'success')
    } catch (reason) {
      setError(errorMessage(reason, 'No fue posible generar el respaldo.'))
    } finally {
      setExporting(false)
    }
  }

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    setPending(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return setError('El archivo supera 20 MB.')
    try {
      setPending({ fileName: file.name, snapshot: importSnapshotCsv(await file.text()) })
    } catch (reason) {
      setError(reason instanceof DomainError ? reason.message : 'No fue posible leer el archivo.')
    }
  }

  const confirm = () => {
    if (!pending) return
    restoreBackup.mutate(pending.snapshot, {
      onSuccess: (result) => {
        notify(`Respaldo restaurado: ${plural(result.movements, 'registro')} y ${plural(result.goals, 'meta')}`, 'success')
        onDone()
      },
      onError: (reason) => setError(errorMessage(reason, 'No fue posible restaurar el respaldo.')),
    })
  }

  return (
    <div className="grid gap-4">
      <p className="text-[15px] leading-relaxed text-ink-2">
        Descarga una copia de tus movimientos, categorías, metas y perfil. Puedes restaurarla después en este u otro equipo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={download} disabled={exporting}><Download size={18} aria-hidden />{exporting ? 'Generando…' : 'Descargar respaldo'}</Button>
        <Button size="lg" variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={18} aria-hidden />Restaurar CSV</Button>
        <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden onChange={read} />
      </div>

      {error && <p role="alert" className="text-[13px] font-medium text-negative">{error}</p>}

      {pending && (
        <div className="grid gap-3 rounded-2xl border-2 border-outline bg-expense-soft p-4" role="alertdialog" aria-label="Confirmar restauración">
          <p className="flex items-start gap-2 text-[14px]">
            <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-expense" />
            <span>
              <b>{pending.fileName}</b> contiene {plural(pending.snapshot.movements.length, 'registro')}, {plural(pending.snapshot.goals.length, 'meta')} y{' '}
              {plural(pending.snapshot.categories.length, 'categoría propia', 'categorías propias')}. Restaurar <b>reemplaza todos</b> tus datos guardados.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={confirm} disabled={restoreBackup.isPending}>{restoreBackup.isPending ? 'Restaurando…' : 'Reemplazar mis datos'}</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <p className="text-[12px] text-muted">Acepta respaldos de versiones anteriores de Kaligula. Los totales se recalculan a partir de los registros.</p>
    </div>
  )
}

export function BackupDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'backup')
  const closeDialog = useUiStore((state) => state.closeDialog)
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Tus datos" title="Respaldo CSV">
      {open && <BackupContent onDone={closeDialog} />}
    </Dialog>
  )
}
