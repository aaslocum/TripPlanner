import initSqlJs from 'sql.js';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'tripplanner.db');
const REPO_ROOT = path.join(__dirname, '../../..');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

export async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(new Uint8Array(fileBuffer));
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON;');
  return db;
}

export function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  scheduleGitPush();
}

// Debounced git commit+push (5 min) so we don't push on every auto-save
let gitPushTimer = null;
function scheduleGitPush() {
  if (process.env.NODE_ENV !== 'production') return;
  if (gitPushTimer) clearTimeout(gitPushTimer);
  gitPushTimer = setTimeout(() => {
    gitPushTimer = null;
    pushDataToGit();
  }, 5 * 60 * 1000);
  gitPushTimer.unref();
}

function pushDataToGit() {
  const opts = { cwd: REPO_ROOT };
  execFile('git', ['add', 'server/data/tripplanner.db'], opts, (err) => {
    if (err) return console.error('git add failed:', err.message);
    execFile('git', ['diff', '--cached', '--quiet', 'server/data/tripplanner.db'], opts, (diffErr) => {
      // Exit code 1 means there are staged changes
      if (!diffErr) return; // no changes to commit
      execFile('git', ['commit', '-m', 'Auto-save database'], opts, (commitErr) => {
        if (commitErr) return console.error('git commit failed:', commitErr.message);
        execFile('git', ['push'], opts, (pushErr) => {
          if (pushErr) return console.error('git push failed:', pushErr.message);
          console.log('Database pushed to git');
        });
      });
    });
  });
}

// Save on exit
process.on('SIGINT', () => { saveDb(); process.exit(0); });
process.on('SIGTERM', () => { saveDb(); process.exit(0); });

// Auto-save every 30 seconds (unref so it doesn't keep CLI scripts alive)
const autoSaveTimer = setInterval(() => { saveDb(); }, 30000);
autoSaveTimer.unref();

// Helper: run a query and return all rows as objects
export function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper: run a query and return first row as object or null
export function get(db, sql, params = []) {
  const rows = all(db, sql, params);
  return rows[0] || null;
}

// Helper: run an INSERT/UPDATE/DELETE and return info
export function run(db, sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
  const changes = db.exec('SELECT changes()')[0]?.values[0][0];
  return { lastInsertRowid: lastId, changes };
}
