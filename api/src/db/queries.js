import { randomUUID } from 'crypto';
import pool from './pool.js';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEMO_ALERT_ALIAS = 'demo-alert';
export const DEMO_ENTITIES = {
  alertId: '00000000-0000-4000-8000-0000000000da',
  customerId: '00000000-0000-4000-8000-0000000000c1',
  cardId: '00000000-0000-4000-8000-0000000000c2',
  txnId: '00000000-0000-4000-8000-0000000000c3'
};

const defaultLimit = 50;

export function isUuid (value) {
  return typeof value === 'string' && uuidRegex.test(value);
}

export async function ensureDemoAlertExists ({
  alertId,
  merchant,
  amountCents,
  currency,
  customerId,
  txnId,
  cardId,
  risk
} = {}) {
  const targetAlertId = alertId && isUuid(alertId) ? alertId : DEMO_ENTITIES.alertId;
  const targetCustomerId = customerId && isUuid(customerId) ? customerId : DEMO_ENTITIES.customerId;
  const targetCardId = cardId && isUuid(cardId) ? cardId : DEMO_ENTITIES.cardId;
  const targetTxnId = txnId && isUuid(txnId) ? txnId : DEMO_ENTITIES.txnId;
  const targetRisk = typeof risk === 'string' ? risk : 'high';
  const now = new Date().toISOString();
  const merchantName = merchant || 'Demo Superstore';
  const amountValue = typeof amountCents === 'number' ? amountCents : 250000;
  const currencyCode = currency || 'USD';

  await pool.query(
    `
      INSERT INTO customers (id, name, email_masked, kyc_level, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (id) DO NOTHING
    `,
    [targetCustomerId, 'Demo Customer', 'd***@demo.io', 'FULL']
  );

  await pool.query(
    `
      INSERT INTO cards (id, customer_id, last4, network, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `,
    [targetCardId, targetCustomerId, '4242', 'VISA', 'ACTIVE']
  );

  await pool.query(
    `
      INSERT INTO transactions (id, customer_id, card_id, mcc, merchant, amount_cents, currency, ts, device_id, country, city)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      targetTxnId,
      targetCustomerId,
      targetCardId,
      '5411',
      merchantName,
      amountValue,
      currencyCode,
      now,
      'demo-device',
      'US',
      'San Francisco'
    ]
  );

  if (merchantName.toLowerCase().includes('quickcab')) {
    const alreadyDuplicated = await hasLikelyDuplicateAuth({
      customerId: targetCustomerId,
      merchant: merchantName,
      amountCents: amountValue,
      ts: now
    });
    if (!alreadyDuplicated) {
      const duplicateTxnId = randomUUID();
      await pool.query(
        `
          INSERT INTO transactions (id, customer_id, card_id, mcc, merchant, amount_cents, currency, ts, device_id, country, city)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (id) DO NOTHING
        `,
        [
          duplicateTxnId,
          targetCustomerId,
          targetCardId,
          '4111',
          merchantName,
          amountValue,
          currencyCode,
          new Date(Date.parse(now) - (2 * 60 * 1000)).toISOString(),
          'demo-device',
          'US',
          'San Francisco'
        ]
      );
    }
  }

  await pool.query(
    `
      INSERT INTO alerts (id, customer_id, suspect_txn_id, created_at, risk, status)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO NOTHING
    `,
    [
      targetAlertId,
      targetCustomerId,
      targetTxnId,
      now,
      targetRisk,
      'OPEN'
    ]
  );

  return getAlertWithDetails(targetAlertId);
}

export async function getCustomerTransactions ({
  customerId,
  from,
  to,
  cursor,
  limit = defaultLimit
}) {
  const params = [customerId];
  let whereParts = ['customer_id = $1'];
  if (from) {
    params.push(from);
    whereParts.push(`ts >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    whereParts.push(`ts <= $${params.length}`);
  }
  let cursorClause = '';
  if (cursor) {
    const [ts, id] = Buffer.from(cursor, 'base64').toString('utf8').split('|');
    params.push(ts);
    params.push(id);
    cursorClause = `AND (ts, id) < ($${params.length - 1}, $${params.length})`;
  }
  params.push(limit);
  const sql = `
    SELECT id, customer_id, card_id, mcc, merchant, amount_cents, currency, ts, device_id, country, city
    FROM transactions
    WHERE ${whereParts.join(' AND ')}
    ${cursorClause}
    ORDER BY ts DESC, id DESC
    LIMIT $${params.length}
  `;
  const { rows } = await pool.query(sql, params);
  const next = rows.length === limit
    ? Buffer.from(`${rows[rows.length - 1].ts.toISOString()}|${rows[rows.length - 1].id}`).toString('base64')
    : null;
  return { rows, next };
}

