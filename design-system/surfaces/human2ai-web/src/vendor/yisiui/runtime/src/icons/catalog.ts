/** Original YisiUI artwork. Each animation finishes in the default pose. */
export const animatedIconCatalog = [
  { name: "plus", label: "添加", motion: "双臂轻弹，四角短光芒向外散开", useWhen: "添加内容或展开新增入口" },
  { name: "upload", label: "上传", motion: "箭头上行，托盘泛起轻柔波纹", useWhen: "选择文件或请求上传" },
  { name: "send", label: "发送", motion: "纸飞机全程可见、轻进归位，尾流淡出", useWhen: "提交消息或发送内容" },
  { name: "refresh", label: "刷新", motion: "圆弧箭头回旋，内侧弧光跟随消散", useWhen: "刷新内容或重新加载" },
  { name: "copy", label: "复制", motion: "前页轻移，留下渐隐纸页余影", useWhen: "复制内容到剪贴板" },
  { name: "star", label: "收藏", motion: "星形轻弹，周围星芒短暂闪亮", useWhen: "收藏或突出显示内容" },
  { name: "bell", label: "通知", motion: "铃身摇动、铃舌跟随，两侧声波轻振", useWhen: "提示新通知" },
  { name: "close", label: "关闭", motion: "双线轻收，圆环向外炸开淡出", useWhen: "关闭界面或取消操作" },
  { name: "reset", label: "重置", motion: "箭头逆转，内圈向中心收拢消散", useWhen: "恢复默认值或初始状态" },
  { name: "sidebar-left", label: "左侧栏", motion: "左侧面板收展，横向滑动余迹淡出", useWhen: "显示或隐藏左侧栏" },
  { name: "sidebar-right", label: "右侧栏", motion: "右侧面板收展，镜像滑动余迹淡出", useWhen: "显示或隐藏右侧栏" },
  { name: "loading", label: "加载中", motion: "圆弧匀速旋转，内侧拖尾轻轻呼吸", useWhen: "提示正在加载或处理；由业务显式开启循环" },
  { name: "arrow-up", label: "向上箭头", motion: "向上轻进，尾部气流散开淡出后归位", useWhen: "向上移动、上一项或返回顶部的方向提示" },
  { name: "arrow-down", label: "向下箭头", motion: "向下轻进，尾部气流散开淡出后归位", useWhen: "向下移动、下一项或展开内容的方向提示" },
  { name: "arrow-left", label: "向左箭头", motion: "向左轻进，尾部气流散开淡出后归位", useWhen: "向左移动或返回的方向提示" },
  { name: "arrow-right", label: "向右箭头", motion: "向右轻进，尾部气流散开淡出后归位", useWhen: "向右移动或前进的方向提示" },
] as const;

export type AnimatedIconName = (typeof animatedIconCatalog)[number]["name"];
