import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List activities for a trip
router.get('/trip/:tripId', async (req, res) => {
  const db = await getDb();
  const activities = all(db,
    'SELECT * FROM activities WHERE trip_id = ? ORDER BY start_datetime',
    [req.params.tripId]);
  res.json({ success: true, data: activities });
});

// Get single activity
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const activity = get(db, 'SELECT * FROM activities WHERE activity_id = ?', [req.params.id]);
  if (!activity) return res.status(404).json({ success: false, error: { message: 'Not found' } });
  res.json({ success: true, data: activity });
});

// Create activity
router.post('/', adminMiddleware, async (req, res) => {
  const { trip_id, title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost } = req.body;
  const db = await getDb();
  const result = run(db, `
    INSERT INTO activities (trip_id, title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [trip_id, title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost]);
  const activity = get(db, 'SELECT * FROM activities WHERE activity_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: activity });
});

// Update activity
router.put('/:id', adminMiddleware, async (req, res) => {
  const { title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost } = req.body;
  const db = await getDb();
  run(db, `
    UPDATE activities SET title = ?, description = ?, image_url = ?, google_place_id = ?,
    start_datetime = ?, end_datetime = ?, estimated_cost = ?
    WHERE activity_id = ?
  `, [title, description, image_url, google_place_id, start_datetime, end_datetime, estimated_cost, req.params.id]);
  const activity = get(db, 'SELECT * FROM activities WHERE activity_id = ?', [req.params.id]);
  res.json({ success: true, data: activity });
});

// Delete activity
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM activities WHERE activity_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
