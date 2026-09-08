import type { ApiPlatform, ApiType, CliReleases, Toolchain } from '../registry/index.ts';
import { minimumCli } from './cli-support.ts';
import { PLATFORM_LABELS, PLATFORM_ORDER } from './format.ts';
import {
  apiTypeAt,
  compareVersions,
  MAIN,
  REGISTRY,
  sdkIndex,
  sdkToolchain,
  sdkVersions,
} from './registry.ts';
import { join } from 'node:path';

/**
 * The compatibility page, built from the registry rather than written (TI-75).
 *
 * ## Why this is generated
 *
 * The page it replaces was a single hand-maintained matrix, and
 * `docs/legacy-guide-audit.md` flags it as factually wrong. That is what a
 * hand-maintained matrix becomes: nothing in a build can check "Xcode 15.0 to
 * 26.x" or "`Titanium.UI.Color` arrived in 9.1.0 on four platforms", so both
 * halves drifted until following the page was worse than not reading it.
 *
 * Both halves are recorded in machine-readable form and both are now read:
 *
 *   platform support   every compiled type carries `platforms` and `since`, and
 *                      so does every one of its members
 *   toolchain          `registry/sdk/<version>/toolchain.json`, transcribed
 *                      from the release's own `package.json` files by
 *                      `scripts/capture-toolchain.ts`
 *
 * The output is markdown rather than a component, spliced into the page through
 * the ordinary `:::include` partial mechanism. A component would have meant a
 * second rendering path for guide content, which `guides.ts` argues against at
 * length, and markdown keeps the generated tables readable in a diff.
 *
 * ## Why the matrix is types and not members
 *
 * 13.4.1 compiles 284 types and 10,395 members. A row per member is not a page,
 * it is a database dump: it would be several megabytes of HTML that nobody can
 * scan, in service of a question the member's own reference page already
 * answers precisely.
 *
 * A row per type is 284 rows, which is a page. What would otherwise be lost is
 * the case the reference is genuinely bad at surfacing, so it is kept as a
 * mark: a type available on a platform whose members are not all available
 * there. 129 of 284 types are in that state, and it is the one thing a reader
 * cannot see without opening the type.
 */

/** Below this, a namespace is folded into its root rather than getting a heading. */
const MIN_GROUP = 4;

/** The group everything that is not under a namespace lands in. */
const OTHER = 'Other types';

/**
 * A markdown table with its columns padded to their widest cell.
 *
 * Cosmetic in the rendered page and load-bearing in the repository: `oxfmt`
 * formats markdown, and it pads exactly this way. A generator that emitted
 * ragged tables would be reformatted the moment anyone ran `pnpm fmt`, and the
 * next `pnpm docs:compat:check` would then call its own output stale. Producing
 * the formatted form directly keeps generation offline and idempotent instead
 * of shelling out to a formatter mid-build.
 */
export function table(header: string[], rows: string[][]): string[] {
  const width = header.map((h, i) =>
    Math.max(3, h.length, ...rows.map((r) => (r[i] ?? '').length))
  );
  const line = (cells: string[]) =>
    `| ${cells.map((c, i) => (c ?? '').padEnd(width[i])).join(' | ')} |`;

  return [line(header), line(width.map((w) => '-'.repeat(w))), ...rows.map(line)];
}

export type MatrixRow = {
  name: string;
  platforms: ApiPlatform[];
  since?: string | Record<string, string>;
  deprecated: boolean;
  /**
   * Platforms the type itself has, but at least one of its members does not.
   *
   * Computed from the type's own members and its resolved inherited references,
   * both of which carry platforms already narrowed to this type - see
   * `InheritedRefSchema`. So this is what the type's page would show, not a
   * guess from the declaring type.
   */
  partial: ApiPlatform[];
};

export type Matrix = {
  version: string;
  rows: MatrixRow[];
  /** Every member the version compiles, own and inherited, across all types. */
  members: number;
};

/**
 * Which namespace heading a type is listed under.
 *
 * `Titanium.UI.iOS.BlurView` is grouped under `Titanium.UI`, not under
 * `Titanium.UI.iOS`: the second segment is the namespace a reader thinks in,
 * and grouping any deeper splits `Titanium.UI` into a heading of 53 and one of
 * 43 that sit next to each other for no reason a reader would predict.
 *
 * A namespace with fewer than `MIN_GROUP` types is folded into its root, so
 * `Titanium.Gesture` (one type) is listed under `Titanium` rather than earning
 * a heading of its own. Names with no namespace at all - the pseudo-types and
 * the Node shims, `Point`, `fs`, `buffer` - go to one alphabetical group.
 */
