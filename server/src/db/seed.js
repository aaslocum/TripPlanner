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

  // Seed gear items
  let gearItem1 = get(db, "SELECT item_id FROM gear_items WHERE trip_id = ? AND description = ?",
    [trip.trip_id, 'Large Cooler']);
  if (!gearItem1) {
    const r = run(db,
      `INSERT INTO gear_items (trip_id, description, notes, quantity, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [trip.trip_id, 'Large Cooler', 'Big enough for drinks and snacks for the group', 2, alex.user_id]);
    gearItem1 = { item_id: r.lastInsertRowid };
  }

  let gearItem2 = get(db, "SELECT item_id FROM gear_items WHERE trip_id = ? AND description = ?",
    [trip.trip_id, 'Bluetooth Speaker']);
  if (!gearItem2) {
    const r = run(db,
      `INSERT INTO gear_items (trip_id, description, notes, quantity, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [trip.trip_id, 'Bluetooth Speaker', 'Waterproof preferred for outdoor use', 1, alex.user_id]);
    gearItem2 = { item_id: r.lastInsertRowid };
  }

  let gearItem3 = get(db, "SELECT item_id FROM gear_items WHERE trip_id = ? AND description = ?",
    [trip.trip_id, 'Sunscreen SPF 50']);
  if (!gearItem3) {
    const r = run(db,
      `INSERT INTO gear_items (trip_id, description, notes, quantity, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [trip.trip_id, 'Sunscreen SPF 50', null, 3, alex.user_id]);
    gearItem3 = { item_id: r.lastInsertRowid };
  }

  // Seed gear claims (Alex claims 1 cooler and the speaker)
  const gearClaim1 = get(db, 'SELECT claim_id FROM gear_claims WHERE item_id = ? AND user_id = ?',
    [gearItem1.item_id, alex.user_id]);
  if (!gearClaim1) {
    run(db, 'INSERT INTO gear_claims (item_id, user_id, quantity) VALUES (?, ?, ?)',
      [gearItem1.item_id, alex.user_id, 1]);
  }

  const gearClaim2 = get(db, 'SELECT claim_id FROM gear_claims WHERE item_id = ? AND user_id = ?',
    [gearItem2.item_id, alex.user_id]);
  if (!gearClaim2) {
    run(db, 'INSERT INTO gear_claims (item_id, user_id, quantity) VALUES (?, ?, ?)',
      [gearItem2.item_id, alex.user_id, 1]);
  }

  console.log(`  Admin user: Alex Slocum (ID: ${alex.user_id})`);
  console.log(`  Sample trip: Weekend Getaway (ID: ${trip.trip_id})`);
  console.log(`  Gear items: 3 seeded, 2 claims`);
  console.log('Seeding complete.');

  saveDb();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
