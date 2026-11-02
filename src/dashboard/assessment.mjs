import crypto from 'node:crypto';

export function initialize(repository, at = new Date().toISOString()) {
  repository.lifecycle ??= { firstSeenAt: at, updatedAt: at, unchangedSince: at, deliveredAt: null, dismissedAt: null };
  repository.case ??= { findings: '', diagnosis: '', report: '', cure: '', nonfixable: '', finalReport: '', owner: '', priority: 'unassigned', target: '' };
  repository.estimates ??= {};
  repository.history ??= [];
  repository.procedures ??= [];
  return repository;
}

export function changed(repository, reason, at = new Date().toISOString()) {
  initialize(repository, at);
  repository.lifecycle.updatedAt = at;
  repository.lifecycle.unchangedSince = at;
  repository.lifecycle.deliveredAt = null;
  repository.lifecycle.dismissedAt = null;
  repository.history.push({ at, reason });
}

export function observe(repository, result) {
  initialize(repository, result.at);
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({
    measured: result.measured, hasGit: result.hasGit, state: result.state, commands: result.commands,
    recoveryEvidence: result.recoveryEvidence,
  })).digest('hex');
  if (repository.observationFingerprint !== fingerprint) changed(repository, 'Examination changed', result.at);
  repository.observationFingerprint = fingerprint;
  if (!repository.case.findings) repository.case.findings = result.measured.rubric.map(item =>
    `${item.pass ? 'Present' : 'Not observed'}: ${item.label}`).join('\n');
  if (!repository.case.diagnosis) repository.case.diagnosis = result.state.replaceAll('-', ' ');
  if (!repository.case.report) repository.case.report = 'Local examination only. Remote completeness and unknown lost work have not been assessed.';
}

function number(value, name, max = 100) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    throw new Error(`${name} must be a finite percentage from 0 to ${max}.`);
  }
  return value;
}

export function updateCase(repository, input, at = new Date().toISOString()) {
  initialize(repository);
  if (input.type === 'notes') {
    for (const key of Object.keys(repository.case)) {
      if (typeof input[key] !== 'string' || input[key].length > 8000) throw new Error(`${key} must be text of at most 8000 characters.`);
    }
    if (!['unassigned', 'P0', 'P1', 'P2', 'P3'].includes(input.priority)) throw new Error('Invalid priority.');
    repository.case = Object.fromEntries(Object.keys(repository.case).map(key => [key, input[key]]));
    changed(repository, 'Case notes updated', at);
  } else if (input.type === 'estimates') {
    if (!repository.records.inspection) throw new Error('Examine the repository before estimating.');
    if (!['potential', 'current'].includes(input.pair)) throw new Error('Select potential or current estimate.');
    if (typeof input.rationale !== 'string' || !input.rationale.trim() || input.rationale.length > 8000) throw new Error('Explain the estimate rationale (1-8000 characters).');
    const prior = repository.estimates[input.pair];
    const record = {
      condition: number(input.condition, 'Condition'),
      quality: number(input.quality, 'Relational optimal recovery', 1000),
      confidence: number(input.confidence, 'Confidence'),
      rationale: input.rationale,
      at,
      examinationAt: repository.records.inspection.at,
      source: 'reviewer',
    };
    if (prior) repository.history.push({ at, reason: 'Previous estimate', pair: input.pair, estimate: prior });
    repository.estimates[input.pair] = record;
    changed(repository, `${input.pair} estimate reviewed`, at);
  } else if (input.type === 'procedure-rating') {
    const procedure = repository.procedures.find(item => item.id === input.procedureId);
    if (!procedure) throw new Error('Unknown procedure.');
    const helpingFactor = number(input.helpingFactor, 'Helping factor');
    if (typeof input.rationale !== 'string' || !input.rationale.trim() || input.rationale.length > 8000) throw new Error('Explain the helping factor (1-8000 characters).');
    if (procedure.helpingFactor !== null && procedure.helpingFactor !== undefined) repository.history.push({
      at, reason: 'Previous procedure rating', procedureId: procedure.id, helpingFactor: procedure.helpingFactor,
      rationale: procedure.rationale, ratedAt: procedure.ratedAt,
    });
    procedure.helpingFactor = helpingFactor;
    procedure.rationale = input.rationale;
    procedure.ratedAt = at;
    changed(repository, 'Procedure helping factor reviewed', at);
  } else if (input.type === 'deliver' || input.type === 'dismiss') {
    if (!repository.case.finalReport.trim()) throw new Error('A final report is required for delivery or dismissal.');
    if (input.type === 'deliver' && !repository.records.recovery) throw new Error('Validate recovery before marking delivered.');
    if (input.type === 'deliver' && !repository.records.recovery.acceptance) throw new Error('Review and record the recovery target and remaining limitations before delivery.');
    repository.lifecycle.updatedAt = at;
    repository.lifecycle[input.type === 'deliver' ? 'deliveredAt' : 'dismissedAt'] = at;
    repository.lifecycle[input.type === 'deliver' ? 'dismissedAt' : 'deliveredAt'] = null;
    repository.history.push({ at, reason: input.type });
  } else throw new Error('Unknown case update.');
}

export function estimatePairs(repository) {
  const inspection = repository.records.inspection;
  const quality = repository.records.quality;
  const recovery = repository.records.recovery;
  const confidence = [inspection, repository.records.preservation, repository.records.integrity?.passed, quality?.passed, recovery].filter(Boolean).length * 20;
  const make = (pair, automatic) => {
    const review = repository.estimates?.[pair];
    const value = review || automatic;
    if (!value) return { condition: null, quality: null, confidence: null, recovery: null, at: null, source: 'unexamined' };
    return {
      ...value,
      recovery: value.condition === null || value.quality === null ? null : Number((value.condition * value.quality / 100).toFixed(2)),
      stale: Boolean(review && review.examinationAt !== inspection?.at),
      formula: 'condition × relational recovery / 100; confidence is not multiplied in',
    };
  };
  const inspectionFailed = inspection?.commands.some(command => command.exitCode !== 0 || command.error);
  return {
    potential: make('potential', inspection ? {
      condition: inspectionFailed ? null : inspection.conditionScore,
      quality: inspection.measured.staticScore, confidence, at: inspection.at,
      examinationAt: inspection.at, source: 'rule-based potential', rationale: 'Static signals; not yet verified recovery quality.',
    } : null),
    current: make('current', inspection ? {
      condition: inspectionFailed ? null : inspection.conditionScore,
      quality: quality?.score ?? null, confidence, at: quality?.at || inspection.at,
      examinationAt: inspection.at, source: 'measured estimate', rationale: 'Limited local checks; subjective interpretation remains necessary.',
    } : null),
    retention: recovery ? { value: recovery.recoveryScore, at: recovery.at } : null,
  };
}

export function lifecycleView(repository, now = Date.now()) {
  initialize(repository);
  const life = repository.lifecycle;
  const end = life.deliveredAt || life.dismissedAt;
  return {
    ...life,
    unchangedMs: Math.max(0, now - Date.parse(life.unchangedSince)),
    totalStayMs: Math.max(0, (end ? Date.parse(end) : now) - Date.parse(life.firstSeenAt)),
    status: life.dismissedAt ? 'dismissed' : life.deliveredAt ? 'delivered' : repository.records.inspection?.state || 'awaiting-examination',
  };
}
