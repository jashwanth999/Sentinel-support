import express from 'express';
import { insertTransactions } from '../db/queries.js';

const router = express.Router();

router.post('/transactions', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.transactions) ? req.body.transactions : [];
    const normalized = items.map(item => ({
      id: item.id,
      customer_id: item.customerId,
      card_id: item.cardId,
      mcc: item.mcc,
      merchant: item.merchant,
      amount_cents: item.amountCents,
      currency: item.currency || 'USD',
      ts: item.ts,
      device_id: item.deviceId,
      country: item.country || 'US',
      city: item.city || null
    }));
    const { count } = await insertTransactions(normalized);
    res.status(202).json({
      accepted: true,
      count,
      requestId: res.locals.requestId
    });
  } catch (err) {
    next(err);
  }
});

export default router;
