import logger from '../logger';
import { getDecryptedProxyConfig, normalizeProxyServer } from './proxyConfig';

export interface ProxyProfile {
  server: string;
  username?: string;
  password?: string;
}

export const resolveProxyPool = async (
  userId: string,
  runtimeConfig?: Record<string, any>
): Promise<ProxyProfile[]> => {
  const browserLocation = runtimeConfig?.browserLocation || {};
  const configuredPool = Array.isArray(browserLocation.proxyPool) ? browserLocation.proxyPool : [];

  const pool: ProxyProfile[] = configuredPool
    .map((server: string) => normalizeProxyServer(server))
    .filter(Boolean)
    .map((server: string) => ({
      server,
      username: browserLocation.proxyUsername || undefined,
      password: browserLocation.proxyPassword || undefined,
    }));

  const explicitProxy = normalizeProxyServer(browserLocation.proxyServer);
  if (explicitProxy) {
    pool.unshift({
      server: explicitProxy,
      username: browserLocation.proxyUsername || undefined,
      password: browserLocation.proxyPassword || undefined,
    });
  }

  try {
    const userProxy = await getDecryptedProxyConfig(userId);
    const userProxyServer = normalizeProxyServer(userProxy.proxy_url);
    if (userProxyServer) {
      pool.push({
        server: userProxyServer,
        username: userProxy.proxy_username || undefined,
        password: userProxy.proxy_password || undefined,
      });
    }
  } catch (error: any) {
    logger.log('warn', `Unable to resolve stored proxy config for user ${userId}: ${error.message}`);
  }

  const unique = new Map<string, ProxyProfile>();
  pool.forEach((proxy) => unique.set(`${proxy.server}:${proxy.username || ''}`, proxy));
  return Array.from(unique.values());
};

export const selectRotatedProxy = (pool: ProxyProfile[], attempt: number): ProxyProfile | null => {
  if (pool.length === 0) return null;
  const selected = pool[attempt % pool.length];
  logger.log('info', `Selected rotated proxy ${selected.server} for attempt ${attempt + 1}`);
  return selected;
};
