# TabSwitch 紧密模式与右侧操作插槽

Registry key：`yisiui/tab-switch`。本次兼容性扩展随 `0.15.0` 本地 source-sync 源码版本分发，资产继续保持 `experimental`，尚未完成真实消费项目回接。

- `compact?: boolean` 默认 `false`。默认高度为 36px，紧密模式为 28px；外层上下内边距从 2px 缩为 1px，子项上下内边距从 4px 缩为 1px。文字大小保持不变。较高的自定义图标或插槽内容会自然撑高组件，避免裁切操作。
- `TabSwitchItem.rightSlot?: ReactNode` 为每项增加右侧插槽，可容纳一个或多个按钮。插槽未提供时不占空间，三种显示模式均支持。紧密模式建议使用 24px 高的按钮以保持 28px 整体高度。
- 插槽操作不会切换选中项或调用 `onChange`，可通过 Tab 独立访问；调用方负责操作回调、可访问名称与操作本身的 `disabled`。子项 `disabled` 仅禁用选择，因而可以为禁用项提供解锁操作；若希望同时禁用操作，应给插槽按钮传入 `disabled`。
- 原有 `value`、`defaultValue`、`onChange`、颜色和显示模式保持适用。方向键循环选择并跳过禁用项，Home/End 选择首尾可用项。

```tsx
<TabSwitch
  aria-label="内容视图"
  compact
  items={[
    { key: "draft", label: "草稿", mode: "text-only" },
    {
      key: "preview",
      label: "预览",
      mode: "text-only",
      rightSlot: <button type="button" onClick={openPreviewSettings}>设置</button>,
    },
  ]}
/>
```

为避免操作按钮嵌套到切换 label 内，内部实现改为原生 radio、label 与同级插槽，保留 `radiogroup` 语义和现有 `data-yisiui-*` 标记。Ant Design 内部 class 与滑块动效不再作为实现依赖；选中背景采用颜色过渡并尊重减少动效设置。消费方应通过公开 props 定制外观，不依赖 `.ant-segmented-*` 内部选择器。

Storybook 保留原有 Story id，并增加“默认与紧密模式”和“每项右侧独立操作”两个完整场景；组件测试覆盖受控值、键盘切换、禁用项、插槽事件隔离、独立单选组与可访问名称。

验证：`npm run check`、`npm run typecheck` 通过；7 项 TabSwitch 测试包含在全仓 61 项组件测试中。最终 Story 示例调整后重新通过 package build、`ui:check` 和 Storybook build。浏览器实测默认/紧密高度为 36px/28px，24px 操作按钮下紧密高度仍为 28px；确认 Enter、Space 激活插槽按钮而不切换选中项，Tab 可访问操作，方向键跳过禁用项且焦点轮廓可见。两个新增场景的 Axe WCAG 2.2 AA 扫描均无违规。
