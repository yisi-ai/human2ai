---
name: yisiui-propose-component
description: Decouple a proven project-local UI component into a self-contained candidate bundle, validate it in the consumer, and submit the complete immutable bundle to private YisiUI for review.
---

Resolve all paths from `.yisiui/config.json`: `applicationRoot`, `surfaceRoot` (legacy default `design-system/surfaces/<surface>`), `vendorRoot`, `localRegistry`, and `storybook.applicationRoot` (legacy default `storybook`). Use `packageManager` (legacy default `npm`) for installation and workspace builds. Invoke `node .yisiui/launcher.mjs` from the consumer root, or the configured `commandScript`; existing product `yisiui:*` commands may belong to WeChat and must retain their purpose. Never reset configured directories during sync.

# YisiUI Propose Component

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, the synchronized shared Registry, the local Registry, the component implementation, Stories, tests, and real product usage. Query relevant assets with `node .yisiui/launcher.mjs query`; first decide whether reuse, composition, or an existing variant or slot already covers the responsibility.

A proposal may be created only after the consumer has completed decoupling. Keep product APIs, routes, persistence, domain types, fixed product copy, private tokens, project package imports, and business-state ownership in the product adapter. The candidate public contract may use only props, callbacks and slots, shared YisiUI imports, React, and dependencies already available in the synchronized YisiUI stack.

Submitting a candidate does not change Storybook ownership. Keep the product-hosted local and review Stories under the exact configured `<project>/...` root until upstream adoption and synchronization. The standalone decoupled bundle keeps neutral metadata under the rules below and must not claim a reserved `yisiui-` group before adoption; do not copy the product namespace into that neutral bundle just to match its product-hosted review wrapper.

Build a self-contained candidate below `<surfaceRoot>/candidates/<id>`. Keep implementation and styles under `src`, and include at least one deterministic `*.stories.tsx` and one focused `*.test.tsx` or `*.spec.tsx`. Stories and tests must import the candidate through relative paths, not through the product UI package; use framework-neutral `@storybook/react` types instead of a consumer-specific Storybook framework package. Do not place `node_modules`, generated output, symlinks, product fixtures, or unrelated files in the candidate directory.

Candidate Stories should demonstrate the complete component in meaningfully different states or uses. Put isolated regression assertions in the focused tests or relevant `play` checks of a representative Story; do not export a separate Story for each minor fix. Remove passing temporary reproduction Stories and their exclusive helpers/references before preparing the bundle, while retaining its required representative Story and useful regression coverage.

After the bundle is ready, generate its schema-v2 proposal from the consumer root:

`node .yisiui/launcher.mjs propose --id <id> --source-file <surfaceRoot>/candidates/<id>/src/<Component>.tsx --name <name> --capabilities <a,b> --similar <a,b> --difference <summary> --use-when <a,b> --do-not-use-when <a,b> --decoupled [--slots <a,b>] [--dependencies <a,b>]`

Run `node .yisiui/launcher.mjs proposal validate --id <id>` before committing. This validation requires source, Story and test roles, verifies every relative import stays inside the bundle, restricts external imports to declared YisiUI-available dependencies, rejects the consumer project identifier, and checks the four explicit decoupling assertions. Also run the relevant product typecheck, focused tests and Storybook checks. Commit the proposal and every candidate file together with the product adapter changes that prove the boundary.

Submit that immutable Git revision with `node .yisiui/launcher.mjs proposal submit --id <id> [--submitted-by <name>]`. The command repeats validation and atomically copies the complete candidate directory into the private YisiUI intake revision with origin project, sanitized remote, branch, commit, submitter attribution, file roles and hashes. The attribution is not authenticated unless the repository or CI layer separately enforces identity. Use `node .yisiui/launcher.mjs proposal list [--id <id>] [--origin-project <project>] [--status <status>]` to confirm receipt.

Do not edit synchronized vendor files, remove the local implementation, or claim promotion or release. Submission does not modify the shared Registry or lifecycle. YisiUI must be able to review the copied snapshot without opening this consumer checkout; review may reject the bundle but must not depend on rewriting product coupling. After YisiUI accepts and publishes an experimental release, pull it back, switch the product adapter to the synchronized shared copy, verify real usage, and only then remove duplicate local candidate code with explicit user approval.
