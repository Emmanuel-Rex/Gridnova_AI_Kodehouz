# MSF FastAPI Template

A starter backend built on [MSFLib](https://github.com/msflib/fastapi): FastAPI, SQLModel, accounts, authentication and workspaces, with a Celery worker, Dockerfile, Alembic setup and a pytest suite.

Documentation: <https://msflib.github.io/docsite/fastapi-template/> (sources in `docs/`). The library itself is documented at <https://msflib.github.io/docsite/fastapi/>.

## Quick start

Requires Python 3.10+ and [Poetry](https://python-poetry.org/).

```bash
cp .env-example .env        # then edit SECRET_KEY, FIRST_SUPERUSER, FIRST_SUPERUSER_PASSWORD and the database values
poetry install
mkdir -p uploads            # served as static files; the app will not start without it
python -m app.initial_data  # create tables, first superuser and default workspace
uvicorn app.main:app --reload
```

The API docs are at <http://localhost:8000/docs>. See [Getting started](docs/getting-started.md) for pinning MSFLib release tags, SQLite for local work, and container installs.
