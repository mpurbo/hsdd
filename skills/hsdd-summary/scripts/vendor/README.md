# Vendored layout engine

`dagre.min.js` is `@dagrejs/dagre` 3.1.1, the file `package/dist/dagre.min.js`
from <https://registry.npmjs.org/@dagrejs/dagre/-/dagre-3.1.1.tgz>: 48,956
bytes, sha256 `3152d214941a5df3a3d4c079dfa338c3cd7a6c0d4c1b4c3a2fdb6bba6f6facf9`.
It is MIT licensed; `LICENSE` and `dagre.min.js.LEGAL.txt` beside it are the
package's own notices, copied unchanged.

`summary.mjs render` inlines it into every page, so diagrams lay out with no
network, no build step and no viewer. Never edit it. A new version is a new
download with a new pin, here and in `test/vendor.test.mjs`.

To re-verify: `shasum -a 256 skills/hsdd-summary/scripts/vendor/dagre.min.js` must print the hash above, and `node --test test/vendor.test.mjs` must pass.
