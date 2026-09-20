"use client";

import { CodeSandboxOutlined, LayoutOutlined, PictureOutlined, PlusOutlined } from "@ant-design/icons";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";

import styles from "../app/page.module.css";

export type HomeSessionKind = "composition" | "ui-sketch" | "spatial";

export interface HomeViewProps {
  labels: Record<HomeSessionKind, string>;
  pending?: HomeSessionKind | null;
  errorMessage?: string | null;
  onCreate: (kind: HomeSessionKind) => void;
}

const entries = [
  { kind: "composition", Icon: PictureOutlined },
  { kind: "ui-sketch", Icon: LayoutOutlined },
  { kind: "spatial", Icon: CodeSandboxOutlined },
] as const;

export function HomeView({ labels, pending, errorMessage, onCreate }: HomeViewProps) {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className={styles.cards}>
          {entries.map(({ kind, Icon }) => (
            <BasicButton
              key={kind}
              className={styles.workspaceEntry}
              disabled={Boolean(pending)}
              aria-busy={pending === kind}
              loading={pending === kind}
              onClick={() => onCreate(kind)}
            >
              <span className={styles.cardBody}>
                <Icon className={styles.cardIcon} aria-hidden="true" />
                <span className={styles.cardLabel}>
                  <PlusOutlined aria-hidden="true" />
                  {labels[kind]}
                </span>
              </span>
            </BasicButton>
          ))}
        </div>
        {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
      </div>
    </main>
  );
}
