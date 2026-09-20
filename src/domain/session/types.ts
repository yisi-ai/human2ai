export const SESSION_TYPES = ["image-composition", "ui-layout", "spatial"] as const;

export type SessionType = (typeof SESSION_TYPES)[number];
export type SessionLifecycleStage = "draft" | "interpreted" | "approved" | "exported";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  revision: number;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  projectId: string | null;
  styleId: string | null;
  sessionType: SessionType;
  title: string;
  lifecycleStage: SessionLifecycleStage;
  revision: number;
  createdAt: string;
  updatedAt: string;
}
