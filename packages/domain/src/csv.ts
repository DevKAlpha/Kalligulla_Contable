import { isIsoDate, toIsoDate } from './dates'
import { DomainError } from './errors'
import { normalizeGoal } from './goal'
import { compareMovements, newId, normalizeDraft } from './movement'
import { toMajor, toMinor } from './money'
import { normalizeProfile } from './profile'
import { createInitialState, MOVEMENT_TYPES, type FinanceState, type Movement, type MovementType, type SavingsGoal } from './types'

const CSV_COLUMNS = [
  'record_type', 'id', 'type', 'description', 'category', 'amount', 'currency', 'occurred_on', 'note',
  'created_at', 'updated_at', 'profile_name', 'goal_name', 'goal_saved', 'goal_target',
] as const

/** Columns of the v2 backup produced by the previous Vite/JS version of Kaligula. */
const LEGACY_COLUMNS = ['record_type', 'id', 'description', 'category', 'type', 'amount', 'goal_name', 'goal_current', 'goal_target'] as const

type Row = Record<string, string>

/** Byte order mark so Excel opens the UTF-8 file with accents intact. */
const BOM = String.fromCharCode(0xfeff)

/** Prevents spreadsheet formula injection (OWASP CSV injection). */
function escapeCell(value: unknown): string {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function unescapeCell(value: string | undefined): string {
  return String(value ?? '').replace(/^'(?=[=+\-@\t\r])/, '')
}

function majorString(minor: number): string {
  return String(toMajor(minor))
}

export function exportFinanceCsv(state: FinanceState): string {
  const blank = Object.fromEntries(CSV_COLUMNS.map((column) => [column, ''])) as Record<(typeof CSV_COLUMNS)[number], string>
  const rows: Record<string, string>[] = [
    { ...blank, record_type: 'profile', profile_name: state.profile.name },
  ]
  if (state.goal) {
    rows.push({
      ...blank,
      record_type: 'goal',
      goal_name: state.goal.name,
      goal_saved: majorString(state.goal.savedMinor),
      goal_target: majorString(state.goal.targetMinor),
    })
  }
  for (const movement of state.movements) {
    rows.push({
      ...blank,
      record_type: 'movement',
      id: movement.id,
      type: movement.type,
      description: movement.description,
      category: movement.category,
      amount: majorString(movement.amountMinor),
      currency: movement.currency,
      occurred_on: movement.occurredOn,
      note: movement.note ?? '',
      created_at: movement.createdAt,
      updated_at: movement.updatedAt,
    })
  }
  const lines = [CSV_COLUMNS.join(','), ...rows.map((row) => CSV_COLUMNS.map((column) => escapeCell(row[column])).join(','))]
  return `${BOM}${lines.join('\r\n')}`
}

export function parseCsv(csvText: string): string[][] {
  const text = csvText.startsWith(BOM) ? csvText.slice(1) : csvText
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (quoted) throw new DomainError('El archivo CSV tiene una comilla sin cerrar.')
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  return rows
}

function amountToMinor(value: string, label: string): number {
  const number = Number(value)
  if (value.trim() === '' || !Number.isFinite(number)) throw new DomainError(`El valor de ${label} no es válido.`)
  return toMinor(number)
}

function toRecords(rows: string[][]): Row[] {
  const header = rows[0] ?? []
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell.trim() !== ''))
    .map((row) => Object.fromEntries(header.map((column, index) => [column, unescapeCell(row[index])])))
}

function buildMovement(record: Row, line: number, legacy: boolean, now: Date): Movement {
  const type = record.type as MovementType
  if (!MOVEMENT_TYPES.includes(type)) throw new DomainError(`Fila ${line}: tipo de registro desconocido.`)
  const createdAt = record.created_at && !Number.isNaN(Date.parse(record.created_at)) ? record.created_at : now.toISOString()
  const occurredOn = legacy
    ? toIsoDate(new Date(createdAt))
    : record.occurred_on
  if (!isIsoDate(occurredOn)) throw new DomainError(`Fila ${line}: la fecha no es válida.`)
  try {
    const draft = normalizeDraft({
      type,
      description: record.description,
      category: record.category,
      amountMinor: amountToMinor(record.amount, 'movimiento'),
      occurredOn,
      note: record.note,
    })
    const updatedAt = record.updated_at && !Number.isNaN(Date.parse(record.updated_at)) ? record.updated_at : createdAt
    return { id: record.id || newId(), currency: 'COP', ...draft, createdAt, updatedAt }
  } catch (error) {
    if (error instanceof DomainError) throw new DomainError(`Fila ${line}: ${error.message}`)
    throw error
  }
}

/**
 * Restores a backup. Accepts the current format and the v2 format of the previous version.
 * Totals in the file are ignored: they are always recomputed from the movements.
 */
export function importFinanceCsv(csvText: string, now: Date = new Date()): FinanceState {
  const rows = parseCsv(csvText)
  const header = rows[0] ?? []
  const isCurrent = CSV_COLUMNS.every((column) => header.includes(column))
  const isLegacy = !isCurrent && LEGACY_COLUMNS.every((column) => header.includes(column))
  if (!isCurrent && !isLegacy) throw new DomainError('Este CSV no corresponde a un respaldo de Kaligula.')

  const records = toRecords(rows)
  const state = createInitialState()

  const profileRecord = records.find((record) => record.record_type === (isLegacy ? 'summary' : 'profile'))
  if (profileRecord) state.profile = normalizeProfile({ name: isLegacy ? profileRecord.user_name : profileRecord.profile_name })

  const goalRecord = records.find((record) => record.record_type === 'goal')
  if (goalRecord) {
    const target = amountToMinor(goalRecord.goal_target || '0', 'objetivo de meta')
    if (target > 0) {
      const goal: SavingsGoal = {
        name: goalRecord.goal_name || 'Meta de ahorro',
        savedMinor: amountToMinor((isLegacy ? goalRecord.goal_current : goalRecord.goal_saved) || '0', 'avance de meta'),
        targetMinor: target,
      }
      state.goal = normalizeGoal(goal)
    }
  }

  const seen = new Set<string>()
  state.movements = records
    .map((record, index) => ({ record, line: index + 2 }))
    .filter(({ record }) => record.record_type === 'movement')
    .map(({ record, line }) => {
      const movement = buildMovement(record, line, isLegacy, now)
      if (seen.has(movement.id)) movement.id = newId()
      seen.add(movement.id)
      return movement
    })
    .sort(compareMovements)

  return state
}
