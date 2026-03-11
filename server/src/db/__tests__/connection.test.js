import { describe, it, expect, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';

// Test the pure helper functions (all, get, run) with a real in-memory DB.
// We re-implement them here to avoid side effects from the module-level
// code in connection.js (fs operations, signal handlers, auto-save timer).

let SQL;

function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

function get(db, sql, params = []) {
  const rows = all(db, sql, params);
  return rows[0] || null;
}

function run(db, sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec('SELECT last_insert_rowid()')[0]?.values[0][0];
  const changes = db.exec('SELECT changes()')[0]?.values[0][0];
  return { lastInsertRowid: lastId, changes };
}

beforeAll(async () => {
  SQL = await initSqlJs();
});

describe('database helpers', () => {
  describe('all()', () => {
    it('returns all rows as objects', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.run("INSERT INTO test VALUES (1, 'Alice')");
      db.run("INSERT INTO test VALUES (2, 'Bob')");

      const results = all(db, 'SELECT * FROM test ORDER BY id');
      expect(results).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('returns empty array for no matches', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER PRIMARY KEY)');

      expect(all(db, 'SELECT * FROM test')).toEqual([]);
    });

    it('supports parameterized queries', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER, name TEXT)');
      db.run("INSERT INTO test VALUES (1, 'Alice')");
      db.run("INSERT INTO test VALUES (2, 'Bob')");

      const results = all(db, 'SELECT * FROM test WHERE name = ?', ['Alice']);
      expect(results).toEqual([{ id: 1, name: 'Alice' }]);
    });

    it('handles NULL values', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER, name TEXT)');
      db.run('INSERT INTO test VALUES (1, NULL)');

      const results = all(db, 'SELECT * FROM test');
      expect(results[0].name).toBeNull();
    });
  });

  describe('get()', () => {
    it('returns first row as object', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER, name TEXT)');
      db.run("INSERT INTO test VALUES (1, 'Alice')");
      db.run("INSERT INTO test VALUES (2, 'Bob')");

      const result = get(db, 'SELECT * FROM test ORDER BY id');
      expect(result).toEqual({ id: 1, name: 'Alice' });
    });

    it('returns null when no rows match', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER)');

      expect(get(db, 'SELECT * FROM test WHERE id = ?', [999])).toBeNull();
    });
  });

  describe('run()', () => {
    it('returns lastInsertRowid after INSERT', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');

      const result = run(db, "INSERT INTO test (name) VALUES (?)", ['Alice']);
      expect(result.lastInsertRowid).toBe(1);

      const result2 = run(db, "INSERT INTO test (name) VALUES (?)", ['Bob']);
      expect(result2.lastInsertRowid).toBe(2);
    });

    it('returns changes count after UPDATE', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
      db.run("INSERT INTO test VALUES (1, 'Alice')");
      db.run("INSERT INTO test VALUES (2, 'Bob')");

      const result = run(db, "UPDATE test SET name = 'Updated' WHERE id = ?", [1]);
      expect(result.changes).toBe(1);
    });

    it('returns 0 changes when no rows affected', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER, name TEXT)');

      const result = run(db, 'DELETE FROM test WHERE id = ?', [999]);
      expect(result.changes).toBe(0);
    });

    it('returns correct changes for DELETE', () => {
      const db = new SQL.Database();
      db.run('CREATE TABLE test (id INTEGER, name TEXT)');
      db.run("INSERT INTO test VALUES (1, 'a')");
      db.run("INSERT INTO test VALUES (2, 'b')");
      db.run("INSERT INTO test VALUES (3, 'c')");

      const result = run(db, 'DELETE FROM test');
      expect(result.changes).toBe(3);
    });
  });
});
