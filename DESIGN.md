---
name: "human2ai"
uiSystem: "YisiUI"
status: "product-owned"
---

# human2ai Design Contract

This product synchronizes a versioned YisiUI source release and owns its local Surface, product tokens, compositions, pages, copy, and visual baselines.

Before UI work, read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, synchronized shared Registry, local Registry, and relevant Story catalog entries. Reuse synchronized YisiUI assets before creating project-local implementations.

Files below the Surface's `src/vendor/yisiui` directory and YisiUI-managed consumer Skills are upstream-owned and read-only. Product-specific routes, APIs, persistence, domain state, and visual direction remain owned by this repository. Propose reusable local assets through the candidate workflow; do not hand-copy them into or patch the private YisiUI source.
