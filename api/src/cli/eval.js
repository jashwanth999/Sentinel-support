#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';
import dotenv from 'dotenv';
import { startTriageRun, getRunState } from '../agents/orchestrator.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(rootDir, 'api/.env') });

const evalDir = path.join(rootDir, 'fixtures', 'evals');
const reportDirCandidates = [
  path.join(rootDir, '..', 'docs'),
  path.join(rootDir, 'docs')
];
let reportDir = reportDirCandidates.find((dir) => fs.existsSync(dir));
if (!reportDir) {
  reportDir = reportDirCandidates[0];
  fs.mkdirSync(reportDir, { recursive: true });
}
const reportFile = path.join(reportDir, 'eval-report.txt');
const scenarioOrdering = [
  'freeze_card_high_risk.json',
  'open_dispute_abc_mart.json',
  'risk_timeout_fallback.json',
  'redaction_check.json',
  'rate_limit_retry.json'
];

const fallbackScenarios = [
  {
    file: 'freeze_card_high_risk.json',
    title: 'Freeze Card',
    alertId: 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // High risk (Freeze)
    customerId: '11111111-1111-1111-1111-111111111111',
    expectations: {
      risk: 'high',
      action: 'freeze_card',
      label: 'Freeze Card',
      otp: '123456',
      cardId: '33333333-3333-3333-3333-333333333333',
      txnId: '77777777-7777-7777-7777-777777777777'
    },
    successMessage: 'Passed'
  },
  {
    file: 'open_dispute_abc_mart.json',
    title: 'Open Dispute',
    alertId: 'fffffff2-ffff-ffff-ffff-ffffffffffff', // Medium risk (ABC Mart)
    customerId: '22222222-2222-2222-2222-222222222222',
    expectations: {
      risk: 'medium',
      action: 'open_dispute',
      label: 'Open Dispute',
      cardId: '44444444-4444-4444-4444-444444444444',
      txnId: '99999999-9999-9999-9999-999999999999'
    },
    successMessage: 'Passed'
  },
  {
    file: 'duplicate_txn.json',
    title: 'Duplicate Transaction',
    alertId: 'fffffff3-ffff-ffff-ffff-ffffffffffff', // Low risk (QuickCab)
    customerId: '22222222-2222-2222-2222-222222222222',
    expectations: {
      risk: 'low',
      action: 'none',
      label: 'Monitor Only'
    },
    successMessage: 'Handled'
  },
  {
    file: 'risk_timeout_fallback.json',
    title: 'Timeout / Fallback',
    alertId: 'aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // Medium risk fallback
    customerId: '11111111-1111-1111-1111-111111111111',
    env: {
      RISK_TIMEOUT_SIMULATION: 'true'
    },
    expectations: {
      fallback: true
    },
    successMessage: 'Fallback Triggered'
  },
  {
    file: 'rate_limit_retry.json',
    title: 'Rate Limit',
    type: 'rate_limit_retry',
    action: {
      endpoint: '/api/action/freeze-card',
      method: 'POST',
      payload: {
        cardId: '33333333-3333-3333-3333-333333333333',
        customerId: '11111111-1111-1111-1111-111111111111',
        caseId: 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        otp: '123456'
      },
      attempts: 6
    },
    successMessage: 'Retry OK'
  }
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (typeof fetch !== 'function') {
  console.error('Fetch API not available in this runtime. Please use Node 18+ to run evals.'); // eslint-disable-line no-console
  process.exit(1);
}

function applyEnvOverrides (overrides = {}) {
  if (!overrides || !Object.keys(overrides).length) return () => {};
  const previous = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }
  return () => {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = previous[key];
      }
    }
  };
}

function sortScenarioFiles (files) {
  return files.sort((a, b) => {
    const idxA = scenarioOrdering.indexOf(a);
    const idxB = scenarioOrdering.indexOf(b);
    if (idxA === -1 && idxB === -1) return a.localeCompare(b);
    if (idxA === -1) return 1;
    if (idxB === -1) return -1;
    return idxA - idxB;
  });
}

function loadScenarios () {
  if (fs.existsSync(evalDir)) {
    const files = sortScenarioFiles(
      fs.readdirSync(evalDir).filter((file) => file.endsWith('.json'))
    );
    if (files.length) {
      return files.map((file) => {
        const data = JSON.parse(fs.readFileSync(path.join(evalDir, file), 'utf8'));
        return {
          file,
          title: data.title || path.basename(file, '.json'),
          ...data
        };
      });
    }
  }
  return fallbackScenarios;
}

async function waitForRunState (runId, timeoutMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = getRunState(runId);
    if (state?.result) return state;
    await delay(100);
  }
  return getRunState(runId);
}

