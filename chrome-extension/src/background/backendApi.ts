/**
 * Backend API - Communicates with the Maxun backend server.
 */

import { getState } from './stateManager';

function buildAuthHeaders(state: { apiKey?: string }): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (state.apiKey && state.apiKey.trim()) {
    headers['x-api-key'] = state.apiKey.trim();
  }
  return headers;
}

/**
 * Push extraction config to the Maxun backend.
 */
export async function saveConfigToBackend(payload: {
  automationId?: string;
  automationName?: string;
  startUrl?: string;
  webhookUrl?: string;
  listSelector: string;
  fields: Record<string, { selector: string; attribute: string }>;
  pagination?: {
    type: string;
    selector?: string | null;
    maxPages?: number;
    pageDelayMs?: number;
    pageParam?: string;
    startPage?: number;
    maxScrollSteps?: number;
    scrollSpinnerBudgetMs?: number;
    loadMoreWaitMs?: number;
  };
  /** Per-robot cap on total rows to collect. Mirrors the extension's user-supplied input. */
  maxItems?: number;
  /** Overlay / dialog handling knobs. */
  popups?: {
    autoDismiss?: boolean;
    acceptDialogs?: boolean;
  };
  /** CAPTCHA gate config. */
  captcha?: {
    pauseOnDetect?: boolean;
  };
  previewRows?: Record<string, string>[];
}): Promise<any> {
  const state = await getState();
  const apiBase = state.backendUrl.replace(/\/+$/, '');

  const paginationType = payload.pagination?.type;
  const autoScroll =
    paginationType === 'scrollDown' ||
    paginationType === 'scrollUp' ||
    paginationType === 'clickLoadMore';

  const listExtraction = {
    itemSelector: payload.listSelector,
    fields: buildFieldMap(payload.fields),
    uniqueKey: getSuggestedUniqueKey(payload.fields),
    maxItems:
      typeof payload.maxItems === 'number' && payload.maxItems > 0
        ? payload.maxItems
        : undefined,
    autoScroll,
    pagination: mapPagination(payload.pagination),
    popups: payload.popups || { autoDismiss: true, acceptDialogs: true },
    captcha: payload.captcha || { pauseOnDetect: true },
  };

  const defaultName = `Scout-X scrape (${new Date().toISOString().slice(0, 16).replace('T', ' ')})`;
  const body = {
    name: (payload.automationName && String(payload.automationName).trim()) || defaultName,
    startUrl: payload.startUrl || '',
    webhookUrl: payload.webhookUrl || '',
    config: {
      listExtraction,
      previewRows: payload.previewRows || [],
    },
  };

  // If automationId provided, update existing
  if (payload.automationId) {
    const response = await fetch(`${apiBase}/automations/${payload.automationId}/config`, {
      method: 'PUT',
      credentials: 'include',
      headers: buildAuthHeaders(state),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(parseBackendErrorBody(text) || `Backend request failed: ${response.status}`);
    }
    return response.json();
  }

  // Create new automation
  const response = await fetch(`${apiBase}/automations`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(state),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(parseBackendErrorBody(text) || `Backend request failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Trigger a run on the backend.
 */
export async function triggerBackendRun(automationId: string): Promise<any> {
  const state = await getState();
  const apiBase = state.backendUrl.replace(/\/+$/, '');

  const response = await fetch(`${apiBase}/automations/${automationId}/run`, {
    method: 'POST',
    credentials: 'include',
    headers: buildAuthHeaders(state),
  });

  if (!response.ok) {
    throw new Error(`Failed to trigger run: ${response.status}`);
  }
  return response.json();
}

/**
 * Save (or clear) a recurring schedule for an automation on the backend.
 * Calls PUT /automations/:id/schedule.
 */
export async function saveScheduleToBackend(
  automationId: string,
  schedule: { enabled: boolean; cron: string | null; timezone: string }
): Promise<any> {
  const state = await getState();
  const apiBase = state.backendUrl.replace(/\/+$/, '');

  const response = await fetch(`${apiBase}/automations/${automationId}/schedule`, {
    method: 'PUT',
    credentials: 'include',
    headers: buildAuthHeaders(state),
    body: JSON.stringify(schedule),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Failed to save schedule: ${response.status}`);
  }
  return response.json();
}


/**
 * Fetch an automation's full server-side record (including schedule.nextRunAt,
 * status, and latest run info).
 */
export async function getAutomationStatus(automationId: string): Promise<any> {
  const state = await getState();
  const apiBase = state.backendUrl.replace(/\/+$/, '');

  const response = await fetch(`${apiBase}/automations/${automationId}`, {
    credentials: 'include',
    headers: buildAuthHeaders(state),
  });

  if (!response.ok) {
    throw new Error(`Failed to get automation: ${response.status}`);
  }
  return response.json();
}

/**
 * Get run status from backend.
 */
export async function getRunStatus(runId: string): Promise<any> {
  const state = await getState();
  const apiBase = state.backendUrl.replace(/\/+$/, '');

  const response = await fetch(`${apiBase}/runs/${runId}`, {
    credentials: 'include',
    headers: buildAuthHeaders(state),
  });

  if (!response.ok) {
    throw new Error(`Failed to get run: ${response.status}`);
  }
  return response.json();
}

// ── Helpers ──

function parseBackendErrorBody(text: string): string {
  try {
    const j = JSON.parse(text);
    if (j?.error && typeof j.error === 'string') return j.error;
  } catch {
    /* raw message */
  }
  return text || '';
}

function buildFieldMap(fields: Record<string, { selector: string; attribute: string }>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [name, { selector, attribute }] of Object.entries(fields)) {
    result[name] = attribute && attribute !== 'innerText' ? `${selector}@${attribute}` : selector;
  }
  return result;
}

