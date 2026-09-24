# 默认主题：青灰与深青绿

此文记录深青绿阶段的实现与验证。用户随后选择鲜绿，当前配置见[鲜绿主题迁移说明](2026-09-23-bright-green-theme.md)；下文验证结果不代表鲜绿主题已验证。

日期：2026-09-23。适用范围：当前 `0.15.0` 候选源码；本次没有发布新版本，也没有批准完整视觉基线或提升资产生命周期。

用户明确要求改善现有 UI，尤其替换 Ant Design 原色，并选择青灰／深青绿方向。默认主色从 `#1677FF` 调整为 `#2F5D62`，原有 Token 名和组件调用接口继续可用。

## 颜色与语义

| 用途 | 当前值 | 对比度 |
| --- | --- | --- |
| 主操作／链接 | `#2F5D62` | 白底或白字 7.34:1 |
| 悬停 | `#3B7075` | 白底或白字 5.58:1 |
| 按下 | `#24484D` | 白底或白字 9.96:1 |
| 辅助／提示／占位文字 | `#586B6F` | 页面底色 `#F3F6F5` 上 5.15:1 |
| 控件边框 | `#7C918B` | 白面板 3.34:1，页面底色 3.08:1 |
| 暗色交互标记 | `#81B6B4` | 暗色面板 `#1F1F1F` 上 7.29:1 |

新增 `color.brand.primaryBg`、`color.brand.primaryBgHover`、`color.border.control`、`theme.dark.interactive`。选中区域不再引用信息提示背景；信息提示使用中性青灰，处理中使用深青绿。文字保持原有语义别名关系，不按颜色数量判断层级是否有效。

更新中性色、阴影和遮罩色相，使页面、面板、文字与主题协调。主色关联的 contentGraph actor 填充和文字改用同组 Token 引用。状态调色板、纸张色和其他图谱分类色继续保留各自用途。

## Ant Design 与共享组件

主题生成器现在显式映射主色的前景与浅背景、链接三态、占位／禁用文字、控件边框、焦点和反馈色。普通正文链接带下划线。加载中按钮通过旋转图标表达状态，保留完整不透明度，避免整体淡化后文字对比度降至 3.17:1。缺失必需 Token 会报错，不使用硬编码蓝色兜底。

Ant Design 输入和选择控件使用 `color.border.control`；按钮与卡片的装饰边界仍使用 `color.border.default`。StatusBadge 的信息与处理中样式分别读取对应反馈 Token。MessageComposer 键盘聚焦输入时显示外框，星光模式的焦点与选中滚动圆点使用暗色交互色。

消费项目同步时需同时更新 Token CSS、生成的 `antdTheme` 以及本轮组件样式。消费方自行覆盖的颜色不会被自动重写，需要在其产品 Surface 检查叠加效果；不能只复制三个主色色值。

## 验证入口

- 既有 Story `foundations-tokens--colors` 增加真实控件组合，覆盖输入、选择、链接、按钮、禁用、加载、状态和选中区域；同时保留全部颜色 Token。
- `packages/react/test/themeContrast.test.ts` 验证普通文字与主操作三态对比度、Ant Design 解析后主题的关键映射、控件边界以及暗色交互标记。
- 浏览器复核颜色预览和 MessageComposer 星光模式的实际样式、键盘焦点及窄屏布局；全仓验证使用 `npm run check`。

用户对颜色方向的选择不等于所有资产的截图基线已经批准。Foundations 与 Registry 的原有候选状态保持不变。

本次直接调整样式的 Registry 资产为 `yisiui/message-composer`、`yisiui/status-badge`，两者继续保持 `experimental`；`yisiui/basic-button` 复用现有实现和代表 Story 展示主题交互。

## 本轮结果

`npm run check` 已通过。浏览器实测主按钮与链接的悬停色均为 `#3B7075`，输入控件的键盘焦点为 2px 深青绿，暗色 MessageComposer 的焦点及当前滚动圆点为 `#81B6B4`。390px 视口下预览没有横向溢出。

颜色 Story 的 axe WCAG A/AA 扫描无明确违规。Select 的内容与内部输入节点重叠导致一项对比度无法自动判定；已人工核对实际样式：`#1F292B` 文字、`#FFFFFF` 背景及透明内部输入，对比度 14.89:1。

本地截图保存于 `.artifacts/deep-teal-theme-desktop.png`、`.artifacts/deep-teal-theme-mobile.png`、`.artifacts/deep-teal-theme-dark-focus.png`。这些是候选实现证据，不是已批准的视觉基线。
