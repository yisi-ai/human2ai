# 镜头结构线与全空间深度参考

用户授权沿用空间右栏布局，在现有镜头预览区提供普通图、结构线图、全空间深度图及当前 PNG 下载。选择类型只改变派生参考，不保存为摄像机属性，不改变构图节点默认普通图。

比较现有 SpatialWorkspaceView、AppShellFrame、TabSwitch、BasicButton 与镜头 Select：沿用本地视图、右栏 slot、镜头 Select，以 TabSwitch 切换同级参考类型，BasicButton 下载当前参考。无需新增卡片、对话框或页面方向；不采用管理内容缓存的 Tabs，不新增通用下载组件。同步资产维持 0.11.0 experimental，本地视图维持 candidate。覆盖中文、英文、桌面 1024×800/1280×800、纵横镜头、加载/失败/重试/禁用与键盘切换。

语义记录归 spatial 分片：派生参考类型、普通着色图、可见结构线、统一相机深度与 PNG 下载。不同于构图的前景/中景/背景字段，也不同于编辑器透视骨架。

领域比较现有 createSpatialScene / createCharacterModel / renderSpatialPng、空间 PNG 路由、CLI spatial render、composition camera-reference。扩展 local spatial.scene-authoring，由同一模型和裁剪/深度缓冲输出各 pass；复用共享版本存储与路由错误处理。构图和 UI 草图的二维 SVG 输出不拥有三维表面深度，不合并渲染实现。

结构线从真实蒙皮三角形取指节短弧线，并按所有场景表面做遮挡测试；不显示网格三角边、隐藏骨架或选中高亮。深度采用同一摄像机的线性观察深度，按全图可见表面统一映射，近白远暗、无表面黑；不按人物或部位分别归一化。导出绑定 revision/camera/pass，缓存也包含 pass。

验证（2026-09-10）：空间相关 75 个测试通过；共享领域契约 131 通过、1 跳过。类型检查、i18n（525 keys / 524 semantic / 1 legacy）、domain-baseline、YisiUI doctor、服务与 Next 生产构建、Storybook 生产构建、打包清单检查通过。浏览器的 CameraReferenceInteractions 验证鼠标/键盘切换、下载 URL 与摄像机/pass 一致、不改变画幅且无页面横向溢出；CameraReferenceFailure 验证错误提示、禁用下载、重试重新加载。1024×800 英文三项选择同排显示、右栏不溢出；1280×800 实际页面参考可见、控制台无错误或警告。真实 API 三个 pass 返回 200，CLI 只读导出原始 300×400 深度图，源空间仍为 revision 216。

证据：docs/evidence/spatial/camera-references-panel.png、camera-structure-lines.png、camera-scene-depth.png。output/spatial-camera-references 保存同镜头高分辨率参考、两次内置 imagegen 真人生成和完整提示词。参考结构已经可核查，生成图仍有局部形状及取景偏差；单次对照不能证明稳定修复率。

模型指节线补充：spatial.scene-authoring@14 将同一表面线默认用于编辑模型及普通镜头图，随肤色加深，保留全场景遮挡且不参与部位拾取；深度输出保持纯深度。没有新增界面控件或语义。空间相关 74 项测试、共享契约 131 项（1 跳过）、完整类型与领域检查通过。浏览器确认模型细线和普通镜头 PNG 可见、普通图 API 返回 200；只读检查期间服务热更新曾造成草稿轮询 500，重试后恢复，最终刷新后控制台无错误或警告。镜头 PNG 证据：docs/evidence/spatial/model-finger-creases.png。

按用户补充要求，每根手指省略最靠近手掌的指根线；四指保留 PIP/DIP，拇指只保留 IP，所有可见参考复用同一筛选。

光照开关：用户确认默认明亮的编辑效果，并要求视口、镜头普通图同步。沿用 AppShellFrame 右栏信息与工具和现有 Ant Design Checkbox，在辅助骨架开关前增加空间级光照效果。已查询同步/本地资产：无专门布尔开关资产，TabSwitch 明确不用于单一布尔开关，复用页面现有 Checkbox，不新建通用组件、布局或持久说明文案。支持默认关闭、开启、加载/错误/禁用、空空间与英文；LightingInteractions 检查每次切换只有一次受控操作且不修改人物/摄像机。共享资产保留 0.11.0 experimental，本地视图保留 candidate。

命名新增 spatial.lighting-effects，界面为光照效果 / Lighting effects，表示整套方向光和投影，与构图的光源意图及仅移除环境补光区分。领域扩展 local spatial.scene-authoring@17：空间 lightingEnabled 缺省 false，用户与 Agent 共用 set-lighting，保存/撤销复用 DraftVersionStore；两种模式共用接触明暗、指节线和深度裁剪，普通图随源版本更新，结构线及深度独立。没有改动路由或增加渲染存储服务。

开关验证：85 项空间测试、132 项共享领域测试通过（1 跳过）；完整类型、i18n 526 keys、领域基线、YisiUI doctor、服务/Next/Storybook 构建通过。LightingInteractions 完成；浏览器确认 false/true/false 时环境填充与方向光、阴影同步改变，1024 桌面英文布局可操作、无溢出，加载/禁用禁止切换。1280 桌面中文手部实图见 docs/evidence/spatial/lighting-toggle-off.png；同一原镜头明亮 PNG 见 camera-even-lighting.png。

## 骨架投影预览

按用户要求把用于生图的骨架投影接入现有摄像机和观察盒预览。命名先记录 spatial.reference-skeleton（骨架投影 / Skeleton），扩充 spatial.reference-pass 的四种表示，并为 CLI 非法渲染类型记录 spatial.render-pass-error。复用本地 SpatialWorkspaceView、TabSwitch、PNG 下载与加载/失败/禁用状态；四项按两列排布，适配桌面右栏，不新增页面方向或持久化设置。

领域扩展 local spatial.scene-authoring@21，比较并复用 jointWorldTransforms、createOutputCamera、cameraBoxView、clipSegment 与现有 PNG 路由/缓存/CLI。骨架直接投影真实关节点和骨段，包括手指及自定义肢体，左蓝右橙、中轴中性色、头部轮廓。与其他 pass 共用镜头、画幅和视锥裁切；观察盒支持六宫格与单面，裁切交点不伪造关节点。骨架略去模型表面和物体，允许查看被表面遮住的关节，因此不声称它等同于表面遮挡或深度。选择或下载不改变姿势、镜头或版本。

验证：111 项空间测试覆盖通过；首次与构建并行时两项原有深度渲染测试触发 5 秒超时，构建完成后单独重跑该文件 10 项全部通过，未调整超时或断言。新增 4 项渲染测试，检查透视/正交投影与实际手指关节位置、光照/肤色/遮挡物独立性、背面/视锥外排除以及穿过观察盒的骨段裁切和合图一致性。摄像机及观察盒 API/CLI 集成测试均覆盖 skeleton。完整类型、i18n（547 keys / 546 semantic / 1 legacy）、领域基线、共享领域契约（133 通过 / 1 跳过）、YisiUI doctor、服务/Next/Storybook 构建通过。浏览器 CameraReferenceInteractions 验证四种预览切换、匹配下载、画幅及键盘操作；1024×800 英文侧栏无溢出，真实应用 400×300 镜头骨架及 1560×1092 手部观察盒合图均加载成功，下载文件名包含 skeleton，切换后验证副本仍为 revision 3，右栏无溢出。当前保存姿势的主镜头及手部六面图通过 CLI 只读导出并人工查看。

证据：docs/evidence/spatial/skeleton-preview-english.png、camera-skeleton-projection.png、hand-skeleton-sheet.png。
