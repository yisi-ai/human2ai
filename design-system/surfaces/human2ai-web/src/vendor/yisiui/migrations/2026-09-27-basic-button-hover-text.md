# BasicButton 悬停文字模式

`yisiui/basic-button` 兼容增加 `mode="hover-text"`，随 `0.17.0` 本地 source-sync 版本分发。现有 with-icon、without-icon、icon-only 模式、导出路径、资产归属和 Token 属性保持兼容，资产仍为 experimental、release 保持 candidate，视觉基线尚未批准。

## 来源与复用

用户要求 BasicButton 静止显示图标、hover 时无图标而仅显示文字，并补充动画。用户随后明确选择“静止为图标宽度，悬停时展开到文字宽度”。经 Registry 的能力、分类、slots、别名和适用场景查询，BasicButton 已拥有动作和 Icon 模式职责；ExpandingSwitch 拥有选项选择，CompositeButton 是列表行级动作，因此直接扩展 BasicButton。原始 Writer Harness 来源记录保留，本次改动只在 YisiUI 实现。

```tsx
<BasicButton mode="hover-text" icon={<SettingOutlined />} onClick={openSettings}>
  打开设置
</BasicButton>
```

- `children` 是展开文字；未提供时可由 `iconLabel` 或 `aria-label` 提供。`iconLabel`/`aria-label` 也可指定不随动画变化的可访问名称。复杂 ReactNode 内容建议显式指定名称；图标只用于装饰，内容不应嵌套交互控件。
- 默认收起宽度等于实际按钮高度。组件测量文字及按钮 padding/border，悬停时用 240ms 宽度过渡展开，图标和文字用 180ms 淡出/淡入并伴随轻微缩放/位移；移出时反向过渡。快速反向悬停由 CSS 从当前动画位置继续，不切换 DOM 或依赖 React hover state。
- 键盘 focus-visible 使用相同展开表现，失焦收回；鼠标点击后的普通焦点不会让移出后的按钮一直展开。点击、键盘激活、href 与业务回调继续由 Ant Design Button 处理。
- small/middle/large 使用实际按钮高度与字体测量；ResizeObserver、字体加载和窗口尺寸变化更新测量。显式 style.width、minWidth、maxWidth 等布局限制由消费方负责；`block` 保持全宽，只切换内容。宽度动画会推动相邻内容，这是用户选择的展开方式。
- 禁用和加载时维持图标尺寸，停止悬停展开；加载显示 Ant Design 的 loading 图标，保留 loading.delay、自定义 loading 图标和重复点击拦截。来自 ConfigProvider 的 disabled 同样生效。
- 没有 hover 的设备直接显示文字，维持一次点击激活；系统 prefers-reduced-motion 下关闭宽度及内容切换动画。缺少图标时退回普通文字按钮，缺少文字时保持纯图标。
- 通过 Ant Design semantic classNames 组合自身样式，保留调用方 classNames（包括函数）、style、事件和 UiAssetAttributeScope；不会给其他 mode 增加几何或动画规则。

Storybook 保留原有入口 `buttons-basicbutton--modes` 和 `buttons-basicbutton--sizes`，分别补入第四种模式，以及三种尺寸、禁用和加载状态。组件测试覆盖原模式兼容、可访问名称、事件、几何重测、资源清理、禁用、延迟加载和复合资产归属；真实浏览器用于验证 hover 的宽度、淡入淡出、收回、focus-visible 与减少动效。
