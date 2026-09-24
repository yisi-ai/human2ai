import { useId, useState, type CSSProperties } from "react";
import { Checkbox, ConfigProvider, Input, type ThemeConfig } from "antd";
import { BasicButton } from "@human2ai/ui/yisiui";

import styles from "./FoundationsColorComparison.module.css";

interface Palette {
  name: string;
  description: string;
  primary: string;
  hover: string;
  active: string;
  foreground: string;
  text: string;
  background: string;
  backgroundHover: string;
}

// Review candidates scoped to this Story; these do not change the shared theme.
const palettes: Palette[] = [
  {
    name: "原方案 · 深青绿", description: "偏灰、沉稳，作为对照",
    primary: "#2F5D62", hover: "#3B7075", active: "#24484D",
    foreground: "#FFFFFF", text: "#24484D", background: "#EDF3F2", backgroundHover: "#E1ECEA",
  },
  {
    name: "鲜绿 · 当前主色", description: "明亮、自然，绿色辨识度高",
    primary: "#22C55E", hover: "#4ADE80", active: "#16A34A",
    foreground: "#FFFFFF", text: "#15803D", background: "#F0FDF4", backgroundHover: "#DCFCE7",
  },
  {
    name: "翡翠绿", description: "略偏青，清爽且克制",
    primary: "#10B981", hover: "#34D399", active: "#0EAD78",
    foreground: "#FFFFFF", text: "#047857", background: "#ECFDF5", backgroundHover: "#D1FAE5",
  },
  {
    name: "青柠绿", description: "偏黄，更活泼、醒目",
    primary: "#84CC16", hover: "#A3E635", active: "#65A30D",
    foreground: "#FFFFFF", text: "#4D7C0F", background: "#F7FEE7", backgroundHover: "#ECFCCB",
  },
];

function PalettePreview({ palette }: { palette: Palette }) {
  const id = useId();
  const [selected, setSelected] = useState(true);
  const [saved, setSaved] = useState(false);
  const theme: ThemeConfig = {
    token: {
      colorPrimary: palette.primary,
      colorPrimaryHover: palette.hover,
      colorPrimaryActive: palette.active,
      colorPrimaryBg: palette.background,
      colorPrimaryBgHover: palette.backgroundHover,
      colorPrimaryBorder: palette.text,
      colorPrimaryBorderHover: palette.text,
      colorPrimaryText: palette.text,
      colorPrimaryTextHover: palette.text,
      colorPrimaryTextActive: palette.text,
      colorTextLightSolid: palette.foreground,
      colorLink: palette.text,
      colorLinkHover: palette.text,
      colorLinkActive: palette.text,
      controlOutline: palette.text,
      controlItemBgActive: palette.background,
      controlItemBgActiveHover: palette.backgroundHover,
    },
    components: {
      Button: {
        defaultHoverColor: palette.text,
        defaultActiveColor: palette.text,
        defaultHoverBorderColor: palette.text,
        defaultActiveBorderColor: palette.text,
      },
      Checkbox: { colorWhite: palette.foreground },
      Input: {
        activeBorderColor: palette.text,
        hoverBorderColor: palette.text,
        activeShadow: `0 0 0 2px ${palette.backgroundHover}`,
      },
    },
  };
  const variables = {
    "--preview-primary": palette.primary,
    "--preview-text": palette.text,
    "--preview-background": palette.background,
    "--yisiui-color-border-focus": palette.text,
  } as CSSProperties;

  return (
    <ConfigProvider theme={theme}>
      <section className={styles.preview} style={variables} aria-labelledby={`${id}-title`}>
        <header className={styles.heading}>
          <div>
            <h2 id={`${id}-title`}>{palette.name}</h2>
            <p>{palette.description}</p>
          </div>
          <code>{palette.primary}</code>
        </header>
        <div className={styles.swatches} aria-label="默认、悬停与按下颜色">
          {([
            ["默认", palette.primary], ["悬停", palette.hover], ["按下", palette.active],
          ] as const).map(([label, color]) => (
            <div key={label} style={{ background: color, color: palette.foreground }}>
              <span>{label}</span><code>{color}</code>
            </div>
          ))}
        </div>
        <form className={styles.form} onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
          <label htmlFor={`${id}-name`}>工作区名称</label>
          <Input id={`${id}-name`} defaultValue="设计资料库" onChange={() => setSaved(false)} />
          <div className={styles.selection} data-selected={selected}>
            <Checkbox checked={selected} onChange={(event) => setSelected(event.target.checked)}>
              {selected ? "已选中设计资源" : "选择设计资源"}
            </Checkbox>
            <span className={styles.selectionLabel}>{selected ? "已选中" : "未选中"}</span>
          </div>
          <div className={styles.examples}>
            <BasicButton type="primary" loading>保存中</BasicButton>
            <BasicButton type="primary" disabled>暂不可用</BasicButton>
            <BasicButton type="link" onClick={() => setSelected((value) => !value)}>切换选择</BasicButton>
          </div>
          <footer className={styles.footer}>
            <span role="status">{saved ? "本页设置已保存" : "可悬停、点击或按 Tab 查看焦点"}</span>
            <div className={styles.actions}>
              <BasicButton onClick={() => setSaved(false)}>取消</BasicButton>
              <BasicButton type="primary" htmlType="submit">保存设置</BasicButton>
            </div>
          </footer>
        </form>
      </section>
    </ConfigProvider>
  );
}

export function FoundationsColorComparison() {
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.intro}>
          <h1>主色对比</h1>
          <p>相同背景与控件，对比四组主色。主色按钮搭配白色文字和图标，链接和焦点使用同色系深色。</p>
        </header>
        <div className={styles.grid}>
          {palettes.map((palette) => <PalettePreview key={palette.name} palette={palette} />)}
        </div>
      </div>
    </main>
  );
}
