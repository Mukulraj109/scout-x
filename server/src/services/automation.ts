import { Page } from 'playwright-core';
import fetch from 'cross-fetch';
import logger from '../logger';
import ExtractedData from '../models/ExtractedData';
import Robot, { IRobot } from '../models/Robot';
import Run, { IRun } from '../models/Run';
import { ListExtractionConfig } from './listExtractor';
import { dispatchAutomationDestinations } from './destinations';

export interface AutomationRuntimeConfig {
  schedule?: {
    enabled?: boolean;
    cron?: string;
    timezone?: string;
  };
  performance?: {
    useBrowserReusePool?: boolean;
    maxPagesPerBrowser?: number;
    blockResources?: boolean;
  };
  destinations?: {
    webhook?: {
      enabled?: boolean;
      url?: string;
      retryAttempts?: number;
      retryDelaySeconds?: number;
      timeoutSeconds?: number;
    };
    googleSheets?: {
      enabled?: boolean;
      spreadsheetId?: string;
      sheetName?: string;
    };
    airtable?: {
      enabled?: boolean;
      apiKey?: string;
      baseId?: string;
      tableName?: string;
    };
    database?: {
      enabled?: boolean;
      type?: 'postgres' | 'mysql';
      connectionString?: string;
      tableName?: string;
    };
  };
  browserLocation?: {
    proxyServer?: string;
    proxyUsername?: string;
    proxyPassword?: string;
    proxyPool?: string[];
  };
  userAgent?: string;
  userAgentPool?: string[];
  headless?: boolean;
  useStealth?: boolean;
  reuseSession?: boolean;
  locale?: string;
  cookies?: Array<Record<string, any>>;
  localStorage?: Record<string, string>;
  dataCleanup?: {
    removeEmptyRows?: boolean;
    removeDuplicates?: boolean;
  };
  pagination?: {
    mode?: 'none' | 'auto-scroll' | 'selector' | 'page-number-loop';
    autoScroll?: boolean;
    nextButtonSelector?: string;
    pageParam?: string;
    startPage?: number;
    /** Cap on inner scroll-step loop (parity with extension auto-scroll). */
    maxScrollSteps?: number;
    /** Budget for `waitForLoadingToFinish` between scroll steps. */
    scrollSpinnerBudgetMs?: number;
    /** How long to wait for a click-next / load-more to actually re-render. */
    loadMoreWaitMs?: number;
  };
  /**
   * Pop-up / dialog handling knobs. Mirrors the Chrome extension's behaviour:
   *   - autoDismiss (default: true)   → click visible accept/close buttons.
   *   - acceptDialogs (default: false)→ accept alert/confirm/prompt dialogs
   *     instead of dismissing them.
   */
  popups?: {
    autoDismiss?: boolean;
    acceptDialogs?: boolean;
  };
  /**
   * CAPTCHA handling. Currently: detect + pause the run (no third-party
   * solver). A `captcha:required` socket event is emitted for the UI.
   */
  captcha?: {
    pauseOnDetect?: boolean;
  };
  listExtraction?: ListExtractionConfig;
  screenshots?: {
    enabled?: boolean;
  };
  webhookUrl?: string;
}

type SerializableOutput = Record<string, any> | null | undefined;

interface ExtractedRow {
  source: string;
  data: Record<string, any>;
}

const isPlainObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const sortObject = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const isMeaningfulValue = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
};

const isMeaningfulRow = (row: Record<string, any>): boolean =>
  Object.values(row).some((value) => isMeaningfulValue(value));

const coerceRow = (value: any): Record<string, any> => {
  if (isPlainObject(value)) {
    return value;
  }

  return { value };
};

const pushRows = (rows: ExtractedRow[], source: string, payload: any) => {
  if (Array.isArray(payload)) {
    payload.forEach((item) => rows.push({ source, data: coerceRow(item) }));
    return;
  }

  if (isPlainObject(payload)) {
    if (Array.isArray(payload.results)) {
      payload.results.forEach((item) => rows.push({ source, data: coerceRow(item) }));
      return;
    }

    const nestedValues = Object.values(payload);
    if (nestedValues.every((item) => Array.isArray(item))) {
      nestedValues.forEach((item) => pushRows(rows, source, item));
      return;
    }
  }

  rows.push({ source, data: coerceRow(payload) });
};

export const getAutomationConfig = (robot: any): AutomationRuntimeConfig => {
  const meta = robot?.recording_meta || {};
  const storedConfig = meta?.saasConfig;
  if (!storedConfig || typeof storedConfig !== 'object') {
    return {};
  }

  return storedConfig as AutomationRuntimeConfig;
};

