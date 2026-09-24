# ExpandingSwitch 采用说明

Registry key：`yisiui/expanding-switch`，状态 `experimental`，首次本地 source-sync 发布版本 `0.16.0`。这是 YisiUI 原生新增组件，不替换现有 TabSwitch 或 UnderlineTabSwitch；未完成消费验证，视觉基线未获批准。

## 设计来源与复用决策

来自用户在 Human2AI 会话 `c13ce796-e72f-4b76-b9f7-6470906b773c` 绘制的 UI 草图，第 44 版，指纹 `draft-b52a77c3`。两种状态表达第三项／第二项展开，其余项收起。实现前已执行几何标准化，无需修改坐标或写入新版本；实现用自然布局和 Token 尺寸，不复制画布绝对坐标。

用户确认 hover 临时预览、移出恢复选中项、click 才切换，并指定可配置的深浅双色、固定循环的已有纸感八色与可选 icon。Registry 按能力、分类、slot、别名和适用／不适用场景检索后，对比 TabSwitch、UnderlineTabSwitch、DotScrollbar 和 AspectRatioSelector；现有资产均不提供这套方格展开及统一长条宽度契约，因此新增独立组件。

## 接入

```tsx
import { ExpandingSwitch } from "@yisiui/react/expanding-switch";

<ExpandingSwitch
  aria-label="显示方式"
  items={[
    { key: "edit", label: "编辑", icon: <EditIcon /> },
    { key: "preview", label: "预览", icon: <PreviewIcon /> },
    { key: "all", label: "浏览全部" },
  ]}
  value={view}
  onChange={setView}
  colors={{ mode: "multicolor" }}
/>
```

也可从 `@yisiui/react` 导入；source-sync 使用消费项目的 `@your-project/ui/yisiui/expanding-switch` 别名。所有选项、文字、图标、回调和业务值由调用方提供。

| 属性 | 契约 |
| --- | --- |
| `items` | 只读数组，项目具有唯一 `key`、非空 `label`，可选 `icon`、`disabled`。icon 只接受装饰内容，不放交互控件。空数组不渲染。 |
| `aria-label` | 必填，整组的可访问名称；每个方格始终以 label 作为可访问名称。 |
| `value` / `defaultValue` | 受控值／非受控初值；默认选中第一个可用项。非受控已选项被移除后回退至第一个可用项，全禁用时回退首项。 |
| `onChange` | `(key, item) => void`；只有选择不同的可用项时触发。hover 不触发。 |
| `colors` | 默认为 `{ mode: "multicolor" }`，或 `{ mode: "duotone", selectedBackground?, unselectedBackground?, selectedForeground?, unselectedForeground? }`。 |
| `disabled` | 禁用整组，停止预览和提交。单项 disabled 由键盘跳过。 |
| `className` / `style` | 根容器样式，可调整外部布局。容器窄于自然宽度时内部横向滚动。 |

双色模式默认选中深青绿、未选中浅青灰，可自由配置两种背景及对应文字／图标颜色。**深浅状态跟随实际选择，hover 不会冒充选中。** 自定义配色时由调用方保证前景／背景对比度。

多色模式只使用现有 `color.paper.*` Token，顺序固定为 natural、sage、amber、rose、slate、sky、lavender、clay；第九项回到 natural。颜色按选项数组位置分配（禁用项仍占位置），选择不改变项颜色；不提供自定义色数组、单项颜色或顺序参数。

## 交互与布局

- 方格默认 28px，展开宽度为所有文字的实际最大宽度加统一水平内边距，并至少与方格等宽；ResizeObserver 响应字体／文字宽度变化。整组轨道宽度固定为「展开宽度 + 其余方格宽度之和」，所有列通过同一个 Grid 列宽动画同步插值，快速 hover 打断和反向切换时也保持总宽度。修改选项或字体可能改变整体宽度，同一组选项间的切换保持总宽度。
- 相邻项无额外间距，中间连接处为直角，仅整组最左端和最右端的外侧保留小圆角；只展开一项。展开时显示文字并隐藏 icon，收起时有 icon 就显示 icon，否则显示纯色方格。选中项底部保留短线，即使 hover 使它暂时收起，也可通过形状区分选中状态。
- 非触摸 pointer 悬停临时展开；移出恢复选中项。点击提交后保持展开；触摸直接点击，无 hover 前置步骤。受控模式始终以调用方 value 为准。
- 使用 radiogroup／radio 语义和单个 Tab 停靠点。方向键移动焦点并选择，跳过禁用项、首尾循环；Home／End 到首末可用项；左右键遵守 RTL。Space／Enter 使用按钮原生激活行为。
- 键盘焦点可展开预览，离开组后恢复已选项。切到指针操作后，移出不会残留点击焦点导致的错误预览。焦点有可见轮廓；减少动效时取消宽度动画。
- 长文字完整展示，不按画布 56px 硬截断；大量选项和窄容器在组内横向滚动，键盘移动确保目标可见。没有业务加载／错误状态；调用方可使用 disabled 并在外部表达请求状态。

Storybook：`yisiui-Components/Switching/ExpandingSwitch`，稳定入口 `switching-expandingswitch--default`；示例包括受控选择、默认和自定义深浅色、八色循环、有／无 icon、禁用与长文字窄容器。

验证覆盖 hover 与提交分离、受控一致性、禁用与动态移除、键盘循环／RTL、可访问名称、宽度重测及八色循环。组件测试不代替真实浏览器的布局与动效检查，也不代表视觉基线或消费项目已批准。
