'use client';

export default function EvalsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Eval CLI</h2>
      <p className="text-sm text-slate-300">
        Run <code className="rounded bg-slate-800 px-1">docker compose exec api node src/cli/eval.js</code> to execute the 12+ acceptance scenarios.
        Paste the output into <code className="rounded bg-slate-800 px-1">docs/eval-report.txt</code> for tracking.
      </p>
      <p className="text-sm text-slate-400">Fixtures live under <code className="rounded bg-slate-800 px-1">/fixtures/evals</code>; tweak or extend as needed.</p>
    </div>
  );
}
