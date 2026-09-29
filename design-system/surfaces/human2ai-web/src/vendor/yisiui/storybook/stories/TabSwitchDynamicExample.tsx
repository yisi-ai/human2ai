import { Profiler, useRef, useState } from "react";
import { TabSwitch, type TabSwitchItem, type TabSwitchItems } from "@human2ai/ui/yisiui";

const initial: TabSwitchItem[] = [1, 2, 3].map((key) => ({ key: String(key), label: `状态${key}`, mode: "text-only" }));

/** Consumer-owned mutations for the retained dynamic-collection Story. */
export function TabSwitchDynamicExample() {
  const [items, setItems] = useState(initial);
  const [value, setValue] = useState("1");
  const [width, setWidth] = useState("intrinsic");
  const [name, setName] = useState("激活");
  const [direction, setDirection] = useState<"ltr" | "rtl">("ltr");
  const nextKey = useRef(3);
  const host = useRef<HTMLDivElement>(null);
  const commits = useRef(0);
  const reorders = useRef(0);
  const [requestCount, setRequestCount] = useState(0);

  function action(key: string, source: string) {
    if (key === "rename") setItems(previous => previous.map(item => item.key === source ? { ...item, label: name } : item));
    if (key === "new") {
      const created = { key: String(++nextKey.current), label: `状态${nextKey.current}`, mode: "text-only" as const };
      setItems(previous => {
        const next = previous.slice();
        next.splice(next.findIndex(item => item.key === source) + 1, 0, created);
        return next;
      });
      setValue(created.key);
    }
    if (key === "delete" && items.length > 1) {
      const next = items.filter(item => item.key !== source);
      setItems(next);
      if (value === source) setValue(next[0].key);
    }
  }

  return <div ref={host} data-tab-layout-fixture style={{ display: "flex", flexDirection: "column", alignItems: "start", gap: 16 }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <label>宽度 <select aria-label="布局宽度" value={width} onChange={event => setWidth(event.target.value)}>
        <option value="intrinsic">内容固有宽度</option><option value="420">限制为 420px</option><option value="180">限制为 180px</option>
      </select></label>
      <label>方向 <select aria-label="布局方向" value={direction} onChange={event => setDirection(event.target.value as "ltr" | "rtl")}>
        <option value="ltr">LTR</option><option value="rtl">RTL</option>
      </select></label>
      <label>名称 <input aria-label="标签名称" value={name} onChange={event => setName(event.target.value)} /></label>
    </div>
    <div style={{ width: "100%", minWidth: 0 }}>
      <Profiler id="tab-layout" onRender={() => { if (host.current) host.current.dataset.commits = String(++commits.current); }}>
        <TabSwitch aria-label="动态状态栏" compact reorderable value={value} onChange={setValue}
          style={{ width: width === "intrinsic" ? undefined : Number(width), direction }}
          onReorder={keys => {
            setRequestCount(++reorders.current);
            setItems(previous => keys.map(key => previous.find(item => item.key === key)!));
          }}
          items={items.map(item => ({ ...item, menu: {
            trigger: "hover" as const,
            items: [{ key: "new", label: "新建" }, { key: "rename", label: "重命名" }, { key: "delete", label: "删除", danger: true, disabled: items.length === 1 }],
            onAction: action,
          } })) as TabSwitchItems} />
      </Profiler>
    </div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <button data-action="rename" onClick={() => action("rename", value)}>重命名选中项</button>
      <button data-action="new" onClick={() => action("new", value)}>新建并选中</button>
      <button data-action="delete" disabled={items.length === 1} onClick={() => action("delete", value)}>删除选中项</button>
      <button data-action="long" onClick={() => setItems(previous => previous.map(item => item.key === value ? { ...item, label: "包含长内容的状态名称".repeat(6) } : item))}>使用长名称</button>
      <button data-action="refresh" onClick={() => setItems(previous => previous.map(item => ({ ...item })))}>等价数据刷新</button>
      <button data-action="reset" onClick={() => { setItems(initial); setValue("1"); setRequestCount(0); reorders.current = 0; }}>重置示例</button>
    </div>
    <output data-order={items.map(item => item.key).join("|")} data-selection={value} data-reorders={requestCount}>当前选择：{value}；排序请求：{requestCount}</output>
  </div>;
}
