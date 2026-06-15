import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import * as vscode from 'vscode';

const DEFAULT_PORT = 17320;
const OUTPUT_CHANNEL_NAME = 'Project Manager Bridge';
const ALLOWED_ORIGINS = new Set([
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:3100',
  'http://127.0.0.1:3100',
]);

interface OpenAgentRequest {
  path?: string;
  branch?: string | null;
  prompt?: string | null;
}

let bridgePort = DEFAULT_PORT;
let bridgeRunning = false;
let outputChannel: vscode.OutputChannel | undefined;

function log(message: string): void {
  outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}`);
}

function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({} as T);
        return;
      }
      try {
        resolve(JSON.parse(raw) as T);
      } catch {
        reject(new Error('请求体必须是 JSON'));
      }
    });
    req.on('error', reject);
  });
}

function writeJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>,
  origin: string | undefined,
): void {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(payload));
}

async function openAgentInGlass(body: OpenAgentRequest): Promise<void> {
  const repoPath = body.path?.trim();
  if (!repoPath || !path.isAbsolute(repoPath)) {
    throw new Error('path 必须是绝对路径');
  }
  if (!fs.existsSync(repoPath)) {
    throw new Error(`路径不存在：${repoPath}`);
  }

  log(`open-agent path=${repoPath} branch=${body.branch ?? ''}`);

  await vscode.commands.executeCommand('cursor.openOrFocusGlassWindow', {
    agentsWindowOpenSource: 'project-manager-bridge',
  });

  const folderUri = vscode.Uri.file(repoPath).toString();
  await vscode.commands.executeCommand('newAgent', {
    folderUri,
    source: 'project-manager',
  });
}

function createBridgeServer(): http.Server {
  return http.createServer((req, res) => {
    const origin = req.headers.origin;
    const url = req.url ?? '/';

    if (req.method === 'OPTIONS') {
      writeJson(res, 204, {}, origin);
      return;
    }

    void (async () => {
      try {
        if (req.method === 'GET' && url === '/health') {
          writeJson(res, 200, { ok: true, service: 'project-manager-cursor-bridge', port: bridgePort }, origin);
          return;
        }

        if (req.method === 'POST' && url === '/open-agent') {
          const body = await readJsonBody<OpenAgentRequest>(req);
          await openAgentInGlass(body);
          writeJson(res, 200, { ok: true }, origin);
          return;
        }

        writeJson(res, 404, { ok: false, error: 'Not Found' }, origin);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`request failed: ${message}`);
        writeJson(res, 400, { ok: false, error: message }, origin);
      }
    })();
  });
}

function startBridge(context: vscode.ExtensionContext): void {
  const config = vscode.workspace.getConfiguration('projectManagerBridge');
  if (!config.get<boolean>('enabled', true)) {
    log('bridge disabled by setting projectManagerBridge.enabled=false');
    return;
  }

  bridgePort = config.get<number>('port', DEFAULT_PORT);
  const server = createBridgeServer();

  server.on('error', (error: NodeJS.ErrnoException) => {
    bridgeRunning = false;
    const detail = error.code === 'EADDRINUSE'
      ? `端口 ${bridgePort} 已被占用`
      : error.message;
    log(`server error: ${detail}`);
    void vscode.window.showErrorMessage(`Project Manager 桥接启动失败：${detail}`);
  });

  server.listen(bridgePort, '127.0.0.1', () => {
    bridgeRunning = true;
    log(`listening on http://127.0.0.1:${bridgePort}`);
    void vscode.window.showInformationMessage(
      `Project Manager 桥接已启动（127.0.0.1:${bridgePort}）`,
    );
  });

  context.subscriptions.push({
    dispose: () => {
      bridgeRunning = false;
      server.close();
    },
  });
}

export function activate(context: vscode.ExtensionContext): void {
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(outputChannel);
  log('extension activated');

  startBridge(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('projectManagerBridge.showStatus', () => {
      outputChannel?.show(true);
      const message = bridgeRunning
        ? `桥接运行中：http://127.0.0.1:${bridgePort}/health`
        : '桥接未运行，请查看 Output → Project Manager Bridge 日志';
      void vscode.window.showInformationMessage(message);
    }),
    vscode.commands.registerCommand('projectManagerBridge.openAgent', async () => {
      const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!folder) {
        void vscode.window.showErrorMessage('当前窗口没有打开的工作区文件夹');
        return;
      }
      await openAgentInGlass({ path: folder });
      void vscode.window.showInformationMessage(`已请求在 ${folder} 新建 Agent`);
    }),
  );
}

export function deactivate(): void {
  bridgeRunning = false;
}
