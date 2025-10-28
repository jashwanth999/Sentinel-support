import express from 'express';
import { metricsRouteHandler } from '../lib/metrics.js';

const router = express.Router();

router.get('/', metricsRouteHandler);

export default router;
