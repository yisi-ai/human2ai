---
name: yisiui-prototype-ui
description: Prototype and compare a new product UI direction with synchronized YisiUI and local Surface assets, gather review evidence, and stop for explicit approval before production adoption.
---

# YisiUI Prototype UI

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, shared and local Registries, Story catalogs, governance files, and `DESIGN.md`. Define the review question, page family, supported viewports, representative content, reachable states, and what decision the user needs to make. Query relevant assets from the consumer root before inventing a new responsibility.

Build the prototype in the product-owned Storybook, Design Lab, or equivalent non-production review boundary. Reuse synchronized and governed local assets with realistic fixtures. Explore A/B/C directions only when the decision is genuinely open and each direction represents a meaningful alternative; otherwise produce one resolved direction. Do not patch vendor assets, register exploratory work as stable, or wire it into a production route.

Cover the states and boundaries material to the decision, including long content and minimum supported viewport. Prepare a review packet that identifies shared and local assets used, intentional differences, unresolved risks, screenshots or Story ids, and the exact approval requested. Experimental assets must retain their actual lifecycle status in the evidence.

Only the user may approve the direction or visual baseline. After approval, hand a reusable local responsibility to `yisiui-author-local-component`, a page to `yisiui-compose-ui`, or legacy replacement work to `yisiui-migrate-product-ui`. If approval is absent or ambiguous, keep the prototype isolated and report the decision still required.
