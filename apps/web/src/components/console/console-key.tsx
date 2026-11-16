import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

interface KeyBaseProps {
  icon: LucideIcon
  label: string
  /** Lit LED + pressed position. */
  active?: boolean
  tone?: 'plain' | 'accent'
  shape?: 'square' | 'round'
  className?: string
  hideLabel?: boolean
}

const BASE =
  'group relative flex cursor-pointer flex-col items-center justify-center gap-1 border-2 border-outline font-mono text-[11px] font-medium tracking-[0.06em] uppercase transition-[transform,box-shadow] duration-100 select-none active:translate-y-[3px] active:shadow-[0_1px_0_var(--outline)]'

function keyClasses({ active, tone = 'plain', shape = 'square', className }: Omit<KeyBaseProps, 'icon' | 'label'>) {
  return cn(
    BASE,
    shape === 'round' ? 'rounded-full' : 'rounded-2xl',
    tone === 'accent' ? 'bg-accent text-on-accent' : active ? 'bg-shell-lo text-ink' : 'bg-shell-hi text-ink',
    active
      ? 'translate-y-[3px] shadow-[inset_0_2px_0_rgb(0_0_0/0.12),0_1px_0_var(--outline)]'
      : 'shadow-[0_4px_0_var(--outline)] hover:-translate-y-px',
    className,
  )
}

function KeyFace({ icon: Icon, label, active, hideLabel }: Pick<KeyBaseProps, 'icon' | 'label' | 'active' | 'hideLabel'>) {
  return (
    <>
      <span
        aria-hidden
        className={cn(
          'absolute top-1.5 right-1.5 size-1.5 rounded-full border border-outline/40 transition-colors',
          active ? 'bg-accent shadow-[0_0_6px_var(--accent)]' : 'bg-shell-lo',
        )}
      />
      <Icon aria-hidden className="size-5" strokeWidth={2.2} />
      <span className={cn('leading-none', hideLabel && 'sr-only')}>{label}</span>
    </>
  )
}

export function ConsoleLinkKey({ href, ...props }: KeyBaseProps & { href: string }) {
  return (
    <Link href={href} aria-current={props.active ? 'page' : undefined} className={keyClasses(props)}>
      <KeyFace {...props} />
    </Link>
  )
}

export function ConsoleButtonKey({ onClick, ...props }: KeyBaseProps & { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={keyClasses(props)} aria-label={props.hideLabel ? props.label : undefined}>
      <KeyFace {...props} />
    </button>
  )
}
