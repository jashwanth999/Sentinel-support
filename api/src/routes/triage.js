import express from 'express';
import { nanoid } from 'nanoid';
import { requireApiKey } from '../middleware/auth.js';
import { initSse } from '../lib/sse.js';
import { startTriageRun, subscribeToRun, getRunState } from '../agents/orchestrator.js';

const router = express.Router();

router.use(requireApiKey({ allowGet: true }));

router.post('/', async (req, res, next) => {
  try {
    const { alertId, customerId } = req.body;
    if (!alertId || !customerId) {
      return res.status(400).json({ error: 'missing_parameters' });
    }
    const run = await startTriageRun({ alertId, customerId });
    res.json(run);
  } catch (err) {
    next(err);
  }
});

router.get('/:runId/stream', (req, res) => {
  const { runId } = req.params;
  const channel = initSse(res);
  const keepalive = setInterval(() => channel.send('keepalive', nanoid()), 25_000);
  const unsubscribe = subscribeToRun(runId, (evt) => channel.send(evt.event, evt));
  req.on('close', () => {
    clearInterval(keepalive);
    unsubscribe();
    channel.close();
  });
});

router.get('/:runId', (req, res) => {
  const { runId } = req.params;
  const state = getRunState(runId);
  if (!state) return res.status(404).json({ error: 'not_found' });
  res.json(state);
});

export default router;
