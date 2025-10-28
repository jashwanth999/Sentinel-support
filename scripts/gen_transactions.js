#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const count = Number(process.argv[2] || 200000);
const seed = Number(process.argv[3] || 42);

function mulberry32(a) {
  return function () {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(seed);
const merchants = ['ABC Mart', 'QuickCab', 'Globex', 'Initech', 'Stark Retail', 'Wayne Market'];
const currencies = ['USD', 'EUR', 'INR'];
const mccCodes = ['5411', '4899', '4111', '5732'];
const customers = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
];
const cards = [
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444'
];

function uuidFromIndex(idx) {
  const hex = (idx + seed).toString(16).padStart(12, '0');
  return `00000000-0000-0000-${hex.slice(0, 4)}-${hex.slice(4, 12)}`;
}

const rows = [];
for (let i = 0; i < count; i++) {
  const ts = new Date(Date.now() - rand() * 3600 * 24 * 180 * 1000);
  rows.push({
    id: uuidFromIndex(i),
    customer_id: customers[Math.floor(rand() * customers.length)],
    card_id: cards[Math.floor(rand() * cards.length)],
    mcc: mccCodes[Math.floor(rand() * mccCodes.length)],
    merchant: merchants[Math.floor(rand() * merchants.length)],
    amount_cents: Math.floor(rand() * 100000),
    currency: currencies[Math.floor(rand() * currencies.length)],
    ts: ts.toISOString(),
    device_id: `device-${Math.floor(rand() * 200)}`,
    country: rand() > 0.85 ? 'GB' : 'US',
    city: rand() > 0.5 ? 'New York' : 'San Francisco'
  });
}

const outputPath = path.resolve(process.cwd(), '../fixtures/transactions.json');
fs.writeFileSync(outputPath, JSON.stringify(rows, null, 2));
console.log(`Generated ${rows.length} transactions to ${outputPath}`);
