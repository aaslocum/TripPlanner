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

// Assign user to bed
router.put('/:id/assign', adminMiddleware, async (req, res) => {
  const { user_id } = req.body;
  const db = await getDb();
  run(db, 'UPDATE beds SET assigned_user_id = ? WHERE bed_id = ?', [user_id, req.params.id]);
  const bed = get(db, `
    SELECT b.*, u.first_name, u.last_name
    FROM beds b
    LEFT JOIN users u ON b.assigned_user_id = u.user_id
    WHERE b.bed_id = ?
  `, [req.params.id]);
  res.json({ success: true, data: bed });
});

// Claim a bed (any authenticated trip member — sets themselves as assigned user)
router.post('/:id/claim', async (req, res) => {
  const db = await getDb();
  const bed = get(db, 'SELECT * FROM beds WHERE bed_id = ?', [req.params.id]);
  if (!bed) return res.status(404).json({ success: false, error: { message: 'Bed not found' } });
  if (bed.assigned_user_id && bed.assigned_user_id !== req.user.user_id) {
    return res.status(409).json({ success: false, error: { message: 'This bed is already taken' } });
  }
  run(db, 'UPDATE beds SET assigned_user_id = ? WHERE bed_id = ?', [req.user.user_id, req.params.id]);
  const updated = get(db, `
    SELECT b.*, u.first_name, u.last_name
    FROM beds b
    LEFT JOIN users u ON b.assigned_user_id = u.user_id
    WHERE b.bed_id = ?
  `, [req.params.id]);
  res.json({ success: true, data: updated });
});

// Delete bed
router.delete('/:id', adminMiddleware, async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM beds WHERE bed_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
