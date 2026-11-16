'use client'

import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useEffect } from 'react'
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

  const Icon = toast ? ICONS[toast.tone] : Info
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-[calc(140px+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-10">
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
