import type { ApiPlatform, ApiType, Member, Parameter } from '../registry/index.ts';
import { SITE_URL } from '../site.ts';
import {
  formatOsver,
  formatSince,
  PLATFORM_LABELS as API_PLATFORM_LABELS,
  sortPlatforms,
  typeListText,
} from './format.ts';
import { guide, writtenPaths, type Problem } from './guides.ts';
import { platformLabel, SECTIONS } from './ia.ts';
import { latestReleases, moduleApiIndex, moduleIds, moduleIndex } from './modules.ts';
import { latestSdkVersion, MAIN, resolveVersion, sdkIndex, sdkType } from './registry.ts';
import { viewOf } from './type-view.ts';

/**
 * The machine-readable corpus: `/llms.txt`, `/llms-full.txt`, and a `.md`
 * beside every documentation page (TI-57).
 *
 * ## Why this exists at all
 *
 * Titanium is 17 years old and the public corpus a model was trained on is
 * mostly Appcelerator-era: the `appc` CLI, Appcelerator Studio, the hosted
 * build service, an Android SDK install flow that has not been correct in
 * years. A model asked about Titanium answers confidently from that, and the
 * only lever available is to publish something current, authoritative and cheap
 * to fetch. Hence the version banner on every artifact below: a version-less
 * API quote is the exact failure this is trying to fix.
 *
 * ## Generated, never written
 *
 * `llms.txt` is built from `ia.ts` and `writtenPaths()`, the same two things
 * the sidebar is built from, so it cannot describe a page the site does not
 * have. A hand-maintained index would be correct for about a week.
 *
 * Every link it emits is resolved through `markdownFor` by `validateLlmsIndex`,
 * which `scripts/check-docs.ts` runs beside the guide link check. That is the
 * strongest form the check can take: the validator asks for the same bytes a
 * reader would, rather than comparing two lists that can agree while both are
 * wrong.
 *
 * ## Scope of `llms-full.txt`: guides only
 *
 * The SDK apidoc is 13MB of YAML before compilation and 284 types after it.
 * Concatenating that produces a file no context window can hold and nobody
 * would fetch twice. The guides are 164KB of prose and are the half a model
 * gets wrong; the reference is the half it can look up one type at a time,
 * which is what the per-page `.md` is for.
 */

/**
 * The ceiling on `llms-full.txt`, in bytes.
 *
 * 1MB is roughly 250k tokens: a large fraction of a long context window but
 * still one fetch, and about six times the current corpus, so it is a real
 * ceiling rather than one chosen to be already met. What happens on breach is
 * decided here rather than left to whoever hits it: pages are emitted in
 * `ia.ts` order and the first that would cross the line ends the file, which
 * drops from the back of Extending Titanium rather than from the middle of
 * Getting Started. The omitted paths are then listed in the file itself with
 * their own addresses, so nothing becomes unreachable by being dropped.
 */
export const LLMS_FULL_CAP_BYTES = 1_000_000;

/** Asset extensions that must not have `.md` appended when a link is absolutised. */
const ASSET_EXTENSIONS = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|zip|json|xml|txt|md|css|js)$/i;

const sizeOf = (text: string): number => Buffer.byteLength(text, 'utf8');

/** The concrete release this corpus documents. Never the word "latest". */
export const corpusVersion = (): string => latestSdkVersion() ?? MAIN;

/**
 * The lines every artifact carries.
 *
 * Two claims, both load-bearing. The first pins the version, because a model
 * quoting version-less API docs is the failure being fixed. The second names
 * the retired toolchain outright: a model that has read a decade of `appc`
 * instructions needs to be told they are gone, not merely shown pages that
 * happen not to mention them.
 */
