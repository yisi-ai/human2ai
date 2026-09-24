import { CheckCircleOutlined, ClockCircleOutlined, SyncOutlined, WarningOutlined } from "@ant-design/icons";
import type { Meta, StoryObj } from "@storybook/react-webpack5";
import type { TreeProps } from "antd";
import { useState, type ReactNode } from "react";

import { StatusBadge } from "@human2ai/ui/yisiui";
import {
  AssetSkeletonTree,
  assetSkeletonTreeCanDrop,
  assetSkeletonTreeRelativeDropPosition,
  type AssetSkeletonTreeNode,
  type AssetSkeletonTreeStatus,
} from "@human2ai/ui/yisiui";
import { assertStoryRole, assertStorySelector, assertStoryText } from "../interactionChecks";

import styles from "./AssetSkeletonTree.stories.module.css";

const meta = {
  id: "modules-assetskeletontree",
  title: "yisiui-Modules/AssetSkeletonTree",
  component: AssetSkeletonTree,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof AssetSkeletonTree>;
export default meta;
type Story = StoryObj<typeof meta>;

function TreeStoryFrame({ children }: { children: ReactNode }) {
  return <div className={styles.frame}>{children}</div>;
}

// These statuses are example data owned by this caller, not a tree workflow.
const exampleStatuses = {
  idle: { label: "未开始", icon: <ClockCircleOutlined /> },
  available: { label: "可用", tone: "info" },
  processing: { label: "处理中", icon: <SyncOutlined />, tone: "processing" },
  attention: { label: "需检查", icon: <WarningOutlined />, tone: "warning" },
  complete: { label: "已就绪", icon: <CheckCircleOutlined />, tone: "success" },
  inactive: { label: "已停用" },
} satisfies Record<string, AssetSkeletonTreeStatus>;

const resourceNodes: AssetSkeletonTreeNode[] = [
  {
    key: "group:visual",
    parentKey: null,
    order: 0,
    nodeKind: "container",
    title: "视觉资源",
    description: "共享目录",
  },
  {
    key: "resource:layout",
    parentKey: "group:visual",
    order: 0,
    nodeKind: "content",
    title: "响应式布局与多种屏幕尺寸的适配资源",
    trailing: <StatusBadge label="SVG" tone="info" mode="text-only" />,
  },
  {
    key: "resource:icons",
    parentKey: "group:visual",
    order: 1,
    nodeKind: "content",
    title: "图标集合",
    trailing: <StatusBadge label="JSON" mode="text-only" />,
  },
  {
    key: "resource:colors",
    parentKey: "group:visual",
    order: 2,
    nodeKind: "content",
    title: "颜色配置",
    trailing: <StatusBadge label="CSS" mode="text-only" />,
  },
  {
    key: "group:files",
    parentKey: null,
    order: 1,
    nodeKind: "container",
    title: "参考文件",
  },
  {
    key: "resource:guide",
    parentKey: "group:files",
    order: 0,
    nodeKind: "content",
    title: "使用说明",
    trailing: <StatusBadge label="PDF" tone="info" mode="text-only" />,
  },
  {
    key: "resource:template",
    parentKey: "group:files",
    order: 1,
    nodeKind: "content",
    title: "基础模板",
    trailing: <StatusBadge label="JSON" mode="text-only" />,
  },
];

const hierarchyNodes: AssetSkeletonTreeNode[] = [
  {
    key: "group:base",
    parentKey: null,
    order: 0,
    nodeKind: "container",
    title: "基础配置",
    status: exampleStatuses.available,
  },
  {
    key: "item:spacing",
    parentKey: "group:base",
    order: 0,
    nodeKind: "content",
    title: "间距设置",
    status: exampleStatuses.complete,
    contentOrderTone: "success",
  },
  {
    key: "item:palette",
    parentKey: "group:base",
    order: 1,
    nodeKind: "content",
    title: "颜色设置",
    status: exampleStatuses.processing,
    contentOrderTone: "success",
    trailing: <StatusBadge label="2" tone="danger" mode="text-only" tooltip="2 项待检查" />,
  },
  {
    key: "group:components",
    parentKey: null,
    order: 1,
    nodeKind: "container",
    title: "界面元素",
    status: exampleStatuses.idle,
  },
  {
    key: "item:button",
    parentKey: "group:components",
    order: 0,
    nodeKind: "content",
    title: "按钮样式",
    status: exampleStatuses.attention,
    locked: true,
    lockedReason: "此节点已锁定，暂不可移动",
  },
  {
    key: "item:input",
    parentKey: "group:components",
    order: 1,
    nodeKind: "content",
    title: "输入控件",
    status: exampleStatuses.idle,
    trailing: <StatusBadge label="1" tone="danger" mode="text-only" tooltip="1 项待检查" />,
  },
  {
    key: "item:panel",
    parentKey: "group:components",
    order: 2,
    nodeKind: "content",
    title: "面板布局",
    status: exampleStatuses.processing,
    contentOrderTone: "success",
  },
  {
    key: "item:menu",
    parentKey: "group:components",
    order: 3,
    nodeKind: "content",
    title: "菜单导航",
    status: exampleStatuses.available,
    isNew: true,
  },
  {
    key: "item:legacy",
    parentKey: "group:components",
    order: 4,
    nodeKind: "content",
    title: "旧版控件",
    status: exampleStatuses.inactive,
    isDeleted: true,
  },
  {
    key: "group:extensions",
    parentKey: null,
    order: 2,
    nodeKind: "container",
    title: "扩展功能",
    status: exampleStatuses.idle,
    isNew: true,
  },
  {
    key: "item:search",
    parentKey: "group:extensions",
    order: 0,
    nodeKind: "content",
    title: "搜索配置",
    status: exampleStatuses.idle,
  },
  {
    key: "item:filter",
    parentKey: "group:extensions",
    order: 1,
    nodeKind: "content",
    title: "筛选配置",
    status: exampleStatuses.available,
  },
  {
    key: "item:export",
    parentKey: "group:extensions",
    order: 2,
    nodeKind: "content",
    title: "导出设置",
    status: exampleStatuses.processing,
    contentOrderTone: "success",
    isNew: true,
  },
  {
    key: "item:old-template",
    parentKey: "group:extensions",
    order: 3,
    nodeKind: "content",
    title: "旧版模板",
    status: exampleStatuses.inactive,
    isDeleted: true,
  },
  {
    key: "item:preview",
    parentKey: "group:extensions",
    order: 4,
    nodeKind: "content",
    title: "预览配置",
    status: exampleStatuses.complete,
    contentOrderTone: "success",
  },
];

const hierarchyViewNodes = hierarchyNodes.filter((node) => !node.isDeleted);

function normalizeOrder(nodes: AssetSkeletonTreeNode[]): AssetSkeletonTreeNode[] {
  const grouped = new Map<string | null, AssetSkeletonTreeNode[]>();
  for (const node of nodes) {
    const siblings = grouped.get(node.parentKey) ?? [];
    siblings.push(node);
    grouped.set(node.parentKey, siblings);
  }
  for (const siblings of grouped.values()) {
    siblings.sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
  }

  const nextOrder = new Map<string, number>();
  for (const siblings of grouped.values()) {
    siblings.forEach((node, index) => nextOrder.set(node.key, index));
  }
  return nodes.map((node) => ({ ...node, order: nextOrder.get(node.key) ?? node.order }));
}

function canMoveNode(
  nodes: AssetSkeletonTreeNode[],
  info: Parameters<NonNullable<TreeProps["onDrop"]>>[0],
): boolean {
  return assetSkeletonTreeCanDrop(nodes, {
    dragNode: info.dragNode,
    dropNode: info.node,
    dropPosition: assetSkeletonTreeRelativeDropPosition(info),
  });
}

function moveNode(nodes: AssetSkeletonTreeNode[], info: Parameters<NonNullable<TreeProps["onDrop"]>>[0]): AssetSkeletonTreeNode[] {
  if (!canMoveNode(nodes, info)) {
    return nodes;
  }

  const dragKey = String(info.dragNode.key);
  const dropKey = String(info.node.key);

  const dragged = nodes.find((node) => node.key === dragKey);
  const target = nodes.find((node) => node.key === dropKey);
  if (!dragged || !target) {
    return nodes;
  }

  const descendants = new Set<string>();
  const queue = [dragged.key];
  while (queue.length) {
    const parentKey = queue.shift();
    if (!parentKey) {
      continue;
    }
    descendants.add(parentKey);
    for (const node of nodes) {
      if (node.parentKey === parentKey) {
        queue.push(node.key);
      }
    }
  }
  if (descendants.has(target.key)) {
    return nodes;
  }

  const nextParentKey = info.dropToGap ? target.parentKey : target.key;
  const dropPosition = assetSkeletonTreeRelativeDropPosition(info);
  const remaining = nodes.filter((node) => node.key !== dragged.key);
  const siblings = remaining
    .filter((node) => node.parentKey === nextParentKey)
    .sort((left, right) => left.order - right.order || left.key.localeCompare(right.key));
  const targetIndex = siblings.findIndex((node) => node.key === target.key);
  const insertIndex = info.dropToGap && targetIndex >= 0
    ? targetIndex + (dropPosition > 0 ? 1 : 0)
    : siblings.length;
  siblings.splice(insertIndex, 0, { ...dragged, parentKey: nextParentKey });

  const orderByKey = new Map(siblings.map((node, index) => [node.key, index]));
  return normalizeOrder(
    remaining.map((node) =>
      orderByKey.has(node.key)
        ? { ...node, order: orderByKey.get(node.key) ?? node.order }
        : node,
    ).concat(
      orderByKey.has(dragged.key)
        ? [{ ...dragged, parentKey: nextParentKey, order: orderByKey.get(dragged.key) ?? insertIndex }]
        : [],
    ),
  );
}

function EditorFixture() {
  const [nodes, setNodes] = useState<AssetSkeletonTreeNode[]>(() =>
    hierarchyNodes.map((node) => ({
      ...node,
      isChanged: node.key === "item:panel",
    })),
  );
  const [selectedKeys, setSelectedKeys] = useState<string[]>(["item:palette"]);

  const handleDrop: TreeProps["onDrop"] = (info) => {
    setNodes((current) => moveNode(current, info));
  };

  return (
    <TreeStoryFrame>
      <AssetSkeletonTree
        mode="edit"
        nodes={nodes}
        showStatus={false}
        selectedKeys={selectedKeys}
        defaultExpandAll
        onSelect={(keys) => setSelectedKeys(keys.map(String))}
        onDrop={handleDrop}
      />
    </TreeStoryFrame>
  );
}

// Preserve the existing export keys so saved Story URLs continue to work.
export const ArticleList: Story = {
  name: "资源列表",
  render: () => (
    <TreeStoryFrame>
      <AssetSkeletonTree
        mode="view"
        nodes={resourceNodes}
        maxTitleLength={12}
        showContentOrder={false}
        showStatus={false}
        defaultExpandAll
        selectedKeys={["resource:layout"]}
      />
    </TreeStoryFrame>
  ),
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "tree");
    assertStoryText(canvasElement, "响应式布局与多种屏幕");
    assertStoryText(canvasElement, "共享目录");
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-description");
  },
};

