import axios from 'axios';
import { apiUrl } from '../apiConfig';

export interface AutomationSummary {
  id: string;
  name: string;
  targetUrl: string;
  /** Robot meta updated-at string from the server (used for stale snapshots). */
  updatedAt?: string;
  lastRunTime: string | null;
  rowsExtracted: number;
  status: string;
  latestRunId?: string | null;
  webhookUrl?: string;
  config?: Record<string, any>;
  schedule?: {
    enabled?: boolean;
    cron?: string;
    every?: number;
    timezone?: string;
    updatedAt?: string;
    /** Server-set: cron stored but triggers off (paused). */
    paused?: boolean;
  } | null;
}

export interface ColumnOverride {
  /** Display + storage name to use in place of the original column. */
  rename?: string;
  /** When true the column is kept but its value is written as an empty string on each new run. */
  clear?: boolean;
  /** When true the field is dropped from storage, exports, and destinations (not combinable with clear). */
  omit?: boolean;
}

export type ColumnOverridesMap = Record<string, ColumnOverride>;

/** Stored per automation; merged into every extracted row as `sectorIndustry` and `f500`. */
export interface RowContextFields {
  sectorIndustry?: string;
  f500?: '' | 'yes' | 'no';
}

export const AUTOMATION_ROW_CONTEXT_KEYS = ['sectorIndustry', 'f500'] as const;

export interface AutomationDataResponse {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  columns: string[];
  rows: Array<{
    id: string;
    runId: string;
    source: string;
    createdAt: string;
    data: Record<string, any>;
  }>;
  /** Server returns the active overrides so the UI can decorate headers. */
  overrides?: ColumnOverridesMap;
  /** Sector/industry + F500 labels applied to every row (empty strings when unset). */
  rowContext?: RowContextFields;
  /** Names from automation config used as dropdown options when mapping scraped columns. */
  databaseTargetColumns?: string[];
}

export interface AutomationColumnsResponse {
  columns: string[];
  overrides: ColumnOverridesMap;
}

export interface DashboardAutomationsSummary {
  totalAutomations: number;
  activeScheduledCount: number;
  pausedScheduleCount: number;
}

export interface DashboardAutomationsResponse {
  automations: AutomationSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: DashboardAutomationsSummary;
}

export const getDashboardAutomations = async (params?: {
  page?: number;
  limit?: number;
}): Promise<DashboardAutomationsResponse> => {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const response = await axios.get(`${apiUrl}/api/dashboard/automations`, {
    params: { page, limit },
    withCredentials: true,
  });
  const data = response.data || {};
  return {
    automations: data.automations || [],
    pagination: data.pagination || { page: 1, limit, total: 0, totalPages: 1 },
    summary: data.summary || {
      totalAutomations: 0,
      activeScheduledCount: 0,
      pausedScheduleCount: 0,
    },
  };
};

export interface SaasRunsListResponse {
  runs: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/** Paginated SaaS runs list (`GET /api/runs`). Optional `robotMetaId` scopes to one automation you own. */
export const listSaasRuns = async (params?: {
  page?: number;
  limit?: number;
  robotMetaId?: string;
}): Promise<SaasRunsListResponse> => {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 10;
  const response = await axios.get(`${apiUrl}/api/runs`, {
    params: { page, limit, ...(params?.robotMetaId ? { robotMetaId: params.robotMetaId } : {}) },
    withCredentials: true,
  });
  const data = response.data || {};
  return {
    runs: data.runs || [],
    pagination: data.pagination || { page: 1, limit, total: 0, totalPages: 1 },
  };
};

export const createAutomation = async (payload: {
  name: string;
  startUrl: string;
  webhookUrl?: string;
  config?: Record<string, any>;
}) => {
  const response = await axios.post(`${apiUrl}/api/automations`, payload, { withCredentials: true });
  return response.data.automation;
};

export const getAutomation = async (id: string) => {
  const response = await axios.get(`${apiUrl}/api/automations/${id}`, { withCredentials: true });
  return response.data;
};

export const updateAutomationConfig = async (
  id: string,
  payload: {
    name?: string;
    startUrl?: string;
    webhookUrl?: string;
    config?: Record<string, any>;
  }
) => {
  const response = await axios.put(`${apiUrl}/api/automations/${id}/config`, payload, { withCredentials: true });
  return response.data;
};

export const runAutomation = async (id: string) => {
  const response = await axios.post(`${apiUrl}/api/automations/${id}/run`, {}, { withCredentials: true });
  return response.data;
};

export const getAutomationData = async (id: string, page: number, limit: number): Promise<AutomationDataResponse> => {
  const response = await axios.get(`${apiUrl}/api/automations/${id}/data?page=${page}&limit=${limit}`, {
    withCredentials: true,
  });
  return response.data;
};

export const getSaasRun = async (id: string) => {
  const response = await axios.get(`${apiUrl}/api/runs/${id}`, { withCredentials: true });
  return response.data;
};

export const updateAutomationSchedule = async (
  id: string,
  schedule: { enabled: boolean; cron: string | null; timezone: string }
): Promise<{ success: boolean; schedule: any }> => {
  const response = await axios.put(
    `${apiUrl}/api/automations/${id}/schedule`,
    { enabled: schedule.enabled, cron: schedule.cron, timezone: schedule.timezone },
    { withCredentials: true }
  );
  return response.data;
};

/** Pauses all recurring schedules (cron kept in DB; Agenda triggers cancelled). */
export const stopAllAutomationSchedules = async (): Promise<{ success: boolean; stoppedCount: number }> => {
  const response = await axios.post(`${apiUrl}/api/automations/schedules/stop-all`, {}, { withCredentials: true });
  return response.data;
};

/** Resumes every paused schedule for your account (same cron/timezone as before pause). */
export const resumeAllAutomationSchedules = async (): Promise<{ success: boolean; resumedCount: number }> => {
  const response = await axios.post(`${apiUrl}/api/automations/schedules/resume-all`, {}, { withCredentials: true });
  return response.data;
};

export const deleteAutomation = async (id: string): Promise<void> => {
  await axios.delete(`${apiUrl}/api/automations/${id}`, { withCredentials: true });
};

/**
 * List the union of every column persisted in `extracted_data` for this
 * automation, plus any overrides currently saved on the robot. Used by the
 * "Edit columns" dialog so the user sees columns beyond the visible page.
 */
export const getAutomationColumns = async (id: string): Promise<AutomationColumnsResponse> => {
  const response = await axios.get(`${apiUrl}/api/automations/${id}/columns`, { withCredentials: true });
  const data = response.data || {};
  return {
    columns: data.columns || [],
    overrides: data.overrides || {},
  };
};

/** Persist column overrides and optional row context (sector/industry, F500) for an automation. */
export const updateAutomationColumns = async (
  id: string,
  payload: { overrides: ColumnOverridesMap; rowContext: RowContextFields }
): Promise<{ overrides: ColumnOverridesMap; rowContext: RowContextFields }> => {
  const response = await axios.put(`${apiUrl}/api/automations/${id}/columns`, payload, {
    withCredentials: true,
  });
  const data = response.data || {};
  return {
    overrides: data.overrides || {},
    rowContext: data.rowContext || { sectorIndustry: '', f500: '' },
  };
};

