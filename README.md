# Sentinel Support — Fraud & Dispute Console (Demo)

End-to-end demo environment for triaging card fraud and cardholder disputes. The stack ships as Docker services (Next.js web, Express API, Postgres, Redis, Prometheus) plus rich fixtures and an automated evaluation suite.

## 🚀 Quickstart

```bash
cp .env.example .env && cp api/.env.example api/.env && cp web/.env.example web/.env
docker compose up --build -d
docker compose exec api node scripts/seed.js
docker compose exec api node src/cli/eval.js
```

## 🔗 Access

- Dashboard → http://localhost:3000/dashboard
- Alerts → http://localhost:3000/alerts
- Prometheus → http://localhost:3001/metrics

## 🧭 Routes

| Route | Description |
| --- | --- |
| `/dashboard` | KPIs (total alerts, disputes, fraud rate) |
| `/alerts` | View alerts; click one to triage |
| `/customer/:id` | Shows customer spend & anomalies |
| `/metrics` | Prometheus metrics |
| `/health` | API health check |

## 🧠 How to Test

- **Open Alerts:** visit `/alerts`, select any alert, and confirm the triage drawer opens with a *Freeze Card* button.
- **OTP Flow:** click *Freeze Card*, submit OTP `123456`, and watch the status transition to `FROZEN` in the drawer response.
- **Eval Suite:** `docker compose exec api node src/cli/eval.js` executes the demo scenarios and refreshes `docs/eval-report.txt` with the latest results.

## ✅ After Running These Steps You Can

- Browse rich demo data across customers, transactions, and alerts.
- Freeze cards through the OTP modal in the triage drawer.
- Validate automated scenarios via the eval CLI report.
- Monitor live Prometheus metrics for latency and rate-limit counters.

For a guided walkthrough see `docs/demo-script.md`, and use `docs/postman_collection.json` for API exploration.
