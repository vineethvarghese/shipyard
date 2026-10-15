import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflow, reviewer, architect, planner, goldfish, finding, sliceDefaults } from './harness.mjs';

const NO_FLAGS = { publicContract: false, consumerVisible: false, concurrency: false, security: false, config: false };

function defaults() {
  return Object.assign(sliceDefaults(), {
    'architect|CRITIQUE': architect({ mode: 'CRITIQUE', verdict: 'SOUND' }),
    'architect|DRAFT': architect({ mode: 'DRAFT', verdict: 'SOUND' }),
    'planner|PLAN': planner({ slices: 2 }),
    'planner|REPLAN': planner({ mode: 'REPLAN', slices: 2 }),
    'goldfish|READINESS': goldfish({ mode: 'READINESS', lens: 'readiness', readiness: 'READY' }),
  });
}

async function runPlan(args, script = {}, extra = {}) {
  const run = await runWorkflow('plan', { planFlags: NO_FLAGS, cycle: 0, answers: { G1: '60s' }, ...args }, script, { ...defaults(), ...extra });
  assert.deepEqual(run.errors, [], run.errors.join('\n'));
  return run;
}

const critique = (run) => run.calls.filter((c) => c.phase === 'Critique').map((c) => c.key).sort();

test('happy path → AWAITING_PLAN_APPROVAL with slices 01..NN', async () => {
  const run = await runPlan({});
  assert.equal(run.result.status, 'AWAITING_PLAN_APPROVAL');
  assert.deepEqual(run.result.slices, ['01', '02']);
  assert.deepEqual(run.result.readiness.map((r) => r.readiness), ['READY', 'READY']);
  assert.deepEqual(critique(run), ['architect|CRITIQUE', 'simplicity-reviewer|PLAN']);
  const plan = run.calls.find((c) => c.key === 'planner|PLAN');
  assert.match(plan.prompt, /two-digit sequential slice ids 01\.\.NN/);
  const ready = run.calls.filter((c) => c.key === 'goldfish|READINESS');
  assert.deepEqual(ready.map((c) => /^Read: (.*)$/m.exec(c.prompt)[1]), ['.ai/slices/01/SLICE.md', '.ai/slices/02/SLICE.md']);
  const integ = run.calls.find((c) => c.key === 'integration-reviewer|PLAN' && c.phase === 'Delivery plan');
  assert.match(integ.prompt, /Sequencing and mergeability only/);
  const arch = run.calls.find((c) => c.key === 'architect|CRITIQUE' && c.phase === 'Delivery plan');
  assert.match(arch.prompt, /Intermediate states only/);
  assert.equal(integ.batch, arch.batch);
  assert.equal(ready[0].batch, integ.batch);
  const simp = run.calls.find((c) => c.key === 'simplicity-reviewer|PLAN');
  assert.match(simp.prompt, /At most 15 findings/);
  assert.match(simp.prompt, /^Write: \.ai\/planning\/simplicity-reviewer\.md$/m);
  assert.match(simp.prompt, /60s/);
});

test('plan routes security when planFlags.security', async () => {
  const run = await runPlan({ planFlags: { ...NO_FLAGS, security: true } });
  assert.deepEqual(critique(run), ['architect|CRITIQUE', 'security-reviewer|PLAN', 'simplicity-reviewer|PLAN']);
  assert.ok(run.result.reviewersRouted.some((r) => r.role === 'security-review' && /security=true/.test(r.because)));
  assert.ok(run.result.reviewersNotRouted.some((r) => r.role === 'contract-review'));
});

test('absent or uncertain plan flags → route', async () => {
  const run = await runPlan({ planFlags: { concurrency: 'unsure' } });
  assert.deepEqual(critique(run), [
    'architect|CRITIQUE', 'contract-reviewer|PLAN', 'integration-reviewer|PLAN', 'reliability-reviewer|PLAN', 'security-reviewer|PLAN', 'simplicity-reviewer|PLAN',
  ]);
});

test('human input requested in critique → NEEDS_HUMAN, no delivery planning', async () => {
  const hir = { question: 'Keep the old API?', evidence: 'CONSUMERS.md', recommendation: 'yes', blocked: 'migration order' };
  const run = await runPlan({}, { 'simplicity-reviewer|PLAN': [reviewer({ mode: 'PLAN', humanInputRequested: hir })] });
  assert.equal(run.result.status, 'NEEDS_HUMAN');
  assert.equal(run.result.humanInputRequests[0].question, 'Keep the old API?');
  assert.equal(run.calls.filter((c) => c.key.startsWith('planner')).length, 0);
});

