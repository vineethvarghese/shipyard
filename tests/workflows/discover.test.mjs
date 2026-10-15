import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow, discovery, goldfish, architect } from './harness.mjs';

const REQUEST = 'Add a read-through cache in front of the pricing service so list pages stop timing out.';
const CONSTRAINTS = 'C-1 slice budget: ~400 lines. C-3 reuse posture: reuse first. C-9 cost budget: medium.';

function defaults() {
  return {
    'discovery|SCAN': discovery('SCAN', { artifactsWritten: ['.ai/planning/discovery.md'] }),
    'discovery|SYNTHESIZE': discovery('SYNTHESIZE', {
      artifactsWritten: ['.ai/planning/concepts.md'],
      topConcepts: [{ title: 'Read-through cache', summary: 'cache in the client', lensesThatProposedIt: ['technical'] }],
      disagreements: ['contrarian: fix the slow query instead'],
      gaps: [{ id: 'G1', question: 'TTL?', whyItMatters: 'staleness', evidence: 'pricing.js:40', options: ['60s', '5m'], recommendation: '60s', blocking: true }],
    }),
    'discovery|DRAFT': discovery('DRAFT', { artifactsWritten: ['.ai/PROJECT.md', '.ai/CONSUMERS.md'] }),
    'architect|DRAFT': architect({ mode: 'DRAFT', verdict: 'SOUND' }),
    'discovery|QUESTIONS': discovery('QUESTIONS', {
      artifactsWritten: ['.ai/planning/open-questions.md'],
      gaps: [{ id: 'G1', question: 'TTL?', whyItMatters: 'staleness', evidence: 'pricing.js:40', options: ['60s', '5m'], recommendation: '60s', blocking: true }],
      highestLeverageQuestion: 'TTL?',
    }),
    'goldfish|BRAINSTORM': (prompt) => {
      const lens = /^Lens: (\S+)$/m.exec(prompt)[1];
      return goldfish({ lens, concepts: [{ title: `${lens} idea`, summary: 's', why: 'w', risks: 'r', relativeSize: 'S' }] });
    },
  };
}

async function runDiscover(args, script = {}) {
  const run = await runWorkflow('discover', { request: REQUEST, constraints: CONSTRAINTS, ...args }, script, defaults());
  assert.deepEqual(run.errors, [], run.errors.join('\n'));
  return run;
}

test('breadth 1 → 3 goldfish whose briefs contain only the request and the lens', async () => {
  const run = await runDiscover({ breadth: 1 });
  assert.equal(run.result.status, 'NEEDS_HUMAN');
  const fish = run.calls.filter((c) => c.key === 'goldfish|BRAINSTORM');
  assert.equal(fish.length, 3);
  assert.deepEqual(fish.map((c) => /^Lens: (\S+)$/m.exec(c.prompt)[1]), ['technical', 'value', 'contrarian']);
  assert.equal(new Set(fish.map((c) => c.batch)).size, 1);
  for (const c of fish) {
    assert.ok(c.prompt.includes(REQUEST));
    assert.doesNotMatch(c.prompt, /C-1|C-3|reuse posture/);
    assert.doesNotMatch(c.prompt, /discovery\.md|concepts\.md|elephant/i);
    assert.doesNotMatch(c.prompt, /^Read:/m);
    // only header lines + lens + request
    const body = c.prompt.split('\n\n').slice(1).join('\n\n').trim();
    assert.equal(body, `Lens: ${/^Lens: (\S+)$/m.exec(c.prompt)[1]}\n\nRequest (verbatim):\n${REQUEST}`);
    assert.match(c.prompt, /^Caller: shipyard:coordinator\nMode: BRAINSTORM\n/);
  }
  const scan = run.calls.find((c) => c.key === 'discovery|SCAN');
  assert.match(scan.prompt, /sealed elephant take/i);
  assert.match(scan.prompt, /\.ai\/planning\/concepts\.md/);
  const synth = run.calls.find((c) => c.key === 'discovery|SYNTHESIZE');
  assert.match(synth.prompt, /"lens": "contrarian"/);
  assert.ok(synth.index > Math.max(...fish.map((f) => f.index)));
  assert.equal(run.result.topConcepts.length, 1);
  assert.equal(run.result.gaps[0].id, 'G1');
  assert.ok(run.result.questions.length >= 1);
  assert.ok(run.result.artifacts.includes('.ai/planning/concepts.md'));
  assert.deepEqual(keys(run).filter((k) => !k.startsWith('goldfish')), ['discovery|SCAN', 'discovery|SYNTHESIZE', 'discovery|DRAFT', 'architect|DRAFT', 'discovery|QUESTIONS']);
});

