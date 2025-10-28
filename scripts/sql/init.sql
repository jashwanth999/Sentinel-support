CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email_masked TEXT NOT NULL,
  kyc_level TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  last4 CHAR(4) NOT NULL,
  network TEXT,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  balance_cents BIGINT DEFAULT 0,
  currency CHAR(3) DEFAULT 'USD'
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  card_id UUID REFERENCES cards(id),
  mcc TEXT,
  merchant TEXT,
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) DEFAULT 'USD',
  ts TIMESTAMPTZ NOT NULL,
  device_id TEXT,
  country TEXT,
  city TEXT
);

CREATE INDEX IF NOT EXISTS idx_transactions_customer_ts ON transactions (customer_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions (merchant);
CREATE INDEX IF NOT EXISTS idx_transactions_mcc ON transactions (mcc);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_merchant ON transactions (customer_id, merchant);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  suspect_txn_id UUID REFERENCES transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  risk TEXT,
  status TEXT DEFAULT 'OPEN'
);

CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id),
  alert_id UUID REFERENCES alerts(id),
  txn_id UUID REFERENCES transactions(id),
  type TEXT,
  status TEXT,
  reason_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS alert_id UUID REFERENCES alerts(id);

ALTER TABLE cases
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

CREATE TABLE IF NOT EXISTS case_events (
  id UUID PRIMARY KEY,
  case_id UUID REFERENCES cases(id),
  ts TIMESTAMPTZ DEFAULT NOW(),
  actor TEXT,
  action TEXT,
  payload_json JSONB
);

CREATE TABLE IF NOT EXISTS triage_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_id UUID REFERENCES alerts(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  risk TEXT,
  reasons JSONB,
  fallback_used BOOLEAN DEFAULT FALSE,
  latency_ms INTEGER
);

CREATE TABLE IF NOT EXISTS agent_traces (
  run_id UUID REFERENCES triage_runs(id),
  seq INT,
  step TEXT,
  ok BOOLEAN,
  duration_ms INT,
  detail_json JSONB,
  PRIMARY KEY (run_id, seq)
);

CREATE TABLE IF NOT EXISTS kb_docs (
  id UUID PRIMARY KEY,
  title TEXT,
  anchor TEXT,
  content_text TEXT
);

CREATE TABLE IF NOT EXISTS policies (
  id UUID PRIMARY KEY,
  code TEXT,
  title TEXT,
  content_text TEXT
);
