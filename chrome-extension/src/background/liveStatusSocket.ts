/**
 * Live Status Socket - Subscribes to the Maxun backend's `/queued-run`
 * namespace over Socket.IO and mirrors run-started / run-completed /
 * captcha:required events into the extension state so the side panel can
 * react without polling.
 *
 * The background service worker maintains a single connection, reconnects on
 * backend URL / API key changes, and tears down cleanly on logout.
 */

import { io, Socket } from 'socket.io-client';
import { getState, updateListState } from './stateManager';

type LiveEvent =
  | { type: 'run-started'; runId: string; robotMetaId?: string; status?: string }
  | { type: 'run-completed'; runId: string; robotMetaId?: string; status?: string; reason?: string }
  | {
      type: 'captcha:required';
      runId: string;
      automationId?: string;
      url?: string;
      kind?: string;
    };

let socket: Socket | null = null;
let currentBackendUrl: string | null = null;
let currentApiKey: string | null = null;

/**
 * Idempotent connect: opens a Socket.IO connection to the `/queued-run`
 * namespace whenever both backendUrl and apiKey are present. No-ops if already
 * connected with the same credentials.
 */
export async function ensureLiveStatusConnection(): Promise<void> {
  const state = await getState();
  const backendUrl = state.backendUrl?.trim() || '';
  const apiKey = state.apiKey?.trim() || '';

  if (!backendUrl || !apiKey) {
    disconnectLiveStatus();
    return;
  }

  if (socket && currentBackendUrl === backendUrl && currentApiKey === apiKey && socket.connected) {
    return;
  }

  disconnectLiveStatus();

  // Strip "/api" if the user configured the REST base so we connect to the
  // actual server origin where Socket.IO listens.
  const origin = deriveSocketOrigin(backendUrl);

  socket = io(`${origin}/queued-run`, {
    transports: ['websocket'],
    auth: { apiKey },
    query: { apiKey },
    reconnection: true,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30_000,
    timeout: 10_000,
  });
  currentBackendUrl = backendUrl;
  currentApiKey = apiKey;

  socket.on('connect', () => {
    // no-op; connection lifecycle logged at backend
  });

  socket.on('connect_error', () => {
    // Swallow: socket.io handles reconnection for us.
  });

  socket.on('run-started', (payload: any) => {
    handleRunEvent({ type: 'run-started', ...coerceRunEvent(payload) });
  });

  socket.on('run-completed', (payload: any) => {
    handleRunEvent({ type: 'run-completed', ...coerceRunEvent(payload) });
  });

  socket.on('captcha:required', (payload: any) => {
    handleCaptchaEvent(payload);
  });
}

export function disconnectLiveStatus(): void {
  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* noop */
    }
    socket = null;
  }
  currentBackendUrl = null;
  currentApiKey = null;
}

function deriveSocketOrigin(backendUrl: string): string {
  try {
    const url = new URL(backendUrl);
    // Accept both "http://host/api" and "http://host". Socket.IO lives at the
    // server root, not under /api.
    return `${url.protocol}//${url.host}`;
  } catch {
    return backendUrl.replace(/\/api\/?$/, '').replace(/\/+$/, '');
  }
}

function coerceRunEvent(payload: any): { runId: string; robotMetaId?: string; status?: string; reason?: string } {
  return {
    runId: String(payload?.runId || payload?.id || ''),
    robotMetaId: payload?.robotMetaId || payload?.automationId || payload?.robotId,
    status: payload?.status,
    reason: payload?.reason,
  };
}

async function handleRunEvent(ev: LiveEvent & { runId: string }): Promise<void> {
  const state = await getState();
  const saved = state.list.savedAutomation;
  if (!saved?.id) return;
  // Only mirror events that belong to the automation this extension session
  // is currently attached to.
  const robotMetaId = (ev as any).robotMetaId;
  if (robotMetaId && robotMetaId !== saved.id) return;

  if (ev.type === 'run-started') {
    await updateListState({
      savedAutomation: {
        ...saved,
        lastRunStatus: (ev as any).status || 'running',
        fetchedAt: new Date().toISOString(),
      },
    });
  } else if (ev.type === 'run-completed') {
    const status = (ev as any).status || 'completed';
    const reason = (ev as any).reason;
    await updateListState({
      savedAutomation: {
        ...saved,
        lastRunStatus: reason === 'captcha' ? 'captcha' : status,
        lastRunTime: new Date().toISOString(),
        fetchedAt: new Date().toISOString(),
      },
    });
  }
}

async function handleCaptchaEvent(payload: any): Promise<void> {
  const state = await getState();
  const saved = state.list.savedAutomation;
  if (!saved?.id) return;
  const automationId = payload?.automationId || payload?.robotMetaId;
  if (automationId && automationId !== saved.id) return;

  await updateListState({
    savedAutomation: {
      ...saved,
      lastRunStatus: 'captcha',
      fetchedAt: new Date().toISOString(),
    },
  });

  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/public/icons/icon128.png'),
      title: 'Scout-X: CAPTCHA encountered',
      message: `Automation "${saved.name || saved.id}" paused — manual intervention may be required.`,
      priority: 2,
    });
  } catch {
    /* notifications permission may be absent; silent fallback */
  }
}
