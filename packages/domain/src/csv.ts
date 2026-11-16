import { isIsoDate, toIsoDate } from './dates'
import { DomainError } from './errors'
import { toMajor, toMinor } from './money'
import { normalizeSnapshot } from './snapshot'
import { emptySnapshot, MOVEMENT_TYPES, type FinanceSnapshot, type MovementType } from './types'

/** Backup columns. v3 files (previous Next.js version) are the same minus `goal_target_date`. */
const CSV_COLUMNS = [
  'record_type', 'id', 'type', 'description', 'category', 'amount', 'currency', 'occurred_on', 'note',
  'created_at', 'updated_at', 'profile_name', 'goal_name', 'goal_saved', 'goal_target', 'goal_target_date',
] as const
const REQUIRED_CURRENT_COLUMNS = CSV_COLUMNS.filter((column) => column !== 'goal_target_date')

/** Columns of the v2 backup produced by the original Vite/JS version of Kaligula. */
const LEGACY_COLUMNS = ['record_type', 'id', 'description', 'category', 'type', 'amount', 'goal_name', 'goal_current', 'goal_target'] as const

type Column = (typeof CSV_COLUMNS)[number]
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

export function exportSnapshotCsv(snapshot: FinanceSnapshot): string {
  const blank = Object.fromEntries(CSV_COLUMNS.map((column) => [column, ''])) as Record<Column, string>
  const rows: Record<Column, string>[] = [{ ...blank, record_type: 'profile', profile_name: snapshot.profile.name }]
  for (const category of snapshot.categories) {
    rows.push({ ...blank, record_type: 'category', type: category.type, category: category.name })
  }
  for (const goal of snapshot.goals) {
    rows.push({
      ...blank,
      record_type: 'goal',
      id: goal.id ?? '',
      goal_name: goal.name,
      goal_saved: majorString(goal.savedMinor),
      goal_target: majorString(goal.targetMinor),
      goal_target_date: goal.targetDate ?? '',
    })
  }
  for (const movement of snapshot.movements) {
    rows.push({
      ...blank,
      record_type: 'movement',
      id: movement.id ?? '',
      type: movement.type,
      description: movement.description,
      category: movement.category,
      amount: majorString(movement.amountMinor),
      currency: 'COP',
      occurred_on: movement.occurredOn,
      note: movement.note ?? '',
      created_at: movement.createdAt ?? '',
      updated_at: movement.updatedAt ?? '',
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

function amountToMinor(value: string | undefined, label: string): number {
  const text = (value ?? '').trim()
  const number = Number(text)
  if (text === '' || !Number.isFinite(number)) throw new DomainError(`El valor de ${label} no es válido.`)
  return toMinor(number)
}

function toRecords(rows: string[][]): { record: Row; line: number }[] {
  const header = rows[0] ?? []
  return rows.slice(1)
    .map((row, index) => ({ row, line: index + 2 }))
    .filter(({ row }) => row.some((cell) => cell.trim() !== ''))
    .map(({ row, line }) => ({ record: Object.fromEntries(header.map((column, index) => [column, unescapeCell(row[index])])), line }))
}

function rowError(line: number, run: () => void) {
  try {
    run()
  } catch (error) {
    if (error instanceof DomainError) throw new DomainError(`Fila ${line}: ${error.message}`)
    throw error
  }
}

/**
 * Reads a backup into a validated snapshot. Accepts the current format and both previous ones (v3 and v2).
 * Totals stored in old files are ignored: they are always recomputed from the movements.
 */
export function importSnapshotCsv(csvText: string, now: Date = new Date()): FinanceSnapshot {
  const rows = parseCsv(csvText)
  const header = rows[0] ?? []
  const isCurrent = REQUIRED_CURRENT_COLUMNS.every((column) => header.includes(column))
  const isLegacy = !isCurrent && LEGACY_COLUMNS.every((column) => header.includes(column))
  if (!isCurrent && !isLegacy) throw new DomainError('Este CSV no corresponde a un respaldo de Kaligula.')

  const snapshot = emptySnapshot()
  for (const { record, line } of toRecords(rows)) {
    rowError(line, () => {
      switch (record.record_type) {
        case 'profile':
        case 'summary': // v2
          snapshot.profile = { name: (isLegacy ? record.user_name : record.profile_name) ?? '' }
          break
        case 'category':
          snapshot.categories.push({ type: record.type as MovementType, name: record.category })
          break
        case 'goal': {
          const targetMinor = amountToMinor(record.goal_target || '0', 'objetivo de meta')
          if (targetMinor <= 0) break // v2 always wrote an empty goal row
          snapshot.goals.push({
            id: record.id || undefined,
            name: record.goal_name || 'Meta de ahorro',
            savedMinor: amountToMinor((isLegacy ? record.goal_current : record.goal_saved) || '0', 'avance de meta'),
            targetMinor,
            targetDate: record.goal_target_date || null,
          })
          break
        }
        case 'movement': {
          const type = record.type as MovementType
          if (!MOVEMENT_TYPES.includes(type)) throw new DomainError('tipo de registro desconocido.')
          const hasCreatedAt = Boolean(record.created_at) && !Number.isNaN(Date.parse(record.created_at))
          // v2 files have no occurrence date: the creation time is the only date available.
          const createdAt = hasCreatedAt ? record.created_at : isLegacy ? now.toISOString() : undefined
          const occurredOn = isLegacy ? toIsoDate(new Date(createdAt!)) : record.occurred_on
          if (!isIsoDate(occurredOn)) throw new DomainError('la fecha no es válida.')
          snapshot.movements.push({
            id: record.id || undefined,
            type,
            description: record.description,
            category: record.category,
            amountMinor: amountToMinor(record.amount, 'movimiento'),
            occurredOn,
            note: record.note || null,
            createdAt,
            updatedAt: record.updated_at || createdAt,
          })
          break
        }
        default:
          break
      }
    })
  }
  return normalizeSnapshot(snapshot)
}
