import { notFound } from 'next/navigation';

function expectedToken(): string | undefined {
  return process.env.DEV_TOOLS_TOKEN;
}

export function checkDevTokenOrNotFound(req: Request): void {
  const expected = expectedToken();
  if (!expected) notFound();
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get('dev');
  const fromHeader = req.headers.get('x-dev-token');
  if (fromQuery !== expected && fromHeader !== expected) notFound();
}

export async function checkDevTokenOrNotFoundAsync(searchParams: {
  dev?: string | string[];
}): Promise<void> {
  const expected = expectedToken();
  if (!expected) notFound();
  const v = Array.isArray(searchParams.dev) ? searchParams.dev[0] : searchParams.dev;
  if (v !== expected) notFound();
}
