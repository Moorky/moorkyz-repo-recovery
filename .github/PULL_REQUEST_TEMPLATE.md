## Summary

## Safety invariants

- [ ] Originals are never written; protected actions re-check original and backup hashes
- [ ] Every new write or code execution has a preview and explicit approval
- [ ] No new network contact, dependency, reset/clean/prune/push/deploy path
- [ ] No percentages or probabilities that are not measured

## Evidence

- [ ] `npm test` (paste the summary counts; skipped tests named)
- [ ] `npm run lint`
- [ ] `npm run smoke`
- [ ] New behavior has a happy-path and an adverse-path test on synthetic repositories
- [ ] Documentation updated (README / docs / CHANGELOG)
- [ ] Screenshots use only synthetic data and neutral paths
