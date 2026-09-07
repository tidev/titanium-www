---
title: tiapp.xml
description: Every element in the project's configuration file, and what reads it.
since: 13.4.0
---

`tiapp.xml` is the app's identity and configuration. Both platforms read it,
and the build merges parts of it into the native manifests.

`ti project` edits it from a script; anything else is a text editor.

## Identity

```xml
<ti:app xmlns:ti="http://ti.tidev.io">
  <id>com.example.hello</id>
  <name>Hello</name>
  <version>1.0</version>
  <guid>f0391a5d-2689-47cf-a6aa-df0f849fbe50</guid>
  <publisher>Example Ltd</publisher>
  <url>https://example.com</url>
  <description>A note taking app.</description>
  <copyright>2026 Example Ltd</copyright>
  <icon>appicon.png</icon>
</ti:app>
```

| Element                                        | What it controls                                       |
| ---------------------------------------------- | ------------------------------------------------------ |
| `id`                                           | Android package name and iOS bundle identifier         |
| `name`                                         | The name under the icon                                |
| `version`                                      | The version shown in the stores                        |
| `guid`                                         | Generated per project; how tooling recognises this app |
| `icon`                                         | Icon filename. Android's launcher icon overrides this  |
| `publisher`, `url`, `description`, `copyright` | Metadata. Not shown in either store                    |

> [!IMPORTANT]
> Changing `id` after publishing means a **new listing** in both stores rather
> than an update. Set it to a domain you control when you create the project.

`guid` is generated per project. Copying a `tiapp.xml` from another app carries
its guid along, so change it when you do that.

## What gets built

```xml
<sdk-version>13.4.1.GA</sdk-version>
<deployment-targets>
  <target device="android">true</target>
  <target device="iphone">true</target>
  <target device="ipad">false</target>
</deployment-targets>
```

`sdk-version` pins which installed SDK builds the project, and `--sdk`
overrides it for one build. A project without it uses the newest installed,
which means two machines can build the same commit differently.

`deployment-targets` is which platforms and device families are built. Turning
`ipad` off is what `--platforms iphone` does at creation.

## Runtime properties

```xml
<property name="ti.ui.defaultunit" type="string">dp</property>
<property name="run-on-main-thread" type="bool">true</property>
<property name="apiRoot" type="string">https://example.com/api</property>
```

Anything here is readable at runtime through `Ti.App.Properties`, and
`ti.ui.defaultunit` is the one that matters most: it decides what a bare number
means in a layout. `ti create` writes `dp`.

`type` is `string`, `bool`, `int` or `double`, and a property with the wrong
type read with the wrong getter returns the default rather than converting.

## Modules and plugins

```xml
<modules>
  <module platform="android" version="5.7.0">ti.map</module>
  <module platform="iphone">ti.map</module>
</modules>

<plugins>
  <plugin version="1.0">ti.alloy</plugin>
</plugins>
```

A module on disk that is not listed here is not built in, and the failure is a
`require` returning nothing. `ti.alloy` in `plugins` is what makes a project an
Alloy project; `alloy new` adds it.

## iOS

`<ios><plist>` takes `Info.plist` keys verbatim, which is where permission
strings and orientations go:

```xml
<ios>
  <use-app-thinning>true</use-app-thinning>
  <enable-launch-screen-storyboard>true</enable-launch-screen-storyboard>
  <min-ios-ver>15.0</min-ios-ver>
  <plist>
    <dict>
      <key>NSCameraUsageDescription</key>
      <string>Attach a photo to a note.</string>
      <key>UISupportedInterfaceOrientations~iphone</key>
      <array>
        <string>UIInterfaceOrientationPortrait</string>
      </array>
    </dict>
  </plist>
</ios>
```

A missing usage string is an App Store rejection and, before that, a permission
dialog that never appears. See [media](/docs/build/media).

## Android

`<android><manifest>` takes `AndroidManifest.xml` fragments, merged into the
generated manifest:

```xml
<android xmlns:android="http://schemas.android.com/apk/res/android">
  <manifest android:versionCode="1">
    <uses-permission android:name="android.permission.CAMERA"/>
    <application android:icon="@mipmap/ic_launcher"/>
  </manifest>
  <tool-api-level>36</tool-api-level>
</android>
```

`android:versionCode` is the integer Google Play orders releases by, and it has
to increase on every upload. `version` above is the human one; these are
separate numbers and both matter.

## Other elements

| Element         | What                               |
| --------------- | ---------------------------------- |
| `fullscreen`    | Hide the status bar                |
| `navbar-hidden` | Hide the title bar                 |
| `analytics`     | Whether the SDK's analytics are on |
| `transpile`     | Whether JS is transpiled           |
| `sourcemaps`    | Emit source maps                   |

## Next

[Compatibility](/docs/reference/compatibility) covers which toolchain versions
a given SDK works with.
