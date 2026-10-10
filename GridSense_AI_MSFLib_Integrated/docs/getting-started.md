# Getting started

## Prerequisites

- Python 3.10 to 3.14 (`>=3.10,<3.15`).
- [Poetry](https://python-poetry.org/).
- A PostgreSQL server, or SQLite for local work (see [Configuration](configuration.md#database)).
- Redis is optional. Without it the key store falls back to an in-memory map, which is per process.

## Install

Create your project from the template, then:

```bash
cp .env-example .env
poetry install
```

If `poetry install` fails inside a container or Codespace (Poetry's parallel installs interact badly with the git-based MSFLib dependencies), use the helper script instead. It clones the MSFLib repository once, rewrites the git dependencies to local paths for the install, and restores `pyproject.toml` afterwards:

```bash
./container-install.sh
```

If the MSFLib repository needs authentication from your environment, export `CONTAINER_GITHUB_PAT` first. The script and the Dockerfile both use it to configure git.

### MSFLib releases

`pyproject.toml` pins each MSFLib package to a release tag, named `<package>-v<version>`. Keep tags in anything you deploy, and avoid `rev = "dev"`, which tracks the development branch. The pins are:

```toml
msflib = { git = "https://github.com/msflib/fastapi.git", subdirectory = "core", rev = "core-v0.2.1" }
msflib-auth = { git = "https://github.com/msflib/fastapi.git", subdirectory = "modules/auth", rev = "auth-v0.2.2" }
msflib-account = { git = "https://github.com/msflib/fastapi.git", subdirectory = "modules/account", rev = "account-v0.2.2" }
msflib-tenancy = { git = "https://github.com/msflib/fastapi.git", subdirectory = "modules/tenancy", rev = "tenancy-v0.2.0" }
msflib-workspaces = { git = "https://github.com/msflib/fastapi.git", subdirectory = "modules/workspaces", rev = "workspaces-v0.2.1" }
```

`pyproject.toml` also installs `msflib-ai-core`, `msflib-documents`, `msflib-ai-api`, `msflib-ingestion` and `msflib-knowledge` at their release tags. The app does not wire them yet: their settings are not part of `AppSettings`, and none of their routers is mounted. These were the latest tags at the time of writing. To upgrade, change the tags together (modules depend on each other by tag) and see the [tags list](https://github.com/msflib/fastapi/tags) for newer ones.

## Configure

Edit `.env`. At minimum set `SECRET_KEY`, `FIRST_SUPERUSER`, `FIRST_SUPERUSER_PASSWORD` (the example value is a placeholder) and the database values. Every variable is described in [Configuration](configuration.md).

For a first run with no PostgreSQL, set:

```env
USE_SQLITE=true
SQLITE_DATABASE_URI=sqlite:///./test.db
```

## Create the tables and first data

On a fresh database:

```bash
python -m app.initial_data
```

This creates the tables from the model metadata, the default tenant, the `FIRST_SUPERUSER` account and a default workspace. Read [Database and seeding](database-and-seeding.md) before running it against a database that already has data.

## Run

When `STORAGE_METHOD` is `file` (the default) the app mounts `STORAGE_PATH` as static files at `STORAGE_BASE_URL`, and importing the app fails if that directory is missing. The `uploads` directory is not in git, so create it before the first run:

```bash
mkdir -p uploads
uvicorn app.main:app --reload
```

The interactive API docs are at `http://localhost:8000/docs` and the OpenAPI schema at `/api/v1/openapi.json`. Sign in with the `FIRST_SUPERUSER` credentials through `POST /api/v1/login`.
