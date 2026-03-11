import { Router } from 'express';
import { authMiddleware, adminMiddleware, tripMemberMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router({ mergeParams: true }); // inherit :tripId from parent
router.use(authMiddleware);

// List transportation for a trip (members only)
router.get('/', tripMemberMiddleware(req => req.params.tripId), async (req, res) => {
  const db = await getDb();
  const rows = all(db,
    `SELECT t.transport_id, t.trip_id, t.user_id,
            u.first_name, u.last_name, u.email,
            t.mode, t.departure_from, t.arrival_datetime, t.return_datetime,
            t.flight_number, t.car_capacity, t.notes, t.created_at
     FROM trip_transportation t
     JOIN users u ON t.user_id = u.user_id
     WHERE t.trip_id = ?
     ORDER BY t.arrival_datetime`,
    [req.params.tripId]);
  res.json({ success: true, data: rows });
});

// Create transport entry (admin can create for anyone, users can create their own)
router.post('/', tripMemberMiddleware(req => req.params.tripId), async (req, res) => {
  const { user_id, mode, departure_from, arrival_datetime, return_datetime,
          flight_number, car_capacity, notes } = req.body;

  const effectiveUserId = req.user.role === 'admin' ? user_id : req.user.user_id;

  if (!effectiveUserId || !mode) {
    return res.status(400).json({ success: false, error: { message: 'user_id and mode are required' } });
  }

  // Non-admins can only create their own entry
  if (req.user.role !== 'admin' && user_id && Number(user_id) !== req.user.user_id) {
    return res.status(403).json({ success: false, error: { message: 'You can only add your own transport entry' } });
  }

  const db = await getDb();
  const result = run(db,
    `INSERT INTO trip_transportation
       (trip_id, user_id, mode, departure_from, arrival_datetime, return_datetime,
        flight_number, car_capacity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.params.tripId, effectiveUserId, mode, departure_from || null, arrival_datetime || null,
     return_datetime || null, flight_number || null, car_capacity || null, notes || null]);

  const row = get(db,
    `SELECT t.*, u.first_name, u.last_name, u.email
     FROM trip_transportation t JOIN users u ON t.user_id = u.user_id
     WHERE t.transport_id = ?`,
    [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: row });
});

// Update transport entry (admin can update any, users can update their own)
router.put('/:transportId', tripMemberMiddleware(req => req.params.tripId), async (req, res) => {
  const { mode, departure_from, arrival_datetime, return_datetime,
          flight_number, car_capacity, notes } = req.body;
  const db = await getDb();

  const existing = get(db,
    'SELECT * FROM trip_transportation WHERE transport_id = ? AND trip_id = ?',
    [req.params.transportId, req.params.tripId]);
  if (!existing) return res.status(404).json({ success: false, error: { message: 'Not found' } });

  // Non-admins can only update their own entry
  if (req.user.role !== 'admin' && existing.user_id !== req.user.user_id) {
    return res.status(403).json({ success: false, error: { message: 'You can only edit your own transport entry' } });
  }

  run(db,
    `UPDATE trip_transportation SET mode = ?, departure_from = ?, arrival_datetime = ?,
       return_datetime = ?, flight_number = ?, car_capacity = ?, notes = ?
     WHERE transport_id = ?`,
    [mode || existing.mode, departure_from ?? existing.departure_from,
     arrival_datetime ?? existing.arrival_datetime, return_datetime ?? existing.return_datetime,
     flight_number ?? existing.flight_number, car_capacity ?? existing.car_capacity,
     notes ?? existing.notes, req.params.transportId]);

  const row = get(db,
    `SELECT t.*, u.first_name, u.last_name, u.email
     FROM trip_transportation t JOIN users u ON t.user_id = u.user_id
     WHERE t.transport_id = ?`,
    [req.params.transportId]);
  res.json({ success: true, data: row });
});

// Delete transport entry (admin can delete any, users can delete their own)
router.delete('/:transportId', tripMemberMiddleware(req => req.params.tripId), async (req, res) => {
  const db = await getDb();
  const existing = get(db,
    'SELECT * FROM trip_transportation WHERE transport_id = ? AND trip_id = ?',
    [req.params.transportId, req.params.tripId]);
  if (!existing) return res.status(404).json({ success: false, error: { message: 'Not found' } });

  // Non-admins can only delete their own entry
  if (req.user.role !== 'admin' && existing.user_id !== req.user.user_id) {
    return res.status(403).json({ success: false, error: { message: 'You can only delete your own transport entry' } });
  }

  run(db, 'DELETE FROM trip_transportation WHERE transport_id = ? AND trip_id = ?',
    [req.params.transportId, req.params.tripId]);
  res.json({ success: true, data: null });
});

export default router;
