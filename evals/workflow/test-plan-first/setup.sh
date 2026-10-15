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
git checkout -q feature/demo
mkdir -p .ai/slices/01
cat > .ai/state.json <<'JSON'
{"schemaVersion":"1.0","project":"demo-api","status":"IMPLEMENTING","featureBranch":"feature/demo","baseBranch":"main","protectedBranches":["main","master"],"activeSlice":"01","sliceBranch":"feature/demo-slice-01","brainstormBreadth":0}
JSON
cat > .ai/PROJECT.md <<'MD'
> 🤖 AGENT FILE. Illustrative eval fixture.
# Project: demo-api rate limiting
Status: IMPLEMENTING
MD
cat > .ai/INVARIANTS.md <<'MD'
> 🤖 AGENT FILE. Illustrative eval fixture.
- INV-1: /health always answers 200.
MD
cat > .ai/ARCHITECTURE.md <<'MD'
> 🤖 AGENT FILE. Illustrative eval fixture.
Single handler module in src/server.js; the limiter lives in src/limiter.js.
MD
cat > .ai/slices/01/SLICE.md <<'MD'
> 🤖 AGENT FILE. Illustrative eval fixture.
# Slice 01: fixed-window rate limiter
## Objective
Add a fixed-window limiter (default 60 requests per minute per client id) and answer 429 when it is exceeded.
## Acceptance criteria
- AC1: the 61st request from one client within a minute gets status 429.
- AC2: /health is never limited.
## Expected touch set — code
- src/limiter.js
- src/server.js
## Expected touch set — tests
- tests/limiter.test.js
## Branch
feature/demo-slice-01
MD
cat > .ai/slices/01/TEST_PLAN.md <<'MD'
> 🤖 AGENT FILE. Illustrative eval fixture.
Status: DRAFT
| AC | Planned test | Level |
|---|---|---|
| AC1 | tests/limiter.test.js: 61st request → 429 | unit |
| AC2 | tests/limiter.test.js: /health never limited | unit |
MD
printf '.ai/slices/*/findings/\n.ai/returns/\n' > .gitignore
git add -A
git commit -q -m "plan: slice 01 approved"
git checkout -q -b feature/demo-slice-01
