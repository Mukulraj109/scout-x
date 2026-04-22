const rawBackend = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080';

/** Backend origin without trailing slash (same as axios `${apiUrl}/api/...`). */
export const apiUrl = String(rawBackend).replace(/\/+$/, '');

/** Full `/api` base for the Chrome extension “Connection” setting (must match server routes). */
export const extensionApiBaseUrl = `${apiUrl}/api`;