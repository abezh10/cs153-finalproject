'use client';

import { useState } from 'react';
import { TagEditor, type EditedTag } from './TagEditor';

export type VideoReviewItem = {
  id: string;
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  duration_ms: number;
  review: {
    status: 'pending' | 'approved' | 'rejected' | 'edited';
    ai_raw: { tags?: { slug: string; weight: number }[]; confidence?: number } & Record<string, unknown>;
    edited_tags: EditedTag[] | null;
    reviewed_at: string | null;
    notes: string | null;
  } | null;
  effective_tags: { slug: string; weight: number }[];
};

export function VideoReviewCard({ item, token }: { item: VideoReviewItem; token: string }) {
  const [status, setStatus] = useState(item.review?.status ?? 'pending');
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<EditedTag[]>(
    item.review?.edited_tags ?? item.review?.ai_raw?.tags ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [tags, setTags] = useState<{ slug: string; weight: number }[]>(item.effective_tags);

  const post = async (path: string, body: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${path}?dev=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(j));
      return j;
    } catch (e) {
      setErr((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  };

  const review = async (s: 'approved' | 'rejected' | 'edited') => {
    const body: { status: string; edited_tags?: EditedTag[] } = { status: s };
    if (s === 'edited') body.edited_tags = edited;
    await post(`/api/dev/videos/${item.id}/review`, body);
    setStatus(s);
    if (s === 'edited') {
      setTags(edited);
      setEditing(false);
    }
  };

  const retag = async () => {
    const r = (await post(`/api/dev/videos/${item.id}/retag`, {})) as {
      ai_raw: { tags: { slug: string; weight: number }[] };
      tags: { slug: string; weight: number }[];
    };
    setEdited(r.ai_raw.tags);
    setTags(r.tags);
    setStatus('pending');
  };

  const badgeColor =
    status === 'approved'
      ? 'bg-green-100 text-green-800'
      : status === 'rejected'
        ? 'bg-red-100 text-red-800'
        : status === 'edited'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-zinc-100 text-zinc-800';

  return (
    <article className="border rounded-lg overflow-hidden bg-white dark:bg-zinc-900 dark:border-zinc-800 flex">
      <div className="w-48 shrink-0 bg-black relative group">
        {item.thumbnail_url && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:opacity-0 transition" />
        )}
        <video
          src={item.url}
          muted
          loop
          preload="none"
          onMouseEnter={(e) => void (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
          onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition"
        />
      </div>
      <div className="flex-1 p-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] px-2 py-0.5 rounded ${badgeColor}`}>{status}</span>
          <span className="text-xs text-zinc-500 truncate">{item.title ?? item.id}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 && <span className="text-xs text-zinc-500">no effective tags</span>}
          {tags.map((t) => (
            <span key={t.slug} className="text-xs px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded">
              {t.slug}
              <span className="ml-1 text-zinc-500">{t.weight.toFixed(2)}</span>
            </span>
          ))}
        </div>
        {item.review?.ai_raw?.confidence !== undefined && (
          <p className="text-[10px] text-zinc-500">
            model confidence {(item.review.ai_raw.confidence as number).toFixed(2)}
          </p>
        )}

        {editing && (
          <div className="border-t pt-2 dark:border-zinc-800">
            <TagEditor initial={edited} onChange={setEdited} />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            disabled={busy}
            onClick={() => void review('approved')}
            className="text-xs px-2 py-1 rounded bg-green-600 text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            disabled={busy}
            onClick={() => void review('rejected')}
            className="text-xs px-2 py-1 rounded bg-red-600 text-white disabled:opacity-50"
          >
            Reject
          </button>
          {editing ? (
            <button
              disabled={busy}
              onClick={() => void review('edited')}
              className="text-xs px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
            >
              Save edits
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => setEditing(true)}
              className="text-xs px-2 py-1 rounded border dark:border-zinc-700"
            >
              Edit tags
            </button>
          )}
          <button
            disabled={busy}
            onClick={() => void retag()}
            className="text-xs px-2 py-1 rounded border dark:border-zinc-700"
          >
            Retag
          </button>
          <a
            href={`/dev/videos/${item.id}?dev=${encodeURIComponent(token)}`}
            className="text-xs px-2 py-1 rounded border dark:border-zinc-700"
          >
            Open
          </a>
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
      </div>
    </article>
  );
}
