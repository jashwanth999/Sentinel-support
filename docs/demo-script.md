# Demo Script (8 minutes)

1. **Setup (0:00–0:30)** – Show Docker Compose running (`docker compose ps`) and open Grafana dashboard placeholder.
2. **Dashboard (0:30–1:45)** – Navigate to `/dashboard`, highlight KPI cards (alerts open, disputes open, avg triage latency) and dark-mode toggle.
3. **Alerts Queue (1:45–3:30)** – Open `/alerts`, scroll virtualized list, emphasize rate-limit protection and SSE-ready call-to-action.
4. **Freeze Card with OTP (3:30–5:00)** – Select high-risk alert, open triage drawer, watch streaming events, submit Freeze action with OTP `123456`, observe status `FROZEN`, mention metrics counter `action_blocked_total{policy="otp_required"}`.
5. **Open Dispute (5:00–6:15)** – Navigate to related transaction, trigger Open Dispute, show case status `OPEN` and KB citation referencing policy 10.4.
6. **Fallback Scenario (6:15–6:45)** – Set `RISK_TIMEOUT_SIMULATION=true`, rerun triage to demonstrate `fallback_triggered` events and resilience messaging.
7. **429 Showcase (6:45–7:15)** – Run a bursty curl loop to hit the Redis rate limit, highlight UI controls disabling actions and `/metrics` counter growth.
8. **Observability (7:15–7:45)** – Curl `/metrics`, walk through Prometheus histograms, then tail JSON logs showing `masked:true` and redacted PANs.
9. **Wrap (7:45–8:00)** – Summarize eval CLI (`docker compose exec api node src/cli/eval.js`) and reference the updated `docs/eval-report.txt`.
