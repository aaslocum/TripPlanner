import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../../config/env.js';
import { getDb, saveDb, all, run } from '../connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = __dirname;
const isReset = process.argv.includes('--reset');

async function migrate() {
  const db = await getDb();

  if (isReset) {
    console.log('Resetting database...');
    const tables = all(db,
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    db.run('PRAGMA foreign_keys = OFF;');
    for (const { name } of tables) {
      db.run(`DROP TABLE IF EXISTS "${name}";`);
    }
    db.run('PRAGMA foreign_keys = ON;');
    console.log('All tables dropped.');
  }

  // Create migrations tracking table
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Get already applied migrations
  const applied = new Set(
    all(db, 'SELECT filename FROM _migrations').map(r => r.filename)
  );

  // Get SQL migration files sorted by prefix
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    try {
      // Split on semicolons for multiple statements
      const statements = sql.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        db.run(stmt + ';');
      }
      run(db, 'INSERT INTO _migrations (filename) VALUES (?)', [file]);
      console.log(`Applied: ${file}`);
      count++;
    } catch (err) {
      console.error(`Failed to apply ${file}:`, err.message);
      process.exit(1);
    }
  }

  if (count === 0) {
    console.log('No new migrations to apply.');
  } else {
    console.log(`Applied ${count} migration(s).`);
  }

  saveDb();
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
