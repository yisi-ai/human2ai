# Quaternius Universal Base Characters

Source: https://quaternius.com/packs/universalbasecharacters.html
Official free download: https://quaternius.itch.io/universal-base-characters
Author: Quaternius. License: CC0 1.0, see License_Standard.txt.
Downloaded 2026-09-09, Standard package updated 2025-12-16.

Included sources: Superhero_Male_FullBody.gltf and Superhero_Female_FullBody.gltf,
each with its original geometry/skin buffer.
The free pack currently includes the Superhero variants; the Regular and Teen
models advertised for the full kit are not bundled here. No paid assets are used.

The app uses the original character geometry and reduced skin weights, retargeted
to its editable joints/bones. It uses plain configurable body color, eyes and brows;
external texture images referenced by the original source glTF are intentionally
omitted. This glTF is the geometry conversion input, not a standalone textured viewer asset.

Rebuild the runtime asset:

    node scripts/prepare-spatial-model.mjs assets/quaternius/Superhero_Male_FullBody.gltf
    node scripts/prepare-spatial-model.mjs assets/quaternius/Superhero_Female_FullBody.gltf

The derived JSON is emitted into src/domain/spatial/assets and included in both
browser and server builds. The male source retains 8,483 vertices and 14,318
triangles; the female source retains 8,844 vertices and 15,060 triangles. Each
uses its own anatomical landmarks with the same joint IDs and rendering path.
Duplicated limbs/heads reuse the real mesh modules and skin weights. Attachments
are overlapping mesh seams, not an automatic watertight topology union. The five finger chains retain their original skin weights; the palm and each
phalange are separately selectable. Thumb articulation includes the metacarpal
and two phalanges. Fixed palm-to-finger attachments have no skin module.
Textures remain deferred.
