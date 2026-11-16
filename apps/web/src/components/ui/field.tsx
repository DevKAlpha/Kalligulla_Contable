import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const CONTROL =
  'w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] text-ink placeholder:text-muted transition-colors focus:border-outline focus:outline-none focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-focus aria-[invalid=true]:border-negative'

interface FieldShellProps {
  label: string
  error?: string
  hint?: ReactNode
  className?: string
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

function FieldShell({ label, error, hint, className, children }: FieldShellProps) {
  const id = useId()
  const messageId = `${id}-message`
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label htmlFor={id} className="font-mono text-[11px] font-medium tracking-[0.1em] text-ink-2 uppercase">{label}</label>
      {children({ id, describedBy: error || hint ? messageId : undefined, invalid: Boolean(error) })}
      {error ? (
        <p id={messageId} role="alert" className="text-[13px] font-medium text-negative">{error}</p>
      ) : hint ? (
        <p id={messageId} className="text-[13px] text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

type Common = { label: string; error?: string; hint?: ReactNode; wrapperClassName?: string }

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & Common>(function TextField(
  { label, error, hint, wrapperClassName, className, ...props },
  ref,
) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input ref={ref} id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(CONTROL, 'h-12', className)} {...props} />
      )}
    </FieldShell>
  )
})

export function SelectField({ label, error, hint, wrapperClassName, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Common) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(CONTROL, 'h-12 cursor-pointer', className)} {...props}>
          {children}
        </select>
      )}
    </FieldShell>
  )
}

export function TextAreaField({ label, error, hint, wrapperClassName, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & Common) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} className={cn(CONTROL, 'min-h-20 resize-y py-3', className)} {...props} />
      )}
    </FieldShell>
  )
}
