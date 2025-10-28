const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

async function handleResponse(res) {
  const parseBody = async () => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  };

  if (!res.ok) {
    const body = await parseBody();
    const error = new Error(body.error || 'Request failed');
    error.status = res.status;
    const retryAfter = res.headers.get('retry-after') || res.headers.get('Retry-After');
    if (retryAfter) error.retryAfter = Number(retryAfter) || retryAfter;
    error.body = body;
    throw error;
  }

  return parseBody();
}

export async function fetchDashboardSummary() {
  const res = await fetch(`${API_BASE}/api/dashboard/summary`);
  return handleResponse(res);
}

export async function fetchAlerts() {
  const res = await fetch(`${API_BASE}/api/alerts`);
  const fixedRes = await handleResponse(res);
  return fixedRes;
}

export async function fetchCustomerTransactions(customerId, params = {}) {
  const query = new URLSearchParams(params);
  const res = await fetch(`${API_BASE}/api/customer/${customerId}/transactions?${query.toString()}`);
  return handleResponse(res);
}
export async function startTriage(alertId, customerId) {
  const res = await fetch(`${API_BASE}/api/triage`, {
    method: 'POST',
    headers: baseActionHeaders(),
    body: JSON.stringify({ alertId, customerId })
  });
  return handleResponse(res);
}

export function streamTriage(runId, onEvent) {
  const url = `${API_BASE}/api/triage/${runId}/stream`;
  const source = new EventSource(url, { withCredentials: false });
  const events = ['plan_built', 'tool_update', 'fallback_triggered', 'decision_finalized'];
  events.forEach((event) => {
    source.addEventListener(event, (evt) => {
      try {
        const data = JSON.parse(evt.data);
        onEvent({ type: event, payload: data });
      } catch (err) {
        console.error('SSE parse error', err);
      }
    });
  });
  source.onerror = () => {
    source.close();
  };
  return () => source.close();
}

function baseActionHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.NEXT_PUBLIC_API_KEY || 'dev-api-key',
    'X-User-Role': 'agent',
    'X-User-Id': process.env.NEXT_PUBLIC_AGENT_ID || 'demo-agent',
    ...extra
  };
}

export async function executeFreezeAction(payload) {
  const res = await fetch(`${API_BASE}/api/actions/freeze-card`, {
    method: 'POST',
    headers: baseActionHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function executeDisputeAction(payload) {
  const res = await fetch(`${API_BASE}/api/actions/open-dispute`, {
    method: 'POST',
    headers: baseActionHeaders(),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}
