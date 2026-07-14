import { formatCurrency } from '../../models/financeModel.js'

const TYPE_META = {
  income: { label: 'Ingreso', icon: '↙', color: 'purple', prefix: '+' },
  expense: { label: 'Gasto', icon: '↗', color: 'orange', prefix: '−' },
  investment: { label: 'Inversión', icon: '◆', color: 'blue', prefix: '' },
  loan: { label: 'Préstamo', icon: '▤', color: 'orange', prefix: '' },
}

export function MovementList({ movements, onViewAll, onRemove, limit = 3, title = 'Movimientos recientes' }) {
  const visible = limit ? movements.slice(0, limit) : movements
  const remove = (movement) => {
    if (window.confirm(`¿Eliminar “${movement.description}”?`)) onRemove(movement.id)
  }

  return (
    <article className="panel movements-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">HISTORIAL</span><h2>{title}</h2></div>
        {onViewAll && <button className="text-button" type="button" onClick={onViewAll}>Ver todos →</button>}
      </div>
      {visible.length === 0 ? (
        <div className="empty-state"><span>0</span><p>Aún no has añadido registros.</p></div>
      ) : (
        <div className="movement-list">
          {visible.map((movement) => {
            const meta = TYPE_META[movement.type] || TYPE_META.expense
            return (
              <div className="movement-item" key={movement.id}>
                <span className={`movement-icon ${meta.color}`}>{meta.icon}</span>
                <span><strong>{movement.description}</strong><small>{movement.dateLabel} · {meta.label} · {movement.category}</small></span>
                <span className="movement-actions">
                  <strong className={movement.type === 'income' ? 'positive' : ''}>{meta.prefix}{formatCurrency(movement.amount)}</strong>
                  {onRemove && <button type="button" onClick={() => remove(movement)} aria-label={`Eliminar ${movement.description}`}>×</button>}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}
