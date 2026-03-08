import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List trips for current user
router.get('/', async (req, res) => {
  const db = await getDb();
  const trips = all(db, `
    SELECT t.* FROM trips t
    INNER JOIN trip_members tm ON t.trip_id = tm.trip_id
    WHERE tm.user_id = ?
    ORDER BY t.start_date DESC
  `, [req.user.user_id]);
  res.json({ success: true, data: trips });
});

// Get single trip
router.get('/:tripId', async (req, res) => {
  const db = await getDb();
  const trip = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [req.params.tripId]);
  if (!trip) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });
  res.json({ success: true, data: trip });
});

// Create trip
router.post('/', adminMiddleware, async (req, res) => {
  const { trip_name, start_date, end_date } = req.body;
  const db = await getDb();
  const result = run(db,
    'INSERT INTO trips (trip_name, start_date, end_date) VALUES (?, ?, ?)',
    [trip_name, start_date, end_date]);
  // Auto-add creator as member
  run(db, 'INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)',
    [result.lastInsertRowid, req.user.user_id]);
  const trip = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: trip });
});

// Update trip
router.put('/:tripId', adminMiddleware, async (req, res) => {
  const { trip_name, start_date, end_date } = req.body;
  const db = await getDb();
  run(db, 'UPDATE trips SET trip_name = ?, start_date = ?, end_date = ? WHERE trip_id = ?',
    [trip_name, start_date, end_date, req.params.tripId]);
  const trip = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [req.params.tripId]);
  res.json({ success: true, data: trip });
});

// Delete trip
router.delete('/:tripId', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM trips WHERE trip_id = ?', [req.params.tripId]);
  res.json({ success: true, data: null });
});

// List trip members
router.get('/:tripId/members', async (req, res) => {
  const db = await getDb();
  const members = all(db, `
    SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, u.avatar_url
    FROM users u
    INNER JOIN trip_members tm ON u.user_id = tm.user_id
    WHERE tm.trip_id = ?
  `, [req.params.tripId]);
  res.json({ success: true, data: members });
});

// Add member to trip
router.post('/:tripId/members', adminMiddleware, async (req, res) => {
  const { user_id } = req.body;
  const db = await getDb();
  run(db, 'INSERT OR IGNORE INTO trip_members (trip_id, user_id) VALUES (?, ?)',
    [req.params.tripId, user_id]);
  res.status(201).json({ success: true, data: null });
});

// Bulk add members - accepts array of {email, first_name?, last_name?}
// Creates users that don't exist, adds all as trip members
router.post('/:tripId/members/bulk', adminMiddleware, async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'entries array is required' } });
  }

  const db = await getDb();
  const results = [];

  for (const entry of entries) {
    if (!entry.email) continue;
    const email = entry.email.trim().toLowerCase();

    // Find or create user
    let user = get(db, 'SELECT * FROM users WHERE LOWER(email) = ?', [email]);
    if (!user) {
      const result = run(db,
        'INSERT INTO users (first_name, last_name, email, role) VALUES (?, ?, ?, ?)',
        [entry.first_name || '', entry.last_name || '', email, 'user']);
      user = get(db, 'SELECT * FROM users WHERE user_id = ?', [result.lastInsertRowid]);
    }

    // Add as trip member (ignore if already a member)
    run(db, 'INSERT OR IGNORE INTO trip_members (trip_id, user_id) VALUES (?, ?)',
      [req.params.tripId, user.user_id]);

    results.push({ user_id: user.user_id, email: user.email, first_name: user.first_name, last_name: user.last_name });
  }

  res.status(201).json({ success: true, data: { added: results.length, members: results } });
});

// Remove member from trip
router.delete('/:tripId/members/:userId', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?',
    [req.params.tripId, req.params.userId]);
  res.json({ success: true, data: null });
});

// Itinerary - merged timeline of accommodations + activities
router.get('/:tripId/itinerary', async (req, res) => {
  const db = await getDb();
  const accommodations = all(db,
    'SELECT * FROM accommodations WHERE trip_id = ?', [req.params.tripId]);
  const activities = all(db,
    'SELECT * FROM activities WHERE trip_id = ? ORDER BY start_datetime', [req.params.tripId]);

  const events = [];

  for (const acc of accommodations) {
    if (acc.check_in_datetime) {
      events.push({
        type: 'check_in',
        title: `Check-in: ${acc.description || 'Accommodation'}`,
        datetime: acc.check_in_datetime,
        details: acc,
      });
    }
    if (acc.check_out_datetime) {
      events.push({
        type: 'check_out',
        title: `Check-out: ${acc.description || 'Accommodation'}`,
        datetime: acc.check_out_datetime,
        details: acc,
      });
    }
  }

  for (const act of activities) {
    events.push({
      type: 'activity',
      title: act.title,
      datetime: act.start_datetime,
      end_datetime: act.end_datetime,
      details: act,
    });
  }

  events.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));

  // Group by date
  const grouped = {};
  for (const event of events) {
    const date = event.datetime ? event.datetime.split('T')[0] : 'Unscheduled';
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(event);
  }

  res.json({ success: true, data: grouped });
});

export default router;
