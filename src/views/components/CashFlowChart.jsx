import { formatCurrency } from '../../models/financeModel.js'

export function CashFlowChart({ cashFlow }) {
  const hasData = cashFlow.some((item) => item.incomeValue || item.expenseValue)
  return (
    <article className="panel chart-panel">
      <div className="panel-heading">
        <div><span className="eyebrow">FLUJO DE DINERO</span><h2>Últimos 6 meses</h2></div>
        <div className="chart-legend"><span className="income-dot" /> Ingresos <span className="expense-dot" /> Gastos</div>
      </div>
      <div className={`bar-chart ${hasData ? '' : 'empty'}`} aria-label="Gráfico de ingresos y gastos de los últimos seis meses">
        {!hasData && <span className="chart-empty">Añade tu primer movimiento</span>}
        {cashFlow.map((item, index) => (
          <div className={`chart-item ${index === cashFlow.length - 1 ? 'active' : ''}`} key={item.key} title={`Ingresos ${formatCurrency(item.incomeValue)} · Gastos ${formatCurrency(item.expenseValue)}`}>
            <div><i style={{ '--h': `${item.income}%` }} /><b style={{ '--h': `${item.expense}%` }} /></div><span>{item.month}</span>
          </div>
        ))}
      </div>
    </article>
  )
}
