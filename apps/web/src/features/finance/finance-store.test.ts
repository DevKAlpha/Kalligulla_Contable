import { LEGACY_STORAGE_KEY } from '@kaligula/domain'
import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEY, useFinanceStore } from './finance-store'

const draft = { type: 'expense', description: 'Tinto', category: 'Café y snacks', amountMinor: 350_000, occurredOn: '2026-11-14' } as const

describe('finance store', () => {
  beforeEach(() => {
    useFinanceStore.setState({ schemaVersion: 3, profile: { name: '' }, goal: null, movements: [] })
    // setState persists immediately; start every test from an empty device.
    localStorage.clear()
  })

  it('adds, edits, removes and restores movements, persisting to the v3 key', () => {
    const store = useFinanceStore.getState()
    const created = store.addMovement(draft)
    store.updateMovement(created.id, { ...draft, description: 'Tinto doble' })
    expect(useFinanceStore.getState().movements[0].description).toBe('Tinto doble')

    const removed = store.removeMovement(created.id)
    expect(useFinanceStore.getState().movements).toHaveLength(0)
    store.restoreMovement(removed!)
    expect(useFinanceStore.getState().movements).toHaveLength(1)

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(persisted.state.movements[0].description).toBe('Tinto doble')
    expect(persisted.state).not.toHaveProperty('addMovement')
  })

  it('migrates data saved by the previous version on first load', async () => {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({
      user: { name: 'Nicolás' },
      goal: { name: 'Meta de ahorro', current: 0, target: 0 },
      movements: [{ id: 'old', description: 'Salario', category: 'Trabajo', type: 'income', amount: 1000, createdAt: '2026-10-01T12:00:00.000Z' }],
    }))
    await useFinanceStore.persist.rehydrate()
    const state = useFinanceStore.getState()
    expect(state.profile.name).toBe('Nicolás')
    expect(state.movements[0]).toMatchObject({ id: 'old', amountMinor: 100_000, occurredOn: '2026-10-01' })
    expect(localStorage.getItem(LEGACY_STORAGE_KEY)).not.toBeNull()
  })

  it('rejects invalid drafts with a field-specific error', () => {
    expect(() => useFinanceStore.getState().addMovement({ ...draft, amountMinor: -1 })).toThrow('mayor que cero')
  })
})