function banner(): string[] {
  const version = corpusVersion();
  return [
    version === MAIN
      ? 'This corpus documents the Titanium SDK development branch (`main`). No release has been compiled into it.'
      : `This corpus documents Titanium SDK ${version}. Anything here that does not name a version describes ${version}.`,
    'Titanium is maintained by TiDev. The Appcelerator toolchain is retired: there is no `appc` CLI, no Appcelerator Studio and no hosted build service. The supported CLI is `titanium` on npm, invoked as `ti`.',
  ];
}

const url = (path: string): string => `${SITE_URL}${path}`;

/** A page's markdown address. Every documentation path has one. */
const mdUrl = (path: string): string => `${SITE_URL}${path}.md`;

/**
 * Rewrites site-relative links to absolute markdown ones.
 *
 * A corpus is read away from the site, where `/docs/setup/macos` resolves to
 * nothing. Pointing at the `.md` rather than the page keeps a model inside the
 * machine-readable tree once it follows one link, which is the whole point of
 * publishing the tree.
 *
 * Assets keep their own extension: an image is not a page, and `.md` appended
 * to a screenshot is a 404 dressed as a link.
 */
function absolutiseLinks(markdown: string): string {
  return markdown.replace(/\]\((\/[^)\s]*)\)/g, (whole, href: string) => {
    const [path, hash] = href.split('#');
    if (!path.startsWith('/docs') && !path.startsWith('/modules')) return whole;
    const suffix = hash ? `#${hash}` : '';
    return ASSET_EXTENSIONS.test(path) ? `](${url(path)}${suffix})` : `](${mdUrl(path)}${suffix})`;
  });
}

/**
 * Resolves the reference's own `api:` cross-reference scheme.
 *
 * Compiled summaries are full of `[Titanium.UI.Window](api:Titanium.UI.Window)`.
 * Left alone that reaches a reader as a URI scheme no client has, so it resolves
 * to the type's markdown address here, the same way the rendered pages resolve
 * it to an href.
 */
