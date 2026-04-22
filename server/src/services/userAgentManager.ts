import logger from '../logger';

const REAL_BROWSER_USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/121.0.0.0 Safari/537.36',
];

export const getUserAgentPool = (configuredPool?: string[]): string[] => {
  const cleanConfigured = (configuredPool || []).map((item) => item.trim()).filter(Boolean);
  return cleanConfigured.length > 0 ? cleanConfigured : REAL_BROWSER_USER_AGENTS;
};

export const selectRotatedUserAgent = (attempt: number, configuredPool?: string[]): string => {
  const pool = getUserAgentPool(configuredPool);
  const selected = pool[attempt % pool.length];
  logger.log('info', `Selected rotated user agent for attempt ${attempt + 1}`);
  return selected;
};
