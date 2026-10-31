# DouAi 直播互动工作台

面向抖音直播的本地互动工具，包含直播消息控制台、答题互动、独立游戏画面与浏览器语音播报配置。

## 开发

需要 Node.js、pnpm 和 Python 3。

```sh
pnpm install
pnpm dev
```

前端由 Vite 提供，配置 API 使用本地 Python 服务，默认地址为 `http://127.0.0.1:8787`。

## Windows 桌面打包

项目使用 Tauri 2 打包，应用版本为 `1.0.3`。Windows 构建需要 Rust、
WebView2 和 NSIS。

```powershell
pnpm run package:windows
```

MSI 安装包会复制到项目根目录下一层的 `output/windows/DouAi_1.0.3_x64.msi`，原始构建产物位于
`src-tauri/target/release/bundle/msi/`。打包后的 Python API
作为 sidecar 随应用启动，SQLite 配置保存在当前用户的应用数据目录中。

## 功能

- 查看直播间评论、点赞、礼物和观众信息，并显示可用头像
- 配置直播连接、登录凭证和 WebSocket 消息转发
- 运行本地直播模拟，预览控制台与独立游戏画面
- 使用答题游戏、内置题库或 AI 生成题目
- 为答题游戏选择不同的游戏画面主题
- 配置通用直播事件和游戏的浏览器语音播报
- 将项目配置保存在本地 SQLite 数据库

## 验证

```sh
npm test
npm run build
python -m unittest discover -s tests -p "test*.py"
```

配置数据库为项目根目录的 `douai.sqlite3`，仅保存在本地，不应提交到版本控制。

## 直播协议实现

直播连接与消息解析使用仓库内的协议实现，兼容性依赖抖音直播服务，可能随平台变化。
