import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import {
  isFeishuAccessTokenExpired,
  isFeishuRefreshTokenExpired,
  loadFeishuToken,
  saveFeishuToken,
  type FeishuTokenData,
} from './token-store.js';

const TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';

function getAppCredentials() {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error('未配置 FEISHU_APP_ID / FEISHU_APP_SECRET');
  }
  return { appId, appSecret };
}

function postJson(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);

    const req = httpsRequest(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data) as Record<string, unknown>);
          } catch {
            reject(new Error(`飞书 OAuth 响应解析失败: ${data}`));
          }
        });
      },
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function refreshAccessToken(tokenData: FeishuTokenData): Promise<FeishuTokenData> {
  const { appId, appSecret } = getAppCredentials();
  const data = await postJson(TOKEN_URL, {
    grant_type: 'refresh_token',
    client_id: appId,
    client_secret: appSecret,
    refresh_token: tokenData.refresh_token,
  });

  if (data.code !== 0) {
    throw new Error(
      `刷新飞书 token 失败: ${String(data.error_description ?? data.error ?? data.msg)}`,
    );
  }

  const now = Date.now();
  const nextToken: FeishuTokenData = {
    access_token: String(data.access_token),
    expires_at: now + Number(data.expires_in) * 1000,
    token_type: data.token_type ? String(data.token_type) : undefined,
    scope: data.scope ? String(data.scope) : undefined,
  };

  if (data.refresh_token) {
    nextToken.refresh_token = String(data.refresh_token);
    nextToken.refresh_expires_at = now + Number(data.refresh_token_expires_in) * 1000;
  }

  saveFeishuToken(nextToken);
  return nextToken;
}

/** 服务端仅使用缓存/刷新 token，不触发浏览器 OAuth */
export async function getFeishuUserAccessTokenIfAvailable(): Promise<string | null> {
  let tokenData = loadFeishuToken();
  if (tokenData?.access_token && !isFeishuAccessTokenExpired(tokenData)) {
    return tokenData.access_token;
  }

  if (tokenData?.refresh_token && !isFeishuRefreshTokenExpired(tokenData)) {
    try {
      tokenData = await refreshAccessToken(tokenData);
      return tokenData.access_token;
    } catch {
      return null;
    }
  }

  return null;
}
