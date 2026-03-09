import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

// List proposals for a trip
router.get('/trip/:tripId', async (req, res) => {
  const db = await getDb();
  const proposals = all(db,
    'SELECT * FROM proposals WHERE trip_id = ? ORDER BY created_at DESC',
    [req.params.tripId]
  );
  proposals.forEach(p => { p.places = JSON.parse(p.places || '[]'); });
  res.json({ success: true, data: proposals });
});

// Create proposal
router.post('/', async (req, res) => {
  const { trip_id, proposal_name, proposal_text, places, estimated_cost } = req.body;
  const db = await getDb();
  const result = run(db,
    'INSERT INTO proposals (trip_id, proposal_name, proposal_text, places, estimated_cost) VALUES (?, ?, ?, ?, ?)',
    [trip_id, proposal_name, proposal_text, JSON.stringify(places || []), estimated_cost ?? null]
  );
  const proposal = get(db, 'SELECT * FROM proposals WHERE proposal_id = ?', [result.lastInsertRowid]);
  proposal.places = JSON.parse(proposal.places || '[]');
  res.status(201).json({ success: true, data: proposal });
});

// Update proposal
router.put('/:id', async (req, res) => {
  const { proposal_name, proposal_text, places, estimated_cost } = req.body;
  const db = await getDb();
  run(db,
    'UPDATE proposals SET proposal_name = ?, proposal_text = ?, places = ?, estimated_cost = ? WHERE proposal_id = ?',
    [proposal_name, proposal_text, JSON.stringify(places || []), estimated_cost ?? null, req.params.id]
  );
  const proposal = get(db, 'SELECT * FROM proposals WHERE proposal_id = ?', [req.params.id]);
  proposal.places = JSON.parse(proposal.places || '[]');
  res.json({ success: true, data: proposal });
});

// Delete proposal
router.delete('/:id', async (req, res) => {
  const db = await getDb();
  run(db, 'DELETE FROM proposals WHERE proposal_id = ?', [req.params.id]);
  res.json({ success: true, data: null });
});

export default router;
