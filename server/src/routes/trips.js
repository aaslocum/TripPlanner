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

// List ALL trips (admin only) with member counts
router.get('/all', adminMiddleware, async (req, res) => {
  const db = await getDb();
  const trips = all(db, `
    SELECT t.*,
           (SELECT COUNT(*) FROM trip_members tm WHERE tm.trip_id = t.trip_id) AS member_count
    FROM trips t
    ORDER BY t.start_date DESC
  `);
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
  const { trip_name, start_date, end_date, color, description, image_url } = req.body;
  const db = await getDb();
  const result = run(db,
    'INSERT INTO trips (trip_name, start_date, end_date, color, description, image_url) VALUES (?, ?, ?, ?, ?, ?)',
    [trip_name, start_date, end_date, color || 'green', description || null, image_url || null]);
  // Auto-add creator as member
  run(db, 'INSERT INTO trip_members (trip_id, user_id) VALUES (?, ?)',
    [result.lastInsertRowid, req.user.user_id]);
  const trip = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: trip });
});

// Update trip
router.put('/:tripId', adminMiddleware, async (req, res) => {
  const db = await getDb();
  const existing = get(db, 'SELECT * FROM trips WHERE trip_id = ?', [req.params.tripId]);
  if (!existing) return res.status(404).json({ success: false, error: { message: 'Trip not found' } });

  const trip_name = req.body.trip_name !== undefined ? req.body.trip_name : existing.trip_name;
  const start_date = req.body.start_date !== undefined ? req.body.start_date : existing.start_date;
  const end_date = req.body.end_date !== undefined ? req.body.end_date : existing.end_date;
  const color = req.body.color || existing.color || 'green';
  const description = req.body.description !== undefined ? req.body.description : existing.description;
  const image_url = req.body.image_url !== undefined ? req.body.image_url : existing.image_url;

  run(db, 'UPDATE trips SET trip_name = ?, start_date = ?, end_date = ?, color = ?, description = ?, image_url = ? WHERE trip_id = ?',
    [trip_name, start_date, end_date, color, description || null, image_url || null, req.params.tripId]);
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
    SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, u.avatar_url,
           tm.rsvp_status, tm.arrival_date, tm.departure_date
    FROM users u
    INNER JOIN trip_members tm ON u.user_id = tm.user_id
    WHERE tm.trip_id = ?
  `, [req.params.tripId]);
  res.json({ success: true, data: members });
});

// Get own membership info (RSVP status, dates)
router.get('/:tripId/members/me', async (req, res) => {
  const db = await getDb();
  const membership = get(db, `
    SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, u.avatar_url,
           tm.rsvp_status, tm.arrival_date, tm.departure_date
    FROM users u
    INNER JOIN trip_members tm ON u.user_id = tm.user_id
    WHERE tm.trip_id = ? AND tm.user_id = ?
  `, [req.params.tripId, req.user.user_id]);
  if (!membership) {
    return res.status(404).json({ success: false, error: { message: 'Not a member of this trip' } });
  }
  res.json({ success: true, data: membership });
});

// Self-service: update own RSVP and travel dates
router.put('/:tripId/members/me', async (req, res) => {
  const { rsvp_status, arrival_date, departure_date } = req.body;
  const tripId = req.params.tripId;
  const userId = req.user.user_id;

  if (rsvp_status && !['pending', 'yes', 'no'].includes(rsvp_status)) {
    return res.status(400).json({ success: false, error: { message: 'rsvp_status must be pending, yes, or no' } });
  }

  const db = await getDb();
  const membership = get(db, 'SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?', [tripId, userId]);
  if (!membership) {
    return res.status(404).json({ success: false, error: { message: 'Not a member of this trip' } });
  }

  const updates = [];
  const params = [];
  if (rsvp_status !== undefined) { updates.push('rsvp_status = ?'); params.push(rsvp_status); }
  if (arrival_date !== undefined) { updates.push('arrival_date = ?'); params.push(arrival_date || null); }
  if (departure_date !== undefined) { updates.push('departure_date = ?'); params.push(departure_date || null); }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'No fields to update' } });
  }

  params.push(tripId, userId);
  run(db, `UPDATE trip_members SET ${updates.join(', ')} WHERE trip_id = ? AND user_id = ?`, params);

  const updated = get(db, `
    SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, u.avatar_url,
           tm.rsvp_status, tm.arrival_date, tm.departure_date
    FROM users u
    INNER JOIN trip_members tm ON u.user_id = tm.user_id
    WHERE tm.trip_id = ? AND tm.user_id = ?
  `, [tripId, userId]);
  res.json({ success: true, data: updated });
});

// Admin: update any member's RSVP and travel dates
router.put('/:tripId/members/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  const { rsvp_status, arrival_date, departure_date } = req.body;
  const { tripId, userId } = req.params;

  if (rsvp_status && !['pending', 'yes', 'no'].includes(rsvp_status)) {
    return res.status(400).json({ success: false, error: { message: 'rsvp_status must be pending, yes, or no' } });
  }

  const db = await getDb();
  const membership = get(db, 'SELECT * FROM trip_members WHERE trip_id = ? AND user_id = ?', [tripId, userId]);
  if (!membership) {
    return res.status(404).json({ success: false, error: { message: 'Member not found in this trip' } });
  }

  const updates = [];
  const params = [];
  if (rsvp_status !== undefined) { updates.push('rsvp_status = ?'); params.push(rsvp_status); }
  if (arrival_date !== undefined) { updates.push('arrival_date = ?'); params.push(arrival_date || null); }
  if (departure_date !== undefined) { updates.push('departure_date = ?'); params.push(departure_date || null); }

  if (updates.length === 0) {
    return res.status(400).json({ success: false, error: { message: 'No fields to update' } });
  }

  params.push(tripId, userId);
  run(db, `UPDATE trip_members SET ${updates.join(', ')} WHERE trip_id = ? AND user_id = ?`, params);

  const updated = get(db, `
    SELECT u.user_id, u.first_name, u.last_name, u.email, u.role, u.avatar_url,
           tm.rsvp_status, tm.arrival_date, tm.departure_date
    FROM users u
    INNER JOIN trip_members tm ON u.user_id = tm.user_id
    WHERE tm.trip_id = ? AND tm.user_id = ?
  `, [tripId, userId]);
  res.json({ success: true, data: updated });
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

// Itinerary - merged timeline of accommodations + activities + eats
router.get('/:tripId/itinerary', async (req, res) => {
  const db = await getDb();
  const accommodations = all(db,
    'SELECT * FROM accommodations WHERE trip_id = ?', [req.params.tripId]);
  const activities = all(db,
    'SELECT * FROM activities WHERE trip_id = ? ORDER BY start_datetime', [req.params.tripId]);
  const eatsRows = all(db,
    'SELECT * FROM eats WHERE trip_id = ? ORDER BY start_datetime', [req.params.tripId]);

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

  for (const eat of eatsRows) {
    events.push({
      type: 'eat',
      title: eat.title,
      datetime: eat.start_datetime,
      end_datetime: eat.end_datetime,
      details: eat,
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
