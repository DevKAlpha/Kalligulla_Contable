import type { Database } from '@kaligula/db'

/** A transaction handle; exposes the same query builder as the database. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
/** Anything that can run queries: the database or an open transaction. */
export type Executor = Database | Transaction

/** Splits large inserts so a single statement stays well below parameter limits. */
export function chunk<T>(items: readonly T[], size = 500): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}