export async function insertTransactions (items, client) {
  if (!items?.length) return { count: 0 };
  const useClient = client || pool;
  const text = `
    INSERT INTO transactions
      (id, customer_id, card_id, mcc, merchant, amount_cents, currency, ts, device_id, country, city)
    VALUES
      ${items.map((_, idx) => {
        const offset = idx * 11;
        const placeholders = Array.from({ length: 11 }, (_, i) => `$${offset + i + 1}`);
        return `(${placeholders.join(',')})`;
      }).join(',')}
    ON CONFLICT (id) DO NOTHING
  `;
  const values = items.flatMap(item => [
    item.id,
    item.customer_id,
    item.card_id,
    item.mcc,
    item.merchant,
    item.amount_cents,
    item.currency,
    item.ts,
    item.device_id,
    item.country,
    item.city
  ]);
  const result = await useClient.query(text, values);
  return { count: result.rowCount };
}

export async function getAlertWithDetails (alertId) {
  const { rows } = await pool.query(
    `
      SELECT
        a.id,
        a.customer_id,
        a.suspect_txn_id,
        a.created_at,
        a.risk,
        a.status,
        t.merchant,
        t.amount_cents,
        t.currency,
        t.card_id,
        t.mcc,
        t.ts,
        c.status AS card_status
      FROM alerts a
      LEFT JOIN transactions t ON t.id = a.suspect_txn_id
      LEFT JOIN cards c ON c.id = t.card_id
      WHERE a.id = $1
      LIMIT 1
    `,
    [alertId]
  );
  return rows[0] || null;
}

export async function getCustomerInsights (customerId) {
  const summary = await pool.query(
    `
      SELECT
        SUM(amount_cents) AS total_spend_cents,
        COUNT(*) AS txn_count
      FROM transactions
      WHERE customer_id = $1
        AND ts >= NOW() - INTERVAL '180 days'
    `,
    [customerId]
  );

  const categories = await pool.query(
    `
      SELECT mcc, COUNT(*) AS txn_count, SUM(amount_cents) AS spend_cents
      FROM transactions
      WHERE customer_id = $1
        AND ts >= NOW() - INTERVAL '90 days'
      GROUP BY mcc
      ORDER BY spend_cents DESC
      LIMIT 10
    `,
    [customerId]
  );

  const merchants = await pool.query(
    `
      SELECT merchant, COUNT(*) AS txn_count, SUM(amount_cents) AS spend_cents
      FROM transactions
      WHERE customer_id = $1
        AND ts >= NOW() - INTERVAL '90 days'
      GROUP BY merchant
      ORDER BY spend_cents DESC
      LIMIT 10
    `,
    [customerId]
  );

  return {
    summary: summary.rows[0] || { total_spend_cents: 0, txn_count: 0 },
    categories: categories.rows,
    merchants: merchants.rows
  };
}

export async function createTriageRun ({ alertId, risk, reasons, fallbackUsed, latencyMs }) {
  const { rows } = await pool.query(
    `
      INSERT INTO triage_runs (alert_id, started_at, ended_at, risk, reasons, fallback_used, latency_ms)
      VALUES ($1, NOW(), NOW(), $2, $3::jsonb, $4, $5)
      RETURNING id
    `,
    [alertId, risk, JSON.stringify(reasons ?? []), fallbackUsed, latencyMs]
  );
  return rows[0];
}

export async function appendCaseEvent ({ caseId, actor, action, payload }) {
  await pool.query(
    `
      INSERT INTO case_events (id, case_id, ts, actor, action, payload_json)
      VALUES (uuid_generate_v4(), $1, NOW(), $2, $3, $4::jsonb)
    `,
    [caseId, actor, action, JSON.stringify(payload)]
  );
}

export async function upsertCaseStatus ({ caseId, status, reasonCode }) {
  await pool.query(
    `
      UPDATE cases
      SET status = $2,
          reason_code = COALESCE($3, reason_code),
          updated_at = NOW()
      WHERE id = $1
    `,
    [caseId, status, reasonCode]
  );
}

export async function searchKnowledgeBase (query, limit = 5) {
  const { rows } = await pool.query(
    `
      SELECT id, title, anchor, content_text
      FROM kb_docs
      WHERE to_tsvector('english', content_text) @@ plainto_tsquery('english', $1)
      ORDER BY ts_rank(to_tsvector('english', content_text), plainto_tsquery('english', $1)) DESC
      LIMIT $2
    `,
    [query, limit]
  );
  return rows;
}

export async function hasLikelyDuplicateAuth ({ customerId, merchant, amountCents, ts }) {
  if (!customerId || !merchant || typeof amountCents !== 'number' || !ts) {
    return false;
  }
  const { rows } = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM transactions
      WHERE customer_id = $1
        AND merchant = $2
        AND amount_cents = $3
        AND DATE(ts) = DATE($4)
    `,
    [customerId, merchant, amountCents, ts]
  );
  const count = Number(rows?.[0]?.count || 0);
  return count >= 2;
}

export async function getCaseByAlert ({ alertId, type }) {
  if (!alertId) return null;
  const params = [alertId];
  let whereClause = 'alert_id = $1';
  if (type) {
    params.push(type);
    whereClause += ' AND type = $2';
  }
  const { rows } = await pool.query(
    `
      SELECT id, status, reason_code
      FROM cases
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    params
  );
  return rows[0] || null;
}
