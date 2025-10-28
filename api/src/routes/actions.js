import express from 'express';
import { requireApiKey, withRole } from '../middleware/auth.js';
import { freezeCard, openDispute } from '../services/actionService.js';

const router = express.Router();

router.use(requireApiKey());

router.post('/freeze-card', withRole('agent'), async (req, res, next) => {
  try {
    const { cardId, customerId, alertId, otp } = req.body;
    const actor = req.header('X-User-Id') || 'agent';
    const result = await freezeCard({ cardId, customerId, alertId, otp, actor });
    res.json({
      status: result.status,
      caseId: result.caseId,
      requestId: res.locals.requestId,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
});

router.post('/open-dispute', withRole('agent'), async (req, res, next) => {
  try {
    const { customerId, txnId, amountCents, reasonCode, alertId } = req.body;
    const actor = req.header('X-User-Id') || 'agent';
    const result = await openDispute({ customerId, txnId, amountCents, reasonCode, actor, alertId });
    res.json({
      caseId: result.caseId,
      status: result.status || 'OPEN',
      requestId: res.locals.requestId
    });
  } catch (err) {
    next(err);
  }
});

export default router;
