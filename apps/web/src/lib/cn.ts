import { clsx, type ClassValue } from 'clsx'

export function cn(...values: ClassValue[]): string {
  return clsx(values)
}

/** "1 registro" / "3 registros". */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}
