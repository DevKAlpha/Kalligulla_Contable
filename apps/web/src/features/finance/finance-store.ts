'use client'

import {
  addMovement, createInitialState, createMovement, LEGACY_STORAGE_KEY, migrateLegacyState, normalizeGoal,
  normalizeProfile, removeMovement, replaceMovement, reviseMovement,
  type FinanceState, type Movement, type MovementDraft, type SavingsGoal,
} from '@kaligula/domain'
import { useSyncExternalStore } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export const STORAGE_KEY = 'kaligula.finance.v3'

interface FinanceActions {
  addMovement(draft: MovementDraft): Movement
  updateMovement(id: string, draft: MovementDraft): Movement
  removeMovement(id: string): Movement | undefined
  restoreMovement(movement: Movement): void
  saveGoal(goal: SavingsGoal): void
  clearGoal(): void
  setProfileName(name: string): void
  replaceAll(state: FinanceState): void
}

export type FinanceStore = FinanceState & FinanceActions

/**
 * localStorage adapter that transparently migrates data saved by the previous version
 * (`kaligula.finance.v2`) the first time the new key is missing. The old key is kept as a backup.
 */
const storage: StateStorage = {
  getItem(name) {
    const current = localStorage.getItem(name)
    if (current !== null || name !== STORAGE_KEY) return current
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!legacy) return null
    try {
      const migrated = migrateLegacyState(JSON.parse(legacy))
      return JSON.stringify({ state: migrated, version: 3 })
    } catch {
      return null
    }
  },
  setItem: (name, value) => localStorage.setItem(name, value),
  removeItem: (name) => localStorage.removeItem(name),
}

function pickState(state: FinanceState): FinanceState {
  return { schemaVersion: 3, profile: state.profile, goal: state.goal, movements: state.movements }
}

export const useFinanceStore = create<FinanceStore>()(
  persist(
    (set, get) => ({
      ...createInitialState(),

      addMovement(draft) {
        const movement = createMovement(draft)
        set((state) => addMovement(pickState(state), movement))
        return movement
      },

      updateMovement(id, draft) {
        const existing = get().movements.find((item) => item.id === id)
        if (!existing) throw new Error('El registro ya no existe.')
        const revised = reviseMovement(existing, draft)
        set((state) => replaceMovement(pickState(state), revised))
        return revised
      },

      removeMovement(id) {
        const existing = get().movements.find((item) => item.id === id)
        set((state) => removeMovement(pickState(state), id))
        return existing
      },

      restoreMovement(movement) {
        set((state) => addMovement(pickState(state), movement))
      },

      saveGoal(goal) {
        set({ goal: normalizeGoal(goal) })
      },

      clearGoal() {
        set({ goal: null })
      },

      setProfileName(name) {
        set({ profile: normalizeProfile({ name }) })
      },

      replaceAll(next) {
        set(pickState(next))
      },
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      storage: createJSONStorage(() => storage),
      partialize: (state: FinanceStore): FinanceState => pickState(state),
      // Rehydrated by <Providers> after mount, so server and first client render match.
      skipHydration: true,
    },
  ),
)

function subscribeHydration(callback: () => void) {
  const offFinish = useFinanceStore.persist.onFinishHydration(callback)
  const offStart = useFinanceStore.persist.onHydrate(callback)
  return () => {
    offFinish()
    offStart()
  }
}

/** True once persisted data has been loaded on the client. Always false during SSR. */
export function useFinanceHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, () => useFinanceStore.persist.hasHydrated(), () => false)
}
