import pool from '../db/pool.js';
import { appendCaseEvent } from '../db/queries.js';

export async function createCase ({ customerId, txnId = null, type, status, reasonCode }) {
  const { rows } = await pool.query(
    `
      INSERT INTO cases (customer_id, txn_id, type, status, reason_code, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id
    `,
    [customerId, txnId, type, status, reasonCode]
  );
  return rows[0];
}

export async function auditCaseEvent ({ caseId, actor, action, payload }) {
  if (!caseId) return;
  await appendCaseEvent({ caseId, actor, action, payload });
}
