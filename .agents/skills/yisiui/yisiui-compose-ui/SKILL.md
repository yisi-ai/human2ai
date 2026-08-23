---
name: yisiui-compose-ui
description: Compose or update a product page or page family from synchronized YisiUI assets and governed project-local assets, then connect the approved view to product routing and state.
---

# YisiUI Compose UI

Before editing, read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, shared and local Registries, relevant Story catalogs, governance baseline and exceptions, and `DESIGN.md`. Identify the page family, supported viewports, required states, and whether the task changes an approved visual direction.

From the consumer root, run `npm run yisiui -- query` with `--category`, `--capability`, `--slot`, `--alias`, `--status`, or `--id` as appropriate. Before writing markup, record the selected page pattern, layout, components, states, and rejected near matches. Choose in this order: reuse an allowed synchronized asset, compose synchronized assets, extend a documented variant or slot, create a project-local composition, or use `yisiui-author-local-component` for a reusable product responsibility. Prefer stable assets; an experimental asset may be adopted only with explicit migration or review evidence and must not be represented as stable.

Treat `design-system/surfaces/*/src/vendor/yisiui`, the synchronized Surface workspace `package.json`, and synchronized shared metadata as read-only. Put product API, routing, persistence, domain state, copy, and project-specific composition in the product repository's local Surface or application code. Never hand-copy or patch synchronized files; request an explicit YisiUI sync or change the upstream YisiUI source instead.

Build the presentation first as a fixture-driven Story or Page View when the change is visually material. Cover loading, empty, error, disabled, destructive, long-content, and narrow-viewport states that the page can actually reach. Keep the view independent from API, SSE, routing, persistence, and business-state orchestration. If the work introduces a new visual direction or baseline, obtain explicit user approval before wiring it into a production route.

After approval, connect the view through the product's existing application boundaries and update the local page Registry, migration status, exceptions, and evidence that apply. Run `npm run yisiui -- doctor`, relevant interaction and accessibility tests, Storybook checks, and the product's Next production build. Report missing validation rather than assuming it passed. Do not invoke the private YisiUI CLI from its repository for routine consumer operations.
