import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadMeta, workflowSource, loadRegistry } from './harness.mjs';

const WORKFLOWS = ['discover', 'plan', 'slice'];

for (const name of WORKFLOWS) {
  test(`${name}: meta is a pure literal with name, description, whenToUse and phases`, () => {
    const src = workflowSource(name);
    assert.ok(src.startsWith('export const meta = {'), 'meta must be the first statement');
    const meta = loadMeta(name);
    assert.equal(meta.name, name);
    assert.equal(typeof meta.description, 'string');
    assert.equal(typeof meta.whenToUse, 'string');
    assert.ok(Array.isArray(meta.phases) && meta.phases.length > 0);
    for (const p of meta.phases) assert.ok(p.title && p.detail);
    const literal = /^export const meta = (\{[\s\S]*?\n\});/m.exec(src)[1];
    const code = literal.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    assert.doesNotMatch(code, /`|\.\.\.|\(/, 'meta must not use template strings, spreads or calls');
    assert.doesNotMatch(code, /:\s*[A-Za-z_$][\w$]*\s*[,}\n]/, 'meta values must be literals, not variables');
  });

  test(`${name}: meta.phases titles equal the phase() titles used`, () => {
    const src = workflowSource(name);
    const used = new Set([...src.matchAll(/\b(?:enter|phase)\('([^']+)'\)/g)].map((m) => m[1]));
    const declared = new Set(loadMeta(name).phases.map((p) => p.title));
    assert.deepEqual([...used].sort(), [...declared].sort());
    assert.match(src, /function enter\(title\) \{\n {2}currentPhase = title;\n {2}phase\(title\);/);
  });

  test(`${name}: plain JavaScript with no forbidden APIs`, () => {
    const body = workflowSource(name);
    assert.doesNotMatch(body, /Date\.now\(|Math\.random\(|new Date\(\)|\brequire\(|^import |\bprocess\.|\bfs\./m);
    assert.doesNotMatch(body, /shipyard:(?!coordinator)[a-z-]+/, 'agent names come from the registry, not the script');
  });
}

test('every role used by the workflows exists in the registry', () => {
  const reg = loadRegistry();
  for (const name of WORKFLOWS) {
    const src = workflowSource(name);
    for (const m of src.matchAll(/call\('([a-z-]+)'/g)) assert.ok(reg.roles[m[1]], `${name}: role ${m[1]}`);
  }
});
