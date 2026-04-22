import axios from 'axios';
import { apiUrl } from '../apiConfig';

export interface AutomationSummary {
  id: string;
  name: string;
  targetUrl: string;
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
}

export const getDashboardAutomations = async (): Promise<AutomationSummary[]> => {
  const response = await axios.get(`${apiUrl}/api/dashboard/automations`, { withCredentials: true });
  return response.data.automations || [];
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

