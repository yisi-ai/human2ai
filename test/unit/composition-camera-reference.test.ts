import { expect, it } from "vitest";
import { createDraft, draftFingerprint } from "../../src/domain/composition/index.js";
import { addCameraReference, refreshCameraReference, snapshotCameraReference } from "../../src/domain/composition/camera-reference.js";

it("keeps a live reference and saves an independent PNG node without losing layout or metadata", () => {
  const added = addCameraReference(createDraft(), { sessionId: "space", cameraId: "camera", revision: 2, assetId: "png", width: 1200, height: 900 });
  const source = added.draft.images[0]; source.note = "pose";
  const snapshot = snapshotCameraReference(added.draft, source.id);
  expect(snapshot.draft.images).toHaveLength(2);
  expect(snapshot.draft.images[0]).toEqual(source);
  expect(snapshot.draft.images[1]).toMatchObject({ assetId: "png", note: "pose", width: source.width, height: source.height });
  expect(snapshot.draft.images[1].cameraReference).toBeUndefined();
  snapshot.draft.images[0].assetId = "updated-png";
  expect(snapshot.draft.images[1].assetId).toBe("png");
  expect(draftFingerprint(snapshot.draft)).not.toBe(draftFingerprint(added.draft));
});

it("follows an explicit camera aspect change without cropping its frame or changing the PNG snapshot", () => {
  const source = { sessionId: "space", cameraId: "camera", revision: 1, assetId: "old", width: 1200, height: 900 };
  const added = addCameraReference(createDraft(), source);
  const input = snapshotCameraReference(added.draft, added.id).draft;
  input.images[0].note = "keep this pose";
  const changed = refreshCameraReference(input, { ...source, revision: 2, assetId: "new", width: 900, height: 900 });
  expect(changed.images[0]).toMatchObject({ x: input.images[0].x, y: input.images[0].y, width: input.images[0].width, note: "keep this pose", assetId: "new" });
  expect(changed.images[0].width * 1200).toBeCloseTo(changed.images[0].height * 800);
  expect(changed.images[1]).toEqual(input.images[1]);
  const portrait = addCameraReference(createDraft(), { ...source, width: 128, height: 2048 }).draft.images[0];
  expect(portrait.height * 800).toBeCloseTo(320);
});
