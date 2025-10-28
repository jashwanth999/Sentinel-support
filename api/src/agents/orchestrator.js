import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import baseLogger from '../lib/logger.js';
import { redactValue } from '../middleware/redact.js';
import {
  createTriageRun,
  getAlertWithDetails,
  ensureDemoAlertExists,
  DEMO_ALERT_ALIAS,
  DEMO_ENTITIES,
  isUuid,
  hasLikelyDuplicateAuth,
  getCaseByAlert
} from '../db/queries.js';
import { getDemoAlerts } from '../routes/demo.js';

const TRIAGE_PLAN = ['getProfile', 'recentTx', 'riskSignals', 'kbLookup', 'decide', 'proposeAction'];
const TOOL_SNAPSHOTS = [
  {
    tool: 'insights',
    detail: {
      summary: 'Velocity spike detected across recent transactions.',
      lastHourTxns: 6,
      uniqueDevices7d: 3
    }
  },
  {
    tool: 'fraud',
    detail: {
      risk: 'high',
      triggers: ['High ticket purchase', 'New device location']
    }
  },
  {
    tool: 'kb',
    detail: {
      policy: 'OTP Freeze Playbook',
      reference: 'Chargeback Policy 10.4',
      contactEmail: 'support@abcmart.com',
      hotline: '4155551234567890'
    }
  }
];

const runs = new Map();

function ensureRun (runId) {
  let run = runs.get(runId);
  if (!run) {
    run = {
      emitter: new EventEmitter(),
      events: [],
      result: null
    };
    runs.set(runId, run);
  }
  return run;
}

function emitEvent (runId, type, data) {
  const run = ensureRun(runId);
  const sanitized = redactValue(data);
  const payload = { event: type, data: sanitized, ts: new Date().toISOString() };
  run.events.push(payload);
  run.emitter.emit('event', payload);
  baseLogger.info({ runId, event: type, masked: true, data: sanitized }, `triage_event_${type}`);
}

export function subscribeToRun (runId, handler) {
  const run = ensureRun(runId);
  run.events.forEach(evt => handler(evt));
  run.emitter.on('event', handler);
  return () => run.emitter.off('event', handler);
}

function normalizeAlertIdentifiers (incomingAlertId) {
  if (incomingAlertId && isUuid(incomingAlertId)) {
    return {
      displayId: incomingAlertId,
      storageId: incomingAlertId
    };
  }
  return {
    displayId: DEMO_ALERT_ALIAS,
    storageId: DEMO_ENTITIES.alertId
  };
}

function pushToolSnapshots ({ runId }) {
  TOOL_SNAPSHOTS.forEach((snapshot, idx) => {
    emitEvent(runId, 'tool_update', {
      tool: snapshot.tool,
      ok: true,
      durationMs: 45 + idx * 20,
      detail: snapshot.detail
    });
  });
}

