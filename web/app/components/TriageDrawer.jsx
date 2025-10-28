'use client';

import { useEffect, useRef, useState } from 'react';
import { streamTriage, executeFreezeAction, executeDisputeAction } from '../lib/api';

export default function TriageDrawer({ open, onClose, alert, runState, onEvents }) {
  const closeRef = useRef(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [actionStatus, setActionStatus] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const events = runState?.events || [];
  const summary = runState?.result;
  const action = summary?.recommendedAction;
  const risk = (summary?.risk || alert?.risk || '').toUpperCase();
  const fallbackUsed = Boolean(summary?.fallbackUsed);
  const knowledge = Array.isArray(summary?.kb) ? summary.kb : [];

  useEffect(() => {
    if (!runState?.runId || !open) return () => {};
    const cleanup = streamTriage(runState.runId, (evt) => {
      onEvents?.(evt);
    });
    return cleanup;
  }, [open, runState?.runId, onEvents]);

  useEffect(() => {
    if (open) {
      closeRef.current?.focus();
      const handler = (evt) => {
        if (evt.key === 'Escape') onClose?.();
      };
      document.addEventListener('keydown', handler);
      return () => document.removeEventListener('keydown', handler);
    }
    return undefined;
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setOtpOpen(false);
      setActionStatus(null);
    }
  }, [open]);

  useEffect(() => {
    if (!action) {
      setOtpOpen(false);
      setOtpValue('');
      setActionStatus(null);
      return;
    }
    setOtpOpen(false);
    setOtpValue(action.otp || '');
    setActionStatus(null);
  }, [action?.type, action?.otp, alert?.id]);

  if (!open) return null;

  const formatCurrency = (amount, currency = 'USD') => {
    if (typeof amount !== 'number') return null;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
    } catch (err) {
      return `${currency} ${(amount / 100).toFixed(2)}`;
    }
  };

  const friendlyError = (message) => {
    if (message === 'rate_limited') return 'Rate limited – retry after a moment.';
    return message || 'Action failed';
  };

  const handleFreezeSubmit = async (evt) => {
    evt.preventDefault();
    if (!action?.cardId) {
      setActionStatus({ variant: 'error', message: 'Missing card context for freeze.' });
      return;
    }
    setActionStatus(null);
    setActionLoading(true);
    try {
      const payload = {
        cardId: action.cardId,
        customerId: action.customerId || alert?.customer_id,
        alertId: action.alertId || alert?.id,
        otp: otpValue
      };
      const response = await executeFreezeAction(payload);
      const status = response.status || '';
      const variant = status === 'FROZEN' ? 'success' : 'info';
      const message = response.message || (status === 'FROZEN' ? 'Card frozen successfully.' : 'OTP verification required.');
      setActionStatus({ variant, message });
      if (status === 'FROZEN') {
        setOtpOpen(false);
        const nextResult = summary ? { ...summary, recommendedAction: null } : null;
        onEvents?.({
          type: 'action_update',
          payload: {
            data: {
              action: 'freeze_card',
              status,
              message,
              caseId: response.caseId,
              nextResult
            },
            ts: new Date().toISOString()
          }
        });
      }
    } catch (err) {
      setActionStatus({ variant: 'error', message: friendlyError(err.message) });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispute = async () => {
    if (!action?.txnId) {
      setActionStatus({ variant: 'error', message: 'Missing transaction context for dispute.' });
      return;
    }
    setActionStatus(null);
    setActionLoading(true);
    try {
      const response = await executeDisputeAction({
        customerId: action.customerId || alert?.customer_id,
        txnId: action.txnId,
        amountCents: action.amountCents,
        reasonCode: action.reasonCode || '10.4',
        alertId: action.alertId || alert?.id
      });
      setActionStatus({
        variant: 'success',
        message: response.caseId ? `Dispute opened – case ${response.caseId}.` : 'Dispute opened.'
      });
      const nextResult = summary ? { ...summary, recommendedAction: null } : null;
      onEvents?.({
        type: 'action_update',
        payload: {
          data: {
            action: 'open_dispute',
            status: response.status || 'OPEN',
            caseId: response.caseId,
            nextResult
          },
          ts: new Date().toISOString()
        }
      });
    } catch (err) {
      setActionStatus({ variant: 'error', message: friendlyError(err.message) });
    } finally {
      setActionLoading(false);
    }
  };

  const statusColor = actionStatus?.variant === 'error'
    ? 'text-red-400'
    : actionStatus?.variant === 'success'
      ? 'text-emerald-400'
      : 'text-sky-300';

  const amountDisplay = action?.amountCents ? formatCurrency(action.amountCents, action.currency) : null;

  return (
    <>
      {otpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleFreezeSubmit}
            className="w-full max-w-sm rounded border border-slate-800 bg-slate-900 p-5 shadow-xl"
          >
            <h4 className="text-lg font-semibold text-slate-100">Freeze Card</h4>
            <p className="mt-1 text-xs text-slate-400">Enter the OTP to complete the freeze workflow.</p>
            <label htmlFor="triage-otp-input" className="mt-4 block text-xs font-medium text-slate-400">
              One-Time Passcode
            </label>
            <input
              id="triage-otp-input"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]*"
              value={otpValue}
              onChange={(evt) => setOtpValue(evt.target.value)}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              placeholder="123456"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOtpOpen(false)}
                className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {actionLoading ? 'Submitting…' : 'Confirm Freeze'}
              </button>
            </div>
          </form>
        </div>
      )}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-y-0 right-0 flex w-full max-w-xl flex-col gap-4 border-l border-slate-800 bg-slate-900 p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Triage: {risk || '—'}</h2>
            <p className="text-sm text-slate-400">Alert {alert?.id}</p>
            <p className="mt-1 text-xs text-slate-500">
              Fallback used:{' '}
              <span className={fallbackUsed ? 'text-amber-400' : 'text-slate-300'}>
                {fallbackUsed ? 'Yes' : 'No'}
              </span>
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
          >
            Close
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto">
          <section aria-live="polite" className="rounded border border-slate-800 p-3">
            <h3 className="font-medium">Recommended Action</h3>
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-sm text-slate-300">
                  {action?.label || (summary ? 'No action required' : 'Pending decision')}
                </p>
                {summary?.summary && (
                  <p className="text-xs text-slate-500">{summary.summary}</p>
                )}
                {action?.type && (
                  <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 text-[11px] uppercase tracking-wide text-slate-400">
                    {action.type.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              {!action && (
                <p className="text-xs text-slate-500">Monitor the account; no workflow required right now.</p>
              )}
              {action?.type === 'freeze_card' && risk === 'HIGH' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionStatus(null);
                      setOtpValue(action.otp || '');
                      setOtpOpen(true);
                    }}
                    className="rounded bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-60"
                    disabled={actionLoading}
                  >
                    Freeze Card
                  </button>
                  <p className="text-xs text-slate-500">
                    OTP required:{' '}
                    <span className="font-mono text-slate-300">{action.otp || '—'}</span>
                  </p>
                </div>
              )}
              {action?.type === 'open_dispute' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleDispute}
                    className="rounded bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-60"
                    disabled={actionLoading}
                  >
                    Open Dispute
                  </button>
                  <div className="text-xs text-slate-500">
                    <p>Reason Code: {action.reasonCode || 'N/A'}</p>
                    {amountDisplay ? <p>Amount: {amountDisplay}</p> : null}
                  </div>
                </div>
              )}
              {actionStatus?.message && (
                <p className={`text-xs ${statusColor}`}>{actionStatus.message}</p>
              )}
            </div>
          </section>
          {knowledge.length > 0 && (
            <section className="rounded border border-slate-800 p-3">
              <h3 className="font-medium">KB References</h3>
              <ul className="space-y-2 text-xs text-slate-400">
                {knowledge.map((doc) => (
                  <li key={doc.docId} className="rounded bg-slate-800/40 p-2">
                    <p className="text-sm text-slate-200">{doc.title}</p>
                    {doc.excerpt && <p className="mt-1 text-slate-500">{doc.excerpt}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="rounded border border-slate-800 p-3">
            <h3 className="font-medium">Event Timeline</h3>
            <ul className="space-y-2 text-sm">
              {events.map((evt) => (
                <li key={evt.ts} className="rounded bg-slate-800/50 p-2">
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                    <span>{evt.event}</span>
                    <span>{new Date(evt.ts).toLocaleTimeString()}</span>
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-xs text-slate-300">
                    {JSON.stringify(evt.data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
