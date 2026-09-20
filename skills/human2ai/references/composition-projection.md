# Reference picture to editable composition

## Read the picture and session

Use the image attached by the user or the local image they identify. Actually inspect it with the environment's image-viewing capability; a filename or verbal description alone does not establish its contents. If it is unavailable, request the missing image before drawing from it.

Follow `SKILL.md` to resolve the integration and connect to a matching `image-composition` session. Read its latest capture when one exists. Use its selected `processingSemantic` unless the user explicitly requests a different mode. An explicit choice in the conversation counts as the user's selection and may be saved in the draft. If neither the session nor the user selects Scene (`scene-composition`) or Editorial (`editorial-layout`), ask once before drawing; do not infer the mode from the picture.

For a new composition, match the picture's aspect ratio within the supported frame range below. For an existing session, preserve its frame and unrelated nodes unless the request calls for replacing them. If the destination or replacement scope is materially ambiguous, resolve that before overwriting existing intent. A bound style remains bound, but recovering a reference picture does not itself request restyling; use the ordinary Capture save command. When the user also requests a style adaptation, use the style-processing workflow and its save command.

## Recover the structure that shapes the viewing experience

Draw an abstraction of how the picture organizes attention, weight, movement and space. Success is retaining the structure and its perceptual effect when the pictured objects and surface treatment change. Recognizable silhouettes, matching bounding boxes and accurate pixel gaps are not the default acceptance criteria. The reference supplies evidence for the composition; it is not a contour template. Honor an explicit request for precise reproduction separately, without making it the default for composition work.

### Understand the whole before selecting shapes

Inspect the picture at thumbnail scale, then full size only to resolve uncertain relationships. Form a concise working reading of what makes it feel organized: where attention concentrates, what balances that concentration, how the eye can move, and where density gives way to breathing room. Ground terms such as calm, tension, weight or spaciousness in visible relationships. Do not attribute feelings produced mainly by subject matter, materials or lighting to geometry alone, or claim to know the designer's intent or every viewer's reading order.

For example, a dense lower-left text mass opposed by a broad lower-right image mass can give a banner an asymmetric balance; a more compact mass higher up can lift attention away from the bottom edge, while a quieter center gives the active regions room. This reading determines the drawing. Starting with “glass here, record player there” and later adding the word “balance” does not.

Keep this whole-picture reading in the Agent's reasoning or concise handoff, not in `overallNote`. It is a hypothesis to verify against the drawn result, not an invented theme to impose on every reference.

### Choose geometry by contribution, not resemblance

Use areas to express concentrations of visual weight, supporting fields and coherent reading units. Their size, elongation, direction, spacing and overlap should make the identified effects legible. A region can stand for several objects, part of a larger image, or a broad tonal mass. Choose a primitive for that role; it need not follow the object's outline. Preserve relative hierarchy, approximate placement and the reference's essential relationships. Positions and envelopes may be simplified or moderately adjusted to express them in the selected frame, subject to explicit user constraints and subsequent user edits.

Use two contribution checks:

- **Too coarse:** merging masses or leaving a subject free to drift inside a large image box would erase a counterweight, collapse a reading step, crowd a text area, or change a meaningful sense of depth, openness or movement. Give that role enough actual geometry to remain effective; naming it in a description is insufficient.
- **Too detailed:** removing a shape changes only object recognition, local contour accuracy, texture or a minor typographic distinction. Absorb or omit it. Separate a small accent only when it makes a distinct contribution at the scale of the whole, or the user explicitly needs it editable.

There is no node quota and no rule that every object, image or group needs one node. Similar elements can share a mass when they act together; retain their separation when it creates rhythm, openness or depth. Do not collect distant objects merely because they share an identity. A visual unit may use a few shapes, but every extra span must preserve a perceptual effect beyond making the object look more recognizable. An identifiable horn, curved edge or opening does not automatically deserve reconstruction. If a simpler mass or directional cue conveys the same effect, use it. Do not build a duplicate enclosing shape over those spans.

