---
name: yisiui-propose-component
description: Evaluate a project-local UI component for promotion into private YisiUI without automatically copying or releasing it.
---

# YisiUI Propose Component

Read `.yisiui/config.json`, `.yisiui/sync-lock.json`, the synchronized shared Registry, the local Registry, the component implementation, Stories, tests, and real product usage. Query relevant assets with `npm run yisiui -- query`; first decide whether reuse, composition, or an existing variant or slot already covers the responsibility.

A proposal must record origin project and source, a neutral name, capabilities, slots, use/do-not-use boundaries, similar assets checked, a difference summary, dependencies, and coupling to remove. Product APIs, routes, persistence, domain types, fixed product copy, private tokens, and business-state ownership cannot cross into YisiUI.

Generate only a candidate proposal in the product repository with `npm run yisiui -- propose --id <id> --source-file <path> --name <name> --capabilities <a,b> --similar <a,b> --difference <summary> --use-when <a,b> --do-not-use-when <a,b> [--slots <a,b>] [--dependencies <a,b>] [--coupling <a,b>]` from the consumer root. Do not edit synchronized vendor files, modify the private YisiUI repository, remove the local implementation, or claim promotion or release. The private YisiUI authoring workflow must create and verify the shared implementation; the product switches to the synchronized shared copy only after a new release is pulled back and verified.
