"""GridSense AI IoT routes mounted within the MSFLib FastAPI template."""
import os
import secrets
import time
from collections import deque
from threading import Lock
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix='/gridsense', tags=['GridSense AI'])
lock = Lock()
state = {'device':'gridnova-esp32','online':False,'updated_at':None,'load1':False,'load2':False,'auto':True,'overload':False,'thermal_trip':False,'temperature_c':None,'demand_w':0,'connected_w':0,'limit_w':70,'mode':'SIMULATED_DEMAND_REAL_TEMPERATURE'}
history = deque(maxlen=100)
queue = deque(maxlen=20)

class Telemetry(BaseModel):
    device: str = 'gridnova-esp32'
    mode: str = 'SIMULATED_DEMAND_REAL_TEMPERATURE'
    load1: bool
    load2: bool
    auto: bool
    overload: bool
    thermal_trip: bool = False
    temperature_c: float | None = None
    demand_w: float = Field(ge=0)
    connected_w: float = Field(ge=0)
    limit_w: float = Field(gt=0)

class Command(BaseModel):
    command: str

def authorize(actual: str | None, env: str):
    expected = os.getenv(env, '')
    if not expected or not actual or not secrets.compare_digest(actual, expected):
        raise HTTPException(status_code=401, detail='Invalid credentials')

@router.post('/telemetry')
def telemetry(item: Telemetry, x_device_key: str | None = Header(default=None)):
    authorize(x_device_key, 'DEVICE_KEY')
    now = time.time()
    with lock:
        state.update(item.model_dump())
        state.update(updated_at=now, online=True)
        history.append({'time':now,'temperature_c':item.temperature_c,'demand_w':item.demand_w,'connected_w':item.connected_w})
    return {'ok': True}

@router.get('/device-command', response_class=PlainTextResponse)
def device_command(x_device_key: str | None = Header(default=None)):
    authorize(x_device_key, 'DEVICE_KEY')
    with lock:
        return queue.popleft() if queue else 'none'

@router.get('/status')
def status(x_admin_key: str | None = Header(default=None)):
    authorize(x_admin_key, 'ADMIN_KEY')
    with lock:
        result = dict(state)
        result['online'] = bool(result['updated_at'] and time.time() - result['updated_at'] < 25)
        result['history'] = list(history)
        result['pending_commands'] = len(queue)
    return result

@router.post('/command')
def send_command(item: Command, x_admin_key: str | None = Header(default=None)):
    authorize(x_admin_key, 'ADMIN_KEY')
    cmd = item.command.strip().lower()
    if cmd not in {'1','2','auto','reset','status'}:
        raise HTTPException(status_code=400, detail='Allowed: 1, 2, auto, reset, status')
    with lock:
        if len(queue) >= queue.maxlen:
            raise HTTPException(status_code=429, detail='Command queue full')
        queue.append(cmd)
        pending = len(queue)
    return {'queued':cmd,'pending':pending}
