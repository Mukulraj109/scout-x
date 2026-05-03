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
  /**
   * Per-automation column overrides applied at insert time and on read.
   * Keyed by the original column name produced by the recording. Each entry
   * may rename the key (`rename`), blank its value (`clear`), or drop the
   * field entirely (`omit`). `clear` and `omit` must not both be true.
   */
  columnOverrides?: Record<string, ColumnOverride>;
  /**
   * Allowed target attribute names for the Edit columns UI (dropdown mapping).
   * Set in Scraper Configuration — not auto-read from an external database.
   */
  databaseTargetColumns?: string[];
  /**
   * Optional labels copied onto every extracted row (healthcare vs banking, Fortune 500, etc.).
   * Persisted with new runs; omitted keys read back as empty strings.
   */
  rowContext?: RowContextFields;
}

/** Stored under `saasConfig.rowContext`; merged into each row after column overrides. */
export interface RowContextFields {
  sectorIndustry?: string;
  /** Empty string when unset; stored as lowercase `yes` / `no`. */
  f500?: '' | 'yes' | 'no';
}

export const ROW_CONTEXT_KEYS = ['sectorIndustry', 'f500'] as const;

/** Normalize config for merging; output suitable for Mongo `rowContext`. */
export const sanitizeRowContextFields = (input: unknown): RowContextFields => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { sectorIndustry: '', f500: '' };
  }
  const raw = input as Record<string, unknown>;
  const sector =
    typeof raw.sectorIndustry === 'string' ? raw.sectorIndustry.trim().slice(0, 500) : '';
  const fRaw = raw.f500;
  let f500: '' | 'yes' | 'no' = '';
  if (fRaw === true || fRaw === 'yes' || fRaw === 'Yes') f500 = 'yes';
  else if (fRaw === false || fRaw === 'no' || fRaw === 'No') f500 = 'no';
  else if (typeof fRaw === 'string') {
    const low = fRaw.trim().toLowerCase();
    if (low === 'yes') f500 = 'yes';
    else if (low === 'no') f500 = 'no';
  }
  return { sectorIndustry: sector, f500 };
};

/**
 * Adds sector / industry and F500 onto row data (after overrides). Always sets both keys;
 * uses empty strings when unset so exports and UI stay consistent.
 */
export const mergeRowContextIntoRowData = (
  data: Record<string, any>,
  rowContext?: RowContextFields | null
): Record<string, any> => {
  const normalized = sanitizeRowContextFields(rowContext ?? {});
  const f500Display =
    normalized.f500 === 'yes' ? 'Yes' : normalized.f500 === 'no' ? 'No' : '';
  return {
    ...data,
    sectorIndustry: normalized.sectorIndustry,
    f500: f500Display,
  };
};

/** Single column override entry stored in `saasConfig.columnOverrides`. */
export interface ColumnOverride {
  /** Display + storage name to use in place of the original column. */
  rename?: string;
  /** When true the column is kept but its value is written as an empty string. */
  clear?: boolean;
  /**
   * When true the field is omitted from stored rows, exports, and destinations.
   * If `rename` is also set (e.g. after a prior rename), both the original key
   * and that name are stripped so legacy rows stay consistent.
   */
  omit?: boolean;
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

/**
 * Keys removed from row `data` when an override marks the column as omitted.
 * Includes the original scrape key and, if present, a previous rename target
 * so legacy persisted rows stay hidden after remove.
 */
export const collectOmitKeys = (overrides: Record<string, ColumnOverride>): Set<string> => {
  const omitKeys = new Set<string>();
  for (const [original, override] of Object.entries(overrides)) {
    if (!override?.omit) continue;
    omitKeys.add(original);
    const r = override.rename?.trim();
    if (r) omitKeys.add(r);
  }
  return omitKeys;
};

/**
 * Single source of truth for the column-override behaviour. Used at insert time
 * (so future runs persist with the renamed/cleared shape) and on read (so old
 * rows render consistently in View Data, Run Details, exports). Returns a new
 * object; never mutates the caller's `data`.
 */
export const applyColumnOverrides = (
  data: Record<string, any> | null | undefined,
  overrides?: Record<string, ColumnOverride>
): Record<string, any> => {
  if (!data || typeof data !== 'object') return {};
  if (!overrides || Object.keys(overrides).length === 0) {
    return { ...data };
  }

  const omitKeys = collectOmitKeys(overrides);

  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (omitKeys.has(key)) {
      continue;
    }
    const override = overrides[key];
    if (!override) {
      out[key] = value;
      continue;
    }
    if (override.omit) {
      continue;
    }
    const targetKey = (override.rename && override.rename.trim()) || key;
    out[targetKey] = override.clear ? '' : value;
  }
  return out;
};

export const persistExtractedDataForRun = async (run: IRun | any, robot: IRobot | any): Promise<ExtractedRow[]> => {
  const config = getAutomationConfig(robot);
  const extracted = extractRowsFromOutput(run.serializableOutput, config);

  // Transform once; both the persisted documents and the rows handed to
  // destinations (webhook / Sheets / Airtable / DB) get the override shape.
  const rows = extracted.map((row) => ({
    source: row.source,
    data: mergeRowContextIntoRowData(
      applyColumnOverrides(row.data, config.columnOverrides),
      config.rowContext
    ),
  }));

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
