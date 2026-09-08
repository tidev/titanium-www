import { llmsTxt } from '@/lib/docs/llms';
import { isIndexableHost } from '@/lib/site';
import { headers } from 'next/headers';

/**
 * The curated index, to the llmstxt.org convention (TI-57).
 *
 * ## Why this reads headers
 *
 * `preview.titaniumsdk.com` is a custom domain on the *production* deployment,
 * so the host is the only thing that distinguishes it - the same reasoning
 * `robots.ts` records, and the same guard. A preview must not publish a corpus:
 * `robots.txt` asks a crawler not to index it, and nothing at all asks a model
 * fetching a URL directly. So the file is not served there rather than being
 * served with a notice on it.
 *
 * Reading `headers()` makes this request-time, which costs a render of about
 * 9KB assembled from files already on disk. The alternative, prerendering it,
 * would produce one file that both hosts serve.
 */

const NOT_FOUND = 'Not found. The machine-readable corpus is published on titaniumsdk.com only.\n';

export async function GET() {
  if (!isIndexableHost((await headers()).get('host'))) {
    return new Response(NOT_FOUND, {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(llmsTxt(), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
