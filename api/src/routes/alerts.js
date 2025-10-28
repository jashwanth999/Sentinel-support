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
  // if (process.env.DEMO_MODE === 'true') {
  //   return res.json({ items: getDemoAlerts() });
  // }
  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.customer_id, a.suspect_txn_id, a.created_at, a.risk, a.status,
              t.merchant, t.amount_cents, t.currency, t.ts
       FROM alerts a
       LEFT JOIN transactions t ON t.id = a.suspect_txn_id
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
