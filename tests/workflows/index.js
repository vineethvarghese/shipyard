// Lets `node --test tests/workflows/` work on Node 22: Node resolves the directory to this file, which loads
// every *.test.mjs beside it. `node --test tests/workflows/*.test.mjs` runs the same tests directly.
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

for (const f of readdirSync(__dirname).filter((n) => n.endsWith('.test.mjs')).sort()) {
  import(pathToFileURL(join(__dirname, f)).href);
}
