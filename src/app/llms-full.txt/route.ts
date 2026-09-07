import { llmsFullTxt } from '@/lib/docs/llms';
import { isIndexableHost } from '@/lib/site';
import { headers } from 'next/headers';

/**
 * The whole guide corpus in one file (TI-57).
 *
 * Guides only, and capped. `llms.ts` holds both decisions and the reasoning:
 * briefly, the reference is 284 types that a reader can fetch one at a time,
 * and a file nobody can hold in context is not a corpus.
 *
 * Host-guarded for the same reason `llms.txt` is, and request-time for the same
 * reason. See that route.
 */

const NOT_FOUND = 'Not found. The machine-readable corpus is published on titaniumsdk.com only.\n';

export async function GET() {
  if (!isIndexableHost((await headers()).get('host'))) {
    return new Response(NOT_FOUND, {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(llmsFullTxt().text, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
