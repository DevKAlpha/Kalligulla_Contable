import { useEffect, useRef, useState } from 'react'

const TYPES = [
  ['expense', 'Gasto'], ['income', 'Ingreso'], ['investment', 'Inversión'], ['loan', 'Préstamo'],
]

export function MovementDialog({ open, defaultType, onClose, onSubmit }) {
  const dialogRef = useRef(null)
  const [type, setType] = useState(defaultType)

  const close = () => {
    setType(defaultType)
    onClose()
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (open && !dialog.open) {
      dialog.showModal()
    }
    if (!open && dialog.open) dialog.close()
  }, [open, defaultType])

  const submit = (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const values = Object.fromEntries(new FormData(form))
    if (onSubmit(values)) {
      form.reset()
      setType(defaultType)
    }
  }

  return (
    <dialog className="movement-dialog" ref={dialogRef} onCancel={close} onClick={(event) => event.target === dialogRef.current && close()}>
      <form onSubmit={submit}>
        <div className="dialog-heading">
          <div><span className="eyebrow">NUEVO REGISTRO</span><h2>Añadir información</h2></div>
          <button className="dialog-close" type="button" onClick={close} aria-label="Cerrar">×</button>
        </div>
        <div className="type-switch" role="group" aria-label="Tipo de movimiento">
          {TYPES.map(([value, label]) => (
            <label key={value}><input type="radio" name="type" value={value} checked={type === value} onChange={() => setType(value)} /><span>{label}</span></label>
          ))}
        </div>
        <label className="form-field">Descripción<input name="description" type="text" placeholder="Ej. Mercado" required maxLength="40" /></label>
        <div className="form-row">
          <label className="form-field">Valor<input name="amount" type="number" placeholder="0" required min="1" /></label>
          <label className="form-field">Categoría<select name="category" defaultValue="Otro"><option>Alimentación</option><option>Hogar</option><option>Transporte</option><option>Ocio</option><option>Trabajo</option><option>Inversión</option><option>Préstamo</option><option>Otro</option></select></label>
        </div>
        <button className="primary-button full-button" type="submit">Guardar registro</button>
        <small className="dialog-note">El registro se guarda localmente en este dispositivo.</small>
      </form>
    </dialog>
  )
}
