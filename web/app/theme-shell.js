'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import ThemeToggle from './components/ThemeToggle';

export default function ThemeShell({ children }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem('sentinel-theme');
    if (stored) setDark(stored === 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    window.localStorage.setItem('sentinel-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className={clsx(dark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900', 'min-h-screen')}>
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Sentinel Support Console</h1>
          <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