export const extractRowsFromOutput = (
  serializableOutput: SerializableOutput,
  config?: AutomationRuntimeConfig
): ExtractedRow[] => {
  if (!serializableOutput || typeof serializableOutput !== 'object') {
    return [];
  }

  const rows: ExtractedRow[] = [];
  const typedBuckets = ['scrapeSchema', 'scrapeList', 'crawl'] as const;

  typedBuckets.forEach((bucket) => {
    const current = (serializableOutput as any)[bucket];
    if (!current || typeof current !== 'object') return;

    Object.entries(current).forEach(([name, payload]) => {
      pushRows(rows, `${bucket}:${name}`, payload);
    });
  });

  const search = (serializableOutput as any).search;
  if (search && typeof search === 'object') {
    Object.entries(search).forEach(([name, payload]) => {
      pushRows(rows, `search:${name}`, payload);
    });
  }

  let cleanedRows = rows;

  if (config?.dataCleanup?.removeEmptyRows) {
    cleanedRows = cleanedRows.filter((row) => isMeaningfulRow(row.data));
  }

  if (config?.dataCleanup?.removeDuplicates) {
    const seen = new Set<string>();
    cleanedRows = cleanedRows.filter((row) => {
      const fingerprint = JSON.stringify(sortObject(row.data));
      if (seen.has(fingerprint)) return false;
      seen.add(fingerprint);
      return true;
    });
  }

  return cleanedRows;
};

export const countRowsFromOutput = (serializableOutput: SerializableOutput, config?: AutomationRuntimeConfig): number =>
  extractRowsFromOutput(serializableOutput, config).length;

export const buildDashboardStatus = (run?: any): 'pending' | 'completed' | 'failed' | 'queued' | 'running' | 'scheduled' | 'aborted' | 'aborting' | 'idle' => {
  if (!run) return 'idle';
  if (['pending', 'completed', 'success', 'failed', 'queued', 'running', 'scheduled', 'aborted', 'aborting'].includes(run.status)) {
    if (run.status === 'success') return 'completed';
    return run.status;
  }
  return 'idle';
};

export const persistExtractedDataForRun = async (run: IRun | any, robot: IRobot | any): Promise<ExtractedRow[]> => {
  const config = getAutomationConfig(robot);
  const rows = extractRowsFromOutput(run.serializableOutput, config);

  await ExtractedData.deleteMany({ runId: run.runId });

  if (rows.length > 0) {
    const payload = rows.map((row) => ({
      runId: run.runId,
      robotMetaId: run.robotMetaId,
      source: row.source,
      data: row.data,
    }));

    const CHUNK_SIZE = 500;
    for (let index = 0; index < payload.length; index += CHUNK_SIZE) {
      await ExtractedData.insertMany(payload.slice(index, index + CHUNK_SIZE));
    }
  }

  return rows;
};

export const dispatchAutomationWebhook = async (
  run: IRun | any,
  robot: IRobot | any,
  rows: ExtractedRow[]
): Promise<void> => {
  await dispatchAutomationDestinations(run, robot, rows);
};

export const computeRunDurationMs = (startedAt?: string, finishedAt?: string): number | null => {
  if (!startedAt || !finishedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(finishedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
};

export const applyAutomationRuntimeConfig = async (page: Page, robot: any): Promise<void> => {
  const config = getAutomationConfig(robot);

  if (config.userAgent) {
    try {
      await page.setExtraHTTPHeaders({ 'User-Agent': config.userAgent });
      await page.addInitScript((userAgent) => {
        Object.defineProperty(navigator, 'userAgent', {
          get: () => userAgent,
          configurable: true,
        });
      }, config.userAgent);
    } catch (error: any) {
      logger.log('warn', `Failed to apply automation user agent: ${error.message}`);
    }
  }

  if (Array.isArray(config.cookies) && config.cookies.length > 0) {
    try {
      await page.context().addCookies(config.cookies as any);
    } catch (error: any) {
      logger.log('warn', `Failed to apply automation cookies: ${error.message}`);
    }
  }

  if (config.localStorage && typeof config.localStorage === 'object' && Object.keys(config.localStorage).length > 0) {
    try {
      await page.addInitScript((entries) => {
        Object.entries(entries).forEach(([key, value]) => {
          window.localStorage.setItem(key, String(value));
        });
      }, config.localStorage);
    } catch (error: any) {
      logger.log('warn', `Failed to apply automation localStorage: ${error.message}`);
    }
  }

  if (config.pagination?.autoScroll || config.pagination?.mode === 'auto-scroll') {
    try {
      await page.addInitScript(() => {
        window.addEventListener('load', () => {
          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }, 750);
        });
      });
    } catch (error: any) {
      logger.log('warn', `Failed to apply automation auto-scroll: ${error.message}`);
    }
  }
};

export const enrichRunForSaas = async (run: any, robot?: any) => {
  const config = robot ? getAutomationConfig(robot) : undefined;
  const extractedRowsCount = await ExtractedData.countDocuments({ runId: run.runId });
  return {
    ...run,
    status: buildDashboardStatus(run),
    durationMs: computeRunDurationMs(run.startedAt, run.finishedAt),
    rowsExtracted: extractedRowsCount || countRowsFromOutput(run.serializableOutput, config),
    screenshots: run.binaryOutput ? Object.entries(run.binaryOutput).map(([key, value]) => ({ key, value })) : [],
  };
};
