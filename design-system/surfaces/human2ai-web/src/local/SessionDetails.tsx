"use client";

import { CopyOutlined } from "@ant-design/icons";
import type { CSSProperties, ReactNode } from "react";
import { useId, useState } from "react";

import { ActionButton } from "../vendor/yisiui/runtime/src/components/ActionButton";
import { uiAssetAttributes } from "../vendor/yisiui/runtime/src/assetMarker";

import "./SessionDetails.css";

export interface SessionDetailsLabels {
  title: string;
  created: string;
  updated: string;
  nodes: string;
  agent: string;
  copyCommand: string;
  copying: string;
  copied: string;
  copyFailed: string;
  emptyValue: string;
}

export interface SessionDetailsProps {
  primaryItem?: {
    label: string;
    value: ReactNode;
  };
  createdAt: string | null;
  updatedAt: string | null;
  nodeCount: number;
  agentCommand: string | (() => Promise<string>) | null;
  locale: string;
  labels: SessionDetailsLabels;
  writeText?: (content: string) => Promise<void>;
  className?: string;
  style?: CSSProperties;
}

async function writeToClipboard(content: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API unavailable.");
  }
  await navigator.clipboard.writeText(content);
}

function formatTimestamp(
  value: string | null,
  locale: string,
  emptyValue: string,
): string {
  if (!value) return emptyValue;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyValue;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function SessionDetails({
  primaryItem,
  createdAt,
  updatedAt,
  nodeCount,
  agentCommand,
  locale,
  labels,
  writeText = writeToClipboard,
  className,
  style,
}: SessionDetailsProps) {
  const headingId = useId();
  const [copyError, setCopyError] = useState<string | null>(null);

  return (
    <section
      {...uiAssetAttributes({
        namespace: "human2ai",
        id: "session-details",
        name: "SessionDetails",
        category: "module",
        origin: "project",
        status: "candidate",
      })}
      aria-labelledby={headingId}
      className={["human2ai-session-details", className].filter(Boolean).join(" ")}
      style={style}
    >
      <h2 id={headingId}>{labels.title}</h2>
      <dl className="human2ai-session-details__list">
        {primaryItem ? (
          <div className="human2ai-session-details__row">
            <dt>{primaryItem.label}</dt>
            <dd>{primaryItem.value}</dd>
          </div>
        ) : null}
        <div className="human2ai-session-details__row">
          <dt>{labels.created}</dt>
          <dd>
            {createdAt ? (
              <time dateTime={createdAt}>
                {formatTimestamp(createdAt, locale, labels.emptyValue)}
              </time>
            ) : labels.emptyValue}
          </dd>
        </div>
        <div className="human2ai-session-details__row">
          <dt>{labels.updated}</dt>
          <dd>
            {updatedAt ? (
              <time dateTime={updatedAt}>
                {formatTimestamp(updatedAt, locale, labels.emptyValue)}
              </time>
            ) : labels.emptyValue}
          </dd>
        </div>
        <div className="human2ai-session-details__row">
          <dt>{labels.nodes}</dt>
          <dd className="human2ai-session-details__value">{nodeCount}</dd>
        </div>
        <div className="human2ai-session-details__row human2ai-session-details__row--agent">
          <dt>{labels.agent}</dt>
          <dd>
            <ActionButton
              className="human2ai-session-details__action-button"
              size="small"
              label={labels.copyCommand}
              pendingLabel={labels.copying}
              successLabel={labels.copied}
              errorLabel={labels.copyFailed}
              disabled={!agentCommand}
              idleIcon={<CopyOutlined />}
              onAction={async () => {
                const content = typeof agentCommand === "function"
                  ? await agentCommand()
                  : agentCommand;
                if (!content?.trim()) throw new Error("Agent command is empty.");
                await writeText(content);
              }}
              onStatusChange={(status) => {
                if (status === "success") setCopyError(null);
              }}
              onActionError={() => setCopyError(labels.copyFailed)}
            />
          </dd>
        </div>
      </dl>
      {copyError ? (
        <p className="human2ai-session-details__error" role="alert">
          {copyError}
        </p>
      ) : null}
    </section>
  );
}
