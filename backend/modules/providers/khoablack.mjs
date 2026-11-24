import { env } from '../../config/env.mjs';

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

const config = () => {
  if (!env.khoablack.enabled) throw fail(503, 'KhoaBlack chưa được bật.');
  if (!env.khoablack.apiKey) throw fail(503, 'Thiếu KHOABLACK_API_KEY trên server.');
  return env.khoablack;
};

const request = async (path, options = {}) => {
  const cfg = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const response = await fetch(`${cfg.baseUrl}${path}`, {
      ...options,
      headers: { accept: 'application/json', ...(options.body ? { 'content-type': 'application/json' } : {}), 'x-api-key': cfg.apiKey, ...(options.headers || {}) },
      signal: controller.signal,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status === false) {
      throw fail(response.status >= 400 ? response.status : 502, body?.message || `KhoaBlack trả về HTTP ${response.status}.`);
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw fail(504, 'Kết nối KhoaBlack bị timeout.');
    throw error;
  } finally { clearTimeout(timer); }
};

export const khoablack = {
  check: () => request('/check'),
  games: async () => (await request('/games')).games || [],
  packages: async (gameCode) => (await request(`/packages/${encodeURIComponent(gameCode)}`)).packages || [],
  createOrder: async ({ packageId, accountInfo }) => {
    const callbackUrl = env.khoablack.callbackUrl;
    const body = { package_id: packageId, account_info: accountInfo };
    if (callbackUrl) body.callback_url = callbackUrl;
    const response = await request('/orders', { method: 'POST', body: JSON.stringify(body) });
    if (!response.order?.id) throw fail(502, 'KhoaBlack không trả về mã đơn.');
    return response.order;
  },
  status: async (providerOrderId) => {
    const response = await request(`/orders/${encodeURIComponent(providerOrderId)}/status`);
    if (!response.order) throw fail(502, 'KhoaBlack không trả về trạng thái đơn.');
    return response.order;
  },
};
