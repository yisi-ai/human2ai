---
name: yisiui-sync-ui
description: Preview and apply an explicitly requested YisiUI source-sync release update, including runtime assets, Contracts, Registry, Inspector, and consumer Skills.
---

Resolve all paths from `.yisiui/config.json`: `applicationRoot`, `surfaceRoot` (legacy default `design-system/surfaces/<surface>`), `vendorRoot`, `localRegistry`, and `storybook.applicationRoot` (legacy default `storybook`). Use `packageManager` (legacy default `npm`) for installation and workspace builds. Invoke `node .yisiui/launcher.mjs` from the consumer root, or the configured `commandScript`; existing product `yisiui:*` commands may belong to WeChat and must retain their purpose. Never reset configured directories during sync.

# YisiUI Sync UI

Use this workflow only when the user explicitly requests initialization, synchronization, or an update. Read `.yisiui/config.json`, `.yisiui/sync-lock.json` when present, the target release manifest, its migration notes, and the current managed-file conflict report.

After the one-time `create/init` bootstrap, run the managed launcher from the consumer project root. Use `node .yisiui/launcher.mjs diff` before writing, `node .yisiui/launcher.mjs update` to apply, and `node .yisiui/launcher.mjs doctor` to verify. Do not change directory to the private YisiUI repository or pass the consumer path to its CLI for routine updates. The launcher defaults to a sibling `../yisiui`; when necessary, set `YISIUI_SOURCE_ROOT` for that process without persisting an absolute private path in the product repository.

Synchronize the release as one compatibility unit: launcher, runtime source, styles, Tokens, asset-marker and Registry contracts, shared Registry and Stories, Inspector, and consumer Skills. Refuse partial updates, integrity failures, unsupported schema versions, or edits to managed files. Product-owned components, Registries, pages, baselines, and Skills with other names remain untouched.

Shared Storybook groups use `yisiui-` prefixes; product-owned Stories remain under the exact configured `<project>/` root. Follow the release's grouping migration notes and preserve Story ids. Sync can upgrade an unchanged legacy preview sorting template; customized product preview configuration requires a scoped product-side edit. Do not rewrite local Story titles or treat a local component as promoted merely because a shared release was synchronized.

Inspect `assetMigrations` before applying an update. Deprecated assets may synchronize while product references remain; report the replacement, removal boundary and migration guide, then use the product migration workflow to remove those references before `removeAfter`. If a removed asset still has product import or re-export references, `migrationBlocked` is true and the update must remain atomic with zero writes. Migrate the reported paths on the currently installed release, rerun relevant checks, and repeat `diff`; never bypass the block by editing vendor source or the sync lock. Dynamic module paths not visible to the scanner require an explicit manual reference audit.

After synchronization run the managed doctor command, relevant tests, Storybook checks, and the Next production build. If the result reports `installRequired`, review and run the configured `installCommand` (`npm install` or `pnpm install`). The Inspector must remain unregistered and unmounted in production. If `skillsChanged` or `restartRequired` is true, report that a new agent turn or session is required and do not continue UI authoring under instructions loaded before the update.

Synchronization does not remove product-owned or obsolete non-YisiUI Skills. When a migration explicitly replaces them, remove only the named project-owned Skills in a separate product change after the new YisiUI Skills have synchronized successfully; start another agent turn before continuing UI work so deleted instructions are no longer loaded.
