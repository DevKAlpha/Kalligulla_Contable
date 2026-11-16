'use client'

import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Eyebrow } from './panel'

interface DialogProps {
  open: boolean
  onClose: () => void
  eyebrow: string
  title: string
  children: ReactNode
  className?: string
}

/** Native <dialog> with modal focus trapping, Esc to close and click-outside to close. */
export function Dialog({ open, onClose, eyebrow, title, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // showModal() focuses the first focusable element (the close button); move focus to the field the form marks instead.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[min(480px,calc(100%-24px))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-3xl border-[3px] border-outline bg-screen p-0 text-ink shadow-[8px_8px_0_var(--outline)] backdrop:bg-transparent',
        className,
      )}
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <Eyebrow>{eyebrow}</Eyebrow>
              <h2 id={titleId} className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full border border-line bg-surface text-ink-2 hover:border-outline hover:text-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  )
}
