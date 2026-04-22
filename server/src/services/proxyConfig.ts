/**
 * Decrypted proxy settings and masking (shared by proxy routes and browser/run code).
 */
import User from '../models/User';
import { decrypt } from '../utils/auth';

export const normalizeProxyServer = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) || /^socks5?:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    if (!['http:', 'https:', 'socks5:'].includes(parsed.protocol)) {
      return null;
    }
    if (!parsed.hostname) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
};

export const maskProxyUrl = (url: string): string => {
  const normalized = normalizeProxyServer(url);
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname;
    const prefix = host.slice(0, Math.min(3, host.length));
    const suffix = host.length > 3 ? host.slice(-Math.min(3, host.length - prefix.length)) : '';
    const maskedDomain = `${prefix}****${suffix}`;
    if (parsed.port) {
      return `${parsed.protocol}//${maskedDomain}:${parsed.port}`;
    }
    return `${parsed.protocol}//${maskedDomain}`;
  } catch {
    const urlWithoutProtocol = url.replace(/^https?:\/\//, '').replace(/^socks5?:\/\//, '');
    const [domain, port] = urlWithoutProtocol.split(':');
    const maskedDomain = `${domain.slice(0, 3)}****${domain.slice(-3)}`;
    if (port) {
      return `${maskedDomain}:${port}`;
    }
    return maskedDomain;
  }
};

export const getDecryptedProxyConfig = async (userId: string) => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new Error('User not found');
  }

  const decryptedProxyUrl = user.proxy_url ? normalizeProxyServer(decrypt(user.proxy_url)) : null;
  const decryptedProxyUsername = user.proxy_username ? decrypt(user.proxy_username) : null;
  const decryptedProxyPassword = user.proxy_password ? decrypt(user.proxy_password) : null;

  return {
    proxy_url: decryptedProxyUrl,
    proxy_username: decryptedProxyUsername,
    proxy_password: decryptedProxyPassword,
  };
};
