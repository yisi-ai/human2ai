export type Human2AiCanvasNodeOrigin = "user" | "agent" | "import";

export interface Human2AiCanvasNodeMetadata {
  origin: Human2AiCanvasNodeOrigin;
  note: string;
  annotation: string;
  semanticType: string;
}

export type Human2AiCanvasNodeMetadataPatch = Partial<Human2AiCanvasNodeMetadata>;

export interface Human2AiCanvasImageCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Human2AiCanvasImageContent {
  assetId: string | null;
  crop: Human2AiCanvasImageCrop | null;
}

export function createHuman2AiCanvasNodeMetadata(): Human2AiCanvasNodeMetadata {
  return {
    origin: "user",
    note: "",
    annotation: "",
    semanticType: "",
  };
}

export function normalizeHuman2AiCanvasNodeMetadata(input: unknown): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  return {
    ...createHuman2AiCanvasNodeMetadata(),
    ...input,
  };
}
