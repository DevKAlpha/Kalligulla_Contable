import { NAVIGATION } from '../../models/financeModel.js'

export function Navigation({ mode, activeView, onNavigate, onAdd }) {
  if (mode === 'desktop') {
    return (
      <nav className="desktop-nav" aria-label="Navegación principal">
        {NAVIGATION.map((item) => (
          <button key={item.id} className={`nav-button ${activeView === item.id ? 'active' : ''}`} type="button" onClick={() => onNavigate(item.id)}>
            {item.desktopLabel ?? item.label}
          </button>
        ))}
      </nav>
    )
  }

  const buttons = NAVIGATION.map((item) => (
    <button key={item.id} className={activeView === item.id ? 'active' : ''} type="button" onClick={() => onNavigate(item.id)}>
      <span>{item.icon}</span>{item.label}
    </button>
  ))
  buttons.splice(2, 0, <button key="add" className="mobile-add" type="button" onClick={onAdd} aria-label="Nuevo movimiento">＋</button>)
  return <nav className="mobile-nav" aria-label="Navegación móvil">{buttons}</nav>
}
