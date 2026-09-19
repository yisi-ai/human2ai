---
name: "human2ai"
uiSystem: "YisiUI"
status: "product-owned"
---

# human2ai Design Contract

This product synchronizes a versioned YisiUI source release and owns its local Surface, product tokens, compositions, pages, copy, and visual baselines.

## Supported viewports

- Target desktop computer browsers only. Narrow-screen and mobile layouts are outside the product's support and acceptance scope.
- Use the existing Storybook desktop viewports (`1024×800`, `1280×800`, and `1536×960`) as validation references, selecting the relevant desktop sizes for each change.
- Do not add mobile-specific breakpoints, alternate mobile layouts, or narrow-screen validation solely to satisfy generic UI Skill checklists. Add that support only when explicitly requested by the user.
- Within supported desktop layouts, handle long content and constrained panels with appropriate sizing and internal scrolling.

## Visual direction

- Keep the product visually minimal. Use a clear outer border to define the primary surface, while keeping its internal structure implicit.
- Express hierarchy inside a surface through visual weight—such as spacing, typography, color, contrast, and alignment—instead of nested borders, excessive cards, or decorative separators.
- Do not place persistent explanatory copy on a page to describe what the page does or how to use it. The interface should communicate purpose and operation through its structure, labels, and controls.
- When guidance is essential, use a concise icon with an on-demand tooltip rather than a visible explanatory paragraph. Keep required status, validation, and error messages directly visible when they affect the current task.

Before UI work, read `.yisiui/config.json`, `.yisiui/sync-lock.json`, `design-system/system.json`, the selected Surface, synchronized shared Registry, local Registry, and relevant Story catalog entries. Reuse synchronized YisiUI assets before creating project-local implementations.

Files below the Surface's `src/vendor/yisiui` directory and YisiUI-managed consumer Skills are upstream-owned and read-only. Product-specific routes, APIs, persistence, domain state, and visual direction remain owned by this repository. Propose reusable local assets through the candidate workflow; do not hand-copy them into or patch the private YisiUI source.
