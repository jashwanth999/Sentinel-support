import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const requestLatency = new client.Histogram({
  name: 'api_request_latency_ms',
  help: 'Request latency histogram',
  labelNames: ['route', 'method', 'status'],
  buckets: [5, 10, 25, 50, 75, 100, 250, 500, 1000, 2000],
  registers: [register]
});

export const agentLatency = new client.Histogram({
  name: 'agent_latency_ms',
  help: 'Latency per agent tool',
  labelNames: ['tool', 'ok'],
  buckets: [10, 50, 100, 200, 400, 800, 1600],
  registers: [register]
});

export const toolCallTotal = new client.Counter({
  name: 'tool_call_total',
  help: 'Total tool invocations',
  labelNames: ['tool', 'ok'],
  registers: [register]
});

export const agentFallbackTotal = new client.Counter({
  name: 'agent_fallback_total',
  help: 'Fallback occurrences by tool',
  labelNames: ['tool'],
  registers: [register]
});

export const rateLimitBlocked = new client.Counter({
  name: 'rate_limit_block_total',
  help: 'Rate limited requests total',
  labelNames: ['type'],
  registers: [register]
});

export const actionBlocked = new client.Counter({
  name: 'action_blocked_total',
  help: 'Blocked action attempts by policy',
  labelNames: ['policy'],
  registers: [register]
});

export function metricsRouteHandler (req, res) {
  res.set('Content-Type', register.contentType);
  res.send(register.metrics());
}

export function timeRequest (labels, fn) {
  const end = requestLatency.startTimer(labels);
  try {
    return fn();
  } finally {
    end();
  }
}

export default register;
