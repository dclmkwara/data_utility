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

## Data handling

- Church_server authenticates the field user and enforces role and hierarchy scope for roster, event, assignment, and sync calls.
- Browser storage contains the minimal profile needed for offline continuity and locally queued work. Backend access and refresh tokens remain encrypted in the server's `HttpOnly` session cookie.
- Choose a Church_server event during setup. Every outgoing utility record must carry the event UUID, location ID, and stable client ID.
- Crusade alpha-location counts also carry the submitter's approved count assignment when Church_server requires one. That assignment is not treated as an usher aisle/row model.
- Sync sends at most 500 records per request and removes a queued record only after its exact item result is `synced` or `duplicate`.
- Pending work is partitioned by signed-in account. Older records without an owner remain recoverable through the explicit claim action in Sync Queues.

See [UTILITY_APP_IMPLEMENTATION_PLAN.md](UTILITY_APP_IMPLEMENTATION_PLAN.md) for remediation phases, decisions still to settle, and acceptance criteria.
