import { ArrowDownLeft, ArrowUpRight, Gem, House, Landmark, type LucideIcon } from 'lucide-react'
import type { MovementType } from '@kaligula/domain'

export interface NavItem {
  href: string
  label: string
  shortLabel: string
  icon: LucideIcon
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: 'Inicio', shortLabel: 'Inicio', icon: House },
  { href: '/gastos', label: 'Gastos', shortLabel: 'Gastos', icon: ArrowUpRight },
  { href: '/inversiones', label: 'Inversiones', shortLabel: 'Inversión', icon: Gem },
  { href: '/prestamos', label: 'Préstamos', shortLabel: 'Préstamos', icon: Landmark },
]

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/** Visual identity per movement type. Color is never the only cue: every use pairs it with an icon and a label. */
export const TYPE_STYLE: Record<MovementType, { icon: LucideIcon; dot: string; soft: string; text: string; sign: string }> = {
  income: { icon: ArrowDownLeft, dot: 'bg-income', soft: 'bg-income-soft', text: 'text-income', sign: '+' },
  expense: { icon: ArrowUpRight, dot: 'bg-expense', soft: 'bg-expense-soft', text: 'text-expense', sign: '−' },
  investment: { icon: Gem, dot: 'bg-invest', soft: 'bg-invest-soft', text: 'text-invest', sign: '' },
  loan: { icon: Landmark, dot: 'bg-loan', soft: 'bg-loan-soft', text: 'text-loan', sign: '' },
}
