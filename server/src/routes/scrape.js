import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { adminMiddleware } from '../middleware/auth.js';
import { scrapeListing, detectPlatform } from '../services/scraper.js';

const router = Router();

// POST /api/scrape - Scrape a listing URL and return structured data
router.post('/', authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const platform = detectPlatform(url);
    if (!platform) {
      return res.status(400).json({ error: 'Unsupported URL. Currently only Airbnb links are supported.' });
    }

    const data = await scrapeListing(url);
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

export default router;
