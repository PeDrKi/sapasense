-- Cloudflare D1 (SQLite) schema. Apply with:  npx wrangler d1 execute sapasense --remote --file=schema.sql

-- End-to-end encrypted personal data (favourites, visited, hidden, history). The server never sees plain text.
CREATE TABLE IF NOT EXISTS sync (
  id         TEXT PRIMARY KEY,          -- SHA-256 of the user's secret code
  rev        INTEGER NOT NULL,          -- optimistic-concurrency counter
  data       TEXT NOT NULL,             -- AES-GCM blob, base64
  updated_at INTEGER NOT NULL           -- ms since epoch
);
CREATE INDEX IF NOT EXISTS sync_updated ON sync(updated_at);

-- Places shown by the app (edited from the Admin screen).
CREATE TABLE IF NOT EXISTS places (
  id         TEXT PRIMARY KEY,
  sort       INTEGER NOT NULL,
  json       TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Reviews sent by users.
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  json       TEXT NOT NULL
);

-- Who changed what in the Admin screen.
CREATE TABLE IF NOT EXISTS audit_log (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  at     INTEGER NOT NULL,
  actor  TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL
);

-- Per-visitor request counters (key = salted hash of the IP, never the IP itself).
CREATE TABLE IF NOT EXISTS rate (
  key TEXT PRIMARY KEY,
  win INTEGER NOT NULL,
  n   INTEGER NOT NULL
);
