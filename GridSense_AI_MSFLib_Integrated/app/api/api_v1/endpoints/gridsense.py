"""GridSense AI telemetry, commands and event detection for MSFLib FastAPI."""
import os
import re
import secrets
import time
from collections import deque
from threading import Lock
from typing import Callable, Optional
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

router = APIRouter(prefix='/gridsense', tags=['GridSense AI'])
lock = Lock()
state = dict(device='gridnova-esp32', online=False, updated_at=None, load1=False,
             load2=False, auto=True, overload=False, thermal_trip=False,
             temperature_c=None, demand_w=0, connected_w=0, limit_w=70,
             mode='SIMULATED_DEMAND_REAL_TEMPERATURE')
history = deque(maxlen=100)
events = deque(maxlen=100)
queue = deque(maxlen=20)
# A hook for the verified MSFLib emitter API. No claim of MSFLib delivery until bound.
_event_publisher: Optional[Callable[[str, dict], None]] = None


def set_event_publisher(publisher: Callable[[str, dict], None]) -> None:
    global _event_publisher
    _event_publisher = publisher


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


def authorize(actual: str | None, env: str) -> None:
    expected = os.getenv(env, '')
    if not expected or not actual or not secrets.compare_digest(actual, expected):
        raise HTTPException(status_code=401, detail='Invalid credentials')


def publish_event(name: str, data: dict) -> None:
    event = {'event': name, 'time': time.time(), **data}
    with lock:
        events.append(event)
    if _event_publisher:
        try:
            _event_publisher(name, event)
        except Exception:
            import logging
            logging.exception('MSFLib event publishing failed')


@router.post('/telemetry')
def telemetry(item: Telemetry, x_device_key: str | None = Header(default=None)):
    authorize(x_device_key, 'DEVICE_KEY')
    now = time.time()
    with lock:
        previous_overload = state['overload']
        previous_trip = state['thermal_trip']
        state.update(item.model_dump())
        state.update(updated_at=now, online=True)
        history.append({'time': now, 'temperature_c': item.temperature_c,
                        'demand_w': item.demand_w, 'connected_w': item.connected_w})
    data = {'device': item.device, 'demand_w': item.demand_w,
            'connected_w': item.connected_w, 'limit_w': item.limit_w,
            'load1': item.load1, 'load2': item.load2}
    if item.overload and not previous_overload:
        publish_event('gridsense.load_shedding', data)
    elif previous_overload and not item.overload:
        publish_event('gridsense.overload_cleared', data)
    if item.thermal_trip and not previous_trip:
        publish_event('gridsense.thermal_trip', {**data, 'temperature_c': item.temperature_c})
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
        result['events'] = list(events)
        result['pending_commands'] = len(queue)
    return result


@router.post('/command')
def send_command(item: Command, x_admin_key: str | None = Header(default=None)):
    authorize(x_admin_key, 'ADMIN_KEY')
    cmd = item.command.strip().lower()
    if cmd not in {'1', '2', 'auto', 'reset', 'status', 'demo'} and not re.fullmatch(r'limit\s+(?:[1-9]\d{0,3})', cmd):
        raise HTTPException(status_code=400, detail='Allowed: 1, 2, auto, reset, status, demo, limit N (1-9999)')
    with lock:
        if len(queue) >= queue.maxlen:
            raise HTTPException(status_code=429, detail='Command queue full')
        queue.append(cmd)
        pending = len(queue)
    return {'queued': cmd, 'pending': pending}
