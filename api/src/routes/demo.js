import express from 'express';
const router = express.Router();
const demoAlerts = [
  {
    id: 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    customer_id: '11111111-1111-1111-1111-111111111111',
    suspect_txn_id: '77777777-7777-7777-7777-777777777777',
    created_at: '2024-06-11T10:05:00.000Z',
    risk: 'high',
    status: 'OPEN',
    merchant: 'Neon Electronics',
    amount_cents: 278500,
    currency: 'USD',
    card_status: 'ACTIVE',
    fallback_used: false
  },
  {
    id: 'bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    customer_id: '22222222-2222-2222-2222-222222222222',
    suspect_txn_id: '99999999-9999-9999-9999-999999999999',
    created_at: '2024-06-11T10:10:00.000Z',
    risk: 'high',
    status: 'OPEN',
    merchant: 'ABC Mart',
    amount_cents: 499900,
    currency: 'USD',
    card_status: 'ACTIVE',
    dispute_status: null
  },
  {
    id: 'eeeeeee1-eeee-eeee-eeee-eeeeeeeeeeee',
    customer_id: '55555555-5555-5555-5555-555555555555',
    suspect_txn_id: 'eeeeeee3-eeee-eeee-eeee-eeeeeeeeeeee',
    created_at: '2024-06-06T09:45:00.000Z',
    risk: 'medium',
    status: 'OPEN',
    merchant: 'QuickCab',
    amount_cents: 1899,
    currency: 'USD',
    card_status: 'ACTIVE',
    dispute_status: null,
    fallback_used: false
  },
  {
    id: 'demo-alert',
    customer_id: '11111111-1111-1111-1111-111111111111',
    suspect_txn_id: '00000000-0000-4000-8000-0000000000c3',
    created_at: '2024-06-11T12:00:00.000Z',
    risk: 'high',
    status: 'OPEN',
    merchant: 'Demo Superstore',
    amount_cents: 250000,
    currency: 'USD',
    card_status: 'ACTIVE',
    dispute_status: null,
    fallback_used: false
  }
];

export function getDemoAlerts () {
  return demoAlerts;
}

router.get('/alerts', (req, res) => {
  res.json({ items: getDemoAlerts() });
});

router.post('/triage', (req, res) => {
  const otp = req.body?.otp;
  const expected = process.env.OTP_BYPASS_CODE || '123456';
  if (otp === expected) {
    return res.json({
      status: 'FROZEN',
      message: 'Card frozen via demo triage',
      requestId: req.requestId
    });
  }
  return res.json({
    status: 'PENDING_OTP',
    message: 'Enter OTP 123456 to freeze card',
    requestId: req.requestId
  });
});

router.get('/dashboard', (req, res) => {
  res.json({
    alertsOpen: 4,
    frozenCards: 2,
    disputesOpen: 3,
    avgTriageLatency: 850
  });
});

export default router;
