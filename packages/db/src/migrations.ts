/**
 * Versioned, append-only SQL migrations. Never edit a migration that has shipped:
 * add a new one instead. Each migration runs in a transaction and is recorded in
 * `kaligula_migrations`. The SQL is plain PostgreSQL, so it runs on both PostgreSQL and PGlite.
 */
export interface Migration {
  id: string
  statements: readonly string[]
}

export const MIGRATIONS: readonly Migration[] = [
  {
    id: '0001_ledger',
    statements: [
      `create table profiles (
        owner_id text primary key,
        name text not null default '',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`,
      `create table categories (
        id uuid primary key,
        owner_id text not null,
        type text not null check (type in ('income', 'expense', 'investment', 'loan')),
        name text not null check (length(name) between 1 and 40),
        system boolean not null default false,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`,
      `create unique index categories_owner_type_name_uq on categories (owner_id, type, lower(name))`,
      `create table movements (
        id uuid primary key,
        owner_id text not null,
        type text not null check (type in ('income', 'expense', 'investment', 'loan')),
        description text not null check (length(description) between 1 and 60),
        category_id uuid not null references categories (id) on delete restrict,
        amount_minor bigint not null check (amount_minor > 0),
        currency char(3) not null default 'COP',
        occurred_on date not null,
        note text check (note is null or length(note) <= 240),
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`,
      `create index movements_owner_date_idx on movements (owner_id, occurred_on desc, created_at desc)`,
      `create index movements_owner_type_date_idx on movements (owner_id, type, occurred_on desc)`,
      `create index movements_category_idx on movements (category_id)`,
      `create table goals (
        id uuid primary key,
        owner_id text not null,
        name text not null check (length(name) between 1 and 50),
        saved_minor bigint not null default 0 check (saved_minor >= 0),
        target_minor bigint not null check (target_minor > 0),
        target_date date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )`,
      `create index goals_owner_idx on goals (owner_id, created_at)`,
    ],
  },
  {
    id: '0002_portfolio',
    statements: [
      `create table portfolio_imports (
        id uuid primary key,
        owner_id text not null,
        source text not null check (source in ('xtb')),
        account_number text,
        account_currency text,
        file_name text not null,
        report_time timestamptz,
        imported_at timestamptz not null default now(),
        lots_count integer not null
      )`,
      `create index portfolio_imports_owner_idx on portfolio_imports (owner_id, imported_at desc)`,
      `create table portfolio_lots (
        id uuid primary key,
        owner_id text not null,
        import_id uuid not null references portfolio_imports (id) on delete cascade,
        external_id text,
        symbol text not null,
        name text not null,
        category text,
        side text not null check (side in ('buy', 'sell')),
        quantity double precision not null check (quantity > 0),
        open_price double precision not null,
        open_time timestamptz,
        report_price double precision,
        report_value double precision,
        report_gross_profit double precision
      )`,
      `create index portfolio_lots_import_idx on portfolio_lots (import_id)`,
      `create index portfolio_lots_owner_idx on portfolio_lots (owner_id)`,
    ],
  },
]

/** Current time in milliseconds, as stored by the SQLite schema (Drizzle `timestamp_ms`). */
const NOW_MS = `(cast(unixepoch('subsec') * 1000 as integer))`
const KINDS = `('income', 'expense', 'investment', 'loan')`
const ISO_DATE = `'[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'`

/**
 * SQLite twin of `MIGRATIONS` (desktop app). Same ids, same tables, constraints and indexes,
 * in SQLite types: text ids and dates, integer milliseconds for timestamps, 0/1 booleans.
 * Append-only as well: every PostgreSQL migration needs its SQLite counterpart with the same id.
 */
export const SQLITE_MIGRATIONS: readonly Migration[] = [
  {
    id: '0001_ledger',
    statements: [
      `create table profiles (
        owner_id text primary key,
        name text not null default '',
        created_at integer not null default ${NOW_MS},
        updated_at integer not null default ${NOW_MS}
      )`,
      `create table categories (
        id text primary key,
        owner_id text not null,
        type text not null check (type in ${KINDS}),
        name text not null check (length(name) between 1 and 40),
        system integer not null default 0 check (system in (0, 1)),
        created_at integer not null default ${NOW_MS},
        updated_at integer not null default ${NOW_MS}
      )`,
      `create unique index categories_owner_type_name_uq on categories (owner_id, type, lower(name))`,
      `create table movements (
        id text primary key,
        owner_id text not null,
        type text not null check (type in ${KINDS}),
        description text not null check (length(description) between 1 and 60),
        category_id text not null references categories (id) on delete restrict,
        amount_minor integer not null check (amount_minor > 0),
        currency text not null default 'COP' check (length(currency) = 3),
        occurred_on text not null check (occurred_on glob ${ISO_DATE}),
        note text check (note is null or length(note) <= 240),
        created_at integer not null default ${NOW_MS},
        updated_at integer not null default ${NOW_MS}
      )`,
      `create index movements_owner_date_idx on movements (owner_id, occurred_on desc, created_at desc)`,
      `create index movements_owner_type_date_idx on movements (owner_id, type, occurred_on desc)`,
      `create index movements_category_idx on movements (category_id)`,
      `create table goals (
        id text primary key,
        owner_id text not null,
        name text not null check (length(name) between 1 and 50),
        saved_minor integer not null default 0 check (saved_minor >= 0),
        target_minor integer not null check (target_minor > 0),
        target_date text check (target_date is null or target_date glob ${ISO_DATE}),
        created_at integer not null default ${NOW_MS},
        updated_at integer not null default ${NOW_MS}
      )`,
      `create index goals_owner_idx on goals (owner_id, created_at)`,
    ],
  },
  {
    id: '0002_portfolio',
    statements: [
      `create table portfolio_imports (
        id text primary key,
        owner_id text not null,
        source text not null check (source in ('xtb')),
        account_number text,
        account_currency text,
        file_name text not null,
        report_time integer,
        imported_at integer not null default ${NOW_MS},
        lots_count integer not null
      )`,
      `create index portfolio_imports_owner_idx on portfolio_imports (owner_id, imported_at desc)`,
      `create table portfolio_lots (
        id text primary key,
        owner_id text not null,
        import_id text not null references portfolio_imports (id) on delete cascade,
        external_id text,
        symbol text not null,
        name text not null,
        category text,
        side text not null check (side in ('buy', 'sell')),
        quantity real not null check (quantity > 0),
        open_price real not null,
        open_time integer,
        report_price real,
        report_value real,
        report_gross_profit real
      )`,
      `create index portfolio_lots_import_idx on portfolio_lots (import_id)`,
      `create index portfolio_lots_owner_idx on portfolio_lots (owner_id)`,
    ],
  },
]