export const LongformSkeletonList: Story = {
  name: "层级状态",
  render: () => (
    <TreeStoryFrame>
      <AssetSkeletonTree
        mode="view"
        nodes={hierarchyViewNodes}
        currentKey="item:palette"
        maxTitleLength={18}
        showCurrent={false}
        defaultExpandAll
        selectedKeys={["item:palette"]}
      />
    </TreeStoryFrame>
  ),
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "tree");
    assertStoryText(canvasElement, "颜色设置");
    assertStorySelector(
      canvasElement,
      '.yisi-asset-skeleton-tree-content-order [data-yisiui-asset="yisiui/status-badge"]',
    );
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/status-badge"].yisi-status-badge-icon-only',
    );
    assertStorySelector(
      canvasElement,
      '[data-yisiui-asset="yisiui/status-badge"].ant-tag-red',
    );
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-trailing-area");
  },
};

export const SkeletonEditor: Story = {
  name: "层级编辑",
  render: () => <EditorFixture />,
  play: ({ canvasElement }) => {
    assertStoryRole(canvasElement, "tree");
    assertStorySelector(canvasElement, '[data-mode="edit"]');
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-item-locked");
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-item-changed");
    assertStoryText(canvasElement, "[new]");
    assertStoryText(canvasElement, "[del]");
    assertStoryText(canvasElement, "01");
    assertStoryText(canvasElement, "02");
    assertStorySelector(
      canvasElement,
      '.yisi-asset-skeleton-tree-content-order [data-yisiui-asset="yisiui/status-badge"]',
    );
    assertStorySelector(canvasElement, ".yisi-asset-skeleton-tree-content-order-empty");
    assertStorySelector(
      canvasElement,
      '.yisi-asset-skeleton-tree-item-new > .ant-tree-switcher .yisi-asset-skeleton-tree-content-order',
    );
  },
};
