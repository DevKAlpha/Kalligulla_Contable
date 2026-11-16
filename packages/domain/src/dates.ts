import type { IsoDate } from './types'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isIsoDate(value: string): value is IsoDate {
  const match = ISO_DATE.exec(value)
  if (!match) return false
  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** Local calendar date of `date` as `YYYY-MM-DD`. */
export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** `YYYY-MM` key of an ISO date or a Date (local time). */
export function monthKey(value: IsoDate | Date): string {
  return (typeof value === 'string' ? value : toIsoDate(value)).slice(0, 7)
}

export function shiftMonth(key: string, offset: number): string {
  const [year, month] = key.split('-').map(Number)
  const date = new Date(year, month - 1 + offset, 1)
  return monthKey(date)
}

/** Parses an ISO date as local midnight, avoiding the UTC shift of `new Date('YYYY-MM-DD')`. */
export function parseIsoDate(value: IsoDate): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}
