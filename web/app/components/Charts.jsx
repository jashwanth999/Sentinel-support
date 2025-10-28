'use client';

import Link from 'next/link';

const KPI_CARDS = [
  {
    key: 'alertsTotal',
    label: 'Total Alerts',
    href: '/alerts?filter=all',
    description: 'All alerts currently active for review'
  },
  {
    key: 'frozenCards',
    label: 'Frozen Cards',
    href: '/alerts?filter=frozen',
    description: 'Cards that were marked fraudulent and frozen'
  },
  {
    key: 'openDisputes',
    label: 'Open Disputes',
    href: '/alerts?filter=open-disputes',
    description: 'Disputes initiated for transaction reversal'
  },
  {
    key: 'fallbackRuns',
    label: 'Fallbacks Triggered',
    href: '/alerts?filter=fallback',
    description: 'Number of automated triage timeouts using fallback logic'
  }
];

export default function Charts({ summary: metrics = {} }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_CARDS.map(({ key, label, href, description }) => (
        <Link
          key={key}
          href={href}
          className="rounded border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-700 hover:bg-slate-800/60"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-100">
            {Number.isFinite(Number(metrics[key]))
              ? Number(metrics[key]).toLocaleString('en-US')
              : '—'}
          </p>
          <p className="mt-2 text-xs text-slate-400">{description}</p>
        </Link>
      ))}
    </div>
  );
}
