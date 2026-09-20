# Domain Baseline

The Domain Baseline records project-local business capabilities so new work can
reuse an existing responsibility and its invariants instead of creating another
implementation by accident. It is governance metadata, not runtime configuration;
product code must not load `registry.json`.

## Registry model

- `category` is the first-level reading boundary. The registry stays in one file
  until its size or merge-conflict rate justifies category shards.
- `id` is stable and begins with its category, such as
  `capture.draft-versioning`.
- `contractVersion` changes only when an invariant or externally observable
  business contract changes. Moving code without changing behavior does not bump
  it.
- `implementations` records the current, canonical, or adapter code locations.
  Adapters identify their consumer. A shared capability may have canonical
  implementations at several layers; an independent `current` implementation
  must identify a consumer with an explicit exception.
- `contractTests` records executable tests that prove the declared invariants,
  matching `test/**/*.test.ts` or `web/**/*.test.ts` in `vitest.config.ts`.
- Optional `reviewEvidence` records manual evidence, such as Storybook stories.
  These files are checked for existence but are not executed by this gate.

## Status lifecycle

- `local`: the capability is intentionally owned by one domain.
- `candidate`: multiple implementations may share a responsibility, but the
  common boundary has not been approved and extracted yet.
- `shared`: a canonical implementation exists and new consumers must reuse it.
- `deprecated`: no new consumer may adopt the capability while it is removed or
  replaced.

Structural similarity alone is not evidence for sharing. A capability becomes
shared only when its business invariants and lifecycle match and its domain-specific
variation can stay behind explicit adapters.

A local workflow can contain a smaller reusable responsibility. Compare and
register that sub-capability independently when its invariants match elsewhere.

## Changes

Update the registry when responsibility, invariants, implementations, consumers,
evidence, status, or exceptions change, alongside the affected code and tests.
Ordinary reuse that changes none of these needs only a decision in the change
description. Before editing business behavior, use the `$domain-baseline` Skill
to search by category or meaning and classify the work as reuse, extension,
candidate extraction, local behavior, or an intentional exception.

Search the actual code as well as the registry: an empty registry search does not
prove that no existing implementation exists. Record the implementations compared,
the shared rule, variation points, and the reason for any retained independence.

Use the stable query interface instead of loading the complete registry:

```bash
node scripts/domain-baseline.mjs categories
node scripts/domain-baseline.mjs list --category capture
node scripts/domain-baseline.mjs get capture.draft-versioning
node scripts/domain-baseline.mjs search revision
node scripts/domain-baseline.mjs tests
npm run domain-baseline:check
npm run domain-baseline:test
```

`tests` prints the deduplicated gate test list: governance checks, known shared
delegation boundaries, and every `shared` capability's contract tests. `test`
runs that list with Vitest and propagates failures. CI also runs the server
typecheck. Add new shared consumers to their capability's contract matrix.

These checks guard declared capabilities and known delegation boundaries. They
cannot discover every new semantic duplicate; code search and review provide
that part of the workflow.

If classification later becomes necessary on disk, split `registry.json` by
category and update only `scripts/domain-baseline.mjs`; keep the commands and
record shape stable.
