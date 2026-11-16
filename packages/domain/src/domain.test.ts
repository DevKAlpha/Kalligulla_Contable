import { describe, expect, it } from 'vitest'
import {
  buildOverview, categoryKey, DomainError, emptySnapshot, exportSnapshotCsv, formatMoney, goalProgress, importSnapshotCsv,
  initials, isDefaultCategory, isIsoDate, normalizeCategoryName, normalizeDraft, normalizeGoal, normalizeSnapshot,
  overviewWindowStart, parseMajorInput, snapshotFromLocalStorage, type FinanceSnapshot, type Movement, type MovementDraft,
} from './index'

const NOW = new Date(2026, 10, 15, 12, 0, 0)
const CATEGORY_ID = '0b0c0d0e-1111-4222-8333-444455556666'

function draft(overrides: Partial<MovementDraft> = {}): MovementDraft {
  return { type: 'expense', description: 'Mercado', categoryId: CATEGORY_ID, amountMinor: 5_000_000, occurredOn: '2026-11-10', ...overrides }
}

describe('money', () => {
  it('parses Colombian-formatted input into minor units', () => {
    expect(parseMajorInput('12500')).toBe(1_250_000)
    expect(parseMajorInput('12.500')).toBe(1_250_000)
    expect(parseMajorInput('1.250.000')).toBe(125_000_000)
    expect(parseMajorInput('12.500,50')).toBe(1_250_050)
    expect(parseMajorInput('12500.5')).toBe(1_250_050)
    expect(parseMajorInput('$ 3.000')).toBe(300_000)
  })

  it('rejects malformed input', () => {
    expect(parseMajorInput('')).toBeNull()
    expect(parseMajorInput('abc')).toBeNull()
    expect(parseMajorInput('-500')).toBeNull()
    expect(parseMajorInput('1,2,3')).toBeNull()
  })

  it('formats pesos without trailing decimals', () => {
    expect(formatMoney(1_250_000).replace(/\s/g, ' ')).toBe('$ 12.500')
  })
})

describe('movement drafts', () => {
  it('normalizes text and empty notes', () => {
    expect(normalizeDraft(draft({ description: '  Mercado   semanal ', note: '  ' }))).toMatchObject({ description: 'Mercado semanal', note: null })
  })

  it('reports the offending field', () => {
    const fieldOf = (overrides: Partial<MovementDraft>) => {
      try {
        normalizeDraft(draft(overrides))
      } catch (error) {
        return (error as DomainError).field
      }
      return undefined
    }
    expect(fieldOf({ description: '  ' })).toBe('description')
    expect(fieldOf({ amountMinor: 0 })).toBe('amount')
    expect(fieldOf({ amountMinor: 1.5 })).toBe('amount')
    expect(fieldOf({ occurredOn: '2026-02-30' })).toBe('occurredOn')
    expect(fieldOf({ categoryId: '' })).toBe('categoryId')
  })
})

describe('categories', () => {
  it('normalizes names and compares case-insensitively', () => {
    expect(normalizeCategoryName('  Mascotas   y  vet ')).toBe('Mascotas y vet')
    expect(() => normalizeCategoryName(' ')).toThrow(DomainError)
    expect(categoryKey('expense', 'Hogar')).toBe(categoryKey('expense', ' hogar '))
    expect(isDefaultCategory({ type: 'expense', name: 'hogar' })).toBe(true)
    expect(isDefaultCategory({ type: 'expense', name: 'Mascotas' })).toBe(false)
  })
})

