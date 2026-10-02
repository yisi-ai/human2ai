# Extract UI artwork

Use this workflow to extract artwork from an interface image in Human2AI. It produces complete UI objects on transparent image sheets and a separate completed background. Read the latest capture and the user's current requirements before choosing the source and outputs.

## Resolve the source

Use the specified session and image node or asset. When several images are equally plausible, ask which one to extract. Create `.human2ai-data/output/` before exporting files. Retrieve the original asset through the connection's image-source command, writing it under that directory:

```text
<runner> image source --session <session-id> --asset <asset-id> --output .human2ai-data/output/ui-source.png
```

Use the asset's actual format for the filename. Inspect the local source before image editing. Read relevant node and overall notes as user instructions, and distinguish the full original interface from any regional references. The source's visible design is authoritative: retain proportions, colors, drawing style, materials and light direction. A bound style does not authorize redesigning extracted objects.

## Plan complete objects and batches

- Complete small portions hidden behind another object or cut off by the source boundary, continuing that object's visible outline, panel, sidewall, corners and decoration. Remove the occluder's shape rather than leaving a notch or hole. Preserve intentional openings; do not invent entirely hidden objects.
- Extract independently layered or overlapping objects separately: icon and support, stacked books, foreground marker and panel, logo ornament and lettered plaque. Restore the lower object after removing the upper one. Printed or engraved lettering and surface illustrations remain on their owning object; paint planes and letter strokes are not separate UI objects.
- Rearrange objects within each output sheet so their complete silhouettes have transparent margins and alpha-zero separation. Preserve each object's proportions and recognizable features. Give them enough space instead of shrinking text or clipping edges to fit.
- Choose exactly 1, 2 or 4 UI sheets before generation, with a maximum of 4. Default to 2; choose 1 for a simple source whose completed, separated objects fit clearly, and propose 4 when 2 cannot preserve completeness, spacing and readable text. Consider overlap separation, completed size, text and detail rather than fixed object-count thresholds or generated PNG fragments.
- For 2 sheets, partition the source upper/lower or left/right according to its contents. For 4, use upper-left, upper-right, lower-left and lower-right. Boundaries may be unequal. Assign each object to exactly one batch; an object crossing a boundary stays whole in its assigned batch, using the full source or an expanded regional reference for context.
- Before generating any UI sheet in a four-sheet plan, explain why 2 are insufficient, list the four regions and their objects, and obtain explicit confirmation. A confirmed plan needs no repeated confirmation. Upgrading from 1 or 2 to 4 needs confirmation of the new plan; an authorized 1- or 2-sheet extraction needs no extra count approval.
- Extract and complete the background as one separate full image, excluded from the UI count. Normal outputs are 2 UI sheets plus 1 background; simple sources use 1 plus 1, and a confirmed complex plan uses 4 plus 1. A narrower explicit user request takes precedence, such as extracting only a specified icon or excluding the background.
- Follow the user's current text policy. When retaining text, preserve known literal words and numbers on their owning elements. Do not guess fully hidden text, translate it or rewrite it. Candidate artwork does not change downstream editable-text or localization requirements.

## Generate and deliver

Read and fill [ui-extraction-prompt.txt](ui-extraction-prompt.txt) before generation. Its preflight is Agent planning; send only the filled image-edit prompt to the image tool. Use the available image-editing tool or Skill with the original image as direct visual evidence. Request genuine transparency for UI sheets and an opaque complete image for the background. Generate one planned sheet per call, with only its assigned objects, using the same source and drawing style. The template includes a separate background prompt.

Keep generated files and the actual filled prompts under `.human2ai-data/output/`, retaining the source and prior prompt versions when revising an output. Do not import the game's splitting scripts, FairyGUI/Cocos resource workflow or project-specific paths.

For extraction from a Human2AI session, normally add the intact outputs to that same session for review. Follow the user's current request when choosing delivery and optional splitting:

- For a file-only request, deliver the intact UI sheets and separate background with their paths.
- When the user needs the results on the canvas, upload through `images.commands.upload`, read the latest capture, add the intact sheets and background as separate image nodes, and save through `capture.commands.save`. Give generated nodes stable ids and `origin: "agent"`, preserve existing nodes and every state's layout, and place review materials outside the interface frame unless the user requests another position. Return the session link.
- When independent canvas objects are needed, optionally use [Human2AI's native PNG splitting CLI](ui-layout.md#split-a-transparent-png) after adding a transparent sheet as an image node. The Agent decides whether this is useful for the current authorized task. Extraction does not require automatic splitting, split previews, manual masks or post-split rearrangement. Keep the background intact.

Use the existing revision-conflict workflow for canvas saves. Delivery of extraction results does not authorize downstream implementation in the consumer project.
