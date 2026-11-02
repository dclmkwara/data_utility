# DCLM Field Utility

Offline-first field capture for approved Church_server accounts. The utility captures population count contributions, worker attendance, newcomers/converts, and offering/tithe entries, then submits them through the Church_server batch API.

## Local setup

1. Use Python 3.11 or newer.
2. Copy `.env.example` to `.env` and set the backend URLs for your environment.
3. Install dependencies with `python -m pip install -r requirements.txt`.
4. Start the app with `python run_server.py`.
5. Open `http://127.0.0.1:5098/login` and sign in with an approved Church_server field account.

The app creates a local `.sesskey` for development sessions. It is ignored by Git. Production deployments must set `APP_ENV=production` and provide a stable, randomly generated `UTILITY_SESSION_KEY`; production cookies are then marked `Secure`.

The app loads `.env` from the project directory at startup. Variables already set by the hosting environment take precedence.

## FastAPI Cloud deployment preparation

The UI and its routes remain a FastHTML application. FastAPI Cloud expects a FastAPI entrypoint, so `app.main:app` is a small FastAPI ASGI wrapper that mounts the existing FastHTML app. It does not change the field workflows or introduce a second set of routes. The wrapper exposes `/health` and disables the unused OpenAPI documentation endpoints.

The root `pyproject.toml` declares the FastAPI Cloud entrypoint, Python 3.11+, and deployment dependencies. `requirements.txt` is kept aligned for local pip installs. The FastAPI Cloud CLI honors `.gitignore`; `.fastapicloudignore` additionally excludes tests, local environment files, session keys, and implementation notes.

Before the first deployment:

1. Install the declared dependencies, then verify the app starts with `fastapi dev` from the project root.
2. Log in to FastAPI Cloud and run `fastapi deploy` from this directory. On first deploy, the CLI will ask you to select or create the cloud app.
3. Set `APP_ENV=production` and `BACKEND_API_URL` in that app's environment settings. Set `UTILITY_SESSION_KEY` as a **secret** using the FastAPI Cloud dashboard or CLI; generate it locally with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Do not commit the generated value or put it in a non-secret environment setting.
4. Keep the session key stable across deployments and replicas. Production startup fails if `APP_ENV=production` is set without a usable session key, and production session cookies are marked `Secure`.
5. After deployment, check `/health`, sign in using an approved test field account, verify its assigned location and event list, and exercise a synthetic capture/sync before using real records.

This repository change prepares the app and documents deployment; it does not create a FastAPI Cloud app, configure cloud secrets, or deploy it.

## Data handling

- Church_server authenticates the field user and enforces role and hierarchy scope for roster, event, assignment, and sync calls.
- Browser storage contains the minimal profile needed for offline continuity and locally queued work. Backend access and refresh tokens remain encrypted in the server's `HttpOnly` session cookie.
- Choose a Church_server event during setup. Every outgoing utility record must carry the event UUID, location ID, and stable client ID.
- Crusade alpha-location counts also carry the submitter's approved count assignment when Church_server requires one. That assignment is not treated as an usher aisle/row model.
- Sync sends at most 500 records per request and removes a queued record only after its exact item result is `synced` or `duplicate`.
- Pending work is partitioned by signed-in account. Older records without an owner remain recoverable through the explicit claim action in Sync Queues.

See [UTILITY_APP_IMPLEMENTATION_PLAN.md](UTILITY_APP_IMPLEMENTATION_PLAN.md) for remediation phases, decisions still to settle, and acceptance criteria.