function resolveApiLinks(markdown: string): string {
  return markdown.replace(
    /\]\(api:([A-Za-z_][\w.]*)(#[^)\s]+)?\)/g,
    (_whole, type: string, hash: string | undefined) =>
      `](${mdUrl(`/docs/sdk/${type}`)}${hash ?? ''})`
  );
}

/** What a block opener becomes once there is no styling to carry its meaning. */
function openerText(name: string, argument: string): string {
  const platforms = () =>
    argument
      .split(',')
      .map((p) => platformLabel(p.trim()))
      .filter(Boolean)
      .join(', ');

  switch (name) {
    case 'platform':
      return `**Applies to ${platforms()} only.**`;
    case 'unavailable':
      return `**Not available on ${platforms()}.**`;
    case 'since':
      return `**Titanium SDK ${argument} and later.**`;
    case 'missing':
      // A screenshot nobody has taken yet. The box is the whole content, and an
      // empty box does not survive being turned into text.
      return '_Screenshot pending._';
    default:
      // `tabs`, `code-group`, `cards`: containers whose panels carry their own
      // labels, so the opener itself says nothing.
      return '';
  }
}

/**
 * Flattens the block directives `blocks.ts` renders into HTML.
 *
 * Those markers are a vocabulary of this repository and mean nothing outside
 * it, so a tab group arrives as a labelled sequence of prose rather than as
 * `:::tabs`. Dropping the markers without replacing them would be worse than
 * leaving them: `:::platform ios` is a statement about what the following
 * paragraph applies to, and losing it turns an iOS-only instruction into a
 * universal one.
 *
 * Fenced code is passed through untouched. A shell block that happens to
 * contain `:::` is not a directive.
 */
export function flattenBlocks(markdown: string): string {
  const out: string[] = [];
  let fence: string | null = null;
  let depth = 0;

  for (const line of markdown.split('\n')) {
    const fenceMark = /^\s*(```+|~~~+)/.exec(line);
    if (fenceMark) {
      if (!fence) fence = fenceMark[1][0];
      else if (line.trimStart().startsWith(fence)) fence = null;
      out.push(line);
      continue;
    }
    if (fence) {
      out.push(line);
      continue;
    }

    if (/^:::[ \t]*$/.test(line)) {
      if (depth > 0) depth -= 1;
      continue;
    }

    const open = /^:::([a-z-]+)(?:[ \t]+(.*?))?[ \t]*$/.exec(line);
    if (open) {
      depth += 1;
      out.push(openerText(open[1], open[2] ?? ''));
      continue;
    }

    const tab = /^@tab[ \t]+(.+?)[ \t]*$/.exec(line);
    if (tab) {
      out.push(`**${tab[1]}**`);
      continue;
    }

    const card = /^@card[ \t]+(.+?)[ \t]*$/.exec(line);
    if (card) {
      out.push(`- ${card[1]}`);
      continue;
    }

    out.push(line);
  }

  // Markers sit between blank lines, so removing them leaves runs of three or
  // more newlines that read as section breaks the author did not write.
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// -------------------------------------------------------------------- guides

/** One guide page as markdown, with the header a reader needs out of context. */
export function guideMarkdown(segments: string[]): string | undefined {
  const page = guide(segments);
  if (!page) return undefined;

  const head: string[] = [`# ${page.title}`, ''];
  if (page.description) head.push(`> ${page.description}`, '');

  const facts = [`Source: ${url(page.path)}`];
  if (page.platforms?.length) {
    facts.push(`Applies to: ${page.platforms.map(platformLabel).join(', ')}`);
  }
  if (page.since) facts.push(`Written for Titanium SDK ${page.since} and later.`);
  if (page.draft) facts.push('Status: draft. Not linked from the site, and not final.');
  facts.push(...banner());

  head.push(...facts.map((line) => `- ${line}`), '', '---', '');

  return `${head.join('\n')}\n${absolutiseLinks(flattenBlocks(page.markdown))}\n`;
}

// ----------------------------------------------------------------- reference

const platformList = (platforms: readonly ApiPlatform[]): string =>
  sortPlatforms(platforms)
    .map((p) => API_PLATFORM_LABELS[p])
    .join(', ');

/**
 * The deprecation notice, spelled out.
 *
 * The pages carry this as a badge and a coloured rule. A model reading text has
 * neither, and "deprecated" is precisely the fact that changes the answer, so it
 * is stated as a sentence and given its own line.
 */
function deprecationLine(deprecated: ApiType['deprecated']): string | null {
  if (!deprecated) return null;
  const since = deprecated.since ? ` since ${deprecated.since}` : '';
  const removed = deprecated.removed ? `, removed in ${deprecated.removed}` : '';
  const notes = deprecated.notes ? ` ${deprecated.notes.replace(/\s+/g, ' ').trim()}` : '';
  return `DEPRECATED${since}${removed}.${notes}`;
}

function parameterLines(rows: Parameter[], caption: string): string[] {
  const out = [`${caption}:`, ''];
  for (const row of rows) {
    const type = typeListText(row.type);
    const bits = [type, row.optional ? 'optional' : '', row.repeatable ? 'repeatable' : '']
      .filter(Boolean)
      .join(', ');
    const summary = row.summary ? ` ${row.summary.replace(/\s+/g, ' ').trim()}` : '';
    const fallback = row.default ? ` Default: \`${row.default}\`.` : '';
    out.push(`- \`${row.name}\`${bits ? ` (${bits})` : ''}:${summary}${fallback}`);
  }
  out.push('');
  return out;
}

/**
 * One member, with everything a badge would have said written out.
 *
 * Platforms are stated on every member rather than only the narrowed ones. A
 * page can omit them when they match the type, because the badges sit beside a
 * heading that already carried the type's own set; a member read as text out of
 * a three thousand line file has no such neighbour.
 */
function memberMarkdown(member: Member & { inheritedFrom?: string }, heading: string): string[] {
  const out = [`${heading} ${member.name}`, ''];

  const facts: string[] = [];
  const type = typeListText(member.type);
  if (type) facts.push(`Type: ${type}`);
  facts.push(`Platforms: ${platformList(member.platforms)}`);
  const since = formatSince(member.since);
  if (since) facts.push(`Since: Titanium SDK ${since}`);
  const osver = formatOsver(member.osver);
  if (osver) facts.push(`Requires: ${osver}`);
  if (member.permission) facts.push(`Permission: ${member.permission}`);
  if (member.default !== undefined) facts.push(`Default: \`${member.default}\``);
  if (member.value !== undefined) facts.push(`Value: \`${JSON.stringify(member.value)}\``);
  const deprecated = deprecationLine(member.deprecated);
  if (deprecated) facts.push(deprecated);
  out.push(...facts.map((line) => `- ${line}`), '');

  if (member.summary) out.push(member.summary.trim(), '');
  // An inherited member shows its summary and not its description, matching the
  // pages: the description belongs to the type that declares it, and repeating
  // it on every descendant was 64% of all rendered prose.
  if (member.description && !member.inheritedFrom) out.push(member.description.trim(), '');

  if (member.parameters?.length) out.push(...parameterLines(member.parameters, 'Parameters'));
  if (member.properties?.length) {
    out.push(...parameterLines(member.properties, 'Event properties'));
  }

  const returns = member.returns?.[0];
  if (returns) {
    const returned = typeListText(returns.type) || 'void';
    out.push(`Returns: ${returned}${returns.summary ? ` - ${returns.summary.trim()}` : ''}`, '');
  }

  if (member.constants?.length) {
    out.push(`Accepts: ${member.constants.map((c) => `\`${c}\``).join(', ')}`, '');
  }

  for (const example of member.examples ?? []) {
    if (example.title) out.push(`Example: ${example.title}`, '');
    out.push(example.code.trim(), '');
  }

  return out;
}

/**
 * One compiled type, at one version.
 *
 * Declared members are written out in full; inherited ones are listed by name
 * under the type that declares them, with a link to it. That split is the
 * difference between a usable file and an unusable one: every proxy inherits
 * the whole of `Titanium.Proxy`, and expanding that into all 284 types is the
 * same duplication the registry's own content pool exists to avoid.
 */
export function typeMarkdown(version: string, name: string): string | undefined {
  const type = sdkType(version, name);
  if (!type) return undefined;

  const view = viewOf((n) => sdkType(version, n), type);
  const base = version === latestSdkVersion() ? '/docs/sdk' : `/docs/sdk/${version}`;

  const out = [`# ${type.name}`, ''];
  if (type.summary) out.push(`> ${type.summary.replace(/\s+/g, ' ').trim()}`, '');

  const facts = [
    `Source: ${url(`${base}/${type.name}`)}`,
    `Titanium SDK version: ${version}`,
    `Kind: ${type.kind}`,
    `Platforms: ${platformList(type.platforms)}`,
  ];
  const since = formatSince(type.since);
  if (since) facts.push(`Since: Titanium SDK ${since}`);
  if (type.extends) facts.push(`Extends: ${type.extends}`);
  if (type.inheritanceChain?.length) {
    facts.push(`Inheritance: ${type.inheritanceChain.join(' > ')}`);
  }
  const deprecated = deprecationLine(type.deprecated);
  if (deprecated) facts.push(deprecated);
  out.push(...facts.map((line) => `- ${line}`), '');

  if (type.description) out.push(type.description.trim(), '');

  for (const example of type.examples ?? []) {
    out.push(`## Example${example.title ? `: ${example.title}` : ''}`, '', example.code.trim(), '');
  }

  const groups = [
    { title: 'Properties', members: view.properties },
    { title: 'Methods', members: view.methods },
    { title: 'Events', members: view.events },
  ];

  for (const group of groups) {
    const declared = group.members.filter((m) => !m.inheritedFrom);
    if (!declared.length) continue;
    out.push(`## ${group.title}`, '');
    for (const member of declared) out.push(...memberMarkdown(member, '###'));
  }

  const inherited = groups.flatMap((g) => g.members.filter((m) => m.inheritedFrom));
  if (inherited.length) {
    out.push('## Inherited members', '');
    out.push(
      `${inherited.length} members are inherited. Each is documented on the type that declares it.`,
      ''
    );
    const byOwner = new Map<string, string[]>();
    for (const member of inherited) {
      const owner = member.inheritedFrom as string;
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), member.name]);
    }
    for (const [owner, names] of [...byOwner].sort((a, b) => a[0].localeCompare(b[0]))) {
      const listed = names
        .sort()
        .map((n) => `\`${n}\``)
        .join(', ');
      out.push(`- [${owner}](${mdUrl(`${base}/${owner}`)}): ${listed}`);
    }
    out.push('');
  }

  out.push('---', '', ...banner().map((line) => `- ${line}`), '');

  return `${resolveApiLinks(out.join('\n'))}\n`;
}

