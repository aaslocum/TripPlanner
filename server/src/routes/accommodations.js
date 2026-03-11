import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// List accommodations for a trip
router.get('/trip/:tripId', async (req, res) => {
  const db = await getDb();
  const accommodations = all(db,
    'SELECT * FROM accommodations WHERE trip_id = ? ORDER BY check_in_datetime',
    [req.params.tripId]);
  for (const acc of accommodations) {
    const img = get(db,
      'SELECT image_url FROM accommodation_images WHERE accommodation_id = ? ORDER BY sort_order ASC LIMIT 1',
      [acc.accommodation_id]);
    acc.image_url = img ? img.image_url : null;
  }
  res.json({ success: true, data: accommodations });
});

// Get single accommodation with bedrooms, beds, and images
router.get('/:id', async (req, res) => {
  const db = await getDb();
  const acc = get(db, 'SELECT * FROM accommodations WHERE accommodation_id = ?', [req.params.id]);
  if (!acc) return res.status(404).json({ success: false, error: { message: 'Not found' } });

  const bedrooms = all(db, 'SELECT * FROM bedrooms WHERE accommodation_id = ?', [req.params.id]);
  for (const bedroom of bedrooms) {
    bedroom.beds = all(db, 'SELECT * FROM beds WHERE bedroom_id = ?', [bedroom.bedroom_id]);
    for (const bed of bedroom.beds) {
      bed.requests = all(db, `
        SELECT br.*, u.first_name, u.last_name
        FROM bed_requests br JOIN users u ON br.user_id = u.user_id
        WHERE br.bed_id = ?
        ORDER BY br.status DESC, br.created_at
      `, [bed.bed_id]);
    }
    bedroom.images = all(db,
      'SELECT * FROM accommodation_images WHERE bedroom_id = ? ORDER BY sort_order',
      [bedroom.bedroom_id]);
  }

  const images = all(db, 'SELECT * FROM accommodation_images WHERE accommodation_id = ? AND bedroom_id IS NULL ORDER BY sort_order',
    [req.params.id]);

  res.json({ success: true, data: { ...acc, bedrooms, images } });
});

// Create accommodation
router.post('/', adminMiddleware, async (req, res) => {
  const { trip_id, airbnb_id, airbnb_url, description, address, check_in_datetime, check_out_datetime, total_cost } = req.body;
  const db = await getDb();
  const result = run(db, `
    INSERT INTO accommodations (trip_id, airbnb_id, airbnb_url, description, address, check_in_datetime, check_out_datetime, total_cost)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [trip_id, airbnb_id, airbnb_url || null, description, address, check_in_datetime, check_out_datetime, total_cost]);
  const acc = get(db, 'SELECT * FROM accommodations WHERE accommodation_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: acc });
});

// Update accommodation
router.put('/:id', adminMiddleware, async (req, res) => {
  const { airbnb_id, airbnb_url, description, address, check_in_datetime, check_out_datetime, total_cost } = req.body;
  const db = await getDb();
  run(db, `
    UPDATE accommodations SET airbnb_id = ?, airbnb_url = ?, description = ?, address = ?,
    check_in_datetime = ?, check_out_datetime = ?, total_cost = ?
    WHERE accommodation_id = ?
  `, [airbnb_id, airbnb_url, description, address, check_in_datetime, check_out_datetime, total_cost, req.params.id]);
  const acc = get(db, 'SELECT * FROM accommodations WHERE accommodation_id = ?', [req.params.id]);
  res.json({ success: true, data: acc });
});

// Delete accommodation
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM accommodations WHERE accommodation_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
