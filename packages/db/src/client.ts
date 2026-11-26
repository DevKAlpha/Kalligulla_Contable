import { sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { MIGRATIONS, SQLITE_MIGRATIONS } from './migrations'
import { schema } from './schema'
import { sqliteSchema } from './schema-sqlite'

/*
 * Repositories are written once against this typed view (PostgreSQL flavour of the query builder).
 * The SQLite handle exposes Drizzle's SQLite builder and the twin tables from `schema-sqlite.ts`
 * under the same types: both builders share the API the repositories use (select/insert/update/
 * delete, joins, returning, onConflict, transaction), and the test suite runs on both engines.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>
export type Tables = typeof schema
export type DatabaseEngine = 'postgres' | 'pglite' | 'sqlite'

export interface DatabaseHandle {
  db: Database
  /** Tables of the engine in use; repositories must take them from here, never import them. */
  tables: Tables
  engine: DatabaseEngine
  /** Cheap liveness probe used by /api/health. */
  ping(): Promise<boolean>
  /** Applies pending migrations in order. Safe to call on every start. */
  migrate(): Promise<string[]>
  close(): Promise<void>
}

export interface OpenDatabaseOptions {
  /** PostgreSQL connection string. When present it wins over every other option. */
  url?: string
  /** SQLite database file (desktop app), or ':memory:'. Used when there is no url. */
  sqliteFile?: string
  /** Directory for the embedded PGlite database. Omit (with no url or SQLite file) for an in-memory database. */
  dataDir?: string
}

/**
 * Opens PostgreSQL (servers, Docker), SQLite (desktop app) or PGlite (local development, tests).
 * Drivers are loaded lazily so a deployment only loads the one it uses.
 */
export async function openDatabase(options: OpenDatabaseOptions = {}): Promise<DatabaseHandle> {
  if (options.url) {
    const { default: pg } = await import('pg')
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const pool = new pg.Pool({ connectionString: options.url, max: 10 })
    const db = drizzle(pool, { schema }) as unknown as Database
    return postgresHandle(db, 'postgres', () => pool.end())
  }

  if (options.sqliteFile) return openSqlite(options.sqliteFile)

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
  return postgresHandle(db, 'pglite', () => client.close())
}

/** Applies pending migrations of the handle's engine. */
export function migrate(handle: DatabaseHandle): Promise<string[]> {
  return handle.migrate()
}

/* ---------- PostgreSQL and PGlite ---------- */

/** Arbitrary constant used to serialize concurrent migrators (several app instances). */
const MIGRATION_LOCK_KEY = 4_272_021

function postgresHandle(db: Database, engine: 'postgres' | 'pglite', close: () => Promise<void>): DatabaseHandle {
  return {
    db,
    tables: schema,
    engine,
    async ping() {
      try {
        await db.execute(sql`select 1`)
        return true
      } catch {
        return false
      }
    },
    async migrate() {
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
    },
    close,
  }
}

/* ---------- SQLite (desktop) ---------- */

type SqliteParam = null | number | bigint | string | Uint8Array

const STATEMENT_CACHE_SIZE = 200

/**
 * SQLite through Node's built-in `node:sqlite` (no native add-on to rebuild for Electron) and
 * Drizzle's SQLite proxy driver. One connection serves the whole app, so transactions are queued:
 * while one is open, statements from other requests wait until it commits or rolls back.
 */
async function openSqlite(file: string): Promise<DatabaseHandle> {
  const { DatabaseSync } = await import('node:sqlite')
  const { AsyncLocalStorage } = await import('node:async_hooks')
  const { drizzle } = await import('drizzle-orm/sqlite-proxy')
  if (file !== ':memory:') {
    const { mkdir } = await import('node:fs/promises')
    const { dirname } = await import('node:path')
    await mkdir(dirname(file), { recursive: true })
  }

  const client = new DatabaseSync(file)
  client.exec('pragma journal_mode = wal; pragma synchronous = normal; pragma foreign_keys = on; pragma busy_timeout = 5000')
  // Unicode-aware lower(): the built-in one only folds ASCII, so "ÁGUA" and "água" would differ.
  // The same SQL (lower(...) like ..., the unique category index) then behaves as in PostgreSQL.
  client.function('lower', { deterministic: true }, (value: unknown) => (typeof value === 'string' ? value.toLowerCase() : value) as SqliteParam)

  const statements = new Map<string, ReturnType<typeof client.prepare>>()
  const prepare = (text: string) => {
    let statement = statements.get(text)
    if (!statement) {
      statement = client.prepare(text)
      statement.setReturnArrays(true)
      if (statements.size >= STATEMENT_CACHE_SIZE) statements.delete(statements.keys().next().value!)
      statements.set(text, statement)
    }
    return statement
  }

  const insideTransaction = new AsyncLocalStorage<true>()
  let running: Promise<unknown> | null = null
  let queue: Promise<unknown> = Promise.resolve()

  const db = drizzle(async (text, params, method) => {
    if (!insideTransaction.getStore()) {
      while (running) await running.catch(() => undefined)
    }
    const statement = prepare(text)
    const values = params as SqliteParam[]
    if (method === 'run') {
      statement.run(...values)
      return { rows: [] }
    }
    if (method === 'get') return { rows: statement.get(...values) as unknown as unknown[] }
    return { rows: statement.all(...values) as unknown as unknown[][] }
  }, { schema: sqliteSchema })

  const transaction = db.transaction.bind(db)
  db.transaction = ((callback, config) => {
    const run = queue.then(() => {
      const task = insideTransaction.run(true, () => transaction(callback, config))
      running = task
      return task.finally(() => {
        if (running === task) running = null
      })
    })
    queue = run.catch(() => undefined)
    return run
  }) as typeof db.transaction

  return {
    db: db as unknown as Database,
    tables: sqliteSchema as unknown as Tables,
    engine: 'sqlite',
    async ping() {
      try {
        client.prepare('select 1').get()
        return true
      } catch {
        return false
      }
    },
    async migrate() {
      client.exec('create table if not exists kaligula_migrations (id text primary key, applied_at integer not null)')
      const applied = new Set(client.prepare('select id from kaligula_migrations').all().map((row) => String(row.id)))
      const ran: string[] = []
      for (const migration of SQLITE_MIGRATIONS) {
        if (applied.has(migration.id)) continue
        client.exec('begin immediate')
        try {
          for (const statement of migration.statements) client.exec(statement)
          client.prepare('insert into kaligula_migrations (id, applied_at) values (?, ?)').run(migration.id, Date.now())
          client.exec('commit')
        } catch (error) {
          client.exec('rollback')
          throw error
        }
        statements.clear()
        ran.push(migration.id)
      }
      return ran
    },
    async close() {
      while (running) await running.catch(() => undefined)
      statements.clear()
      client.close()
    },
  }
}
