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
REMOTE="$(mktemp -d)/origin.git"
git init -q --bare "$REMOTE"
git remote add origin "$REMOTE"
git checkout -q feature/demo
mkdir -p .ai/slices/01
cat > .ai/state.json <<'JSON'
{"schemaVersion":"1.0","project":"demo-api","status":"IMPLEMENTING","featureBranch":"feature/demo","baseBranch":"main","protectedBranches":["main","master"],"activeSlice":null,"sliceBranch":null,"brainstormBreadth":0}
JSON
cat > .ai/PROJECT.md <<'MD'
> 🤖 AGENT FILE. Illustrative eval fixture.
# Project: demo-api health details
Status: IMPLEMENTING
## Delivery parameters
- C-8 feature branch: feature/demo, base branch: main (SPECIFIED)
## Phase log
| Phase | Result |
|---|---|
| P8 | plan approved by the human |
| P9.9 | slice 01 merged |
| P10 | reconcile: UNCHANGED |
MD
cat > .ai/DELIVERY_PLAN.md <<'MD'
> 🤖 AGENT FILE. Illustrative eval fixture.
# Delivery plan
| Slice | Title | State | Branch |
|---|---|---|---|
| 01 | Health endpoint body | MERGED | feature/demo-slice-01 |
All slices are MERGED. Reconciliation after slice 01: UNCHANGED.
MD
printf '.ai/slices/*/findings/\n.ai/returns/\n' > .gitignore
git add -A
git commit -q -m "slice 01: .ai state"
