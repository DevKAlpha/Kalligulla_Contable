import { cn } from '@/lib/cn'

/** Tiny trend line (no axes). Decorative: the row next to it states the numbers. */
export function Sparkline({ values, className }: { values: readonly number[]; className?: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${100 - ((value - min) / span) * 100}`).join(' ')
  const lastY = 100 - ((values[values.length - 1] - min) / span) * 100
  return (
    <svg viewBox="-4 -8 108 116" preserveAspectRatio="none" aria-hidden className={cn('h-7 w-20 overflow-visible', className)}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={100} cy={lastY} r={3.5} fill="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
