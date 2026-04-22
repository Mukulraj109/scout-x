const defaultEnvValues: Record<string, string> = {
  NODE_ENV: 'development',
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: '6379',
  REDIS_DB: '0',
  BACKEND_PORT: '8080',
  FRONTEND_PORT: '5173',
  BACKEND_URL: 'http://localhost:8080',
  PUBLIC_URL: 'http://localhost:5173',
  VITE_BACKEND_URL: 'http://localhost:8080',
  VITE_PUBLIC_URL: 'http://localhost:5173',
  SESSION_SECRET: 'maxun_session',
  JWT_SECRET: 'maxun_jwt_secret',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  LOGS_PATH: 'server/logs',
  BROWSER_WS_PORT: '3001',
  BROWSER_HEALTH_PORT: '3002',
  BROWSER_WS_HOST: '127.0.0.1',
};

export const getEnvVariable = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue || defaultEnvValues[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not defined`);
  }
  return value;
};

export const getOptionalEnvVariable = (key: string, defaultValue?: string): string | undefined => {
  return process.env[key] || defaultValue || defaultEnvValues[key];
};

export const getEnvNumber = (key: string, defaultValue?: number): number => {
  const rawValue = getEnvVariable(key, defaultValue !== undefined ? String(defaultValue) : undefined);
  const parsed = Number(rawValue);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} is not a valid number`);
  }
  return parsed;
};

export const applyDefaultEnv = () => {
  for (const [key, value] of Object.entries(defaultEnvValues)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};
