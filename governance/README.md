# Human2AI Baselines

This directory is the discovery entry point for project governance baselines. Each
baseline remains in the directory owned by its workflow; `baselines.json` records
where it lives, which Codex Skill governs it, and how it is checked.

| Baseline | Authority | Location |
| --- | --- | --- |
| Domain | Product domain behavior and reuse | `governance/domain-baseline` |
| i18n | Product semantics and localized copy | `locales/_meta` |
| UI | YisiUI Surface assets and exceptions | `design-system/surfaces/human2ai-web/governance` |

Do not copy or mirror baseline contents into this directory. A change that spans
multiple authorities must follow every applicable workflow.
