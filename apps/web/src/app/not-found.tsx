import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="grid min-h-full place-items-center px-6 py-16 text-center">
      <div>
        <p className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase">Error 404 · Cartucho no encontrado</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Esta pantalla no existe.</h1>
        <Link
          href="/"
          className="mt-6 inline-flex h-11 items-center rounded-xl border-2 border-outline bg-accent px-4 text-sm font-semibold text-on-accent shadow-[3px_3px_0_var(--outline)]"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
