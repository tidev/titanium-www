import { PLATFORM_IDS, platformLabel, type PlatformId } from './ia.ts';

/**
 * Block components in guide content (TI-32).
 *
 *   :::tabs           @tab-separated panels of prose
 *   :::code-group     the same, welded onto the code blocks it switches
 *   :::platform ios   a block that only applies to some platforms
 *   :::unavailable ios  a block saying something is not possible there
 *   :::since 12.1.0   a block that only applies from an SDK version
 *   :::cards          a grid of linked cards, each an image over a label
 *
 * ## Why these run after sanitizing, when `:::include` runs before
 *
 * `partials.ts` resolves its two directives on the raw markdown because their
 * content has to be *parsed* as part of the page. These are the opposite: the
 * panel bodies are ordinary markdown that the page already rendered, so all
 * that is left is to move the resulting HTML into a wrapper. Doing that after
 * the allowlist means the sanitizer never has to permit a single class or data
 * attribute, which matters because `renderMarkdown` also renders module READMEs
 * written by other people.
 *
 * These are wired into `guides.ts` rather than `renderMarkdown`, so a README
 * writing `:::tabs` gets the literal text. That is the honest outcome: callouts
 * are a markdown convention someone may reasonably have used, and this is a
 * vocabulary that exists only in this repository's `content/docs`.
 *
 * ## Why the markers are paragraphs
 *
 * `:::tabs` on its own line is not markdown, so markdown-it emits it as
 * `<p>:::tabs</p>` and it arrives here intact. The cost is that the markers
 * need blank lines around them - without one, markdown-it folds the marker into
 * the following paragraph and the block silently renders as text. That failure
 * is caught rather than shipped: `unresolvedMarkers` finds every marker no
 * transform consumed, and `validateGuides` fails the build on it.
 */

export class BlockError extends Error {}

/**
 * The most panels one group may have.
 *
 * Tabs are CSS-driven (see below), which needs one selector per index rather
 * than a general rule, so the ceiling is real and not advisory. Five platforms
 * plus a spare is more than any group should want - beyond about four the tab
 * strip wraps and stops reading as a set of alternatives.
 */
export const MAX_PANELS = 6;

/** `<p>:::tabs</p>` … `<p>:::</p>`, non-greedy: nesting is rejected, not parsed. */
const GROUP = /<p>:::(tabs|code-group)<\/p>([\s\S]*?)<p>:::<\/p>/g;
const TAB = /<p>@tab[ \t]+([^<>]{1,40}?)[ \t]*<\/p>/g;
const PLATFORM =
  /<p>:::(platform|unavailable)[ \t]+([^<>]{1,80}?)[ \t]*<\/p>([\s\S]*?)<p>:::<\/p>/g;
const SINCE = /<p>:::since[ \t]+([^<>]{1,40}?)[ \t]*<\/p>([\s\S]*?)<p>:::<\/p>/g;

/**
 * `:::cards` … `:::`, split on `@card` markers the way a group is split on
 * `@tab`. The marker carries a markdown link rather than a bare label, so the
 * card's text and its destination come from one ordinary piece of markdown
 * instead of a second bespoke syntax.
 */
const CARDS = /<p>:::cards<\/p>([\s\S]*?)<p>:::<\/p>/g;
const CARD = /<p>@card[ \t]+([\s\S]{1,300}?)<\/p>/g;
/** The whole of a `@card` marker's content has to be the link. */
const CARD_LINK = /^<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>$/;
const CARD_IMG = /<img\b[^>]*>/;

/** Anything that looks like a marker and survived every transform. */
const LEFTOVER = /<p>(:::[^<]*|@tab[^<]*|@card[\s\S]{0,300}?)<\/p>/g;

const VERSION = /^\d+(?:\.\d+){0,3}(?:\.[A-Za-z]+\d*)?$/;

/**
 * `:::missing <w>:<h>` - a screenshot that has not been taken yet.
 *
 * The ratio is captured loosely and checked below, so a typo names itself
 * instead of surviving as a visible `:::` marker.
 */
