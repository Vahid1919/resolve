/**
 * db.js — the database connection and schema.
 *
 * Resolve stores everything in a single SQLite file (resolve.db). SQLite is a
 * tiny database that lives in one file — no separate database server to run.
 * We use better-sqlite3, which talks to it synchronously (no callbacks/await).
 *
 * This module exports:
 *   • `db`     — the open connection (imported by index.js and routes.js).
 *   • `initDb` — creates the tables on first run (called once at startup).
 */

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Where the database file lives. On Railway we point DB_PATH at a persistent
// volume; locally it's just resolve.db next to this file.
const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? join(__dirname, 'resolve.db')
export const db = new Database(dbPath)

db.pragma('journal_mode = WAL') // WAL mode = better performance with concurrent reads
db.pragma('foreign_keys = ON')  // enforce the FOREIGN KEY relationships below

/**
 * Create the tables if they don't already exist. "IF NOT EXISTS" means this is
 * safe to call on every startup — it only creates anything the first time.
 *
 * The shape: one `users` row per signed-in person, and every other table has a
 * `user_id` linking its rows back to that user. `ON DELETE CASCADE` means
 * deleting a user automatically removes all of their data.
 */
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

  // Migrations — columns added after the tables originally shipped. SQLite has
  // no "ADD COLUMN IF NOT EXISTS", so we just try each one and ignore the error
  // it throws when the column is already there. This keeps old databases working.
  for (const stmt of [
    'ALTER TABLE tasks ADD COLUMN sort_order INTEGER DEFAULT 0',
    'ALTER TABLE tasks ADD COLUMN parent_id INTEGER',
  ]) {
    try { db.exec(stmt) } catch { /* column already exists */ }
  }
}
