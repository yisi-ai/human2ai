# SVG image nodes

SVG is an image format inside a composition or UI-layout session. Use the existing `images` nodes and `assetId`; there is no separate SVG session, node schema, or library. Users can upload an SVG file, paste its code, and copy its complete source directly from the image-content panel.

Read the latest capture and its session-specific image-node schema before creating or replacing content. For an existing SVG, use the command returned in `images.commands.source`:

```text
<runner> image source --session <session-id> --asset <asset-id> [--output <image.svg>]
```

Without `--output`, the result includes the complete `source` text. Preserve the user's existing shape and styling choices when making a local change.

Author a complete UTF-8 SVG document with `xmlns="http://www.w3.org/2000/svg"` and a usable `viewBox` or explicit dimensions. Use basic shapes, arcs, and Bézier paths; calculate repeated or symmetric geometry with code when useful. Match the current request and applicable session style. Give important parts stable ids when that helps later language-directed edits. Render and inspect the result at its intended size, including in the surrounding composition or interface.

Use a transparent background by default. Do not add a canvas-sized background shape or a background color unless the user asks for one. Shapes may still have their own fills and strokes; use `fill="none"` for unfilled outlines. The composition or interface canvas background is not part of the SVG source. Preserve an uploaded SVG's existing background unless the user requests a change.

Images must be static and self-contained. Shapes, text, local gradients, clipping, masks, filters, and internal `#id` references are supported. Use presentation attributes or simple inline CSS with local `url(#id)` references. Scripts, event handlers, animation, HTML `foreignObject`, DTDs, processing instructions, CSS imports/escapes, and external resources are not accepted. Embedded PNG/JPEG/WebP data images are allowed. Keep source within 10 MiB; the service validates content without rewriting it. Style-reference uploads retain their bitmap-only contract.

Upload through `images.commands.upload`:

```text
<runner> image upload --session <session-id> --input <image.svg>
```

The response includes the new asset `id`, MIME type, and original dimensions. Uploading alone does not change the canvas. Bind the returned id to the intended image node's `assetId`, reset `crop` to `null` for replacement, and save the complete capture with its expected latest revision. Preserve the node's id, origin, user note, placement, and other fields unless the requested change requires adjusting them. New Agent-created nodes use `origin: "agent"`; follow the owning draft's coordinate system and stage rules.

Every upload creates a new file. Replacing an image changes the node's asset reference; existing capture history continues to reference the previous file, so capture undo also restores the previous SVG source. Handle revision conflicts through the existing reconnect/read/reconcile workflow.