A background area earns its place by an effect such as unifying dispersed accents or establishing figure-ground contrast, not simply because the source is a photograph. A photograph's outer footprint cannot replace internal masses that balance text or organize attention. Conversely, do not automatically draw the photo rectangle when the frame and main masses already carry its role. A fixed image used only as a layout slot may remain one footprint when its interior is outside the requested composition work.

A focus point locates concentrated attention; an area expresses its spread and weight. A direction line can express a dominant flow, but it spans the canvas and cannot act as a short connector, curve or divider. Use none of these marks automatically. Negative space is expressed through neighboring masses and gaps, not through invented exclusion boxes. The draft has no group container, exclusion enforcement or mandatory layers.

Use `shotScale` and `visualWeight` to support the reading, while making the geometry carry what it can. Metadata alone does not render tonal contrast or make a large rectangle visually quiet. Array order controls painting. Keep `images: []` for an abstract projection; placing the reference screenshot on the canvas does not perform this abstraction.

### Apply the reading to the selected mode

| Mode | Organize | Judge the effect through |
| --- | --- | --- |
| Scene | Main and supporting masses, depth, scale contrasts, framing and motion | Dominance versus counterbalance, near/far separation, enclosure versus openness, stability versus directional tension |
| Editorial | Information hierarchy, text/image weight, grouping, density and gaps | Likely attention priorities and reading transitions, asymmetric or symmetric balance, breathing room and pace |

For a scene with a giant subject and nearby people, size contrast and foreground overlap may create monumentality and depth. Retain those relationships without reconstructing the subject's anatomy. Keep a silhouette opening only when it contributes to that spatial reading or tension, not merely to identifying the animal. An isolated foreground accent may need its own mass to give the scene a counterweight or nearer scale reference.

For a layout with a glass and a record player, represent their compact upper mass and broad lower mass when those weights organize the surrounding typography. The cup rim and disc outline need not be recognizable. A brand lockup, issue badge or compact call to action normally remains one reading unit with its immediate backing; differences in internal font size alone do not create separate compositional roles. Split text only to retain a distinct reading step, meaningful offset or directional effect. Preserve readable source wording in `displayText`, even when its spatial representation is abstracted.

Retain a curved arrangement's lightness, turning movement or enclosing effect with the simplest useful gesture; do not trace its bends as a sequence of construction pieces. Use a few spans only if the effect otherwise disappears. Do not impose a ban on image/text overlap: deliberate overlap can bind them into one visual field. Preserve legibility and breathing room where they matter, rather than reproducing every measured gap. A round badge can use one text-region envelope when its compact counterweight matters more than its exact circular edge.

### Keep descriptions, user notes, and lettering separate

Preserve readable source lettering in text-region `displayText`, including punctuation and line breaks that matter. Never invent a transcription for unreadable text: leave it unspecified and explain the uncertainty in the node description. An empty `displayText` remains a text region and means the wording is unspecified for later generation. The browser canvas displays abstract typography marks, not the exact font or lettering; the CLI `inspect --preview` SVG shows plain region shapes. The CLI preview currently leaves ellipses axis-aligned even when they have rotation; read the saved rotation and report this preview limitation when it affects visual verification. Read `displayText` from the saved draft to check its wording. Colors, materials, depth and weight metadata are not a complete rendered theme.

Assign stable ids and `origin: "import"` to every node recovered from the reference, including focus and direction marks. Reserve `origin: "agent"` for new design additions the user requests and `user` for browser-created nodes. Editing a node preserves its origin.

Write `annotation` in the user's language to explain **what this element's presence contributes to the composition**. Connect a visible characteristic to its relationship with another mass or space and the resulting perceptual effect. Usually one sentence is enough. A short source-object reference can help identification, but the subject of the explanation is its compositional role. These are explanations of the current structure, not instructions to change it.

