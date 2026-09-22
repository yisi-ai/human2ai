import { applySpatialOperations, validateSpatialDraft } from "./index.ts";
import type { SpatialDraft, SpatialOperation } from "./types.ts";

/** One validated gesture snapshot; each preview delegates to the same domain operations. */
export function createSpatialPreview(input: SpatialDraft) {
  const base = validateSpatialDraft(input);
  return (operation: SpatialOperation): ReturnType<typeof applySpatialOperations> => {
    const characterId = "characterId" in operation ? operation.characterId : operation.type === "put-character" ? operation.character.id : undefined;
    const objectId = operation.type === "put-object" ? operation.object.id : undefined;
    const boxId = operation.type === "put-camera-box" ? operation.box.id : undefined;
    const character = base.characters.find(item => item.id === characterId);
    const object = base.objects.find(item => item.id === objectId);
    const box = base.cameraBoxes?.find(item => item.id === boxId);
    if (!character && !object && !box) return applySpatialOperations(base, [operation]);
    const result = applySpatialOperations({ ...base, characters: character ? [character] : [], objects: object ? [object] : [], cameraBoxes: box ? [box] : [] }, [operation]);
    return { constrained: result.constrained, draft: {
      ...base,
      characters: character ? base.characters.map(item => item.id === characterId ? result.draft.characters[0] : item) : base.characters,
      objects: object ? base.objects.map(item => item.id === objectId ? result.draft.objects[0] : item) : base.objects,
      ...(base.cameraBoxes ? { cameraBoxes: box ? base.cameraBoxes.map(item => item.id === boxId ? result.draft.cameraBoxes![0] : item) : base.cameraBoxes } : {}),
    } };
  };
}