export function groupsFor(names: readonly string[]): Map<string, string[]> {
  const roots = new Set(['Titanium', 'Global']);

  const candidate = (name: string): string => {
    const parts = name.split('.');
    if (!roots.has(parts[0])) return OTHER;
    return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
  };

  const counts = new Map<string, number>();
  for (const name of names) counts.set(candidate(name), (counts.get(candidate(name)) ?? 0) + 1);

  const groups = new Map<string, string[]>();
  for (const name of names) {
    const first = candidate(name);
    const key =
      first === OTHER || (counts.get(first) ?? 0) >= MIN_GROUP ? first : name.split('.')[0];
    const list = groups.get(key);
    if (list) list.push(name);
    else groups.set(key, [name]);
  }

  for (const list of groups.values()) list.sort((a, b) => a.localeCompare(b));

  // Namespaces alphabetically, then the catch-all: it is the group a reader
  // falls back to, so it reads as the end of the list rather than as an entry
  // in it.
  return new Map(
    [...groups].sort(([a], [b]) => {
      if (a === OTHER) return 1;
      if (b === OTHER) return -1;
      return a.localeCompare(b);
    })
  );
}

/** Platforms the type has that at least one of its members lacks. */
export function narrowedPlatforms(type: ApiType): ApiPlatform[] {
  const own = new Set(type.platforms);
  const missing = new Set<ApiPlatform>();

  const note = (platforms: readonly ApiPlatform[]) => {
    if (platforms.length === own.size) return;
    for (const p of own) if (!platforms.includes(p)) missing.add(p);
  };

  for (const member of [...type.properties, ...type.methods, ...type.events]) {
    note(member.platforms);
  }
  for (const key of ['properties', 'methods', 'events'] as const) {
    for (const ref of type.inherited[key]) note(ref.platforms);
  }

  return PLATFORM_ORDER.filter((p) => missing.has(p));
}

/** Reads one compiled SDK version into the rows the matrix renders. */
export function readMatrix(version: string): Matrix | null {
  const index = sdkIndex(version);
  if (!index) return null;
  const dir = join(REGISTRY, 'sdk', version);

  let members = 0;
  const rows: MatrixRow[] = [];

  for (const entry of index.types) {
    const type = apiTypeAt(dir, entry.name);
    if (!type) continue;
    members +=
      type.properties.length +
      type.methods.length +
      type.events.length +
      type.inherited.properties.length +
      type.inherited.methods.length +
      type.inherited.events.length;

    rows.push({
      name: type.name,
      platforms: PLATFORM_ORDER.filter((p) => type.platforms.includes(p)),
      ...(type.since ? { since: type.since } : {}),
      deprecated: Boolean(type.deprecated),
      partial: narrowedPlatforms(type),
    });
  }

  return { version, rows, members };
}

/** What one platform's cell says: the release it arrived in, or that it is absent. */
export function cell(row: MatrixRow, platform: ApiPlatform): string {
  if (!row.platforms.includes(platform)) return '-';
  const since =
    typeof row.since === 'string' ? row.since : row.since ? row.since[platform] : undefined;
  const mark = row.partial.includes(platform) ? ' \\*' : '';
  return `${since ?? 'yes'}${mark}`;
}

const HEADER = ['Type', ...PLATFORM_ORDER.map((p) => PLATFORM_LABELS[p])];

/**
 * The platform-support partial.
 *
 * Every heading is a namespace a reader would search for, and every row links
 * to the type's own page, because the matrix answers "does this exist here" and
 * the type page answers everything after that.
 */
