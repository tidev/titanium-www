# public/docs

Two different kinds of thing live here. Only one of them is yours to edit.

## `img/` and `assets.json` — generated, do not edit

Built by `scripts/sync-doc-assets.ts`, which runs as part of `pnpm build`:

```sh
node scripts/sync-doc-assets.ts
```

It mirrors the doc images out of `registry/` and into `img/`. The filenames are
hashes because the registry stores these images content-addressed — every SDK
version references the same screenshots, and all 54 are byte-identical across a
13-month span, so one file per distinct image is written rather than one per
version.

The readable name is not lost. `registry/sdk/<version>/contents.json` maps it:

```
Titanium/UI/alertdialog_android.png  ->  d68b0885db127265.png
```

`assets.json` is the flattened form of that mapping, and `src/lib/docs/assets.ts`
reads it to rewrite an image URL at render time.

The source of truth is upstream, in `tidev/titanium-sdk` under `apidoc/`, where
the file is named `alertdialog_android.png` and sits beside the YAML that
references it. Nothing here is edited by hand: both paths are gitignored, and
the script deletes anything in `img/` it did not write.

## `guides/` — committed, edit freely

Images an author added to a page under `content/docs`. Named by whoever added
them, committed like any other source file, and never touched by the script.
Reference one from a guide by its path:

```md
![The SDK Manager](/docs/guides/android-sdk-manager.png)
```

See `docs/writing-guides.md` for the conventions.

### Third-party marks

Where a guide shows another project's logo, record where it came from here, the
way `src/components/downloads/os-icon.tsx` records the OS marks it draws.

| File            | Source                                                        |
| --------------- | ------------------------------------------------------------- |
| `vscode.png`    | `microsoft/vscode-docs`, `images/logo-stable.png`, unmodified |
| `pulsar.png`    | `pulsar-edit/pulsar`, `resources/pulsar.png`, scaled to 256px |
| `jetbrains.svg` | Simple Icons (CC0-1.0), `icons/jetbrains.svg`, given a fill   |

`jetbrains.svg` carries an explicit `fill` because an SVG loaded through `<img>`
has no parent context: `currentColor` would resolve to black and the mark would
disappear on the dark canvas. A fixed mid-tone reads on both themes, where a
`prefers-color-scheme` rule inside the file would be wrong for anyone who has
set the site's theme toggle against their OS.

Only JetBrains is in Simple Icons, which is where the OS marks come from. That
library carries no Visual Studio Code icon at all, and its `apachepulsar` is the
Apache message broker rather than the editor, so those two are the projects' own
artwork, used to refer to the products they name.

That split shows: the two PNGs are full-colour product logos and the JetBrains
mark is a monochrome silhouette. Tracked in TI-78.

---

This file is not served. `next.config.ts` rewrites `/docs/README.md` away
before the static handler sees it — see the note there.
