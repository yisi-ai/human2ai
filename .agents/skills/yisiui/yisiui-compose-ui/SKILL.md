---
name: yisiui-compose-ui
description: Compose or update a product page or page family from synchronized YisiUI assets and governed project-local assets, then connect the approved view to product routing and state.
---

Resolve all paths from `.yisiui/config.json`: `applicationRoot`, `surfaceRoot` (legacy default `design-system/surfaces/<surface>`), `vendorRoot`, `localRegistry`, and `storybook.applicationRoot` (legacy default `storybook`). Use `packageManager` (legacy default `npm`) for installation and workspace builds. Invoke `node .yisiui/launcher.mjs` from the consumer root, or the configured `commandScript`; existing product `yisiui:*` commands may belong to WeChat and must retain their purpose. Never reset configured directories during sync.

# YisiUI Compose UI

Before editing, read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, shared and local Registries, relevant Story catalogs, governance baseline and exceptions, and `DESIGN.md`. Identify the page family, supported viewports, required states, and whether the task changes an approved visual direction.

From the consumer root, run `node .yisiui/launcher.mjs query` with `--category`, `--capability`, `--slot`, `--alias`, `--status`, or `--id` as appropriate. Before writing markup, record the selected page pattern, layout, components, states, and rejected near matches. Choose in this order: reuse an allowed synchronized asset, compose synchronized assets, extend a documented variant or slot, create a project-local composition, or use `yisiui-author-local-component` for a reusable product responsibility. Prefer stable assets; an experimental asset may be adopted only with explicit migration or review evidence and must not be represented as stable.

Treat `<vendorRoot>`, the synchronized Surface workspace `package.json`, and synchronized shared metadata as read-only. Put product API, routing, persistence, domain state, copy, and project-specific composition in the product repository's local Surface or application code. Never hand-copy or patch synchronized files; request an explicit YisiUI sync or change the upstream YisiUI source instead.

Place product Story/Page View titles under the exact `.yisiui/config.json` project id, such as `human2ai/Pages/Workspace`. Composing shared assets does not make the product view shared. Reserve `yisiui-` Storybook roots for synchronized upstream Stories, and preserve existing Story ids when correcting group titles.

Build the presentation first as a fixture-driven Story or Page View when the change is visually material, reusing or updating an existing representative view when possible. Retain new Stories only for meaningfully different, complete states or uses; small styling, copy, or timing fixes should be verified in existing views or focused tests. Cover loading, empty, error, disabled, destructive, long-content, and constrained-layout states that the page can actually reach within its supported viewport scope. Keep the view independent from API, SSE, routing, persistence, and business-state orchestration. If the work introduces a new visual direction or baseline, obtain explicit user approval before wiring it into a production route.

If verification needs a temporary Story, identify it as temporary and remove it with its exclusive fixtures/helpers and references after it passes. Keep useful regression assertions in focused tests or relevant `play` checks of retained Stories. Completion should leave a coherent showcase, without a new catalog entry for each fix.

After approval, connect the view through the product's existing application boundaries and update the local page Registry, migration status, exceptions, and evidence that apply. Run `node .yisiui/launcher.mjs doctor`, relevant interaction and accessibility tests, Storybook checks, and the product's Next production build. Report missing validation rather than assuming it passed. Do not invoke the private YisiUI CLI from its repository for routine consumer operations.
