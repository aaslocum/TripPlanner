import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// Create bed
router.post('/', adminMiddleware, async (req, res) => {
  const { bedroom_id, bed_type } = req.body;
  const db = await getDb();
  const result = run(db,
    'INSERT INTO beds (bedroom_id, bed_type) VALUES (?, ?)',
    [bedroom_id, bed_type || 'queen']);
  const bed = get(db, 'SELECT * FROM beds WHERE bed_id = ?', [result.lastInsertRowid]);
  res.status(201).json({ success: true, data: bed });
});

// Update bed
router.put('/:id', adminMiddleware, async (req, res) => {
  const { bed_type } = req.body;
  const db = await getDb();
  run(db, 'UPDATE beds SET bed_type = ? WHERE bed_id = ?', [bed_type, req.params.id]);
  const bed = get(db, 'SELECT * FROM beds WHERE bed_id = ?', [req.params.id]);
  res.json({ success: true, data: bed });
});

// Delete bed
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM beds WHERE bed_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
