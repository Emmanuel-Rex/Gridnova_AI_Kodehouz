"""Minimal standalone GridSense FastAPI demo. No Poetry, Git or database required."""
import os
from datetime import datetime, timezone
from typing import Any
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DEVICE_KEY = os.getenv("GRIDSENSE_DEVICE_KEY", "gridnova-demo-key-change-me")
ADMIN_KEY = os.getenv("GRIDSENSE_ADMIN_KEY", "gridnova-admin-change-me")
app = FastAPI(title="GridSense AI - GridNova")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET","POST"], allow_headers=["*"])
latest: dict[str, Any] = {"mode":"SIMULATION", "status":"Waiting for ESP32 telemetry"}
history: list[dict[str, Any]] = []
commands: list[str] = []

class Command(BaseModel):
    command: str

def require_device(key: str | None):
    if key != DEVICE_KEY: raise HTTPException(401, "Invalid device key")

def require_admin(key: str | None):
    if key != ADMIN_KEY: raise HTTPException(401, "Invalid admin key")

@app.post("/api/v1/gridsense/telemetry")
def telemetry(payload: dict[str, Any], x_device_key: str | None = Header(default=None)):
    require_device(x_device_key)
    global latest
    latest = {**payload, "received_at": datetime.now(timezone.utc).isoformat()}
    history.append(latest.copy())
    if len(history) > 300: del history[:-300]
    return {"ok": True}

@app.get("/api/v1/gridsense/status")
def status(): return latest

@app.get("/api/v1/gridsense/history")
def readings(): return history[-100:]

@app.post("/api/v1/gridsense/control")
def control(payload: Command, x_admin_key: str | None = Header(default=None)):
    require_admin(x_admin_key)
    cmd = payload.command.strip().lower()
    if cmd not in {"1", "2", "3", "auto", "reset"}: raise HTTPException(400, "Invalid command")
    if len(commands) >= 10: raise HTTPException(429, "Command queue full")
    commands.append(cmd)
    return {"queued": cmd}

@app.get("/api/v1/gridsense/device-command", response_class=PlainTextResponse)
def device_command(x_device_key: str | None = Header(default=None)):
    require_device(x_device_key)
    return commands.pop(0) if commands else ""

@app.get("/", response_class=HTMLResponse)
def home():
    return """<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><title>GridSense AI</title><style>
    body{background:#071827;color:#e8f9f6;font:16px Arial,sans-serif;margin:0;padding:26px}main{max-width:900px;margin:auto}h1{color:#3de1ad}small{color:#a9b9c6}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}.tile{background:#123047;border:1px solid #27516b;border-radius:12px;padding:20px}.val{font-size:29px;font-weight:bold;margin-top:12px}button{background:#2dd4a7;border:0;padding:13px 20px;border-radius:7px;margin:6px;cursor:pointer;font-weight:bold}#notice{margin:12px 0;color:#ffce73}input{padding:12px;border-radius:6px;border:1px solid #53788e;background:#0c2538;color:white;width:250px}</style></head>
    <body><main><h1>⚡ GridSense AI</h1><p>TEAM GRIDNOVA · Sense. Detect. Decide. Protect.</p><p><strong>DEMO: simulated watts, not measured electrical power.</strong></p>
    <div class='grid'><div class='tile'>Demand<div class='val' id='demand'>--</div></div><div class='tile'>Connected<div class='val' id='connected'>--</div></div><div class='tile'>Temperature<div class='val' id='temp'>--</div></div><div class='tile'>Protection<div class='val' id='alarm'>--</div></div></div>
    <h2>Relay status</h2><div id='loads'>Waiting for ESP32...</div><h2>Demo controls</h2><p><small>Enter admin key from server configuration. Keep it private.</small></p><input type='password' id='key' placeholder='Admin key'><div><button onclick="send('1')">Toggle L1</button><button onclick="send('2')">Toggle L2</button><button onclick="send('3')">Toggle L3</button><button onclick="send('reset')">Reset</button></div><div id='notice'></div><small id='stamp'></small></main>
    <script>
    async function refresh(){try{const r=await fetch('/api/v1/gridsense/status');const d=await r.json();document.getElementById('demand').textContent=d.demand_w===undefined?'--':d.demand_w+' W';document.getElementById('connected').textContent=d.connected_w===undefined?'--':d.connected_w+' W';document.getElementById('temp').textContent=d.temperature_c==null?'N/A':d.temperature_c+' °C';document.getElementById('alarm').textContent=d.overload?'LOAD SHED':'NORMAL';document.getElementById('loads').textContent='L1: '+(d.load1?'ON':'OFF')+' | L2: '+(d.load2?'ON':'OFF')+' | L3: '+(d.load3?'ON':'OFF');document.getElementById('stamp').textContent=d.received_at?'Last received: '+d.received_at:'Waiting for ESP32 telemetry';}catch(e){document.getElementById('notice').textContent='Backend connection error';}}
    async function send(command){try{let r=await fetch('/api/v1/gridsense/control',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Key':document.getElementById('key').value},body:JSON.stringify({command})});document.getElementById('notice').textContent=r.ok?'Queued '+command+' (ESP32 polls every 2.5s)':'Command failed: HTTP '+r.status;}catch(e){document.getElementById('notice').textContent='Request failed';}}
    refresh();setInterval(refresh,1500);
    </script></body></html>"""
