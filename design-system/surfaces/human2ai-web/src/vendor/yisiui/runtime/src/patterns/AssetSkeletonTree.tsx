"use client";

import { CaretRightOutlined } from "@ant-design/icons";
import { Tree, Typography } from "antd";
import type { TreeDataNode, TreeProps } from "antd";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { StatusBadge } from "../components/StatusBadge";
import type { StatusTone } from "../components/StatusBadge";
import "../../styles/tokens.css";
import "../../styles/asset-skeleton-tree.css";

import {
  groupTreeNodes, sameTreeNode, treeExitDuration, treeInsertDuration, treeTypingDuration,
  useTreeEntries, useTreeReducedMotion, type TreeEntry,
} from "../internal/assetTreeMotion";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

const { Text } = Typography;
const titleSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

export type AssetSkeletonTreeMode = "view" | "edit";
export type AssetSkeletonTreeNodeKind = "container" | "content";

/** Presentation supplied by the caller; the tree owns no workflow statuses. */
export interface AssetSkeletonTreeStatus {
  /** Visible text, or the accessible name and tooltip when an icon is supplied. */
  label: string;
  icon?: ReactNode;
  tone?: StatusTone;
}

export interface AssetSkeletonTreeNode {
  key: string;
  parentKey: string | null;
  order: number;
  nodeKind: AssetSkeletonTreeNodeKind;
  title: string;
  description?: string;
  /** Optional visual tone for the content order number. */
  contentOrderTone?: StatusTone;
  locked?: boolean;
  lockedReason?: string;
  /** Available on both container and content nodes. */
  status?: AssetSkeletonTreeStatus;
  isChanged?: boolean;
  isDeleted?: boolean;
  isNew?: boolean;
  /** Caller-owned badges, counts, or other metadata. */
  trailing?: ReactNode;
  disabled?: boolean;
  extraClassNames?: string[];
}

export interface AssetSkeletonTreeProps
  extends Omit<TreeProps, "treeData" | "className" | "draggable"> {
  /** Stable unique keys; update immutably and keep the tree mounted between requests. */
  nodes: AssetSkeletonTreeNode[];
  /** Animate incremental changes. Initial data is shown immediately. Default: true. */
  animateChanges?: boolean;
  mode: AssetSkeletonTreeMode;
  className?: string;
  currentKey?: string | null;
  maxTitleLength?: number;
  showCurrent?: boolean;
  showContentOrder?: boolean;
  showLock?: boolean;
  /** Defaults to true in view mode and false in edit mode. */
  showStatus?: boolean;
  canDragNode?: (node: AssetSkeletonTreeNode) => boolean;
}

export type AssetSkeletonTreeAllowDropOptions =
  Parameters<NonNullable<TreeProps["allowDrop"]>>[0];
type AssetSkeletonTreeDropIndicatorProps =
  Parameters<NonNullable<TreeProps["dropIndicatorRender"]>>[0];
export type AssetSkeletonTreeDropInfo =
  Parameters<NonNullable<TreeProps["onDrop"]>>[0];

function truncateText(value: string, maxLength: number): string {
  const characters = splitCharacters(value.trim());
  if (characters.length <= maxLength) {
    return value;
  }

  return `${characters.slice(0, Math.max(1, maxLength - 1)).join("")}…`;
}

function splitCharacters(value: string): string[] {
  return Array.from(titleSegmenter.segment(value), (part) => part.segment);
}

const TreeTitleText = memo(function TreeTitleText({ text, fullText, phase, revision }: {
  text: string;
  fullText: string;
  phase: TreeEntry["phase"];
  revision: number;
}) {
  const [visible, setVisible] = useState(text);
  useLayoutEffect(() => {
    if (phase !== "enter" && phase !== "rename") { setVisible(text); return; }
    const characters = splitCharacters(text);
    setVisible("");
    if (!characters.length) return;
    let index = 0;
    let timer: ReturnType<typeof setTimeout>;
    const interval = Math.min(32, treeTypingDuration / characters.length);
    function tick() {
      index++;
      setVisible(characters.slice(0, index).join(""));
      if (index < characters.length) timer = setTimeout(tick, interval);
    }
    timer = setTimeout(tick, (phase === "enter" ? treeInsertDuration : 0) + interval);
    return () => clearTimeout(timer);
  }, [text, phase, revision]);
  return <>
    <span className="yisi-asset-skeleton-tree-state-announcement">{fullText}</span>
    <span aria-hidden="true" className="yisi-asset-skeleton-tree-visible-title">{visible || "\u00a0"}</span>
  </>;
});

