export function BrandBar({ time, onHome }) {
  return (
    <header className="brand-bar">
      <a className="brand" href="#inicio" aria-label="Ir al inicio de Kaligula" onClick={(event) => { event.preventDefault(); onHome() }}>
        <span className="brand-mark">K</span>
        <span><strong>KALIGULA</strong><small>POCKET FINANCE SYSTEM</small></span>
      </a>
      <div className="brand-status" aria-label="Estado del sistema">
        <span className="status-dot" />
        <span>Datos locales</span>
        <time>{time}</time>
      </div>
    </header>
  )
}
