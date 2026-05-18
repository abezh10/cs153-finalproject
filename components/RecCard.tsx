import { labelFor } from '@/lib/taxonomy';

export type RecCardData = {
  title: string;
  vendor: string;
  price: string;
  blurb: string;
  why_tags: string[];
  image_url: string;
};

export function RecCard({ data }: { data: RecCardData }) {
  const whyText =
    data.why_tags.length > 0
      ? `Why: ${data.why_tags.map(labelFor).join(', ')}`
      : 'Why: based on your overall taste';
  return (
    <article className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.image_url} alt={data.title} className="w-full aspect-square object-cover" />
      <div className="p-3 flex-1 flex flex-col gap-1">
        <h3 className="font-medium text-sm">{data.title}</h3>
        <p className="text-xs text-zinc-500">{data.vendor} · {data.price}</p>
        <p className="text-xs text-zinc-700 dark:text-zinc-300 mt-1">{data.blurb}</p>
        <p
          title={whyText}
          className="mt-auto pt-2 text-[10px] uppercase tracking-wide text-zinc-500 cursor-help"
        >
          {whyText}
        </p>
      </div>
    </article>
  );
}
