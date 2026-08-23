---
name: yisiui-review-ui
description: Review a product page, component, migration, or release integration against its synchronized YisiUI release, local Surface governance, approved evidence, and production boundaries.
---

# YisiUI Review UI

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, the synchronized release metadata, selected Surface, shared and local Registries, Contracts, baseline, exceptions, migration inventory, Story catalogs, `DESIGN.md`, and the matching implementation, Story or Page View, and real route.

Review in this order: release and hash alignment; Surface and supported viewports; registered page and asset ownership; duplicate responsibilities; Token and raw-style debt; hierarchy and layout; reachable interaction states; keyboard, focus, destructive confirmation, accessibility, and long-content behavior; Inspector metadata and production exclusion. Shared assets and the synchronized Inspector are upstream-owned and must not be patched in the product repository. Experimental assets require recorded adoption evidence and must not be reported as stable.

Compare the real route, its fixture-driven Page View, the approved Story, and the formal screenshot or baseline when they exist. Classify each visual difference as expected, explicitly approved, a regression, or unresolved; do not silently update a baseline. Reject unsupported release claims, missing Registry entries, expired exceptions, unexplained debt increases, modified managed files, or migration completion without behavior and reference-removal evidence.

Run `npm run yisiui -- doctor` and filtered `npm run yisiui -- query` commands from the consumer root when their evidence is relevant; do not invoke the private YisiUI CLI from its repository for routine review. Return blocking findings first, then follow-ups, evidence gaps, and exact commands or approvals required. Never approve a major direction, destructive Token change, stable promotion or removal, exception extension, visual baseline, or private YisiUI release on the user's behalf.
