import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import requestContext from './middleware/context.js';
import redactMiddleware from './middleware/redact.js';
import redisRateLimit from './middleware/rateLimit.js';
import idempotency from './middleware/idempotency.js';
import { httpLogger, baseLogger } from './lib/logger.js';
import registerRoutes from './routes/index.js';
import { metricsRouteHandler } from './lib/metrics.js';
import { getRedis } from './lib/redis.js';

const app = express();
const port = process.env.PORT || 3001;
const enableMetrics = process.env.PROMETHEUS_METRICS !== 'false';

app.disable('x-powered-by');
app.use(cors({ origin: true, credentials: true }));
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(requestContext());
app.use(redactMiddleware);
app.use(httpLogger());
app.use(redisRateLimit());
app.use(idempotency());

registerRoutes(app);

if (enableMetrics) {
  app.get('/metrics', metricsRouteHandler);
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err.status || 500;
  const message = enableMetrics ? err.message : 'Internal Server Error';
  baseLogger.error({ err, requestId: req.requestId, masked: true }, 'request_error');
  res.status(status).json({ error: message });
});

async function start () {
  try {
    if (process.env.REDIS_URL) {
      await getRedis();
    }
    app.listen(port, () => {
      baseLogger.info({ event: 'server_started', port }, 'API listening');
    });
  } catch (err) {
    baseLogger.error({ err }, 'Failed to start API');
    process.exit(1);
  }
}

start();
