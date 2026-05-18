'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { RecCard, type RecCardData } from '@/components/RecCard';

export function MockRecsView({ domain, title }: { domain: 'food' | 'shopping'; title: string }) {
  const [cards, setCards] = useState<RecCardData[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/mock-recs/${domain}`, { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `status ${res.status}`);
      setCards(body.cards);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [domain]);

  useEffect(() => {
    // Initial fetch on mount; setState is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => void load()}
            disabled={busy}
            className="text-xs border rounded px-2 py-1 dark:border-zinc-700 disabled:opacity-50"
          >
            {busy ? 'Loading…' : 'Regenerate'}
          </button>
          <Link href="/dashboard" className="text-sm underline">
            ← dashboard
          </Link>
        </div>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {!cards && !err && <p className="text-sm text-zinc-500">Generating recommendations…</p>}
      {cards && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {cards.map((c, i) => (
            <RecCard key={`${c.title}-${i}`} data={c} />
          ))}
        </div>
      )}
    </main>
  );
}
