const STORAGE_KEY = 'kaligula.finance.v2'
const CSV_COLUMNS = [
  'record_type', 'id', 'description', 'category', 'type', 'amount', 'date_label',
  'balance', 'income', 'expenses', 'monthly_change', 'goal_name', 'goal_current',
  'goal_target', 'user_name', 'user_initials', 'created_at',
]
const ENTRY_TYPES = ['income', 'expense', 'investment', 'loan']

export const NAVIGATION = [
  { id: 'inicio', label: 'Inicio', icon: '⌂' },
  { id: 'gastos', label: 'Gastos', icon: '↗' },
  { id: 'inversiones', label: 'Inversión', desktopLabel: 'Inversiones', icon: '◆' },
  { id: 'prestamos', label: 'Préstamos', icon: '▤' },
]

export const INITIAL_FINANCE_DATA = {
  user: { name: 'Nicolás', initials: 'NC' },
  summary: { balance: 0, income: 0, expenses: 0, monthlyChange: 0 },
  goal: { name: 'Meta de ahorro', current: 0, target: 0 },
  movements: [],
}

export const MODULES = {
  gastos: {
    number: '02', title: 'Gastos', theme: 'expense-theme', entryType: 'expense',
    description: 'Registra ingresos y gastos para entender el movimiento real de tu dinero.',
    heading: 'Tu historial financiero comienza aquí.',
    copy: 'Añade un movimiento y los totales se actualizarán automáticamente.',
    action: 'Registrar gasto',
  },
  inversiones: {
    number: '03', title: 'Inversiones', theme: 'investment-theme', entryType: 'investment',
    description: 'Registra el capital que destinas a cada inversión y consulta tus posiciones.',
    heading: 'Construye tu portafolio desde cero.',
    copy: 'Cada inversión que agregues aparecerá en este módulo y en tu historial reciente.',
    action: 'Añadir inversión',
  },
  prestamos: {
    number: '04', title: 'Préstamos', theme: 'loan-theme', entryType: 'loan',
    description: 'Registra las obligaciones que necesitas controlar y elimina las que hayas cerrado.',
    heading: 'Mantén todas tus obligaciones visibles.',
    copy: 'Añade cada préstamo para conocer el saldo total que estás siguiendo.',
    action: 'Añadir préstamo',
  },
}

export function formatCurrency(value) {
  return `$ ${Number(value || 0).toLocaleString('es-CO')}`
}

