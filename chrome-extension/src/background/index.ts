/**
 * Background Service Worker Entry Point
 * Initializes the extension's background services.
 */

import { initMessageRouter } from './messageRouter';
import { resetState, getState } from './stateManager';
import { ensureLiveStatusConnection, disconnectLiveStatus } from './liveStatusSocket';

// Configure side panel to open on action click (instead of popup)
try {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((err) => {
    console.warn('Failed to set side panel behavior:', err);
  });
} catch (err) {
  console.warn('Side panel API not available:', err);
}

// Initialize message routing immediately (synchronous)
initMessageRouter();

console.log('Scout-X Scrapper background service worker started');

// Initialize state on install - use getState to avoid resetting on reload
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    if (details.reason === 'install') {
      await resetState();
      console.log('Scout-X Scrapper extension installed - fresh state');
    } else {
      // On update/reload, just ensure state exists
      await getState();
      console.log('Scout-X Scrapper extension updated');
    }
  } catch (err) {
    console.error('Failed to initialize state:', err);
  }
});

// Ensure state exists on startup (in case storage was cleared)
(async () => {
  try {
    await getState();
    await ensureLiveStatusConnection();
  } catch (err) {
    console.error('Failed to get state on startup:', err);
  }
})();

// Keep the live-status socket in sync with backend URL / API key edits.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.maxunExtensionState) return;
  const newValue = changes.maxunExtensionState.newValue;
  const oldValue = changes.maxunExtensionState.oldValue;
  if (!newValue) {
    disconnectLiveStatus();
    return;
  }
  const backendChanged = oldValue?.backendUrl !== newValue.backendUrl;
  const keyChanged = oldValue?.apiKey !== newValue.apiKey;
  if (backendChanged || keyChanged || !oldValue) {
    ensureLiveStatusConnection().catch((err) =>
      console.warn('Live status reconnect failed:', err)
    );
  }
});
