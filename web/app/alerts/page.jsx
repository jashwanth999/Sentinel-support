'use client';

import { useEffect, useState, useCallback } from 'react';
import VirtualTable from '../components/VirtualTable';
import TriageDrawer from '../components/TriageDrawer';
import { fetchAlerts, startTriage } from '../lib/api';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [triageState, setTriageState] = useState({ events: [] });
  const [error, setError] = useState(null);
  const [rateLimitUntil, setRateLimitUntil] = useState(0);

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlerts(data.items);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const isRateLimited = rateLimitUntil > Date.now();

  const handleOpenTriage = async (row) => {
    if (isRateLimited) return;
    setSelected(null);
    setError(null);
    setTriageState({ events: [] });
    try {
      const run = await startTriage(row.id, row.customer_id);
      setSelected(row);
      setRateLimitUntil(0);
      setTriageState({
        runId: run.runId,
        alertId: run.alertId,
        events: run.events || [],
        result: run.result
      });
    } catch (err) {
      console.error(err);
      if (err.status === 429) {
        const retryAfter = typeof err.retryAfter === 'number' ? err.retryAfter : Number(err.retryAfter);
        const delayMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000;
        setRateLimitUntil(Date.now() + delayMs);
        setError('Rate limited – please retry in a moment.');
      } else {
        setError('Unable to start triage. Please try again.');
      }
    }
  };

  return (
    <div className="relative">
      <h2 className="mb-4 text-xl font-semibold">Alerts Queue</h2>
      {error && (
        <p className="mb-3 text-sm text-amber-400">{error}</p>
      )}
      <VirtualTable
        rows={alerts}
        rowRenderer={(row) => (
          <button
            type="button"
            onClick={() => handleOpenTriage(row)}
            disabled={isRateLimited}
            className="flex h-full w-full items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-50"
          >
            <div>
              <p className="font-medium">{row.merchant || 'Unknown Merchant'}</p>
              <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleString()}</p>
            </div>
            <div className="text-sm uppercase text-slate-400">{row.risk || 'medium'}</div>
          </button>
        )}
      />
      <TriageDrawer
        open={Boolean(selected)}
        alert={selected}
        runState={triageState}
        onClose={() => {
          setSelected(null);
          setTriageState({ events: [] });
        }}
        onEvents={(evt) => {
          setTriageState((prev) => {
            const payload = evt.payload.data || evt.payload;
            const record = {
              event: evt.type,
              data: payload,
              ts: evt.payload.ts || new Date().toISOString()
            };
            const existingEvents = prev.events || [];
            if (existingEvents.some((item) => item.event === record.event && item.ts === record.ts)) {
              return prev;
            }
            const nextResult = payload?.nextResult;
            const updatedResult = evt.type === 'decision_finalized'
              ? payload
              : nextResult || prev.result;
            return {
              ...prev,
              events: [...existingEvents, record],
              result: updatedResult
            };
          });
        }}
      />
    </div>
  );
}