| Merely describing the picture | Explaining the contribution |
| --- | --- |
| “手与酒杯在标题上方，杯底保留间隙” | “上方紧凑的重块将注意力从底边抬起，与右下横向大形形成斜向呼应，让下方密集文字有呼吸空间。” |
| “右下是低而宽的唱片机，与标题错开” | “右下宽而平缓的体量承接上方的动势，与左下高对比文字形成不对称的平衡，使画面重心稳定。” |
| “分类文字分成三段，沿弧线排列” | “中间轻而疏的转向节奏连接两侧重块，给视线留出经过的空隙，减轻大面积图文的拥挤感。” |
| “大主体前方是一排人群” | “低矮、重复的前景节奏提供尺度参照并遮住主形底部，使后方大形显得更高、更远。” |

Avoid interchangeable praise such as “丰富层次”“提升美感”“增强平衡” without saying what changes and through which relationship. Do not claim an effect just because a node needs a description: if it has no distinct contribution, revisit its geometry, grouping or necessity. Hiding the descriptions should leave a legible composition; reading them should explain why it feels that way. Source-dependent contrast or other qualities the canvas cannot show should be identified as such, not claimed as visibly rendered.

Every newly imported node must have `note: ""`, including focus and direction nodes. For a new reference composition, set `overallNote: ""` too. Do not put the image analysis, generation instructions, a copy of the description, or a composition summary into notes. These fields remain available for the user's instructions. Preserve existing user notes when continuing a draft. Node descriptions remain in the draft for subsequent Agent work; the browser's compact prompt does not export them, which is not a reason to copy them into notes.

## Author a complete draft

Use this format directly; no project-source import, extra API, or new capture kind is needed. Coordinates are signed world units referenced to **1200 × 800**, not output pixels. `frame.width` and `frame.height` are integer output dimensions from 256 to 4096, with width/height from 0.5 to 2. `frame.bounds` locates the crop in world units. Always include it to avoid legacy-coordinate migration. For an unsupported picture ratio, resolve the desired crop or framing with the user rather than distorting it.

Choose the abstract masses in the selected frame first. The following converts their chosen positions to canvas coordinates; it does not require tracing source pixels. For a visual point `(u, v)` expressed as fractions of the output frame and frame bounds `b`:

```text
x = b.x + u * b.width
y = b.y + v * b.height
width = regionWidthShareOfOutputFrame * b.width
height = regionHeightShareOfOutputFrame * b.height
area = width * height * shapeFactor
```

When the user explicitly requests a particular crop, padding or precise registration to the source, incorporate that framing before conversion and keep the source scale consistent on both axes. Preserve the chosen output ratio in either case.

`shapeFactor` is 1 for a quadrilateral, π/4 for a free ellipse (`primitive: "circle"`), and 1/2 for a triangle. `x/y` locate the center of a rectangle or ellipse; triangles use their centroid, two-thirds of the height below their apex. Positive rotation turns clockwise in the screen's downward y-axis. Keep `area` consistent with the unrotated dimensions. `frame.bounds.width * 1200 / (frame.bounds.height * 800)` must equal the output aspect ratio.

Required top-level fields are `version: 1`, `kind: "composition-draft"`, `processingSemantic`, `frame`, `overallNote`, `focusPoints`, `directionLine`, `areas`, and `images`. Use empty arrays, `null` for an absent direction line, and an empty overall note for a new reference composition.

All nodes carry `origin`, `note`, `annotation`, `semanticType` and `shotScale` (`auto`, `foreground`, `midground`, `background`). Use a concise descriptive semantic type; only `text-region` has special text behavior.

- Areas: ids `area-<integer>`, `primitive` (`circle`, `triangle`, `quadrilateral`), `x`, `y`, `area`, `aspect`, `visualWeight`, and optional `rotation`. Prefer `aspect: "free"` with explicit positive `width` and `height` for picture footprints. Weights are `auto`, `high`, `medium`, `low`, or `decorative`. A `text-region` uses a free quadrilateral and must include `displayText`; other areas must omit `displayText`. Array order determines area painting order; `shotScale` does not reorder nodes automatically.
- Focus points: ids `focus-<integer>` and `x/y`; at most three, added only where useful.
- Direction line: id `direction-1`, `x/y`, and `rotation`; at most one.
- Keep `images: []` for an abstract projection. Represent source imagery as areas. Existing image nodes in a reused draft must retain their asset references and crop unless changing them is requested.

