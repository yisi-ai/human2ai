import { expect, it } from "vitest";
import { LineSegments, Mesh } from "three";
import { applySpatialOperations, createHumanoid, createSpatialDraft } from "../../src/domain/spatial/index.ts";
import { createCharacterModel, updateCharacterModel } from "../../src/domain/spatial/model.ts";
import { disposeSpatialScene } from "../../src/domain/spatial/scene.ts";

it("updates skin and creases in place with the same geometry as fresh models across pose and proportion changes", () => {
  for (const bodyType of ["male", "female"] as const) {
    let draft = createSpatialDraft(); draft.characters = [createHumanoid("a", "A", 1.8, 7, undefined, bodyType)];
    draft = applySpatialOperations(draft, [{ type: "add-limb", characterId: "a", sourceJointId: "left-shoulder", parentId: "chest", idPrefix: "extra", offset: [.2,-.2,0] }]).draft;
    const model = createCharacterModel(draft.characters[0]);
    const meshes = model.children.filter(object => object instanceof Mesh);
    const positions = meshes.map(mesh => mesh.geometry.getAttribute("position")), indices = meshes.map(mesh => mesh.geometry.index);
    const creases = model.children.filter(object => object instanceof LineSegments), linePositions = creases.map(line => line.geometry.getAttribute("position"));
    let firstUpdate = true;
    try {
      for (const heads of [7, 4, 2, 3.5, 7]) {
        draft = applySpatialOperations(draft, [
          { type: "set-proportions", characterId: "a", height: 1.7, headRatio: heads, neckLength: 1.2, fingerLength: .8, palmSize: 1.1 },
          { type: "pose-hand", characterId: "a", handBoneId: "extra-left-hand", curl: { index: .6, thumb: .4 } },
        ]).draft;
        draft.characters[0].position = [1,2,3]; draft.characters[0].rotation = [10,30,-20]; draft.characters[0].color = "#cc8844";
        expect(updateCharacterModel(model, draft.characters[0])).toBe(true);
        if (firstUpdate) {
          creases.forEach((line, i) => { expect(model.children).toContain(line); expect(line.geometry.getAttribute("position")).toBe(linePositions[i]); });
          firstUpdate = false;
        }
        const fresh = createCharacterModel(draft.characters[0]);
        try {
          expect(model.children.length).toBe(fresh.children.length);
          model.children.forEach((object, i) => {
            const other = fresh.children[i] as Mesh | LineSegments, drawable = object as Mesh | LineSegments;
            expect(drawable.type).toBe(other.type); expect(drawable.userData).toEqual(other.userData);
            for (const name of Object.keys(other.geometry.attributes)) expect(drawable.geometry.getAttribute(name).array).toEqual(other.geometry.getAttribute(name).array);
          });
          meshes.forEach((mesh, i) => { expect(model.children).toContain(mesh); expect(mesh.geometry.getAttribute("position")).toBe(positions[i]); expect(mesh.geometry.index).toBe(indices[i]); expect(mesh.geometry.index!.version).toBe(0); });
        } finally { disposeSpatialScene(fresh); }
      }
      expect(updateCharacterModel(model, { ...draft.characters[0], bodyType: bodyType === "male" ? "female" : "male" })).toBe(false);
      expect(updateCharacterModel(model, { ...draft.characters[0], appearance: "geometric" })).toBe(false);
    } finally { disposeSpatialScene(model); }
  }
});
