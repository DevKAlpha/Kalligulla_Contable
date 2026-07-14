import { formatCurrency } from '../../models/financeModel.js'

export function SavingsGoal({ goal, progress, onEdit, onClear }) {
  return (
    <article className="panel goals-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">META ACTIVA</span><h2>{goal.name}</h2></div>
        <button className="goal-icon" type="button" onClick={onEdit} aria-label="Configurar meta">{goal.target ? '✎' : '+'}</button>
      </div>
      <div className="goal-amount"><strong>{formatCurrency(goal.current)}</strong><span>de {formatCurrency(goal.target)}</span></div>
      <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      <div className="goal-footer"><span>{progress.toFixed(1)}% completado</span><span>Faltan {formatCurrency(Math.max(0, goal.target - goal.current))}</span></div>
      {goal.target > 0 && <button className="clear-goal" type="button" onClick={onClear}>Quitar meta</button>}
    </article>
  )
}
