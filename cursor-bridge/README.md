# Project Manager Cursor Bridge

> **已弃用**：project-manager 现改用 CLI 直接打开 Agent Workspace（`cursor --glass` + `/prompt` deeplink），无需安装本扩展。以下内容仅供调试参考。

本地 Cursor 扩展：接收 project-manager 的 HTTP 请求，在 Glass 内切换 Workspaces 并新建 Agent。

## 原理

project-manager server 在 checkout 分支后，向 `127.0.0.1:17320/open-agent` 发送 POST 请求；扩展在 Cursor 进程内调用：

1. `cursor.openOrFocusGlassWindow`
2. `newAgent`（带 `folderUri`）

这与 Cursor 内置「指定 workspace 新建 Agent」行为一致。

## Glass vs Editor 窗口（重要）

Cursor 有两种窗口，扩展加载行为不同：

| 窗口 | 用户扩展 | 桥接 HTTP 服务 |
|------|----------|----------------|
| **Glass**（Agent 多 Workspaces 界面） | 不加载 | 不会启动 |
| **Editor**（经典编辑器 / 打开文件夹） | 会加载 | 在 `127.0.0.1:17320` 监听 |

因此：

- 桥接扩展跑在 **Editor 窗口** 的扩展宿主里
- 收到请求后，扩展内部再调用 Glass 命令（`openOrFocusGlassWindow` + `newAgent`），去切换 Workspaces 并新建 Agent
- **仅开 Glass、没有任何 Editor 窗口时**，`curl /health` 会连接失败

**推荐用法**：平时保留至少一个 Editor 窗口（可最小化），例如用 project-manager 仓库本身：

```bash
cursor --reuse-window --classic /Users/ningliu/Documents/CodeLab/project-manager
```

点击「Agent 打开」时，若桥接未就绪，server 会自动尝试唤醒一个 Editor 窗口后再重试。

## 安装（macOS）

在 **project-manager 仓库根目录** 执行（不要分开跑，避免 `pwd` 指错目录）：

```bash
cd cursor-bridge
npm install
npm run compile
mkdir -p "$HOME/.cursor/extensions"
ln -sf "$PWD" "$HOME/.cursor/extensions/project-manager-cursor-bridge"
```

说明：

- macOS 上扩展目录就是 `~/.cursor/extensions`（即 `$HOME/.cursor/extensions`），与 Linux 相同
- `ln -sf` 在 macOS 上可用；`-s` 创建符号链接，`-f` 覆盖已有链接
- 必须在 `cursor-bridge` 目录内执行 `ln`，或用绝对路径，例如：
  `ln -sf "/Users/你/.../project-manager/cursor-bridge" "$HOME/.cursor/extensions/project-manager-cursor-bridge"`

重启 Cursor。启动后应看到提示：**Project Manager 桥接已启动（127.0.0.1:17320）**。

## 排查 `curl: Failed to connect`

`17320` 端口由 **Cursor 扩展进程**监听，不是 project-manager server。连接失败通常表示扩展未运行。

按顺序检查：

1. **Cursor 必须处于打开状态**（完全退出后重新打开，不是只关窗口）
2. **扩展已编译**：`cd cursor-bridge && npm run compile`，确认存在 `out/extension.js`
3. **扩展已启用**：`Cmd+Shift+X` 打开扩展面板，搜索 `Project Manager Cursor Bridge`，确认未 Disabled
4. **重载扩展**：`Cmd+Shift+P` → `Developer: Reload Window`
5. **看日志**：`View → Output` → 下拉选 **Project Manager Bridge**，应看到 `listening on http://127.0.0.1:17320`
6. **手动测状态**：`Cmd+Shift+P` → `Project Manager: Show Bridge Status`

若扩展面板里找不到该扩展，改用标准目录名重新链接：

```bash
cd cursor-bridge
npm run compile
mkdir -p "$HOME/.cursor/extensions"
rm -f "$HOME/.cursor/extensions/project-manager.project-manager-cursor-bridge-0.1.0"
ln -sf "$PWD" "$HOME/.cursor/extensions/project-manager.project-manager-cursor-bridge-0.1.0"
```

然后再次 **完全退出并重启 Cursor**，再执行：

```bash
curl http://127.0.0.1:17320/health
```

## 验证

```bash
curl http://127.0.0.1:17320/health
# {"ok":true,"service":"project-manager-cursor-bridge"}

curl -X POST http://127.0.0.1:17320/open-agent \
  -H 'Content-Type: application/json' \
  -d '{"path":"/absolute/path/to/repo","branch":"main"}'
```

## 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `projectManagerBridge.enabled` | `true` | 是否启用桥接 |
| `projectManagerBridge.port` | `17320` | 监听端口（仅 127.0.0.1） |

server 侧可通过环境变量覆盖地址：

```env
CURSOR_BRIDGE_URL=http://127.0.0.1:17320
```

## 开发

修改 `src/extension.ts` 后执行 `npm run compile`，在 Cursor 中 **Developer: Reload Window** 重载扩展。
