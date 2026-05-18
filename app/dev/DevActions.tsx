'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const ACTIONS = [
  { key: 'recompute_profile', label: 'Recompute profile' },
  { key: 'clear_engagements', label: 'Clear demo user engagements' },
  { key: 'clear_image_cache', label: 'Clear mock-rec image cache' },
  { key: 'reseed_taxonomy', label: 'Reseed taxonomy' },
] as const;

export function DevActions({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const run = async (action: string) => {
    if (action === 'clear_engagements' && !confirm('Delete all engagements for the demo user?')) return;
    setBusy(action);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/dev/actions?dev=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `status ${res.status}`);
      setMsg(`${action}: ok`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            onClick={() => void run(a.key)}
            disabled={busy !== null}
            className="text-sm border rounded px-3 py-1.5 dark:border-zinc-700 disabled:opacity-50"
          >
            {busy === a.key ? 'Running…' : a.label}
          </button>
        ))}
      </div>
      {msg && <p className="text-xs text-green-600">{msg}</p>}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}
