'use client';

import { useEffect, useState } from 'react';
import Charts from '../components/Charts';
import { fetchDashboardSummary } from '../lib/api';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardSummary()
      .then(setSummary)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Operations KPIs</h2>
      {loading && <p className="text-sm text-slate-400">Loading metrics...</p>}
      {!loading && <Charts summary={summary} />}
    </div>
  );
}
