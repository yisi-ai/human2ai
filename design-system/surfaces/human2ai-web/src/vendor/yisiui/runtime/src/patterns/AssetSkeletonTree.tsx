"use client";

import {
  CaretRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  InboxOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import { Tree, Typography } from "antd";
import type { TreeDataNode, TreeProps } from "antd";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { StatusBadge } from "../components/StatusBadge";
import type { StatusTone } from "../components/StatusBadge";
import "../../styles/tokens.css";
import "../../styles/asset-skeleton-tree.css";

import { uiAssetAttributes } from "../internal/uiAssetAttributes";

const { Text } = Typography;

export type AssetSkeletonTreeMode = "view" | "edit";
export type AssetSkeletonTreeNodeKind = "container" | "content";
export type AssetSkeletonTreeStatus =
  | "planned"
  | "ready"
  | "drafted"
  | "review_needed"
  | "completed"
  | "archived";

export interface AssetSkeletonTreeNode {
  key: string;
  parentKey: string | null;
  order: number;
  nodeKind: AssetSkeletonTreeNodeKind;
  title: string;
  description?: string;
  hasDraft?: boolean;
  openTodoCount?: number;
  locked?: boolean;
  lockedReason?: string;
  status?: AssetSkeletonTreeStatus;
  isChanged?: boolean;
  isDeleted?: boolean;
  isNew?: boolean;
  trailing?: ReactNode;
  disabled?: boolean;
  extraClassNames?: string[];
}

export interface AssetSkeletonTreeProps
  extends Omit<TreeProps, "treeData" | "className" | "draggable"> {
  nodes: AssetSkeletonTreeNode[];
  mode: AssetSkeletonTreeMode;
  className?: string;
  currentKey?: string | null;
  maxTitleLength?: number;
  showCurrent?: boolean;
  showContentOrder?: boolean;
  showDraft?: boolean;
  showLock?: boolean;
  showStatus?: boolean;
  canDragNode?: (node: AssetSkeletonTreeNode) => boolean;
}

export const ASSET_SKELETON_TREE_STATUS_LABELS: Record<AssetSkeletonTreeStatus, string> = {
  planned: "计划中",
  ready: "可写作",
  drafted: "已起草",
  review_needed: "待审查",
  completed: "已完成",
  archived: "已归档",
};

export const ASSET_SKELETON_TREE_STATUS_ICONS: Record<AssetSkeletonTreeStatus, ReactNode> = {
  planned: <ClockCircleOutlined />,
  ready: <PlayCircleOutlined />,
  drafted: <FileDoneOutlined />,
  review_needed: <ExclamationCircleOutlined />,
  completed: <CheckCircleOutlined />,
  archived: <InboxOutlined />,
};

const ASSET_SKELETON_TREE_STATUS_TONES: Record<AssetSkeletonTreeStatus, StatusTone> = {
  planned: "default",
  ready: "info",
  drafted: "info",
  review_needed: "warning",
  completed: "success",
  archived: "default",
};

export function assetSkeletonTreeStatusLabel(status: AssetSkeletonTreeStatus): string {
  return ASSET_SKELETON_TREE_STATUS_LABELS[status];
}

export function assetSkeletonTreeStatusTone(status: AssetSkeletonTreeStatus): StatusTone {
  return ASSET_SKELETON_TREE_STATUS_TONES[status];
}

export type AssetSkeletonTreeAllowDropOptions =
  Parameters<NonNullable<TreeProps["allowDrop"]>>[0];
type AssetSkeletonTreeDropIndicatorProps =
  Parameters<NonNullable<TreeProps["dropIndicatorRender"]>>[0];
export type AssetSkeletonTreeDropInfo =
  Parameters<NonNullable<TreeProps["onDrop"]>>[0];

function truncateText(value: string, maxLength: number): string {
  const characters = Array.from(value.trim());
  if (characters.length <= maxLength) {
    return value;
  }

  return `${characters.slice(0, Math.max(1, maxLength - 1)).join("")}…`;
}

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

function groupAndSortNodes(
  nodes: AssetSkeletonTreeNode[],
): Map<string | null, AssetSkeletonTreeNode[]> {
  const children = new Map<string | null, AssetSkeletonTreeNode[]>();
  for (const node of nodes) {
    const siblings = children.get(node.parentKey) ?? [];
    siblings.push(node);
    children.set(node.parentKey, siblings);
  }

  for (const siblings of children.values()) {
    siblings.sort(
      (left, right) =>
        left.order - right.order ||
        left.title.localeCompare(right.title) ||
        left.key.localeCompare(right.key),
    );
  }

  return children;
}

function buildContentOrderLabels(nodes: AssetSkeletonTreeNode[]): Map<string, string> {
  const children = groupAndSortNodes(nodes);
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

function buildTreeData(
  nodes: AssetSkeletonTreeNode[],
  renderTitle: (node: AssetSkeletonTreeNode) => ReactNode,
  renderNodeSwitcher: (node: AssetSkeletonTreeNode) => ReactNode | undefined,
  isNodeDisabled: (node: AssetSkeletonTreeNode) => boolean,
  isNodeCurrent: (node: AssetSkeletonTreeNode) => boolean,
  isNodeMoved: (node: AssetSkeletonTreeNode) => boolean,
): TreeDataNode[] {
  const children = groupAndSortNodes(nodes);

  function build(parentKey: string | null): TreeDataNode[] {
    return (children.get(parentKey) ?? []).map((node) => {
      const childNodes = build(node.key);
      return {
        key: node.key,
        title: renderTitle(node),
        switcherIcon: renderNodeSwitcher(node),
        disabled: isNodeDisabled(node),
        className: [
          itemClassName(node),
          isNodeCurrent(node) ? "yisi-asset-skeleton-tree-item-current" : "",
          isNodeMoved(node) ? "yisi-asset-skeleton-tree-item-moved" : "",
        ]
          .filter(Boolean)
          .join(" "),
        isLeaf: childNodes.length === 0,
        children: childNodes.length ? childNodes : undefined,
      };
    });
  }

  return build(null);
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

export function AssetSkeletonTree({
  nodes,
  mode,
  className,
  currentKey = null,
  maxTitleLength = 24,
  showCurrent,
  showContentOrder = true,
  showDraft,
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
  const [isScrolling, setIsScrolling] = useState(false);
  const [recentlyMovedKey, setRecentlyMovedKey] = useState<string | null>(null);
  const scrollStopTimer = useRef<number | null>(null);
  const movedNodeTimer = useRef<number | null>(null);
  const shouldShowCurrent = showCurrent ?? mode === "view";
  const shouldShowDraft = showDraft ?? mode === "edit";
  const shouldShowLock = showLock ?? mode === "edit";
  const shouldShowStatus = showStatus ?? mode === "view";
  const shouldShowChangeState = mode === "edit";
  const contentOrderLabels = buildContentOrderLabels(nodes);
  const isNodeDisabled = (node: AssetSkeletonTreeNode): boolean =>
    Boolean(node.disabled);
  const nodeByKey = new Map(nodes.map((node) => [node.key, node]));
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
    setIsScrolling(true);
    if (scrollStopTimer.current !== null) {
      window.clearTimeout(scrollStopTimer.current);
    }
    scrollStopTimer.current = window.setTimeout(() => {
      setIsScrolling(false);
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

  function renderTitle(node: AssetSkeletonTreeNode): ReactNode {
    const isCurrent = shouldShowCurrent && currentKey === node.key;
    const title = truncateText(node.title, maxTitleLength);
    const hasTrailingContent = Boolean(
      node.trailing ||
        (shouldShowDraft && node.hasDraft) ||
        isCurrent ||
        (node.openTodoCount ?? 0) > 0 ||
        (shouldShowStatus && node.nodeKind === "content" && node.status),
    );

    return (
      <div
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
            {title}
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
            {shouldShowDraft && node.hasDraft ? (
              <StatusBadge label="稿" tone="success" mode="text-only" />
            ) : null}
            {isCurrent ? (
              <StatusBadge label="当前" tone="success" mode="text-only" />
            ) : null}
            {(node.openTodoCount ?? 0) > 0 ? (
              <StatusBadge
                label={node.openTodoCount}
                tone="danger"
                mode="text-only"
                tooltip={`${node.openTodoCount} 个待处理问题`}
              />
            ) : null}
            {shouldShowStatus && node.nodeKind === "content" && node.status ? (
              <StatusBadge
                label={assetSkeletonTreeStatusLabel(node.status)}
                tone={assetSkeletonTreeStatusTone(node.status)}
                icon={ASSET_SKELETON_TREE_STATUS_ICONS[node.status]}
                mode="icon-only"
              />
            ) : null}
          </span>
        ) : null}
      </div>
    );
  }

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
            tone={node.hasDraft ? "success" : "default"}
            mode="text-only"
            tooltip={`内容顺序 ${contentOrderLabel}`}
          />
        ) : null}
      </span>
    );
  }

  return (
    <div
      {...uiAssetAttributes("asset-skeleton-tree", "AssetSkeletonTree", "tree-pattern")}
      className={[
        "yisi-asset-skeleton-tree",
        `yisi-asset-skeleton-tree-${mode}`,
        showContentOrder ? "yisi-asset-skeleton-tree-content-order-layout" : "",
        isScrolling ? "yisi-asset-skeleton-tree-scrolling" : "",
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
        treeData={buildTreeData(
          nodes,
          renderTitle,
          renderNodeSwitcher,
          isNodeDisabled,
          (node) => node.key === currentKey,
          (node) => node.key === recentlyMovedKey,
        )}
      />
    </div>
  );
}
