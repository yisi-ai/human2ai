---
name: yisiui-migrate-product-ui
description: Migrate legacy, page-private, or project-local product UI into synchronized YisiUI assets or governed local Surface assets while preserving product behavior; do not use it for release synchronization or upstream shared authoring.
---

# YisiUI Migrate Product UI

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, shared and local Registries, Story catalogs, migration inventory, baseline, exceptions, `DESIGN.md`, the real route, and the legacy implementation and CSS. Scope one page family or reusable primitive at a time and capture the current route, data flow, reachable states, accessibility behavior, visual evidence, and references before changing it.

For every legacy responsibility, query YisiUI by category, capability, slot, alias, status, and id. Record a migration mapping to one of four outcomes: synchronized shared asset, composition of synchronized assets, governed project-local component, or page-only composition. Include the preserved behavior, nearby assets rejected, deletion condition, and evidence required. Storybook is the isolation and evidence layer, not the migration destination.

Prefer an allowed synchronized asset, then composition, then a local component created through `yisiui-author-local-component`. Treat vendor source and shared metadata as read-only. Do not move a product-specific component upstream merely because it is reusable inside one project; only proven cross-project responsibilities proceed separately through `yisiui-propose-component`. Experimental shared assets require explicit migration or review evidence and remain experimental.

Preserve API and SSE contracts, URLs, routing, persistence, business state, user-visible copy unless intentionally changed, destructive confirmations, keyboard and focus behavior, and loading, empty, error, disabled, long-content, and narrow-viewport states. Separate presentation from product orchestration where needed, but do not silently redesign behavior under a migration task.

Verify the replacement in a deterministic Story or Page View and on the real route at supported viewports. Run focused interaction and accessibility tests, Registry and CSS-debt checks, `npm run yisiui -- doctor`, Storybook checks, and the production build. Update the migration inventory, baseline or exception evidence, and local Registry before reporting completion. Keep the old implementation until the replacement is verified and all intended references are zero; remove only the exact obsolete files and report what was deleted.
