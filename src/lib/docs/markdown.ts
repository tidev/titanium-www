import { assetUrl } from './assets.ts';
import { renderCallouts } from './callouts.ts';
import { highlightCodeBlocks } from './highlight.ts';
import { apiTarget, pathLinker, type ApiLinker } from './links.ts';
import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

/**
 * Renders the markdown that the registry stores in prose fields.
 *
 * Two things make this more than a plain markdown call. The source contains
 * hand-written HTML - `Titanium.UI.View` has a `<table class="doc-table">` - so
 * inline HTML is enabled and the result is sanitized. And cross-references were
 * resolved at compile time to `api:` URIs, which are turned into real paths here
 * because only the renderer knows which tree it is rendering into.
 *
 * The same function also renders third-party README markdown, which is why the
 * sanitizer is not optional: that text is written by whoever wrote the module,
 * not by docgen.
 */

const md = new MarkdownIt({
  html: true,
  linkify: false,
  typographer: false,
});

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'figure',
    'figcaption',
    'del',
    'ins',
    'abbr',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    code: ['class'],
    // The source's own table styling hook, and heading anchors.
    table: ['class'],
    th: ['class', 'colspan', 'rowspan', 'scope'],
    td: ['class', 'colspan', 'rowspan'],
    '*': ['id'],
  },
  // Anything not on the allowlist is dropped rather than escaped, so a stray
  // <script> leaves nothing behind.
  disallowedTagsMode: 'discard',
  allowedSchemes: ['http', 'https', 'mailto'],
};

export type RenderOptions = {
  /**
   * Where `api:` references point. A path prefix is shorthand for the SDK's
   * one-type-per-page arrangement; a module passes a function, because half of
   * its references are anchors on the page being rendered and the other half
   * are pages in the SDK tree.
   *
   * Optional, for prose that has no API references to resolve - a blog post is
   * written for people rather than against a type tree. Omitted, an `api:` URI
   * resolves to nothing and the text is left as written.
   */
  link?: string | ApiLinker;
  /**
   * Where relative references resolve.
   *
   * apidoc images sit beside the YAML, so `Titanium/UI/Button.yml` writes
   * `./button_android.png` meaning `Titanium/UI/button_android.png`. A README
   * is the same problem against a different root, and its links need rewriting
   * as well as its images - they are relative to a repository we do not serve.
   *
   * A root-relative `/x.png` is left alone in both cases: in apidoc it means
   * the site root and is already correct, and no README in the registry uses
   * one.
   */
  relative?: { images: string; links?: string };
};

/** Absolute, protocol-relative, or root-relative - nothing to resolve. */
const isAbsolute = (ref: string) => /^(?:[a-z][\w+.-]*:)?\/\//i.test(ref) || ref.startsWith('/');

const resolveRelative = (base: string, ref: string) => `${base}/${ref.replace(/^\.\//, '')}`;

export function renderMarkdown(source: string | undefined, options: RenderOptions): string {
  if (!source) return '';

  const link =
    options.link === undefined
      ? () => null
      : typeof options.link === 'string'
        ? pathLinker(options.link)
        : options.link;
  const relative = options.relative;

  const html = md.render(source);

  const clean = sanitizeHtml(html, {
    ...SANITIZE,
    transformTags: {
      img: (tagName, attribs) => {
        /**
         * Every image ends up with an `alt`, even if it is empty (TI-49).
         *
         * The markdown images all carry one; the twenty-odd written as raw HTML
         * in the apidoc YAML do not, and an `<img>` with no alt is announced by
         * its filename - `7618194ed3a17536.png` - which is worse than silence.
         * The empty string marks those decorative, which is the honest reading:
         * each one sits under prose that already describes it. Writing real alt
         * text for them is a content task, not one the renderer can do.
         */
        const alt = attribs.alt ?? '';
        const src = attribs.src ?? '';
        if (!relative || !src || isAbsolute(src)) return { tagName, attribs: { ...attribs, alt } };
        return {
          tagName,
          attribs: {
            ...attribs,
            alt,
            // Through the asset manifest: the same image is shared by every
            // compiled version rather than copied into each one.
            src: assetUrl(resolveRelative(relative.images, src)),
            loading: 'lazy',
          },
        };
      },
      a: (tagName, attribs) => {
        const href = attribs.href ?? '';

        // Hand-written leftovers from the ExtJS-era docs, whose addresses this
        // site does not serve. 46 survive in the registry's prose. Three shapes:
        // the examples of a type, which are on the page now; a plain type
        // reference docgen never converted to an `api:` URI, which the linker
        // can still resolve; and a guide, which has no address here at all -
        // that one loses its link and keeps its text, because "once you have
        // [installed] the module" reads fine without one and a dead `#!`
        // fragment does not.
        if (href.startsWith('#!/')) {
          if (/^#!\/api\/[\w.]+-examples$/.test(href)) {
            return { tagName, attribs: { ...attribs, href: '#examples' } };
          }
          const legacy = /^#!\/api\/([A-Za-z_][\w.]*)$/.exec(href);
          const resolved = legacy && link(legacy[1]);
          if (!resolved) return { tagName: 'span', attribs: {} };
          return { tagName, attribs: { ...attribs, href: resolved } };
        }

        const target = apiTarget(href);
        if (target) {
          const resolved = link(target.type, target.member);
          // Nothing renders this type. Keeping the anchor would ship a 404, so
          // the text stays and the link goes.
          if (!resolved) return { tagName: 'span', attribs: {} };
          return { tagName, attribs: { ...attribs, href: resolved } };
        }

        if (relative?.links && href && !href.startsWith('#') && !isAbsolute(href)) {
          return {
            tagName,
            attribs: {
              ...attribs,
              href: resolveRelative(relative.links, href),
              rel: 'noopener noreferrer',
            },
          };
        }

        // Anything leaving the site opens safely; internal links are untouched.
        if (/^https?:\/\//.test(href)) {
          return { tagName, attribs: { ...attribs, rel: 'noopener noreferrer' } };
        }
        return { tagName, attribs };
      },
    },
  });

  // All three run after the allowlist, never before - see highlight.ts. Letting
  // any of them write markup the sanitizer then has to permit would extend that
  // permission to whoever wrote the module README this also renders.
  return focusableCodeBlocks(renderCallouts(highlightCodeBlocks(clean)));
}

/**
 * Gives every code block a tab stop (TI-49).
 *
 * `.prose-docs pre` scrolls sideways so that one wide sample cannot scroll the
 * page at 320px. That trade only works for a reader with a pointer: a scrolling
 * box nothing can focus has no keyboard route to the end of a long line, which
 * is WCAG 2.1.1. `Terminal` reached the same conclusion for the same reason and
 * marks its rows `tabIndex={0}`; this is that, for the blocks that come out of
 * markdown and so cannot carry a prop.
 *
 * Runs last, after highlighting, so a block Shiki coloured and one it declined
 * to are treated alike - the second kind still scrolls.
 */
function focusableCodeBlocks(html: string): string {
  return html.replace(/<pre(?=[\s>])/g, '<pre tabindex="0"');
}

/** Single-paragraph render for summaries, which should not become block elements. */
export function renderInline(source: string | undefined, opts: RenderOptions): string {
  const html = renderMarkdown(source, opts);
  return html
    .replace(/^<p>/, '')
    .replace(/<\/p>\s*$/, '')
    .trim();
}
