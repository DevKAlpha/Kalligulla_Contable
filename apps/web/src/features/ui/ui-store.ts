'use client'

import type { MovementType } from '@kaligula/domain'
import { create } from 'zustand'

export type DialogState =
  | { kind: 'movement'; type: MovementType; movementId?: string }
  | { kind: 'goal' }
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
  openMovement(type?: MovementType, movementId?: string): void
  openDialog(kind: 'goal' | 'backup' | 'profile'): void
  closeDialog(): void
  notify(message: string, tone?: ToastState['tone'], action?: ToastState['action']): void
  dismissToast(id?: number): void
}

let toastSeq = 0

export const useUiStore = create<UiStore>()((set, get) => ({
  dialog: null,
  toast: null,
  openMovement: (type = 'expense', movementId) => set({ dialog: { kind: 'movement', type, movementId } }),
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
