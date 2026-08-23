---
name: yisiui-review-ui
description: Review product UI against its synchronized YisiUI release, local Surface governance, Inspector, and production boundaries.
---

# YisiUI Review UI

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, the synchronized release metadata, shared and local Registries, Contracts, baseline, exceptions, Story catalogs, `DESIGN.md`, and the matching implementation and Story or Page View.

Check release and hash alignment, ownership, duplicate responsibilities, Token drift, raw-style debt, keyboard and focus behavior, state and long-content coverage, Inspector metadata, and production exclusion. Shared assets and the synchronized Inspector are upstream-owned and must not be patched in the product repository.

Run `npm run yisiui -- doctor` and `npm run yisiui -- query` from the consumer root when their evidence is relevant; do not invoke the private YisiUI CLI from its repository for routine review. Return blocking findings first, then follow-ups and exact commands/evidence. Never approve a major direction, destructive Token change, stable promotion or removal, exception extension, visual baseline, or private YisiUI release on the user's behalf.
