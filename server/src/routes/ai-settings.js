import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware, adminMiddleware);

// GET /api/ai-settings — return all settings as key/value map
router.get('/', async (req, res) => {
  const db = await getDb();
  const rows = all(db, 'SELECT key, value FROM ai_settings ORDER BY key');
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ success: true, data: settings });
});

// PUT /api/ai-settings — bulk upsert settings
router.put('/', async (req, res) => {
  const db = await getDb();
  const updates = req.body; // { key: value, ... }
  for (const [key, value] of Object.entries(updates)) {
    run(db,
      `INSERT INTO ai_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [key, value]
    );
  }
  const rows = all(db, 'SELECT key, value FROM ai_settings ORDER BY key');
  const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json({ success: true, data: settings });
});

export default router;
