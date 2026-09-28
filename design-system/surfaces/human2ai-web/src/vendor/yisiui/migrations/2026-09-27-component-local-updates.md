# 快捷消息、模型菜单与折叠组的局部更新

本次修复 `yisiui/message-composer`、`yisiui/model-selector`、`yisiui/resizable-collapse-group`，随 `0.17.1` 本地源码版本交付。三个资产均保持 `experimental`，视觉基线尚未批准。

## MessageComposer

`MessageComposerQuickPrompt` 新增可选的 `key?: string`。会修改发送内容、插入、删除或重排的快捷消息应提供唯一稳定的 key；不能把显示文案或数组下标作为 key。

```tsx
const quickPrompts = [
  { key: "explain", icon: <HelpIcon />, label: "解释", message: "解释当前内容" },
];
```

修改 label、message、icon 不改变同一个 key 的按钮实例；焦点保持，点击使用最新消息和回调。快捷按钮拆为独立的 memo 组件，输入值变化不再改变其提交函数。调用方传入的图标、回调等引用若变化，仍正常更新对应内容。

旧调用不提供 key 仍可使用：以 message 加同消息出现序号作为兼容身份，修改 label 或在前面插入不同消息不重建原有按钮。修改 message、重排内容相同的重复消息时无法自动推断业务身份，这些场景应补充 key。

## ModelSelector

`modes`、sources、models 的数组引用变化不再直接关闭菜单。保持相同稳定 key 时，等价刷新、文案更新和模式重排保留菜单 DOM、焦点与滚动位置；来源菜单 id 使用模式 key，不再依赖数组位置。删除或禁用菜单内当前聚焦的非选中项时，将焦点移动到仍可用的选项。

真正切换模式、来源或型号，切换排版，进入 loading/disabled，或菜单入口失效时仍关闭菜单。业务数据移除后不能恢复旧菜单。数据和选中值继续由消费项目持有。

## ResizableCollapseGroup

保留 `sizes`、`onSizesChange` 和 `onResizeEnd` 接口及调用时机。非受控指针拖动直接更新相邻展开面板的高度及相关分隔条的可访问数值，不再通过整组 React state 提交每次移动；其他面板高度、输入内容和滚动容器保留。受控模式仍以传入的 `sizes` 为准，调用方可以拒绝更新。

高度测量和尺寸绘制独立于 React 内容渲染，正文容器使用 memo 保持引用；只写入有实际变化的高度和 ARIA 属性。圆点滚动条仍会在各自面板尺寸变化时更新，这是必要的局部更新。

取消指针操作或 Esc 恢复拖动前比例；容器尺寸、条目结构、展开集合、禁用状态或受控方式改变时结束当前拖动。键盘调整、跨收起项调整、最小高度、缩放补偿及卸载清理继续保留。

如调用方在 `onSizesChange` 中更新父级状态，父级及受控组件仍可能正常重渲染。仅需保存最终布局时，可使用 `onResizeEnd`，避免把每次移动传播到产品页面。

## 验证

回归测试位于现有 MessageComposer、ModelSelector 测试文件及新增 `ResizableCollapseGroup.component.test.tsx`。覆盖稳定 DOM 与焦点、消息内容更新、等价菜单刷新、无效菜单关闭、指针期间 React commit 次数、受控接受/拒绝、取消回滚、键盘、容器缩放与 StrictMode 清理。复用现有代表 Story，不新增临时 Story。
