import type { SessionType } from "./types.ts";

export type SessionOperationMode = "read" | "derive" | "artifact";

export interface SessionOperationDefinition {
  id: string;
  mode: SessionOperationMode;
  command: readonly string[];
  sessionScoped: boolean;
  sourceCaptureKind?: string;
}

export interface SessionTypeDefinition {
  sessionType: SessionType;
  captureKind: "composition-draft" | "ui-layout-draft" | "spatial-draft";
  uiPath: string;
  operations: readonly SessionOperationDefinition[];
}

const SESSION_TYPE_DEFINITIONS: Record<SessionType, SessionTypeDefinition> = {
  spatial: {
    sessionType: "spatial", captureKind: "spatial-draft", uiPath: "/spatial/",
    operations: [
      { id: "spatial.methods@1", mode: "read", command: ["spatial", "methods"], sessionScoped: false },
      { id: "spatial.inspect@1", mode: "read", command: ["spatial", "inspect", "--revision", "<revision>"], sessionScoped: true, sourceCaptureKind: "spatial-draft" },
      { id: "spatial.apply@1", mode: "derive", command: ["spatial", "apply", "--revision", "<revision>", "--input", "<operations.json>"], sessionScoped: true, sourceCaptureKind: "spatial-draft" },
      { id: "spatial.render@1", mode: "artifact", command: ["spatial", "render", "--revision", "<revision>", "--camera", "<camera-id>", "--output", "<preview.png>"], sessionScoped: true, sourceCaptureKind: "spatial-draft" },
      { id: "spatial.render-box@1", mode: "artifact", command: ["spatial", "render", "--revision", "<revision>", "--box", "<box-id>", "--view", "sheet", "--output", "<six-views.png>"], sessionScoped: true, sourceCaptureKind: "spatial-draft" },
      { id: "spatial.render-box-views@1", mode: "artifact", command: ["spatial", "render", "--revision", "<revision>", "--box", "<box-id>", "--views", "<views>", "--output", "<observation.png>"], sessionScoped: true, sourceCaptureKind: "spatial-draft" },
    ],
  },
  "image-composition": {
    sessionType: "image-composition",
    captureKind: "composition-draft",
    uiPath: "/composition/",
    operations: [
      {
        id: "composition.methods@1",
        mode: "read",
        command: ["composition", "methods"],
        sessionScoped: false,
      },
      {
        id: "composition.inspect@1",
        mode: "read",
        command: ["composition", "inspect", "--revision", "<revision>"],
        sessionScoped: true,
        sourceCaptureKind: "composition-draft",
      },
      {
        id: "composition.refine@1",
        mode: "derive",
        command: [
          "composition",
          "apply",
          "--revision",
          "<revision>",
          "--plan",
          "<plan.json>",
        ],
        sessionScoped: true,
        sourceCaptureKind: "composition-draft",
      },
      {
        id: "composition.reference@1",
        mode: "artifact",
        command: [
          "composition",
          "reference",
          "--run",
          "<run-id>",
          "--output",
          "<reference.png>",
        ],
        sessionScoped: true,
      },
    ],
  },
  "ui-layout": {
    sessionType: "ui-layout",
    captureKind: "ui-layout-draft",
    uiPath: "/ui-sketch/",
    operations: [
      {
        id: "ui-layout.render@1",
        mode: "artifact",
        command: ["ui-layout", "render", "--revision", "<revision>", "--state", "<state-id>", "--output", "<preview.png>"],
        sessionScoped: true,
        sourceCaptureKind: "ui-layout-draft",
      },
      {
        id: "ui-layout.standardize@1",
        mode: "derive",
        command: ["ui-layout", "standardize", "--input", "<document.json>", "--output", "<standardized.json>"],
        sessionScoped: false,
        sourceCaptureKind: "ui-layout-draft",
      },
    ],
  },
};

export function sessionTypeDefinition(type: SessionType): SessionTypeDefinition {
  return SESSION_TYPE_DEFINITIONS[type];
}
