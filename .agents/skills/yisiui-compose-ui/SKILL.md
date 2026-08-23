---
name: yisiui-compose-ui
description: Compose or update product UI using the synchronized YisiUI release and the current project's local Surface assets.
---

# YisiUI Compose UI

Before editing, read `.yisiui/config.json`, `.yisiui/sync-lock.json`, the synchronized shared Registry, the selected local Surface and Registry, `DESIGN.md`, and relevant Story catalog entries. From the consumer project root, use `npm run yisiui -- query` to query capabilities, slots, aliases, and use/do-not-use boundaries before creating UI.

Choose in this order: reuse a synchronized stable asset, compose synchronized assets, extend a documented variant or slot, create a project-local composition, or propose a genuinely reusable missing responsibility with `yisiui-propose-component`.

Treat `design-system/surfaces/*/src/vendor/yisiui`, the synchronized Surface workspace `package.json`, and synchronized shared metadata as read-only. Put product API, routing, persistence, domain state, copy, and project-specific composition in the product repository's local Surface or application code. Never hand-copy or patch synchronized files; request an explicit YisiUI sync or change the upstream YisiUI source instead.

Run `npm run yisiui -- doctor`, relevant interaction and accessibility tests, Storybook checks, and the product's Next production build. Report missing validation rather than assuming it passed. Do not invoke the private YisiUI CLI from its repository for routine consumer operations.
