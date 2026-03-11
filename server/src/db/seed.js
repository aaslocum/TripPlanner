import '../config/env.js';
import { getDb, saveDb, get, run } from './connection.js';

async function seed() {
  const db = await getDb();
  console.log('Seeding database...');

  // Seed admin user
  const existing = get(db, 'SELECT user_id FROM users WHERE email = ?', ['a.alex.slocum@gmail.com']);
  if (!existing) {
    run(db, `INSERT INTO users (first_name, last_name, email, role) VALUES (?, ?, ?, ?)`,
      ['Alex', 'Slocum', 'a.alex.slocum@gmail.com', 'admin']);
  }

  const alex = get(db, 'SELECT user_id FROM users WHERE email = ?', ['a.alex.slocum@gmail.com']);

  // Seed a sample trip
  let trip = get(db, "SELECT trip_id FROM trips WHERE trip_name = ?", ['Weekend Getaway']);
  if (!trip) {
    const result = run(db,
      `INSERT INTO trips (trip_name, start_date, end_date) VALUES (?, ?, ?)`,
      ['Weekend Getaway', '2026-04-10', '2026-04-12']);
    trip = { trip_id: result.lastInsertRowid };
  }

  // Link Alex to the trip
  const membership = get(db, 'SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?',
    [trip.trip_id, alex.user_id]);
  if (!membership) {
    run(db, 'INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)',
      [trip.trip_id, alex.user_id]);
  }

  // Set Alex's RSVP to confirmed with trip dates
  run(db,
    `UPDATE trip_members SET rsvp_status = 'yes', arrival_date = '2026-04-10', departure_date = '2026-04-12'
     WHERE trip_id = ? AND user_id = ?`,
    [trip.trip_id, alex.user_id]);

  console.log(`  Admin user: Alex Slocum (ID: ${alex.user_id})`);
  console.log(`  Sample trip: Weekend Getaway (ID: ${trip.trip_id})`);
  console.log('Seeding complete.');

  saveDb();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
