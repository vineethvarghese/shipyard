export const meta = {
  name: 'discover',
  description: 'Shipyard P1-P3: scan the repository, run the elephant/goldfish brainstorm, draft the planning artifacts and the P4 questions.',
  whenToUse: 'Launched by shipyard:coordinator after the P0 gate. args: {registry, contracts, request (verbatim), breadth (0|1|2), constraints (C-1..C-9 text)}. Returns NEEDS_HUMAN with concepts, gaps and questions for the P4 gate, or BLOCKED with a reason.',
  phases: [
    { title: 'Scan', detail: 'discovery SCAN records repository facts; with a brainstorm it also seals the elephant take in concepts.md.' },
    { title: 'Brainstorm', detail: 'one goldfish per lens in parallel (verbatim request + lens only), an outsider sweep at breadth 2, then discovery SYNTHESIZE.' },
    { title: 'Draft', detail: 'discovery DRAFT, architect DRAFT, then discovery QUESTIONS for the P4 gate.' },
  ],
};

// ---------------------------------------------------------------------------------------------
// Shared helpers (role-driven: everything comes from args.registry and args.contracts)
// ---------------------------------------------------------------------------------------------
const A = args || {};
const REG = A.registry;
const CONTRACTS = A.contracts;
if (!REG || !REG.roles || !REG.computeClasses) throw new Error('discover: args.registry (parsed registry/roles.json) is required');
if (!CONTRACTS || typeof CONTRACTS !== 'object') throw new Error('discover: args.contracts (contracts keyed by file stem) is required');

const LIMITS = REG.limits || {};
const RETRIES = Number.isInteger(LIMITS.reviewerRetries) ? LIMITS.reviewerRetries : 1;
const STRIP_KEYS = ['$schema', '$id', 'title', 'description', 'x-contract-version'];
const BUDGET = { SCAN: 40, BRAINSTORM: 20, SYNTHESIZE: 30, DRAFT: 40, QUESTIONS: 20 };

let currentPhase = null;
function enter(title) {
  currentPhase = title;
  phase(title);
}

function role(name) {
  const r = REG.roles[name];
  if (!r) throw new Error(`discover: role '${name}' is not in the registry`);
  return r;
}

function compute(roleName, mode) {
  const cls = (role(roleName).modes || {})[mode];
  if (!cls) throw new Error(`discover: role '${roleName}' has no mode '${mode}' in the registry`);
  const c = REG.computeClasses[cls];
  if (!c) throw new Error(`discover: compute class '${cls}' (role '${roleName}', mode '${mode}') is not defined`);
  return { model: c.model, effort: c.effort };
}

function contractRefFor(roleName, mode) {
  const r = role(roleName);
  if (r.contracts && r.contracts[mode]) return r.contracts[mode];
  if (r.contract) return r.contract;
  throw new Error(`discover: role '${roleName}' has no contract for mode '${mode}'`);
}

