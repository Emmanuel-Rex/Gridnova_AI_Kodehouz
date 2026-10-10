# MSF FastAPI Template

This repository is a starter backend built on [MSFLib](https://msflib.github.io/docsite/fastapi/). It wires the core library with the `auth`, `account` and `workspaces` modules into a working FastAPI app, so you start from a running service with accounts, login and workspaces and add your own code on top.

These pages explain how the template is put together. They do not repeat the library documentation: for what a module does, how settings, actions and events work, or how to extend them, follow the links to the [MSFLib docs](https://msflib.github.io/docsite/fastapi/).

## What you get

| Feature | Provided by |
|---|---|
| Login, logout, password recovery and reset, optional Google sign-in | [`msflib-auth`](https://msflib.github.io/docsite/fastapi/modules/auth/) |
| Accounts, profiles and an admin account router | [`msflib-account`](https://msflib.github.io/docsite/fastapi/modules/account/) |
| Workspaces and memberships | [`msflib-workspaces`](https://msflib.github.io/docsite/fastapi/modules/workspaces/) and [`msflib-tenancy`](https://msflib.github.io/docsite/fastapi/modules/tenancy/) (workspaces depend on it) |
| Settings, database session, key store, seeding | [`msflib` core](https://msflib.github.io/docsite/fastapi/modules/core/) |
| Celery worker, Dockerfile, Alembic setup, pytest suite | This template |

## Repository layout

```text
app/
    main.py            FastAPI app: CORS, router, static uploads
    bootstrap.py       Startup hooks (see "How the app is wired")
    worker.py          Celery app
    core/config.py     AppSettings
    api/deps.py        Session, key store and account dependencies
    api/api_v1/        Router assembly and endpoint packages
    actions/           One action instance per model
    models/            Re-exports of the module models
    db/                Engine and first-run initialisation
    seed/              Seeders, sample data and the seed CLI
    tests/             Pytest suite
alembic/             Migration environment (no revisions yet)
prestart.sh          Container start-up: wait for DB, migrate, create first data
```

## Where to go next

1. [Getting started](getting-started.md): install, configure, run.
2. [Configuration](configuration.md): the settings class and the environment variables the template reads.
3. [How the app is wired](wiring.md): what each file does and where your own code goes.
4. [Database and seeding](database-and-seeding.md): creating tables, first-run data and sample data.
5. [Testing and deployment](testing-and-deployment.md): the test suite, Docker, workers and CI.
6. [Extending the template](extending.md): adding modules, models and routes.
