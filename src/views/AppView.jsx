import { useEffect, useState } from 'react'
import { BrandBar } from './components/BrandBar.jsx'
import { ConsoleController } from './components/ConsoleController.jsx'
import { Navigation } from './components/Navigation.jsx'
import { DashboardView } from './pages/DashboardView.jsx'
import { FinanceModuleView } from './pages/FinanceModuleView.jsx'
import { MovementDialog } from './components/MovementDialog.jsx'
import { BackupDialog } from './components/BackupDialog.jsx'
import { GoalDialog } from './components/GoalDialog.jsx'

export function AppView({ controller }) {
  const [time, setTime] = useState('00:00')

  useEffect(() => {
    const update = () => setTime(new Intl.DateTimeFormat('es-CO', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date()))
    update()
    const timer = window.setInterval(update, 30000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <>
      <div className="ambient-grid" aria-hidden="true" />
      <main className="app-shell">
        <BrandBar time={time} onHome={() => controller.navigate('inicio')} />
        <section className="console" aria-label="Consola financiera Kaligula">
          <ConsoleController side="left" />
          <div className="screen-frame">
            <div className="screen">
              <header className="screen-topbar">
                <button className="user-chip" type="button" onClick={() => controller.notify('Perfil disponible próximamente')}>
                  <span className="avatar">{controller.data.user.initials}</span>
                  <span className="user-copy"><small>BIENVENIDO DE NUEVO</small><strong>{controller.data.user.name}</strong></span>
                </button>
                <Navigation mode="desktop" activeView={controller.activeView} onNavigate={controller.navigate} />
                <button className="backup-button" type="button" onClick={controller.openBackup} aria-label="Abrir respaldo de datos"><span>↓</span> CSV</button>
              </header>

              <div className="screen-content">
                {controller.activeView === 'inicio' ? (
                  <DashboardView controller={controller} />
                ) : (
                  <FinanceModuleView viewId={controller.activeView} controller={controller} />
                )}
              </div>
              <Navigation mode="mobile" activeView={controller.activeView} onNavigate={controller.navigate} onAdd={controller.openMovementModal} />
            </div>
          </div>
          <ConsoleController side="right" />
        </section>
        <div className="footer-spacer" aria-hidden="true" />
      </main>

      <MovementDialog key={controller.movementType} open={controller.modalOpen} defaultType={controller.movementType} onClose={controller.closeMovementModal} onSubmit={controller.addMovement} />
      <GoalDialog key={`${controller.data.goal.name}-${controller.data.goal.current}-${controller.data.goal.target}`} open={controller.goalOpen} goal={controller.data.goal} onClose={controller.closeGoal} onSubmit={controller.saveGoal} />
      <BackupDialog open={controller.backupOpen} onClose={controller.closeBackup} onExport={controller.downloadBackup} onRestore={controller.restoreBackup} />
      <div className={`toast ${controller.toast ? 'show' : ''}`} role="status" aria-live="polite">{controller.toast}</div>
    </>
  )
}
