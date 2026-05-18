'use client';

import { useEffect, useRef, useState } from 'react';

export type ReelVideo = {
  id: string;
  url: string;
  thumbnail_url: string | null;
  title: string | null;
  duration_ms: number;
};

type EngagementState = {
  enteredAt: number | null;
  liked: boolean;
  disliked: boolean;
  replays: number;
};

function send(videoId: string, state: EngagementState, durationMs: number) {
  if (state.enteredAt === null) return;
  const watch_ms = Math.max(0, Math.round(performance.now() - state.enteredAt));
  if (watch_ms < 150 && !state.liked && !state.disliked) return; // ignore flicker
  const payload = {
    video_id: videoId,
    watch_ms,
    completion_pct: Math.min(1, watch_ms / Math.max(1, durationMs)),
    liked: state.liked,
    disliked: state.disliked,
    replays: state.replays,
  };
  const json = JSON.stringify(payload);
  const ok =
    typeof navigator !== 'undefined' &&
    typeof navigator.sendBeacon === 'function' &&
    navigator.sendBeacon('/api/engagements', new Blob([json], { type: 'application/json' }));
  if (!ok) {
    void fetch('/api/engagements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
      keepalive: true,
    }).catch(() => {});
  }
}

export function Reel({ video }: { video: ReelVideo }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<EngagementState>({
    enteredAt: null,
    liked: false,
    disliked: false,
    replays: 0,
  });
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    const v = videoRef.current;
    if (!el || !v) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          stateRef.current.enteredAt = performance.now();
          v.currentTime = 0;
          void v.play().catch(() => {});
        } else {
          v.pause();
          if (stateRef.current.enteredAt !== null) {
            send(video.id, stateRef.current, video.duration_ms);
            stateRef.current = {
              enteredAt: null,
              liked: stateRef.current.liked,
              disliked: stateRef.current.disliked,
              replays: 0,
            };
          }
        }
      },
      { threshold: [0, 0.6, 1] },
    );
    obs.observe(el);

    const onEnded = () => {
      stateRef.current.replays += 1;
    };
    v.addEventListener('ended', onEnded);

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        send(video.id, stateRef.current, video.duration_ms);
      }
    };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      obs.disconnect();
      v.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onHide);
      send(video.id, stateRef.current, video.duration_ms);
    };
  }, [video.id, video.duration_ms]);

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    if (next) setDisliked(false);
    stateRef.current.liked = next;
    if (next) stateRef.current.disliked = false;
    void fetch('/api/engagements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        video_id: video.id,
        watch_ms: 0,
        completion_pct: 0,
        liked: next,
        disliked: false,
        replays: 0,
      }),
    }).catch(() => {});
  };

  const toggleDislike = () => {
    const next = !disliked;
    setDisliked(next);
    if (next) setLiked(false);
    stateRef.current.disliked = next;
    if (next) stateRef.current.liked = false;
    void fetch('/api/engagements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        video_id: video.id,
        watch_ms: 0,
        completion_pct: 0,
        liked: false,
        disliked: next,
        replays: 0,
      }),
    }).catch(() => {});
  };

  return (
    <div
      ref={containerRef}
      className="relative snap-start snap-always h-[100dvh] w-full bg-black flex items-center justify-center"
    >
      <video
        ref={videoRef}
        src={video.url}
        poster={video.thumbnail_url ?? undefined}
        muted
        autoPlay
        playsInline
        loop
        preload="metadata"
        className="h-full w-full object-contain"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-6 left-4 right-4 flex items-end justify-between text-white">
        <div className="max-w-[70%]">
          <p className="text-sm opacity-80 capitalize">{video.title ?? 'untitled'}</p>
        </div>
        <div className="flex flex-col gap-3 items-center">
          <button
            onClick={toggleLike}
            aria-pressed={liked}
            className={`rounded-full w-12 h-12 flex items-center justify-center text-xl transition ${
              liked ? 'bg-pink-500 text-white' : 'bg-white/15 text-white'
            }`}
          >
            ♥
          </button>
          <button
            onClick={toggleDislike}
            aria-pressed={disliked}
            className={`rounded-full w-12 h-12 flex items-center justify-center text-xl transition ${
              disliked ? 'bg-gray-700 text-white' : 'bg-white/15 text-white'
            }`}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
