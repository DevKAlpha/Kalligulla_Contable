'use client'

import type { MovementDto } from '@kaligula/contracts'
import type { MovementType } from '@kaligula/domain'
import { create } from 'zustand'

export type DialogState =
  | { kind: 'movement'; type: MovementType; movement?: MovementDto }
  | { kind: 'goals' }
  | { kind: 'categories'; type: MovementType }
  | { kind: 'backup' }
  | { kind: 'profile' }
  | null

export interface ToastState {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
  action?: { label: string; run: () => void }
}

interface UiStore {
  dialog: DialogState
  toast: ToastState | null
  openMovement(type?: MovementType, movement?: MovementDto): void
  openCategories(type?: MovementType): void
  openDialog(kind: 'goals' | 'backup' | 'profile'): void
  closeDialog(): void
  notify(message: string, tone?: ToastState['tone'], action?: ToastState['action']): void
  dismissToast(id?: number): void
}

let toastSeq = 0

/** UI-only state (open dialog, toast). Server data lives in TanStack Query. */
export const useUiStore = create<UiStore>()((set, get) => ({
  dialog: null,
  toast: null,
  openMovement: (type = 'expense', movement) => set({ dialog: { kind: 'movement', type: movement?.type ?? type, movement } }),
  openCategories: (type = 'expense') => set({ dialog: { kind: 'categories', type } }),
  openDialog: (kind) => set({ dialog: { kind } }),
  closeDialog: () => set({ dialog: null }),
  notify: (message, tone = 'info', action) => {
    toastSeq += 1
    set({ toast: { id: toastSeq, message, tone, action } })
  },
  dismissToast: (id) => {
    if (id === undefined || get().toast?.id === id) set({ toast: null })
  },
}))
