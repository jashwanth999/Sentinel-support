'use client';

import { useEffect, useState } from 'react';
import VirtualTable from '../../components/VirtualTable';
import { fetchCustomerTransactions } from '../../lib/api';

export default function CustomerPage({ params }) {
  const { id } = params;
  const [data, setData] = useState({ items: [] });

  useEffect(() => {
    fetchCustomerTransactions(id, { limit: 100 })
      .then(setData)
      .catch((err) => console.error(err));
  }, [id]);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Customer Timeline</h2>
      <VirtualTable
        rows={data.items}
        rowRenderer={(row) => (
          <div className="flex h-full items-center justify-between">
            <div>
              <p className="font-medium">{row.merchant}</p>
              <p className="text-xs text-slate-400">{new Date(row.ts).toLocaleString()}</p>
            </div>
            <div className="text-sm text-slate-300">{(row.amount_cents / 100).toFixed(2)} {row.currency}</div>
          </div>
        )}
      />
    </div>
  );
}
