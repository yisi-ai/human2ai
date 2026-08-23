---
name: yisiui-author-local-component
description: Create, formalize, or extend a reusable project-local UI component in a YisiUI consumer Surface when the responsibility is product-specific or not yet proven reusable across projects.
---

# YisiUI Author Local Component

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, shared and local Registries, relevant Story catalogs, Contracts, governance files, and `DESIGN.md`. Query by category, capability, slot, alias, status, and id with `npm run yisiui -- query`; filename search alone does not prove a missing responsibility.

Choose in this order: reuse an allowed synchronized asset, compose synchronized assets, extend a documented variant or slot, compose existing local assets, or create a local component. Keep a one-page layout as a page composition rather than registering it as a reusable component. Do not create a second component with the same responsibility under a product-specific name.

Place the implementation and deterministic Story under the Surface's product-owned `src/local` tree. Define its public contract, category, capabilities, slots, aliases, use/do-not-use boundaries, similar assets checked, difference summary, reachable states, keyboard and focus behavior, and Story id in the local Registry. A local component may use product concepts, but API calls, routing, persistence, and business-state ownership stay outside its presentation contract.

Use generated YisiUI Tokens and the synchronized provider contract. Do not patch vendor assets or duplicate their CSS. Cover relevant default, loading, empty, error, disabled, destructive, long-content, and narrow-viewport states with Stories and interaction or accessibility tests. Begin at the lifecycle status required by the local Registry; do not claim stable status or approve a visual baseline without the required evidence and explicit user approval.

Run `npm run yisiui -- doctor`, Registry and CSS checks available in the product, focused interaction and accessibility tests, Storybook checks, and the production build. Keep the component local until real usage shows a neutral cross-project responsibility; only then hand it to `yisiui-propose-component` without deleting the local implementation.
