import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List all bed requests for an accommodation (with bed/bedroom/user info)
router.get('/accommodation/:accommodationId', async (req, res) => {
  const db = await getDb();
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
  `, [req.params.accommodationId]);
  res.json({ success: true, data: requests });
});

// Create a bed request (any authenticated trip member)
router.post('/', async (req, res) => {
  const { bed_id, user_id } = req.body;
  const requestUserId = user_id || req.user.user_id;
  const db = await getDb();

  // Verify the bed exists
  const bed = get(db, 'SELECT * FROM beds WHERE bed_id = ?', [bed_id]);
  if (!bed) return res.status(404).json({ success: false, error: { message: 'Bed not found' } });

  // Verify user is a member of the trip that owns this bed
  const bedroom = get(db, 'SELECT accommodation_id FROM bedrooms WHERE bedroom_id = ?', [bed.bedroom_id]);
  const accom = get(db, 'SELECT trip_id FROM accommodations WHERE accommodation_id = ?', [bedroom?.accommodation_id]);
  if (accom && req.user.role !== 'admin') {
    const member = get(db, 'SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?',
      [accom.trip_id, requestUserId]);
    if (!member) {
      return res.status(403).json({ success: false, error: { message: 'Not a member of this trip' } });
    }
  }

  // Check if user already requested this bed
  const existing = get(db,
    'SELECT * FROM bed_requests WHERE bed_id = ? AND user_id = ?',
    [bed_id, requestUserId]);
  if (existing) {
    return res.status(409).json({ success: false, error: { message: 'Already requested this bed' } });
  }

  const result = run(db,
    'INSERT INTO bed_requests (bed_id, user_id) VALUES (?, ?)',
    [bed_id, requestUserId]);
  const request = get(db, `
    SELECT br.*, u.first_name, u.last_name
    FROM bed_requests br JOIN users u ON br.user_id = u.user_id
    WHERE br.request_id = ?
  `, [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: request });
});

// Confirm a bed request (admin only)
router.put('/:id/confirm', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, "UPDATE bed_requests SET status = 'confirmed' WHERE request_id = ?", [req.params.id]);
  const request = get(db, `
    SELECT br.*, u.first_name, u.last_name
    FROM bed_requests br JOIN users u ON br.user_id = u.user_id
    WHERE br.request_id = ?
  `, [req.params.id]);
  if (!request) return res.status(404).json({ success: false, error: { message: 'Not found' } });
  res.json({ success: true, data: request });
});

// Delete a bed request (admin can remove any; non-admin can withdraw own pending)
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  const request = get(db, 'SELECT * FROM bed_requests WHERE request_id = ?', [req.params.id]);
  if (!request) return res.status(404).json({ success: false, error: { message: 'Not found' } });

  if (req.user.role !== 'admin') {
    if (request.user_id !== req.user.user_id || request.status !== 'requested') {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }
  }

  run(db, 'DELETE FROM bed_requests WHERE request_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
