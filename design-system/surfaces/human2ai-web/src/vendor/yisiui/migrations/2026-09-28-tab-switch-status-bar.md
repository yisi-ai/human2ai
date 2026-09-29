# TabSwitch 状态标签栏扩展

`yisiui/tab-switch`、`yisiui/basic-button` 保持 experimental。本次兼容扩展随 `0.18.0` 本地 source-sync 版本分发；真实消费项目回接及视觉基线批准仍待完成。

## 消费接口

`TabSwitchItems` 由至少两项放宽为至少一项，仍要求稳定且唯一的 key。保留 `compact`、颜色、受控 `value/onChange` 和 `rightSlot`；不要为显示新建按钮伪造可选项。

```tsx
<TabSwitch
  aria-label="状态"
  compact
  style={{ width: 420 }}
  items={states.map((state) => ({
    key: state.id,
    label: state.name,
    mode: "text-only",
    menu: {
      trigger: "hover", // "button"（默认）为点击三点；"hover" 为悬停标签直接打开
      items: [
        { key: "rename", label: "重命名", icon: <EditOutlined /> },
        { key: "delete", label: "删除", danger: true, disabled: !canDelete },
      ],
      onAction: (actionKey, tabKey) => handleStateAction(actionKey, tabKey),
    },
  })) as TabSwitchItems}
  value={selectedId}
  onChange={setSelectedId}
  trailingAction={states.length === 1 ? { label: "新建状态", onClick: requestCreate } : undefined}
  reorderable
  onReorder={(keys) => requestStateOrder(keys)}
/>
```

映射后的数组须由消费方保证非空；空集合另行呈现产品空态。示例业务函数由消费项目实现。

- `trailingAction` 的 label、icon、disabled、onClick 描述一个可 Tab 聚焦的独立按钮；不进入 value、方向键选择或排序。
- 每项 `menu.items` 支持稳定唯一 key、label、icon、disabled、danger，`onAction(actionKey, tabKey)` 携带所属项身份。优先向下打开，视口下方空间不足时自动向上避让。空菜单不显示入口；`ariaLabel` 可定制入口名称。
- `rightSlot` 与内置菜单可并存，依次呈现为「选择 label → rightSlot → 三点菜单」。两者均在选择 label 外，点击和键盘操作不切换 tab。选择项 disabled 不自动禁用独立操作，调用方按需禁用菜单条目及插槽按钮。
- `menu.trigger` 支持 `"button"`（默认）与 `"hover"`。前者点击三点打开，三点入口在悬停、项内焦点或菜单打开时可见；后者悬停整个标签约 150ms 后直接打开，不显示鼠标用三点入口，也不改变选择或抢焦点。两种模式均可通过 Tab 到达菜单按钮，键盘聚焦时入口可见，Enter/Space/ArrowDown 打开，Escape 关闭并恢复焦点；无 hover 的触屏设备保留可见三点按钮。悬停模式从标签移入菜单不会中断操作，离开后关闭。标签按下开始等待拖动时关闭菜单并暂停悬停打开，直至下一次进入。等价数组刷新不关闭有效菜单；切换触发模式保留标签 DOM、插槽草稿及选择。
- `reorderable` 默认 false。按住选择 label 约 350ms 开始拖动；长按前移动超过 6px 取消等待，保留普通点击与触屏横向滚动。disabled 项不可发起拖动，但保留在完整排序结果中，可随其他项让位。
- 拖项跟随指针，其余节点实时平移让位。正式 DOM 顺序和消费数据在预览中不变；帧合并仅写入实际变化的 transform。组件内松手且顺序变化时调用一次 `onReorder(string[])`，消费方决定接受或拒绝，`items` 始终是正式顺序来源。
- 移出组件边界时恢复原顺序预览并以虚线边框及透明度显示取消反馈（拖动中无可见文字提示），边缘滚动停止；移回后继续预览。外部松手、Escape、pointercancel、失去捕获、窗口失焦/resize、卸载、禁用排序或列表 key/顺序/文字/可用性/菜单条目实际变化均取消。等价对象数组、回调引用变化不取消。取消不改变选择和正式顺序；拖动后的 click 被拦截，下一次点击/键盘选择仍正常。
- 通过现有 `style.width` / `style.maxWidth` 或消费容器指定宽度；隐藏原生滚动条，仅在溢出时显示固定在左右两侧的箭头，边界方向禁用。悬停箭头持续滚动，按住约 350ms 后持续滚动；点击按可视宽度的 80% 大步滚动（至少 96px），长按松手不追加点击跳转。移出、取消、Escape、窗口失焦和卸载停止持续滚动；两侧箭头不参与选择或排序，RTL 下仍表达物理左右方向。拖动在组件内部边缘自动滚动，继续使用同一个内部滚动区域。减少动效时取消让位过渡，仍实时显示最终位置；不提供键盘排序，保留原有键盘选择和菜单访问。
- 默认选中态使用主题主色 `color.action.primary` 与白色文字 `color.text.inverse`；仍可显式覆盖 `selectedBackground`、`selectedTextColor`。为兼容原调用，指定自定义底色但未指定文字颜色时仍采用原来的深色文字。
- 新建、重命名、删除确认、正式数据排序、API 和持久化均由消费项目持有。

