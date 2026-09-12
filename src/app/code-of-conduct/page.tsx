import { Prose } from '@/components/docs/prose';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Titanium Community Code of Conduct.
 *
 * The copy is TiDev's, from `tidev/organization-docs`, and it is somebody
 * else's document: the board owns the words and the feedback section names the
 * issue tracker where they get changed. So it is kept as markdown rather than
 * transcribed into JSX, which makes a re-sync a diff against upstream rather
 * than a re-reading of a page.
 *
 * `content/code-of-conduct.md` is that file verbatim, with two changes and no
 * others. Its `# ` title is dropped, because the heading below belongs to the
 * page frame. And the two bare URLs it ends with are wrapped as `<...>`
 * autolinks: `renderMarkdown` has linkify off - it renders text other people
 * wrote, where a string that merely looks like a URL should stay a string - so
 * without the brackets both would render as unclickable text. The rendered
 * words are unchanged either way.
 *
 * The file is otherwise upstream's, down to the spelling and the typos, less
 * whatever `oxfmt` normalises about markdown it is handed - list indentation,
 * an emphasis delimiter, a trailing space. None of that reaches the page.
 *
 * Rendered through the same `renderMarkdown` the guides and the blog use. The
 * ticket that brought the blog in warned against a second markdown pipeline,
 * and one page is not the reason to start one.
 *
 * Linked from the footer's Community column and from `/contribute`, which are
 * the two places somebody about to take part is already looking. Deliberately
 * not in the header's Community menu: that menu is four places to go and do
 * something, and this is a document.
 */

export const metadata: Metadata = {
  title: 'Code of Conduct - Titanium SDK',
  description:
    'The Titanium Community Code of Conduct: what the community expects of participants in its repositories, events, and chat, and how it is enforced.',
  alternates: { canonical: `${SITE_URL}/code-of-conduct` },
};

/** Where the copy is maintained, and where a change to it has to be proposed. */
const SOURCE_URL = 'https://github.com/tidev/organization-docs/blob/main/CODE_OF_CONDUCT.md';

/**
 * Read at build time, like every other file this site renders from.
 *
 * The heading is here rather than in the markdown: `prose-docs` sizes an h1 the
 * same as an h2, because in a guide or a post the title belongs to the page
 * frame and not to the body. This page is no different.
 */
const body = readFileSync(join(process.cwd(), 'content/code-of-conduct.md'), 'utf8');

export default function CodeOfConductPage() {
  return (
    // Gutters, matching /contribute and /registry. This route has no layout of
    // its own, and `mx-auto` centres the column inside them.
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl py-10">
        <h1 className="text-3xl font-semibold tracking-tight text-balance">
          Titanium Community Code of Conduct
        </h1>

        <Prose markdown={body} className="mt-8" />
      </div>
    </div>
  );
}
