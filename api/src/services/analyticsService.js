import pool from '../db/pool.js';

export async function fetchDashboardMetrics () {
  const [alertsRow, disputesRow, triageRow] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'OPEN') AS open_alerts
       FROM alerts`
    ),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE type = 'dispute' AND status = 'OPEN') AS open_disputes
       FROM cases`
    ),
    pool.query(
      `SELECT COALESCE(AVG(latency_ms),0) AS avg_latency
       FROM triage_runs
       WHERE started_at >= NOW() - INTERVAL '1 day'`
    )
  ]);
  return {
    alertsOpen: Number(alertsRow.rows[0]?.open_alerts || 0),
    disputesOpen: Number(disputesRow.rows[0]?.open_disputes || 0),
    avgTriageLatency: Number(triageRow.rows[0]?.avg_latency || 0)
  };
}

export default { fetchDashboardMetrics };
