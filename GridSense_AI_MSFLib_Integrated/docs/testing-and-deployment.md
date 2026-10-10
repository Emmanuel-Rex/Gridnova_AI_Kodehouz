# Testing and deployment

## Tests

```bash
bash tests-start.sh
```

This creates `./tmp` and `./uploads`, runs `app/tests_pre_start.py`, then runs `scripts/test.sh`, which calls `pytest` with coverage over `app/tests`. `PYTEST_XDIST_WORKERS` sets the number of pytest-xdist workers: unset means `auto` (one per CPU), a number sets that many, and an empty value, `0`, `false` or `off` runs the tests serially. Extra pytest arguments go after the script name.

`pyproject.toml` loads MSFLib's `fast_bcrypt` pytest plugin, which hashes passwords at bcrypt's minimum cost in tests. Without it, every account a test creates costs about a quarter of a second.

How the suite is set up (`app/tests/conftest.py`):

- Each xdist worker uses its own SQLite file in `./tmp`, so the tests do not need PostgreSQL.
- The `session` fixture recreates the tables and first data (`init_db(create_tables=True)`) for every test.
- The `client` fixture overrides `get_session` and `get_keystore` with the test session and an in-memory key store.
- `superuser_account_token_headers` and `normal_account_token_headers` return ready-made authorisation headers using helpers from `msflib.utils.tests.account`.
- `mock_send_email` patches `msflib.services.email.send_email`.

The tests cover login, the admin account routes, first-run data and the seeders. `test_celery.py` is skipped. Write new tests under `app/tests/`, mirroring the `app/` layout.

CI (`.github/workflows/pytest.yml`) runs the suite on pull requests to `dev` or `main` only when the pull request has the `ready-for-analysis` label. `ruff.yml` and `flake8.yml` run the linters on every pull request. Locally, `pre-commit install` sets up the same checks, and `scripts/lint.sh`, `scripts/format.sh` and `scripts/format-imports.sh` run them on demand.

## Docker

The `Dockerfile` builds in two stages. The builder installs the dependencies into `/app/.venv` (using `scripts/toml_deps.py` to rewrite the MSFLib git dependencies to local paths, with `CONTAINER_GITHUB_PAT` as a build argument if the repository needs authentication), and the final image copies the result and starts `uvicorn app.main:app` on port 8000.

Two details:

- The image copies `.env-test` to `.env`, so a container started without environment variables runs with the test configuration. Provide real values at run time through environment variables, and never rely on the baked-in `SECRET_KEY`. Real environment variables take precedence over `.env`.
- `.env-test` also sets `INITIAL_DATA_RESET_DB=True`. If you run `prestart.sh` (or `app.initial_data`) in a container with production database credentials, set `INITIAL_DATA_RESET_DB=false` at run time first, or `initial_data` drops and recreates every application table.
- The image runs only the web process. It does not run `prestart.sh`; run it as a separate step or override the command to call it first.

`./build-container.sh <tag> <registry>` builds the image, logs in to the registry and pushes it as `<registry>/<tag>:latest`.

## Worker

`app/worker.py` defines a Celery app named `app.worker` with the default queue `main-queue` and one example task. `worker-start.sh` waits for the database and starts a worker on that queue. Without `REDIS_HOST` the broker is `memory://`, which only works inside one process, so a separate worker needs Redis. For how MSFLib runs long jobs and which pieces use the worker, see [Long-running jobs and ingestion](https://msflib.github.io/docsite/fastapi/integration/long-running-jobs-ingestion/).

## Documentation

This site is built with MkDocs from `docs/`:

```bash
pip install -r requirements-docs.txt
mkdocs serve
```

It is published to `https://msflib.github.io/docsite/fastapi-template/` by `.github/workflows/deploy-openwiki-mkdocs.yml` on pushes to `main` that touch the docs.
