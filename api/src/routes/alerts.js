import express from 'express';
import pool from '../db/pool.js';
import { getDemoAlerts } from './demo.js';
import { ensureDemoAlertExists, DEMO_ALERT_ALIAS, DEMO_ENTITIES } from '../db/queries.js';

const router = express.Router();

function projectAlert (row) {
  if (!row) return row;
  if (row.id === DEMO_ENTITIES.alertId) {
    return { ...row, id: DEMO_ALERT_ALIAS };
  }
  return row;
}

router.get('/', async (req, res, next) => {
  if (process.env.DEMO_MODE === 'true') {
    const demoItems = getDemoAlerts().map((item) => projectAlert({
      ...item,
      card_status: item.card_status || 'ACTIVE',
      dispute_status: item.dispute_status || null,
      fallback_used: Boolean(item.fallback_used)
    }));
    return res.json({ items: demoItems });
  }
  try {
    const { rows } = await pool.query(
      `SELECT a.id,
              a.customer_id,
              a.suspect_txn_id,
              a.created_at,
              a.risk,
              a.status,
              t.merchant,
              t.amount_cents,
              t.currency,
              t.ts,
              card.status AS card_status,
              COALESCE(triage.fallback_used, false) AS fallback_used,
              dispute_case.status AS dispute_status,
              freeze_case.status AS freeze_status
       FROM alerts a
       LEFT JOIN transactions t ON t.id = a.suspect_txn_id
       LEFT JOIN cards card ON card.id = t.card_id
       LEFT JOIN LATERAL (
         SELECT tr.fallback_used
         FROM triage_runs tr
         WHERE tr.alert_id = a.id
         ORDER BY tr.started_at DESC
         LIMIT 1
       ) triage ON true
       LEFT JOIN LATERAL (
         SELECT cs.status
         FROM cases cs
         WHERE cs.alert_id = a.id
           AND cs.type = 'dispute'
         ORDER BY cs.updated_at DESC
         LIMIT 1
       ) dispute_case ON true
       LEFT JOIN LATERAL (
         SELECT cs.status
         FROM cases cs
         WHERE cs.alert_id = a.id
           AND cs.type = 'fraud_freeze'
         ORDER BY cs.updated_at DESC
         LIMIT 1
       ) freeze_case ON true
       ORDER BY a.created_at DESC
       LIMIT 500`
    );
    let items = rows.map(projectAlert);
    if (!items.length) {
      const fallback = await ensureDemoAlertExists();
      if (fallback) {
        items = [projectAlert(fallback)];
      }
    }
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

export default router;