test('open findings → architect DRAFT then only the reporting reviewer rechecks', async () => {
  const f = finding({ id: 'simp-001', severity: 'MAJOR', location: '.ai/ARCHITECTURE.md', category: 'abstraction' });
  const run = await runPlan({}, {
    'simplicity-reviewer|PLAN': [reviewer({ mode: 'PLAN', findings: [f] })],
    'simplicity-reviewer|RECHECK': [reviewer({ mode: 'RECHECK', findings: [{ ...f, status: 'FIXED' }] })],
  });
  assert.equal(run.result.status, 'AWAITING_PLAN_APPROVAL');
  const refine = run.calls.filter((c) => c.phase === 'Refine').map((c) => c.key);
  assert.deepEqual(refine, ['architect|DRAFT', 'simplicity-reviewer|RECHECK']);
  assert.match(run.calls.find((c) => c.key === 'architect|DRAFT').prompt, /simp-001/);
});

test('findings still open after the refine cap → NEEDS_HUMAN with them', async () => {
  const f = finding({ id: 'simp-001', severity: 'MINOR', location: '.ai/ARCHITECTURE.md', category: 'abstraction' });
  const run = await runPlan({}, {}, {
    'simplicity-reviewer|PLAN': reviewer({ mode: 'PLAN', findings: [f] }),
    'simplicity-reviewer|RECHECK': reviewer({ mode: 'RECHECK', findings: [f] }),
  });
  assert.equal(run.result.status, 'NEEDS_HUMAN');
  assert.equal(run.result.openFindings.length, 1);
  assert.equal(run.calls.filter((c) => c.key === 'architect|DRAFT').length, 2);
  assert.equal(run.result.cyclesUsed, 2);
});

test('refine cap counts across launches: cycle 1 leaves one refine cycle, cycle 2 none', async () => {
  const f = finding({ id: 'simp-001', severity: 'MINOR', location: '.ai/ARCHITECTURE.md', category: 'abstraction' });
  const extra = {
    'simplicity-reviewer|PLAN': reviewer({ mode: 'PLAN', findings: [f] }),
    'simplicity-reviewer|RECHECK': reviewer({ mode: 'RECHECK', findings: [f] }),
  };
  const one = await runPlan({ cycle: 1 }, {}, extra);
  assert.equal(one.calls.filter((c) => c.key === 'architect|DRAFT').length, 1);
  assert.equal(one.result.cyclesUsed, 2);
  const none = await runPlan({ cycle: 2 }, {}, extra);
  assert.equal(none.result.status, 'NEEDS_HUMAN');
  assert.equal(none.calls.filter((c) => c.key === 'architect|DRAFT').length, 0);
});

test('NOT_READY slice → one REPLAN, then that slice is rechecked once', async () => {
  const notReady = goldfish({ mode: 'READINESS', lens: 'readiness', readiness: 'NOT_READY', questions: ['Which table holds prices?'] });
  const run = await runPlan({}, { 'goldfish|READINESS': [goldfish({ mode: 'READINESS', lens: 'readiness', readiness: 'READY' }), notReady] });
  assert.equal(run.result.status, 'AWAITING_PLAN_APPROVAL');
  const replan = run.calls.find((c) => c.key === 'planner|REPLAN');
  assert.match(replan.prompt, /Which table holds prices\?/);
  const ready = run.calls.filter((c) => c.key === 'goldfish|READINESS');
  assert.equal(ready.length, 3);
  assert.match(ready[2].prompt, /\.ai\/slices\/02\/SLICE\.md/);
});

test('still NOT_READY after the replan → NEEDS_HUMAN', async () => {
  const notReady = goldfish({ mode: 'READINESS', lens: 'readiness', readiness: 'NOT_READY', questions: ['Which table?'] });
  const run = await runPlan({}, {}, { 'goldfish|READINESS': notReady });
  assert.equal(run.result.status, 'NEEDS_HUMAN');
  assert.equal(run.calls.filter((c) => c.key === 'planner|REPLAN').length, 1);
  assert.ok(run.result.humanInputRequests.some((h) => h.question === 'Which table?'));
});

test('planner null after retry → BLOCKED', async () => {
  const run = await runPlan({}, { 'planner|PLAN': [null, null] });
  assert.equal(run.result.status, 'BLOCKED');
  assert.match(run.result.reason, /planner PLAN/);
});

test('an open plan finding left out of a recheck stays OPEN', async () => {
  const f = finding({ id: 'simp-001', severity: 'MINOR', location: '.ai/ARCHITECTURE.md', category: 'abstraction' });
  const run = await runPlan({}, {}, {
    'simplicity-reviewer|PLAN': reviewer({ mode: 'PLAN', findings: [f] }),
    'simplicity-reviewer|RECHECK': reviewer({ mode: 'RECHECK', findings: [] }),
  });
  assert.equal(run.result.status, 'NEEDS_HUMAN');
  assert.equal(run.result.openFindings[0].id, 'simp-001');
});