/** The type list at one version: names, availability, and one line each. */
export function sdkIndexMarkdown(version: string): string | undefined {
  const index = sdkIndex(version);
  if (!index) return undefined;

  const base = version === latestSdkVersion() ? '/docs/sdk' : `/docs/sdk/${version}`;
  const out = [
    `# Titanium API ${version}`,
    '',
    `> Every type in the Titanium SDK ${version} reference: ${index.counts.types} types and ${index.counts.members} members.`,
    '',
    ...banner().map((line) => `- ${line}`),
    '- Fetch any single type in full by following its link below.',
    '',
    '## Types',
    '',
  ];

  for (const entry of [...index.types].sort((a, b) => a.name.localeCompare(b.name))) {
    const summary = entry.summary ? ` ${entry.summary.replace(/\s+/g, ' ').trim()}` : '';
    const flags = [
      entry.platforms?.length ? platformList(entry.platforms) : '',
      entry.deprecated ? 'DEPRECATED' : '',
    ]
      .filter(Boolean)
      .join('; ');
    out.push(
      `- [${entry.name}](${mdUrl(`${base}/${entry.name}`)})${flags ? ` (${flags})` : ''}:${summary}`
    );
  }
  out.push('');

  return `${resolveApiLinks(out.join('\n'))}\n`;
}

