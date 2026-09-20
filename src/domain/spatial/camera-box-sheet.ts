import { SPATIAL_BOX_FACES, SPATIAL_BOX_GAP, SPATIAL_BOX_LABEL_HEIGHT, type SpatialBoxFace } from "./types.ts";

/** Parse a nonempty, unique face selection while retaining the caller's order. */
export function parseSpatialBoxViews(value: string): SpatialBoxFace[] | null {
  const faces = value.split(",").map(face => face.trim());
  if (faces.length > SPATIAL_BOX_FACES.length || new Set(faces).size !== faces.length) return null;
  return faces.every((face): face is SpatialBoxFace => SPATIAL_BOX_FACES.some(allowed => allowed === face)) ? faces : null;
}

/** Layout a validated selection of 1–6 faces for browser and service PNG output. */
export function cameraBoxSheetLayout(resolution: number, faces: readonly SpatialBoxFace[]) {
  const columns = Math.min(3, faces.length), rows = Math.ceil(faces.length / columns);
  return {
    columns,
    rows,
    width: columns * resolution + (columns - 1) * SPATIAL_BOX_GAP,
    height: rows * (resolution + SPATIAL_BOX_LABEL_HEIGHT) + (rows - 1) * SPATIAL_BOX_GAP,
    tiles: faces.map((face, index) => ({
      face,
      left: index % columns * (resolution + SPATIAL_BOX_GAP),
      top: Math.floor(index / columns) * (resolution + SPATIAL_BOX_LABEL_HEIGHT + SPATIAL_BOX_GAP),
    })),
  };
}
