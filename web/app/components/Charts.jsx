'use client';

const KPI_CARDS = [
  { key: 'alertsTotal', label: 'Total Alerts' },
  { key: 'frozenCards', label: 'Frozen Cards' },
  { key: 'openDisputes', label: 'Open Disputes' },
  { key: 'fallbackRuns', label: 'Fallback Runs' }
];

export default function Charts({ summary: metrics = {} }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {KPI_CARDS.map(({ key, label }) => (
        <div key={key} className="rounded border border-slate-800 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-slate-100">
            {Number.isFinite(Number(metrics[key]))
              ? Number(metrics[key]).toLocaleString('en-US')
              : '—'}
          </p>
        </div>
      ))}
    </div>
  );
}
