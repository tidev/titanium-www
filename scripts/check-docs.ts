import { validatePosts } from '../src/lib/blog/links.ts';
import { archivedMajors, contentRoot, validateDocVersions } from '../src/lib/docs/doc-versions.ts';
import { validateGuides } from '../src/lib/docs/guides.ts';
import {
  LLMS_FULL_CAP_BYTES,
  llmsFullTxt,
  llmsTxt,
  validateLlmsIndex,
} from '../src/lib/docs/llms.ts';

/**
 * Fails the build on anything wrong with guide content (TI-32, TI-59), with the
 * links in a blog post (TI-67), or with the machine-readable corpus (TI-57).
 *
 *   node scripts/check-docs.ts
 *
 * Catches, in one pass and reporting all of it rather than the first:
 *
 *   - a page whose frontmatter is missing, malformed, or has an unknown key
 *   - a `:::include` naming a partial that does not exist, or a cycle
 *   - an unclosed or nested `:::only` block
 *   - a content file with no entry in `ia.ts`, which would render at a URL that
 *     appears in no sidebar
 *   - an internal link to a `/docs` path the structure does not define
 *   - a structural mistake in `ia.ts` itself: a bad slug, too much depth, or a
 *     page claiming a reserved segment
 *   - a link in `content/blog` to a path this site does not serve, or one
 *     written as `https://titaniumsdk.com/…` rather than as a path
 *   - a version manifest that disagrees with the snapshots on disk, or a major
 *     that has shipped without the guides being snapshotted for it
 *   - an entry in `llms.txt` whose `.md` resolves to nothing
 *
 * The link checks are the reason this is a script and not a lint rule: they
 * need the rendered HTML, which needs the whole pipeline, which needs the IA. A
 * broken link between two guides is otherwise invisible until someone clicks
 * it, and the legacy corpus has 21 pages whose links died exactly that way. The
 * blog arrived in the same condition and worse: 87 of its 164 internal links
 * pointed at a path this site does not serve, most of them into the old
 * documentation wiki.
 *
 * Archived majors are checked with the same pipeline as current. A snapshot is
 * a byte copy taken by `scripts/snapshot-docs.ts`, so it is valid on the day it
 * is cut; what this catches is the drift afterwards, when a partial is renamed
 * or an IA entry is deleted out from under it.
 *
 * The `llms.txt` check is here rather than in a script of its own because it is
 * the same failure with the same cost: an index entry that resolves to nothing
 * is a broken link, and one published to a machine that will quote whatever it
 * gets back. It resolves each entry through `markdownFor`, the function the
 * route serves from, so the check and the reader ask the same question.
 */

const problems = [
  ...validateDocVersions(),
  ...validateGuides(),
  // `structure: false`: `ia.ts` is one tree behind every major, and it has
  // already been checked once above.
  ...archivedMajors().flatMap((major) =>
    validateGuides(contentRoot(major), { base: `/${major}`, structure: false })
  ),
  ...validatePosts(),
  ...validateLlmsIndex(),
];

if (problems.length) {
  console.error(`${problems.length} problem(s) in content:\n`);
  for (const { where, message } of problems) {
    console.error(`  ${where}\n    ${message}`);
  }
  process.exit(1);
}

/**
 * The corpus sizes, printed on every run.
 *
 * `llms-full.txt` grows with the guides and there is no moment at which
 * somebody would think to measure it, so the number is in front of whoever
 * added the page that moved it. Exceeding the cap is not a failure - the file
 * truncates deterministically and says what it dropped - but it should never
 * happen silently.
 */
const index = llmsTxt();
const full = llmsFullTxt();
const size = Buffer.byteLength(full.text, 'utf8');
const percent = Math.round((size / LLMS_FULL_CAP_BYTES) * 100);

console.log('Guide and blog content is valid.');
console.log(`  llms.txt       ${Buffer.byteLength(index, 'utf8').toLocaleString('en-US')} bytes`);
console.log(
  `  llms-full.txt  ${size.toLocaleString('en-US')} bytes ` +
    `(${percent}% of the ${LLMS_FULL_CAP_BYTES.toLocaleString('en-US')} byte cap)`
);
if (full.omitted.length) {
  console.log(`  ${full.omitted.length} page(s) dropped at the cap:`);
  for (const path of full.omitted) console.log(`    ${path}`);
}