// ------------------------------------------------------------------- modules

/**
 * One registry module.
 *
 * These earn a place in the corpus because "which Titanium module does
 * Bluetooth" is a question a model gets wrong in a specific and costly way: it
 * answers with an Appcelerator-era module name and an install command for a
 * marketplace that no longer exists. The registry knows the current id, the
 * current version per platform and the minimum SDK, and none of that is
 * anywhere in a model's training data.
 */
export function moduleMarkdown(id: string): string | undefined {
  const index = moduleIndex(id);
  if (!index) return undefined;

  const out = [`# ${id}`, ''];
  if (index.description) out.push(`> ${index.description.replace(/\s+/g, ' ').trim()}`, '');

  const facts = [`Source: ${url(`/modules/${id}`)}`, `Module id: \`${id}\``];
  if (index.repo) facts.push(`Repository: ${index.repo}`);
  facts.push(`Curation: ${index.source}`);
  out.push(...facts.map((line) => `- ${line}`), '');

  const releases = latestReleases(index);
  if (releases.length) {
    out.push('## Latest release, per platform', '');
    for (const release of releases) {
      const minsdk = release.minsdk ? `, requires Titanium SDK ${release.minsdk} or later` : '';
      out.push(`- ${release.platform}: ${release.version}${minsdk}`);
    }
    out.push(
      '',
      '## Install',
      '',
      'Declare it in `tiapp.xml`. The CLI resolves and downloads it on the next build:',
      '',
      '```xml',
      '<modules>',
      ...releases.map(
        (r) => `  <module platform="${r.platform}" version="${r.version}">${id}</module>`
      ),
      '</modules>',
      '```',
      ''
    );
  }

  // The newest release that carries compiled docs. One version only: the pages
  // render a union across platforms, and a flat name list gains nothing from
  // being printed twice.
  for (const version of new Set(releases.map((r) => r.version))) {
    const api = moduleApiIndex(id, version);
    if (!api) continue;
    out.push(`## API, at ${version}`, '');
    for (const entry of api.types) {
      const summary = entry.summary ? ` ${entry.summary.replace(/\s+/g, ' ').trim()}` : '';
      out.push(`- \`${entry.name}\`:${summary}`);
    }
    out.push('');
    break;
  }

  out.push('---', '', ...banner().map((line) => `- ${line}`), '');

  return `${resolveApiLinks(out.join('\n'))}\n`;
}

