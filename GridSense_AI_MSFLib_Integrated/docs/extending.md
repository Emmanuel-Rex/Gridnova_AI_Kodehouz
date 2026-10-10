# Extending the template

The template is meant to be edited. This page lists the usual changes and points to the MSFLib guide that explains each.

## Add a route of your own

Create a router in `app/api/api_v1/endpoints/`, using `deps.get_session` and `deps.get_current_active_account`, and include it in `app/api/api_v1/api.py`. See [Endpoints and routers](https://msflib.github.io/docsite/fastapi/quick-start/endpoints-and-routers/) and [Mounting routes](https://msflib.github.io/docsite/fastapi/integration/mounting-routes/).

## Add your own model

1. Define the table model and its create, update and read schemas.
2. Export them from `app/models/__init__.py`, so table creation and Alembic see them.
3. Create an action for it in `app/actions/__init__.py`.
4. Add a router.

See [Models, data and tables](https://msflib.github.io/docsite/fastapi/quick-start/models-data-tables/) and [Actions and CRUD](https://msflib.github.io/docsite/fastapi/quick-start/actions-crud/).

## Change a module's behaviour

To use your own account or workspace model with a module, or to change what an action does, follow [Overriding models](https://msflib.github.io/docsite/fastapi/integration/overriding-models/) and [Subclassing actions](https://msflib.github.io/docsite/fastapi/integration/subclassing-actions/). The router factories in `api.py` already take the model types as arguments.

## Add an MSFLib module

1. Add the package to `pyproject.toml` with a release tag (see [MSFLib releases](getting-started.md#msflib-releases)).
2. Add its settings class to the bases of `AppSettings` in `app/core/config.py`.
3. Import its models in `app/models/__init__.py` so its tables are created.
4. Mount its router in `api.py`, and register its event hooks if it has any.

The [module catalogue](https://msflib.github.io/docsite/fastapi/modules/) shows each module's settings, tables and routers, and [How to extend MSFLib](https://msflib.github.io/docsite/fastapi/integration/extending-msflib/) walks through the steps in detail.

## Add the workspaces routes

The template includes the workspaces models and actions but mounts no workspace routes. The router factories (`router`, `user_me_router`, `user_workspace_router` in `msflib.workspaces.router`) and the tenant dependencies they need are shown on the [workspaces page](https://msflib.github.io/docsite/fastapi/modules/workspaces/). Include them in `api.py` the same way as the account routers.

## Register hooks for another module

If a module you add exposes `register_event_hooks`, call it in `bootstrap_module_hooks` in `app/bootstrap.py` with the emitter it receives. See [Events and startup hooks](wiring.md#events-and-startup-hooks).

## Customise the emails

Email templates are MJML sources in `app/email-templates/src/`, compiled to HTML in `app/email-templates/build/`, which is the directory `EMAIL_TEMPLATES_DIR` points to. Edit the `.mjml` files and rebuild them with the MJML tool; the build output is what the app reads.
