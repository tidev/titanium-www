import { markdownFor } from '@/lib/docs/llms';
import { isIndexableHost } from '@/lib/site';
import { headers } from 'next/headers';

/**
 * Every documentation page as markdown, at its own address plus `.md` (TI-57).
 *
 *   /docs/setup/macos.md            the guide
 *   /docs/sdk.md                    the API index at the latest release
 *   /docs/sdk/Titanium.UI.Window.md one type
 *   /docs/sdk/13.4.1/Titanium.UI.Window.md  the same type, pinned
 *   /modules/ti.map.md              one module
 *
 * ## Why the addresses are not the directory names here
 *
 * A `route.ts` cannot sit at the same segment as a `page.tsx`, and `/docs` is
 * an optional catch-all page. There is no arrangement of files that puts
 * `/docs/setup/macos.md` beside `/docs/setup/macos`, so `next.config.ts`
 * rewrites the `.md` suffix onto this handler. `beforeFiles`, because the docs
 * page route declares `dynamicParams = false` and would otherwise answer 404
 * before a later rewrite was consulted.
 *
 * ## Why it insists on being reached through the rewrite
 *
 * A rewrite destination is a real URL, so `/md/docs/setup/macos` would answer
 * as well and the same file would have two addresses. The original path
 * survives on `request.url` - a rewrite is internal and does not alter it - so
 * the handler can require the `.md` form and 404 the other. One address per
 * document, which is what the reference pages went to some trouble for and what
 * the sitemap and canonical work in TI-48 assumes.
 *
 * ## Rendered per request
 *
 * The host guard needs `headers()`, which is request-time by definition. That
 * decides it, but the sizes agree: 284 types is 2.7MB of markdown against 190MB
 * of HTML and RSC payload for the same pages, so this could have been
 * prerendered where they could not, and there is nothing to be saved by it.
 * Every read is a JSON file in `registry/`, already on disk.
 */

const NOT_FOUND = 'Not found.\n';

const notFound = () =>
  new Response(NOT_FOUND, {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });

export async function GET(request: Request, ctx: RouteContext<'/md/[...path]'>) {
  if (!isIndexableHost((await headers()).get('host'))) return notFound();

  // The address as asked for, which the rewrite left alone. Anything not ending
  // in `.md` reached the destination path directly.
  const requested = decodeURIComponent(new URL(request.url).pathname);
  if (!requested.endsWith('.md')) return notFound();

  const { path } = await ctx.params;

  // A page that does not parse is a 404 here rather than a 500. `check-docs`
  // fails the build on one, so this cannot fire for a committed guide; what it
  // covers is an arbitrary path arriving from the URL and landing on something
  // that is not a page. `writtenPaths` swallows the same throw for the same
  // reason.
  let body: string | undefined;
  try {
    body = markdownFor(`/${path.join('/')}`);
  } catch {
    return notFound();
  }
  if (!body) return notFound();

  return new Response(body, {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