function defaultSwitcherIcon(props: { expanded?: boolean; isLeaf?: boolean }): ReactNode {
  if (props.isLeaf) {
    return null;
  }

  return (
    <CaretRightOutlined
      className="yisi-asset-skeleton-tree-switcher"
      rotate={props.expanded ? 90 : 0}
    />
  );
}

function itemClassName(node: AssetSkeletonTreeNode): string {
  return [
    "yisi-asset-skeleton-tree-item",
    `yisi-asset-skeleton-tree-item-${node.nodeKind}`,
    node.locked ? "yisi-asset-skeleton-tree-item-locked" : "",
    node.isChanged ? "yisi-asset-skeleton-tree-item-changed" : "",
    node.isDeleted ? "yisi-asset-skeleton-tree-item-deleted" : "",
    node.isNew ? "yisi-asset-skeleton-tree-item-new" : "",
    ...(node.extraClassNames ?? []),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildContentOrderLabels(nodes: AssetSkeletonTreeNode[]): Map<string, string> {
  const children = groupTreeNodes(nodes);
  const labels = new Map<string, string>();
  let nextOrder = 1;

  function visit(parentKey: string | null): void {
    for (const node of children.get(parentKey) ?? []) {
      if (node.nodeKind === "content" && !node.isDeleted) {
        labels.set(node.key, String(nextOrder).padStart(2, "0"));
        nextOrder += 1;
      }
      visit(node.key);
    }
  }

  visit(null);
  return labels;
}

function renderDropIndicator(style?: CSSProperties): ReactNode {
  return (
    <span
      aria-hidden="true"
      className="yisi-asset-skeleton-tree-drop-indicator"
      style={style}
    >
      <span className="yisi-asset-skeleton-tree-drop-indicator-dot" />
      <span className="yisi-asset-skeleton-tree-drop-indicator-line" />
    </span>
  );
}

function defaultDropIndicatorRender({
  dropPosition,
  dropLevelOffset,
  indent,
}: AssetSkeletonTreeDropIndicatorProps): ReactNode {
  if (dropPosition === 0) {
    return null;
  }

  const positionStyle: CSSProperties =
    dropPosition === -1 ? { top: 0 } : { bottom: 0 };

  return renderDropIndicator({
    ...positionStyle,
    left: -dropLevelOffset * indent,
    right: 0,
  });
}

export function assetSkeletonTreeRelativeDropPosition(
  info: AssetSkeletonTreeDropInfo,
): -1 | 0 | 1 {
  const targetPosition = Number(String(info.node.pos).split("-").pop());
  const relativePosition = info.dropPosition - targetPosition;

  if (relativePosition < 0) {
    return -1;
  }
  if (relativePosition > 0) {
    return 1;
  }
  return 0;
}

export function assetSkeletonTreeCanDrop(
  nodes: AssetSkeletonTreeNode[],
  { dragNode, dropNode, dropPosition }: AssetSkeletonTreeAllowDropOptions,
): boolean {
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
  const dragged = nodeByKey.get(String(dragNode.key));
  const target = nodeByKey.get(String(dropNode.key));

  const canDropAfterLockedContent =
    dragged?.nodeKind === "content" &&
    target?.nodeKind === "content" &&
    target.locked &&
    dropPosition === 1;

  if (
    !dragged ||
    !target ||
    dragged.key === target.key ||
    dragged.disabled ||
    dragged.locked ||
    dragged.isDeleted ||
    target.disabled ||
    target.isDeleted ||
    (target.locked && !canDropAfterLockedContent)
  ) {
    return false;
  }

  let ancestorKey = target.parentKey;
  while (ancestorKey !== null) {
    if (ancestorKey === dragged.key) {
      return false;
    }
    ancestorKey = nodeByKey.get(ancestorKey)?.parentKey ?? null;
  }

  if (dragged.nodeKind === "content") {
    if (target.nodeKind === "container") {
      return dropPosition === 0;
    }

    return target.nodeKind === "content" && dropPosition !== 0;
  }

  return target.nodeKind === "container" &&
    (dropPosition === 0 || dragged.parentKey === target.parentKey);
}

const TreeNodeTitle = memo(function TreeNodeTitle({
  node, phase, revision, mode, maxTitleLength, isCurrent, shouldShowLock, shouldShowStatus,
}: {
  node: AssetSkeletonTreeNode;
  phase: TreeEntry["phase"];
  revision: number;
  mode: AssetSkeletonTreeMode;
  maxTitleLength: number;
  isCurrent: boolean;
  shouldShowLock: boolean;
  shouldShowStatus: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = root.current?.closest<HTMLElement>(".ant-tree-treenode");
    if (!row) return;
    if (phase === "exit" && row.contains(document.activeElement)) {
      row.closest(".ant-tree")?.querySelector<HTMLElement>('[role="tree"]')?.focus({ preventScroll: true });
    }
    row.inert = phase === "exit";
    if ((phase !== "enter" && phase !== "exit") || !row.animate) return;
    const height = row.getBoundingClientRect().height;
    const style = getComputedStyle(row);
    const expanded = { height: `${height}px`, minHeight: "0px", overflow: "hidden", marginTop: style.marginTop, marginBottom: style.marginBottom };
    const collapsed = { height: "0px", minHeight: "0px", overflow: "hidden", marginTop: "0px", marginBottom: "0px", opacity: 0 };
    const frames: Keyframe[] = phase === "enter" ? [
      collapsed,
      { ...expanded, opacity: 0, offset: 0.75 },
      { ...expanded, opacity: 1 },
    ] : [
      { ...expanded, opacity: 1 },
      { ...expanded, opacity: 0, offset: 0.4 },
      collapsed,
    ];
    const animation = row.animate(frames, {
      duration: phase === "enter" ? treeInsertDuration + 60 : treeExitDuration,
      easing: "ease-in-out", fill: "both",
    });
    return () => { animation.cancel(); row.inert = false; };
  }, [phase]);
  const shouldShowChangeState = mode === "edit";
  const title = truncateText(node.title, maxTitleLength);
  const hasTrailingContent = Boolean(
    node.trailing || isCurrent || (shouldShowStatus && node.status),
  );

  return (
    <div
      ref={root}
      className={[
        "yisi-asset-skeleton-tree-node",
        `yisi-asset-skeleton-tree-node-${mode}`,
        `yisi-asset-skeleton-tree-node-${node.nodeKind}`,
        node.isDeleted ? "yisi-asset-skeleton-tree-node-deleted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      title={node.title}
    >
      {node.isChanged ? (
        <span className="yisi-asset-skeleton-tree-state-announcement">已变动</span>
      ) : null}
      {shouldShowChangeState && node.isDeleted ? (
        <StatusBadge label="[del]" tone="danger" mode="text-only" />
      ) : shouldShowChangeState && node.isNew ? (
        <StatusBadge label="[new]" tone="success" mode="text-only" />
      ) : null}
      {shouldShowLock && node.locked ? (
        <StatusBadge
          label="锁定"
          tone="warning"
          mode="text-only"
          tooltip={node.lockedReason || "已锁定"}
        />
      ) : null}
      <div className="yisi-asset-skeleton-tree-copy">
        <Text
          strong={node.nodeKind === "container"}
          ellipsis
          title={node.title}
          className="yisi-asset-skeleton-tree-title"
        >
          <TreeTitleText text={title} fullText={node.title} phase={phase} revision={revision} />
        </Text>
      </div>
      {node.nodeKind === "container" && node.description ? (
        <Text
          ellipsis
          title={node.description}
          className="yisi-asset-skeleton-tree-description"
        >
          {node.description}
        </Text>
      ) : null}
      {hasTrailingContent ? (
        <span className="yisi-asset-skeleton-tree-trailing-area">
          {node.trailing ? (
            <span className="yisi-asset-skeleton-tree-trailing">{node.trailing}</span>
          ) : null}
          {isCurrent ? (
            <StatusBadge label="当前" tone="success" mode="text-only" />
          ) : null}
          {shouldShowStatus && node.status ? (
            <StatusBadge
              label={node.status.label}
              tone={node.status.tone}
              icon={node.status.icon}
              mode={node.status.icon ? "icon-only" : "text-only"}
            />
          ) : null}
        </span>
      ) : null}
    </div>
  );
}, (previous, next) => sameTreeNode(previous.node, next.node, true) &&
  previous.phase === next.phase && previous.revision === next.revision && previous.mode === next.mode &&
  previous.maxTitleLength === next.maxTitleLength && previous.isCurrent === next.isCurrent &&
  previous.shouldShowLock === next.shouldShowLock && previous.shouldShowStatus === next.shouldShowStatus);

export function AssetSkeletonTree({
  nodes,
  animateChanges = true,
  mode,
  className,
  currentKey = null,
  maxTitleLength = 24,
  showCurrent,
  showContentOrder = true,
  showLock,
  showStatus,
  canDragNode,
  switcherIcon,
  allowDrop: allowDropProp,
  dropIndicatorRender: dropIndicatorRenderProp,
  onDragStart: onDragStartProp,
  onDragEnd: onDragEndProp,
  onDragLeave: onDragLeaveProp,
  onDragOver: onDragOverProp,
  onDrop: onDropProp,
  ...treeProps
}: AssetSkeletonTreeProps) {
  const root = useRef<HTMLDivElement>(null);
  const reducedMotion = useTreeReducedMotion();
  const entries = useTreeEntries(nodes, animateChanges && !reducedMotion);
  const [activeKey, setActiveKey] = useState<React.Key | null>(null);
  const navigationDirection = useRef(1);
  const [recentlyMovedKey, setRecentlyMovedKey] = useState<string | null>(null);
  const scrollStopTimer = useRef<number | null>(null);
  const movedNodeTimer = useRef<number | null>(null);
  const shouldShowCurrent = showCurrent ?? mode === "view";
  const shouldShowLock = showLock ?? mode === "edit";
  const shouldShowStatus = showStatus ?? mode === "view";
  const contentOrderLabels = useMemo(() => buildContentOrderLabels(nodes), [nodes]);
  const nodeByKey = useMemo(() => new Map(nodes.map((node) => [node.key, node])), [nodes]);
  const nodeDraggable = (data: TreeDataNode): boolean => {
    const node = nodeByKey.get(String(data.key));
    return Boolean(
      node &&
        !node.locked &&
        !node.disabled &&
        !node.isDeleted &&
        (canDragNode?.(node) ?? true),
    );
  };
  const allowDrop =
    mode === "edit"
      ? (options: AssetSkeletonTreeAllowDropOptions) =>
          assetSkeletonTreeCanDrop(nodes, options) && (allowDropProp?.(options) ?? true)
      : allowDropProp;

  useEffect(() => {
    return () => {
      if (scrollStopTimer.current !== null) {
        window.clearTimeout(scrollStopTimer.current);
      }
      if (movedNodeTimer.current !== null) {
        window.clearTimeout(movedNodeTimer.current);
      }
    };
  }, []);

  function handleScroll(): void {
    root.current?.classList.add("yisi-asset-skeleton-tree-scrolling");
    if (scrollStopTimer.current !== null) {
      window.clearTimeout(scrollStopTimer.current);
    }
    scrollStopTimer.current = window.setTimeout(() => {
      root.current?.classList.remove("yisi-asset-skeleton-tree-scrolling");
      scrollStopTimer.current = null;
    }, 700);
  }

  function handleDrop(info: AssetSkeletonTreeDropInfo): void {
    setRecentlyMovedKey(String(info.dragNode.key));
    if (movedNodeTimer.current !== null) {
      window.clearTimeout(movedNodeTimer.current);
    }
    movedNodeTimer.current = window.setTimeout(() => {
      setRecentlyMovedKey(null);
      movedNodeTimer.current = null;
    }, 720);
    onDropProp?.(info);
  }

  function handleDragStart(
    info: Parameters<NonNullable<TreeProps["onDragStart"]>>[0],
  ): void {
    onDragStartProp?.(info);
  }

  function handleDragEnd(
    info: Parameters<NonNullable<TreeProps["onDragEnd"]>>[0],
  ): void {
    onDragEndProp?.(info);
  }

  function handleDragLeave(
    info: Parameters<NonNullable<TreeProps["onDragLeave"]>>[0],
  ): void {
    onDragLeaveProp?.(info);
  }

  function handleDragOver(
    info: Parameters<NonNullable<TreeProps["onDragOver"]>>[0],
  ): void {
    onDragOverProp?.(info);
  }

  const treeData = useMemo(() => {
    function renderNodeSwitcher(node: AssetSkeletonTreeNode): ReactNode | undefined {
      if (!showContentOrder || node.nodeKind !== "content") {
        return undefined;
      }

      const contentOrderLabel = contentOrderLabels.get(node.key);
      return (
        <span
          className={[
            "yisi-asset-skeleton-tree-content-order",
            contentOrderLabel ? "" : "yisi-asset-skeleton-tree-content-order-empty",
          ]
            .filter(Boolean)
            .join(" ")}
          aria-hidden={contentOrderLabel ? undefined : true}
        >
          {contentOrderLabel ? (
            <StatusBadge
              label={contentOrderLabel}
              tone={node.contentOrderTone ?? "default"}
              mode="text-only"
              tooltip={`内容顺序 ${contentOrderLabel}`}
            />
          ) : null}
        </span>
      );
    }

    const groups = new Map<string | null, TreeEntry[]>();
    for (const entry of entries) {
      const siblings = groups.get(entry.node.parentKey) ?? [];
      siblings.push(entry);
      groups.set(entry.node.parentKey, siblings);
    }
    function build(parent: string | null): TreeDataNode[] {
      return (groups.get(parent) ?? []).map(({ node, phase, revision }) => {
        const children = build(node.key);
        const exiting = phase === "exit";
        return {
          key: node.key,
          title: <TreeNodeTitle node={node} phase={phase} revision={revision} mode={mode}
            maxTitleLength={maxTitleLength} isCurrent={shouldShowCurrent && currentKey === node.key}
            shouldShowLock={shouldShowLock} shouldShowStatus={shouldShowStatus} />,
          switcherIcon: renderNodeSwitcher(node),
          disabled: Boolean(node.disabled || exiting),
          ...(exiting ? { selectable: false, checkable: false, "aria-hidden": true } : {}),
          "data-yisi-tree-key": node.key,
          "data-yisi-tree-phase": phase,
          className: [itemClassName(node),
            node.key === currentKey ? "yisi-asset-skeleton-tree-item-current" : "",
            node.key === recentlyMovedKey ? "yisi-asset-skeleton-tree-item-moved" : "",
          ].filter(Boolean).join(" "),
          isLeaf: children.length === 0,
          children: children.length ? children : undefined,
        };
      });
    }
    return build(null);
  }, [entries, mode, maxTitleLength, shouldShowCurrent, currentKey, shouldShowLock,
    shouldShowStatus, showContentOrder, contentOrderLabels, recentlyMovedKey]);

  const requestedActiveKey = treeProps.activeKey !== undefined ? treeProps.activeKey : activeKey;
  const liveActiveKey = requestedActiveKey != null && nodeByKey.has(String(requestedActiveKey)) ? requestedActiveKey : null;
  function handleActiveChange(key: React.Key | null) {
    let next = key;
    if (key != null && !nodeByKey.has(String(key))) {
      const rows = [...(root.current?.querySelectorAll<HTMLElement>("[data-yisi-tree-key]") ?? [])];
      const start = rows.findIndex((row) => row.dataset.yisiTreeKey === String(key));
      next = null;
      for (let step = 1; step <= rows.length; step++) {
        const candidate = rows[(start + step * navigationDirection.current + rows.length) % rows.length]?.dataset.yisiTreeKey;
        if (candidate && nodeByKey.has(candidate)) { next = candidate; break; }
      }
    }
    setActiveKey(next);
    // rc-tree's public callback type omits null, although it emits null on mouse movement.
    treeProps.onActiveChange?.(next as React.Key);
  }

  return (
    <div
      ref={root}
      onKeyDownCapture={(event) => { navigationDirection.current = event.key === "ArrowUp" || event.key === "End" ? -1 : 1; }}
      {...uiAssetAttributes("asset-skeleton-tree", "AssetSkeletonTree", "tree-pattern")}
      className={[
        "yisi-asset-skeleton-tree",
        `yisi-asset-skeleton-tree-${mode}`,
        showContentOrder ? "yisi-asset-skeleton-tree-content-order-layout" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-mode={mode}
      onScroll={handleScroll}
    >
      <Tree
        blockNode
        {...treeProps}
        className="yisi-asset-skeleton-tree-control"
        allowDrop={allowDrop}
        draggable={
          mode === "edit"
            ? { icon: false, nodeDraggable }
            : false
        }
        dropIndicatorRender={dropIndicatorRenderProp ?? defaultDropIndicatorRender}
        expandAction={treeProps.expandAction ?? "click"}
        onDragStart={mode === "edit" ? handleDragStart : onDragStartProp}
        onDragEnd={mode === "edit" ? handleDragEnd : onDragEndProp}
        onDragLeave={mode === "edit" ? handleDragLeave : onDragLeaveProp}
        onDragOver={mode === "edit" ? handleDragOver : onDragOverProp}
        onDrop={mode === "edit" ? handleDrop : onDropProp}
        switcherIcon={switcherIcon ?? defaultSwitcherIcon}
        activeKey={liveActiveKey}
        onActiveChange={handleActiveChange}
        treeData={treeData}
      />
    </div>
  );
}
