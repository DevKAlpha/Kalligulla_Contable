'use client'

import { DomainError, exportFinanceCsv, importFinanceCsv, toIsoDate, type FinanceState } from '@kaligula/domain'
import { Download, TriangleAlert, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useFinanceStore } from '@/features/finance/finance-store'
import { useUiStore } from '@/features/ui/ui-store'

const MAX_FILE_BYTES = 5 * 1024 * 1024

function BackupContent({ onDone }: { onDone: () => void }) {
  const replaceAll = useFinanceStore((state) => state.replaceAll)
  const notify = useUiStore((state) => state.notify)
  const fileInput = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ fileName: string; state: FinanceState } | null>(null)
  const [error, setError] = useState('')

  const download = () => {
    const { schemaVersion, profile, goal, movements } = useFinanceStore.getState()
    const blob = new Blob([exportFinanceCsv({ schemaVersion, profile, goal, movements })], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kaligula-respaldo-${toIsoDate(new Date())}.csv`
    link.click()
    URL.revokeObjectURL(url)
    notify('Respaldo CSV descargado', 'success')
  }

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    setPending(null)
    if (!file) return
    if (file.size > MAX_FILE_BYTES) return setError('El archivo supera 5 MB.')
    try {
      setPending({ fileName: file.name, state: importFinanceCsv(await file.text()) })
    } catch (reason) {
      setError(reason instanceof DomainError ? reason.message : 'No fue posible leer el archivo.')
    }
  }

  const confirm = () => {
    if (!pending) return
    replaceAll(pending.state)
    notify('Respaldo restaurado correctamente', 'success')
    onDone()
  }

  return (
    <div className="grid gap-4">
      <p className="text-[15px] leading-relaxed text-ink-2">
        Descarga una copia de tus movimientos, meta y perfil. Puedes restaurarla después en este u otro dispositivo.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button size="lg" onClick={download}><Download size={18} aria-hidden />Descargar respaldo</Button>
        <Button size="lg" variant="secondary" onClick={() => fileInput.current?.click()}><Upload size={18} aria-hidden />Restaurar CSV</Button>
        <input ref={fileInput} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-hidden onChange={read} />
      </div>

      {error && <p role="alert" className="text-[13px] font-medium text-negative">{error}</p>}

      {pending && (
        <div className="grid gap-3 rounded-2xl border-2 border-outline bg-expense-soft p-4" role="alertdialog" aria-label="Confirmar restauración">
          <p className="flex items-start gap-2 text-[14px]">
            <TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0 text-expense" />
            <span>
              <b>{pending.fileName}</b> contiene {pending.state.movements.length} registros
              {pending.state.goal ? ' y una meta' : ''}. Restaurar <b>reemplaza todos</b> tus datos actuales.
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={confirm}>Reemplazar mis datos</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>Cancelar</Button>
          </div>
        </div>
      )}

      <p className="text-[12px] text-muted">También se aceptan respaldos de la versión anterior de Kaligula. Los totales se recalculan a partir de los registros.</p>
    </div>
  )
}

export function BackupDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'backup')
  const closeDialog = useUiStore((state) => state.closeDialog)
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Datos locales" title="Respaldo CSV">
      {open && <BackupContent onDone={closeDialog} />}
    </Dialog>
  )
}