const MISSING = /<p>:::missing[ \t]+([^<>]{1,12}?)[ \t]*<\/p>([\s\S]*?)<p>:::<\/p>/g;
const RATIO = /^(\d{1,2}):(\d{1,2})$/;

/**
 * The tallest a placeholder may draw, in rem.
 *
 * A phone screenshot is 9:16, and at prose width that is about 85rem of empty
 * box. The width is capped from this and the ratio rather than the height being
 * clamped, because `aspect-ratio` only holds while one axis is free.
 */
const MISSING_MAX_HEIGHT = 26;

/** "iOS", "iOS or Android", "iOS, Android or Windows". */
function listWords(items: string[]): string {
  if (items.length < 2) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}

function parsePlatforms(raw: string, directive: string): PlatformId[] {
  const ids = raw
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (!ids.length) throw new BlockError(`:::${directive} names no platform`);

  for (const id of ids) {
    if (!(PLATFORM_IDS as readonly string[]).includes(id)) {
      throw new BlockError(`:::${directive} ${id} - not a platform (${PLATFORM_IDS.join(', ')})`);
    }
  }
  return ids as PlatformId[];
}

type Panel = { label: string; body: string };

/**
 * Splits a group's inner HTML on its `@tab` markers.
 *
 * Anything before the first marker is content the author put in the group but
 * not in a panel, which is a mistake with no sensible rendering - it would
 * either vanish or appear above the tab strip, and both are worse than saying
 * so.
 */
