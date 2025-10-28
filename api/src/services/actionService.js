import pool from '../db/pool.js';
import { actionBlocked } from '../lib/metrics.js';
import { auditCaseEvent } from './caseService.js';

const OTP_POLICY = 'otp_required';

export async function freezeCard ({ cardId, customerId, alertId, otp, actor }) {
  if (!otp) {
    actionBlocked.inc({ policy: OTP_POLICY });
    return {
      status: 'PENDING_OTP',
      message: 'OTP required to freeze card'
    };
  }

  const expectedOtp = process.env.OTP_BYPASS_CODE || '123456';
  if (otp !== expectedOtp) {
    actionBlocked.inc({ policy: 'otp_invalid' });
    return {
      status: 'DENIED',
      message: 'OTP invalid'
    };
  }

  await pool.query(
    `
      UPDATE cards
      SET status = 'FROZEN', updated_at = NOW()
      WHERE id = $1 AND customer_id = $2
    `,
    [cardId, customerId]
  );

  let freezeCaseId = null;
  if (alertId) {
    const existing = await pool.query(
      `
        SELECT id
        FROM cases
        WHERE alert_id = $1
          AND type = 'fraud_freeze'
        LIMIT 1
      `,
      [alertId]
    );
    if (existing.rows.length) {
      freezeCaseId = existing.rows[0].id;
      await pool.query(
        `
          UPDATE cases
          SET status = 'FROZEN', updated_at = NOW()
          WHERE id = $1
        `,
        [freezeCaseId]
      );
    } else {
      const inserted = await pool.query(
        `
          INSERT INTO cases (id, customer_id, alert_id, txn_id, type, status, reason_code, created_at, updated_at)
          VALUES (uuid_generate_v4(), $1, $2, NULL, 'fraud_freeze', 'FROZEN', 'freeze_card', NOW(), NOW())
          RETURNING id
        `,
        [customerId, alertId]
      );
      freezeCaseId = inserted.rows[0].id;
    }
  }

  if (freezeCaseId) {
    await auditCaseEvent({
      caseId: freezeCaseId,
      actor,
      action: 'freeze_card',
      payload: { cardId, customerId, alertId }
    });
  }

  if (alertId) {
    await pool.query(
      `
        UPDATE alerts
        SET status = 'CLOSED'
        WHERE id = $1
      `,
      [alertId]
    );
  }

  return { status: 'FROZEN', message: 'Card frozen', caseId: freezeCaseId };
}

export async function openDispute ({ customerId, txnId, amountCents, reasonCode, actor, alertId }) {
  let caseRow;
  if (alertId) {
    const existing = await pool.query(
      `
        SELECT id, status
        FROM cases
        WHERE alert_id = $1
          AND type = 'dispute'
        LIMIT 1
      `,
      [alertId]
    );
    if (existing.rows.length) {
      caseRow = existing.rows[0];
      await pool.query(
        `
          UPDATE cases
          SET status = 'OPEN',
              reason_code = $2,
              updated_at = NOW()
          WHERE id = $1
        `,
        [caseRow.id, reasonCode]
      );
    }
  }

  if (!caseRow) {
    const inserted = await pool.query(
      `
        INSERT INTO cases (id, customer_id, alert_id, txn_id, type, status, reason_code, created_at, updated_at)
        VALUES (uuid_generate_v4(), $1, $2, $3, 'dispute', 'OPEN', $4, NOW(), NOW())
        RETURNING id, status
      `,
      [customerId, alertId || null, txnId, reasonCode]
    );
    caseRow = inserted.rows[0];
  }

  await auditCaseEvent({
    caseId: caseRow.id,
    actor,
    action: 'dispute_opened',
    payload: { customerId, txnId, amountCents, reasonCode, alertId }
  });

  if (alertId) {
    await pool.query(
      `
        UPDATE alerts
        SET status = 'IN_REVIEW'
        WHERE id = $1
      `,
      [alertId]
    );
  }

  return {
    caseId: caseRow.id,
    status: caseRow.status
  };
}
