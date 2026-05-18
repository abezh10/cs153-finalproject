'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function RegenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const click = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/profile', { method: 'POST' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      startTransition(() => router.refresh());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {err && <span className="text-xs text-red-600">{err}</span>}
      <button
        onClick={click}
        disabled={busy}
        className="text-xs border rounded px-2 py-1 dark:border-zinc-700 disabled:opacity-50"
      >
        {busy ? 'Regenerating…' : 'Regenerate'}
      </button>
    </div>
  );
}
