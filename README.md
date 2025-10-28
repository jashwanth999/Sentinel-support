# Sentinel Support — Fraud & Dispute Console

Sentinel Support is a full-stack demo for card-fraud triage and dispute case management. It ships a Next.js front-end, Express API, PostgreSQL, Redis, and Prometheus metrics – all orchestrated through Docker Compose. The demo provides seeded data, live KPIs, and an automated evaluation script that exercises every triage scenario end-to-end.

---

## 1. Environment Setup

1. **Bootstrap environment files**
   ```bash
   cp .env.example .env
   cp api/.env.example api/.env
   cp web/.env.example web/.env
   ```

2. **Start the stack** (Next.js web, Express API, Postgres, Redis, Prometheus):
   ```bash
   docker compose up --build -d
   ```

3. **Seed the database** with customers, cards, transactions, alerts, KB docs, and policies:
   ```bash
   docker compose exec api node scripts/seed.js
   ```
   Example output:
   ```text
   Connected to database
   Seeding complete
   ```

4. **Run the automated evaluation suite** (described in section 5) whenever you want to verify flows:
   ```bash
   docker compose exec api node src/cli/eval.js
   ```
   Example tail of the report:
   ```text
   PASS Freeze Card – Card frozen and action recommended
   PASS Open Dispute – Open dispute recommended
   PASS Duplicate – No action required for duplicate auth
   PASS Timeout – Fallback triggered with no action
   PASS Rate Limit – Retry OK after 429
   Summary: 5/5 passed
   ```

> **OTP reminder**: All freeze workflows use the one-time passcode `123456`.

---

## 2. Core Routes

| Route | Description |
| --- | --- |
| `/dashboard` | KPI overview with clickable filters to jump into specific alert cohorts |
| `/alerts` | Alerts queue with virtualised table, triage drawer, and live SSE updates |
| `/customer/:id` | Customer activity, balances, and transaction history | Find the CustomerId in Event timeline by clicking the drawer
| `/metrics` | Prometheus metrics exported by the API |

### Quick Links
- Dashboard → http://localhost:3000/dashboard
<img width="500" height="330" alt="Image" src="https://github.com/user-attachments/assets/35326b44-7e51-4225-a800-4cfc95eefb2f" />

- Alerts → http://localhost:3000/alerts
<img width="500" height="330" alt="Image" src="https://github.com/user-attachments/assets/5211962b-d81e-4f02-a16e-934a8b18bb6f" />

<img width="500" height="330" alt="Image" src="https://github.com/user-attachments/assets/fc566875-934a-48f7-b99d-207c13cf65f5" />

- Alerts → http://localhost:3000/customer/11111111-1111-1111-1111-111111111111

<img width="500" height="330" alt="Image" src="https://github.com/user-attachments/assets/67102392-4237-4811-a8e2-eb07b6b7f180" />

- Metrics → http://localhost:3001/metrics

---

## 3. Triage Workflow Walkthrough

Every alert opens a triage drawer with a recommended action, context, knowledge-base snippets, and an event timeline that streams live updates.

### A. Freeze Card (High Risk)
1. Open `/alerts` and select the high-risk alert (e.g., *Neon Electronics*).
2. Click **Freeze Card** and enter OTP `123456`.
3. The drawer immediately reports **“Card frozen successfully ✅”**, disables the button, and the event timeline logs the freeze action.
4. The card is persisted as `FROZEN` in Postgres, the alert closes, and the **Frozen Cards** KPI increments. Reloading the page preserves the state and the button stays disabled with **“Card already frozen ✅”**.

### B. Open Dispute (Medium Risk / ABC Mart)
1. Select the medium-risk *ABC Mart ₹4,999* alert.
2. Choose **Open Dispute**. The drawer confirms **“Dispute case created successfully 🧾”** and disables the button.
3. A dispute case is recorded with status `OPEN`, the alert switches to `IN_REVIEW`, and the **Open Disputes** KPI increases. Re-opening the drawer shows **“Dispute already created 🧾”** and the timeline reflects the case ID.

### C. Duplicate Transaction (Low Risk / QuickCab)
1. Open the *QuickCab* alert.
2. Sentinel identifies matching authorisations and displays the KB excerpt **“Duplicate Authorization Guidance”**.
3. No action button is surfaced; the drawer explains why no dispute is necessary and the timeline captures the duplicate analysis.

### D. Timeout / Fallback
1. Set `RISK_TIMEOUT_SIMULATION=true` in `api/.env` and restart the API container:
   ```bash
   docker compose restart api
   ```
2. Re-open any alert. The triage drawer shows **Fallback used: Yes** and recommends monitoring without irreversible action.
3. The fallback event is logged, `triage_runs.fallback_used` is recorded, and the **Fallbacks Triggered** KPI increments.

### E. Rate-Limit Guardrail
Click the same alert’s triage button rapidly (6+ times). The API responds with `429` and a `Retry-After` header, the UI shows **“Rate limited – please retry in a moment.”**, and temporarily disables triage interactions until the retry window passes.

---

## 4. Dashboard KPIs

Every KPI card is clickable and routes to `/alerts` with the relevant filter applied:

| KPI Card | Description | Filter |
| --- | --- | --- |
| Total Alerts | All alerts currently active for review | `?filter=all` |
| Frozen Cards | Cards frozen via triage | `?filter=frozen` |
| Open Disputes | Alerts with an open dispute case | `?filter=open-disputes` |
| Fallbacks Triggered | Alerts whose latest triage used fallback logic | `?filter=fallback` |

The alerts table dynamically filters based on the active KPI. Empty states and helper text describe the current cohort, making it easy to pivot between frozen cards, disputes, and fallback cases.

---

## 5. Automated QA (`src/cli/eval.js`)

`eval.js` is a Node script that replays every supported scenario against the live API. It produces a PASS/FAIL report saved to `docs/eval-report.txt` and exits non-zero if any scenario fails.

Scenarios covered:

1. **Freeze Card** – verifies a high-risk alert recommends freezing and returns the correct OTP metadata.
2. **Open Dispute** – ensures medium-risk alerts recommend policy 10.4 disputes.
3. **Duplicate** – confirms duplicate transactions yield no action with the KB guidance.
4. **Timeout / Fallback** – validates fallback events and absence of irreversible actions.
5. **Rate Limit Retry** – exhausts the rate limiter, honours `Retry-After`, and succeeds thereafter.

Run it anytime:
```bash
docker compose exec api node src/cli/eval.js
cat docs/eval-report.txt
```

---

## 6. Tips & Troubleshooting

- The OTP modal always accepts `123456`.
- Each successful freeze/dispute action records a `case_events` entry for auditing.
- The alerts table is virtualised; scrolling keeps the UI smooth even with large datasets.
- Prometheus metrics (http://localhost:3001/metrics) expose rate-limit counters, request timings, and action blocks for monitoring exercises.
- Need a fresh slate? Re-run `scripts/seed.js` – it is idempotent and safe to execute multiple times.

Enjoy the tour! Sentinel Support now delivers an end-to-end demo that mirrors real-world risk operations while remaining simple to explore locally.
