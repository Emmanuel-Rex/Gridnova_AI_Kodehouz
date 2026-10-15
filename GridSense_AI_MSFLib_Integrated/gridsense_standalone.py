from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from app.api.api_v1.endpoints.gridsense import router

app = FastAPI(title='Gridnova AI — Team GridNova', version='1.1.0')
app.include_router(router, prefix='/api/v1')

@app.get('/gridsense-health')
def health():
    return {'status': 'ok', 'service': 'Gridnova AI'}

@app.get('/')
def home():
    return RedirectResponse(url='/docs')
