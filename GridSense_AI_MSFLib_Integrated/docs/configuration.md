# Configuration

All settings live in one class, `AppSettings`, in `app/core/config.py`. It subclasses the settings of each package the app wires in (core, auth, account, tenancy and workspaces), so every setting is a flat, top-level environment variable (`SECRET_KEY`, `POSTGRES_SERVER`, `USERS_OPEN_REGISTRATION`). The rest of the app imports the single `settings` instance.

```python
class AppSettings(
    WorkspaceSettings, TenancySettings, AccountSettings, AuthSettings, CoreSettings, SettingsBase
):
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    REDIS_HOST: Optional[str] = None
    ...

settings = AppSettings()
```

Add your own settings as fields on this class. MSFLib also supports composing namespaces (`CORE__SECRET_KEY` style); both layouts and how to choose are covered in [Tiered configuration](https://msflib.github.io/docsite/fastapi/concepts/tiered-config/). Code that needs one package's settings reads them through `settings.scope("CORE")`, as `app/db/session.py` does.

Values come from the environment and from a `.env` file. `.env-example` is the starting point; `.env-test` is the file the test suite and the Docker image use.

## Variables in `.env-example`

| Group | Variables | Notes |
|---|---|---|
| Server | `SERVER_NAME`, `SERVER_HOST`, `PROJECT_NAME`, `BACKEND_CORS_ORIGINS` | `BACKEND_CORS_ORIGINS` is a JSON list. The app adds CORS middleware only when it is non-empty. |
| Secrets | `SECRET_KEY` | Signs access tokens. Replace the example value. |
| First account | `FIRST_SUPERUSER`, `FIRST_SUPERUSER_PASSWORD` | Created by `app.initial_data`. Also used by the tests to sign in. |
| Frontend links | `CLIENT_NAME`, `CLIENT_HOST`, `PASSWORD_RESET_PATH` | The frontend base URL and the path of its password-reset page. |
| Registration | `USERS_OPEN_REGISTRATION`, `ALLOW_WORKSPACE_REGISTRATION` | Both default to `False`. |
| Email | `SMTP_*`, `EMAILS_FROM_EMAIL`, `EMAILS_USE_SENDMAIL` | Email sending is enabled when the host, port and from-address are set. |
| Monitoring | `SENTRY_DSN` | Leave unset to disable. |
| Database | `POSTGRES_SERVER`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `USE_SQLITE`, `SQLITE_DATABASE_URI` | See [Database](#database). |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Key store and Celery broker. See below. |
| File storage | `STORAGE_METHOD`, `STORAGE_PATH`, `STORAGE_BASE_URL`, plus the Cloudinary, AWS, Google Cloud and Azure credentials | `file` stores uploads on disk and serves them from `STORAGE_BASE_URL`. |

The `AppSettings` fields that the template adds itself are `ACCESS_TOKEN_EXPIRE_MINUTES` (8 days), `INVALID_JWT_EXPIRE`, `EMAIL_TEMPLATES_DIR`, `PASSWORD_RESET_PATH`, the storage defaults and `STREAM_RETRY_TIMEOUT` / `STREAM_DELAY` for server-sent events.

`.env-example` also lists `BOT_TOKEN`, `TWILIO_*`, `SYSTEM_NOTIFICATION_CHANNELS` and `SSO_*`. None of the installed packages reads them. They belong to features you add yourself or to modules such as `msflib-notifications` that the template does not install.

For every variable a package defines and its default, see that package's page: [core](https://msflib.github.io/docsite/fastapi/modules/core/), [auth](https://msflib.github.io/docsite/fastapi/modules/auth/), [account](https://msflib.github.io/docsite/fastapi/modules/account/), [tenancy](https://msflib.github.io/docsite/fastapi/modules/tenancy/), [workspaces](https://msflib.github.io/docsite/fastapi/modules/workspaces/).

## Database

`app/db/session.py` builds the engine from the core settings. With `USE_SQLITE=true` it uses `SQLITE_DATABASE_URI`; otherwise it connects to PostgreSQL using the `POSTGRES_*` values. The core's own default for `USE_SQLITE` is `true`, and `.env-example` sets it to `false`, so set it explicitly in every environment. `DB_DEBUG_MODE=true` echoes SQL.

## Redis

With `REDIS_HOST` and `REDIS_PASSWORD` set, `app/api/deps.py` builds a Redis key store (port from `REDIS_PORT`, default 6379) for the token and recovery flows. Without them it uses an in-memory store that is not shared between processes, so run a single process or configure Redis. `app/worker.py` builds the Celery broker URL from the same `REDIS_*` values and falls back to `memory://`.
