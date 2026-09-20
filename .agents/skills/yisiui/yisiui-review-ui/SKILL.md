---
name: yisiui-review-ui
description: Review a product page, component, migration, or release integration against its synchronized YisiUI release, local Surface governance, approved evidence, and production boundaries.
---

Resolve all paths from `.yisiui/config.json`: `applicationRoot`, `surfaceRoot` (legacy default `design-system/surfaces/<surface>`), `vendorRoot`, `localRegistry`, and `storybook.applicationRoot` (legacy default `storybook`). Use `packageManager` (legacy default `npm`) for installation and workspace builds. Invoke `node .yisiui/launcher.mjs` from the consumer root, or the configured `commandScript`; existing product `yisiui:*` commands may belong to WeChat and must retain their purpose. Never reset configured directories during sync.

# YisiUI Review UI

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, the synchronized release metadata, selected Surface, shared and local Registries, Contracts, baseline, exceptions, migration inventory, Story catalogs, `DESIGN.md`, and the matching implementation, Story or Page View, and real route.

Review in this order: release and hash alignment; Surface and supported viewports; registered page and asset ownership; duplicate responsibilities; Token and raw-style debt; hierarchy and layout; reachable interaction states; keyboard, focus, destructive confirmation, accessibility, and long-content behavior; Inspector metadata and production exclusion. Shared assets and the synchronized Inspector are upstream-owned and must not be patched in the product repository. Experimental assets require recorded adoption evidence and must not be reported as stable.

Check actual Story metadata titles and the built Storybook tree against source/Registry ownership. Local Stories, including wrappers and unpromoted components, must start with the exact configured `<project>/`; reject shared-looking roots or case variants such as `Human2AI/` when the project id is `human2ai`. Synchronized Stories use the reserved `yisiui-Components`, `yisiui-Modules`, `yisiui-Layouts`, `yisiui-Foundations`, or `yisiui-System` roots. Group changes must preserve Story ids and Registry/catalog links. Shared `experimental` assets still belong to YisiUI; status alone does not determine ownership.

Compare the real route, its fixture-driven Page View, the approved Story, and the formal screenshot or baseline when they exist. Classify each visual difference as expected, explicitly approved, a regression, or unresolved; do not silently update a baseline. Reject unsupported release claims, missing Registry entries, expired exceptions, unexplained debt increases, modified managed files, or migration completion without behavior and reference-removal evidence.

Review changed Stories for lasting presentation value: each retained scenario should demonstrate a meaningfully different, complete state or use. Flag duplicate fixtures exported only to test a small fix, and verify that task-created temporary reproduction Stories, their exclusive helpers, and temporary references were removed after passing. Useful regression assertions should remain in focused tests or appropriate existing Story `play` checks; `play` alone is not a reason to remove a representative Story. Check that retained Registry/catalog links still resolve. Report unrelated pre-existing clutter separately rather than expanding the task into a catalog cleanup.

Run `node .yisiui/launcher.mjs doctor` and filtered `node .yisiui/launcher.mjs query` commands from the consumer root when their evidence is relevant; do not invoke the private YisiUI CLI from its repository for routine review. Return blocking findings first, then follow-ups, evidence gaps, and exact commands or approvals required. Never approve a major direction, destructive Token change, stable promotion or removal, exception extension, visual baseline, or private YisiUI release on the user's behalf.
