---
title: Compatibility
description: The toolchain versions a Titanium SDK release supports.
since: 13.4.0
---

Every Titanium SDK release supports a range of each thing it drives. These are
the ranges for **SDK 13.4**, read from the release itself rather than from a
changelog.

## Node.js

|           | Version         |
| --------- | --------------- |
| Minimum   | **22.19.0**     |
| Supported | 22.19.0 or 24.x |

The floor is the CLI's own `engines.node`. The ceiling is the SDK's: 13.4
bundles `node-ios-device`, which publishes prebuilt binaries only up to Node
24, so **Node 26 breaks iOS tooling on macOS** and `ti info` exits before
printing anything. Node 26 needs SDK 14 or newer, where that dependency is
gone.

Name a version rather than tracking "LTS". The ceiling comes from the SDK, and
LTS moves independently of it.

## Java

|           | Version       |
| --------- | ------------- |
| Minimum   | **17**        |
| Supported | 17, 21, or 25 |

From `android/package.json`, which declares `java: >=17.x`. JDK 26 needs SDK 14
or newer. Any distribution works.

## Android

| Component               | Supported          |
| ----------------------- | ------------------ |
| Android SDK (API level) | **23 to 36**       |
| Build tools             | **30.0.2 to 35.x** |
| Platform tools          | **33.x**           |
| Android tools           | up to **35.x**     |
| NDK                     | **r21 to r22b**    |

All from `android/package.json`. A component newer than its range produces a
warning from `ti info` rather than an error, and the build usually works until
it does not. Pin build tools with
`ti config android.buildTools.selectedVersion` when a new one breaks.

The NDK is only needed if you build native code. A missing NDK is a warning,
not a problem.

## iOS

| Component                 | Supported        |
| ------------------------- | ---------------- |
| Xcode                     | **15.0 to 26.x** |
| iOS SDK                   | **17.0 to 26.x** |
| Minimum deployment target | **iOS 15.0**     |

From `iphone/package.json`. A newer Xcode is reported as too new and builds
anyway; when a build fails in a way that makes no sense, rule that out early.

The deployment target is the floor your app can run on, so a simulator older
than iOS 15.0 cannot run what 13.4 builds.

## Operating systems

iOS builds require macOS, because Xcode is macOS-only and Xcode compiles, signs
and installs iOS apps. Android builds work on macOS, Windows and Linux. See
[environment setup](/docs/setup).

## Checking your machine

```sh
ti info
```

It reports what it found and what is out of range, which is faster than
comparing this page against your installation, and it is right about the SDK
you actually have.

## Platform API support

Which Titanium APIs exist on which platform, and since which release, is
recorded per type in the [Titanium API](/docs/sdk) - every property, method and
event carries its platforms and its `since` version. That is generated from the
SDK, so it is complete and current in a way a hand-written table could not be.
