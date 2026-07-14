import { formatCurrency } from '../../models/financeModel.js'

export function SummaryCards({ summary }) {
  const expenseRatio = summary.income > 0 ? (summary.expenses / summary.income) * 100 : 0
  return (
    <div className="balance-grid">
      <article className="balance-card main-balance">
        <div className="card-label"><span>Saldo disponible</span><span className="live-pill">● ACTUALIZADO</span></div>
        <strong>{formatCurrency(summary.balance)}</strong>
        <div className="balance-footer"><span>Se calcula con tus ingresos y gastos registrados</span></div>
        <div className="pixel-coins" aria-hidden="true"><i /><i /><i /></div>
      </article>
      <article className="balance-card mini-card income-card">
        <div className="card-icon">↙</div><span>Ingresos</span><strong>{formatCurrency(summary.income)}</strong><small>Total registrado</small>
      </article>
      <article className="balance-card mini-card expense-card">
        <div className="card-icon">↗</div><span>Gastos</span><strong>{formatCurrency(summary.expenses)}</strong><small>{summary.income ? `${expenseRatio.toFixed(1)}% de tus ingresos` : 'Sin ingresos registrados'}</small>
      </article>
    </div>
  )
}
