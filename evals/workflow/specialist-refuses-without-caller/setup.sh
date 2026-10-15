#!/usr/bin/env bash
# Scaffold for a Shipyard process eval. Runs in the empty eval workspace (needs `claude plugin eval . --scaffold`).
set -euo pipefail
git init -q -b main .
git config user.email "eval@example.invalid"
git config user.name "Shipyard Eval"
git config commit.gpgsign false
mkdir -p src tests
cat > package.json <<'JSON'
{ "name": "demo-api", "version": "0.1.0", "private": true, "type": "module", "scripts": { "test": "node --test tests/" } }
JSON
cat > src/server.js <<'JS'
export function handle(req) {
  if (req.path === '/health') return { status: 200, body: 'ok' };
  return { status: 404, body: 'not found' };
}
JS
cat > tests/server.test.js <<'JS'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle } from '../src/server.js';
test('health', () => assert.equal(handle({ path: '/health' }).status, 200));
JS
cat > README.md <<'MD'
# demo-api

A tiny HTTP handler. Run `npm test`.
MD
git add -A
git commit -q -m "initial"
git branch feature/demo
