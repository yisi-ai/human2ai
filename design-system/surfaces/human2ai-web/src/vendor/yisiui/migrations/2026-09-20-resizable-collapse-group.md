# ResizableCollapseGroup 采用说明

Registry key：`yisiui/resizable-collapse-group`。YisiUI 原生共享组件，状态为 `experimental`，随 `0.15.0` 本地 source-sync 源码版本分发。没有批准新视觉基线。

该组件用于父容器高度明确的竖向功能区。每项有统一的 40px 浅色背景标题栏和左侧折叠三角，默认全部展开；标题背景使用 `color.surface.page`，悬停使用 `color.surface.selected`，左上与右上角使用 `radius.md` 圆角。项间保留 6px 透明拖动区域，默认、悬停和拖动时均不绘制分割线；键盘聚焦时保留焦点提示。展开内容分配剩余高度，拖动项间空隙在上下两项之间交换空间。标题、内容与比例由调用方提供，不读取路由、API、产品状态或持久化布局。

## 采用方式

包入口为 `@yisiui/react/resizable-collapse-group`，也可从 `@yisiui/react` 导入。source-sync 消费项目将下面的 `your-project` 替换为 `.yisiui/config.json` 中的 `project`。

```tsx
import { ResizableCollapseGroup } from "@your-project/ui/yisiui/resizable-collapse-group";

<div style={{ height: 600, minHeight: 0 }}>
  <ResizableCollapseGroup
    ariaLabel="工作区功能面板"
    defaultSizes={{ resources: 2, properties: 1, notes: 1 }}
    defaultExpandedKeys={["resources", "properties"]}
    items={[
      { key: "resources", title: "资源", content: <ResourceList />, minHeight: 80 },
      { key: "properties", title: "属性", content: <PropertyEditor /> },
      { key: "notes", title: "备注", content: <Notes /> },
    ]}
  />
</div>
```

父容器必须提供明确或可解析的高度，例如固定高度，或有界 Flex/Grid 中设置 `min-height: 0` 的剩余空间。组件宽高默认均为 `100%`，总高度包含自身边框。正文容器不附加内边距，功能组件自行决定其内部排版；内部滚动容器也可使用 `height: 100%; min-height: 0` 占满分配空间。

子项内容区默认组合独立的 [DotScrollbar 圆点滚动条](2026-09-20-dot-scrollbar.md)。圆点表示内容屏数，当前区域高亮，悬停拉长、点击跳转；拖动面板高度后自动重算。圆点列占 24px 宽，正文继续使用原生滚动行为。`scrollbar="native"` 可切回原生滚动条，整组溢出时的滚动条保持原生。

## 接口

| 属性 | 含义 |
| --- | --- |
| `items` | `ResizableCollapseItem[]`，每项提供唯一非空 `key`、非空纯文字 `title`、任意 `content`；可设置正数 `minHeight` 和 `disabled`。 |
| `ariaLabel` | 整组的可访问名称。 |
| `expandedKeys` / `onExpandedChange` | 受控展开项；允许同时展开多项，空数组表示全部收起。未提供 `expandedKeys` 时内部管理。 |
| `defaultExpandedKeys` | 初始展开项，默认初始列表中的全部项；挂载后新增项默认收起。 |
| `sizes` / `onSizesChange` | 受控内容高度权重，按项 key 映射为正数；缺失项权重为 1。回调在指针拖动或键盘调整期间触发，提供全组权重。 |
| `defaultSizes` | 非受控初始权重，例如 `{ a: 2, b: 1 }`，表示内容可用空间按约 2:1 分配。默认全部为 1。 |
| `onResizeEnd` | 完成拖动或一次键盘调整后的权重回调，可由消费项目用于保存布局。 |
| `minPanelHeight` | 各展开内容区的默认最小高度，默认 64px，要求为正数；每项 `minHeight` 可覆盖，不包含标题高度。 |
| `scrollbar` | 子项内容区的滚动条模式，`dots`（默认）或 `native`；切换时保留正文挂载及内部状态。 |
| `maxScrollDots` | 默认 12，至少为 2 的整数；每个子项的实际圆点数还受屏数和可用高度限制。 |
| `resizable` | 默认 `true`；设为 `false` 后仍可独立折叠。 |
| `disabled` | 锁定整组的折叠和拖动。项级 `disabled` 锁定该项折叠，以及会调整该项高度的拖动区域。正文中的业务控件由调用方控制禁用。 |
| `resizeLabel` | `(upperTitle, lowerTitle) => string`，用于本地化拖动区域的可访问名称。 |
| `emptyContent` | 空列表时展示的内容。 |

组件支持根节点 HTML 属性及 `className` / `style`。`title` 用作折叠按钮名称，长标题单行省略并保留完整 `title` 提示；正文交互控件放在 `content` 中。

## 高度与交互约定

- 从容器高度中扣除全部标题和拖动区域，剩余空间按照已展开项的权重分配。达到最小高度的项先固定，其余项继续按权重分配剩余空间。
- 收起一项后，它仅保留标题栏，原内容空间按其他已展开项的权重重新分配。收起项的权重仍保留，重新展开时参与分配；切换展开状态或父容器尺寸不会自行回写 `sizes`。
- 拖动区域位于一个已展开项下方，调整该项与其后最近的已展开项，跨过中间已收起的标题。其他展开项的实际高度保持不变；在最小高度约束参与分配时，内部会相应换算权重以保持这些实际高度。
- 指针采用捕获机制，支持鼠标与触摸；拖动不会依赖全局鼠标样式。按 Esc 或发生 pointer cancel 时恢复本轮拖动前的权重。拖动期间父容器、项列表或展开集合变化时结束本轮拖动。
- 只有一项展开时占满剩余空间；全部收起时标题在顶部依次排列，剩余区域留白；整个组件仍保持父容器高度。
- 每项内容独立滚动。父容器连标题和所有展开内容的最小高度都无法容纳时，在组件内部增加整组滚动，保持总高度与最小内容高度。
- 收起使用 `hidden` 隐藏正文，移出键盘导航与辅助技术内容；正文保持挂载，不丢失输入或功能组件内部状态，其副作用也会继续存在。调用方负责需要暂停的业务任务。
- 标题按钮支持 Enter / Space 切换，Up / Down / Home / End 在可用标题间移动焦点。拖动区域具备 `separator` 语义与当前像素值，Up / Down 每次调整 8px，Shift 为 32px，Home / End 到达允许范围边界。点击组件外部保持当前展开状态。
- 小三角旋转遵守系统减少动效偏好。高度变化直接跟随指针与受控状态，不增加延迟拖动的高度动画。

## 复用决策与查看入口

已查询 Registry 的能力、分类、插槽、别名和适用范围，并比较 `AdaptiveAccordion`、`SectionNavigationPanel`、`SideActionPanel`、`AppShellFrame`、Ant Design Collapse / Splitter。现有资产未提供独立多项折叠、固定标题、跨收起项调节与父高度约束的组合契约，因此新增原生候选；复用现有 Token 和 Ant Design 三角图标。

Storybook：`yisiui-Modules/ResizableCollapseGroup`，稳定入口 `modules-resizablecollapsegroup--default`。

保留四个完整场景：多个功能面板与独立折叠、跨收起项调整与全部收起、父容器缩放与最小高度、受控比例/禁用/空状态。按照用户要求，不编写或运行新的测试，不执行浏览器自动化；这些场景用于人工查看，构建不代表交互或视觉基线已批准。消费项目回接与用户视觉验收仍待完成。
