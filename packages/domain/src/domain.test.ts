import { describe, expect, it } from 'vitest'
import {
  addMovement, buildCashFlow, categoryBreakdown, createInitialState, createMovement, deriveSummary, DomainError,
  exportFinanceCsv, formatMoney, goalProgress, importFinanceCsv, initials, isIsoDate, migrateLegacyState,
  parseMajorInput, removeMovement, replaceMovement, reviseMovement, type FinanceState, type MovementDraft,
} from './index'

const NOW = new Date(2026, 10, 15, 12, 0, 0)

function draft(overrides: Partial<MovementDraft> = {}): MovementDraft {
  return { type: 'expense', description: 'Mercado', category: 'Alimentación', amountMinor: 5_000_000, occurredOn: '2026-11-10', ...overrides }
}

function stateWith(...drafts: MovementDraft[]): FinanceState {
  return drafts.reduce((state, item, index) => addMovement(state, createMovement(item, NOW, `id-${index}`)), createInitialState())
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

describe('movements', () => {
  it('validates drafts and reports the field', () => {
    expect(() => createMovement(draft({ description: '  ' }))).toThrowError(DomainError)
    try {
      createMovement(draft({ amountMinor: 0 }))
    } catch (error) {
      expect((error as DomainError).field).toBe('amount')
    }
    expect(() => createMovement(draft({ occurredOn: '2026-02-30' }))).toThrow('fecha')
  })

  it('keeps movements sorted newest first and supports edit and delete', () => {
    let state = stateWith(draft({ occurredOn: '2026-11-01' }), draft({ occurredOn: '2026-11-12' }))
    expect(state.movements.map((m) => m.occurredOn)).toEqual(['2026-11-12', '2026-11-01'])

    const edited = reviseMovement(state.movements[1], draft({ description: 'Arriendo', occurredOn: '2026-11-14' }), NOW)
    state = replaceMovement(state, edited)
    expect(state.movements[0].description).toBe('Arriendo')
    expect(state.movements[0].createdAt).toBe(edited.createdAt)

    state = removeMovement(state, edited.id)
    expect(state.movements).toHaveLength(1)
  })
})

describe('analytics', () => {
  const state = stateWith(
    draft({ type: 'income', category: 'Salario', amountMinor: 400_000_000, occurredOn: '2026-11-01' }),
    draft({ amountMinor: 100_000_000, occurredOn: '2026-11-05' }),
    draft({ type: 'income', category: 'Salario', amountMinor: 300_000_000, occurredOn: '2026-10-01' }),
    draft({ amountMinor: 200_000_000, category: 'Hogar', occurredOn: '2026-10-08' }),
    draft({ type: 'investment', category: 'ETF', amountMinor: 50_000_000, occurredOn: '2026-11-03' }),
  )

  it('derives every total from the movements', () => {
    const summary = deriveSummary(state.movements, NOW)
    expect(summary.balanceMinor).toBe(400_000_000)
    expect(summary.totals.investment).toBe(50_000_000)
    expect(summary.currentMonth).toEqual({ incomeMinor: 400_000_000, expenseMinor: 100_000_000, netMinor: 300_000_000 })
    expect(summary.monthlyChangePct).toBe(200)
    expect(summary.expenseRatioPct).toBe(25)
  })

  it('builds a six month cash flow ending in the reference month', () => {
    const flow = buildCashFlow(state.movements, 6, NOW)
    expect(flow.map((m) => m.key)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(flow.at(-1)).toMatchObject({ incomeMinor: 400_000_000, expenseMinor: 100_000_000 })
  })

  it('ranks expense categories', () => {
    const breakdown = categoryBreakdown(state.movements)
    expect(breakdown[0]).toMatchObject({ category: 'Hogar', sharePct: (2 / 3) * 100 })
  })
})

describe('goal and profile', () => {
  it('computes progress', () => {
    expect(goalProgress({ name: 'Fondo', savedMinor: 25, targetMinor: 100 })).toEqual({ pct: 25, remainingMinor: 75, done: false })
    expect(goalProgress(null).pct).toBe(0)
  })

  it('builds initials', () => {
    expect(initials('Nicolás Rodríguez')).toBe('NR')
    expect(initials('')).toBe('K')
  })
})

describe('csv backup', () => {
  it('round-trips the full state and neutralizes formulas', () => {
    const state = stateWith(draft({ description: '=HYPERLINK("x")', note: 'pago "parcial", efectivo' }))
    state.goal = { name: 'Viaje', savedMinor: 10_000, targetMinor: 90_000 }
    state.profile = { name: 'Ana' }
    const csv = exportFinanceCsv(state)
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(importFinanceCsv(csv, NOW)).toEqual(state)
  })

  it('imports the v2 backup of the previous version and ignores stored totals', () => {
    const legacy = [
      'record_type,id,description,category,type,amount,date_label,balance,income,expenses,monthly_change,goal_name,goal_current,goal_target,user_name,user_initials,created_at',
      '"summary","","","","","","","999","999","0","0","","","","Nicolás","NC",""',
      '"goal","","","","","","","","","","","Fondo","100","1000","","",""',
      '"movement","a1","Café","Ocio","expense","3500","10 nov","","","","","","","","","","2026-11-10T15:00:00.000Z"',
    ].join('\r\n')
    const state = importFinanceCsv(legacy, NOW)
    expect(state.profile.name).toBe('Nicolás')
    expect(state.goal).toEqual({ name: 'Fondo', savedMinor: 10_000, targetMinor: 100_000 })
    expect(state.movements[0]).toMatchObject({ id: 'a1', amountMinor: 350_000, occurredOn: '2026-11-10' })
    expect(deriveSummary(state.movements, NOW).balanceMinor).toBe(-350_000)
  })

  it('rejects foreign files', () => {
    expect(() => importFinanceCsv('a,b\n1,2')).toThrow('no corresponde')
  })
})

describe('legacy localStorage migration', () => {
  it('converts v2 data and skips invalid rows', () => {
    const state = migrateLegacyState({
      user: { name: 'Nicolás' },
      goal: { name: 'Meta de ahorro', current: 0, target: 0 },
      movements: [
        { id: 'x', description: 'Salario', category: 'Trabajo', type: 'income', amount: 2000000, createdAt: '2026-11-01T12:00:00.000Z' },
        { id: 'y', description: '', type: 'expense', amount: 10 },
      ],
    }, NOW)
    expect(state.goal).toBeNull()
    expect(state.movements).toHaveLength(1)
    expect(state.movements[0]).toMatchObject({ amountMinor: 200_000_000, occurredOn: '2026-11-01' })
    expect(isIsoDate(state.movements[0].occurredOn)).toBe(true)
  })
})