function evaluateTriageExpectations ({ scenario, state }) {
  const expectations = scenario.expectations || {};
  const assertions = scenario.assertions || {};
  const result = state?.result || {};
  const action = result.recommendedAction || {};
  const events = state?.events || [];
  const failures = [];

  if (expectations.risk && result.risk !== expectations.risk) {
    failures.push(`Expected risk ${expectations.risk} but got ${result.risk || 'unknown'}`);
  }
  if (expectations.action && action.type !== expectations.action) {
    failures.push(`Expected action ${expectations.action} but received ${action.type || 'none'}`);
  }
  if (expectations.label && action.label !== expectations.label) {
    failures.push(`Expected label "${expectations.label}" but got "${action.label || ''}"`);
  }
  if (expectations.otp && action.otp !== expectations.otp) {
    failures.push('OTP recommendation mismatch');
  }
  if (expectations.cardId && action.cardId !== expectations.cardId) {
    failures.push('Card ID mismatch in recommendation');
  }
  if (expectations.txnId && action.txnId !== expectations.txnId) {
    failures.push('Transaction reference mismatch in recommendation');
  }
  if (expectations.reasonCode && action.reasonCode !== expectations.reasonCode) {
    failures.push('Reason code mismatch');
  }
  if (expectations.fallback) {
    const fallbackEvent = events.some((evt) => evt.event === 'fallback_triggered');
    if (!fallbackEvent) {
      failures.push('Expected fallback trigger event but none observed');
    }
  }

  if (assertions.forbidden || assertions.expected) {
    const haystack = JSON.stringify({ events, result });
    (assertions.forbidden || []).forEach((needle) => {
      if (haystack.includes(needle)) {
        failures.push(`Found forbidden string "${needle}" in outputs`);
      }
    });
    (assertions.expected || []).forEach((needle) => {
      if (!haystack.includes(needle)) {
        failures.push(`Missing expected string "${needle}" in outputs`);
      }
    });
  }

  return {
    action,
    risk: result.risk,
    passed: failures.length === 0,
    message: failures.join('; ') || scenario.successMessage || 'Passed'
  };
}

async function runTriageScenario (scenario) {
  const restoreEnv = applyEnvOverrides(scenario.env);
  try {
    const { alertId, customerId } = scenario;
    const { runId } = await startTriageRun({ alertId, customerId });
    const state = await waitForRunState(runId);
    if (!state?.result) {
      return {
        title: scenario.title,
        passed: false,
        message: 'No decision produced'
      };
    }
    const outcome = evaluateTriageExpectations({ scenario, state });
    return {
      title: scenario.title,
      passed: outcome.passed,
      message: outcome.message
    };
  } finally {
    restoreEnv();
  }
}

async function runRateLimitScenario (scenario) {
  const origin = (process.env.EVAL_API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE ||
    `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');

  const tokensToDrain = Math.max(1, (scenario.action?.attempts || 6) - 1);
  for (let i = 0; i < tokensToDrain; i += 1) {
    await fetch(`${origin}/health`).catch(() => {});
  }

  const urlTarget = `${origin}${scenario.action?.endpoint || '/api/actions/freeze-card'}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.API_KEY ||
      process.env.SENTINEL_API_KEY ||
      process.env.NEXT_PUBLIC_API_KEY ||
      'dev-api-key',
    'X-User-Role': 'agent',
    'X-User-Id': 'eval-suite'
  };

  let attempts = 0;
  const maxAttempts = scenario.action?.attempts || 6;
  let rateLimited = false;

  while (attempts < maxAttempts) {
    const response = await fetch(urlTarget, {
      method: scenario.action?.method || 'POST',
      headers,
      body: JSON.stringify(scenario.action?.payload || {})
    });
    attempts += 1;

    if (response.status === 429) {
      rateLimited = true;
      const retryAfterHeader = response.headers.get('retry-after') || response.headers.get('Retry-After');
      const retryAfterSeconds = Number(retryAfterHeader) || 1;
      await delay((retryAfterSeconds * 1000) + 50);
      continue;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        title: scenario.title,
        passed: false,
        message: `API error ${response.status}: ${body.error || 'unknown'}`
      };
    }

    if (!rateLimited) {
      return {
        title: scenario.title,
        passed: false,
        message: 'Rate limit was not triggered before success'
      };
    }

    const completed = body.status === 'FROZEN' || body.status === 'PENDING_OTP';
    return {
      title: scenario.title,
      passed: completed,
      message: completed ? scenario.successMessage || 'Passed' : 'Unexpected action status'
    };
  }

  return {
    title: scenario.title,
    passed: false,
    message: 'Exceeded retry attempts during rate limit scenario'
  };
}

async function runScenario (scenario) {
  if (scenario.type === 'rate_limit_retry') {
    return runRateLimitScenario(scenario);
  }
  return runTriageScenario(scenario);
}

function formatLine ({ title, passed, message }) {
  const symbol = passed ? '✔' : '✖';
  return `${symbol} ${title} – ${message}`;
}

async function main () {
  const scenarios = loadScenarios();
  if (!scenarios.length) {
    console.log('No eval scenarios found in fixtures/evals.'); // eslint-disable-line no-console
    return;
  }

  console.log(`Running ${scenarios.length} scenarios...`); // eslint-disable-line no-console

  const outcomes = [];
  const reportLines = [`Running ${scenarios.length} scenarios...`];

  for (const scenario of scenarios) {
    // eslint-disable-next-line no-await-in-loop
    const outcome = await runScenario(scenario);
    outcomes.push(outcome);
    const line = formatLine(outcome);
    reportLines.push(line);
    console.log(line); // eslint-disable-line no-console
  }

  const passedCount = outcomes.filter((outcome) => outcome.passed).length;
  const summaryLine = `Summary: ${passedCount}/${outcomes.length} passed`;
  reportLines.push(summaryLine);
  console.log(summaryLine); // eslint-disable-line no-console

  fs.writeFileSync(reportFile, `${reportLines.join('\n')}\n`, 'utf8');

  if (passedCount !== outcomes.length) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err); // eslint-disable-line no-console
  process.exit(1);
});
