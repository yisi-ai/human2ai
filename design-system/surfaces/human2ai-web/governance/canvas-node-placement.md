# UI 界面与构图节点放置

复用 CompositeButton、InfiniteCanvasViewport、CanvasScene、CanvasNode 与现有文字/图片编辑器。按 node-placement 能力查询未发现已有放置资产；CanvasNode 负责既有节点的变换，视口负责相机，均不承担新增预览。因此新增项目本地 candidate CanvasPlacement，统一两处鼠标手势与按帧预览，节点创建仍留在各自领域适配组件。工具保持既有命名，通过 aria-current 与主色表达激活；沿用现有布局和桌面视觉方向。

点击工具进入一次性放置，重复点击取消，其他节点工具替换当前工具。单击以鼠标世界坐标作为包围框左上角并使用原默认尺寸；拖动形状、图片或构图文字区域按两个端点确定宽高，支持反向拖动，最小宽高沿用节点的 8 个世界单位。UI 界面文字单击定位并打开原编辑器；构图文字区域放置后保持选中，可直接八向调整宽高，双击再编辑文字内容。焦点直接使用单击坐标。构图动线沿用无限直线数据，拖动只决定锚点和方向。三角形由包围框换算重心，不把包围框中心误存为重心。

共享放置层位于节点与画框上方，因此可覆盖已有节点并在画框外操作。相机的右键及空格加左键平移在捕获阶段优先处理，滚轮继续缩放。预览使用独立 path，每帧只应用最新轨迹；松手使用最终指针位置上报一次，页面继续使用既有 800ms 自动保存。成功后选中新节点并退出工具；Esc、pointercancel、意外丢失捕获、窗口失焦、工具切换、阶段/视图切换和卸载清理未完成预览。工具本身不拥有 API、草稿或节点标识。

领域比较包含 UiSketchCanvas 的阶段更新、CompositionCanvas/构图页的 addArea、addFocus、addDirectionLine、addTextRegion、addCompositionImage 以及 shared capture.draft-versioning。决定普通复用这些操作：UI 仍以像素保存，构图仍以中心/重心的归一化坐标保存，焦点和动线仍受既有容量限制。共有部分只是 UI 手势，并未抽取业务能力、修改 schema、保存协议或领域契约，所以领域注册表无需变更。命名工作流扩展 shared canvas.viewport-help，继续复用 canvas.viewport.instructions；中文和英文同步描述放置与 Esc，并保留相机手势，仅在既有帮助 Tooltip 按需呈现。

交互证据：CanvasPlacement 的 Default，UiSketchCanvas 的 NodePlacement、EndStageNodePlacement 及更新后的 Default、DefaultTextSize、NearbyRegionEditor，CompositionCanvas 的 NodePlacement。覆盖未放置不提交、按帧预览、反向拖动、最终松手尺寸、范围外默认图片、三角形重心、椭圆宽高、动线方向、文字编辑及取消清理。

2026-09-19 构图文字区域沿用既有桌面布局与 CanvasPlacement、CanvasNode 组合，取消仅单击限制与放置后自动打开编辑器的特例。CanvasNode 只负责已创建节点的缩放，TextMarkEditor 只负责双击后的内容编辑，均不替代放置交互。语义继续复用 composition.text-region 的 canonical key composition.toolNames.textRegion：指最终画面需要呈现文字的自由矩形区域，区别于文字内容字段和普通图形；中文“文字区域”、英文“Text region”及已有键记录均适用，无需修改文案。此次仅调整 UI 手势，复用 addTextRegion、resizeFreeArea 和既有草稿回调。现有 NodePlacement Story 增加反向拖动的最终坐标与尺寸、预览不提交、放置后选中且无弹窗、八向缩放入口和默认尺寸单击断言；TextRegion Story 保留双击编辑及字段写回断言。 新增拖动断言在修复前复现失败，修复后 NodePlacement 与 TextRegion 的浏览器交互通过；真实鼠标分别拖动右边和下边可独立调整宽高。相关 30 项单元测试、Web/Storybook 类型检查、YisiUI doctor/check、i18n check 与 Next 生产构建通过。

2026-09-06 验证完成：38 个测试文件、423 项测试通过；103 项领域契约测试、domain-baseline check、i18n check、YisiUI doctor/check、三处类型检查及生产构建通过。上述放置 Stories、UI 原有 DragPreview、Default、DefaultTextSize、NearbyRegionEditor 及构图 CanvasOnly 在浏览器完成，无控制台错误。回归测试同时修正了旧 Select CSS 选择器和备注 Tooltip 挂载后缓存的 SVG 节点引用，未改动编辑器产品逻辑。

独立生产服务使用临时 SQLite 验证两种画布：选择工具后等待超过自动保存延迟，再持续按住拖动，均没有写请求或新增节点；松手后各创建一次草稿版本。UI 使用真实鼠标在已有区域上方单击放置图片，默认尺寸为 320×180，自动选中且退出工具；刷新后两处坐标和尺寸保持。UI 开始/结束切换取消已呈现的预览，构图切换预览并返回编辑取消待创建图片，版本数不变。1024×800 桌面窗口无页面横向溢出。共享视口测试确认工具激活后焦点位于 SVG，空格加左键、右键平移及滚轮缩放均可继续使用，平移过程不新增节点。更大的桌面窗口检查了预览轮廓与工具激活样式。测试没有写入用户现有会话。
