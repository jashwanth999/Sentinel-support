'use client';

import { Suspense, useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import VirtualTable from '../components/VirtualTable';
import TriageDrawer from '../components/TriageDrawer';
import { fetchAlerts, startTriage } from '../lib/api';

const FILTER_DESCRIPTIONS = {
  all: 'All alerts currently in the queue.',
  frozen: 'Alerts with cards that have already been frozen.',
  'open-disputes': 'Alerts tied to an open dispute case.',
  fallback: 'Alerts whose last triage run triggered fallback logic.'
};

function AlertsPageContent() {
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [triageState, setTriageState] = useState({ events: [] });
  const [error, setError] = useState(null);
  const [rateLimitUntil, setRateLimitUntil] = useState(0);
  const searchParams = useSearchParams();
  const activeFilter = searchParams?.get('filter') || 'all';

  const loadAlerts = useCallback(async () => {
    try {
      const data = await fetchAlerts();
      setAlerts(data.items || []);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const isRateLimited = rateLimitUntil > Date.now();

  const filteredAlerts = useMemo(() => {
    if (!alerts?.length) return [];
    if (activeFilter === 'all') return alerts;
    const toUpper = (value) => (typeof value === 'string' ? value.toUpperCase() : value);
    return alerts.filter((row) => {
      const cardStatus = toUpper(row.card_status || row.cardStatus || '');
      const alertStatus = toUpper(row.status || '');
      const disputeStatus = toUpper(row.dispute_status || row.disputeStatus || '');
      const fallbackUsed = Boolean(row.fallback_used || row.fallbackUsed);
      switch (activeFilter) {
        case 'frozen':
          return cardStatus === 'FROZEN' || alertStatus === 'CLOSED';
        case 'open-disputes':
          return disputeStatus === 'OPEN' || alertStatus === 'IN_REVIEW';
        case 'fallback':
          return fallbackUsed;
        default:
          return true;
      }
    });
  }, [alerts, activeFilter]);

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
      <div className="mb-3 flex flex-col gap-1 text-xs text-slate-400">
        <span>
          Active filter:{' '}
          <span className="uppercase text-slate-200">{activeFilter.replace(/-/g, ' ')}</span>
        </span>
        <span>{FILTER_DESCRIPTIONS[activeFilter] || FILTER_DESCRIPTIONS.all}</span>
      </div>
      {error && (
        <p className="mb-3 text-sm text-amber-400">{error}</p>
      )}
      {!filteredAlerts.length && (
        <p className="mb-3 text-sm text-slate-500">No alerts match this view right now.</p>
      )}
      <VirtualTable
        rows={filteredAlerts}
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
        onActionComplete={loadAlerts}
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

export default function AlertsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AlertsPageContent />
    </Suspense>
  );
}
