# UI 草图分组与实现前标准化

用户授权在画布右键菜单提供建组、解组，不放入右侧栏。继续使用既有桌面视觉方向和 candidate 组件状态。查询 synchronized Registry 的 context-menu 能力与 overlay 分类未发现匹配资产；复用本地 UiSketchCanvas、CanvasNode、CanvasScene、InfiniteCanvasViewport，菜单组合项目已有的 Ant Design Dropdown。未选用 CompactDropdownSelect：它负责单值选择，不适合执行动作。

组仅保存稳定 id 与至少两个节点 id。成员不能重复归组，不新增可见容器或代码组件层级。普通点击与框选扩展到整组，Shift 切换整组选取，未选中状态也能直接拖动整组；拖动沿用按帧预览和松手单次提交，键盘微移保持成员相对位置。双击继续编辑单个成员。组关系跨阶段共享，活动阶段几何仍独立。删除清理引用，清空移除全部组，草稿克隆隔离成员数组，保存和撤销复用 Capture。

右键菜单在少于两个节点、已经选中一个完整组或只读时禁用建组；未选中已有组或只读时禁用解组。右键点击未选中节点会选中它所属的组，右键空白保留当前选择。菜单键或 Shift+F10 可打开菜单，菜单关闭归还焦点。InfiniteCanvasViewport 增加无业务语义的 context-menu-request：右键点击松开时上报原命中目标，移动超过 3px 的右键拖动继续平移且不请求菜单。取消和丢失捕获不触发请求。

语义记录为 ui-sketch.group-items 与 ui-sketch.ungroup-items。中文为“建组”“解组”，英文为“Group”“Ungroup”，与复制工具组、项目分组及可见容器区分。

领域决策为复用 shared capture.draft-versioning，新增 local ui-sketch.item-groups 和 ui-sketch.geometry-standardization，并扩展 ui-sketch.layout-intent 工作流。构图加工的面积、旋转及归一坐标约束与 UI 像素、文字、组和动效阶段不同，保留独立执行器；UI 文字边界估算提取到领域 geometry.ts，由原导出调用与标准化共同复用。

标准化命令只派生本地文档与报告，以源指纹绑定 Agent 对齐计划。全部阶段的画框相对位置、尺寸及字号取整，图片裁剪比例保留；对齐须有明确意图，组整体移动，每轴累计不超过 3px，中心在奇偶尺寸不同情况下允许半像素差。计划冲突、过期和缺失引用报错。Agent 在改项目组件前检查报告，通过既有 Capture 保存实际变化，出现并发冲突则重新读取并执行。菜单中不增加标准化动作。

验证入口：UiSketchCanvas 的 PersistentGroups、MultiSelection、DragPreview、EndStageDragPreview，以及 InfiniteCanvasViewport 的既有右键平移 Story；领域组、标准化与 CLI 单元测试，Capture CLI 的组保存与撤销集成测试。桌面参考视口为 1024×800、1280×800、1536×960。

2026-09-09 菜单关闭回归：原生 contextmenu 在右键松开后到达时，Dropdown 把画布判作触发锚点之外，导致刚打开的菜单立即关闭。继续复用本地 UiSketchCanvas 和 Ant Design Dropdown，禁用 Dropdown 的自动触发，改由下一次菜单外 pointerdown 关闭；保留键盘关闭、焦点归还及平移/缩放关闭。PersistentGroups 补齐松开前后两种原生事件顺序，修复前新增断言失败，修复后浏览器交互通过，覆盖建组、解组、外部点击、Escape 和右键平移。前端与 Storybook 类型检查、生产及 Storybook 构建、YisiUI doctor/check 通过；菜单 axe 检查无违规。

2026-09-06 验证：41 个测试文件、433 项测试及 103 项领域契约测试通过；类型检查、生产构建、Storybook 构建、i18n、domain-baseline 和 YisiUI doctor/check 通过，Human2AI Skill 校验通过。1024×800 前台浏览器完成 PersistentGroups、GroupedMemberDeletion、ReadOnlyGroups、MultiSelection、DragPreview、EndStageDragPreview 与既有平移回归；菜单需等待真实退出动画结束，后台标签页限频不作为交互失败依据。独立内存数据库的生产服务确认：建组新增版本，刷新保留成员关系，键盘整体微移只保存一次；标准化 CLI 从第 3 版派生第 4 版，将按钮与文字一起取整并对齐，浏览器收到更新，重复执行无几何变化。菜单键、Escape、点击外部关闭及焦点归还通过，菜单范围的 axe 检查没有违规。编辑器内的单项删除保留其他成员，并清理不足两个成员的组；画布 Delete 继续删除整组选取。
