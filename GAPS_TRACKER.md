# Maxun gaps — implementation tracker

Use this file to track progress on fixes identified in the architecture review. Update checkboxes as work lands.

## Phase 1 — Extension ↔ backend (critical)

- [x] Fix `startUrl` for “Send to Maxun” (use active scraped tab URL, not side panel)
- [x] Default `backendUrl` aligned with backend port (`8080`) + settings UI to edit API base URL
- [x] Optional `x-api-key` in extension + server accepts API key **or** session cookie on `/api` automations routes
- [x] CORS: allow `x-api-key` header for browser clients that need it
- [x] Manual QA: follow [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md) (local app, extension, API base handoff)

## Phase 2 — Security & dependencies

- [x] Remove unused `fortawesome` security-placeholder package
- [x] Remove unused `csurf` / `@types/csurf` (CSRF not implemented; API uses JWT cookie + `x-api-key`; add CSRF later if you add cookie-auth to untrusted cross-site forms)
- [x] Refuse weak/missing `SESSION_SECRET` in production
- [x] JWT + OAuth status cookies: `Secure` + `SameSite=Lax` in production (`server/src/routes/auth.ts`). *If API and SPA are on different registrable domains, you may need `SameSite=None` + `Secure` for the `token` cookie—evaluate for your deployment.*

## Phase 3 — Cloud / web app handoff (UX)

- [x] Dashboard “Chrome extension” section: copy **`extensionApiBaseUrl`** (`VITE_BACKEND_URL` + `/api`) + links to docs, API key page, and extension source (`ChromeExtensionHandoff` on `DashboardPage`)
- [x] Deep link: `/dashboard?extension=1` scrolls to the Chrome extension card (lightweight handoff; no secrets in URL)
- [x] Optional: one-click API base — dashboard **Push to extension** posts `MAXUN_APPLY_BACKEND_URL` to the page; content script forwards to the background (allowlisted origins in `chrome-extension/src/shared/webBridge.ts`)

## Phase 4 — Code quality

- [x] Split `server/src/api/record.ts` — **`formatRecording` / `formatRunResponse` → `server/src/api/record/formatters.ts`** (further splits possible later)
- [x] `Generator.getLastUsedSelectorInfo` — tag-aware values (inputs, textarea, select, img, anchor; fallback `innerText`)
- [x] `UrlForm` / `BrowserContent` — removed dead `handleRefresh` prop; tab labels sync with global `recordingUrl`

## Phase 5 — Testing & CI

- [x] Smoke tests: `server/src/middlewares/auth.middleware.test.ts` (`requireSignInOrApiKey` + API key) via **Vitest** (`npm test`)
- [x] **ESLint** — `eslint.config.mjs`, `npm run lint` (app, server, extension, `e2e`, config entrypoints)
- [x] **E2E smoke** — Playwright (`playwright.config.ts`, `e2e/smoke.spec.ts`), `npm run test:e2e` (needs `npm run build` first; CI runs after Vite build)
- [x] CI: `.github/workflows/ci.yml` — `npm ci`, `build:server`, `npm test`, `npm run build`, **`npm run lint`**, **`npx playwright install --with-deps chromium`**, **`npm run test:e2e`**, `chrome-extension` `npm ci` + `npm run build`
- [x] `chrome-extension` strict `tsc` — fixed `src/content/index.ts` (`debug` arity, LCA climb loop typing)

## Phase 6 — Documentation

- [x] QA checklist: [`docs/QA_CHECKLIST.md`](./docs/QA_CHECKLIST.md)
- [x] Extension README: [`chrome-extension/README.md`](./chrome-extension/README.md) (build, load unpacked, URL + API key, one-click API base)
- [x] Root README: CLI bullet clarified (docs / not an npm script here); **Chrome extension** link; **local ports** (`5173`, `8080`, `/api`, `VITE_BACKEND_URL`)
- [x] Port / URL guidance consolidated in README **Installation** subsection

---

_Last updated: ESLint + Playwright smoke added to CI and scripts._
