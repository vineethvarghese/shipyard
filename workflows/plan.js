export const meta = {
  name: 'plan',
  description: 'Shipyard P5-P7: routed plan critique, capped refinement, delivery planning with sequencing checks and one cold readiness goldfish per slice.',
  whenToUse: 'Launched by shipyard:coordinator after the P4 answers are recorded. args: {registry, contracts, planFlags {publicContract, consumerVisible, concurrency, security, config} (absent or non-boolean = uncertain = route), cycle (refine cycles already used by earlier launches; 0 on the first), answers}. Returns AWAITING_PLAN_APPROVAL, NEEDS_HUMAN (back to P4) or BLOCKED.',
  phases: [
    { title: 'Critique', detail: 'routed plan reviewers in parallel on the raw planning artifacts (architect and simplicity always).' },
    { title: 'Refine', detail: 'architect updates the artifacts for open findings; only reviewers with open findings recheck; capped cycles.' },
    { title: 'Delivery plan', detail: 'planner slices the work; integration and architect check sequencing; one readiness goldfish per SLICE.md; one replan.' },
  ],
};

// ---------------------------------------------------------------------------------------------
// Shared helpers (role-driven: everything comes from args.registry and args.contracts)
// ---------------------------------------------------------------------------------------------
const A = args || {};
const REG = A.registry;
const CONTRACTS = A.contracts;
if (!REG || !REG.roles || !REG.computeClasses) throw new Error('plan: args.registry (parsed registry/roles.json) is required');
if (!CONTRACTS || typeof CONTRACTS !== 'object') throw new Error('plan: args.contracts (contracts keyed by file stem) is required');

const LIMITS = REG.limits || {};
const RETRIES = Number.isInteger(LIMITS.reviewerRetries) ? LIMITS.reviewerRetries : 1;
const SEVERITIES = ['BLOCKING', 'MAJOR', 'MINOR', 'NOTE'];
const FIX_SCOPE = Array.isArray(REG.fixScope) ? REG.fixScope : ['BLOCKING', 'MAJOR', 'MINOR'];
const STRIP_KEYS = ['$schema', '$id', 'title', 'description', 'x-contract-version'];
const BUDGET = { PLAN: 40, RECHECK: 25, DRAFT: 40, CRITIQUE: 30, PLANNER: 60, READINESS: 15 };

let currentPhase = null;
function enter(title) {
  currentPhase = title;
  phase(title);
}

function role(name) {
  const r = REG.roles[name];
  if (!r) throw new Error(`plan: role '${name}' is not in the registry`);
  return r;
}

function shortName(roleName) {
  return String(role(roleName).agent).replace(/^.*:/, '');
}

function compute(roleName, mode) {
  const cls = (role(roleName).modes || {})[mode];
  if (!cls) throw new Error(`plan: role '${roleName}' has no mode '${mode}' in the registry`);
  const c = REG.computeClasses[cls];
  if (!c) throw new Error(`plan: compute class '${cls}' (role '${roleName}', mode '${mode}') is not defined`);
  return { model: c.model, effort: c.effort };
}

function contractRefFor(roleName, mode) {
  const r = role(roleName);
  if (r.contracts && r.contracts[mode]) return r.contracts[mode];
  if (r.contract) return r.contract;
  throw new Error(`plan: role '${roleName}' has no contract for mode '${mode}'`);
}

function schemaFor(contractRef) {
  const m = /^([A-Za-z0-9_-]+)@(\d+)$/.exec(String(contractRef || ''));
  if (!m) throw new Error(`plan: bad contract reference '${contractRef}' (expected '<stem>@<major>')`);
  const stem = m[1];
  const wanted = Number(m[2]);
  const s = CONTRACTS[stem];
  if (!s || typeof s !== 'object') throw new Error(`plan: contract '${stem}' missing from args.contracts`);
  const version = String(s['x-contract-version'] || '');
  const major = Number(version.split('.')[0]);
  if (!version || major !== wanted) {
    throw new Error(`plan: contract '${stem}' major version mismatch: registry wants ${wanted}, schema is '${version || 'unversioned'}'`);
  }
  const out = {};
  for (const k of Object.keys(s)) if (STRIP_KEYS.indexOf(k) === -1) out[k] = s[k];
  return out;
}

