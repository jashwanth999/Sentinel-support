'use client';

import { useMemo, useState } from 'react';

export default function VirtualTable({ rows = [], rowRenderer, height = 420, overscan = 20 }) {
  const [scrollTop, setScrollTop] = useState(0);
  const rowHeight = 56;
  const totalHeight = rows.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(rows.length, Math.ceil((scrollTop + height) / rowHeight) + overscan);

  const visibleRows = useMemo(() => rows.slice(startIndex, endIndex), [rows, startIndex, endIndex]);

  return (
    <div
      className="relative overflow-y-auto border border-slate-800"
      style={{ height }}
      onScroll={(evt) => setScrollTop(evt.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleRows.map((row, idx) => {
          const absoluteIndex = startIndex + idx;
          return (
            <div
              key={row.id || absoluteIndex}
              style={{
                position: 'absolute',
                top: (absoluteIndex * rowHeight) + 'px',
                left: 0,
                right: 0,
                height: rowHeight
              }}
              className="border-b border-slate-800 px-4 hover:bg-slate-800/40"
            >
              {rowRenderer(row, absoluteIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
