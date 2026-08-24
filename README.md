# Human2AI

## 环境要求

- Node.js 22 或更高版本
- npm 11

## 安装依赖

在项目根目录执行：

```bash
npm install
```

## 启动开发环境

```bash
npm run dev
```

该命令同时启动 Web 操作页面和本地 API：

- Web：<http://localhost:3000>
- API：<http://127.0.0.1:4179>

如需修改端口，可设置 `HUMAN2AI_PORT`：

```bash
HUMAN2AI_PORT=4180 npm run dev
```

启动前会检查本地 Human2AI API；已有实例时直接复用，不重复启动。

已安装本地 npm 包的消费项目使用：

```bash
npx human2ai web
```

安装包中的 Web 与 API 同源运行，默认地址为 <http://127.0.0.1:4179>。

## 启动 Storybook

```bash
npm run storybook
```

Storybook 默认地址：<http://localhost:6006>