These small examples demonstrate the payload and role explanations, not templates to impose on other pictures. Their object names identify the source content; the geometry carries transferable relationships.

### Scene example: background mass and foreground subject

```json
{
  "version": 1,
  "kind": "composition-draft",
  "processingSemantic": "scene-composition",
  "frame": { "width": 1200, "height": 800, "bounds": { "x": 0, "y": 0, "width": 1, "height": 1 } },
  "overallNote": "",
  "focusPoints": [
    { "id": "focus-1", "x": 0.72, "y": 0.48, "origin": "import", "note": "", "annotation": "Concentrated attention in the upper part of the foreground mass interrupts the broad horizontal sweep", "semanticType": "subject-focus", "shotScale": "foreground" }
  ],
  "directionLine": null,
  "areas": [
    { "id": "area-1", "primitive": "quadrilateral", "x": 0.32, "y": 0.55, "area": 0.21, "aspect": "free", "width": 0.6, "height": 0.35, "rotation": 0, "visualWeight": "low", "origin": "import", "note": "", "annotation": "The broad, quiet horizontal field counterbalances the narrow upright mass and gives the scene lateral breathing room", "semanticType": "landscape", "shotScale": "background" },
    { "id": "area-2", "primitive": "quadrilateral", "x": 0.72, "y": 0.65, "area": 0.081, "aspect": "free", "width": 0.18, "height": 0.45, "rotation": 0, "visualWeight": "high", "origin": "import", "note": "", "annotation": "The compact upright mass concentrates weight on the right, creating an asymmetric balance with the wide quiet field", "semanticType": "figure", "shotScale": "foreground" }
  ],
  "images": []
}
```

### Editorial example: type over photography with two subject masses

The photograph fills the background. Its key subjects need geometry because they organize the space around the type; another full-frame image rectangle would add no necessary boundary here.

```json
{
  "version": 1,
  "kind": "composition-draft",
  "processingSemantic": "editorial-layout",
  "frame": { "width": 1200, "height": 600, "bounds": { "x": 0, "y": 0, "width": 1, "height": 0.75 } },
  "overallNote": "",
  "focusPoints": [],
  "directionLine": null,
  "areas": [
    { "id": "area-1", "primitive": "circle", "x": 0.36, "y": 0.27, "area": 0.07225663103256524, "aspect": "free", "width": 0.23, "height": 0.4, "rotation": 0, "visualWeight": "high", "origin": "import", "note": "", "annotation": "The upright upper mass lifts attention above the lower pair, keeping the composition from settling into a single bottom-heavy band", "semanticType": "vase-group", "shotScale": "auto" },
    { "id": "area-2", "primitive": "circle", "x": 0.73, "y": 0.57, "area": 0.060475658581603514, "aspect": "free", "width": 0.35, "height": 0.22, "rotation": 0, "visualWeight": "medium", "origin": "import", "note": "", "annotation": "The low, broad mass opposes the dense heading across a gap, providing a stable counterweight without joining it into a solid strip", "semanticType": "bowl-group", "shotScale": "auto" },
    { "id": "area-3", "primitive": "quadrilateral", "x": 0.23, "y": 0.585, "area": 0.054, "aspect": "free", "width": 0.36, "height": 0.15, "rotation": 0, "visualWeight": "high", "displayText": "ROOM TO\nBREATHE", "origin": "import", "note": "", "annotation": "Dense horizontal type establishes the primary reading anchor, held in balance by the broader image mass to its right", "semanticType": "text-region", "shotScale": "auto" },
    { "id": "area-4", "primitive": "quadrilateral", "x": 0.86, "y": 0.1, "area": 0.0128, "aspect": "free", "width": 0.16, "height": 0.08, "rotation": 0, "visualWeight": "low", "displayText": "VOL. 04", "origin": "import", "note": "", "annotation": "The isolated small label punctuates the open upper-right field while remaining subordinate to the main reading anchor", "semanticType": "text-region", "shotScale": "auto" }
  ],
  "images": []
}
```

