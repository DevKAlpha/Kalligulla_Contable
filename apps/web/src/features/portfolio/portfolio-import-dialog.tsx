'use client'

import { FileSpreadsheet, ShieldCheck, Upload } from 'lucide-react'
import { useRef, useState, type ChangeEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useImportPortfolio } from '@/features/finance/queries'
import { useUiStore } from '@/features/ui/ui-store'
import { errorMessage } from '@/lib/api-client'
import { plural } from '@/lib/cn'

const MAX_BYTES = 10 * 1024 * 1024
const reportDate = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })

/** Base64 in chunks: building one huge string with spread arguments overflows the call stack on big files. */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

function ImportContent({ onDone }: { onDone: () => void }) {
  const importPortfolio = useImportPortfolio()
  const notify = useUiStore((state) => state.notify)
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const read = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) return setError('Elige el archivo Excel (.xlsx) exportado desde xStation 5.')
    if (file.size > MAX_BYTES) return setError('El archivo supera 10 MB.')
    importPortfolio.mutate({ fileName: file.name, contentBase64: toBase64(await file.arrayBuffer()) }, {
      onSuccess: (result) => {
        const account = result.accountNumber ? ` de la cuenta ${result.accountNumber}` : ''
        const when = result.reportTime ? ` (reporte del ${reportDate.format(new Date(result.reportTime))})` : ''
        notify(`Importamos ${plural(result.holdings, 'activo')}${account}${when}`, 'success')
        onDone()
      },
      onError: (reason) => setError(errorMessage(reason, 'No fue posible leer el reporte.')),
    })
  }

  return (
    <div className="grid gap-4">
      <ol className="grid gap-2.5 text-[14px] leading-snug text-ink-2">
        {[
          'En xStation 5 abre la pestaña «Historial de la cuenta» (Account History).',
          'Elige un rango que llegue hasta hoy y pulsa «Exportar».',
          'Descarga el archivo en formato Excel (.xlsx) y selecciónalo aquí.',
        ].map((step, index) => (
          <li key={step} className="flex gap-3">
            <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-outline bg-accent font-mono text-[12px] font-medium text-on-accent">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <Button size="lg" onClick={() => input.current?.click()} disabled={importPortfolio.isPending}>
        {importPortfolio.isPending ? <FileSpreadsheet size={18} aria-hidden className="animate-pulse" /> : <Upload size={18} aria-hidden />}
        {importPortfolio.isPending ? 'Leyendo reporte…' : 'Elegir reporte de XTB'}
      </Button>
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" tabIndex={-1} aria-hidden onChange={read} />

      {error && <p role="alert" className="text-[13px] font-medium text-negative">{error}</p>}

      <p className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-2">
        <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0 text-positive" />
        <span>
          Solo lectura: Kaligula lee tus posiciones abiertas y las valora con precios en vivo. No se conecta a tu cuenta, no puede
          operar ni mover dinero. El archivo se procesa en tu servidor de Kaligula y no se envía a terceros. Importar de nuevo la misma
          cuenta reemplaza la foto anterior.
        </span>
      </p>
    </div>
  )
}

export function PortfolioImportDialog() {
  const open = useUiStore((state) => state.dialog?.kind === 'portfolio-import')
  const closeDialog = useUiStore((state) => state.closeDialog)
  return (
    <Dialog open={open} onClose={closeDialog} eyebrow="Portafolio · XTB" title="Importar reporte">
      {open && <ImportContent onDone={closeDialog} />}
    </Dialog>
  )
}
