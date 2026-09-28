# AppShellFrame 左右侧栏拖动调宽

`yisiui/app-shell-frame` 随 `0.17.0` 本地 source-sync 版本增加双侧栏调宽，保留原 import、slots、收起接口和 Writer Harness 迁移来源，状态仍为 experimental、release 保持 candidate。本次不更新真实消费项目。

Registry 查询后选择扩展 AppShellFrame：它已拥有全屏应用壳层与左右侧栏；ResizableCollapseGroup 调整竖向功能区高度，WorkspacePanel 与 SideActionPanel 也不拥有应用级三栏布局。无需创建新资产。

```tsx
<AppShellFrame
  sidebar={navigation}
  sidebarWidth={280}
  sidebarMinWidth={180}
  sidebarMaxWidth={480}
  onSidebarWidthChange={saveSidebarWidth}
  rightPanel={details}
  rightPanelWidth={320}
  rightPanelMinWidth={240}
  rightPanelMaxWidth={560}
  onRightPanelWidthChange={saveDetailsWidth}
  contentMinWidth={320}
>
  {content}
</AppShellFrame>
```

## 宽度契约

- `sidebarResizable` / `rightPanelResizable` 默认 `true`，可分别设为 `false` 保持原来的固定宽度行为；对应 min/max 只约束可拖动侧栏。
- `sidebarWidth` / `rightPanelWidth` 延续 CSS 长度能力（数字、百分比、rem、Token 等），用作初始或首选宽度。组件在内部保存拖动结果；改变该 prop 会重置对应的用户宽度。它们不是要求父组件逐帧回写的严格受控值。若没有用户调整，CSS 首选宽度继续随容器测量。
- 左侧默认范围 `180–480px`，右侧 `240–560px`；min/max 与 `contentMinWidth` 均为 CSS 像素数字。负数归零，非有限数字使用默认值，max 小于 min 时以 min 为准。
- 拖动时只调整当前侧栏，当前有效上限同时受另一侧宽度和中间最小宽度约束。父容器变窄时，两侧按可缩空间收缩，容器恢复后恢复用户首选宽度。
- `contentMinWidth` 默认 `320px`。小于左右最小宽度与中间最小宽度总和时，壳层内部横向滚动，保留三个区域的最小尺寸；移动端专用导航仍由消费项目提供。需要允许中间区域完全收缩时可显式设置 `contentMinWidth={0}`。
- 回调 `onSidebarWidthChange` / `onRightPanelWidthChange` 在成功松开拖动或每次有效键盘调整后返回像素宽度；无变化、取消或容器自动适配不触发。持久化由消费方完成，组件不读写本地存储。
- 收起时移除对应拖动边界，但侧栏内容保持挂载，展开后恢复此前宽度。不可折叠侧栏仍可单独配置拖动。

## 操作与渲染

左侧栏右边缘和右侧栏左边缘分别提供 10px 操作区。2px 主题竖条只在鼠标悬停时显示，移开即隐藏，不因焦点或拖动状态常亮；鼠标使用 `col-resize`。键盘焦点使用边界中央的小圆环提示，鼠标拖动不会留下键盘焦点。支持主指针、触摸与笔输入，拖动期间阻止文字选中，并通过临时遮罩跨 iframe 保持光标与指针操作。指针捕获、监听、遮罩和观察器在结束或卸载时清理。

边界使用可聚焦的竖向 `separator`，提供名称、受控区域和当前/最小/最大值；名称可通过 `labels.resizeSidebar` / `labels.resizeRightPanel` 本地化。左右方向键按边界的实际方向移动，每次 8px；Shift 每次 32px，Home / End 跳至最小/当前最大宽度。Esc、指针取消、丢失捕获、窗口失焦及拖动中隐藏侧栏会取消并回退本次调整。

拖动直接更新布局 CSS 变量和 separator 的 ARIA 数值，不更新 AppShellFrame React state，不重新挂载 slots。组件测试通过 React Profiler 验证连续拖动没有增加渲染提交，并验证输入节点、滚动位置保留。浏览器布局与绘制仍随宽度变化发生；消费方如果自行监听尺寸变化，其内容可能自行更新。

复用现有 `layouts-appshellframe--default`、`--long-content` 与 `--right-panel-initially-closed` 入口，默认 Story 增加范围控件、键盘调整与折叠保宽断言，端点与异常范围由组件测试覆盖。原全局标题、headerExtra、导航与开关插槽继续由调用方提供。
