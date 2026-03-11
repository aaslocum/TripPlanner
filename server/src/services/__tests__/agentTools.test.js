import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import initSqlJs from 'sql.js';

// We need a real in-memory SQL.js DB for these tests since the query functions
// execute real SQL. We mock getDb to return our test DB.
let SQL;
let testDb;

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

vi.mock('../../db/connection.js', () => ({
  getDb: () => Promise.resolve(testDb),
  all: (db, sql, params) => all(db, sql, params),
  get: (db, sql, params) => get(db, sql, params),
}));

const { AGENT_TOOLS, executeTool } = await import('../agentTools.js');

beforeAll(async () => {
  SQL = await initSqlJs();
});

beforeEach(() => {
  testDb = new SQL.Database();
  testDb.run('PRAGMA foreign_keys = ON;');

  // Create schema
  testDb.run(`CREATE TABLE users (
    user_id INTEGER PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT,
    role TEXT DEFAULT 'user', ai_notes TEXT,
    pref_activity_style TEXT, pref_dietary TEXT, pref_budget_tier TEXT,
    pref_mobility TEXT, pref_drinks TEXT
  )`);
  testDb.run(`CREATE TABLE trips (
    trip_id INTEGER PRIMARY KEY, trip_name TEXT, start_date TEXT, end_date TEXT,
    color TEXT, description TEXT, image_url TEXT
  )`);
  testDb.run(`CREATE TABLE trip_members (
    trip_id INTEGER, user_id INTEGER, rsvp_status TEXT DEFAULT 'pending',
    arrival_date TEXT, departure_date TEXT,
    PRIMARY KEY (trip_id, user_id)
  )`);
  testDb.run(`CREATE TABLE accommodations (
    accommodation_id INTEGER PRIMARY KEY, trip_id INTEGER, description TEXT,
    address TEXT, airbnb_url TEXT, check_in_datetime TEXT, check_out_datetime TEXT,
    total_cost REAL, airbnb_id TEXT
  )`);
  testDb.run(`CREATE TABLE bedrooms (
    bedroom_id INTEGER PRIMARY KEY, accommodation_id INTEGER, name TEXT,
    price_share_adjustment REAL DEFAULT 0
  )`);
  testDb.run(`CREATE TABLE beds (
    bed_id INTEGER PRIMARY KEY, bedroom_id INTEGER, bed_type TEXT,
    assigned_user_id INTEGER
  )`);
  testDb.run(`CREATE TABLE bed_requests (
    request_id INTEGER PRIMARY KEY, bed_id INTEGER, user_id INTEGER,
    status TEXT DEFAULT 'requested', created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bed_id, user_id)
  )`);
  testDb.run(`CREATE TABLE activities (
    activity_id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT, description TEXT,
    address TEXT, start_datetime TEXT, end_datetime TEXT, estimated_cost REAL,
    duration REAL, rating REAL, is_suggested INTEGER DEFAULT 0,
    source_url TEXT, image_url TEXT, latitude REAL, longitude REAL,
    google_place_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  testDb.run(`CREATE TABLE eats (
    eat_id INTEGER PRIMARY KEY, trip_id INTEGER, title TEXT, description TEXT,
    address TEXT, start_datetime TEXT, end_datetime TEXT, estimated_cost REAL,
    duration REAL, rating REAL, is_suggested INTEGER DEFAULT 0,
    source_url TEXT, image_url TEXT, latitude REAL, longitude REAL,
    google_place_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  testDb.run(`CREATE TABLE trip_transportation (
    transport_id INTEGER PRIMARY KEY, trip_id INTEGER, user_id INTEGER,
    mode TEXT, departure_from TEXT, arrival_datetime TEXT, return_datetime TEXT,
    flight_number TEXT, car_capacity INTEGER, notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);
  testDb.run(`CREATE TABLE proposals (
    proposal_id INTEGER PRIMARY KEY, trip_id INTEGER, proposal_name TEXT,
    proposal_text TEXT, places TEXT, estimated_cost REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Seed test data
  run(testDb, "INSERT INTO users VALUES (1, 'Alex', 'Slocum', 'alex@test.com', 'admin', 'Likes hiking', NULL, NULL, NULL, NULL, NULL)");
  run(testDb, "INSERT INTO users VALUES (2, 'Jane', 'Doe', 'jane@test.com', 'user', NULL, 'adventurous', 'vegetarian', 'medium', NULL, 'beer')");
  run(testDb, "INSERT INTO users VALUES (3, 'Bob', 'Smith', 'bob@test.com', 'user', NULL, NULL, NULL, NULL, NULL, NULL)");

  run(testDb, "INSERT INTO trips VALUES (1, 'Weekend Getaway', '2026-04-10', '2026-04-12', 'green', NULL, NULL)");

  run(testDb, "INSERT INTO trip_members VALUES (1, 1, 'yes', '2026-04-10', '2026-04-12')");
  run(testDb, "INSERT INTO trip_members VALUES (1, 2, 'yes', '2026-04-10', '2026-04-12')");
  run(testDb, "INSERT INTO trip_members VALUES (1, 3, 'pending', NULL, NULL)");

  run(testDb, "INSERT INTO accommodations VALUES (1, 1, 'Mountain Cabin', '123 Mountain Rd', NULL, '2026-04-10T15:00', '2026-04-12T11:00', 600, NULL)");

  run(testDb, "INSERT INTO bedrooms VALUES (1, 1, 'Master Bedroom', 50)");
  run(testDb, "INSERT INTO bedrooms VALUES (2, 1, 'Guest Room', -25)");

  run(testDb, "INSERT INTO beds VALUES (1, 1, 'king', NULL)");
  run(testDb, "INSERT INTO beds VALUES (2, 2, 'queen', NULL)");
  run(testDb, "INSERT INTO beds VALUES (3, 2, 'twin', NULL)");

  run(testDb, "INSERT INTO bed_requests VALUES (1, 1, 1, 'confirmed', '2026-03-01')");
  run(testDb, "INSERT INTO bed_requests VALUES (2, 2, 2, 'requested', '2026-03-02')");

  run(testDb, "INSERT INTO activities VALUES (1, 1, 'Hiking', 'Trail hike', '456 Trail Rd', '2026-04-11T09:00', '2026-04-11T12:00', 0, 3, 4.5, 0, NULL, NULL, 35.5, -82.5, NULL, '2026-03-01')");
  run(testDb, "INSERT INTO activities VALUES (2, 1, 'Go-Kart Racing', 'Fun track', '789 Race Rd', '2026-04-11T14:00', '2026-04-11T16:00', 40, 2, NULL, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-01')");
  run(testDb, "INSERT INTO activities VALUES (3, 1, 'Spa Day', 'Relaxation', NULL, NULL, NULL, 80, 2, NULL, 1, NULL, NULL, NULL, NULL, NULL, '2026-03-01')");

  run(testDb, "INSERT INTO eats VALUES (1, 1, 'Italian Dinner', 'Pasta place', '100 Main St', '2026-04-11T19:00', '2026-04-11T21:00', 30, 2, 4.0, 0, NULL, NULL, NULL, NULL, NULL, '2026-03-01')");
  run(testDb, "INSERT INTO eats VALUES (2, 1, 'Coffee Shop', 'Morning coffee', '200 Oak Ave', '2026-04-11T08:00', NULL, 5, 0.5, NULL, 1, NULL, NULL, NULL, NULL, NULL, '2026-03-01')");

  run(testDb, "INSERT INTO trip_transportation VALUES (1, 1, 1, 'driving', 'Charlotte, NC', '2026-04-10T12:00', '2026-04-12T14:00', NULL, 4, 'Taking SUV', '2026-03-01')");
  run(testDb, "INSERT INTO trip_transportation VALUES (2, 1, 2, 'rideshare', 'Raleigh, NC', '2026-04-10T13:00', NULL, NULL, NULL, 'Need a ride', '2026-03-01')");

  run(testDb, "INSERT INTO proposals VALUES (1, 1, 'Adventure Package', 'Detailed plan...', NULL, 150, '2026-03-01')");
});

describe('AGENT_TOOLS', () => {
  it('exports an array of tool definitions', () => {
    expect(Array.isArray(AGENT_TOOLS)).toBe(true);
    expect(AGENT_TOOLS.length).toBeGreaterThan(20);
  });

  it('each tool has name, description, and input_schema', () => {
    for (const tool of AGENT_TOOLS) {
      expect(tool).toHaveProperty('name');
      expect(tool).toHaveProperty('description');
      expect(tool).toHaveProperty('input_schema');
      expect(tool.input_schema.type).toBe('object');
    }
  });

  it('tool names are unique', () => {
    const names = AGENT_TOOLS.map(t => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('executeTool', () => {
  it('returns error for unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', 1, {});
    expect(result.error).toContain('Unknown tool');
  });

  describe('get_trip_overview', () => {
    it('returns trip summary with counts and costs', async () => {
      const result = await executeTool('get_trip_overview', 1);
      expect(result.trip_name).toBe('Weekend Getaway');
      expect(result.start_date).toBe('2026-04-10');
      expect(result.end_date).toBe('2026-04-12');
      expect(result.member_count).toBe(3);
      expect(result.accommodation_count).toBe(1);
      expect(result.activity_count).toBe(2); // excludes suggested
      expect(result.dining_count).toBe(1);   // excludes suggested
      expect(result.total_accommodation_cost).toBe(600);
      expect(result.total_activity_costs).toBe(40); // only non-suggested
      expect(result.total_dining_costs).toBe(30);
      expect(result.estimated_total).toBe(670);
      expect(result.estimated_per_person).toBe(Math.round(670 / 3));
    });

    it('returns error for nonexistent trip', async () => {
      const result = await executeTool('get_trip_overview', 999);
      expect(result.error).toBe('Trip not found');
    });
  });

  describe('get_trip_members', () => {
    it('returns all trip members ordered by first name', async () => {
      const result = await executeTool('get_trip_members', 1);
      expect(result).toHaveLength(3);
      expect(result[0].first_name).toBe('Alex');
      expect(result[1].first_name).toBe('Bob');
      expect(result[2].first_name).toBe('Jane');
    });
  });

  describe('get_user_bed', () => {
    it('finds bed by first name', async () => {
      const result = await executeTool('get_user_bed', 1, { name: 'Alex' });
      expect(Array.isArray(result)).toBe(true);
      expect(result[0].bed_type).toBe('king');
      expect(result[0].request_status).toBe('confirmed');
    });

    it('finds bed by full name', async () => {
      const result = await executeTool('get_user_bed', 1, { name: 'Jane Doe' });
      expect(result[0].bed_type).toBe('queen');
      expect(result[0].request_status).toBe('requested');
    });

    it('returns message when no bed found', async () => {
      const result = await executeTool('get_user_bed', 1, { name: 'Nobody' });
      expect(result.result).toContain('No bed found');
    });

    it('returns error when name is missing', async () => {
      const result = await executeTool('get_user_bed', 1, {});
      expect(result.error).toBe('name is required');
    });
  });

  describe('get_bed_availability', () => {
    it('returns all beds with their requests', async () => {
      const result = await executeTool('get_bed_availability', 1);
      expect(result).toHaveLength(3);

      const kingBed = result.find(b => b.bed_type === 'king');
      expect(kingBed.requests).toHaveLength(1);
      expect(kingBed.requests[0].status).toBe('confirmed');
    });
  });

  describe('get_unassigned_beds', () => {
    it('returns only beds without confirmed requests', async () => {
      const result = await executeTool('get_unassigned_beds', 1);
      // Bed 1 (king) has confirmed request, beds 2 and 3 do not
      expect(result).toHaveLength(2);
      const types = result.map(b => b.bed_type).sort();
      expect(types).toEqual(['queen', 'twin']);
    });
  });

  describe('get_activities', () => {
    it('returns all activities including suggested', async () => {
      const result = await executeTool('get_activities', 1);
      expect(result).toHaveLength(3);
    });
  });

  describe('get_activities_by_date', () => {
    it('filters activities by date', async () => {
      const result = await executeTool('get_activities_by_date', 1, { date: '2026-04-11' });
      expect(result).toHaveLength(2); // Hiking + Go-Kart (Spa has no datetime)
    });

    it('returns empty for date with no activities', async () => {
      const result = await executeTool('get_activities_by_date', 1, { date: '2026-04-10' });
      expect(result).toHaveLength(0);
    });

    it('returns error when date is missing', async () => {
      const result = await executeTool('get_activities_by_date', 1, {});
      expect(result.error).toContain('date is required');
    });
  });

  describe('get_suggested_activities', () => {
    it('returns only suggested activities', async () => {
      const result = await executeTool('get_suggested_activities', 1);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Spa Day');
    });
  });

  describe('search_activities', () => {
    it('searches by title', async () => {
      const result = await executeTool('search_activities', 1, { query: 'hik' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Hiking');
    });

    it('searches by description', async () => {
      const result = await executeTool('search_activities', 1, { query: 'track' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Go-Kart Racing');
    });

    it('returns empty for no matches', async () => {
      const result = await executeTool('search_activities', 1, { query: 'zzznomatch' });
      expect(result).toHaveLength(0);
    });
  });

  describe('get_cost_breakdown', () => {
    it('calculates per-person costs correctly', async () => {
      const result = await executeTool('get_cost_breakdown', 1);
      expect(result.group_size).toBe(3);
      expect(result.total_accommodation).toBe(600);
      expect(result.total_activities).toBe(40);
      expect(result.total_dining).toBe(30);
      expect(result.per_person_accommodation).toBe(200);
      expect(result.per_person_activities).toBe(Math.round(40 / 3));
      expect(result.per_person_dining).toBe(10);
    });
  });

  describe('get_itinerary', () => {
    it('returns merged timeline sorted by datetime', async () => {
      const result = await executeTool('get_itinerary', 1);
      expect(result.length).toBeGreaterThan(0);

      // Check sorted order
      for (let i = 1; i < result.length; i++) {
        expect(result[i].datetime >= result[i - 1].datetime).toBe(true);
      }

      // Should include activities, dining, check-in, check-out
      const types = new Set(result.map(e => e.type));
      expect(types.has('activity')).toBe(true);
      expect(types.has('dining')).toBe(true);
      expect(types.has('check-in')).toBe(true);
      expect(types.has('check-out')).toBe(true);
    });
  });

  describe('get_schedule_gaps', () => {
    it('finds gaps between scheduled events', async () => {
      const result = await executeTool('get_schedule_gaps', 1);
      expect(result.gaps).toBeDefined();
      expect(result.total_gaps).toBeGreaterThanOrEqual(0);

      // There should be a gap between hiking (ends 12:00) and go-kart (starts 14:00)
      const hikingGap = result.gaps.find(g => g.after === 'Hiking' && g.before === 'Go-Kart Racing');
      expect(hikingGap).toBeDefined();
      expect(hikingGap.gap_hours).toBe(2);
    });
  });

  describe('get_transportation', () => {
    it('returns all transport entries', async () => {
      const result = await executeTool('get_transportation', 1);
      expect(result).toHaveLength(2);
      expect(result[0].mode).toBe('driving');
    });
  });

  describe('get_carpool_opportunities', () => {
    it('calculates carpool supply and demand', async () => {
      const result = await executeTool('get_carpool_opportunities', 1);
      expect(result.drivers).toHaveLength(1);
      expect(result.drivers[0].available_seats).toBe(3); // 4 capacity - 1 driver
      expect(result.people_needing_rides).toHaveLength(1);
      expect(result.total_available_seats).toBe(3);
      expect(result.total_needing_rides).toBe(1);
      expect(result.seats_balance).toBe(2);
    });
  });

  describe('get_eats', () => {
    it('returns all dining entries', async () => {
      const result = await executeTool('get_eats', 1);
      expect(result).toHaveLength(2);
    });
  });

  describe('search_eats', () => {
    it('searches by title', async () => {
      const result = await executeTool('search_eats', 1, { query: 'Italian' });
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Italian Dinner');
    });
  });

  describe('get_proposals', () => {
    it('returns saved proposals', async () => {
      const result = await executeTool('get_proposals', 1);
      expect(result).toHaveLength(1);
      expect(result[0].proposal_name).toBe('Adventure Package');
    });
  });

  describe('get_bedroom_pricing', () => {
    it('returns bedroom price adjustments', async () => {
      const result = await executeTool('get_bedroom_pricing', 1);
      expect(result).toHaveLength(2);
      const master = result.find(r => r.bedroom_name === 'Master Bedroom');
      expect(master.price_share_adjustment).toBe(50);
      const guest = result.find(r => r.bedroom_name === 'Guest Room');
      expect(guest.price_share_adjustment).toBe(-25);
    });
  });
});
