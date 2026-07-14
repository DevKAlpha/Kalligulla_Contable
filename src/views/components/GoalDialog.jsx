import { useEffect, useRef } from 'react'

export function GoalDialog({ open, goal, onClose, onSubmit }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  const submit = (event) => {
    event.preventDefault()
    onSubmit(Object.fromEntries(new FormData(event.currentTarget)))
  }

  return (
    <dialog className="movement-dialog" ref={dialogRef} onCancel={onClose} onClick={(event) => event.target === dialogRef.current && onClose()}>
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div><span className="eyebrow">META DE AHORRO</span><h2>Configurar meta</h2></div>
          <button className="dialog-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <label className="form-field">Nombre<input name="name" type="text" defaultValue={goal.target ? goal.name : ''} placeholder="Ej. Fondo de emergencia" required maxLength="50" /></label>
        <div className="form-row">
          <label className="form-field">Ahorrado<input name="current" type="number" defaultValue={goal.current} min="0" required /></label>
          <label className="form-field">Objetivo<input name="target" type="number" defaultValue={goal.target || ''} min="1" required /></label>
        </div>
        <button className="primary-button full-button" type="submit">Guardar meta</button>
      </form>
    </dialog>
  )
}
