/** Native clipboard payloads survive canvas unmounts and same-app tab changes. */
export function writeCanvasClipboard(
  data: Pick<DataTransfer, "setData">,
  type: string,
  items: unknown,
  images: readonly { assetId: string | null }[] = [],
  resolveSource?: (id: string) => string | undefined,
): string {
  const token = crypto.randomUUID();
  const sources = Object.fromEntries(images.flatMap(image => {
    const src = image.assetId && resolveSource?.(image.assetId);
    return src ? [[image.assetId, src]] : [];
  }));
  data.setData(type, JSON.stringify({ version: 1, token, items, sources }));
  return token;
}

export function readCanvasClipboard<T>(
  data: Pick<DataTransfer, "getData">,
  type: string,
  parse: (value: unknown) => T | null,
): { token: string; items: T; sources: Record<string, string> } | null {
  try {
    const value = JSON.parse(data.getData(type));
    if (value?.version !== 1 || typeof value.token !== "string" || !value.token) return null;
    if (!value.sources || typeof value.sources !== "object" || Array.isArray(value.sources)
      || Object.values(value.sources).some(src => typeof src !== "string")) return null;
    const items = parse(value.items);
    return items === null ? null : { token: value.token, items, sources: value.sources };
  } catch {
    return null;
  }
}

/** Transfer each referenced image once; mutate only the parsed clipboard snapshot. */
export async function transferCanvasClipboardImages(
  images: { assetId: string | null }[],
  sources: Record<string, string>,
  options: {
    origin: string;
    resolveSource?: (id: string) => string | undefined;
    read?: (src: string) => Promise<File>;
    upload?: (file: File) => Promise<string>;
    isCurrent: () => boolean;
  },
): Promise<boolean> {
  for (const id of new Set(images.flatMap(image => image.assetId ? [image.assetId] : []))) {
    if (!options.isCurrent()) return false;
    const source = sources[id];
    if (source && source === options.resolveSource?.(id)) continue;
    if (!source || !options.read || !options.upload) throw new Error("Image transfer is unavailable");
    const url = new URL(source, options.origin);
    if (url.origin !== options.origin || !/^\/api\/v1\/sessions\/[^/]+\/assets\/[^/]+\/content$/.test(url.pathname)) {
      throw new Error("Unsupported clipboard image source");
    }
    const file = await options.read(url.href);
    if (!options.isCurrent()) return false;
    const assetId = await options.upload(file);
    if (!options.isCurrent()) return false;
    for (const image of images) if (image.assetId === id) image.assetId = assetId;
  }
  return options.isCurrent();
}
