interface ImageClipboard {
  items: ArrayLike<Pick<DataTransferItem, "kind" | "type" | "getAsFile">>;
  files: ArrayLike<File>;
}

export function getClipboardImage(clipboard: ImageClipboard): File | null {
  for (const item of Array.from(clipboard.items)) {
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return Array.from(clipboard.files).find((file) => file.type.startsWith("image/")) ?? null;
}

export function fitPastedImage(width: number, height: number) {
  const scale = Math.min(1, 320 / Math.max(width, height));
  return { width: width * scale, height: height * scale };
}

export async function readPastedImageSize(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return fitPastedImage(image.naturalWidth, image.naturalHeight);
  } finally {
    URL.revokeObjectURL(url);
  }
}
