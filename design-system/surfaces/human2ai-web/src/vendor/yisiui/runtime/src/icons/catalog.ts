/** Original YisiUI artwork. Each animation finishes in the default pose. */
export const animatedIconCatalog = [
  { name: "plus", label: "添加", motion: "等长双臂同步轻弹后归位", useWhen: "添加内容或展开新增入口" },
  { name: "upload", label: "上传", motion: "完整箭头上行后归位", useWhen: "选择文件或请求上传" },
  { name: "send", label: "发送", motion: "完整纸飞机飞出后回位", useWhen: "提交消息或发送内容" },
  { name: "refresh", label: "刷新", motion: "完整圆弧箭头回旋后停稳", useWhen: "刷新内容或重新加载" },
  { name: "copy", label: "复制", motion: "前页轻移后归位", useWhen: "复制内容到剪贴板" },
  { name: "star", label: "收藏", motion: "圆润星形整体轻弹后复位", useWhen: "收藏或突出显示内容" },
  { name: "bell", label: "通知", motion: "铃身轻摇、实心铃舌跟随", useWhen: "提示新通知" },
  { name: "close", label: "关闭", motion: "双线同步等比缩放后复位", useWhen: "关闭界面或取消操作" },
  { name: "reset", label: "重置", motion: "回转箭头逆转一周后归位", useWhen: "恢复默认值或初始状态" },
  { name: "sidebar-left", label: "左侧栏", motion: "左侧面板轻收展开后归位", useWhen: "显示或隐藏左侧栏" },
  { name: "sidebar-right", label: "右侧栏", motion: "右侧面板轻收展开后归位", useWhen: "显示或隐藏右侧栏" },
  { name: "loading", label: "加载中", motion: "圆弧匀速旋转，支持连续循环", useWhen: "提示正在加载或处理；由业务显式开启循环" },
] as const;

export type AnimatedIconName = (typeof animatedIconCatalog)[number]["name"];
