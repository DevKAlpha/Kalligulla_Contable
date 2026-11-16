import type { CurrencyCode } from './types'

const MINOR_PER_MAJOR: Record<CurrencyCode, number> = { COP: 100 }
const LOCALE = 'es-CO'

/** Largest amount accepted, in major units (one quadrillion), to stay far from float precision limits. */
export const MAX_MAJOR_AMOUNT = 1_000_000_000_000

export function toMinor(major: number, currency: CurrencyCode = 'COP'): number {
  return Math.round(major * MINOR_PER_MAJOR[currency])
}

export function toMajor(minor: number, currency: CurrencyCode = 'COP'): number {
  return minor / MINOR_PER_MAJOR[currency]
}

/**
 * Parses user input such as `12500`, `12.500`, `12.500,50` or `12500.5` into minor units.
 * Colombian convention: `.` groups thousands and `,` separates decimals. A single `.`
 * followed by one or two digits is treated as a decimal point.
 */
export function parseMajorInput(raw: string, currency: CurrencyCode = 'COP'): number | null {
  const text = raw.trim().replace(/[\s$]/g, '')
  if (!text || !/^\d[\d.,]*$/.test(text)) return null
  let normalized: string
  if (text.includes(',')) {
    normalized = text.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+\.\d{1,2}$/.test(text)) {
    normalized = text
  } else {
    normalized = text.replace(/\./g, '')
  }
  if ((normalized.match(/\./g) ?? []).length > 1) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? toMinor(value, currency) : null
}

const formatters = new Map<string, Intl.NumberFormat>()

function formatter(currency: CurrencyCode, compact: boolean): Intl.NumberFormat {
  const key = `${currency}-${compact}`
  let instance = formatters.get(key)
  if (!instance) {
    instance = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency,
      notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
      minimumFractionDigits: 0,
    })
    formatters.set(key, instance)
  }
  return instance
}

export function formatMoney(minor: number, options: { currency?: CurrencyCode; compact?: boolean } = {}): string {
  const currency = options.currency ?? 'COP'
  return formatter(currency, options.compact ?? false).format(toMajor(minor, currency))
}
