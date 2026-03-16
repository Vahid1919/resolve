import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? join(__dirname, 'resolve.db')
export const db = new Database(dbPath)

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initDb() {
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id      TEXT PRIMARY KEY,
      email   TEXT UNIQUE NOT NULL,
      name    TEXT,
      avatar  TEXT,
      created_at INTEGER DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS areas (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      name       TEXT NOT NULL,
      color      TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch('now') * 1000),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    TEXT NOT NULL,
      date_key   TEXT NOT NULL,
      text       TEXT NOT NULL,
      area_id    INTEGER,
      done       INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch('now') * 1000),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_defs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     TEXT NOT NULL,
      text        TEXT NOT NULL,
      cadence     TEXT NOT NULL DEFAULT 'daily',
      custom_days TEXT NOT NULL DEFAULT '[]',
      start_date  TEXT NOT NULL,
      end_date    TEXT,
      area_id     INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS habit_completions (
      date_key TEXT    NOT NULL,
      habit_id INTEGER NOT NULL,
      user_id  TEXT    NOT NULL,
      PRIMARY KEY (date_key, habit_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS habit_exceptions (
      date_key TEXT    NOT NULL,
      habit_id INTEGER NOT NULL,
      user_id  TEXT    NOT NULL,
      PRIMARY KEY (date_key, habit_id, user_id)
    );
  `)
}
