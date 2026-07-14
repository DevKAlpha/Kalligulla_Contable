import { SummaryCards } from '../components/SummaryCards.jsx'
import { CashFlowChart } from '../components/CashFlowChart.jsx'
import { SavingsGoal } from '../components/SavingsGoal.jsx'
import { MovementList } from '../components/MovementList.jsx'

export function DashboardView({ controller }) {
  const { data } = controller
  const period = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()
  return (
    <section className="view active" aria-labelledby="inicio-title">
      <div className="section-heading">
        <div><span className="eyebrow">RESUMEN / {period}</span><h1 id="inicio-title">Tu dinero,<br /><em>bajo control.</em></h1></div>
        <button className="primary-button" type="button" onClick={() => controller.openMovementModal('expense')}><span>＋</span> Nuevo registro</button>
      </div>
      <SummaryCards summary={data.summary} />
      <div className="dashboard-grid">
        <CashFlowChart cashFlow={controller.cashFlow} />
        <SavingsGoal goal={data.goal} progress={controller.goalProgress} onEdit={controller.openGoal} onClear={controller.clearGoal} />
        <MovementList movements={data.movements} onViewAll={() => controller.navigate('gastos')} onRemove={controller.removeMovement} />
      </div>
    </section>
  )
}
