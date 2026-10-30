// D1-shaped adapter over node:sqlite (Node 22+). Used by the dev server and the tests only — never bundled into the app.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import type { DatabaseSync as DB } from 'node:sqlite'
import type { D1Like, D1Statement, D1Result } from './db'

// loaded via require: Vite/Vitest do not know the `node:sqlite` builtin yet
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as { DatabaseSync: new (file: string) => DB }

type SqlValue = string | number | null | bigint | Uint8Array

export function sqliteD1(file = ':memory:'): D1Like & { close(): void } {
  const raw = new DatabaseSync(file)
  raw.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
  const stmt = (sql: string, args: unknown[] = []): D1Statement => ({
    bind: (...v) => stmt(sql, v),
    async first<T>() { return ((raw.prepare(sql).get(...(args as SqlValue[])) as T | undefined) ?? null) },
    async all<T>() { return { results: raw.prepare(sql).all(...(args as SqlValue[])) as T[] } },
    async run(): Promise<D1Result> { const r = raw.prepare(sql).run(...(args as SqlValue[])); return { meta: { changes: Number(r.changes) } } },
  })
  return {
    prepare: (sql) => stmt(sql),
    async batch(stmts) {
      raw.exec('BEGIN')
      try { const out: D1Result[] = []; for (const s of stmts) out.push(await s.run()); raw.exec('COMMIT'); return out }
      catch (e) { raw.exec('ROLLBACK'); throw e }
    },
    close: () => raw.close(),
  }
}
