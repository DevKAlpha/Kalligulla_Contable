import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { MIGRATIONS } from './migrations'
import { schema } from './schema'

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>
export type DatabaseEngine = 'postgres' | 'pglite'

export interface DatabaseHandle {
  db: Database
  engine: DatabaseEngine
  /** Cheap liveness probe used by /api/health. */
  ping(): Promise<boolean>
  close(): Promise<void>
}

export interface OpenDatabaseOptions {
  /** PostgreSQL connection string. When present it wins over every other option. */
  url?: string
  /** Directory for the embedded PGlite database. Omit (with no url) for an in-memory database. */
  dataDir?: string
}

/**
 * Opens PostgreSQL (servers, Docker) or PGlite (desktop, local development, tests).
 * Both speak the same SQL, so migrations and queries are shared. Drivers are loaded
 * lazily so a deployment only loads the one it uses.
 */
export async function openDatabase(options: OpenDatabaseOptions = {}): Promise<DatabaseHandle> {
  if (options.url) {
    const { default: pg } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const pool = new pg.Pool({ connectionString: options.url, max: 10 })
    const db = drizzle(pool, { schema }) as unknown as Database
    return {
      db,
      engine: 'postgres',
      ping: () => ping(db),
      close: () => pool.end(),
    }
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  if (options.dataDir) {
    // PGlite creates only the last folder of the path; a fresh checkout has no parent folder yet.
    const { mkdir } = await import('node:fs/promises')
    await mkdir(options.dataDir, { recursive: true })
  }
  const client = options.dataDir ? new PGlite(options.dataDir) : new PGlite()
  await client.waitReady
  const db = drizzle(client, { schema }) as unknown as Database
  return {
    db,
    engine: 'pglite',
    ping: () => ping(db),
    close: () => client.close(),
  }
}

async function ping(db: Database): Promise<boolean> {
  try {
    await db.execute(sql`select 1`)
    return true
  } catch {
    return false
  }
}

/** Arbitrary constant used to serialize concurrent migrators (several app instances). */
const MIGRATION_LOCK_KEY = 4_272_021

/** Applies pending migrations in order. Safe to call on every start. */
export async function migrate(db: Database): Promise<string[]> {
  await db.execute(sql.raw(
    'create table if not exists kaligula_migrations (id text primary key, applied_at timestamptz not null default now())',
  ))
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${MIGRATION_LOCK_KEY})`)
    const result = await tx.execute(sql`select id from kaligula_migrations`)
    const applied = new Set((result as unknown as { rows: { id: string }[] }).rows.map((row) => row.id))
    const ran: string[] = []
    for (const migration of MIGRATIONS) {
      if (applied.has(migration.id)) continue
      for (const statement of migration.statements) await tx.execute(sql.raw(statement))
      await tx.execute(sql`insert into kaligula_migrations (id) values (${migration.id})`)
      ran.push(migration.id)
    }
    return ran
  })
}
