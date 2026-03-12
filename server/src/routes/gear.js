import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDb, all, get, run } from '../db/connection.js';

const router = Router();
router.use(authMiddleware);

// Helper: fetch a single item with its claims and computed fields
async function fetchItemWithClaims(db, itemId) {
  const item = get(db,
    `SELECT gi.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name
     FROM gear_items gi
     LEFT JOIN users u ON gi.created_by = u.user_id
     WHERE gi.item_id = ?`,
    [itemId]
  );
  if (!item) return null;

  item.claims = all(db,
    `SELECT gc.claim_id, gc.user_id, gc.quantity, gc.created_at,
            u.first_name, u.last_name
     FROM gear_claims gc
     JOIN users u ON gc.user_id = u.user_id
     WHERE gc.item_id = ?
     ORDER BY gc.created_at`,
    [item.item_id]
  );
  item.total_claimed = item.claims.reduce((sum, c) => sum + c.quantity, 0);
  item.remaining = item.quantity - item.total_claimed;
  return item;
}

// GET /trip/:tripId — list all gear items with claims
router.get('/trip/:tripId', async (req, res) => {
  try {
    const db = await getDb();
    const items = all(db,
      `SELECT gi.*, u.first_name AS creator_first_name, u.last_name AS creator_last_name
       FROM gear_items gi
       LEFT JOIN users u ON gi.created_by = u.user_id
       WHERE gi.trip_id = ?
       ORDER BY gi.created_at DESC`,
      [req.params.tripId]
    );

    for (const item of items) {
      item.claims = all(db,
        `SELECT gc.claim_id, gc.user_id, gc.quantity, gc.created_at,
                u.first_name, u.last_name
         FROM gear_claims gc
         JOIN users u ON gc.user_id = u.user_id
         WHERE gc.item_id = ?
         ORDER BY gc.created_at`,
        [item.item_id]
      );
      item.total_claimed = item.claims.reduce((sum, c) => sum + c.quantity, 0);
      item.remaining = item.quantity - item.total_claimed;
    }

    res.json({ success: true, data: items });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// GET /:id — single item with claims
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const item = await fetchItemWithClaims(db, req.params.id);
    if (!item) return res.status(404).json({ success: false, error: { message: 'Not found' } });
    res.json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST / — create gear item (any trip member)
router.post('/', async (req, res) => {
  try {
    const { trip_id, description, notes, quantity, image_url, claim_all } = req.body;
    if (!trip_id || !description) {
      return res.status(400).json({ success: false, error: { message: 'trip_id and description are required' } });
    }

    const db = await getDb();

    // Verify trip membership (admin bypasses)
    if (req.user.role !== 'admin') {
      const member = get(db, 'SELECT 1 FROM trip_members WHERE trip_id = ? AND user_id = ?',
        [trip_id, req.user.user_id]);
      if (!member) {
        return res.status(403).json({ success: false, error: { message: 'Not a member of this trip' } });
      }
    }

    const qty = quantity || 1;
    const result = run(db,
      `INSERT INTO gear_items (trip_id, description, notes, quantity, image_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trip_id, description, notes || null, qty, image_url || null, req.user.user_id]
    );

    const itemId = result.lastInsertRowid;

    // Auto-claim if requested
    if (claim_all) {
      const rsvp = get(db, "SELECT rsvp_status FROM trip_members WHERE trip_id = ? AND user_id = ?",
        [trip_id, req.user.user_id]);
      if (rsvp?.rsvp_status === 'yes' || req.user.role === 'admin') {
        run(db, 'INSERT INTO gear_claims (item_id, user_id, quantity) VALUES (?, ?, ?)',
          [itemId, req.user.user_id, qty]);
      }
    }

    const item = await fetchItemWithClaims(db, itemId);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// PUT /:id — update gear item (admin or creator)
router.put('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const item = get(db, 'SELECT * FROM gear_items WHERE item_id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: { message: 'Not found' } });

    if (req.user.role !== 'admin' && item.created_by !== req.user.user_id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    const { description, notes, quantity, image_url } = req.body;
    const newQty = quantity ?? item.quantity;

    // Don't allow reducing quantity below already-claimed total
    const totalClaimed = get(db,
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM gear_claims WHERE item_id = ?',
      [req.params.id]
    ).total;
    if (newQty < totalClaimed) {
      return res.status(400).json({ success: false, error: { message: `Cannot reduce quantity below ${totalClaimed} (already claimed)` } });
    }

    run(db,
      `UPDATE gear_items SET description = ?, notes = ?, quantity = ?, image_url = ?
       WHERE item_id = ?`,
      [description ?? item.description, notes ?? item.notes, newQty, image_url ?? item.image_url, req.params.id]
    );

    const updated = await fetchItemWithClaims(db, req.params.id);
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /:id — delete gear item (admin or creator)
router.delete('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const item = get(db, 'SELECT * FROM gear_items WHERE item_id = ?', [req.params.id]);
    if (!item) return res.status(404).json({ success: false, error: { message: 'Not found' } });

    if (req.user.role !== 'admin' && item.created_by !== req.user.user_id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    run(db, 'DELETE FROM gear_items WHERE item_id = ?', [req.params.id]);
    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// POST /:itemId/claims — create a claim (RSVP yes only)
router.post('/:itemId/claims', async (req, res) => {
  try {
    const db = await getDb();
    const item = get(db, 'SELECT * FROM gear_items WHERE item_id = ?', [req.params.itemId]);
    if (!item) return res.status(404).json({ success: false, error: { message: 'Item not found' } });

    // Check RSVP status
    const membership = get(db,
      "SELECT rsvp_status FROM trip_members WHERE trip_id = ? AND user_id = ?",
      [item.trip_id, req.user.user_id]
    );
    if (!membership || (membership.rsvp_status !== 'yes' && req.user.role !== 'admin')) {
      return res.status(403).json({ success: false, error: { message: 'Must RSVP yes to claim gear items' } });
    }

    // Check for existing claim
    const existing = get(db, 'SELECT * FROM gear_claims WHERE item_id = ? AND user_id = ?',
      [req.params.itemId, req.user.user_id]);
    if (existing) {
      return res.status(409).json({ success: false, error: { message: 'You already have a claim on this item. Update your existing claim instead.' } });
    }

    // Check remaining quantity
    const totalClaimed = get(db,
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM gear_claims WHERE item_id = ?',
      [req.params.itemId]
    ).total;
    const claimQty = req.body.quantity || 1;
    if (totalClaimed + claimQty > item.quantity) {
      return res.status(400).json({ success: false, error: { message: `Only ${item.quantity - totalClaimed} remaining to claim` } });
    }

    const result = run(db, 'INSERT INTO gear_claims (item_id, user_id, quantity) VALUES (?, ?, ?)',
      [req.params.itemId, req.user.user_id, claimQty]);

    const claim = get(db,
      `SELECT gc.*, u.first_name, u.last_name FROM gear_claims gc
       JOIN users u ON gc.user_id = u.user_id WHERE gc.claim_id = ?`,
      [result.lastInsertRowid]
    );
    res.status(201).json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// PUT /claims/:claimId — update claim quantity (own or admin)
router.put('/claims/:claimId', async (req, res) => {
  try {
    const db = await getDb();
    const claim = get(db, 'SELECT * FROM gear_claims WHERE claim_id = ?', [req.params.claimId]);
    if (!claim) return res.status(404).json({ success: false, error: { message: 'Claim not found' } });

    if (req.user.role !== 'admin' && claim.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    const newQty = req.body.quantity;
    if (!newQty || newQty < 1) {
      return res.status(400).json({ success: false, error: { message: 'quantity must be at least 1' } });
    }

    // Check remaining (excluding this claim's current quantity)
    const item = get(db, 'SELECT * FROM gear_items WHERE item_id = ?', [claim.item_id]);
    const totalClaimed = get(db,
      'SELECT COALESCE(SUM(quantity), 0) AS total FROM gear_claims WHERE item_id = ? AND claim_id != ?',
      [claim.item_id, req.params.claimId]
    ).total;

    if (totalClaimed + newQty > item.quantity) {
      return res.status(400).json({ success: false, error: { message: `Only ${item.quantity - totalClaimed} available to claim` } });
    }

    run(db, 'UPDATE gear_claims SET quantity = ? WHERE claim_id = ?', [newQty, req.params.claimId]);

    const updated = get(db,
      `SELECT gc.*, u.first_name, u.last_name FROM gear_claims gc
       JOIN users u ON gc.user_id = u.user_id WHERE gc.claim_id = ?`,
      [req.params.claimId]
    );
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// DELETE /claims/:claimId — remove claim (own or admin)
router.delete('/claims/:claimId', async (req, res) => {
  try {
    const db = await getDb();
    const claim = get(db, 'SELECT * FROM gear_claims WHERE claim_id = ?', [req.params.claimId]);
    if (!claim) return res.status(404).json({ success: false, error: { message: 'Claim not found' } });

    if (req.user.role !== 'admin' && claim.user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    }

    run(db, 'DELETE FROM gear_claims WHERE claim_id = ?', [req.params.claimId]);
    res.json({ success: true, data: null });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

export default router;
