import ingestRouter from './ingest.js';
import customerRouter from './customer.js';
import insightsRouter from './insights.js';
import triageRouter from './triage.js';
import actionsRouter from './actions.js';
import kbRouter from './kb.js';
import metricsRouter from './metrics.js';
import healthRouter from './health.js';
import alertsRouter from './alerts.js';
import demoRouter from './demo.js';
import dashboardRouter from './dashboard.js';

export default function registerRoutes (app) {
  app.use('/api/ingest', ingestRouter);
  app.use('/api/customer', customerRouter);
  app.use('/api/insights', insightsRouter);
  app.use('/api/triage', triageRouter);
  app.use('/api/actions', actionsRouter);
  app.use('/api/action', actionsRouter);
  app.use('/api/kb', kbRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/demo', demoRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/metrics', metricsRouter);
}
