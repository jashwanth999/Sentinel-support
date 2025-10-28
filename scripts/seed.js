#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const fixturesDir = path.join(rootDir, 'fixtures');

dotenv.config({ path: path.join(rootDir, '.env') });
dotenv.config({ path: path.join(rootDir, 'api/.env') });

const { DATABASE_URL } = process.env;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString: DATABASE_URL });

function readJson(name) {
  const file = path.join(fixturesDir, name);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureValidId(row, columns) {
  if (!columns.includes('id')) return row;
  const copy = { ...row };
  if (copy.id !== undefined && copy.id !== null) {
    const value = typeof copy.id === 'string' ? copy.id : String(copy.id);
    if (!uuidRegex.test(value)) {
      copy.id = randomUUID();
    }
  }
  return copy;
}

async function seedTable({ table, columns, rows }) {
  if (!rows.length) return;
  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const normalizedChunk = chunk.map((row) => ensureValidId(row, columns));
    const values = [];
    const params = [];
    normalizedChunk.forEach((row, rowIdx) => {
      columns.forEach((column, colIdx) => {
        params.push(row[column]);
        values.push(`$${rowIdx * columns.length + colIdx + 1}`);
      });
    });
    const valueGroups = normalizedChunk.map((_, idx) => {
      const start = idx * columns.length;
      const placeholders = columns.map((__, colIdx) => `$${start + colIdx + 1}`);
      return `(${placeholders.join(',')})`;
    }).join(',');
    const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${valueGroups} ON CONFLICT DO NOTHING`;
    await client.query(sql, params);
  }
}

async function main () {
  await client.connect();
  console.log('Connected to database');

  const customers = readJson('customers.json');
  const cards = readJson('cards.json');
  const accounts = readJson('accounts.json');
  const transactions = readJson('transactions.json');
  const alerts = readJson('alerts.json');
  const kbDocs = readJson('kb_docs.json');
  const policies = readJson('policies.json');

  await seedTable({
    table: 'customers',
    columns: ['id', 'name', 'email_masked', 'kyc_level', 'created_at'],
    rows: customers
  });
  await seedTable({
    table: 'cards',
    columns: ['id', 'customer_id', 'last4', 'network', 'status', 'created_at', 'updated_at'],
    rows: cards
  });
  await seedTable({
    table: 'accounts',
    columns: ['id', 'customer_id', 'balance_cents', 'currency'],
    rows: accounts
  });
  await seedTable({
    table: 'transactions',
    columns: ['id', 'customer_id', 'card_id', 'mcc', 'merchant', 'amount_cents', 'currency', 'ts', 'device_id', 'country', 'city'],
    rows: transactions
  });
  await seedTable({
    table: 'alerts',
    columns: ['id', 'customer_id', 'suspect_txn_id', 'created_at', 'risk', 'status'],
    rows: alerts
  });
  await seedTable({
    table: 'kb_docs',
    columns: ['id', 'title', 'anchor', 'content_text'],
    rows: kbDocs
  });
  await seedTable({
    table: 'policies',
    columns: ['id', 'code', 'title', 'content_text'],
    rows: policies
  });

  console.log('Seeding complete');
  await client.end();
}

main().catch(async (err) => {
  console.error(err);
  await client.end();
  process.exit(1);
});