function brief(b) {
  const lines = ['Caller: shipyard:coordinator', `Mode: ${b.mode}`];
  if (b.slice != null) lines.push(`Slice: ${b.slice}`);
  if (b.round != null) lines.push(`Round: ${b.round}`);
  if (b.featureBranch) lines.push(`Feature-branch: ${b.featureBranch}`);
  if (b.sliceBranch) lines.push(`Slice-branch: ${b.sliceBranch}`);
  if (b.diff) lines.push(`Diff: ${b.diff === true ? `git diff ${b.featureBranch}...${b.sliceBranch}` : b.diff}`);
  if (b.read && b.read.length) lines.push(`Read: ${b.read.join(', ')}`);
  if (b.write) lines.push(`Write: ${Array.isArray(b.write) ? b.write.join(', ') : b.write}`);
  if (b.budgetTurns) lines.push(`Budget: ${b.budgetTurns} turns`);
  return lines.join('\n') + (b.text ? `\n\n${b.text}` : '') + '\n';
}

async function call(roleName, mode, briefObj, label, contractRef) {
  const r = role(roleName);
  const c = compute(roleName, mode);
  const schema = schemaFor(contractRef || contractRefFor(roleName, mode));
  const prompt = brief(Object.assign({}, briefObj, { mode }));
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    let res = null;
    try {
      res = await agent(prompt, {
        agentType: r.agent, model: c.model, effort: c.effort, schema,
        label: attempt === 0 ? label : `${label} (retry ${attempt})`, phase: currentPhase,
      });
    } catch (e) {
      res = null;
    }
    if (res != null && typeof res === 'object') return res;
    log(`${label}: no valid result${attempt < RETRIES ? '; retrying' : '; giving up'}`);
  }
  return null;
}

function json(x) {
  return JSON.stringify(x, null, 2);
}

// ---------------------------------------------------------------------------------------------
// Findings
// ---------------------------------------------------------------------------------------------
function sevRank(s) {
  const i = SEVERITIES.indexOf(s);
  return i === -1 ? SEVERITIES.length : i;
}

function keyOf(f) {
  return `${String(f.location || '').trim().toLowerCase()}|${String(f.category || '').trim().toLowerCase()}`;
}

function dedupe(list) {
  const groups = {};
  const order = [];
  for (const f of list) {
    const k = keyOf(f);
    if (!groups[k]) {
      groups[k] = [];
      order.push(k);
    }
    groups[k].push(f);
  }
  const out = [];
  for (const k of order) {
    const g = groups[k].slice().sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
    const top = Object.assign({}, g[0]);
    const reporters = [];
    for (const f of g) for (const r of f.reporters || []) if (reporters.indexOf(r) === -1) reporters.push(r);
    top.reporters = reporters;
    top.status = g.some((f) => f.status === 'OPEN') ? 'OPEN' : g[0].status;
    out.push(top);
  }
  out.sort((a, b) => sevRank(a.severity) - sevRank(b.severity) || String(a.id).localeCompare(String(b.id)));
  return out;
}

function isOpen(f) {
  return f.status === 'OPEN' && FIX_SCOPE.indexOf(f.severity) !== -1;
}

// ---------------------------------------------------------------------------------------------
// Inputs and state
// ---------------------------------------------------------------------------------------------
const FLAGS = A.planFlags && typeof A.planFlags === 'object' ? A.planFlags : {};
// Refine cycles already used by earlier launches of this workflow (0 on the first launch). The cap
// (registry.limits.planRefineCycles) counts across launches, so a relaunch after NEEDS_HUMAN gets only what is left.
const CYCLE = Number.isInteger(A.cycle) && A.cycle >= 0 ? A.cycle : 0;
let cyclesUsed = CYCLE; // returned so the coordinator relaunches with the right count
const ANSWERS = A.answers == null ? null : (typeof A.answers === 'string' ? A.answers : json(A.answers));
const PLANNING_READ = ['.ai/PROJECT.md', '.ai/ARCHITECTURE.md', '.ai/INVARIANTS.md', '.ai/CONSUMERS.md', '.ai/planning/discovery.md', '.ai/planning/concepts.md', '.ai/planning/open-questions.md'];
const DELIVERY_PLAN = '.ai/DELIVERY_PLAN.md';
const CAP = LIMITS.findingsCapPerReviewer || 15;

const byReviewer = {};
const humanInputRequests = [];
const routedList = [];
const notRoutedList = [];
let slices = [];
let readiness = [];

function noteHuman(who, res) {
  if (res && res.humanInputRequested) humanInputRequests.push(Object.assign({ from: who }, res.humanInputRequested));
}

function currentFindings() {
  const all = [];
  for (const r of Object.keys(byReviewer)) for (const f of byReviewer[r]) all.push(f);
  return dedupe(all);
}

function done(status, reason, extra) {
  log(`plan: ${status} — ${reason}`);
  return Object.assign({
    status, slices, readiness, findings: currentFindings(), humanInputRequests, reason, cyclesUsed,
    reviewersRouted: routedList, reviewersNotRouted: notRoutedList,
  }, extra || {});
}

