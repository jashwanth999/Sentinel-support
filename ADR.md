# Architecture Decision Highlights

- **Keyset pagination**: `/api/customer/:id/transactions` uses `(ts,id)` base64 cursor to guarantee stable, dup-free paging on large datasets.
- **SSE over WebSockets**: Triage streaming relies on Server-Sent Events for deterministic, lightweight delivery and native browser backoff.
- **CSR-only Next.js**: All routes opt into client rendering (`"use client"`) to avoid leaking API keys and to simplify CSP and SSE usage.
- **Idempotency via Redis**: Mutation routes respect `Idempotency-Key`, caching full JSON responses in Redis with 24h TTL.
- **Redis token bucket rate limit**: 5 req/s per client with Lua script to increment `rate_limit_block_total` metrics and return `Retry-After` hints.
- **Structured logging**: Pino emits JSON `{ts, level, requestId, runId, masked:true}` to ease ingestion and ensure redaction honors PAN/email policies.
- **Redaction middleware**: All payloads flow through PAN/email masking before logging or audit persistence, keeping PII out of storage.
- **Agent circuit breakers**: Orchestrator enforces ≤1 s/tool execution with retries, circuit breaker counters, and `fallback_triggered` events.
- **Prometheus metrics**: Histograms for API/agent latency plus counters for rate limits, tool calls, and policy denials feed Grafana dashboards.
- **Fixtures-first data**: Deterministic JSON + generator script allow consistent acceptance/eval scenarios without external dependencies.
