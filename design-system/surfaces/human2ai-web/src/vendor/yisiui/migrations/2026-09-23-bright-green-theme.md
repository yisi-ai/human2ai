# 默认主色：鲜绿

发布归属：本次契约与主题调整随 `0.16.0` 本地 source-sync 发布；下文 `0.15.0` 指实现时的工作版本，消费验证仍待完成。

用户在 Storybook 对比后明确选择鲜绿，本次将当前 `0.15.0` 工作版本的默认主色更新为该方案。没有发布新版本或提升资产生命周期；用户选择主色不代表完整视觉基线已批准。

| 用途 | 颜色 |
| --- | --- |
| 主操作默认 / 悬停 / 按下 | `#22C55E` / `#4ADE80` / `#16A34A` |
| 主色前景文字与图标 | `#FFFFFF`（用户后续指定） |
| 链接、浅底主题文字、交互边框与焦点 | `#15803D` |
| 选中浅底 / 交互浅底 | `#F0FDF4` / `#DCFCE7` |
| 暗色表面交互标记 | `#4ADE80` |

增加 `color.brand.primaryText`，将正文链接、浅底选中文字、处理中状态和焦点映射到同色系深绿。亮绿承担实色填充，按用户后续要求配白色文字与图标。保留现有青灰中性色、状态色、纸张色、字号、圆角与尺寸。

Ant Design 主按钮及主色上的文字与图标使用白色；危险按钮仍使用白字。普通按钮的悬停文字与边框、输入和选择控件的焦点使用深绿，Checkbox 与 Radio 的选中符号同步使用白色。同步更新生成的 Ant Design 主题、Token CSS、TypeScript 和清单。

共享组件中的浅底主题文字改为引用文字语义，亮绿选中填充上的前景改为 `color.text.onPrimary`。涉及 `yisiui/expanding-switch`、`yisiui/message-composer`、`yisiui/asset-skeleton-tree`、`yisiui/aspect-ratio-selector`、`yisiui/adaptive-accordion`、`yisiui/underline-tab-switch`、`yisiui/section-navigation-panel`；均保持 `experimental`。NumberBadge 等已有正确前景引用的组件自动跟随新 Token。

Storybook 的“颜色”场景展示当前主题；“主色对比”保留四组方案，标明鲜绿为当前主色，深青绿为原方案。没有将演示方案写入共享资产 Registry。

消费方应同步 Token、生成主题和本次组件语义引用。自行设置过 `color.brand.primary` 作为浅底文字或自行覆盖主色前景的消费组件，需要分别改用 `color.action.link` 与 `color.text.onPrimary`，或在产品 Surface 明确配置自己的颜色组合。

按用户要求，本次未运行自动测试、类型检查、Storybook 构建或浏览器验证。已更新现有对比度断言以区分主色填充和浅底文字，并重新生成 Token、Storybook 目录和源码同步清单；不沿用深青绿阶段的通过记录作为本次验证结果。

用户指定的鲜绿配白字不代表主按钮满足普通文字 4.5:1 对比度。现有检查保留浅底文字、链接和焦点的对比度要求，主色前景改为验证用户指定的白色及主题映射；本次未运行这些检查。
