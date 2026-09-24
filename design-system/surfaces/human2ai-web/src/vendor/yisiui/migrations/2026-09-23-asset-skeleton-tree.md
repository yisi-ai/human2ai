# AssetSkeletonTree 通用化

发布归属：本次契约与主题调整随 `0.16.0` 本地 source-sync 发布；下文 `0.15.0` 指实现时的工作版本，消费验证仍待完成。

本次按用户要求移除 Writer Harness 写作领域的固定状态与稿件、待办字段。Registry key 保持 `yisiui/asset-skeleton-tree`，组件名、`@yisiui/react` 导出入口和源码路径 `src/patterns/AssetSkeletonTree.tsx` 保持不变。资产仍为 `experimental`，本次在当前 `0.15.0` 工作版本内调整契约，未发布、未批准视觉基线或完成消费项目验证。

## 接口迁移

这是 experimental 接口的不兼容调整，消费方同步后需要迁移以下用法；业务适配应留在消费项目。

| 旧接口 | 当前接口 |
| --- | --- |
| `status: "planned" / "ready" / "drafted" / …` | `status: { label, icon?, tone? }`，由调用方将自己的业务状态转换为展示信息 |
| `AssetSkeletonTreeStatus` 字符串联合 | 同名展示对象类型，必填 `label: string`，可选 `icon: ReactNode` 与 `tone: StatusTone` |
| `ASSET_SKELETON_TREE_STATUS_LABELS`、`ASSET_SKELETON_TREE_STATUS_ICONS`、`assetSkeletonTreeStatusLabel`、`assetSkeletonTreeStatusTone` | 已移除；状态字典与转换函数由消费项目维护 |
| `hasDraft`、`openTodoCount` | 已移除；按需在节点 `trailing` 中组合 `StatusBadge` 或其他 React 内容 |
| `showDraft` | 已移除；调用方按显示模式决定是否提供对应的 `trailing` 内容 |
| `hasDraft` 自动使序号变绿 | 显式指定 `contentOrderTone`；缺省为 `default`，不从状态推断颜色 |

`showStatus` 继续控制状态显示，默认查看模式显示、编辑模式隐藏。状态现在同时支持容器和内容节点。有图标时使用纯图标，`label` 作为可访问名称、隐藏文字和提示；无图标时显示 `label` 文本。省略 `status` 时不添加状态标记。

```tsx
import { AssetSkeletonTree, StatusBadge, type AssetSkeletonTreeNode } from "@yisiui/react";

const nodes: AssetSkeletonTreeNode[] = [
  {
    key: "resources",
    parentKey: null,
    order: 0,
    nodeKind: "container",
    title: "资源目录",
  },
  {
    key: "palette",
    parentKey: "resources",
    order: 0,
    nodeKind: "content",
    title: "颜色配置",
    status: { label: "可用", tone: "success" },
    contentOrderTone: "success",
    trailing: <StatusBadge label="JSON" mode="text-only" />,
  },
];

<AssetSkeletonTree mode="view" nodes={nodes} defaultExpandAll />;
```

层级、受控选择、序号、锁定、新增/删除/变更标记、拖拽规则、内部滚动及回调保持原有行为。业务计数的名称、颜色和提示由调用方提供；自定义图标或操作应具备可访问名称，不能只用颜色表达状态。组件不拥有产品状态机、API、持久化或路由。

## Story 与样式

现有三个 Story 改为“资源列表”“层级状态”“层级编辑”，展示调用方配置的纯文字状态、图标状态、附加计数和序号颜色。保留原有导出键 `ArticleList`、`LongformSkeletonList`、`SkeletonEditor` 及对应 Story URL，避免已有链接失效；这些标识仅用于历史链接兼容，不代表当前业务契约。写作业务示例已替换。

Story 全屏容器样式移入 `AssetSkeletonTree.stories.module.css`，生产样式不再包含演示页面容器。

后续按用户反馈，选中节点的标题、说明文字及当前内容节点使用白色前景；容器选中时也使用绿色底色。节点内容与右侧附加区域通过 Flex 垂直居中，右侧状态图标使用独立行高，清除 SVG 的行内基线与垂直外边距影响。这些样式仅作用于 AssetSkeletonTree。

## 验证记录

按用户“我来检查，你不用测试”的要求，本次未执行自动测试、类型检查、Storybook 构建或浏览器验证；仅更新源码、现有 Story 断言、Registry、目录和源码同步清单。消费方仍需验证状态映射、附加内容、选择与拖拽，并检查 TypeScript 引用；这些验证尚未完成。
