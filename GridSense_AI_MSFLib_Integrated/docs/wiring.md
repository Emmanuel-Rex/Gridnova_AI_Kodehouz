# How the app is wired

The template is a thin layer. Almost every file imports something from `msflib` and binds it to this app's settings, models and database. This page follows one request through those files.

## Application: `app/main.py`

Creates the `FastAPI` app with the project name and an OpenAPI URL under `API_V1_STR` (`/api/v1`), adds CORS from `BACKEND_CORS_ORIGINS`, includes `api_router` under the same prefix, and mounts the upload directory when file storage is used. It binds an app emitter with `bind_app_emitter(app)` and passes it to `bootstrap_module_hooks`.

## Dependencies: `app/api/deps.py`

Creates the request-scoped building blocks once, from `settings` and the engine:

- `get_session`: a database session per request.
- `get_keystore`: the token store (see [Redis](configuration.md#redis)).
- `get_current_account`, `get_current_active_account`, `get_current_active_superuser` and `RoleCheck`: the authentication dependencies, built by `get_account_dependencies` with this app's `Account` model and the statuses that count as active (`active`, `online`).

Use these in your own routes. `app/api/rbac.py` is an empty placeholder for role definitions. See [Dependency injection](https://msflib.github.io/docsite/fastapi/concepts/dependency-injection/) and [Authentication](https://msflib.github.io/docsite/fastapi/integration/authentication/).

## Models and actions: `app/models`, `app/actions`

`app/models/__init__.py` re-exports the tenant, account, profile, workspace and user models so the rest of the app imports from one place (`from app import models`). It must import every table model, because table creation and Alembic discover tables through it.

`app/actions/__init__.py` creates one action instance per model: `tenant_action`, `account_action`, `profile_action`, `workspace_action` and `user_action`. Routers, seeders and `init_db` all use these instances. To change a model or an action's behaviour see [Overriding models](https://msflib.github.io/docsite/fastapi/integration/overriding-models/) and [Subclassing actions](https://msflib.github.io/docsite/fastapi/integration/subclassing-actions/).

## Routes: `app/api/api_v1/api.py`

Builds `api_router` by calling each module's router factory with the app's dependencies, models and settings:

| Factory | Mounted at | Provides |
|---|---|---|
| `auth_router` | `/api/v1` | login, logout, password recovery and reset, token verification; Google sign-in when `ENABLE_GOOGLE_OAUTH` is set |
| `account_router` | `/api/v1` | the signed-in account (`/me`) and an availability check |
| `profile_router` | `/api/v1/profiles` | profile read and avatar upload |
| `account_admin_router` (in `endpoints/admin`) | `/api/v1/admin/accounts` | admin account management, behind `RoleCheck` |

Your own routers go in `app/api/api_v1/endpoints/` and are included in `api.py`. The template does not mount the workspaces router; see [Extending the template](extending.md#add-the-workspaces-routes).

## Events and startup hooks

`main.py` creates one app emitter and `app/bootstrap.py` registers the workspace hooks on it, unless `AUTO_REGISTER_EVENT_HOOKS` is false. With the hooks registered, creating an account creates the default workspace and a membership in the same transaction. Register your own module hooks and listeners in `bootstrap_module_hooks`, or in `app/eventbus/` (an empty package for your listeners). Scripts that run outside the web app, such as `app.initial_data`, have no app emitter; `init_db` creates the default tenant, workspace and membership for the first superuser directly. See the [Event bus](https://msflib.github.io/docsite/fastapi/concepts/event-bus/) concept page for what is active where.

## Empty extension points

`app/schemas/`, `app/services/`, `app/eventbus/` and `app/api/rbac.py` are empty on purpose. Put request/response schemas, business logic, event listeners and role definitions there.
