# AdaptiveAccordion 自适应折叠列表

`yisiui/adaptive-accordion` 是根据 2026-09-20 用户确认的交互方案新增的 YisiUI 原生资产，随 `0.15.0` 本地 source-sync 源码版本分发，状态为 experimental。没有替换或迁移任何消费项目的代码，也没有批准视觉基线或 stable 状态。

## 使用

```tsx
import { AdaptiveAccordion } from "@yisiui/react";
// 也可使用 @yisiui/react/adaptive-accordion 独立入口。

<AdaptiveAccordion
  ariaLabel="常见问题"
  items={[
    { key: "start", title: "如何开始？", content: <p>先选定一个目标。</p> },
    { key: "prepare", title: "需要准备什么？", content: <p>整理与目标有关的资料和待确认的问题。</p> },
  ]}
/>
```

`items` 提供唯一且非空的 `key`、非空纯文字 `title`、`content: ReactNode` 和可选 `disabled`。标题负责展开操作，其他按钮和链接放在 content。组件不请求数据、不管理产品路由或保存业务状态。

默认全部收起。点击标题展开或收起当前项，点击其他可用标题切换，点击组件 DOM 外部收起。正文里的内联按钮、链接和文字选择不触发标题切换。`expandedKey` 与 `onExpandedChange` 提供受控模式，null 表示全部收起；非受控时可通过 `defaultExpandedKey` 配置初始项。不提供有效 key 时显示全部收起。

`icon` 是整个组件共用的装饰图标，默认加号，展开时默认加号轻微旋转提示收起；自定义图标保持原始方向。`showIcon={false}` 或 `icon={null}` 关闭图标。图形本身跟随标题字号，统一的图标栏宽度保证标题与正文水平对齐。

## 高度与字号

首次浏览器布局测量后，在相同宽度、内容和字号范围下，全部收起或任意单项展开使用同一个总高度：

`各标题在最小字号下的自然高度之和 + 最高内容区的自然高度 + 行分隔线`

外层边框另计。当前展开内容保持自身自然高度；剩余空间由各标题行均匀分配。标题允许换行，不省略文字；采用能放进当前标题区域的统一字号。`minTitleFontSize` 与 `maxTitleFontSize` 单位为 px，默认分别来自 16px 和 24px Token；必须满足 `0 < min <= max`。图标随字号缩放，正文使用正常正文字号。字体计算只调整隐藏的纯文字镜像，避免反复改变真实内容排版来试算。

正文在收起时移出正常布局，但只挂载一份，保持相同可用宽度以测量自然高度。组件监听宽度、内容高度和字体加载变化后重新计算；这些实际输入变化允许总高度变化，单纯切换展开项不会改变总高度。收起后正文中的 React 状态仍保留，其 effect 也仍存在；适合说明、FAQ 和轻量内联操作，不适合必须展开后才加载的重型编辑器或大量虚拟化条目。

用户明确要求正文按自身内容完整展开，因此此资产按最高内容计算高度，不对正文增加固定高度或内部截断。长列表或特别长的正文应由消费方提供页面/工作区滚动边界。不要覆盖组件内部结构的 height、font-size 或使用依赖展开状态改变正文高度的布局；通过 items、字号范围和外层宽度接入。

## 键盘与状态

- 每个标题是原生 button，具有 aria-expanded 和 aria-controls；展开正文以标题命名为 region。
- Enter/空格切换标题；上下方向键、Home、End 移动到可用标题；Esc 收起并将焦点放回标题。
- 收起的正文保持 aria-hidden、inert 和不可见，不进入正常键盘顺序，也不参与页面滚动范围。
- `disabled` 禁用所有标题；每项 disabled 单独禁用标题。空列表可通过 `emptyContent` 提供本地化内容。
- 动效只涉及颜色和默认图标旋转；减少动效时关闭过渡，布局计算不依赖动画。

## 场景与交付状态

Storybook 位于 `yisiui-Modules/AdaptiveAccordion`，默认 Story id 为 `modules-adaptiveaccordion--default`。四个完整场景覆盖：默认问答与稳定高度、统一问号图标与纯文字、窄宽度/长标题/动态内容、受控操作/禁用/空列表。默认场景下方放置位置参照文字，方便用户查看切换时的高度。

按用户要求，本次不编写或运行组件交互/无障碍测试，不运行自动浏览器验证；现有 CLI 清单数量期望同步更新为 28 条（26 个 experimental、2 条 removed），没有执行这些测试。组件包和 Storybook 构建用于生成手动查看的预览，构建结果不代表视觉批准、交互验证或消费项目回接成功。
