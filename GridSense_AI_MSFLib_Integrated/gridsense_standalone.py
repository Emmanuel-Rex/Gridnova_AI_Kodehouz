from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from app.api.api_v1.endpoints.gridsense import router

app = FastAPI(title="GridSense AI — Team GridNova")

app.include_router(router, prefix="/api/v1")

@app.get("/gridsense-health")
def health():
    return {"status": "ok", "service": "GridSense AI"}

@app.get("/")
def home():
    return RedirectResponse(url="/docs")
