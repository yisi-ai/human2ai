# CascadeSelector 接入说明

Registry key：`yisiui/cascade-selector`。YisiUI 原生新增资产，随 `0.17.0` 本地 source-sync 版本分发，状态保持 `experimental`、release 保持 candidate；尚未回接真实消费项目或批准视觉基线。

## 来源与复用决策

来自用户确认的多栏级联选择需求：最少两级、典型三级，统一总宽高和栏高、各栏分配宽度、选择上级后更新下级。用户特别要求按影响范围渲染，并确认统一搜索所有层级、当前命中文字高亮、未展开分支的祖先提示后代命中；搜索保留路径及多栏结构。用户随后指定选中项仅用背景色提示、去掉勾号，并用右侧小尺寸 NumberBadge 圆标呈现后代命中数。

已按 Registry 的能力、分类、slots、别名与适用/不适用场景查询 AssetSkeletonTree、SectionNavigationPanel、ModelSelector、TabSwitch 和 ResizableCollapseGroup。现有资产无完整的多栏路径选择和局部订阅契约，因此新增独立组件，沿用共享 Token 和资产标记。未迁移消费项目源码。

## 接入

```tsx
import { CascadeSelector } from "@yisiui/react/cascade-selector";
import type { CascadeSelectorColumn, CascadeSelectorOption } from "@yisiui/react/cascade-selector";

// 在组件外定义，或使用 useMemo；数据变化时不可变更新受影响的分支。
const columns: readonly CascadeSelectorColumn[] = [
  { width: 1 },
  { width: 1 },
  { width: 2 },
];
const options: readonly CascadeSelectorOption[] = [
  { key: "a", label: "分组 A", children: [
    { key: "a1", label: "设计规范", children: [
      { key: "a11", label: "颜色" },
      { key: "a12", label: "字体" },
    ] },
  ] },
];

<CascadeSelector
  aria-label="资源分类"
  title="资源分类"
  options={options}
  columns={columns}
  width="100%"
  height={360}
  value={selectedPath}
  onChange={(path, selectedOptions) => setSelectedPath(path)}
/>
```

也可从 `@yisiui/react` 导入。source-sync 使用消费项目的组件别名，保持数据、请求、持久化和路由归消费方所有。

| 属性 | 契约 |
| --- | --- |
| `title` | 搜索框左侧的可选总标题 ReactNode 插槽；各栏不提供标题插槽。支持文字或自定义内容；未提供时不占位，窄容器中可换行。不决定页面标题层级。 |
| `options` | 不可变树数组；`key` 在同级唯一且非空，`label` 非空，可选 `icon`、`disabled`、`children`。不同分支可复用 key，完整路径区分它们。 |
| `columns` | 至少两项，必须覆盖全部数据深度。各栏无可见标题；可选 `aria-label` 仅用于辅助技术，否则使用“第 N 级选项”。`width` 为正数比例，默认 1；`minWidth` 为正数像素，默认 144；支持消费方提供 `loading`、`error`。 |
| `value` / `defaultValue` | 受控路径 / 初始路径；默认不选中。`onChange(path, selectedOptions)` 只在用户选中新项时触发；受控模式等待消费方接受。不要在生命周期内切换受控模式。 |
| `height` / `width` | 默认 360px / 100%；可用 CSS 长度。百分比高度要求父级有确定高度。比例分宽受 minWidth 约束；空间不足时在组件内容区横向滚动，各栏纵向独立滚动；滚动条仅在滚动期间显示，最后一次滚动后 600ms 隐藏。 |
| `disabled` | 禁用搜索及全部选择；单项禁用由键盘跳过。 |
| `labels` | 本地化搜索标签、占位、清空、等待上级、空分支、加载，以及匹配数量和层级可访问名称函数。 |
| `renderOption(option, highlightedLabel)` | 可选非交互内容插槽，须保留传入的高亮文字；不得嵌套按钮、链接或输入框。`icon` 同样只用于装饰。 |
| `style` / `className` | 根容器外部布局。 |

