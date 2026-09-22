import { expect, it } from "vitest";
import { applySpatialOperations, createHumanoid, createSpatialDraft, type SpatialOperation } from "../../src/domain/spatial/index.ts";
import { createSpatialPreview } from "../../src/domain/spatial/preview.ts";

it("previews share committed pose and constraint rules without copying unrelated characters per frame", () => {
  const draft = createSpatialDraft();
  draft.characters = [createHumanoid("a", "A"), createHumanoid("b", "B")];
  const preview = createSpatialPreview(draft), original = structuredClone(draft);
  const operations: SpatialOperation[] = [
    { type: "put-character", character: { ...draft.characters[0], position: [1,2,3] } },
    { type: "rotate-bone", characterId: "a", boneId: "left-elbow", rotation: [20,0,0] },
    { type: "pose-hand", characterId: "a", handBoneId: "left-hand", curl: { index: .4 } },
    { type: "set-proportions", characterId: "a", height: 1.8, headRatio: 5 },
  ];
  const retained = preview(operations[0]).draft.characters[1];
  for (const operation of operations) {
    const result = preview(operation);
    expect(result).toEqual(applySpatialOperations(draft, [operation]));
    expect(result.draft.characters[1]).toBe(retained);
  }
  expect(draft).toEqual(original);
});

it("preserves locked world positions and rejects malformed gesture snapshots", () => {
  const draft = createSpatialDraft(); draft.characters = [createHumanoid("a", "A")];
  const locked = applySpatialOperations(draft, [{ type: "lock-joint", characterId: "a", jointId: "left-wrist", position: true }]).draft;
  const operation: SpatialOperation = { type: "put-character", character: { ...locked.characters[0], position: [1,2,3] } };
  expect(() => createSpatialPreview(locked)(operation)).toThrow();
  expect(() => createSpatialPreview({ ...draft, characters: [...draft.characters, draft.characters[0]] })).toThrow();
});
