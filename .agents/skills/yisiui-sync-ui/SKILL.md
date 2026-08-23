---
name: yisiui-sync-ui
description: Preview and apply an explicitly requested YisiUI source-sync release update, including runtime assets, Contracts, Registry, Inspector, and consumer Skills.
---

# YisiUI Sync UI

Use this workflow only when the user explicitly requests initialization, synchronization, or an update. Read `.yisiui/config.json`, `.yisiui/sync-lock.json` when present, the target release manifest, its migration notes, and the current managed-file conflict report.

After the one-time `create/init` bootstrap, run the managed launcher from the consumer project root. Use `npm run yisiui -- diff` before writing, `npm run yisiui -- update` to apply, and `npm run yisiui -- doctor` to verify. Do not change directory to the private YisiUI repository or pass the consumer path to its CLI for routine updates. The launcher defaults to a sibling `../yisiui`; when necessary, set `YISIUI_SOURCE_ROOT` for that process without persisting an absolute private path in the product repository.

Synchronize the release as one compatibility unit: launcher, runtime source, styles, Tokens, asset-marker and Registry contracts, shared Registry and Stories, Inspector, and consumer Skills. Refuse partial updates, integrity failures, unsupported schema versions, or edits to managed files. Product-owned components, Registries, pages, baselines, and Skills with other names remain untouched.

After synchronization run the managed doctor command, relevant tests, Storybook checks, and the Next production build. If the result reports `installRequired`, review and run `npm install`. The Inspector must remain unregistered and unmounted in production. If `skillsChanged` or `restartRequired` is true, report that a new agent turn or session is required and do not continue UI authoring under instructions loaded before the update.
