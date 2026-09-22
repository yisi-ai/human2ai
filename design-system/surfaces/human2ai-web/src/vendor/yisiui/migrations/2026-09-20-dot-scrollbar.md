# DotScrollbar 采用说明

Registry key：`yisiui/dot-scrollbar`，类别 `switching`，状态 `experimental`。独立的纵向圆点滚动配饰，随 `0.15.0` 本地 source-sync 源码版本分发，尚未批准视觉基线。

圆点绑定已有的滚动元素，不拥有正文。当前区域高亮，悬停或键盘聚焦时圆点拉长，点击跳到对应滚动位置。`ResizableCollapseGroup` 默认应用于每个子项自己的内容区，`MessageComposer` 默认应用于单行和多行输入区。

## 独立接入

可从 `@yisiui/react` 或 `@yisiui/react/dot-scrollbar` 导入。source-sync 消费项目使用 `@your-project/ui/yisiui/dot-scrollbar`，其中 `your-project` 对应项目配置。

```tsx
import { useRef } from "react";
import { DotScrollbar } from "@your-project/ui/yisiui/dot-scrollbar";

function ReadingPanel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div style={{ display: "flex", height: 360, minHeight: 0 }}>
      <div
        ref={scrollRef}
        id="reading-content"
        role="region"
        aria-label="正文"
        tabIndex={0}
        style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto" }}
      >
        <ArticleContent />
      </div>
      <DotScrollbar targetRef={scrollRef} ariaLabel="正文滚动位置" maxDots={12} />
    </div>
  );
}
```

圆点与滚动元素并列放在有明确高度的 Flex/Grid 容器中，圆点区域默认占 24px 宽、高度为父级的 100%。`targetRef` 必须指向实际滚动元素；滚动发生在更深层容器时，应将引用接到那一层。给目标元素提供 `id` 可建立每个圆点按钮的 `aria-controls` 关联，`tabIndex={0}` 使正文可通过键盘滚动。

## 接口

| 属性 | 默认值及含义 |
| --- | --- |
| `targetRef` | 必填，`RefObject<HTMLElement \| null>`，绑定纵向滚动元素。 |
| `ariaLabel` | 必填，整组圆点的可访问名称。 |
| `maxDots` | 默认 12，至少为 2 的整数；实际数量也受可用高度限制。 |
| `hideNativeScrollbar` | 默认 `true`，圆点可用且没有横向溢出时隐藏目标的原生滚动条。卸载、改为 `false` 或更换目标后撤销自身添加的样式。 |
| `behavior` | 默认 `smooth`，点击和键盘跳转使用平滑滚动；`auto` 直接跳转。系统减少动效时直接跳转。 |
| `disabled` | 默认 `false`，禁用圆点按钮；正文自身的滚轮、触摸、键盘及程序滚动继续工作。 |
| `dotColor` / `activeColor` | 默认使用文字弱色与主色 Token，可传入 CSS 颜色。当前圆点保持与普通圆点相同的大小，同时通过 `aria-current` 表达当前位置。 |
| `getDotLabel` | `(index, count) => string`，用于本地化每个按钮的名称；index 从 1 开始，count 为实际显示数量。 |
| `className` / `style` | 调整圆点区域的布局，也支持其他根节点 HTML 属性。 |

## 数量、位置与更新

- 原始屏数为 `ceil(scrollHeight / clientHeight)`。没有有效高度或溢出不超过 1px 时不显示圆点。
- 每个按钮固定占 16px 高，顶部、底部各留 4px。显示数量为原始屏数、`maxDots`、可容纳按钮数量中的最小值。按钮点击区固定，普通和高亮圆点均为 6px，在悬停或键盘聚焦时拉长到 16px，不推挤其他圆点。
- 未压缩时第 i 个位置为 `min(i × clientHeight, 最大滚动距离)`，i 从 0 开始。数量压缩后按最大滚动距离均匀映射，第一点到顶部，最后一点到实际底部。
- 高亮随真实滚动位置更新，选择距离当前偏移最近的圆点。平滑滚动经过其他位置时，高亮也随实际位置变化。
- 容器、圆点区域及直接内容节点使用 ResizeObserver；内容增删、文字或属性变化使用 MutationObserver，并响应图片加载、输入、字体加载和窗口变化。更新合并到动画帧，只有圆点数量、目标位置或高亮变化时更新 React 状态。
- 内容不足一屏时隐藏圆点，保留圆点列宽，避免正文宽度来回变化。如果区域矮到放不下两个按钮，保留原生滚动条；存在横向溢出时也保留原生条，使横向滚动入口继续可用。
- 内容区域继续使用原生滚动，组件不劫持正文的触摸、滚轮或键盘事件；鼠标停在圆点列上时，可用滚轮滚动对应正文。
- 一个 Tab 停靠点进入圆点组，Up / Down、PageUp / PageDown 移动并跳转，Home / End 到顶部或底部；Enter / Space 激活按钮。内容缩短导致当前焦点按钮消失时，将焦点移到可用圆点或正文。
- 移除组件会清理观察器、事件和待执行动画帧，并恢复自身隐藏的原生滚动条。隐藏样式采用引用计数，多个配饰绑定同一个目标时不会相互提前撤销。

组件只处理纵向元素滚动。正文内部另有独立滚动区域时，需要分别绑定；页面 `document` 滚动、横向导航和连续拖动滑块不在此接口范围。

## 折叠组接入

```tsx
<ResizableCollapseGroup
  ariaLabel="功能面板"
  items={items}
  scrollbar="dots"
  maxScrollDots={12}
/>
```

`scrollbar` 默认 `dots`，可设为 `native`。只替换子项内容区的滚动呈现，整组因最小高度约束而溢出时继续使用原生滚动。拖动调整面板高度、展开收起、改变内容时，圆点自动重算；切换两种滚动条模式不会重新挂载正文。

## 查看与状态

`MessageComposer` 同样支持 `scrollbar="dots"`（默认）与 `maxScrollDots={12}`，直接绑定内部 textarea，在自动增高达到最大行数后显示圆点；设置 `scrollbar="native"` 可恢复原生滚动条。圆点列高度跟随实际输入区，文字预留右侧空间，顶部内容与底部操作不滚动。星星背景避开可见导航区域；只读和加载状态仍允许浏览，禁用状态禁用圆点操作。现有 `modules-messagecomposer--default` 场景展示长草稿，并提供两种模式的长短内容切换。

已查询 Registry 并比较 TabSwitch、UnderlineTabSwitch、ResizableCollapseGroup、SectionNavigationPanel 和原生滚动条。它们没有绑定外部滚动元素、按屏数生成圆点与点击定位的共享契约，因此新增原生候选，再由折叠组组合使用。

Storybook：`yisiui-Components/Switching/DotScrollbar`，稳定入口 `switching-dotscrollbar--default`。四个场景展示按屏跳转、长内容与高度变化、短内容隐藏、保留原生与禁用导航。已有 `yisiui-Modules/ResizableCollapseGroup` 场景已更新为默认圆点模式，并提供模式及数量控件。

按用户要求不编写或运行新测试，也不执行浏览器自动化。组件及 Storybook 构建用于检查编译和生成预览，不代表交互、消费项目回接或视觉基线已批准。
