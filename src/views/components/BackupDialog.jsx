import { useEffect, useRef, useState } from 'react'

export function BackupDialog({ open, onClose, onExport, onRestore }) {
  const dialogRef = useRef(null)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const restore = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setRestoring(true)
    await onRestore(file)
    setRestoring(false)
    event.target.value = ''
  }

  return (
    <dialog className="movement-dialog backup-dialog" ref={dialogRef} onCancel={onClose} onClick={(event) => event.target === dialogRef.current && onClose()}>
      <div className="backup-content">
        <div className="dialog-heading">
          <div><span className="eyebrow">DATOS LOCALES</span><h2>Respaldo CSV</h2></div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p className="backup-copy">Descarga una copia de tus movimientos, saldo y meta. Puedes restaurarla después en este u otro dispositivo.</p>
        <div className="backup-actions">
          <button className="primary-button" type="button" onClick={onExport}>↓ Descargar respaldo</button>
          <label className="secondary-button">
            {restoring ? 'Restaurando…' : '↑ Restaurar CSV'}
            <input type="file" accept=".csv,text/csv" onChange={restore} disabled={restoring} />
          </label>
        </div>
        <small className="dialog-note">Restaurar reemplaza los datos locales actuales. Exporta primero una copia si deseas conservarlos.</small>
      </div>
    </dialog>
  )
}
