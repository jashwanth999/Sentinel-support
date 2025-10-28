import express from 'express';
import baseLogger from '../lib/logger.js';
import { getCustomerInsights } from '../db/queries.js';

const router = express.Router();

router.get('/:customerId/summary', async (req, res, next) => {
  const defaults = {
    summary: {
      total_spend_cents: 0,
      txn_count: 0
    },
    categories: [],
    merchants: []
  };

  const { customerId } = req.params;

  try {
    const insights = await getCustomerInsights(customerId);
    const summary = insights?.summary || {};
    const categories = Array.isArray(insights?.categories) ? insights.categories : [];
    const merchants = Array.isArray(insights?.merchants) ? insights.merchants : [];

    res.json({
      summary: {
        total_spend_cents: Number(summary.total_spend_cents || 0),
        txn_count: Number(summary.txn_count || 0)
      },
      categories: categories.map((cat) => ({
        mcc: cat.mcc,
        txn_count: Number(cat.txn_count || 0),
        spend_cents: Number(cat.spend_cents || 0)
      })),
      merchants: merchants.map((merchant) => ({
        merchant: merchant.merchant,
        txn_count: Number(merchant.txn_count || 0),
        spend_cents: Number(merchant.spend_cents || 0)
      }))
    });
  } catch (err) {
    baseLogger.error({
      err,
      event: 'insights_summary_failed',
      customerId,
      requestId: req.requestId,
      masked: true
    }, 'Failed to build insights summary');
    res.json(defaults);
  }
});

export default router;