export function renderMatrix(matrix: Matrix, generatedFrom: string): string {
  const byName = new Map(matrix.rows.map((r) => [r.name, r]));
  const groups = groupsFor(matrix.rows.map((r) => r.name));
  const partial = matrix.rows.filter((r) => r.partial.length).length;

  const out: string[] = [
    generatedFrom,
    '',
    `Generated from **Titanium SDK ${matrix.version}**: ` +
      `${matrix.rows.length} types, ${matrix.members.toLocaleString('en-US')} members.`,
    'Rebuilding the registry rebuilds this, so it describes the release the',
    '[API reference](/docs/sdk) is currently showing and no other.',
    '',
    'A cell holds the release the type arrived in on that platform. `yes` means it is there',
    'and no arrival release was recorded. `-` means it is not available on that platform.',
    '',
    `A cell marked \\* is available, but not everything in it is: ${partial} of the`,
    `${matrix.rows.length} types have members their own platforms do not all carry. That is`,
    'the case this table cannot show and the type page can, so open the type before',
    'relying on all of it.',
    '',
  ];

  for (const [group, names] of groups) {
    const cells = names.map((name) => {
      const row = byName.get(name)!;
      const label = `[${name}](/docs/sdk/${name})${row.deprecated ? ' (deprecated)' : ''}`;
      return [label, ...PLATFORM_ORDER.map((p) => cell(row, p))];
    });
    out.push(`### ${group}`, '', ...table(HEADER, cells), '');
  }

  return out.join('\n');
}

// ------------------------------------------------------------------- toolchain

/** Vendor keys worth a column of their own, in the order the page reads them. */
const COLUMNS: { key: string; label: string; from: 'android' | 'ios' }[] = [
  { key: 'java', label: 'Java', from: 'android' },
  { key: 'android sdk', label: 'Android SDK', from: 'android' },
  // Spelled out despite the width it costs the row: "Build tools" beside an
  // Xcode column reads as ambiguous about which platform it belongs to.
  { key: 'android build tools', label: 'Android build tools', from: 'android' },
  { key: 'xcode', label: 'Xcode', from: 'ios' },
  { key: 'ios sdk', label: 'iOS SDK', from: 'ios' },
];

/**
 * Anything that would end a table cell early, neutralised.
 *
 * `16.x || 18.x || 20.x` is a real value and its pipes end the cell: markdown-it
 * splits a table row on unescaped `|` before it parses any inline, so a code
 * span does not protect them. Escaped, GFM puts the literal pipe back inside
 * the span. A newline ends the row outright and cannot be escaped at all, so it
 * is folded to a space.
 *
 * Every string this module puts in a toolchain cell goes through here, keys
 * included. They come from `vendorDependencies`, whose shape is the SDK's to
 * change, so a release could introduce either without this repository being
 * asked first.
 */
const cellSafe = (v: string) => v.replace(/\|/g, '\\|').replace(/\s*[\r\n]+\s*/g, ' ');

/** One range, as a code span safe to put in a table cell. */
const code = (v: string | undefined) => (v ? `\`${cellSafe(v)}\`` : '-');

/** Every compiled version that has been captured, newest first, `main` last. */
export function readToolchains(): Toolchain[] {
  return sdkVersions()
    .map((v) => sdkToolchain(v))
    .filter((t): t is Toolchain => t !== null);
}

/**
 * The toolchain partial: what each release needs, and what each release targets.
 *
 * Ranges are printed exactly as the SDK authored them, which is also exactly
 * what `ti info` prints beside "Supported:". Restating `>=23.x <=36.x` as "23
 * to 36" would be this page paraphrasing a constraint it does not own, and the
 * paraphrase is what a reader would then compare against their machine.
 */
