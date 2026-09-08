/**
 * One block of structured data, rendered where the thing it describes is.
 *
 * `dangerouslySetInnerHTML` because a script's contents are not JSX children,
 * and `JSON.stringify` is the only thing that produces the string: no template
 * assembles this by hand. The one escape is `<`, which cannot appear inside a
 * script element without ending it early. Everything reaching here is our own
 * data, but a module id or a post title is still text somebody else wrote.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll('<', '\\u003c') }}
    />
  );
}
