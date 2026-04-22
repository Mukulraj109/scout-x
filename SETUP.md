# Local installation

1. Create a root folder for your project (e.g. `maxun`).
2. Create a file named `.env` in the root folder of the project.
3. Example env file: [`ENVEXAMPLE`](https://github.com/getmaxun/maxun/blob/master/ENVEXAMPLE). Copy its contents into `.env` and set **`MONGODB_URI`** (local MongoDB or **MongoDB Atlas**), secrets, and URLs.

## Prerequisites

- **Node.js** (LTS recommended)
- **MongoDB** — required for app data, sessions, and the Agenda job queue. Use [MongoDB Atlas](https://www.mongodb.com/atlas) or a self-hosted instance (see `ENVEXAMPLE` for `MONGODB_URI`).
- Optional: **Firebase Storage** (see `ENVEXAMPLE`) for run screenshots in the cloud
- Optional: **remote Playwright browser** or **Camoufox** — [docs/native-browser-setup.md](docs/native-browser-setup.md)

## Install and run

```bash
git clone https://github.com/getmaxun/maxun
cd maxun

npm install
cd maxun-core && npm install && cd ..

npx playwright@1.58.0 install chromium

npm run start
```

For development with hot reload, use `npm run start:dev` instead of `npm run start`.

You can access the frontend at http://localhost:5173/ and the API at http://localhost:8080/ (HTTP routes under `/api`).


# Environment Variables
1. Create a file named `.env` in the root folder of the project
2. Example env file can be viewed [here](https://github.com/getmaxun/maxun/blob/master/ENVEXAMPLE).

| Variable              | Mandatory | Description                                                                                  | If Not Set                                                   |
|-----------------------|-----------|----------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| `BACKEND_PORT`            | Yes       | Port to run backend on.                                                                  | Default value: 8080 |
| `FRONTEND_PORT`            | Yes       | Port to run frontend on.                                                                 | Default value: 5173 |
| `BACKEND_URL`            | Yes       | URL to run backend on.                                                                    | Default value: http://localhost:8080 |
| `VITE_BACKEND_URL`            | Yes       | URL used by frontend to connect to backend                                           | Default value: http://localhost:8080 |
| `PUBLIC_URL`            | Yes       | URL to run frontend on.                                                                    | Default value: http://localhost:5173 |
| `VITE_PUBLIC_URL`            | Yes       | URL used by backend to connect to frontend                                           | Default value: http://localhost:5173 |
| `JWT_SECRET`          | Yes       | Secret key used to sign and verify JSON Web Tokens (JWTs) for authentication.                | JWT authentication will not work.                            |
| `MONGODB_URI`         | Yes       | MongoDB connection string (e.g. Atlas `mongodb+srv://…`).                                     | App data, sessions, and queues will not work.                |
| `ENCRYPTION_KEY`      | Yes       | Key used for encrypting sensitive data (proxies, passwords).                                 | Encryption functionality will not work.                      |
| `SESSION_SECRET`      | No       | A strong, random string used to sign session cookies                                          | Uses default secret. Recommended to define your own session secret to avoid session hijacking.  |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Absolute path to a Firebase service account JSON (enables Firebase Storage for run screenshots). | Screenshots are not uploaded to cloud storage; core app still runs. |
| `FIREBASE_STORAGE_BUCKET` | No | GCS bucket name, usually `project-id.appspot.com`. | Defaults from service account `project_id`. |
| `FIREBASE_PROJECT_ID` | No | Firebase / GCP project ID if not inferrable from the JSON file. | May be required to resolve the default bucket. |
| `ENABLE_FIREBASE_STORAGE` | No | Set to `false` to disable uploads even when credentials exist. | — |
| `GOOGLE_CLIENT_ID`    | No       | Client ID for Google OAuth. Used for Google Sheet integration authentication.                 | Google login will not work.                                  |
| `GOOGLE_CLIENT_SECRET`| No       | Client Secret for Google OAuth. Used for Google Sheet integration authentication.            | Google login will not work.   |
| `GOOGLE_REDIRECT_URI` | No       | Redirect URI for handling Google OAuth responses.                                            | Google login will not work.                                  |
| `AIRTABLE_CLIENT_ID` | No       | Client ID for Airtable, used for Airtable integration authentication.                         | Airtable login will not work.  |
| `AIRTABLE_REDIRECT_URI` | No    | Redirect URI for handling Airtable OAuth responses.                                           | Airtable login will not work.  |
| `MAXUN_TELEMETRY`     | No        | Disables telemetry to stop sending anonymous usage data. Keeping it enabled helps us understand how the product is used and assess the impact of any new changes. Please keep it enabled. | Telemetry data will not be collected. |
