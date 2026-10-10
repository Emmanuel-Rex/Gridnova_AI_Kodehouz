# Database and seeding

## First-run initialisation

`app/initial_data.py` prepares a database for first use:

```bash
python -m app.initial_data
```

1. It decides whether to create the tables. It does if none of the app's tables exist yet, or if `INITIAL_DATA_RESET_DB` is set to `1`, `true`, `yes` or `on`.
2. When creating, `init_db` drops all tables in the metadata and creates them again from the SQLModel models.
3. It creates the default tenant, then the `FIRST_SUPERUSER` account (role `admin`, status `active`) if it is missing, ensures a default workspace in that tenant owned by that account, and adds the membership.

Re-running it on a populated database is safe: it only fills in what is missing. `INITIAL_DATA_RESET_DB` is destructive. Never set it in production. `.env-test` sets it to `True`, so anything started with that file (the Docker image does this, see [Testing and deployment](testing-and-deployment.md#docker)) drops and recreates all tables each time `initial_data` runs unless the variable is overridden.

`app/update_data.py` (`python -m app.update_data`) only runs `create_all`, so it adds tables for new models but does not alter existing ones.

This matters when you move an existing database to this version of the template. Workspaces now belong to a tenant, so an older database lacks the `tenant` table and the `workspace.tenant_id` column, and neither `initial_data` nor `update_data` adds them. Add a revision for them before starting the app on that database.

## Migrations

`alembic/env.py` is configured and imports `app.models` and `settings`, but the repository contains no revisions (`alembic/versions/` does not exist). Until you generate your first one, `alembic upgrade head` finds no revisions, prints nothing and exits successfully (checked with alembic 1.13.3 and 1.20.0, with and without an empty `versions/` directory), and `initial_data` creates the tables from the models. The command does connect to PostgreSQL first, see below.

Things to know before relying on Alembic:

- `alembic` is a dependency of the template (`pyproject.toml`), and `prestart.sh` calls `alembic upgrade head`.
- `env.py` builds a PostgreSQL URL from the `POSTGRES_*` settings and ignores `USE_SQLITE`.
- Generate a revision after model changes with `alembic revision --autogenerate -m "message"`, and review it before applying.

The common commands (`upgrade head`, `downgrade -1`, `history`) are listed in `alembic/README.md`.

## Start-up script

`prestart.sh` is the container entry step. It waits until the database answers (`app/backend_pre_start.py` retries for up to five minutes), runs `alembic upgrade head`, and runs `app/initial_data.py`.

## Seeding

`app/seed/` holds the template's setup for the MSFLib seeding tool. It loads sample data through the app's actions, so passwords are hashed and events fire as in normal use. How the YAML, factories and custom seeders work is described in [Seeding](https://msflib.github.io/docsite/fastapi/concepts/seeding/). The template's pieces are:

| File | Role |
|---|---|
| `seeders.yml` | Four seeders: `accounts` (from `data/accounts.csv`), `profiles` (inline record, linked to the seeded account), `workspaces` and `users` |
| `data/accounts.csv` | One admin account, `seed-admin@example.com` |
| `factories.py` | Return the app's `account_action` and `profile_action` for the YAML |
| `seeders/` | `WorkspaceSeeder` and `UserSeeder`, custom classes for the two seeders that need more than a plain create |
| `runner.py` | The command line entry point |

Run it with the wrapper script, which uses `../.venv/bin/python` when it exists and `python` otherwise:

```bash
./run_seeder.sh --dry-run        # validate the YAML and data files
./run_seeder.sh                  # seed the configured database
```

The flags and the safety prompt for non-local databases are described in the library page above. Seeding is not idempotent: run it against an empty database.

To add your own data, append a seeder to `seeders.yml`, put its records under `app/seed/data/`, and import its action in `app/actions/__init__.py`.
