import type { Session } from "../session/types.ts";

export const STYLE_CATEGORIES = ["visual", "ui", "spatial"] as const;
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];

export const STYLE_CREATOR_TYPES = ["user", "agent"] as const;
export type StyleCreatorType = (typeof STYLE_CREATOR_TYPES)[number];

export interface StyleReferenceImage {
  id: string;
  styleId: string;
  originalFilename: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  width: number;
  height: number;
  position: number;
  createdAt: string;
}

export interface StyleEntry {
  id: string;
  name: string;
  category: StyleCategory;
  creatorType: StyleCreatorType;
  description: string;
  promptSummary: string;
  referenceImages: StyleReferenceImage[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionStyleState {
  session: Session;
  style: StyleEntry | null;
}
