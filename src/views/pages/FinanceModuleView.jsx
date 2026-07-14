import { formatCurrency, MODULES } from '../../models/financeModel.js'
import { MovementList } from '../components/MovementList.jsx'

function total(records) {
  return records.reduce((sum, record) => sum + record.amount, 0)
}

function expenseCategory(records) {
  const totals = records.reduce((categories, record) => {
    categories[record.category] = (categories[record.category] || 0) + record.amount
    return categories
  }, {})
  const [name = 'Sin registros', amount = 0] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || []
  return { name, amount }
}

export function FinanceModuleView({ viewId, controller }) {
  const module = MODULES[viewId] ?? MODULES.gastos
  const { movements } = controller.data
  const expenses = movements.filter((item) => item.type === 'expense')
  const investments = movements.filter((item) => item.type === 'investment')
  const loans = movements.filter((item) => item.type === 'loan')
  const biggestCategory = expenseCategory(expenses)

  const cardsByView = {
    gastos: [
      ['TOTAL GASTOS', formatCurrency(total(expenses)), `${expenses.length} registros guardados`],
      ['MAYOR CATEGORÍA', biggestCategory.name, formatCurrency(biggestCategory.amount)],
      ['SALDO ACTUAL', formatCurrency(controller.data.summary.balance), 'Ingresos menos gastos'],
    ],
    inversiones: [
      ['CAPITAL REGISTRADO', formatCurrency(total(investments)), 'Total de posiciones'],
      ['POSICIONES', String(investments.length), 'Inversiones activas'],
      ['ÚLTIMO APORTE', formatCurrency(investments[0]?.amount || 0), investments[0]?.description || 'Sin registros'],
    ],
    prestamos: [
      ['SALDO REGISTRADO', formatCurrency(total(loans)), 'Total bajo seguimiento'],
      ['OBLIGACIONES', String(loans.length), 'Préstamos registrados'],
      ['ÚLTIMO PRÉSTAMO', formatCurrency(loans[0]?.amount || 0), loans[0]?.description || 'Sin registros'],
    ],
  }
  const cards = cardsByView[viewId] ?? cardsByView.gastos

  const list = viewId === 'gastos'
    ? movements.filter((item) => ['income', 'expense'].includes(item.type))
    : viewId === 'inversiones' ? investments : loans

  return (
    <section className="view active placeholder-view" aria-labelledby={`${viewId}-title`}>
      <div className={`placeholder-top ${module.theme}`}>
        <span className="eyebrow">MÓDULO {module.number}</span>
        <h1 id={`${viewId}-title`}>{module.title}</h1>
        <p>{module.description}</p>
      </div>
      <div className="module-cards">
        {cards.map(([label, value, description]) => (
          <article key={label}><span>{label}</span><strong>{value}</strong><small>{description}</small></article>
        ))}
      </div>
      <div className="coming-panel">
        <span className="big-pixel">{module.number}</span>
        <div><h2>{module.heading}</h2><p>{module.copy}</p></div>
        <button className="primary-button" type="button" onClick={() => controller.openMovementModal(module.entryType)}>＋ {module.action}</button>
      </div>
      <div className="module-history">
        <MovementList movements={list} limit={null} onRemove={controller.removeMovement} title={viewId === 'gastos' ? 'Ingresos y gastos' : `Historial de ${module.title.toLowerCase()}`} />
      </div>
    </section>
  )
}
