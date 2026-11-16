import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary:
    'border-2 border-outline bg-accent text-on-accent shadow-[3px_3px_0_var(--outline)] hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_var(--outline)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
  secondary:
    'border-2 border-outline bg-surface text-ink shadow-[3px_3px_0_var(--outline)] hover:bg-surface-2 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
  ghost: 'border border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger:
    'border-2 border-outline bg-loan text-white shadow-[3px_3px_0_var(--outline)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-11 gap-2 rounded-xl px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center font-semibold whitespace-nowrap transition-[transform,box-shadow,background-color] duration-100 select-none disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
})

export function IconButton({ className, label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:border-outline hover:text-ink',
        className,
      )}
      {...props}
    />
  )
}
