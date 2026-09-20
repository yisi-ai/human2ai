# 几何人偶模型

用户确认新增球形关节、圆柱骨段、长方体手掌/脚、仅有双眼的椭球头。沿用现有 AppShellFrame 右栏、SpatialWorkspaceView 与 Select 字段布局，增加模型样式 / Model style：人体模型 / Human model、几何人偶 / Geometric mannequin。选择样式与男女性解剖尺寸、颜色、比例、暂态骨架投影分别表达。语义记录在 spatial 分片，三个新概念及中英文先于界面实现登记。

已查询同步与本地资产，复用当前人物参数和 Select；TabSwitch 继续表达面板/参考视图，不用于新增实体类型。沿用 0.11.0 experimental 共享壳层与 candidate 本地空间视图，未更改页面方向或同步资产。Story 先覆盖几何模型、英文、禁用与切换交互，现有空/加载/失败/长内容边界继续复用。

领域比较 createCharacterModel、createSpatialScene、jointWorldTransforms、handRestMatrix、比例/固定解算、put-character、PNG 路由及观察盒取景。扩展 local spatial.scene-authoring@22：新外观只生成刚性几何，继续由当前骨架统一驱动。add-character 可指定 appearance，切换使用原有 put-character；不新增操作、仓库或版本机制，保存与撤销复用 shared capture.draft-versioning。男女底模提供原有解剖尺寸；旧 v1/skeleton 格式继续拒绝。

几何模型的关节使用稍粗的蓝灰球体，骨段与实体使用人物颜色。手掌框住原有指根、拇指从掌侧连接，各节绕原有轴运动；手指转动不拉扯手掌。头部双眼保持头的朝向；脚的厚度与共享脚踝抬升相配合，默认脚底不因脚码变化下沉。头顶、脚尖的终点是实体定位标记，球形连接显示在真正铰接处及指尖。编辑器不再给几何模型叠加重复的辅助骨架；原有关节/骨段选择、高亮、位置与旋转工具保持使用同一数据。镜头与六面观察盒渲染和取景均复用这一组几何。

验证：空间专项 117 项全部通过，其中新增 5 项几何模型测试及 1 项 API/CLI 集成测试。覆盖男女性三头身骨段/关节点投影一致、四臂和双头、拇指及手指动作、刚性手掌、颈长不改变躯干/头部大小、脚码增长的脚底高度、四类镜头和观察盒输出，以及带固定的外观切换、不可变历史缓存和撤销。共享领域契约 133 通过、1 跳过；完整类型、i18n（550 keys / 549 semantic / 1 legacy）、领域基线、YisiUI doctor、服务/Next/Storybook 生产构建均通过。

浏览器 GeometricInteractions 完成三次外观切换，每次只保存一个外观变化，四臂姿势和所有原字段保持；1280×800 中文右栏可操作，1024×800 英文模型样式完整显示、右栏无溢出，控制台无错误或警告。手动检查普通七头身、三头身、已保存姿势的镜头与手部六面图，关节异色和五指分节可见。数值约束沿用原系统，未新增实体碰撞阻止，因此用户仍可摆出部位相互穿插的姿势。

证据：docs/evidence/spatial/geometric-workspace.png、geometric-three-heads.png、geometric-posed-camera.png、geometric-hands-six-views.png。


五指配色补充：扩展 local spatial.scene-authoring@23，复用 createGeometricCharacterModel 材质及原有 WebGL 选中逻辑，普通镜头和观察盒不维护第二份配色。拇指橙、食指蓝、中指绿、无名指紫、小指粉，左右与复制手同名同色；关节球为同色系浅色。选中几何手指只提亮，保留身份颜色；其他部位仍使用原有选中色。人物肤色不覆盖五指配色。普通摄像机 renderer=7、观察盒 renderer=3，刷新已缓存的 PNG，无需修改已保存姿势。没有新增控件、文案、参数、操作或持久化字段。

配色验证：几何模型、API/CLI 与光照专项 12 项通过，共享领域契约 133 通过、1 跳过；完整类型、i18n、领域基线、YisiUI doctor、服务/Next/Storybook 生产构建通过。已人工检查普通镜头及六面手部图的五指配色和浅色关节，浏览器无错误或警告。配色证据：docs/evidence/spatial/geometric-finger-colors.png、geometric-finger-colors-workspace.png；编辑视图可见复制手与原手使用一致的五指颜色。

## 几何部位辨识（2026-09-13）

用户授权执行上一轮建议的第一阶段：普通参考图增加可见遮挡边界细线，并加强几何人偶关节与骨段的明暗差。比较 createGeometricCharacterModel、createSpatialScene、PNG 深度/部位缓冲、结构线和观察盒复用路径后，继续扩展 local spatial.scene-authoring@24；不新增操作、持久化字段、控件或产品文案，保存与撤销仍由 DraftVersionStore 管理。

五指沿用既有身份配色，关节球进一步提亮；身体关节依据人物颜色的明度选择深色或浅色混合，避免人物颜色恰好接近原蓝灰关节。编辑视口与 PNG 共用该材质。普通镜头及观察盒 color PNG 复用已有深度与部位缓冲，对每个几何关节/骨段的可见边界作 1–3 像素的同色系暗描线，宽度随输出尺寸调整；仅近侧表面着线，眼睛与头共享身份，透明像素、隐藏部位、三角面接缝及画幅裁切不加线。人体模型、场景物体和其他参考类型保持原渲染规则。描线仅在服务端生成参考图时计算，不增加编辑视口的渲染步骤或改变光照开关。

普通镜头 renderer=8、观察盒 renderer=4，使已保存姿势重新加载新版 PNG，不写入新 revision。正式视觉证据保持待用户审阅，不更新页面视觉基线。

验证：新增 5 项回归先失败后通过，覆盖浅色/原蓝灰/深色人物及左右五指的关节明度差、透视/正交下极近同色部位的边界、透明轮廓、插入顺序、深度/结构线保持和前方物体完整遮挡。空间专项共 125 项通过；其中缓存测试曾在与构建并行时超时，单独复跑 3 项全部通过（869 ms）。共享领域契约 140 通过、1 跳过；领域门禁、Server/Web/Storybook 类型检查、服务端与 Next 生产构建、YisiUI doctor 均通过。

浏览器使用内存数据库的隔离测试场景验证 1280×800 桌面：普通镜头 renderer=8 返回 200、480×480，下载链接与预览一致；观察盒 renderer=4 返回 200、792×580，检查期间 revision 始终为 1，无页面横向溢出。浏览器记录到无关的 favicon.ico 404 和无头 Chrome 软件渲染 ReadPixels 性能提示，无应用脚本错误。实际渲染证据：docs/evidence/spatial/geometric-reference-contrast.png（左修改前、右修改后）、geometric-contrast-workspace.png、geometric-overlapping-legs.png。
