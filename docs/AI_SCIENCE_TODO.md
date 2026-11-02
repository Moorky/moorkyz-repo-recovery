# AI science MVP — experiment TODO

This is a roadmap, not an implemented model runner. The fun medical metaphor
describes repository cases; it is not medical advice or a trademark assertion.
Current saved case estimates are local rubrics/reviewer judgements, not AI
benchmark scores. No instant scores, model rankings or business-effect claims.

- [ ] Declare testing environments: OS/runtime/tool versions, immutable fixture
  identity, independent disposable copies, permissions, network access and seeds.
  Record actual environment and source hashes with every run.
- [ ] Define controlled medicine/procedure attribute variants (scope, inputs,
  ordering, safety gates). Change one attribute at a time against the same
  baseline; record approvals and failures, never run against surviving originals.
- [ ] Compare report styles (concise triage, evidence-first narrative, structured
  findings) with predefined accuracy, usefulness and uncertainty criteria.
- [ ] Vary report length, input/context-window budgets and quotas separately.
  Record requested and actual token use, truncation, limits, latency, cost,
  retries and quota failures. Keep model/provider versions fixed per comparison.
- [ ] Evaluate AI models on **actual test runs** with recorded model/version,
  configuration, prompts, evidence inputs, raw outputs and timestamps. Include
  failed and incomplete runs; missing evidence stays unknown.
- [ ] Design independent model scores: held-out cases, predefined scoring rubric,
  blinded independent review, repeated runs, disagreement and uncertainty.
  Keep these scores separate from local condition, confidence, relational
  recovery, retention and subjective procedure helping factors.
- [ ] Produce a reproducible experiment report: baseline/control, variants,
  environments, sample size, exclusions, results, limitations and reviewer.
  Require actual independent evidence before publishing comparisons or claims.

Implementation of this runner, provider integrations and expanded evaluation is
deferred. First agree on fixture safety, consent/privacy, quotas and independent
review. Do not send private repository evidence to AI providers automatically.
