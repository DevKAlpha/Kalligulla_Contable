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
]
