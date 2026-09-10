/**
 * `JSON.stringify(value, null, 2)`, with short arrays kept on one line.
 *
 * For the templates printed on `/directory/submit` and `/showcase/submit`, which
 * a submitter copies into a file that sits beside other people's. Two spaces is
 * how those files are written; what the built-in formatter gets wrong is arrays
 * of scalars, which it explodes one element per line. `"availability"` alone
 * becomes four lines, and a listing that is nine facts about a person reads as
 * forty lines of punctuation.
 *
 * The committed files write those inline, so a template that does not would
 * teach a submitter to open a pull request that looks unlike its neighbours.
 *
 * Only arrays holding neither braces nor brackets are collapsed - an array of
 * objects, like a listing's `links`, keeps a line per entry, which is where the
 * indentation is doing real work.
 */
export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(
    /\[\n([^[\]{}]*?)\n\s*\]/g,
    (_all, body: string) =>
      `[${body
        .trim()
        .split(/\s*\n\s*/)
        .join(' ')}]`
  );
}
