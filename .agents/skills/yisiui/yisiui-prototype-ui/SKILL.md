---
name: yisiui-prototype-ui
description: Prototype and compare a new product UI direction with synchronized YisiUI and local Surface assets, gather review evidence, and stop for explicit approval before production adoption.
---

Resolve all paths from `.yisiui/config.json`: `applicationRoot`, `surfaceRoot` (legacy default `design-system/surfaces/<surface>`), `vendorRoot`, `localRegistry`, and `storybook.applicationRoot` (legacy default `storybook`). Use `packageManager` (legacy default `npm`) for installation and workspace builds. Invoke `node .yisiui/launcher.mjs` from the consumer root, or the configured `commandScript`; existing product `yisiui:*` commands may belong to WeChat and must retain their purpose. Never reset configured directories during sync.

# YisiUI Prototype UI

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, shared and local Registries, Story catalogs, governance files, and `DESIGN.md`. Define the review question, page family, supported viewports, representative content, reachable states, and what decision the user needs to make. Query relevant assets from the consumer root before inventing a new responsibility.

Build the prototype in the product-owned Storybook, Design Lab, or equivalent non-production review boundary. Reuse synchronized and governed local assets with realistic fixtures. Explore A/B/C directions only when the decision is genuinely open and each direction represents a meaningful alternative; otherwise produce one resolved direction. Do not patch vendor assets, register exploratory work as stable, or wire it into a production route.

Product-hosted prototype Story titles belong under `<project>/...`, using the exact project id from `.yisiui/config.json`. Using shared components or preparing a promotion proposal does not grant a prototype a `yisiui-` group; those roots belong to synchronized upstream Stories.

Iterate on the existing review scene for small changes instead of exporting each revision as another Story. Distinct review alternatives should show complete, meaningful directions. Identify any temporary verification-only Story and remove it with its exclusive fixtures/helpers and references after it passes, preserving useful assertions in focused tests or an appropriate retained Story. A prototype still needed for the user's design decision remains review evidence; passing its tests alone does not finish that review.

Cover the states and boundaries material to the decision, including long content and minimum supported viewport. Prepare a review packet that identifies shared and local assets used, intentional differences, unresolved risks, screenshots or Story ids, and the exact approval requested. Experimental assets must retain their actual lifecycle status in the evidence.

Only the user may approve the direction or visual baseline. After approval, hand a reusable local responsibility to `yisiui-author-local-component`, a page to `yisiui-compose-ui`, or legacy replacement work to `yisiui-migrate-product-ui`. If approval is absent or ambiguous, keep the prototype isolated and report the decision still required.