function keys(run) {
  return run.calls.map((c) => c.key);
}

test('breadth 0 skips goldfish and synthesis', async () => {
  const run = await runDiscover({ breadth: 0 });
  assert.equal(run.result.status, 'NEEDS_HUMAN');
  assert.equal(run.calls.filter((c) => c.key.startsWith('goldfish')).length, 0);
  assert.deepEqual(keys(run), ['discovery|SCAN', 'discovery|DRAFT', 'architect|DRAFT', 'discovery|QUESTIONS']);
  assert.ok(!run.phases.includes('Brainstorm'));
  const scan = run.calls.find((c) => c.key === 'discovery|SCAN');
  assert.doesNotMatch(scan.prompt, /sealed elephant take into/i);
});

test('breadth 2 → five lenses then one outsider told only the cluster titles', async () => {
  const run = await runDiscover({ breadth: 2 });
  const fish = run.calls.filter((c) => c.key === 'goldfish|BRAINSTORM');
  assert.equal(fish.length, 6);
  const outsider = fish[5];
  assert.match(outsider.prompt, /^Lens: outsider$/m);
  assert.match(outsider.prompt, /- technical idea/);
  assert.match(outsider.prompt, /OUTSIDE/);
  assert.ok(outsider.prompt.includes(REQUEST));
  assert.doesNotMatch(outsider.prompt, /C-1/);
  assert.ok(outsider.index > Math.max(...fish.slice(0, 5).map((f) => f.index)));
});

test('a required step null after retry → BLOCKED with reason', async () => {
  const run = await runDiscover({ breadth: 0 }, { 'architect|DRAFT': [null, null] });
  assert.equal(run.result.status, 'BLOCKED');
  assert.match(run.result.reason, /architect DRAFT/);
  assert.equal(run.calls.filter((c) => c.key === 'discovery|QUESTIONS').length, 0);
});

test('a goldfish null after retry → BLOCKED', async () => {
  const run = await runDiscover({ breadth: 1 }, { 'goldfish|BRAINSTORM': [null] });
  // first goldfish slot gets null, its retry gets the default → continues
  assert.equal(run.result.status, 'NEEDS_HUMAN');
  const run2 = await runDiscover({ breadth: 1 }, { 'goldfish|BRAINSTORM': [null, null, null, null, null, null] });
  assert.equal(run2.result.status, 'BLOCKED');
  assert.match(run2.result.reason, /goldfish/);
});

test('discovery runs STANDARD for SCAN and DEEP for SYNTHESIZE', async () => {
  const run = await runDiscover({ breadth: 1 });
  const scan = run.calls.find((c) => c.key === 'discovery|SCAN');
  const synth = run.calls.find((c) => c.key === 'discovery|SYNTHESIZE');
  assert.deepEqual([scan.opts.model, scan.opts.effort], ['sonnet', 'medium']);
  assert.deepEqual([synth.opts.model, synth.opts.effort], ['opus', 'high']);
  assert.equal(scan.opts.agentType, 'shipyard:discovery');
});

test('breadth defaults to 1 when absent; an invalid breadth fails loudly', async () => {
  const run = await runDiscover({ breadth: undefined });
  assert.equal(run.calls.filter((c) => c.key === 'goldfish|BRAINSTORM').length, 3);
  for (const bad of ['1', 3, -1]) {
    await assert.rejects(runWorkflow('discover', { request: 'x', breadth: bad }, {}, {}), /breadth must be 0, 1 or 2/);
  }
});