function getSuggestedUniqueKey(fields: Record<string, { selector: string; attribute: string }>): string {
  if (fields.url) return 'url';
  if (fields.link) return 'link';
  if (fields.image) return 'image';
  if (fields.title) return 'title';
  return '';
}

function mapPagination(pagination?: {
  type: string;
  selector?: string | null;
  maxPages?: number;
  pageDelayMs?: number;
  pageParam?: string;
  startPage?: number;
  maxScrollSteps?: number;
  scrollSpinnerBudgetMs?: number;
  loadMoreWaitMs?: number;
}) {
  if (!pagination || !pagination.type) return { mode: 'none' };

  const selector = typeof pagination.selector === 'string' ? pagination.selector : '';
  const maxPages = pagination.maxPages || 10;
  const pageDelayMs = pagination.pageDelayMs || 1200;

  const scrollKnobs = {
    maxScrollSteps:
      typeof pagination.maxScrollSteps === 'number' && pagination.maxScrollSteps > 0
        ? pagination.maxScrollSteps
        : undefined,
    scrollSpinnerBudgetMs:
      typeof pagination.scrollSpinnerBudgetMs === 'number' && pagination.scrollSpinnerBudgetMs > 0
        ? pagination.scrollSpinnerBudgetMs
        : undefined,
    loadMoreWaitMs:
      typeof pagination.loadMoreWaitMs === 'number' && pagination.loadMoreWaitMs > 0
        ? pagination.loadMoreWaitMs
        : undefined,
  };

  switch (pagination.type) {
    case 'clickNext':
    case 'clickLoadMore':
      return {
        mode: 'next-button',
        nextButtonSelector: selector,
        maxPages,
        pageDelayMs,
        ...scrollKnobs,
      };
    case 'scrollDown':
    case 'scrollUp':
      return {
        mode: 'infinite-scroll',
        maxPages,
        pageDelayMs,
        ...scrollKnobs,
      };
    case 'pageNumber':
      return {
        mode: 'page-number-loop',
        pageParam: pagination.pageParam || 'page',
        startPage: pagination.startPage ?? 1,
        maxPages,
        pageDelayMs,
        ...scrollKnobs,
      };
    default:
      return { mode: 'none' };
  }
}
