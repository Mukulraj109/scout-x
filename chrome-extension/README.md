# Maxun Chrome extension

Visual list / table / text extraction in the browser, with optional **Send to Maxun** to create automations on your server.

## Prerequisites

- Node.js 18+
- A running Maxun backend (same API as the web app)

## Build

```bash
cd chrome-extension
npm ci
npm run build
```

Artifacts are written to `chrome-extension/dist/`.

If TypeScript errors appear in `src/content/`, you can still produce a bundle with:

```bash
npm run build:no-check
```

## Load unpacked (development)

1. Open Chrome → **Extensions** → enable **Developer mode**.
2. **Load unpacked** → select the `chrome-extension/dist` folder (after `npm run build`).

## One-click API base (same browser tab)

If the Maxun web app is open on an **allowed origin** (see `src/shared/webBridge.ts`: localhost dev ports, `https://app.maxun.dev`, or extra origins via `VITE_EXTENSION_BRIDGE_ORIGINS` at extension build time), use **Apply API base to extension** on the Automation dashboard. The page sends a `postMessage` to the content script; only the **API base URL** is transferred (never your API key).

## Connection settings (required)

1. Open the extension **side panel** (puzzle icon → Maxun Web Scraper).
2. Click **⚙** (gear).
3. **API base URL** — must be your backend’s `/api` root, e.g. `http://localhost:8080/api` or `https://your-host/api`. The main app **Automation Dashboard** shows the exact value to copy.
4. **API key** (recommended) — create one under the web app **API Key** page and paste it here. This avoids cookie issues between the extension and the server.

Then use **List** mode, run an extraction, and **Send to Maxun** when finished.

## Repository layout

Source lives under `chrome-extension/src/` (background service worker, side panel, content scripts).
