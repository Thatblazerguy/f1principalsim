# Legacy one-off scripts

Old patch, scratch and simulation scripts that used to sit in the project root.
They aren't part of the app or build. They're kept for reference. Several of them
rewrite source files in place (some use hard-coded absolute paths), so read one
before running it.

`package.json` here marks the folder as CommonJS so the `require()`-based
scripts still run now that the root package is `"type": "module"`.