export function createMovement(formData) {
  const amount = Number(formData.amount)
  const type = ENTRY_TYPES.includes(formData.type) ? formData.type : 'expense'
  if (!formData.description?.trim() || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Completa la descripción y escribe un valor válido.')
  }
  const now = new Date()
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}`,
    description: formData.description.trim(),
    category: formData.category || 'Otro',
    type,
    amount,
    dateLabel: new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' }).format(now),
    createdAt: now.toISOString(),
  }
}

function updateSummary(summary, movement, direction) {
  const amount = movement.amount * direction
  if (movement.type === 'income') {
    return { ...summary, balance: summary.balance + amount, income: Math.max(0, summary.income + amount) }
  }
  if (movement.type === 'expense') {
    return { ...summary, balance: summary.balance - amount, expenses: Math.max(0, summary.expenses + amount) }
  }
  return summary
}

export function addMovementToFinanceData(data, movement) {
  return {
    ...data,
    summary: updateSummary(data.summary, movement, 1),
    movements: [movement, ...data.movements],
  }
}

export function removeMovementFromFinanceData(data, movementId) {
  const movement = data.movements.find((item) => item.id === movementId)
  if (!movement) return data
  return {
    ...data,
    summary: updateSummary(data.summary, movement, -1),
    movements: data.movements.filter((item) => item.id !== movementId),
  }
}

export function buildCashFlow(movements, referenceDate = new Date()) {
  const months = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (5 - offset), 1)
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      month: new Intl.DateTimeFormat('es-CO', { month: 'short' }).format(date).replace('.', '').toUpperCase(),
      incomeValue: 0,
      expenseValue: 0,
    }
  })

  movements.forEach((movement) => {
    if (!['income', 'expense'].includes(movement.type)) return
    const date = new Date(movement.createdAt || Date.now())
    const month = months.find((item) => item.key === `${date.getFullYear()}-${date.getMonth()}`)
    if (month) month[movement.type === 'income' ? 'incomeValue' : 'expenseValue'] += movement.amount
  })

  const maximum = Math.max(0, ...months.flatMap((month) => [month.incomeValue, month.expenseValue]))
  return months.map((month) => ({
    ...month,
    income: maximum ? (month.incomeValue / maximum) * 88 : 0,
    expense: maximum ? (month.expenseValue / maximum) * 88 : 0,
  }))
}

export function loadFinanceData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? { ...INITIAL_FINANCE_DATA, ...JSON.parse(stored) } : INITIAL_FINANCE_DATA
  } catch {
    return INITIAL_FINANCE_DATA
  }
}

export function saveFinanceData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function escapeCsv(value) {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function exportFinanceCsv(data) {
  const rows = [CSV_COLUMNS]
  rows.push([
    'summary', '', '', '', '', '', '', data.summary.balance, data.summary.income,
    data.summary.expenses, data.summary.monthlyChange, '', '', '', data.user.name, data.user.initials, '',
  ])
  rows.push([
    'goal', '', '', '', '', '', '', '', '', '', '', data.goal.name,
    data.goal.current, data.goal.target, '', '', '',
  ])
  data.movements.forEach((movement) => rows.push([
    'movement', movement.id, movement.description, movement.category, movement.type,
    movement.amount, movement.dateLabel, '', '', '', '', '', '', '', '', '', movement.createdAt || '',
  ]))
  return `\uFEFF${rows.map((row) => row.map(escapeCsv).join(',')).join('\r\n')}`
}

function parseCsv(csvText) {
  const text = csvText.replace(/^\uFEFF/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1 }
      else if (char === '"') quoted = false
      else field += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(field); field = '' }
    else if (char === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = '' }
    else field += char
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  if (quoted) throw new Error('El archivo CSV tiene una comilla sin cerrar.')
  return rows
}

const safeText = (value) => String(value ?? '').replace(/^'(?=[=+\-@])/, '')
const validNumber = (value, label) => {
  const number = Number(value)
  if (!Number.isFinite(number)) throw new Error(`El valor de ${label} no es válido.`)
  return number
}

export function importFinanceCsv(csvText) {
  const rows = parseCsv(csvText)
  const header = rows[0] || []
  const requiredColumns = CSV_COLUMNS.filter((column) => column !== 'created_at')
  if (rows.length < 2 || !requiredColumns.every((column) => header.includes(column))) {
    throw new Error('Este CSV no corresponde a un respaldo de Kaligula.')
  }
  const records = rows.slice(1).filter((row) => row.some(Boolean)).map((row) => (
    Object.fromEntries(header.map((column, index) => [column, safeText(row[index])]))
  ))
  const summary = records.find((record) => record.record_type === 'summary')
  const goal = records.find((record) => record.record_type === 'goal')
  if (!summary || !goal) throw new Error('El respaldo está incompleto: faltan el resumen o la meta.')

  const movements = records.filter((record) => record.record_type === 'movement').map((record, index) => {
    if (!ENTRY_TYPES.includes(record.type) || !record.description) throw new Error('El respaldo contiene un registro inválido.')
    return {
      id: record.id || globalThis.crypto?.randomUUID?.() || `m-${Date.now()}-${index}`,
      description: record.description,
      category: record.category || 'Otro',
      type: record.type,
      amount: validNumber(record.amount, 'movimiento'),
      dateLabel: record.date_label || 'Importado',
      createdAt: record.created_at || new Date().toISOString(),
    }
  })

  return {
    ...INITIAL_FINANCE_DATA,
    user: { name: summary.user_name || INITIAL_FINANCE_DATA.user.name, initials: summary.user_initials || INITIAL_FINANCE_DATA.user.initials },
    summary: {
      balance: validNumber(summary.balance, 'saldo'), income: validNumber(summary.income, 'ingresos'),
      expenses: validNumber(summary.expenses, 'gastos'), monthlyChange: validNumber(summary.monthly_change, 'variación mensual'),
    },
    goal: {
      name: goal.goal_name || 'Meta de ahorro', current: validNumber(goal.goal_current, 'avance de meta'),
      target: validNumber(goal.goal_target, 'objetivo de meta'),
    },
    movements,
  }
}