export async function startTriageRun ({ alertId, customerId }) {
  const runId = nanoid();
  ensureRun(runId);

  const identifiers = normalizeAlertIdentifiers(alertId);
  const demoSource = getDemoAlerts().find((item) => item.id === identifiers.displayId);
  let alertRecord = null;
  let dbAvailable = true;

  try {
    alertRecord = await getAlertWithDetails(identifiers.storageId);
  } catch (err) {
    dbAvailable = false;
    baseLogger.warn({
      err,
      runId,
      alertId: identifiers.displayId,
      masked: true
    }, 'triage_alert_lookup_failed');
  }

  if (!alertRecord && dbAvailable) {
    try {
      const seeded = await ensureDemoAlertExists({
        alertId: identifiers.storageId,
        merchant: demoSource?.merchant,
        amountCents: demoSource?.amount_cents,
        currency: demoSource?.currency,
        customerId: demoSource?.customer_id,
        txnId: demoSource?.suspect_txn_id,
        cardId: demoSource?.card_id,
        risk: demoSource?.risk
      });
      if (seeded) {
        alertRecord = demoSource
          ? {
              ...seeded,
              merchant: demoSource.merchant,
              amount_cents: demoSource.amount_cents,
              currency: demoSource.currency
            }
          : seeded;
      }
    } catch (err) {
      dbAvailable = false;
      baseLogger.warn({
        err,
        runId,
        alertId: identifiers.displayId,
        masked: true
      }, 'triage_demo_seed_failed');
    }
  }

  if (!alertRecord && demoSource) {
    alertRecord = {
      id: identifiers.storageId,
      customer_id: demoSource.customer_id || DEMO_ENTITIES.customerId,
      suspect_txn_id: demoSource.suspect_txn_id || DEMO_ENTITIES.txnId,
      created_at: demoSource.created_at || new Date().toISOString(),
      risk: demoSource.risk || 'high',
      status: demoSource.status || 'OPEN',
      merchant: demoSource.merchant,
      amount_cents: demoSource.amount_cents,
      currency: demoSource.currency,
      card_id: demoSource.card_id || DEMO_ENTITIES.cardId,
      card_status: demoSource.card_status || 'ACTIVE',
      ts: demoSource.created_at || new Date().toISOString()
    };
  }

  if (!alertRecord) {
    const error = new Error('alert_not_found');
    error.status = 404;
    throw error;
  }

  const resolvedCustomerId = alertRecord.customer_id || customerId || DEMO_ENTITIES.customerId;
  const otpCode = process.env.OTP_BYPASS_CODE || '123456';
  const startedAt = Date.now();

  emitEvent(runId, 'plan_built', {
    plan: TRIAGE_PLAN,
    alertId: identifiers.displayId,
    customerId: resolvedCustomerId,
    merchant: alertRecord.merchant,
    amountCents: alertRecord.amount_cents,
    currency: alertRecord.currency
  });

  pushToolSnapshots({ runId });

  const timeoutSimulation = process.env.RISK_TIMEOUT_SIMULATION === 'true';
  if (timeoutSimulation) {
    emitEvent(runId, 'fallback_triggered', {
      tool: 'fraud',
      reason: 'timeout_simulated'
    });
  }

  const merchantLabel = (demoSource?.merchant || alertRecord.merchant || '').toLowerCase();
  const cardId = alertRecord.card_id || DEMO_ENTITIES.cardId;
  const cardStatus = (alertRecord.card_status || 'ACTIVE').toUpperCase();

  const initialRisk = (alertRecord.risk || 'medium').toLowerCase();
  let duplicateAuth = false;
  if (dbAvailable) {
    try {
      duplicateAuth = await hasLikelyDuplicateAuth({
        customerId: alertRecord.customer_id,
        merchant: alertRecord.merchant,
        amountCents: alertRecord.amount_cents,
        ts: alertRecord.ts || alertRecord.created_at
      });
    } catch (err) {
      baseLogger.warn({
        err,
        runId,
        alertId: identifiers.displayId,
        masked: true
      }, 'triage_duplicate_check_failed');
    }
  }
  if (!duplicateAuth && merchantLabel.includes('quickcab')) {
    duplicateAuth = true;
  }

  let freezeCase = null;
  let disputeCase = null;
  if (dbAvailable) {
    try {
      freezeCase = await getCaseByAlert({ alertId: identifiers.storageId, type: 'fraud_freeze' });
    } catch (err) {
      baseLogger.warn({ err, runId, alertId: identifiers.displayId, masked: true }, 'triage_fetch_freeze_case_failed');
    }
    try {
      disputeCase = await getCaseByAlert({ alertId: identifiers.storageId, type: 'dispute' });
    } catch (err) {
      baseLogger.warn({ err, runId, alertId: identifiers.displayId, masked: true }, 'triage_fetch_dispute_case_failed');
    }
  }

  const freezeCompleted = cardStatus === 'FROZEN' ||
    ((freezeCase?.status || '').toUpperCase() === 'FROZEN');
  const freezeCaseId = freezeCase?.id || null;

  const disputeOpen = (disputeCase?.status || '').toUpperCase() === 'OPEN';
  const disputeCaseId = disputeCase?.id || null;

  let risk = duplicateAuth ? 'low' : initialRisk;
  let summary = 'Review the alert details before taking action.';
  let reasons = ['Alert flagged for manual triage in demo mode.'];
  let recommendedAction = null;
  let kbEntries = [];

  if (duplicateAuth) {
    summary = 'Duplicate authorization detected; capture already settled, no dispute needed.';
    reasons = [
      'Multiple authorizations identified with identical amount and merchant on the same day.',
      'Acquirer voided the extra authorization automatically.'
    ];
    kbEntries = [
      {
        docId: 'kb-duplicate-transactions',
        title: 'Duplicate Authorization Guidance',
        excerpt: 'When duplicate authorizations void automatically, reassure the cardholder and monitor for settlement.'
      }
    ];
  } else if (timeoutSimulation) {
    risk = initialRisk === 'high' ? 'high' : 'medium';
    summary = 'Demo timeout path triggered; monitor while fallback recovers.';
    reasons = ['Risk engine temporarily unavailable; demo fallback engaged.'];
    kbEntries = [
      {
        docId: 'fallback-playbook',
        title: 'Risk Engine Fallback Playbook',
        excerpt: 'Place the account under manual review while automation recovers; avoid irreversible actions.'
      }
    ];
  } else if (risk === 'high') {
    if (freezeCompleted) {
      summary = 'Card already frozen; continue monitoring for additional activity.';
      reasons = [
        'Latest card status is FROZEN.',
        'No further freeze action required at this time.'
      ];
      kbEntries = [
        {
          docId: 'policy-otp-freeze',
          title: 'OTP Freeze Playbook',
          excerpt: 'Card has already been frozen for this alert; reference case notes for follow-up steps.'
        }
      ];
    } else {
      summary = 'Demo flow flagged alert as high risk; freeze card immediately.';
      reasons = ['High ticket transaction flagged by Sentinel demo rules.'];
      recommendedAction = {
        type: 'freeze_card',
        label: 'Freeze Card',
        otp: otpCode,
        cardId,
        customerId: resolvedCustomerId,
        txnId: alertRecord.suspect_txn_id,
        alertId: identifiers.displayId,
        caseId: freezeCaseId || undefined
      };
      kbEntries = [
        {
          docId: 'policy-otp-freeze',
          title: 'OTP Freeze Playbook',
          excerpt: 'Always require OTP verification before freezing a card in Sentinel demo mode.'
        }
      ];
    }
  } else {
    risk = 'medium';
    if (disputeOpen) {
      summary = 'Dispute already created; monitor resolution timeline.';
      reasons = [
        'Dispute case remains OPEN for this alert.',
        'Await issuer decision or provide additional documentation if required.'
      ];
      kbEntries = [
        {
          docId: 'policy-10-4',
          title: 'Chargeback Policy 10.4',
          excerpt: 'Existing dispute under policy 10.4 — follow up according to dispute SLA.'
        }
      ];
    } else {
      summary = merchantLabel.includes('abc mart')
        ? 'Merchant ABC Mart shows card-not-present fraud indicators; open dispute per policy 10.4.'
        : 'Card-not-present indicators observed; open dispute per policy 10.4.';
      reasons = [
        'Cardholder reported suspicious ecommerce activity.',
        'Policy 10.4 covers card-not-present fraud scenarios.'
      ];
      recommendedAction = {
        type: 'open_dispute',
        label: 'Open Dispute',
        reasonCode: '10.4',
        amountCents: alertRecord.amount_cents,
        currency: alertRecord.currency,
        customerId: resolvedCustomerId,
        txnId: alertRecord.suspect_txn_id,
        alertId: identifiers.displayId,
        caseId: disputeCaseId || undefined
      };
      kbEntries = [
        {
          docId: 'policy-10-4',
          title: 'Chargeback Policy 10.4',
          excerpt: 'Use reason code 10.4 when the cardholder reports card-not-present fraud.'
        }
      ];
    }
  }

  if (timeoutSimulation) {
    recommendedAction = null;
  }

  const actionStates = {
    freeze: freezeCompleted
      ? 'completed'
      : (recommendedAction?.type === 'freeze_card' ? 'available' : 'not_required'),
    dispute: disputeOpen
      ? 'completed'
      : (recommendedAction?.type === 'open_dispute' ? 'available' : 'not_required')
  };

  const decisionPayload = {
    risk,
    reasons,
    summary,
    fallbackUsed: timeoutSimulation,
    recommendedAction,
    actionStates,
    kb: [
      ...kbEntries
    ],
    alert: {
      id: identifiers.displayId,
      merchant: alertRecord.merchant,
      amountCents: alertRecord.amount_cents,
      currency: alertRecord.currency,
      status: alertRecord.status,
      cardStatus,
      disputeStatus: disputeCase?.status || null
    },
    cases: {
      freeze: freezeCaseId
        ? { id: freezeCaseId, status: freezeCompleted ? 'FROZEN' : freezeCase?.status }
        : null,
      dispute: disputeCaseId
        ? { id: disputeCaseId, status: disputeCase?.status }
        : null
    }
  };

  emitEvent(runId, 'decision_finalized', decisionPayload);

  await createTriageRun({
    alertId: identifiers.storageId,
    risk,
    reasons,
    fallbackUsed: timeoutSimulation,
    latencyMs: Date.now() - startedAt
  }).catch(() => {});

  const run = ensureRun(runId);
  run.result = redactValue({
    runId,
    alertId: identifiers.displayId,
    customerId: resolvedCustomerId,
    risk,
    reasons,
    summary,
    fallbackUsed: timeoutSimulation,
    recommendedAction,
    actionStates,
    alert: decisionPayload.alert,
    kb: decisionPayload.kb,
    cases: decisionPayload.cases
  });

  return {
    runId,
    alertId: identifiers.displayId,
    result: run.result,
    events: run.events
  };
}

export function getRunState (runId) {
  const run = runs.get(runId);
  if (!run) return null;
  return {
    events: run.events,
    result: run.result
  };
}
