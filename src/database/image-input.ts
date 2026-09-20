import sharp from "sharp";

import { isSelfContainedSvg } from "./svg-input.ts";

export const MAX_IMAGE_ASSET_BYTES = 10 * 1024 * 1024;

interface ImageInputMetadata {
  format: "png" | "jpeg" | "webp" | "svg";
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/svg+xml";
  width: number;
  height: number;
}

export async function inspectImageInput(data: Buffer, options: { allowSvg?: boolean } = {}): Promise<
  { image: ImageInputMetadata } | { error: "size" | "format" }
> {
  if (data.byteLength === 0 || data.byteLength > MAX_IMAGE_ASSET_BYTES) {
    return { error: "size" };
  }
  const xml = data.toString("utf8").trimStart().startsWith("<");
  const svg = xml && options.allowSvg && isSelfContainedSvg(data);
  if (xml && !svg) return { error: "format" };
  const metadata = await sharp(data, { animated: false }).metadata().catch(() => null);
  const format = metadata?.format;
  const width = metadata?.width;
  const height = metadata?.height;
  if ((format !== "png" && format !== "jpeg" && format !== "webp" && !(format === "svg" && svg)) || !width || !height) {
    return { error: "format" };
  }
  return {
    image: {
      format,
      mimeType: format === "svg" ? "image/svg+xml" : `image/${format}`,
      width,
      height,
    },
  };
}
