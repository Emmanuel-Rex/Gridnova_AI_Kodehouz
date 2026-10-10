# GridSense AI + KodeHauz MSFLib FastAPI template

This is the **actual uploaded KodeHauz MSFLib FastAPI template**, extended with GridSense AI endpoints, dashboard and the original two-load ESP32 firmware. MSFLib core/eventbus, authentication, accounts and workspaces remain imported by the template. The GridSense device/admin API uses separate demo API keys, not MSFLib account JWTs.

## Local setup (template requirements)

1. Install Python 3.10–3.14, Git and Poetry. MSFLib dependencies are fetched from GitHub, requiring network and valid access.
2. `cp .env-example .env` (Windows PowerShell: `Copy-Item .env-example .env`); fill the template's `SECRET_KEY`, database connection, first superuser and other required values. Use the template's `docs/getting-started.md` for its SQLite development setup.
3. Set `DEVICE_KEY` and `ADMIN_KEY` as different, strong environment variables. Use the same DEVICE_KEY in the ESP32 sketch.
4. `poetry install`; create `uploads` directory if `STORAGE_METHOD=file`; initialize database per original README (`python -m app.initial_data`).
5. `poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000`
6. Open `/` for dashboard, `/gridsense-health` for basic health, `/docs` for API docs.

## Render deployment

This is **not** a drop-in replacement for the prior small `server/main.py`. It retains the original template's database, settings and full MSFLib dependency requirements. Configure PostgreSQL and template-required settings first. Use a build environment with Poetry + Git and sufficient memory. Set `DEVICE_KEY`, `ADMIN_KEY`, `SECRET_KEY`, database and superuser environment variables; do not commit secrets. Build `poetry install --only main --no-interaction` (Poetry must be installed first); start `poetry run uvicorn app.main:app --host 0.0.0.0 --port $PORT`; health check `/gridsense-health`. If deploying on a free tier, dependency size or database availability may prevent successful deployment. Do not remove template imports and still claim full integration.

## ESP32 compatibility

The firmware in `firmware/` sends POST `/api/v1/gridsense/telemetry` and polls GET `/api/v1/gridsense/device-command`, with `X-Device-Key`. Dashboard calls GET `/api/v1/gridsense/status` and POST `/api/v1/gridsense/command` with `X-Admin-Key`. All paths are mounted under the original template's `settings.API_V1_STR` (default expected `/api/v1`; verify `.env`). Set firmware API_BASE_URL to your deployed service root. Firmware simulated demand is not a real AC power measurement. Only operate mains hardware with a qualified electrician and protected, enclosed wiring.

## Important limitations

- This source was syntax-checked locally but **MSFLib dependencies, Render deployment and physical ESP32 have not been executed or verified here**.
- Command queue and telemetry are **in-memory** and will reset on server restart; use one worker/instance only for demo. Production requires persistent shared storage.
- Temperature trip is demonstration logic, not certified thermal protection.
- Rotate the previously shared DEVICE_KEY and Wi-Fi password before publishing.
