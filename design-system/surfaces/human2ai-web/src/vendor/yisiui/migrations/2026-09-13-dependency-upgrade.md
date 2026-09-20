# 2026-09-13 依赖升级

YisiUI 当前 source-sync candidate 采用以下固定依赖。React 与 React DOM 成对升级到 19.2 补丁版本，保持现有组件契约和 React 18/19 的 peer 范围。

| 依赖 | 原版本 | 新版本 |
| --- | --- | --- |
| antd | 6.3.5 | 6.6.3 |
| @ant-design/icons | 6.1.1 | 6.3.4 |
| react / react-dom | 19.2.4 | 19.2.8 |
| next | 16.3.2 | 16.3.5 |
| storybook / @storybook/* 框架和 a11y 插件 | 10.5.6 | 10.6.0 |

`@storybook/addon-webpack5-compiler-swc` 继续使用 4.0.3。TypeScript 5.8.3、`@types/react` 19.2.14、`@types/react-dom` 19.2.3 和 Tailwind CSS 3.4.17 保持不变。

## 已有消费项目

`yisiui update` 同步源码、Surface 的受管 peerDependencies 和此迁移说明。应用、Storybook 的已有 package.json 及包管理器锁文件属于消费项目，由消费项目显式更新；同步不会安装依赖。新建项目直接使用新版本。

先在消费项目执行 `npm run yisiui -- diff` 和 `npm run yisiui -- update`，再更新应用及 Storybook 的依赖，最后一次性安装，避免 React、React DOM 和受管 Surface 版本暂时不一致时分批安装。

默认 npm 布局可以在消费项目根目录执行：

```bash
npm pkg set --workspace web --workspace storybook dependencies.react=19.2.8 dependencies.react-dom=19.2.8 dependencies.antd=6.6.3 dependencies.@ant-design/icons=6.3.4
npm pkg set --workspace web dependencies.next=16.3.5
npm pkg set --workspace storybook devDependencies.storybook=10.6.0 devDependencies.@storybook/react-webpack5=10.6.0 devDependencies.@storybook/addon-a11y=10.6.0
npm install
npm run yisiui -- doctor
npm run build
npm run storybook:typecheck
npm run storybook:build
npm audit
```

自定义布局按 `.yisiui/config.json` 的 `applicationRoot`、`storybook.applicationRoot` 替换路径；pnpm 项目在对应两个 package.json 中设置表中版本，再运行 `pnpm install`，使用配置的消费命令执行 doctor。若根 workspace 也声明了这些依赖，或使用 pnpm catalog/overrides，同步校准对应版本并提交锁文件。`doctor` 会报告应用固定栈不匹配，包括 React DOM，但不能替代产品交互和生产构建验证。

消费端完成类型检查、生产构建、Storybook 和实际页面交互验证后，才算完成该产品的升级。YisiUI 的隔离消费测试不能代替真实产品验收。

## 验证与发布边界

仓库运行 `npm run check`，并通过 `npm run test:consumers` 验证 npm 旧项目显式迁移和 pnpm 新项目安装、连续同步、类型检查及构建。具体执行结果记录在独立的依赖升级验证记录中；历史版本证据不作为本次升级的验证结果。

本次调整依赖基线，不代表已经发布新包或批准 shared assets 稳定性。