## 选择、搜索和键盘

- 选择某一栏的新项，保留左侧路径并清空其右侧全部选择。下一栏显示子项，后续未选上级的栏显示等待提示。重复点击当前项无操作。分支提前结束时保留栏位并显示“没有下级”。
- 无效、已移除或被禁用的路径节点及后缀不呈现为已选；数据更新不调用 onChange 冒充用户操作。消费方应同步修正自己的受控值。
- 搜索扫描全部已提供的数据层级，不过滤列表、不改变路径。大小写不敏感、按字面子串匹配，忽略首尾空白并高亮所有非重叠命中片段；不会将输入解析为正则表达式。中文输入法组字结束后更新匹配。
- 未展开分支在可见祖先右侧以 20px NumberBadge 圆标显示后代匹配数量；超过 99 时圆标显示 99，并附加 +，悬停 title 和辅助说明保留“下级有 N 项匹配”的完整数量。N 统计命中的节点（包括禁用节点），不统计文字出现次数。自身命中和后代命中可同时出现。搜索计数说明全部数据中的匹配；零匹配有文字提示。清空搜索保留当前选择，焦点返回搜索框。
- 每栏使用具名 radiogroup，每项使用 radio 语义和焦点描边；按用户要求选中态仅使用背景色提示，默认使用较深一档的 color.surface.active（当前 #DCFCE7），悬停时保持选中底色；每栏只有一个可用选项进入 Tab 顺序。上下键、Home/End 移动并选择，跳过禁用项；左右键在相邻可用栏之间移动焦点，不隐式选中，遵守 RTL；Enter/Space 由按钮原生激活。
- loading/error 由消费方驱动，每栏提供忙碌/错误语义；组件不发请求。搜索覆盖已经提供的全部 options，不推断未加载的数据。

## 渲染边界

每个实例有独立 store，`useSyncExternalStore` 的订阅者只读取该栏的稳定选项快照、该行的状态位或该行的匹配快照。选择时不更新根部 React state；输入状态也只属于搜索区。未变化的快照复用引用，store 通知本身不代表 React 重新渲染。

- 切换第二栏时，第一栏不渲染，第二栏仅原/新选中行及实际改变焦点停靠点的行更新，第三栏及后续受影响栏更新。各栏容器不通过 changing key 重建。
- 搜索只更新高亮范围或后代数量变化的行；大小写或首尾空白变化但结果相同时不渲染这些行。
- 横向及各栏纵向滚动条静止时透明，滚动事件后显示，最后一次事件后 600ms 隐藏；滚动条占位不变，不在悬停时显示。该瞬态直接更新对应容器属性，不触发 React 行渲染；卸载时清理监听与计时器。
- 左侧及当前栏保留滚动；下级分支变化时对应列表回到顶部。外部数据更新移除焦点行时，焦点回退到该栏的可用项或空状态容器。
- 受控 value 变化仍会执行接收 props 的轻量入口，但 memo 化的布局保持不变，列表更新由快照订阅驱动。消费方应保持未变化 options、columns、labels、style 和 renderOption 的引用稳定；主动重建内容或回调会产生相应渲染。

搜索计算会遍历数据，订阅检查覆盖已挂载的行；局部渲染不等同于零计算。本版不提供虚拟化、异步搜索、请求管理、拖拽栏宽、多选或自动选首项。Story 的四级长列表覆盖 28,248 个节点，页面只挂载当前各栏的选项。

Storybook：`yisiui-Modules/CascadeSelector`，入口 `modules-cascadeselector--default`。保留三级搜索、两级空分支、四级长列表与窄容器、加载/错误/禁用/空数据四个完整场景。组件测试通过 renderOption 调用计数验证实际行渲染范围，不只比较 DOM；另覆盖路径截断、受控拒绝、数据替换、搜索及 IME、键盘和状态边界。
