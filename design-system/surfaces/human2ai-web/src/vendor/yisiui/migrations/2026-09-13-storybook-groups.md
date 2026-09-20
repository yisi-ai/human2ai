# Storybook 分组归属

共享展示根分组统一为 `yisiui-Components`、`yisiui-Modules`、`yisiui-Layouts`、`yisiui-Foundations` 和 `yisiui-System`。组件名、导入路径、Registry key 和已有 Story id 保持不变；原先从标题生成 id 的共享 Story 已显式固定旧 id。

消费项目的本地 Story 标题使用 `.yisiui/config.json` 中的 `project` 原值作为根分组，例如 `human2ai/Components/Picker`。项目下现有的分类结构可保留，根分组大小写必须一致。产品包装组件、页面、原型以及尚未晋升的组件都属于项目自身；只有纳入 YisiUI 共享 Registry 并随源码版本分发的共享资产 Story 才进入共享分组，已纳入的 experimental 资产也使用共享分组。

在消费项目根目录执行 `node .yisiui/launcher.mjs diff`，检查后执行 `node .yisiui/launcher.mjs update`。共享标题、目录和 Skills 会随完整 release 更新。CLI 会升级与旧模板完全一致的 `.storybook/preview.ts` 排序配置；有自定义内容的文件保留，由消费项目把排序项中的旧共享分组替换为以上新名称，并保留项目自己的分组和自定义配置。

本地 Story 不会被同步命令自动重写。消费项目按源码和 Registry 归属检查本地标题，将误放或大小写不一致的项迁回 `<project>/...`。修改 `title` 前保留显式 `id`；原先无显式 `id` 的，先从旧 Storybook `index.json` 确认原有 id 前缀，再写入 metadata。保留 Story export 名称，避免已有链接变化。

验证 Storybook 类型检查和构建，检查生成的 `index.json` 中本地与共享标题归属、旧 Story id、Registry/catalog 链接，并运行消费端 doctor。临时检查不新增长期展示场景；同步 Skills 后开启新一轮 Agent 对话加载规则。

此次同步也补齐 npm Surface 的 Storybook 开发依赖声明：本地与共享 Story 的类型和测试工具从所属 Surface 解析，不再依赖 npm 把 Storybook 提升到仓库根目录。npm 和 pnpm Surface 均声明与 Storybook 工作区一致的版本；同步提示 `installRequired` 时运行项目的依赖安装命令，再做类型检查与构建。
