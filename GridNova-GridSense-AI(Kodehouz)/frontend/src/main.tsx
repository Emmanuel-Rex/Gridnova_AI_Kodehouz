import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { apiClient } from './msflib';
import './style.css';

type Telemetry = {
  mode?: string; status?: string; demand_w?: number; connected_w?: number;
  temperature_c?: number | null; load1?: boolean; load2?: boolean;
  load3?: boolean; overload?: boolean; received_at?: string;
};

function App() {
  const [data, setData] = useState<Telemetry>({ status: 'Waiting for ESP32' });
  const [error, setError] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      // Actual MSFLib client is used here, not plain fetch.
      const response = await apiClient.get('/gridsense/status');
      setData(response.data as Telemetry);
      setError('');
    } catch (err) {
      setError('Cannot read status. Verify FastAPI is running and MSFLib is installed.');
    }
  }
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 1500);
    return () => clearInterval(timer);
  }, []);

  async function command(value: string) {
    setBusy(true);
    try {
      await apiClient.post('/gridsense/control', { command: value }, {
        headers: { 'X-Admin-Key': adminKey }
      });
      setError(`Command ${value} queued for ESP32`);
    } catch (err) {
      setError('Control failed. Check admin key and backend.');
    } finally { setBusy(false); }
  }

  return <main>
    <header><span className="eyebrow">TEAM GRIDNOVA · MSFLib React Client</span><h1>⚡ GridSense AI</h1>
      <p>Sense. Detect. Decide. Protect.</p><strong>SIMULATION — power values are not electrical measurements</strong></header>
    <section className="tiles">
      <article><label>Requested Demand</label><h2>{data.demand_w ?? '--'} W</h2></article>
      <article><label>Connected Demand</label><h2>{data.connected_w ?? '--'} W</h2></article>
      <article><label>Temperature</label><h2>{data.temperature_c == null ? 'N/A' : `${data.temperature_c} °C`}</h2></article>
      <article><label>Protection</label><h2>{data.overload ? 'LOAD SHED' : 'NORMAL'}</h2></article>
    </section>
    <section className="panel"><h3>Relay states</h3>
      <p>L1: {data.load1 ? 'ON' : 'OFF'} · L2: {data.load2 ? 'ON' : 'OFF'} · L3: {data.load3 ? 'ON' : 'OFF'}</p>
      <p className="muted">{data.received_at ? `Last telemetry: ${data.received_at}` : (data.status || 'Waiting for telemetry')}</p>
    </section>
    <section className="panel"><h3>Remote control</h3>
      <input type="password" placeholder="Admin key" value={adminKey} onChange={e => setAdminKey(e.target.value)}/>
      <div>{['1','2','3','reset'].map(c => <button key={c} disabled={busy} onClick={() => void command(c)}>{c === 'reset' ? 'Reset' : `Toggle L${c}`}</button>)}</div>
      {error && <p role="status">{error}</p>}
    </section>
    <footer>Data and commands use <code>@msflib/core</code> configuredApiClient()</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