// Plan reviewers use Mode PLAN; a role without a PLAN mode (the architect) critiques with CRITIQUE.
function planMode(roleName, wanted) {
  const modes = role(roleName).modes || {};
  if (modes[wanted]) return wanted;
  if (modes.CRITIQUE) return 'CRITIQUE';
  throw new Error(`plan: role '${roleName}' has neither mode ${wanted} nor CRITIQUE`);
}

function routePlan() {
  for (const rule of (REG.routing && REG.routing.plan) || []) {
    const hits = [];
    for (const w of rule.when || []) {
      if (w === 'always') hits.push('always');
      else if (FLAGS[w] === true) hits.push(`${w}=true`);
      else if (FLAGS[w] !== false) hits.push(`${w}=uncertain`);
    }
    if (hits.length) routedList.push({ role: rule.role, because: hits.join('; ') });
    else notRoutedList.push({ role: rule.role, because: `no trigger: ${(rule.when || []).map((w) => `${w}=false`).join(', ')}` });
  }
  return routedList.map((r) => r.role);
}

function reviewBrief(roleName, mode, mine, extraText) {
  const answers = ANSWERS ? `\n\nHuman answers recorded at P4 (cycle ${CYCLE}):\n${ANSWERS}` : '';
  const text = mode === 'RECHECK' || (mode === 'CRITIQUE' && mine)
    ? `Recheck your open findings against the updated planning artifacts. Return your full current list: mark resolved findings FIXED, keep unresolved ones OPEN, add only new findings the update introduced (at most ${CAP}).${extraText || ''}\n\nYour open findings:\n${json(mine || [])}`
    : `Critique the plan in your jurisdiction only. At most ${CAP} findings, most serious first; every finding needs evidence and Status: OPEN. Request human input only for a decision the artifacts cannot settle.${extraText || ''}${answers}`;
  return { round: null, read: PLANNING_READ, write: `.ai/planning/${shortName(roleName)}.md`, budgetTurns: mode === 'RECHECK' ? BUDGET.RECHECK : BUDGET.PLAN, text };
}

function normalise(list, roleName) {
  return (Array.isArray(list) ? list : []).map((f) => Object.assign({}, f, { reporters: [roleName] }));
}

async function runReviewers(jobs) {
  const results = await parallel(jobs.map((j) => () => call(j.role, j.mode, reviewBrief(j.role, j.mode, j.mine, j.extra), `${j.role} ${j.mode}`)));
  const failed = jobs.filter((j, i) => !results[i]).map((j) => `${j.role} ${j.mode}`);
  if (failed.length) return `no valid result after retry: ${failed.join(', ')}`;
  jobs.forEach((j, i) => {
    const fresh = normalise(results[i].findings, j.role);
    // A recheck that leaves out an earlier finding does not make it disappear: an open finding the reviewer
    // forgot to list stays OPEN (fail closed), and closed ones stay on the record.
    const ids = fresh.map((f) => f.id);
    const kept = j.mode === 'RECHECK' ? (byReviewer[j.role] || []).filter((f) => ids.indexOf(f.id) === -1) : [];
    byReviewer[j.role] = fresh.concat(kept);
    noteHuman(j.role, results[i]);
  });
  return null;
}