describe('overview', () => {
  const recent: Pick<Movement, 'type' | 'amountMinor' | 'occurredOn' | 'category'>[] = [
    { type: 'income', category: 'Salario', amountMinor: 400_000_000, occurredOn: '2026-11-01' },
    { type: 'expense', category: 'Alimentación', amountMinor: 100_000_000, occurredOn: '2026-11-05' },
    { type: 'income', category: 'Salario', amountMinor: 300_000_000, occurredOn: '2026-10-01' },
    { type: 'expense', category: 'Hogar', amountMinor: 200_000_000, occurredOn: '2026-10-08' },
  ]

  it('derives every figure from the movements', () => {
    const overview = buildOverview({
      totals: { income: 900_000_000, expense: 300_000_000, investment: 50_000_000, loan: 0 },
      counts: { income: 3, expense: 2, investment: 1, loan: 0 },
      recent,
      reference: NOW,
    })
    expect(overview.balanceMinor).toBe(600_000_000)
    expect(overview.currentMonth).toEqual({ incomeMinor: 400_000_000, expenseMinor: 100_000_000, netMinor: 300_000_000 })
    expect(overview.monthlyChangePct).toBe(200)
    expect(overview.expenseRatioPct).toBe(25)
    expect(overview.cashFlow.map((month) => month.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(overview.expenseBreakdown).toEqual([{ category: 'Alimentación', amountMinor: 100_000_000, count: 1, sharePct: 100 }])
  })

  it('computes the window start', () => {
    expect(overviewWindowStart(6, NOW)).toBe('2026-06-01')
  })
})

describe('goals', () => {
  it('validates drafts', () => {
    expect(normalizeGoal({ name: ' Viaje ', savedMinor: 0, targetMinor: 100, targetDate: '' })).toEqual({ name: 'Viaje', savedMinor: 0, targetMinor: 100, targetDate: null })
    expect(() => normalizeGoal({ name: 'x', savedMinor: -1, targetMinor: 100 })).toThrow(DomainError)
    expect(() => normalizeGoal({ name: 'x', savedMinor: 0, targetMinor: 100, targetDate: '2026-13-01' })).toThrow('fecha')
  })

  it('suggests a monthly contribution towards the target date', () => {
    const progress = goalProgress({ savedMinor: 20_000, targetMinor: 100_000, targetDate: '2027-02-28' }, NOW)
    expect(progress).toMatchObject({ pct: 20, remainingMinor: 80_000, monthsLeft: 4, suggestedMonthlyMinor: 20_000, done: false, overdue: false })
    expect(goalProgress({ savedMinor: 0, targetMinor: 100, targetDate: '2026-01-31' }, NOW).overdue).toBe(true)
    expect(goalProgress(null).pct).toBe(0)
  })

  it('builds initials', () => {
    expect(initials('Nicolás Rodríguez')).toBe('NR')
    expect(initials('')).toBe('K')
  })
})

describe('snapshots and csv backups', () => {
  const snapshot: FinanceSnapshot = {
    ...emptySnapshot(),
    profile: { name: 'Ana' },
    categories: [{ type: 'expense', name: 'Mascotas' }],
    goals: [{ id: '11111111-2222-4333-8444-555555555555', name: 'Viaje', savedMinor: 10_000, targetMinor: 90_000, targetDate: '2027-01-31' }],
    movements: [
      { id: '99999999-2222-4333-8444-555555555555', type: 'expense', description: '=HYPERLINK("x")', category: 'Mascotas', amountMinor: 350_050, occurredOn: '2026-11-14', note: 'pago "parcial", efectivo', createdAt: '2026-11-14T12:00:00.000Z', updatedAt: '2026-11-14T12:00:00.000Z' },
      { type: 'income', description: 'Salario', category: 'Salario', amountMinor: 400_000_000, occurredOn: '2026-11-01', note: null },
    ],
  }

  it('normalizes snapshots, dropping non-UUID ids and listing only custom categories', () => {
    const clean = normalizeSnapshot({ ...snapshot, movements: [...snapshot.movements, { ...snapshot.movements[1], id: 'm-123', category: 'Nueva' }] })
    expect(clean.movements.map((movement) => movement.id)).toEqual(['99999999-2222-4333-8444-555555555555', undefined, undefined])
    expect(clean.categories).toEqual([{ type: 'expense', name: 'Mascotas' }, { type: 'income', name: 'Nueva' }])
  })

  it('round-trips through CSV and neutralizes formulas', () => {
    const csv = exportSnapshotCsv(normalizeSnapshot(snapshot))
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(importSnapshotCsv(csv, NOW)).toEqual(normalizeSnapshot(snapshot))
  })

  it('imports the v3 backup of the first Next.js version', () => {
    const v3 = [
      'record_type,id,type,description,category,amount,currency,occurred_on,note,created_at,updated_at,profile_name,goal_name,goal_saved,goal_target',
      '"profile","","","","","","","","","","","Ana","","",""',
      '"goal","","","","","","","","","","","","Fondo","100","1000"',
      '"movement","x1","expense","Tinto","Café y snacks","3500","COP","2026-11-12","","2026-11-12T15:00:00.000Z","2026-11-12T15:00:00.000Z","","","",""',
    ].join('\r\n')
    const result = importSnapshotCsv(v3, NOW)
    expect(result.goals[0]).toMatchObject({ name: 'Fondo', savedMinor: 10_000, targetMinor: 100_000, targetDate: null })
    expect(result.movements[0]).toMatchObject({ id: undefined, amountMinor: 350_000, occurredOn: '2026-11-12', category: 'Café y snacks' })
  })

  it('imports the v2 backup of the original version and ignores stored totals', () => {
    const legacy = [
      'record_type,id,description,category,type,amount,date_label,balance,income,expenses,monthly_change,goal_name,goal_current,goal_target,user_name,user_initials,created_at',
      '"summary","","","","","","","999","999","0","0","","","","Nicolás","NC",""',
      '"goal","","","","","","","","","","","Meta de ahorro","0","0","","",""',
      '"movement","a1","Café","Ocio","expense","3500","10 nov","","","","","","","","","","2026-11-10T15:00:00.000Z"',
    ].join('\r\n')
    const result = importSnapshotCsv(legacy, NOW)
    expect(result.profile.name).toBe('Nicolás')
    expect(result.goals).toEqual([])
    expect(result.movements[0]).toMatchObject({ amountMinor: 350_000, occurredOn: '2026-11-10', category: 'Ocio' })
  })

  it('reports the failing row', () => {
    const bad = exportSnapshotCsv(normalizeSnapshot(snapshot)).replace('"2026-11-14"', '"2026-02-30"')
    expect(() => importSnapshotCsv(bad)).toThrow(/Fila \d+/)
    expect(() => importSnapshotCsv('a,b\n1,2')).toThrow('no corresponde')
  })
})

describe('browser data from earlier versions', () => {
  it('converts the v3 store (cents, dates) into a snapshot', () => {
    const v3 = JSON.stringify({
      state: {
        schemaVersion: 3, profile: { name: 'Nicolás' }, goal: { name: 'Fondo', savedMinor: 100, targetMinor: 1000 },
        movements: [{ id: 'old', type: 'expense', description: 'Rappi', category: 'Domicilios', amountMinor: 5_600_000, currency: 'COP', occurredOn: '2026-11-13', createdAt: '2026-11-13T12:00:00.000Z', updatedAt: '2026-11-13T12:00:00.000Z' }],
      },
      version: 3,
    })
    const snapshot = snapshotFromLocalStorage({ v3 }, NOW)!
    expect(snapshot.profile.name).toBe('Nicolás')
    expect(snapshot.goals).toHaveLength(1)
    expect(snapshot.movements[0]).toMatchObject({ amountMinor: 5_600_000, occurredOn: '2026-11-13', category: 'Domicilios' })
  })

  it('converts the v2 store (pesos, no dates) and skips invalid rows', () => {
    const v2 = JSON.stringify({
      user: { name: 'Nicolás' },
      goal: { name: 'Meta de ahorro', current: 0, target: 0 },
      movements: [
        { id: 'x', description: 'Salario', category: 'Trabajo', type: 'income', amount: 2000000, createdAt: '2026-11-01T12:00:00.000Z' },
        { id: 'y', description: '', type: 'expense', amount: 10 },
      ],
    })
    const snapshot = snapshotFromLocalStorage({ v2 }, NOW)!
    expect(snapshot.goals).toEqual([])
    expect(snapshot.movements).toHaveLength(1)
    expect(snapshot.movements[0]).toMatchObject({ amountMinor: 200_000_000, occurredOn: '2026-11-01' })
    expect(isIsoDate(snapshot.movements[0].occurredOn)).toBe(true)
    expect(snapshot.categories).toEqual([{ type: 'income', name: 'Trabajo' }])
  })

  it('returns null when there is nothing to import', () => {
    expect(snapshotFromLocalStorage({})).toBeNull()
    expect(snapshotFromLocalStorage({ v2: '{broken' })).toBeNull()
    expect(snapshotFromLocalStorage({ v2: JSON.stringify({ movements: [] }) })).toBeNull()
  })
})
