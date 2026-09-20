---
name: domain-baseline
description: Govern project-local domain capability reuse through the Human2AI Domain Baseline. Use before adding or changing domain behavior, session or capture workflows, application services, route-repository pairs, stable business schemas or error codes, or when extracting, merging, or intentionally duplicating similar business implementations. Do not use for UI-only, localization-only, dependency, build, or formatting changes.
---

# Domain Baseline

Prevent multiple sources of truth for the same business responsibility while
preserving differences that belong to distinct domains.

## Required workflow

1. Read `governance/baselines.json` and
   `governance/domain-baseline/README.md`. Treat the baseline location from the
   manifest as authoritative.
2. Inspect the requested behavior, callers, existing routes, repositories,
   domain operations, schemas, error codes, and relevant tests before editing.
   Search the actual code with `rg` using operation names, input constraints,
   error codes, and likely callers. A registry miss does not establish that a
   capability is absent. Compare overlapping responsibilities by invariants,
   lifecycle, and failure behavior, including small responsibilities inside a
   larger domain-specific workflow.
3. Search the baseline through its query interface. Start with the likely
   category or a semantic search, then load a full record only when relevant:

   ```bash
   node scripts/domain-baseline.mjs list --category <category>
   node scripts/domain-baseline.mjs search <term>
   node scripts/domain-baseline.mjs get <capability-id>
   ```

4. Classify the change before implementation:
   - reuse a `shared` capability when its responsibility and invariants match;
   - extend an allowed variation through an explicit adapter;
   - register or update a `candidate` when repeated implementations have the
     same invariants and lifecycle but no canonical implementation yet;
   - keep the behavior `local` when its invariant owner is domain-specific;
   - record an exception when duplication is intentional and name the concrete
     condition that should trigger another review.

   A `local` workflow may contain a reusable sub-capability; classify that
   smaller responsibility separately when evidence supports it.
5. State which implementations were compared, what will be reused, important
   variation points, and why any independent implementation remains. Stop and
   ask the user if ownership or invariant compatibility remains ambiguous and
   choosing incorrectly would materially change the design.
6. Add or update contract tests before changing a shared invariant or extracting
   a candidate. Keep domain-specific tests with their owning domain.
   Add every new shared consumer to the relevant contract matrix. For known
   shared boundaries, verify that adapters actually delegate to the canonical
   implementation; an import alone does not prove reuse.
7. Implement the smallest shared boundary that removes the duplicated business
   rule. Preserve domain names and types behind adapters; do not create a broad
   base repository, generic service framework, or configuration system merely
   because code has a similar shape.
8. Update `governance/domain-baseline/registry.json` when responsibility,
   invariants, implementations, consumers, evidence, status, or exceptions change,
   in the same change as the code and tests. For ordinary reuse with none of
   those changes, record the decision in the change description without editing
   the registry. Increment `contractVersion` only when an invariant or externally
   observable business contract changes. Put executable tests in `contractTests`
   and manual evidence, such as Storybook stories, in `reviewEvidence`.
9. Run `npm run domain-baseline:check`, `npm run domain-baseline:test`, the
   relevant domain-specific tests, and the appropriate typecheck. Fix every
   baseline failure rather than weakening the record or inventing an exception.
10. Report the capability decision, changed baseline records, retained domain
    differences, and verification results.

## Boundaries

- Match semantic responsibility, invariants, lifecycle, and failure behavior;
  line-level similarity is only a discovery signal.
- Automated gates cover declared capabilities and known delegation boundaries.
  Code search and review remain necessary to discover new semantic duplication.
- Keep UI assets in their YisiUI governance authority and product naming in the
  i18n semantic authority. Follow their separate mandatory workflows when a task
  spans those concerns.
- The registry is governance metadata. Never import it into product runtime code.
- Do not move or shard the registry until its size or merge-conflict rate creates
  a demonstrated problem. Use the query script so a later storage change does
  not alter this workflow.
