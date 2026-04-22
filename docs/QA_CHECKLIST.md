# Manual QA checklist

Use this before a release or after infra changes.

## Local app

1. `npm run build:server` and `npm run build` succeed; `npm test` and `npm run lint` pass. After a production build, `npx playwright install chromium` (once per machine) then `npm run test:e2e` exercises the SPA via `vite preview`.
2. `npm run start:dev` (or server + client): log in, open **Robots**, start a recording session, confirm browser connects.
3. **API key**: `/apikey` — generate key, copy; call `GET /api/robots` with `x-api-key` (e.g. curl) — `200` and list shape OK.

## Chrome extension

1. Build `chrome-extension` (`npm run build` inside folder), load unpacked from `dist/`.
2. Open dashboard on **same origin** as configured in the extension allowlist (e.g. `http://localhost:5173`).
3. **Connection**: set API base to `http://localhost:8080/api` (or your backend) + API key from the app.
4. Optional: click **Apply API base to extension** on the Automation dashboard — extension storage should update (check ⚙ Connection).
5. On a normal HTTPS page, use **List** extractor → **Send to Maxun** — automation appears in dashboard (or API returns success).

## Rate limiting

- Under load, `/api` returns `429` when exceeding `API_RATE_LIMIT_MAX` (default 600 / 15 min per IP) — adjust env for staging tests.