function recheckJobs(roles, extra) {
  const open = currentFindings().filter(isOpen);
  const jobs = [];
  for (const r of roles) {
    const mine = open.filter((f) => f.reporters.indexOf(r) !== -1);
    if (mine.length) jobs.push({ role: r, mode: planMode(r, 'RECHECK'), mine, extra });
  }
  return jobs;
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  // P5 Critique
  enter('Critique');
  const reviewers = routePlan();
  log(`plan: cycle ${CYCLE}; routed ${reviewers.join(', ')}; not routed ${notRoutedList.map((n) => n.role).join(', ') || 'none'}`);
  const err = await runReviewers(reviewers.map((r) => ({ role: r, mode: planMode(r, 'PLAN') })));
  if (err) return done('BLOCKED', `plan critique: ${err}`);

  // P6 Refine
  const maxCycles = Number.isInteger(LIMITS.planRefineCycles) ? LIMITS.planRefineCycles : 2;
  for (let cycle = CYCLE; ; cycle++) {
    if (humanInputRequests.length) return done('NEEDS_HUMAN', `${humanInputRequests.length} human input request(s) from plan review`);
    const open = currentFindings().filter(isOpen);
    if (!open.length) break;
    if (cycle >= maxCycles) return done('NEEDS_HUMAN', `${open.length} plan finding(s) still open after ${cycle} refine cycle(s)`, { openFindings: open });
    enter('Refine');
    cyclesUsed = cycle + 1;
    log(`plan: refine cycle ${cycle + 1}/${maxCycles}, ${open.length} open finding(s)`);
    const upd = await call('architect', 'DRAFT', {
      read: PLANNING_READ, write: ['.ai/ARCHITECTURE.md', '.ai/INVARIANTS.md', '.ai/planning/architect.md'], budgetTurns: BUDGET.DRAFT,
      text: `Update the planning artifacts to resolve the open plan findings below. Where a finding is wrong, say why with evidence in .ai/planning/architect.md instead of changing the plan. Request human input for any decision that changes scope.\n\nOpen findings:\n${json(open)}`,
    }, `architect DRAFT refine ${cycle + 1}`);
    if (!upd) return done('BLOCKED', 'architect DRAFT (refine) returned no valid result after retry');
    noteHuman('architect', upd);
    if (humanInputRequests.length) return done('NEEDS_HUMAN', 'architect requested human input while refining the plan');
    const e2 = await runReviewers(recheckJobs(Object.keys(byReviewer)));
    if (e2) return done('BLOCKED', `plan recheck: ${e2}`);
  }

  // P7 Delivery planning
  enter('Delivery plan');
  const plan = await call('planner', 'PLAN', {
    read: PLANNING_READ, write: [DELIVERY_PLAN, '.ai/slices/*/SLICE.md', '.ai/planning/planner.md'], budgetTurns: BUDGET.PLANNER,
    text: 'Cut the work into thin vertical slices, each independently mergeable into the feature branch. Use two-digit sequential slice ids 01..NN and write each spec to .ai/slices/<NN>/SLICE.md with objective, acceptance criteria, "## Expected touch set — code", "## Expected touch set — tests" and "## Branch". Return the slice count in `slices`.',
  }, 'planner PLAN');
  if (!plan) return done('BLOCKED', 'planner PLAN returned no valid result after retry');
  noteHuman('planner', plan);
  if (plan.humanInputRequested || plan.verdict === 'UNDERSPECIFIED') return done('NEEDS_HUMAN', `planner verdict ${plan.verdict}${plan.humanInputRequested ? ' with a human input request' : ''}`);
  if (!plan.slices || plan.slices < 1) return done('BLOCKED', 'planner returned zero slices');

  const ids = (n) => Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0'));
  slices = ids(plan.slices);
  const deliveryRead = [DELIVERY_PLAN, '.ai/ARCHITECTURE.md', '.ai/INVARIANTS.md'].concat(slices.map((s) => `.ai/slices/${s}/SLICE.md`));

  const readinessCall = (s) => call('goldfish', 'READINESS', {
    read: [`.ai/slices/${s}/SLICE.md`], budgetTurns: BUDGET.READINESS,
    text: `Lens: readiness\n\nRead .ai/slices/${s}/SLICE.md cold. Could a first-time implementer ship this without asking anything? Answer READY or NOT_READY; for NOT_READY list the exact questions they would have to ask.`,
  }, `goldfish READINESS ${s}`);

  const sequencingJobs = [
    { role: 'integration-review', mode: 'PLAN', text: 'Sequencing and mergeability only: can each slice merge into the feature branch on its own, in this order, without breaking consumers?' },
    { role: 'architect', mode: 'CRITIQUE', text: 'Intermediate states only: does the feature branch satisfy every invariant after each slice merges, in this order?' },
  ];
  const seqThunks = sequencingJobs.map((j) => () => call(j.role, j.mode, {
    read: deliveryRead, write: `.ai/planning/${shortName(j.role)}.md`, budgetTurns: BUDGET.CRITIQUE,
    text: `${j.text} At most ${CAP} findings, each with evidence and Status: OPEN.`,
  }, `${j.role} ${j.mode} delivery`));
  const all = await parallel(seqThunks.concat(slices.map((s) => () => readinessCall(s))));
  const seq = all.slice(0, sequencingJobs.length);
  const ready = all.slice(sequencingJobs.length);
  const failed = sequencingJobs.filter((j, i) => !seq[i]).map((j) => j.role).concat(slices.filter((s, i) => !ready[i]).map((s) => `goldfish READINESS ${s}`));
  if (failed.length) return done('BLOCKED', `delivery checks returned no valid result after retry: ${failed.join(', ')}`);

  const deliveryFindings = {};
  sequencingJobs.forEach((j, i) => {
    deliveryFindings[j.role] = normalise(seq[i].findings, j.role);
    noteHuman(j.role, seq[i]);
  });
  readiness = slices.map((s, i) => ({ slice: s, readiness: ready[i].readiness, questions: ready[i].questions || [] }));
  if (humanInputRequests.length) return done('NEEDS_HUMAN', 'human input requested during delivery checks');

  const openSeq = () => dedupe(Object.keys(deliveryFindings).reduce((acc, r) => acc.concat(deliveryFindings[r]), [])).filter(isOpen);
  const notReady = readiness.filter((r) => r.readiness === 'NOT_READY');
  let seqOpen = openSeq();

  if (notReady.length || seqOpen.length) {
    log(`plan: replan once for ${notReady.length} NOT_READY slice(s) and ${seqOpen.length} sequencing finding(s)`);
    const re = await call('planner', 'REPLAN', {
      read: deliveryRead, write: [DELIVERY_PLAN, '.ai/slices/*/SLICE.md', '.ai/planning/planner.md'], budgetTurns: BUDGET.PLANNER,
      text: `Revise the delivery plan once. Answer every readiness question inside the SLICE.md it concerns, and resolve the sequencing findings. Keep two-digit sequential slice ids.\n\nReadiness questions:\n${json(notReady)}\n\nSequencing findings:\n${json(seqOpen)}`,
    }, 'planner REPLAN');
    if (!re) return done('BLOCKED', 'planner REPLAN returned no valid result after retry');
    noteHuman('planner', re);
    if (re.humanInputRequested || re.verdict === 'UNDERSPECIFIED') return done('NEEDS_HUMAN', 'planner needs human input to replan');
    const before = slices.length;
    if (re.slices && re.slices >= 1) slices = ids(re.slices);
    const recheck = notReady.map((r) => r.slice).filter((s) => slices.indexOf(s) !== -1).concat(slices.slice(before));
    const reSeq = sequencingJobs.filter((j) => seqOpen.some((f) => f.reporters.indexOf(j.role) !== -1));
    const reDeliveryRead = [DELIVERY_PLAN, '.ai/ARCHITECTURE.md', '.ai/INVARIANTS.md'].concat(slices.map((s) => `.ai/slices/${s}/SLICE.md`));
    const thunks = reSeq.map((j) => () => call(j.role, j.mode, {
      read: reDeliveryRead, write: `.ai/planning/${shortName(j.role)}.md`, budgetTurns: BUDGET.RECHECK,
      text: `${j.text} Recheck your open findings after the replan; return your full current list (FIXED or OPEN).\n\nYour open findings:\n${json(seqOpen.filter((f) => f.reporters.indexOf(j.role) !== -1))}`,
    }, `${j.role} ${j.mode} delivery recheck`)).concat(recheck.map((s) => () => readinessCall(s)));
    const res2 = await parallel(thunks);
    const seq2 = res2.slice(0, reSeq.length);
    const ready2 = res2.slice(reSeq.length);
    const failed2 = reSeq.filter((j, i) => !seq2[i]).map((j) => j.role).concat(recheck.filter((s, i) => !ready2[i]).map((s) => `goldfish READINESS ${s}`));
    if (failed2.length) return done('BLOCKED', `delivery rechecks returned no valid result after retry: ${failed2.join(', ')}`);
    reSeq.forEach((j, i) => {
      deliveryFindings[j.role] = normalise(seq2[i].findings, j.role);
      noteHuman(j.role, seq2[i]);
    });
    const latest = {};
    for (const r of readiness) latest[r.slice] = r;
    recheck.forEach((s, i) => {
      latest[s] = { slice: s, readiness: ready2[i].readiness, questions: ready2[i].questions || [] };
    });
    readiness = slices.map((s) => latest[s] || { slice: s, readiness: 'NOT_APPLICABLE', questions: [] });
    seqOpen = openSeq();
  }

  for (const r of Object.keys(deliveryFindings)) byReviewer[`${r}:delivery`] = deliveryFindings[r];
  const stillNotReady = readiness.filter((r) => r.readiness === 'NOT_READY');
  if (humanInputRequests.length || stillNotReady.length || seqOpen.length) {
    for (const r of stillNotReady) for (const q of r.questions) humanInputRequests.push({ from: `goldfish READINESS ${r.slice}`, question: q, evidence: `.ai/slices/${r.slice}/SLICE.md`, recommendation: '', blocked: `slice ${r.slice}` });
    return done('NEEDS_HUMAN', `after one replan: ${stillNotReady.length} slice(s) NOT_READY, ${seqOpen.length} sequencing finding(s) open`, { openFindings: seqOpen });
  }
  return done('AWAITING_PLAN_APPROVAL', `${slices.length} slice(s) planned, all READY, no open sequencing findings`);
}

return await main();
