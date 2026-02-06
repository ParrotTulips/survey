# Backend (FastAPI + Agno)

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

## Env

Create `backend/.env` (see `backend/.env.example`) and set `OPENAI_API_KEY` to enable Agno generation. If not set, the API will return a deterministic fallback questionnaire.

Set `DATABASE_URL` to your MySQL connection string to enable auth endpoints.
Example:

```
DATABASE_URL=mysql+pymysql://user:password@host:3306/database?charset=utf8mb4
```

Optional:
- `AGNO_MODEL` (default: gpt-4o-mini)
- `JWT_SECRET` (default: dev-secret-change)
- `ACCESS_TOKEN_EXPIRE_MINUTES` (default: 1440)
- `FRONTEND_ORIGINS` (comma-separated)
