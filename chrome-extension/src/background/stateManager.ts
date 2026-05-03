/**
 * State Manager - Manages extension state via chrome.storage.local.
 * Single writer pattern: only background writes to storage.
 */

import { buildEmptyState, defaultCloudScheduleDraft, type ExtensionState } from '../shared/types';

const STORAGE_KEY = 'maxunExtensionState';

/**
 * Get current state from storage.
 */
export async function getState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY] as ExtensionState | undefined;
  if (!raw) return buildEmptyState();
  const defaults = buildEmptyState();
  const listMerged = { ...defaults.list, ...raw.list };
  if (!raw.list?.cloudScheduleDraft) {
    listMerged.cloudScheduleDraft = defaultCloudScheduleDraft();
  }
  return {
    ...defaults,
    ...raw,
    backendUrl: raw.backendUrl?.trim() || defaults.backendUrl,
    apiKey: raw.apiKey ?? defaults.apiKey,
    list: listMerged,
    table: { ...defaults.table, ...raw.table },
    text: { ...defaults.text, ...raw.text },
  };
}

/**
 * Update state with a partial patch.
 */
export async function updateState(patch: Partial<ExtensionState>): Promise<ExtensionState> {
  const current = await getState();
  const next: ExtensionState = {
    ...current,
    ...patch,
    list: patch.list ? { ...current.list, ...patch.list } : current.list,
    table: patch.table ? { ...current.table, ...patch.table } : current.table,
    text: patch.text ? { ...current.text, ...patch.text } : current.text,
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

/**
 * Reset state to empty.
 */
export async function resetState(): Promise<ExtensionState> {
  const empty = buildEmptyState();
  await chrome.storage.local.set({ [STORAGE_KEY]: empty });
  return empty;
}

/**
 * Update only the list extraction state.
 */
export async function updateListState(
  patch: Partial<ExtensionState['list']>
): Promise<ExtensionState> {
  const current = await getState();
  return updateState({
    list: { ...current.list, ...patch },
  });
}

/**
 * Update only the table extraction state.
 */
export async function updateTableState(
  patch: Partial<ExtensionState['table']>
): Promise<ExtensionState> {
  const current = await getState();
  return updateState({
    table: { ...current.table, ...patch },
  });
}

/**
 * Update only the text extraction state.
 */
export async function updateTextState(
  patch: Partial<ExtensionState['text']>
): Promise<ExtensionState> {
  const current = await getState();
  return updateState({
    text: { ...current.text, ...patch },
  });
}

/**
 * Store extracted data (for data table page).
 */
export async function storeExtractedData(data: {
  rows: Record<string, string>[];
  headers: string[];
  source: string;
  url: string;
  timestamp: string;
}): Promise<void> {
  await chrome.storage.local.set({ maxunExtractedData: data });
}

/**
 * Get stored extracted data.
 */
export async function getExtractedData(): Promise<any> {
  const result = await chrome.storage.local.get('maxunExtractedData');
  return result.maxunExtractedData || null;
}
