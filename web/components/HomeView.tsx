"use client";

import { useRef, useState } from "react";
import { CodeSandboxOutlined, GithubOutlined, LayoutOutlined, PictureOutlined, PlusOutlined } from "@ant-design/icons";
import { ActionButton } from "@human2ai/ui/yisiui/action-button";
import { AnimatedIcon, type AnimatedIconHandle } from "@human2ai/ui/yisiui/animated-icon";
import { BasicButton } from "@human2ai/ui/yisiui/basic-button";
import { UnderlineTabSwitch } from "@human2ai/ui/yisiui/underline-tab-switch";

import styles from "../app/page.module.css";

export type HomeSessionKind = "composition" | "ui-sketch" | "spatial";

export const HOME_SKILL_INSTALL_COMMAND = "npx skills add yisi-ai/human2ai --skill human2ai";

export interface HomeViewProps {
  productName: string;
  repositoryLabel: string;
  description: string;
  skillInstallation: {
    title: string;
    agentTab: string;
    cliTab: string;
    agentPrompt: string;
    copy: string;
    copying: string;
    copied: string;
    copyFailed: string;
  };
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

export function HomeView({ productName, repositoryLabel, description, skillInstallation, labels, pending, errorMessage, onCreate }: HomeViewProps) {
  const [installationMethod, setInstallationMethod] = useState("agent");
  const copyIconRef = useRef<AnimatedIconHandle>(null);
  const installationContent = installationMethod === "agent"
    ? skillInstallation.agentPrompt
    : HOME_SKILL_INSTALL_COMMAND;

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.introduction}>
          <div className={styles.brand}>
            <img src="/brand/h2a.svg" alt="" width={64} height={64} />
            <h1 className={styles.productName}>{productName}</h1>
            <BasicButton
              className={styles.repositoryLink}
              type="link"
              mode="icon-only"
              icon={<GithubOutlined aria-hidden="true" />}
              href="https://github.com/yisi-ai/human2ai"
              target="_blank"
              rel="noopener noreferrer"
              title={repositoryLabel}
              iconLabel={repositoryLabel}
            />
          </div>
          <p className={styles.description}>{description}</p>
        </header>
        <section className={styles.installation} aria-label={skillInstallation.title}>
          <div className={styles.installationHeader}>
            <h2 className={styles.installationTitle}>{skillInstallation.title}</h2>
            <UnderlineTabSwitch
              aria-label={skillInstallation.title}
              value={installationMethod}
              onChange={setInstallationMethod}
              items={[
                { key: "agent", label: skillInstallation.agentTab },
                { key: "cli", label: skillInstallation.cliTab },
              ]}
            />
          </div>
          <div
            className={styles.installationPanel}
            role="tabpanel"
            aria-label={installationMethod === "agent" ? skillInstallation.agentTab : skillInstallation.cliTab}
            tabIndex={0}
          >
            <pre className={styles.installationContent}><code>{installationContent}</code></pre>
            <div className={styles.installationActions}>
              <ActionButton
                key={installationMethod}
                className={styles.installationCopy}
                size="small"
                title={skillInstallation.copy}
                label={skillInstallation.copy}
                pendingLabel={skillInstallation.copying}
                successLabel={skillInstallation.copied}
                errorLabel={skillInstallation.copyFailed}
                idleIcon={<AnimatedIcon ref={copyIconRef} name="copy" size={18} />}
                onMouseEnter={() => copyIconRef.current?.play()}
                onFocus={() => copyIconRef.current?.play()}
                onAction={() => navigator.clipboard.writeText(installationContent)}
              />
            </div>
          </div>
        </section>
        {errorMessage ? <p className={styles.error} role="alert">{errorMessage}</p> : null}
        <div className={styles.cards} data-home-create-actions>
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
      </div>
    </main>
  );
}
