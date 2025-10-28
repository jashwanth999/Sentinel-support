'use client';

export default function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded border border-slate-700 px-3 py-1 text-sm hover:bg-slate-800"
    >
      {dark ? 'Switch to Light' : 'Switch to Dark'}
    </button>
  );
}
