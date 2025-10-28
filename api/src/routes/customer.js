import express from 'express';
import { getCustomerTransactions } from '../db/queries.js';

const router = express.Router();

router.get('/:id/transactions', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { from, to, cursor, limit } = req.query;
    const { rows, next: nextCursor } = await getCustomerTransactions({
      customerId: id,
      from,
      to,
      cursor,
      limit: limit ? Math.min(Number(limit), 200) : undefined
    });
    res.json({
      items: rows,
      nextCursor
    });
  } catch (err) {
    next(err);
  }
});

export default router;
