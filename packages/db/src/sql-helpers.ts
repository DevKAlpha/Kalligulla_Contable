import { sql, type AnyColumn, type SQL } from 'drizzle-orm'

/*
 * Portable SQL fragments: the same text runs on PostgreSQL, PGlite and SQLite (where `lower()` is
 * replaced by a Unicode-aware function when the connection opens).
 */

/** Lowercase text, for case-insensitive ordering and comparisons. */
export function lowerOf(value: AnyColumn | SQL): SQL {
  return sql`lower(${value})`
}

/**
 * Case-insensitive LIKE (PostgreSQL's ILIKE is not available in SQLite).
 * `pattern` uses % and _ as wildcards; a backslash escapes them, in both engines.
 */
export function likeInsensitive(value: AnyColumn | SQL, pattern: string): SQL {
  return sql`lower(${value}) like ${pattern.toLowerCase()} escape '\\'`
}
