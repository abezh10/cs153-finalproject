'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Reel, type ReelVideo } from './Reel';

export function ReelsFeed() {
  const [videos, setVideos] = useState<ReelVideo[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(false);
  const [empty, setEmpty] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/feed?cursor=${cursor}`);
      const body = (await res.json()) as { videos: ReelVideo[]; nextCursor: number; poolSize: number };
      if (body.videos.length === 0) {
        if (videos.length === 0) setEmpty(true);
        return;
      }
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        const fresh = body.videos.filter((v) => !seen.has(v.id));
        return [...prev, ...fresh];
      });
      setCursor(body.nextCursor);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, loading]);

  useEffect(() => {
    // Initial load on mount; setState is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMore]);

  if (empty) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-black text-white text-center px-6">
        <div>
          <p className="text-xl mb-2">No videos yet.</p>
          <p className="opacity-70 text-sm">Run the ingest script, then approve some in /dev/videos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory bg-black">
      {videos.map((v) => (
        <Reel key={v.id} video={v} />
      ))}
      <div ref={sentinelRef} className="h-20 w-full" />
    </div>
  );
}