## Save, inspect, and continue editing

Before saving, check every region against the whole-picture reading: what effect does it contribute, through which relationship, and is that contribution expressed in the drawing? Remove geometry justified only by resemblance. Restore a missing weight, gap or direction when its absence changes the intended experience. Descriptions must explain the contribution rather than supply one after the fact. Verify that all new notes and the new overall note are empty.

Save the complete JSON with `capture.commands.save` from the connection, using its latest revision (0 before the first save). Keep the returned revision as the projection baseline. Use `composition inspect --session <session-id> --revision <saved-revision> --preview <preview.svg>` and actually view the local result, rasterizing it locally when the image viewer needs a bitmap. Follow the parent Skill's operation-channel rule; static preview inspection does not require Chrome MCP. Compare it with the reference at a size where both whole frames are visible, without relying on node descriptions:

- Is attention concentrated in comparable places, with the same dominant and subordinate roles?
- Does the balance of mass and open space preserve the identified stability, tension, depth or breathing room? Does the rhythm remain dense, loose, steady or turning where it matters?
- If the objects were replaced by different content with these same visual roles, would the structural effect still work? If only object recognition survives, reconsider the abstraction. This is a thought experiment, not a request to generate another image.
- Has an incidental contour or extra colored region become falsely prominent? Would merging it change the experience or only make the object less recognizable?
- Do the descriptions explain the observed relationships and effects? If an effect depends on contrast the canvas does not render, is that dependency clear instead of being mistaken for a successful visual check?

If it reads as a parts diagram, regroup around compositional contributions; better wording alone does not repair the drawing. If simplification lost a necessary effect, restore only the geometry needed to convey it. Correct those discrepancies and save against the latest revision. Do not add pieces merely to improve silhouette likeness. Schema validation and a low node count alone do not verify visual quality. Report limitations that affect the retained structure or experience, and unavailable visual inspection; ordinary omission of photographic detail is expected. These authoring checks guide subsequent work, not runtime guarantees of a generated picture's layout.

Open or provide the session's `ui.editUrl`; an already open clean page receives the saved draft. If the request ends at an editable canvas, hand it off there. The first saved revision has no predecessor and cannot be undone; later latest revisions can be undone through the normal Capture command.

When the user asks to continue after editing, read the latest capture and, when needed, the retained projection baseline. Preserve stable ids, origins, notes, required text, and user-added nodes; do not regenerate the original picture's layout over their changes or restore nodes they removed without a request. Treat edits as revised composition intent. They do not modify the reference image itself. Carry node descriptions as context into any separately authorized downstream image work.

## Basis for these drawing rules

These are Human2AI authoring decisions adapted from the following principles, not a universal formula or a requirement to research every new picture:

- [Getty: Principles of Design](https://www.getty.edu/education/teachers/building_lessons/principles_design.pdf) explains visual weight, emphasis, movement, rhythm and unity. Here, those relationships determine whether a region deserves to exist.
- [James Gurney: First Impressions](https://gurneyjourney.blogspot.com/2011/04/first-impressions.html) discusses deliberately seeing broad masses through defocusing or squinting. Here, the thumbnail pass precedes choosing nodes.
- [NN/g: Proximity](https://www.nngroup.com/articles/gestalt-proximity/) and [Similarity](https://www.nngroup.com/articles/gestalt-similarity/) describe perceptual grouping. Here, shared appearance and proximity support aggregation while major spatial separations remain visible.
- [Art Prof: Great 2D Compositions](https://artprof.org/learn/fundamentals/composition/great-2d-compositions/) emphasizes varying shape sizes, attention, and balancing visually active and quiet areas. Here, simplification retains meaningful small accents and negative space.
