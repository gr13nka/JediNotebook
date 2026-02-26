import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'timer.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    runMigrations(db);
  }
  return db;
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      dailyBudgetMinutes INTEGER NOT NULL,
      isBreak INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      deviceId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      activityId TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      endedAt TEXT,
      durationSeconds INTEGER NOT NULL DEFAULT 0,
      isManual INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      deletedAt TEXT,
      deviceId TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id TEXT PRIMARY KEY,
      dayStartHour INTEGER NOT NULL DEFAULT 6,
      dayEndHour INTEGER NOT NULL DEFAULT 2,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      barStyle TEXT NOT NULL DEFAULT 'thick-linear',
      syncEnabled INTEGER NOT NULL DEFAULT 0,
      syncServerUrl TEXT NOT NULL DEFAULT '',
      syncApiKey TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL,
      deviceId TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_time_entries_date ON time_entries(date);
    CREATE INDEX IF NOT EXISTS idx_time_entries_activity ON time_entries(activityId);
    CREATE INDEX IF NOT EXISTS idx_activities_updated ON activities(updatedAt);
    CREATE INDEX IF NOT EXISTS idx_time_entries_updated ON time_entries(updatedAt);
  `);
}
