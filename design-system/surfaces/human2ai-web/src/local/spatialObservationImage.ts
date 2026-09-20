import { SPATIAL_BOX_LABEL_HEIGHT, type SpatialBoxFace } from "../../../../../src/domain/spatial/types";
import { cameraBoxSheetLayout } from "../../../../../src/domain/spatial/camera-box-sheet";

/** Compose the selected immutable face previews without changing their framing. */
export async function renderSpatialObservationImage(views: readonly { face: SpatialBoxFace; source: string; label: string }[], resolution: number): Promise<Blob> {
  const images = await Promise.all(views.map(view => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("observation-image-load-failed"));
    image.src = view.source;
  })));
  const { width, height, tiles } = cameraBoxSheetLayout(resolution, views.map(view => view.face));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("observation-image-canvas-unavailable");
  context.font = "14px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  images.forEach((image, index) => {
    const { left: x, top: y } = tiles[index];
    context.fillStyle = "#f1f3f5";
    context.fillRect(x, y, resolution, SPATIAL_BOX_LABEL_HEIGHT);
    context.fillStyle = "#374151";
    context.fillText(views[index].label, x + resolution / 2, y + SPATIAL_BOX_LABEL_HEIGHT / 2, resolution - 8);
    context.drawImage(image, x, y + SPATIAL_BOX_LABEL_HEIGHT, resolution, resolution);
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("observation-image-export-failed")), "image/png");
  });
}
