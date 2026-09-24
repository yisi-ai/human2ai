# 公共资产迁移说明

当前鲜绿主色及前景、链接和焦点的语义调整见 [2026-09-23 鲜绿主题](2026-09-23-bright-green-theme.md)。

AssetSkeletonTree 的通用状态、附加标记和序号颜色接口见 [2026-09-23 层级树通用化](2026-09-23-asset-skeleton-tree.md)。

独立圆点滚动条及折叠组接入见 [2026-09-20 DotScrollbar 采用说明](2026-09-20-dot-scrollbar.md)。

父容器定高、独立折叠与拖动调整功能面板见 [2026-09-20 ResizableCollapseGroup 采用说明](2026-09-20-resizable-collapse-group.md)。

稳定高度的说明与问答列表见 [2026-09-20 AdaptiveAccordion 采用说明](2026-09-20-adaptive-accordion.md)。

开源与 npm 分发的许可范围、同步及打包步骤见 [2026-09-14 MIT 许可证接入](2026-09-14-mit-license.md)。

Storybook 共享与本地分组规则见 [2026-09-13 分组归属](2026-09-13-storybook-groups.md)。

消费技术栈的版本变更见 [2026-09-13 依赖升级](2026-09-13-dependency-upgrade.md)，其中包含已有 npm/pnpm 项目的显式依赖迁移步骤。

每个进入 `deprecated` 或 `removed` 的共享资产都必须在本目录提供独立迁移说明，并由 Registry `migration.migrationGuide` 指向该文件。

迁移说明至少包含：

- 旧 Registry key、旧 import path 和组件名。
- replacement Registry key；没有直接替代时明确说明。
- props、slots、行为、无障碍语义和样式责任的映射。
- 多组件合并时每个旧组件进入新组件的映射。
- `deprecatedSince`、`removeAfter` 和最终 `removedIn`。
- 消费项目的类型检查、交互测试、Storybook、生产构建及引用归零证据。

推荐发布顺序：先发布保留兼容适配器的 deprecated minor candidate，完成真实消费项目迁移，再由用户明确批准 removed major candidate。Registry tombstone 在移除后继续保留迁移事实，但不得继续声明 live source 或 Story。
