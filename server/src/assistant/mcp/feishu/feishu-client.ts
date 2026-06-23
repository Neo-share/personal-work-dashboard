import lark from '@larksuiteoapi/node-sdk';

let cachedClient: lark.Client | null = null;

export function getFeishuClient(): lark.Client {
  if (cachedClient) {
    return cachedClient;
  }

  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error('未配置 FEISHU_APP_ID / FEISHU_APP_SECRET');
  }

  cachedClient = new lark.Client({
    appId,
    appSecret,
    disableTokenCache: false,
  });
  return cachedClient;
}
