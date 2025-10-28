import pool from '../db/pool.js';

export async function runFraudAgent ({ customerId, referenceTs }) {
  const reference = referenceTs ? new Date(referenceTs) : new Date();
  const { rows } = await pool.query(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE ts BETWEEN $2::timestamptz - INTERVAL '1 hour' AND $2::timestamptz
        ) AS last_hour,
        COUNT(DISTINCT device_id) FILTER (
          WHERE ts BETWEEN $2::timestamptz - INTERVAL '7 days' AND $2::timestamptz
        ) AS devices_7d,
        COUNT(*) FILTER (
          WHERE country <> 'US'
            AND ts BETWEEN $2::timestamptz - INTERVAL '14 days' AND $2::timestamptz
        ) AS intl_trips,
        COUNT(*) FILTER (
          WHERE amount_cents >= 75000
            AND ts BETWEEN $2::timestamptz - INTERVAL '1 hour' AND $2::timestamptz
        ) AS large_window_txns,
        MAX(amount_cents) AS max_amount
      FROM transactions
      WHERE customer_id = $1
    `,
    [customerId, reference.toISOString()]
  );

  const metrics = rows[0] || {};
  const riskReasons = [];
  let score = 0;

  if ((metrics.last_hour || 0) > 5) {
    score += 30;
    riskReasons.push('High transaction velocity observed in last hour');
  }
  if ((metrics.large_window_txns || 0) >= 2) {
    score += 35;
    riskReasons.push('Multiple large transactions in short window');
  }
  if ((metrics.devices_7d || 0) > 2) {
    score += 25;
    riskReasons.push('Multiple device changes in 7d window');
  }
  if ((metrics.intl_trips || 0) > 0) {
    score += 20;
    riskReasons.push('Recent international transactions detected');
  }
  if ((metrics.max_amount || 0) > 200000) {
    score += 20;
    riskReasons.push('High value purchase detected requiring OTP verification');
  }
  if ((metrics.max_amount || 0) > 300000) {
    score = Math.max(score, 70);
    if (!riskReasons.includes('High value purchase detected requiring OTP verification')) {
      riskReasons.push('High value purchase detected requiring OTP verification');
    }
  }

  const riskLevel = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

  return {
    tool: 'fraud',
    ok: true,
    output: {
      score,
      riskLevel,
      reasons: riskReasons
    }
  };
}

export default { runFraudAgent };