/** Every module the registry carries, with the id a developer actually types. */
export function modulesIndexMarkdown(): string {
  const out = [
    '# Titanium modules',
    '',
    '> Native modules TiDev builds and hosts. The id is what goes in `tiapp.xml`.',
    '',
    ...banner().map((line) => `- ${line}`),
    '',
    '## Modules',
    '',
  ];

  for (const id of moduleIds()) {
    const index = moduleIndex(id);
    const summary = index?.description ? ` ${index.description.replace(/\s+/g, ' ').trim()}` : '';
    out.push(`- [${id}](${mdUrl(`/modules/${id}`)}):${summary}`);
  }

  out.push(
    '',
    `Community modules that TiDev does not host are listed at ${url('/modules')}, which is the only current index of them.`,
    ''
  );

  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------- resolution

/**
 * The markdown for a documentation path, or undefined when there is none.
 *
 * One resolver, used by the route handler that serves `.md` and by the
 * validator that checks `llms.txt`. Sharing it is the point: an entry is
 * checked by asking for the same bytes a reader would get, so the two cannot
 * disagree.
 *
 * `/docs/sdk/<segment>` resolves version-first and then as a type name, which is
 * the rule `app/docs/sdk/[segment]` already applies. Nothing can be both:
 * `resolveVersion` is an allowlist of compiled directories, and no compiled type
 * name looks like a version.
 */
export function markdownFor(path: string): string | undefined {
  const clean = path.replace(/\/+$/, '') || '/';

  if (clean === '/modules') return modulesIndexMarkdown();
  if (clean.startsWith('/modules/')) {
    const rest = clean.slice('/modules/'.length);
    return rest.includes('/') ? undefined : moduleMarkdown(rest);
  }

  if (clean !== '/docs' && !clean.startsWith('/docs/')) return undefined;

  const segments = clean.split('/').slice(2).filter(Boolean);

  if (segments[0] === 'sdk') {
    if (segments.length > 3) return undefined;
    const [, first, second] = segments;
    if (!first) {
      const latest = latestSdkVersion();
      return latest ? sdkIndexMarkdown(latest) : undefined;
    }

    const version = resolveVersion(first);
    if (second) return version ? typeMarkdown(version, second) : undefined;
    if (version) return sdkIndexMarkdown(version);

    const latest = latestSdkVersion();
    return latest ? typeMarkdown(latest, first) : undefined;
  }

  return guideMarkdown(segments);
}

// --------------------------------------------------------------------- index

export type LlmsEntry = { title: string; path: string; blurb?: string };
export type LlmsGroup = {
  heading: string;
  /**
   * Whether these entries are guide prose, and so belong in `llms-full.txt`.
   *
   * Stated rather than inferred from the path. `/docs/sdk` is under `/docs` and
   * is not a guide, and a prefix test that happened to work only because
   * `guideMarkdown` returns nothing for it would break the moment a guide
   * section gained a generated index.
   */
  guides: boolean;
  entries: LlmsEntry[];
};

/**
 * The curated index, as sections of linked entries.
 *
 * Built from `SECTIONS` and `writtenPaths()`, which is what the sidebar is
 * built from, so an entry exists here precisely when a page does. Unwritten
 * paths are skipped rather than listed as pending: the site can honestly show a
 * reader a placeholder, and a corpus cannot. A link in `llms.txt` is a promise
 * that fetching it returns content.
 */
export function llmsGroups(): LlmsGroup[] {
  const written = writtenPaths();
  const groups: LlmsGroup[] = [];

  const describe = (segments: string[], fallback?: string): string | undefined =>
    guide(segments)?.description || fallback;

  for (const section of SECTIONS) {
    const entries: LlmsEntry[] = [];
    const sectionPath = `/docs/${section.slug}`;

    if (written.has(sectionPath)) {
      entries.push({
        title: section.index?.title ?? section.title,
        path: sectionPath,
        blurb: describe([section.slug], section.blurb),
      });
    }

    for (const page of section.pages) {
      const path = `${sectionPath}/${page.slug}`;
      if (written.has(path)) {
        entries.push({
          title: page.title,
          path,
          blurb: describe([section.slug, page.slug], page.blurb),
        });
      }
      for (const child of page.pages ?? []) {
        const childPath = `${path}/${child.slug}`;
        if (!written.has(childPath)) continue;
        entries.push({
          title: child.title,
          path: childPath,
          blurb: describe([section.slug, page.slug, child.slug], child.blurb),
        });
      }
    }

    if (entries.length) groups.push({ heading: section.title, guides: true, entries });
  }

  const version = corpusVersion();
  groups.push({
    heading: 'API reference',
    guides: false,
    entries: [
      {
        title: `Titanium API index (${version})`,
        path: '/docs/sdk',
        blurb: `Every type in ${version}, one line each, each linking to its own full entry.`,
      },
    ],
  });

  groups.push({
    heading: 'Modules',
    guides: false,
    entries: [
      {
        title: 'Module index',
        path: '/modules',
        blurb: 'Native modules TiDev hosts, with the id used in `tiapp.xml`.',
      },
      ...moduleIds().map((id) => ({
        title: id,
        path: `/modules/${id}`,
        blurb: moduleIndex(id)?.description?.replace(/\s+/g, ' ').trim(),
      })),
    ],
  });

  return groups;
}

/**
 * `/llms.txt`, to the llmstxt.org convention: an H1, a blockquote summary,
 * free-form notes, then H2 sections of linked entries.
 *
 * Links point at the `.md` rather than the page. A client that follows one is
 * asking for text, and handing it HTML with a navigation sidebar in it is the
 * thing this file exists to avoid.
 */
export function llmsTxt(): string {
  const out = [
    '# Titanium SDK',
    '',
    '> Titanium SDK is an open source framework for building native iOS and Android apps in JavaScript, maintained by TiDev. One JavaScript codebase drives real native platform controls through a per-platform bridge, rather than a web view.',
    '',
    ...banner().map((line) => `- ${line}`),
    `- Every entry below is served as HTML at the same address without the \`.md\`. The whole guide corpus in one file is at ${url('/llms-full.txt')}.`,
    '- Agent skills for Titanium work, including module maintenance and release flows, are published separately at https://github.com/tidev/skills.',
    '',
  ];

  for (const group of llmsGroups()) {
    out.push(`## ${group.heading}`, '');
    for (const entry of group.entries) {
      out.push(`- [${entry.title}](${mdUrl(entry.path)})${entry.blurb ? `: ${entry.blurb}` : ''}`);
    }
    out.push('');
  }

  out.push(
    '## Optional',
    '',
    `- [Full guide corpus](${url('/llms-full.txt')}): every guide entry above, concatenated.`,
    `- [Downloads](${url('/downloads')}): every released and prerelease build, with checksums.`,
    `- [Registry API](${url('/registry/v1')}): JSON for releases, branches and modules.`,
    '- [tidev/skills](https://github.com/tidev/skills): agent skills for Titanium development.',
    '- [tidev/titanium-sdk](https://github.com/tidev/titanium-sdk): the SDK source, and where to file an issue.',
    ''
  );

  return `${out.join('\n')}\n`;
}

export type LlmsFull = {
  text: string;
  /** Paths the cap left out, in the order they would have been emitted. */
  omitted: string[];
};

/**
 * `/llms-full.txt`: every written guide page, concatenated. Guides only.
 *
 * The reference is deliberately absent and the file says so, with the address
 * of the index that does carry it. A model that needs `Titanium.UI.Window` can
 * fetch one type rather than be handed 13MB it did not ask for.
 *
 * @param cap  the ceiling, overridable so the truncation path can be tested
 *             without writing a megabyte of fixture prose to cross it
 */
export function llmsFullTxt(cap = LLMS_FULL_CAP_BYTES): LlmsFull {
  const version = corpusVersion();
  const header = [
    '# Titanium SDK guides',
    '',
    '> Every written guide page from titaniumsdk.com, concatenated. Guides only: the API reference is not included here.',
    '',
    ...banner().map((line) => `- ${line}`),
    `- Scope: guide prose. The API reference is ${sdkIndex(version)?.counts.types ?? 0} types, served one type at a time; its index is at ${mdUrl('/docs/sdk')}.`,
    `- Curated index of everything below: ${url('/llms.txt')}.`,
    `- Size cap: ${cap.toLocaleString('en-US')} bytes. Pages are emitted in site order and the first that would exceed the cap ends the file. Anything dropped is listed at the end with its own address.`,
    '',
  ].join('\n');

  const chunks: string[] = [header];
  const omitted: string[] = [];
  let size = sizeOf(header);

  for (const group of llmsGroups()) {
    // Only the guide tree. The reference and module groups in the index point
    // into trees this file does not carry.
    if (!group.guides) continue;

    for (const entry of group.entries) {
      const page = guideMarkdown(entry.path.split('/').slice(2));
      if (!page) continue;
      const chunk = `\n---\n\n${page}`;
      // Once one page has been dropped, every later page is dropped too. Filling
      // the remaining space with whichever short page happened to fit next would
      // make the contents depend on page length rather than on site order.
      if (omitted.length || size + sizeOf(chunk) > cap) {
        omitted.push(entry.path);
        continue;
      }
      chunks.push(chunk);
      size += sizeOf(chunk);
    }
  }

  if (omitted.length) {
    chunks.push(
      [
        '',
        '---',
        '',
        `## Omitted for size (${omitted.length})`,
        '',
        `These pages were dropped at the ${cap.toLocaleString('en-US')} byte cap. Each is served on its own:`,
        '',
        ...omitted.map((path) => `- ${mdUrl(path)}`),
        '',
      ].join('\n')
    );
  }

  return { text: chunks.join(''), omitted };
}

// ---------------------------------------------------------------- validation

/**
 * Every entry in `llms.txt`, resolved the way a reader would resolve it.
 *
 * Run by `scripts/check-docs.ts` alongside the guide link check and reported in
 * the same shape, so a broken entry here fails a build exactly as a broken link
 * between two guides does. It resolves through `markdownFor` rather than against
 * a list of known paths: a list can agree with the index while both are wrong
 * about what the route serves.
 */
export function validateLlmsIndex(): Problem[] {
  const problems: Problem[] = [];
  const seen = new Set<string>();

  for (const group of llmsGroups()) {
    for (const entry of group.entries) {
      if (seen.has(entry.path)) {
        problems.push({ where: 'llms.txt', message: `duplicate entry: ${entry.path}` });
        continue;
      }
      seen.add(entry.path);
      if (!markdownFor(entry.path)) {
        problems.push({
          where: 'llms.txt',
          message: `entry resolves to no markdown: ${entry.path}.md`,
        });
      }
    }
  }

  if (!latestSdkVersion()) {
    problems.push({
      where: 'llms.txt',
      message: 'no compiled SDK version in the registry, so the corpus cannot state one',
    });
  }

  return problems;
}