export function renderToolchain(
  all: readonly Toolchain[],
  cliReleases: CliReleases['releases'],
  generatedFrom: string
): string {
  if (!all.length) return `${generatedFrom}\n\nNo release has been captured yet.\n`;

  const current = all.find((t) => t.version !== MAIN) ?? all[0];
  const rows = toolchainRows(all, current);
  const out: string[] = [
    generatedFrom,
    '',
    `### Titanium SDK ${current.version}`,
    '',
    'Everything the newest release checks your machine against. Each range is printed as',
    'the SDK declares it, which is the string `ti info` puts beside "Supported:".',
    '',
    `Read out of \`${current.source.repo}\` at commit \`${current.source.commit.slice(0, 7)}\`, ` +
      `the same commit this release's [API reference](/docs/sdk) was compiled from.`,
    'There is no last-verified date because nothing here is verified by hand: it is the',
    'release stating what the release needs.',
    '',
    ...table(
      ['Component', 'Supported'],
      [
        ['Node.js', code(current.node)],
        ['Titanium CLI', code(minimumCli(current, cliReleases))],
        ...Object.entries(current.android.vendor).map(([k, v]) => [label(k), code(v)]),
        ...Object.entries(current.ios.vendor).map(([k, v]) => [label(k), code(v)]),
      ]
    ),
    '',
    '### What each release needs',
    '',
    ...table(
      ['SDK', 'Node.js', 'Titanium CLI', ...COLUMNS.map((c) => c.label)],
      rows.map((t) => [
        releaseLabel(t, current),
        code(t.node),
        code(minimumCli(t, cliReleases)),
        ...COLUMNS.map((c) => code(t[c.from].vendor[c.key])),
      ])
    ),
    '',
    '### What each release builds for',
    '',
    'The floors your app runs on, rather than the tools that build it. An Android device',
    'below the minimum API level, or a simulator below the minimum iOS version, cannot run',
    'what the release produces.',
    '',
    ...table(
      ['SDK', 'Min Android API', 'Compiles against API', 'Min iOS', 'Min watchOS'],
      rows.map((t) => [
        releaseLabel(t, current),
        plain(t.android.minSdkVersion),
        plain(t.android.compileSdkVersion),
        plain(t.ios.minIosVersion),
        plain(t.ios.minWatchosVersion),
      ])
    ),
  ];

  return `${out.join('\n')}\n`;
}

const plain = (v: string | undefined) => (v ? cellSafe(v) : '-');

/**
 * The rows of both release tables: `main` first where it is ahead, then the
 * releases newest first.
 *
 * `main` leads rather than trails because it is the row that answers a question
 * the others cannot. A reader checking whether their Java or Xcode will still
 * work is usually asking about the next SDK, not the last one, and `main`
 * carries the only requirements on this page that have not shipped yet: it
 * already wants Node 22.19.0 where 13.4.1 asks for 20.18.1.
 *
 * It is dropped when it is not ahead of the newest release, which is the window
 * between a release shipping and `main` being bumped past it. There `main`
 * declares the version that just shipped, so the row would duplicate the
 * release above it while the word "unreleased" implied something newer exists.
 *
 * A `main` with no `declared` version is kept. It was captured before the field
 * was recorded, and dropping a row for want of a comparison would hide the
 * development tree entirely rather than admit the comparison cannot be made.
 */
function toolchainRows(all: readonly Toolchain[], current: Toolchain): Toolchain[] {
  const main = all.find((t) => t.version === MAIN);
  const releases = all.filter((t) => t.version !== MAIN);
  if (!main) return [...releases];

  const ahead =
    main.declared === undefined ||
    main === current ||
    compareVersions(main.declared, current.version) < 0;
  return ahead ? [main, ...releases] : [...releases];
}

/**
 * `main` is the development tree, so it is named as one rather than as a
 * version, with the version it will become in parentheses. Naming only `main`
 * leaves the reader unable to tell which release the row is a preview of;
 * naming only the version would present an unreleased tree as installable.
 */
const releaseLabel = (t: Toolchain, current?: Toolchain) => {
  // Every row here came from `sdkVersions()`, which lists only versions with a
  // compiled reference, so the link always resolves.
  const href = `/docs/sdk/${t.version}`;
  if (t.version === MAIN) {
    return `[\`main\`](${href}) (${t.declared ? `${t.declared}, ` : ''}unreleased)`;
  }
  // `main` is never the latest: it is not released. Where it is the only entry
  // it stands in as `current` for the summary above, and marking it there would
  // contradict the word "unreleased" beside it.
  const latest = current && current.version !== MAIN && t.version === current.version;
  return `**[${t.version}](${href})**${latest ? ' (latest)' : ''}`;
};

/** `android build tools` reads as a column heading; `ios sdk` and `ndk` do not. */
function label(key: string): string {
  const special: Record<string, string> = {
    'ios sdk': 'iOS SDK',
    xcode: 'Xcode',
    java: 'Java (JDK)',
    'android sdk': 'Android SDK',
    'android build tools': 'Android build tools',
    'android platform tools': 'Android platform tools',
    'android tools': 'Android tools',
    'android ndk': 'Android NDK',
  };
  return special[key] ?? cellSafe(key.replace(/^./, (c) => c.toUpperCase()));
}