function panelsOf(inner: string, kind: string): Panel[] {
  const marks = [...inner.matchAll(TAB)];
  if (!marks.length) throw new BlockError(`:::${kind} has no @tab panels`);

  const preamble = inner.slice(0, marks[0].index).trim();
  if (preamble) throw new BlockError(`:::${kind} has content before its first @tab`);

  return marks.map((mark, i) => {
    const start = mark.index + mark[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : inner.length;
    return { label: mark[1].trim(), body: inner.slice(start, end).trim() };
  });
}

function checkPanels(panels: Panel[], kind: string): void {
  if (panels.length < 2) {
    // One tab is not a choice. It is a heading with extra machinery, and it
    // hides the content from anyone whose browser does not run the stylesheet.
    throw new BlockError(`:::${kind} needs at least two panels, has ${panels.length}`);
  }
  if (panels.length > MAX_PANELS) {
    throw new BlockError(`:::${kind} has ${panels.length} panels, more than ${MAX_PANELS}`);
  }

  const seen = new Set<string>();
  for (const panel of panels) {
    if (!panel.label) throw new BlockError(`:::${kind} has an unlabelled @tab`);
    if (seen.has(panel.label)) throw new BlockError(`:::${kind} repeats the tab "${panel.label}"`);
    seen.add(panel.label);

    if (!panel.body) throw new BlockError(`:::${kind} panel "${panel.label}" is empty`);

    // A heading inside a panel would be given an anchor and a table-of-contents
    // entry pointing at content that is hidden until someone picks that tab.
    if (/<h[1-6][\s>]/.test(panel.body)) {
      throw new BlockError(
        `:::${kind} panel "${panel.label}" contains a heading - split the group instead`
      );
    }
  }

  if (kind === 'code-group') {
    for (const panel of panels) {
      // The point of a code group is that the strip sits on the code. A panel
      // with prose in it wants `:::tabs`, which is styled to hold prose.
      if (!/^<pre[\s>]/.test(panel.body) || !panel.body.endsWith('</pre>')) {
        throw new BlockError(
          `:::code-group panel "${panel.label}" is not a single code block - use :::tabs`
        );
      }
    }
  }
}

function renderGroup(kind: 'tabs' | 'code-group', panels: Panel[], index: number): string {
  const name = `tabs-${index}`;

  // Each radio sits immediately before its own label so the checked state can
  // be styled with `input:checked + .tab` - one rule rather than one per index.
  // The panels stay outside, where `:has()` reaches them.
  const strip = panels
    .map(
      (panel, i) =>
        `<input class="tab-radio" type="radio" name="${name}" id="${name}-${i}"${
          i === 0 ? ' checked' : ''
        }>` + `<label class="tab" for="${name}-${i}">${panel.label}</label>`
    )
    .join('');

  const bodies = panels
    .map((panel, i) => `<div class="tab-panel" data-tab="${i}">${panel.body}</div>`)
    .join('');

  const cls = kind === 'code-group' ? 'tabs tabs-code' : 'tabs';
  return `<div class="${cls}">` + `<div class="tab-list">${strip}</div>` + bodies + `</div>`;
}

type Card = { href: string; label: string; img?: string };

/**
 * Splits a `:::cards` block on its `@card` markers.
 *
 * Each marker is a markdown link and each body is the image shown above the
 * label. The image is optional: a set of cards is a useful chooser before its
 * artwork exists, and blocking the block on assets would mean writing the page
 * twice.
 */
function cardsOf(inner: string): Card[] {
  const marks = [...inner.matchAll(CARD)];
  if (!marks.length) throw new BlockError(':::cards has no @card entries');

  const preamble = inner.slice(0, marks[0].index).trim();
  if (preamble) throw new BlockError(':::cards has content before its first @card');

  return marks.map((mark, i) => {
    const link = CARD_LINK.exec(mark[1].trim());
    if (!link) {
      throw new BlockError(`:::cards @card is not a single link - write "@card [Label](/target)"`);
    }

    const start = mark.index + mark[0].length;
    const end = i + 1 < marks.length ? marks[i + 1].index : inner.length;
    const body = inner.slice(start, end).trim();

    // Only an image belongs under a card. Prose there would be a paragraph
    // rendered inside a link, which is both invalid and unreadable.
    if (body && !/^<p>\s*<img\b[^>]*>\s*<\/p>$/.test(body)) {
      throw new BlockError(`:::cards card "${link[2]}" holds something other than one image`);
    }

    const img = body ? (CARD_IMG.exec(body)?.[0] ?? undefined) : undefined;
    return { href: link[1], label: link[2].trim(), ...(img ? { img } : {}) };
  });
}

function checkCards(cards: Card[]): void {
  // The same reasoning as a one-panel group: a grid of one is a link, and
  // dressing it as a chooser tells the reader there is a choice when there
  // is not.
  if (cards.length < 2) {
    throw new BlockError(`:::cards needs at least two cards, has ${cards.length}`);
  }
  if (cards.length > MAX_PANELS) {
    throw new BlockError(`:::cards has ${cards.length} cards, more than ${MAX_PANELS}`);
  }

  const seen = new Set<string>();
  for (const card of cards) {
    if (!card.label) throw new BlockError(':::cards has an unlabelled @card');
    if (seen.has(card.label)) throw new BlockError(`:::cards repeats the card "${card.label}"`);
    seen.add(card.label);
  }
}

function renderCards(cards: Card[]): string {
  const items = cards
    .map((card) => {
      // `alt=""` on the logo: the label directly beneath it is the accessible
      // name, and repeating it would have a screen reader say it twice.
      const img = card.img
        ? card.img.replace(/\salt="[^"]*"/, '').replace(/<img/, '<img alt=""')
        : '';
      return (
        `<li class="card">` +
        `<a href="${card.href}">${img}<span class="card-label">${card.label}</span></a>` +
        `</li>`
      );
    })
    .join('');
  return `<ul class="cards">${items}</ul>`;
}

/**
 * A box the shape of the picture that belongs there, crossed through.
 *
 * Screenshots of somebody else's UI date faster than anything else on a page,
 * and TI-78 tracks the ones this rewrite still owes. Leaving a gap in the prose
 * loses the fact that a picture is wanted at all; leaving a stale 2013 one is
 * worse. This says what the image should show, in the space it will occupy, so
 * the page reads as finished apart from the art and the reviewer can tell what
 * to shoot.
 *
 * The X is an SVG rather than two CSS gradients because `to top right` only
 * runs corner to corner on a square, and none of these are square.
 * `non-scaling-stroke` keeps the hairline a hairline once the viewBox is
 * stretched by `preserveAspectRatio="none"`.
 */
function renderMissing(w: number, h: number, body: string): string {
  const cap = (MISSING_MAX_HEIGHT * w) / h;
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" vector-effect="non-scaling-stroke"/>`;
  return (
    `<figure class="missing" style="aspect-ratio:${w}/${h};max-width:min(100%,${cap.toFixed(2)}rem)">` +
    `<svg class="missing-x" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">` +
    line(0, 0, 100, 100) +
    line(100, 0, 0, 100) +
    `</svg>` +
    `<figcaption class="missing-note">` +
    `<span class="missing-label">Missing screenshot</span>` +
    body +
    `</figcaption>` +
    `</figure>`
  );
}

/**
 * Rewrites every block marker into markup.
 *
 * Groups first: their panels may contain anything except another block, so
 * running the platform and version transforms afterwards would let a marker
 * inside a panel close the group early. Doing groups first means such a marker
 * ends up inside a panel body untouched, where `unresolvedMarkers` finds it and
 * the build says which page nested what.
 */
export function renderBlocks(html: string): string {
  // Per call, so the same page renders the same ids every time. A module-level
  // counter would make the output depend on how many pages were built first.
  let group = 0;

  let out = html.replace(GROUP, (_whole, kind: 'tabs' | 'code-group', inner: string) => {
    const panels = panelsOf(inner, kind);
    checkPanels(panels, kind);
    return renderGroup(kind, panels, group++);
  });

  out = out.replace(CARDS, (_whole, inner: string) => {
    const cards = cardsOf(inner);
    checkCards(cards);
    return renderCards(cards);
  });

  out = out.replace(
    PLATFORM,
    (_whole, directive: 'platform' | 'unavailable', raw: string, body: string) => {
      const ids = parsePlatforms(raw, directive);
      const names = ids.map(platformLabel);

      if (directive === 'unavailable') {
        return (
          `<div class="platform-block platform-block-off">` +
          `<p class="platform-label">Not available on ${listWords(names)}</p>` +
          body +
          `</div>`
        );
      }

      const badges = ids
        .map((id, i) => `<span class="badge badge-${id}">${names[i]}</span>`)
        .join('');
      return (
        `<div class="platform-block">` + `<p class="platform-label">${badges}</p>` + body + `</div>`
      );
    }
  );

  out = out.replace(MISSING, (_whole, raw: string, body: string) => {
    const ratio = RATIO.exec(raw);
    if (!ratio) {
      throw new BlockError(
        `:::missing ${raw} - the shape must be written as width:height, like 9:16`
      );
    }
    const w = Number(ratio[1]);
    const h = Number(ratio[2]);
    if (!w || !h) {
      throw new BlockError(`:::missing ${raw} - neither side may be zero`);
    }
    // A placeholder with nothing in it is a hole with a border round it.
    if (!body.replace(/<[^>]+>/g, '').trim()) {
      throw new BlockError(`:::missing ${raw} - say what the screenshot should show`);
    }
    return renderMissing(w, h, body);
  });

  out = out.replace(SINCE, (_whole, version: string, body: string) => {
    if (!VERSION.test(version)) {
      throw new BlockError(`:::since ${version} - not a version number`);
    }
    return (
      `<div class="version-notice">` +
      `<p class="version-label">Since Titanium SDK ${version}</p>` +
      body +
      `</div>`
    );
  });

  return out;
}

/**
 * Markers no transform consumed.
 *
 * Every one of these is a mistake that would otherwise ship as visible `:::`
 * in the prose: a missing blank line around a marker, a block left unclosed, a
 * misspelled directive, or one block nested inside another.
 */
export function unresolvedMarkers(html: string): string[] {
  return [...html.matchAll(LEFTOVER)].map((m) => m[1].split('\n')[0].trim());
}
