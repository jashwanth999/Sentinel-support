import express from 'express';
import pool from '../db/pool.js';

const router = express.Router();

router.get('/summary', async (req, res, next) => {
  try {
    const [alertsResult, frozenResult, disputesResult, fallbackResult] = await Promise.all([
      pool.query("SELECT COUNT(*) AS count FROM alerts WHERE status IS DISTINCT FROM 'CLOSED'"),
      pool.query("SELECT COUNT(*) AS count FROM cards WHERE status = 'FROZEN'"),
      pool.query("SELECT COUNT(*) AS count FROM cases WHERE status = 'OPEN' AND type = 'dispute'"),
      pool.query('SELECT COUNT(*) AS count FROM triage_runs WHERE fallback_used = true')
    ]);

    res.json({
      alertsTotal: Number(alertsResult.rows?.[0]?.count || 0),
      frozenCards: Number(frozenResult.rows?.[0]?.count || 0),
      openDisputes: Number(disputesResult.rows?.[0]?.count || 0),
      fallbackRuns: Number(fallbackResult.rows?.[0]?.count || 0)
    });
  } catch (err) {
    next(err);
  }
});

export default router;
