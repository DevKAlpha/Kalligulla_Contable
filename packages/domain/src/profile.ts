import { DomainError } from './errors'
import type { Profile } from './types'

export const PROFILE_NAME_MAX_LENGTH = 40

export function normalizeProfile(profile: Profile): Profile {
  const name = profile.name?.trim().replace(/\s+/g, ' ') ?? ''
  if (name.length > PROFILE_NAME_MAX_LENGTH) {
    throw new DomainError(`El nombre admite máximo ${PROFILE_NAME_MAX_LENGTH} caracteres.`, 'name')
  }
  return { name }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'K'
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`
  return letters.toLocaleUpperCase('es-CO')
}
