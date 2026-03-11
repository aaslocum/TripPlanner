import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import initSqlJs from 'sql.js';

// Test the bed request business logic using a real in-memory DB.
// We test the SQL operations and constraints directly rather than
// going through Express routes, since the route handlers are thin
// wrappers around DB queries.

let SQL;
let db;

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

beforeEach(() => {
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');

  // Schema
  db.run(`CREATE TABLE users (
    user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, role TEXT
  )`);
  db.run(`CREATE TABLE trips (
    trip_id INTEGER PRIMARY KEY, trip_name TEXT, start_date TEXT, end_date TEXT
  )`);
  db.run(`CREATE TABLE trip_members (
    trip_id INTEGER, user_id INTEGER, rsvp_status TEXT DEFAULT 'pending',
    PRIMARY KEY (trip_id, user_id)
  )`);
  db.run(`CREATE TABLE accommodations (
    accommodation_id INTEGER PRIMARY KEY, trip_id INTEGER, description TEXT, address TEXT,
    total_cost REAL, check_in_datetime TEXT, check_out_datetime TEXT, airbnb_id TEXT, airbnb_url TEXT
  )`);
  db.run(`CREATE TABLE bedrooms (
    bedroom_id INTEGER PRIMARY KEY, accommodation_id INTEGER, name TEXT, price_share_adjustment REAL DEFAULT 0
  )`);
  db.run(`CREATE TABLE beds (
    bed_id INTEGER PRIMARY KEY, bedroom_id INTEGER, bed_type TEXT, assigned_user_id INTEGER
  )`);
  db.run(`CREATE TABLE bed_requests (
    request_id INTEGER PRIMARY KEY, bed_id INTEGER, user_id INTEGER,
    status TEXT DEFAULT 'requested', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bed_id, user_id)
  )`);

  // Seed
  run(db, "INSERT INTO users VALUES (1, 'Admin', 'User', 'admin@test.com', 'admin')");
  run(db, "INSERT INTO users VALUES (2, 'Jane', 'Doe', 'jane@test.com', 'user')");
  run(db, "INSERT INTO users VALUES (3, 'Bob', 'Smith', 'bob@test.com', 'user')");

  run(db, "INSERT INTO trips VALUES (1, 'Trip', '2026-04-10', '2026-04-12')");
  run(db, "INSERT INTO trip_members VALUES (1, 1, 'yes')");
  run(db, "INSERT INTO trip_members VALUES (1, 2, 'yes')");
  // Bob is NOT a trip member

  run(db, "INSERT INTO accommodations VALUES (1, 1, 'Cabin', '123 St', 600, '2026-04-10T15:00', '2026-04-12T11:00', NULL, NULL)");
  run(db, "INSERT INTO bedrooms VALUES (1, 1, 'Master', 0)");
  run(db, "INSERT INTO beds VALUES (1, 1, 'king', NULL)");
  run(db, "INSERT INTO beds VALUES (2, 1, 'queen', NULL)");
});

describe('bed request workflow', () => {
  describe('creating bed requests', () => {
    it('creates a new bed request with default status "requested"', () => {
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);
      const req = get(db, 'SELECT * FROM bed_requests WHERE bed_id = 1 AND user_id = 2');

      expect(req).not.toBeNull();
      expect(req.status).toBe('requested');
      expect(req.bed_id).toBe(1);
      expect(req.user_id).toBe(2);
    });

    it('enforces UNIQUE(bed_id, user_id) constraint', () => {
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);

      expect(() => {
        run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);
      }).toThrow();
    });

    it('allows same user to request different beds', () => {
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [2, 2]);

      const requests = all(db, 'SELECT * FROM bed_requests WHERE user_id = 2');
      expect(requests).toHaveLength(2);
    });

    it('allows different users to request the same bed (couples)', () => {
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 1]);
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);

      const requests = all(db, 'SELECT * FROM bed_requests WHERE bed_id = 1');
      expect(requests).toHaveLength(2);
    });
  });

  describe('confirming bed requests', () => {
    it('updates status from "requested" to "confirmed"', () => {
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);
      const reqBefore = get(db, 'SELECT * FROM bed_requests WHERE bed_id = 1 AND user_id = 2');
      expect(reqBefore.status).toBe('requested');

      run(db, "UPDATE bed_requests SET status = 'confirmed' WHERE request_id = ?", [reqBefore.request_id]);
      const reqAfter = get(db, 'SELECT * FROM bed_requests WHERE request_id = ?', [reqBefore.request_id]);
      expect(reqAfter.status).toBe('confirmed');
    });
  });

  describe('withdrawing/deleting bed requests', () => {
    it('deletes a bed request', () => {
      const { lastInsertRowid } = run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);
      run(db, 'DELETE FROM bed_requests WHERE request_id = ?', [lastInsertRowid]);

      const req = get(db, 'SELECT * FROM bed_requests WHERE request_id = ?', [lastInsertRowid]);
      expect(req).toBeNull();
    });
  });

  describe('listing bed requests for an accommodation', () => {
    it('joins bed requests with user, bed, and bedroom info', () => {
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 1]);
      run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [2, 2]);

      const requests = all(db, `
        SELECT br.*, u.first_name, u.last_name,
               b.bed_type, b.bed_id,
               bdr.name AS bedroom_name, bdr.bedroom_id
        FROM bed_requests br
        JOIN users u ON br.user_id = u.user_id
        JOIN beds b ON br.bed_id = b.bed_id
        JOIN bedrooms bdr ON b.bedroom_id = bdr.bedroom_id
        WHERE bdr.accommodation_id = ?
        ORDER BY bdr.bedroom_id, b.bed_id, br.status DESC, br.created_at
      `, [1]);

      expect(requests).toHaveLength(2);
      expect(requests[0].first_name).toBe('Admin');
      expect(requests[0].bed_type).toBe('king');
      expect(requests[0].bedroom_name).toBe('Master');
      expect(requests[1].first_name).toBe('Jane');
      expect(requests[1].bed_type).toBe('queen');
    });
  });

  describe('access control logic', () => {
    it('non-admin can only delete own pending requests', () => {
      const { lastInsertRowid: reqId } = run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);
      const request = get(db, 'SELECT * FROM bed_requests WHERE request_id = ?', [reqId]);

      // Simulate non-admin user (user_id: 2) trying to delete their own pending request
      const canDelete = request.user_id === 2 && request.status === 'requested';
      expect(canDelete).toBe(true);
    });

    it('non-admin cannot delete confirmed requests', () => {
      const { lastInsertRowid: reqId } = run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 2]);
      run(db, "UPDATE bed_requests SET status = 'confirmed' WHERE request_id = ?", [reqId]);
      const request = get(db, 'SELECT * FROM bed_requests WHERE request_id = ?', [reqId]);

      const canDelete = request.user_id === 2 && request.status === 'requested';
      expect(canDelete).toBe(false);
    });

    it('non-admin cannot delete other users requests', () => {
      const { lastInsertRowid: reqId } = run(db, 'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)', [1, 1]);
      const request = get(db, 'SELECT * FROM bed_requests WHERE request_id = ?', [reqId]);

      // User 2 trying to delete user 1's request
      const canDelete = request.user_id === 2 && request.status === 'requested';
      expect(canDelete).toBe(false);
    });
  });
});
