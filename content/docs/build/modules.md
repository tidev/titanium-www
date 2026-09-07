---
title: Using modules
description: Adding native modules and npm packages to a project, and requiring them.
since: 13.4.0
---

Two different things get added to a Titanium project and both are called
dependencies.

A **native module** wraps platform code the core SDK does not expose: Bluetooth,
maps, barcodes. It ships as a built binary per platform.

An **npm package** is JavaScript. If it runs without Node's built-ins and
without a browser, it will probably run here.

## Native modules

The [modules directory](/modules) lists what TiDev maintains, with the id to
install. Installing one is two steps: fetch it, then declare it.

```sh
ti module install ti.map
```

That unpacks it into the project's `modules/` directory. Then declare it in
`tiapp.xml`, per platform:

```xml
<modules>
  <module platform="android">ti.map</module>
  <module platform="iphone">ti.map</module>
</modules>
```

Both steps are needed. A module on disk that `tiapp.xml` does not name is not
built in, and the failure is a `require` that returns nothing rather than an
error at build time.

Then require it by id:

```js
const Map = require('ti.map');
```

Pin a version when you care which one you get:

```xml
<module platform="android" version="5.7.0">ti.map</module>
```

Without a version the newest installed copy wins, which means a machine with
two versions in `modules/` and a colleague's machine with one can produce
different builds from the same commit.

> [!IMPORTANT]
> A module is native code, so it is built for specific platforms and against a
> range of SDK versions. A module that has not been rebuilt for a newer Titanium
> SDK may fail at build time with a linker error rather than anything that names
> the module. Check the module's own page for the versions it supports.

### Where modules live

`modules/<platform>/<moduleid>/<version>/` in the project, which is committed
like any other source. Some teams keep them out of version control and install
in CI instead; either works, as long as the whole team does the same thing.

A module installed globally with `ti module install -g` is available to every
project on that machine and to nobody else's, which makes builds
machine-dependent. Prefer the project-local install.

## npm packages

`package.json` in the project root, and `npm install` as normal:

```sh
npm install lodash
```

```js
const _ = require('lodash');
```

Titanium bundles what is in `node_modules` at build time. There is no
resolution at runtime, so a package pulled in dynamically by name computed at
runtime will not be there.

**What will not work:** anything that needs Node's built-ins (`fs`, `net`,
`child_process`), anything that needs a DOM, and anything shipping native
bindings. A package that only touches `Ti.*` and plain JavaScript is fine.
Check before adopting a large dependency; the failure arrives at runtime as an
undefined require.

Keep `node_modules` out of version control as you would anywhere else.

## Which one do I need

If it talks to hardware, the operating system, or a platform SDK, it is a
native module and somebody has to have written it. If it is an algorithm, a
parser, or a client for an HTTP API, it is probably an npm package.

If neither exists, writing a native module is covered under Extending Titanium.

## Next

[Debugging and profiling](/docs/build/debugging) covers finding out why the
thing you just added is not working.
