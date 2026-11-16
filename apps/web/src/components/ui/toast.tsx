'use client'

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useUiStore } from '@/features/ui/ui-store'
import { cn } from '@/lib/cn'

const ICONS = { info: Info, success: CircleCheck, error: CircleAlert }

export function Toaster() {
  const toast = useUiStore((state) => state.toast)
  const dismiss = useUiStore((state) => state.dismissToast)

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => dismiss(toast.id), toast.action ? 6500 : 3500)
    return () => window.clearTimeout(timer)
  }, [toast, dismiss])

  // A manual popover lives in the browser's top layer, so the toast stays visible above modal dialogs.
  const layer = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = layer.current
    if (!element || typeof element.showPopover !== 'function') return
    try {
      if (element.matches(':popover-open')) element.hidePopover()
      if (toast) element.showPopover()
    } catch {
      /* popover unsupported: the fixed-position fallback still shows the toast */
    }
  }, [toast])

  const Icon = toast ? ICONS[toast.tone] : Info
  return (
    <div
      ref={layer}
      popover="manual"
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 top-auto bottom-[calc(140px+env(safe-area-inset-bottom))] z-50 m-0 flex h-auto w-full justify-center overflow-visible border-0 bg-transparent p-0 px-4 text-inherit lg:bottom-10 [&:not(:popover-open)]:hidden"
    >
      {toast && (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex max-w-md items-center gap-3 rounded-xl border-2 border-outline px-4 py-3 text-[14px] font-semibold shadow-[4px_4px_0_var(--outline)]',
            'animate-[toast-in_.2s_ease-out]',
            toast.tone === 'error' ? 'bg-loan text-white' : 'bg-accent text-on-accent',
          )}
        >
          <Icon size={18} aria-hidden className="shrink-0" />
          <span className="min-w-0">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-md border-2 border-current px-2 py-0.5 text-[13px]"
              onClick={() => {
                toast.action?.run()
                dismiss(toast.id)
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button type="button" aria-label="Cerrar aviso" onClick={() => dismiss(toast.id)} className="shrink-0 cursor-pointer opacity-70 hover:opacity-100">
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
