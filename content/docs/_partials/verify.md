## Verify Titanium is Ready

```sh
ti info
```

`ti info` lists everything it detected and any issues it found. A working setup
reports none.

Warnings are common and usually harmless: a component newer than the SDK
supports produces one, and so does a missing NDK. When something is wrong,
`ti info` names it and says what to do.
