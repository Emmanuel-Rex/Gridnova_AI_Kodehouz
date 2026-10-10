"""GridSense AI telemetry, commands and transition events for FastAPI.

Telemetry reports simulated electrical demand and measured temperature. This
module does not measure mains power or independently verify relay contacts.
State and queues are process-local and intended for a single-worker demo.
"""
import logging
import math
import os
import re
import secrets
import time
from collections import deque
from threading import Lock
from typing import Callable, Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/gridsense', tags=['GridSense AI'])
lock = Lock()
state = dict(device='gridnova-esp32', online=False, updated_at=None,
             load1=False, load2=False, auto=True, overload=False,
             thermal_trip=False, temperature_c=None, demand_w=0,
             connected_w=0, limit_w=70,
             mode='SIMULATED_DEMAND_REAL_TEMPERATURE')
history = deque(maxlen=100)
events = deque(maxlen=100)
queue = deque(maxlen=20)
_event_publisher: Optional[Callable[[str, dict], None]] = None


def set_event_publisher(publisher: Optional[Callable[[str, dict], None]]) -> None:
    """Bind a verified MSFLib adapter, or pass None to unbind it."""
    global _event_publisher
    with lock:
        _event_publisher = publisher


class Telemetry(BaseModel):
    device: str = Field(default='gridnova-esp32', min_length=1, max_length=80)
    mode: str = Field(default='SIMULATED_DEMAND_REAL_TEMPERATURE', max_length=100)
    load1: bool
    load2: bool
    auto: bool
    overload: bool
    thermal_trip: bool = False
    temperature_c: float | None = None
    demand_w: float = Field(ge=0, allow_inf_nan=False)
    connected_w: float = Field(ge=0, allow_inf_nan=False)
    limit_w: float = Field(gt=0, allow_inf_nan=False)

    @field_validator('temperature_c')
    @classmethod
    def finite_temperature(cls, value: float | None) -> float | None:
        if value is not None and not math.isfinite(value):
            raise ValueError('temperature_c must be finite')
        return value


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
        publisher = _event_publisher
    if publisher is not None:
        try:
            publisher(name, event)
        except Exception:
            logger.exception('Configured event publisher failed')


@router.post('/telemetry')
def telemetry(item: Telemetry, x_device_key: str | None = Header(default=None)):
    authorize(x_device_key, 'DEVICE_KEY')
    now = time.time()
    with lock:
        # A restart/offline gap is not evidence of a new transition.
        continuous = state['updated_at'] is not None and now - state['updated_at'] < 25
        previous = dict(state)
        state.update(item.model_dump())
        state.update(updated_at=now, online=True)
        history.append({'time': now, 'temperature_c': item.temperature_c,
                        'demand_w': item.demand_w,
                        'connected_w': item.connected_w})

    data = {'device': item.device, 'demand_w': item.demand_w,
            'connected_w': item.connected_w, 'limit_w': item.limit_w,
            'load1': item.load1, 'load2': item.load2}
    if continuous:
        if item.overload and not previous['overload']:
            publish_event('gridsense.overload_detected', data)
        elif previous['overload'] and not item.overload:
            publish_event('gridsense.overload_cleared', data)
        if item.thermal_trip and not previous['thermal_trip']:
            publish_event('gridsense.thermal_trip',
                          {**data, 'temperature_c': item.temperature_c})
        elif previous['thermal_trip'] and not item.thermal_trip:
            publish_event('gridsense.thermal_trip_cleared',
                          {**data, 'temperature_c': item.temperature_c})
        if previous['load2'] and not item.load2 and item.auto and item.overload:
            publish_event('gridsense.load_shedding_reported', data)
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
        result['online'] = bool(result['updated_at'] is not None and
                                time.time() - result['updated_at'] < 25)
        result['history'] = list(history)
        result['events'] = list(events)
        result['pending_commands'] = len(queue)
    return result


@router.post('/command')
def send_command(item: Command, x_admin_key: str | None = Header(default=None)):
    authorize(x_admin_key, 'ADMIN_KEY')
    cmd = ' '.join(item.command.strip().lower().split())
    # Limit range is intentionally conservative for the two-load demo.
    if cmd not in {'1', '2', 'auto', 'reset', 'status', 'demo'} and not re.fullmatch(
            r'limit (?:[1-9][0-9]{0,2})', cmd):
        raise HTTPException(status_code=400,
                            detail='Allowed: 1, 2, auto, reset, status, demo, limit N (1-999)')
    with lock:
        if len(queue) >= queue.maxlen:
            raise HTTPException(status_code=429, detail='Command queue full')
        queue.append(cmd)
        pending = len(queue)
    return {'queued': cmd, 'pending': pending}
