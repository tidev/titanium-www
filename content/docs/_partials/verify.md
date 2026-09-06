## Check the toolchain

```sh
ti info
```

`ti info` lists everything it found, then the problems it hit. A working setup
reports none.

Warnings are common and usually harmless — a component newer than the SDK
supports produces one, and so does a missing NDK. When something is wrong,
`ti info` names it and says what to do.
