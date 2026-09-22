import { createSpatialScene, disposeSpatialScene } from "../../../../../src/domain/spatial/scene";
import { applySpatialContactShading } from "../../../../../src/domain/spatial/lighting";
import type { SpatialDraft } from "../../../../../src/domain/spatial/types";

const worker = globalThis as unknown as {
  onmessage: (event: MessageEvent<SpatialDraft>) => void;
  postMessage(message: { colors: Float32Array[] }, transfer: ArrayBuffer[]): void;
};
worker.onmessage = ({ data: draft }) => {
  const scene = createSpatialScene(draft);
  try {
    const colors = applySpatialContactShading(scene, draft);
    worker.postMessage({ colors }, colors.map(color => color.buffer as ArrayBuffer));
  } finally { disposeSpatialScene(scene); }
};
