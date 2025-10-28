import express from 'express';
import { searchKnowledgeBase } from '../db/queries.js';
import { redactValue } from '../middleware/redact.js';

const router = express.Router();

router.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ results: [] });
    const rows = await searchKnowledgeBase(q, 10);
    const results = rows.map(row => ({
      docId: row.id,
      title: row.title,
      anchor: row.anchor,
      extract: redactValue(row.content_text.substring(0, 240))
    }));
    res.json({ results });
  } catch (err) {
    next(err);
  }
});

export default router;
