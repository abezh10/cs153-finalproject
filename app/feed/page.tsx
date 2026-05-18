import Link from 'next/link';
import { ReelsFeed } from '@/components/ReelsFeed';

export const dynamic = 'force-dynamic';

export default function FeedPage() {
  return (
    <div className="relative">
      <ReelsFeed />
      <Link
        href="/dashboard"
        className="fixed top-4 right-4 z-10 text-xs bg-white/15 text-white px-3 py-1.5 rounded-full backdrop-blur"
      >
        My Interests →
      </Link>
    </div>
  );
}