function schemaFor(contractRef) {
  const m = /^([A-Za-z0-9_-]+)@(\d+)$/.exec(String(contractRef || ''));
  if (!m) throw new Error(`discover: bad contract reference '${contractRef}' (expected '<stem>@<major>')`);
  const stem = m[1];
  const wanted = Number(m[2]);
  const s = CONTRACTS[stem];
  if (!s || typeof s !== 'object') throw new Error(`discover: contract '${stem}' missing from args.contracts`);
  const version = String(s['x-contract-version'] || '');
  const major = Number(version.split('.')[0]);
  if (!version || major !== wanted) {
    throw new Error(`discover: contract '${stem}' major version mismatch: registry wants ${wanted}, schema is '${version || 'unversioned'}'`);
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
// Inputs
// ---------------------------------------------------------------------------------------------
const REQUEST = typeof A.request === 'string' ? A.request : '';
if (!REQUEST.trim()) throw new Error('discover: args.request (the verbatim request) is required');
// Brainstorm breadth: 0 (none), 1 (default: three lenses) or 2 (five lenses plus an outsider sweep).
if (A.breadth != null && A.breadth !== 0 && A.breadth !== 1 && A.breadth !== 2) throw new Error(`discover: args.breadth must be 0, 1 or 2, got '${A.breadth}'`);
const BREADTH = A.breadth == null ? 1 : A.breadth;
const CONSTRAINTS = typeof A.constraints === 'string' ? A.constraints : json(A.constraints || {});

const DISCOVERY_MD = '.ai/planning/discovery.md';
const CONCEPTS_MD = '.ai/planning/concepts.md';
const artifacts = [];
const humanInputRequests = [];

function collect(who, res) {
  if (!res) return;
  for (const p of res.artifactsWritten || []) if (artifacts.indexOf(p) === -1) artifacts.push(p);
  if (res.humanInputRequested) humanInputRequests.push(Object.assign({ from: who }, res.humanInputRequested));
}

function blocked(reason, extra) {
  log(`discover: BLOCKED — ${reason}`);
  return Object.assign({ status: 'BLOCKED', topConcepts: [], gaps: [], questions: humanInputRequests.slice(), artifacts, reason }, extra || {});
}

function goldfishBrief(lens, extraText) {
  // ONLY the verbatim request and the lens: no constraints, no discovery notes, no elephant take.
  return {
    budgetTurns: BUDGET.BRAINSTORM,
    text: `Lens: ${lens}\n\nRequest (verbatim):\n${REQUEST}${extraText ? `\n\n${extraText}` : ''}`,
  };
}

// ---------------------------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------------------------
async function main() {
  // P1 Scan
  enter('Scan');
  const scan = await call('discovery', 'SCAN', {
    read: ['.ai/PROJECT.md', '.ai/state.json'], write: DISCOVERY_MD, budgetTurns: BUDGET.SCAN,
    text: `Scan the repository and record facts with assumption labels in ${DISCOVERY_MD}: build and test commands (run them when cheap), conventions, consumers, validation tiers (LOCAL or SHARED).` +
      (BREADTH > 0
        ? ` Before you return, write your sealed elephant take on the request into ${CONCEPTS_MD} under "## Sealed elephant take": your own concepts, written before any goldfish runs. Do not edit that section later.`
        : ' Brainstorm breadth is 0: no goldfish will run, so do not write concepts.md.') +
      `\n\nRequest (verbatim):\n${REQUEST}\n\nDelivery constraints (P0):\n${CONSTRAINTS}\n\nBrainstorm breadth: ${BREADTH}`,
  }, 'discovery SCAN');
  if (!scan) return blocked('discovery SCAN returned no valid result after retry');
  collect('discovery', scan);

  // P2 Brainstorm & narrow
  let synth = null;
  if (BREADTH > 0) {
    enter('Brainstorm');
    const lenses = ((role('goldfish').lenses || {})[String(BREADTH)]) || [];
    if (!lenses.length) return blocked(`registry has no goldfish lenses for breadth ${BREADTH}`);
    log(`discover: ${lenses.length} goldfish: ${lenses.join(', ')}`);
    const wave = await parallel(lenses.map((lens) => () => call('goldfish', 'BRAINSTORM', goldfishBrief(lens), `goldfish BRAINSTORM ${lens}`)));
    const missing = lenses.filter((l, i) => !wave[i]);
    if (missing.length) return blocked(`goldfish returned no valid result after retry for lens(es): ${missing.join(', ')}`);
    const outputs = lenses.map((lens, i) => Object.assign({}, wave[i], { lens }));

    if (BREADTH === 2) {
      const titles = [];
      for (const o of outputs) for (const c of o.concepts || []) if (titles.indexOf(c.title) === -1) titles.push(c.title);
      const outsider = await call('goldfish', 'BRAINSTORM', goldfishBrief('outsider',
        `Concept clusters already proposed (titles only):\n${titles.map((t) => `- ${t}`).join('\n') || '- (none)'}\n\nPropose concepts that fall OUTSIDE all of these clusters, including "much smaller or nothing".`),
        'goldfish BRAINSTORM outsider');
      if (!outsider) return blocked('outsider goldfish returned no valid result after retry');
      outputs.push(Object.assign({}, outsider, { lens: 'outsider' }));
    }

    synth = await call('discovery', 'SYNTHESIZE', {
      read: [DISCOVERY_MD, CONCEPTS_MD, '.ai/PROJECT.md'], write: CONCEPTS_MD, budgetTurns: BUDGET.SYNTHESIZE,
      text: `Cluster and rank the goldfish concepts below against the delivery constraints and the repository facts. Flag every goldfish-vs-elephant disagreement; do not average them away. Keep the sealed elephant take unchanged. Write the concepts brief (clusters, top 3, disagreements, open questions) and then the gap list G1..Gn into ${CONCEPTS_MD}.\n\nDelivery constraints (P0):\n${CONSTRAINTS}\n\nGoldfish outputs (JSON):\n${json(outputs)}`,
    }, 'discovery SYNTHESIZE');
    if (!synth) return blocked('discovery SYNTHESIZE returned no valid result after retry');
    collect('discovery', synth);
  }

  // P3 Draft
  enter('Draft');
  const draft = await call('discovery', 'DRAFT', {
    read: [DISCOVERY_MD].concat(BREADTH > 0 ? [CONCEPTS_MD] : []).concat(['.ai/PROJECT.md']),
    write: ['.ai/PROJECT.md', '.ai/CONSUMERS.md', '.ai/planning/assumptions.md', '.ai/planning/open-questions.md'],
    budgetTurns: BUDGET.DRAFT,
    text: `Draft the planning artifacts for the request from the repository facts${BREADTH > 0 ? ' and the concepts brief' : ''}. Do not pick a concept for the human; mark choices that depend on the P4 answers as UNRESOLVED.${BREADTH > 0 ? '' : ` No brainstorm ran: write the gap list G1..Gn into ${CONCEPTS_MD}.`}\n\nRequest (verbatim):\n${REQUEST}\n\nDelivery constraints (P0):\n${CONSTRAINTS}`,
  }, 'discovery DRAFT');
  if (!draft) return blocked('discovery DRAFT returned no valid result after retry');
  collect('discovery', draft);

  const arch = await call('architect', 'DRAFT', {
    read: ['.ai/PROJECT.md', DISCOVERY_MD, '.ai/CONSUMERS.md'].concat(BREADTH > 0 ? [CONCEPTS_MD] : []),
    write: ['.ai/ARCHITECTURE.md', '.ai/INVARIANTS.md'], budgetTurns: BUDGET.DRAFT,
    text: 'Draft the current and target architecture and the invariants every slice must preserve. Challenge each new abstraction. Mark design choices that wait on the P4 answers as UNRESOLVED.',
  }, 'architect DRAFT');
  if (!arch) return blocked('architect DRAFT returned no valid result after retry');
  if (arch.humanInputRequested) humanInputRequests.push(Object.assign({ from: 'architect' }, arch.humanInputRequested));
  if (arch.decisionRecord && artifacts.indexOf(arch.decisionRecord) === -1) artifacts.push(arch.decisionRecord);
  for (const p of ['.ai/ARCHITECTURE.md', '.ai/INVARIANTS.md']) if (artifacts.indexOf(p) === -1) artifacts.push(p);

  const questions = await call('discovery', 'QUESTIONS', {
    read: ['.ai/PROJECT.md', '.ai/ARCHITECTURE.md', '.ai/INVARIANTS.md', DISCOVERY_MD].concat([CONCEPTS_MD]),
    write: '.ai/planning/open-questions.md', budgetTurns: BUDGET.QUESTIONS,
    text: 'Draft the P4 questions for the human: the concept pick (when a brainstorm ran) and only the gaps that change the plan. One batched turn. Each gap: why it matters, evidence, options and a recommendation. Name the highest-leverage question.',
  }, 'discovery QUESTIONS');
  if (!questions) return blocked('discovery QUESTIONS returned no valid result after retry');
  collect('discovery', questions);

  const gaps = (questions.gaps && questions.gaps.length ? questions.gaps : (synth && synth.gaps) || []);
  const topConcepts = (synth && synth.topConcepts) || [];
  const qList = gaps.map((g) => ({ id: g.id, question: g.question, options: g.options, recommendation: g.recommendation, blocking: g.blocking }));
  if (questions.highestLeverageQuestion && !qList.some((q) => q.question === questions.highestLeverageQuestion)) {
    qList.unshift({ id: 'HL', question: questions.highestLeverageQuestion, options: [], recommendation: '', blocking: true });
  }
  for (const h of humanInputRequests) qList.push({ id: `HIR-${h.from}`, question: h.question, options: [], recommendation: h.recommendation, blocking: true });

  log(`discover: ${topConcepts.length} top concept(s), ${gaps.length} gap(s), ${qList.length} question(s) for P4`);
  return {
    status: 'NEEDS_HUMAN',
    topConcepts,
    gaps,
    questions: qList,
    artifacts,
    disagreements: (synth && synth.disagreements) || [],
    reason: `P4 questions ready (breadth ${BREADTH}); the human picks a concept and answers the gaps`,
  };
}

return await main();