`BasicButton` 通过 forwardRef 暴露实际 button/anchor 节点，同时保留内部 hover-text 测量引用。Dropdown/Tooltip 可获得正确的定位锚点，ref 更换及卸载遵循 React 清理行为。

验证覆盖：单项与尾部按钮、受控选择、菜单动作和焦点、等价刷新、原节点复用、内部提交与拒绝、移出恢复与外部取消、移回继续、Escape/取消/失焦/列表变化/卸载、边缘滚动、ref 与 hover-text 测量。代表 Story：`switching-tabswitch--status-bar`；原密度、插槽及键盘场景保留。

浏览器验证：正常位置菜单在按钮下方，靠近视口底部时自动翻到上方；实测拖动时原节点实时让位、移出恢复、移回继续、内部提交一次、外部松手不提交；自动滚动到末尾停止且内容宽度不增长，移出后停止滚动。拖动过程无可见文字提示，读屏保留状态播报。`defaultValue` 仅校验初始化，后续删除初始项时非受控选择与焦点回退到剩余可用项。

箭头滚动验证：覆盖宽度变化与内容增删后的溢出检测、两端禁用、点击大步、悬停与长按、长按后的点击抑制、清理、RTL 方向和等价刷新时 DOM/焦点/滚动保留；浏览器确认无原生滚动条、箭头固定在两侧，滚动不更改选中值。

## 箭头与读屏文案配置（0.19.0）

消费项目通过 `scrollArrows.left/right` 分别提供 `icon` 与 `label`；`label` 是按钮的无障碍名称，须提供非空文字，RTL 下也表示物理左右方向。通过 `dragAnnouncements.inside/outside` 配置范围内确认、范围外取消的读屏提示，提示始终隐藏，不在拖动中显示文字。

```tsx
<TabSwitch
  aria-label="状态"
  items={items}
  reorderable
  scrollArrows={{
    left: { icon: <LeftIcon />, label: t("tabs.scrollLeft") },
    right: { icon: <RightIcon />, label: t("tabs.scrollRight") },
  }}
  dragAnnouncements={{
    inside: t("tabs.releaseToReorder"),
    outside: t("tabs.releaseToCancel"),
  }}
/>
```

未提供的字段保留原图标及中文文案，现有调用无需调整；读屏文案传空字符串可静音对应状态。拖动中替换文案立即更新当前播报，等价配置刷新不取消拖动，也不重建标签、重置焦点或滚动。退出拖动后清空临时播报。新导出类型为 `TabSwitchScrollArrow`、`TabSwitchScrollArrows`、`TabSwitchDragAnnouncements`；Registry key 仍为 `yisiui/tab-switch`，保持 experimental。

## 选中背景滑动（0.19.0）

默认切换时，共享选中色块在 240ms（`motion.slow`）内移动到目标标签并适配宽高；鼠标和键盘切换均生效，连续切换从当前视觉位置衔接。受控模式只在消费方更新 `value` 后移动，不提前确认被拒绝的选择。

色块位于原有滚动轨道内，随内容滚动，使用物理布局位置兼容 RTL。ResizeObserver 按帧合并尺寸变化，原标签、输入草稿、焦点和滚动位置保留；初次显示及布局变化直接对齐。拖动期间隐藏共享色块并使用原节点的选中背景，结束后恢复；遵守 `prefers-reduced-motion`，减少动效时不播放过渡。仍支持自定义 `selectedBackground` 与 `selectedTextColor`，不新增必填属性。

## 0.19.1 溢出递归修复

升级完整 source-sync 版本，勿只复制单个 hook 或修改消费方 vendor。0.19.0 在固有宽度下删除末尾选中项时，动画背景的旧位置可能撑大 `track.scrollWidth`；动画中途刷新会让左右箭头反复出现/消失，触发 React `Maximum update depth exceeded`（生产错误码 #185）。

0.19.1 将背景置于独立的 `overflow: clip` 绘制层，并使用轨道的实际布局宽度判断溢出。背景动画不再扩展原生滚动范围；选择动画、hover 菜单、长按实时排序与范围外取消均保留。无新增必填属性，未把循环延迟到下一帧。

保留的浏览器回归 Story：`switching-tabswitch--dynamic-items`。包括消费方同类菜单序列、真实 CSS 动画中途的等价数据刷新、固有宽度/420px/180px、长名称、选中项增删改、快速切换与 RTL；检查静止后的提交/DOM 变化、节点身份、焦点和滚动位置。
