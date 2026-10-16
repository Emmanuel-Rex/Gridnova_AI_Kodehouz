import MSFLibLoading from './MSFLibLoading';
import MSFLibThreshold from './MSFLibThreshold';
import MSFLibEvents from './MSFLibEvents';
import { useEffect, useState } from 'react';
import './App.css';



type Status = {device?:string;online?:boolean;load1?:boolean;load2?:boolean;auto?:boolean;overload?:boolean;thermal_trip?:boolean;temperature_c?:number|null;pzem_valid?:boolean;voltage_v?:number|null;current_a?:number|null;power_w?:number|null;energy_kwh?:number|null;frequency_hz?:number|null;pf?:number|null;demand_w?:number;connected_w?:number;limit_w?:number;mode?:string;updated_at?:number|null;events?:Array<{event?:string;time?:number;[key:string]:unknown}>;history?:Array<{time?:number;demand_w?:number;temperature_c?:number|null;voltage_v?:number|null;current_a?:number|null;power_w?:number|null;energy_kwh?:number|null;frequency_hz?:number|null;pf?:number|null}>};

const tabs=[['Overview','◈'],['Live Monitoring','◉'],['Load Control','⚡'],['Faults & Events','△'],['Reports & Analytics','▤'],['Settings','⚙']];

const stamp=(t?:number)=>t?new Date(t*1000).toLocaleString():'—';

const known=(v:unknown,yes='ON',no='OFF')=>typeof v==='boolean'?(v?yes:no):'Unavailable';

const readableMode=(v?:string)=>v==='SIMULATED_DEMAND_REAL_TEMPERATURE'?'Estimated demand · real temperature':v||'Unavailable';

const measurement=(v:number|null|undefined,digits=1)=>typeof v==='number'&&Number.isFinite(v)?v.toFixed(digits):'—';


const eventLabel=(v?:string)=>({'gridsense.load_shedding_reported':'Estimated load shedding','gridsense.overload_detected':'Estimated demand limit exceeded','gridsense.overload_cleared':'Estimated demand returned below limit','gridsense.thermal_trip':'Temperature trip'} as Record<string,string>)[v||'']||v?.replace(/^gridsense\./,'').replace(/_/g,' ')||'System event';

function Metric({label,value,unit,foot,accent}:{label:string;value:string|number;unit?:string;foot:string;accent?:string}){return <div className="metric"><span className="muted">{label}</span><div className="metricValue" style={{color:accent||'#edf7ff'}}>{value}<small>{unit}</small></div><span className="foot">{foot}</span></div>}

export default function App(){

 const [tab,setTab]=useState('Overview'),[status,setStatus]=useState<Status>({}),[connected,setConnected]=useState(false),[message,setMessage]=useState('Connecting to live Gridnova AI API...'),[busy,setBusy]=useState(false),[period,setPeriod]=useState('daily');

 const api='/gridnova-proxy';
 const [initialLoading, setInitialLoading] = useState(true);
 const livePzem=connected&&status.online&&status.pzem_valid===true;


 const [reportDate, setReportDate] = useState(() => {
   const now = new Date();
   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, '0');
   const day = String(now.getDate()).padStart(2, '0');
   return `${year}-${month}-${day}`;
 });

 const [downloading, setDownloading] = useState(false);

const [reportMessage, setReportMessage] = useState('');

 
useEffect(() => {
  let active = true;
  let firstRequest = true;

  const poll = async () => {
    try {
      const response = await fetch(`${api}/status`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({
          detail: 'Upstream request failed',
        }));

        throw new Error(
          `HTTP ${response.status}: ${
            detail.detail || 'Request failed'
          }`
        );
      }

      const data: Status = await response.json();

      if (active) {
        setStatus(data);
        setConnected(true);

        setMessage(
          data.online
            ? 'Live ESP32 telemetry connected'
            : 'Backend connected — ESP32 offline'
        );
      }
    } catch (error) {
      if (active) {
        setConnected(false);
        setMessage(
          `Connection interrupted: ${String(error)} — displaying last received readings`
        );
      }
    } finally {
      if (active && firstRequest) {
        setInitialLoading(false);
        firstRequest = false;
      }
    }
  };

  poll();

  const intervalId = setInterval(poll, 6000);

  return () => {
    active = false;
    clearInterval(intervalId);
  };
}, []);


 async function command(cmd: string): Promise<void> {
  if (!connected || !status.online) {
    const error = new Error('ESP32 is offline.');
    setMessage(error.message);
    throw error;
  }

  setBusy(true);

  try {
    const response = await fetch(`${api}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command: cmd }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);

      throw new Error(
        detail?.detail
          ? String(detail.detail)
          : `Command failed: HTTP ${response.status}`
      );
    }

    setMessage(
      `Command queued: ${cmd}. Waiting for ESP32 telemetry to confirm state.`
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    setMessage(`Command failed: ${message}`);
    throw error;
  } finally {
    setBusy(false);
  }
}
 async function downloadReport(format: 'csv' | 'xlsx' | 'pdf') {

  setDownloading(true);

  setReportMessage('');



  try {

    const params = new URLSearchParams({

      format,

      date: reportDate,

    });



    const response = await fetch(

      `${api}/reports/${period}?${params.toString()}`,

      { cache: 'no-store' }

    );



    if (!response.ok) {

      const detail = await response.json().catch(() => null);

      throw new Error(

        detail?.detail

          ? String(detail.detail)

          : `HTTP ${response.status}`

      );

    }



    const blob = await response.blob();

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');



    link.href = url;

    link.download =

      `Gridnova_AI_${period}_${reportDate}.${format}`;



    document.body.appendChild(link);

    link.click();

    link.remove();



    setTimeout(() => URL.revokeObjectURL(url), 1000);

    setReportMessage(

      `${format.toUpperCase()} report downloaded successfully.`

    );

  } catch (error) {

    setReportMessage(`Download failed: ${String(error)}`);

  } finally {

    setDownloading(false);

  }

}

async function handleLogout() {
  try {
    const response = await fetch('/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });

    if (!response.ok) {
      throw new Error('Logout failed');
    }

    window.location.replace('/');
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : 'Unable to log out. Please try again.'
    );
  }
}


 return <div className="shell"><aside className="sidebar"><div className="brand"><div className="brandIcon">G<span>◈</span></div><div><strong>GRIDNOVA <em>AI</em></strong><small>INTELLIGENT ENERGY PLATFORM</small></div></div><div className="sideLabel">WORKSPACE</div><div className="workspace">◫ &nbsp; GridNova HQ <span>⌄</span></div><div className="sideLabel">PLATFORM</div><nav>{tabs.map(([name,icon])=><button key={name} className={tab===name?'active':''} onClick={()=>setTab(name)}><span>{icon}</span>{name}</button>)}</nav><div className="sideBottom"><div className="sideHelp">✧ &nbsp; Smart power. Smarter decisions.<small>Sense. Detect. Decide. Protect.</small></div>
<div className="profile">
  <div className="avatar">GN</div>

  <div>
    <b>GridNova Operator</b>
    <small>Administrator</small>
  </div>
</div>

<button
  type="button"
  onClick={handleLogout}
  className="gridnova-logout"
>
  <span>⇥</span>
  Logout
</button>
</div></aside><main><header><div className="breadcrumbs">Workspace <span>/</span> Gridnova AI <span>/</span> <b>{tab}</b></div><div className="headerRight"><span className={'statusPill '+(connected&&status.online?'live':'')}>● {connected?(status.online?'DEVICE ONLINE':'DEVICE OFFLINE'):'API OFFLINE'}</span><div className="avatar mini">GN</div></div></header><div className="content"><div className="pageHeading"><div><div className="eyebrow">GRIDNOVA AI / CONTROL CENTRE</div><h1>{tab==='Overview'?'Energy Intelligence Overview':tab}</h1><p>Monitor, analyze and manage connected power loads with intelligent automation.</p></div><div className="headingActions"><span className="clock">◷ {new Date().toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}</span><button className="primary" onClick={()=>setTab('Reports & Analytics')}>▤ &nbsp; Generate Report</button></div></div><div className={'notice '+(connected?'good':'')}>◉ &nbsp; {message} <span>{connected?(status.online?'API + DEVICE':'API ONLY'):'RECONNECTING'}</span></div>{initialLoading && <MSFLibLoading />}

 {!initialLoading && tab==='Overview'&&<><section className="metrics"><Metric label="Measured Active Power" value={livePzem?measurement(status.power_w,1):'—'} unit="W" foot="Real PZEM measurement" accent="#41dbac"/><Metric label="Measured Voltage" value={livePzem?measurement(status.voltage_v,1):'—'} unit="V" foot="PZEM monitored circuit"/><Metric label="Measured Frequency" value={livePzem?measurement(status.frequency_hz,1):'—'} unit="Hz" foot="PZEM measured AC frequency"/><Metric label="PZEM Connection" value={livePzem?'ACTIVE':'UNAVAILABLE'} foot="Valid readings from ESP32"/></section><section className="metrics"><Metric label="Estimated Power Demand" value={connected?status.demand_w??'—':'—'} unit="W" foot="Simulated load demand; separate from measured power"/><Metric label="Connected Load" value={connected?status.connected_w??'—':'—'} unit="W" foot="Nominal estimate from active load states"/><Metric label="Device Temperature" value={connected?status.temperature_c??'—':'—'} unit="°C" foot="DS18B20 sensor (when live)"/><Metric label="System Protection" value={!connected?'UNAVAILABLE':status.thermal_trip?'TEMP TRIP':status.overload?'SHEDDING':'NORMAL'} foot="Demo protection state (estimated demand)" accent={status.thermal_trip?'#fb7185':'#41dbac'}/></section><div className="twoCol"><section className="panel"><div className="panelHead"><div><h2>Power Demand</h2><p>Recent estimated demand readings</p></div><span className="tag">SIMULATED WATTS</span></div><div className="bars">{(status.history||[]).slice(-14).map((h,i)=><div className="barCol" key={i}><div className="bar" style={{height:`${Math.max(8,Math.min(100,(h.demand_w||0)/100*100))}%`}} title={`${h.demand_w||0} W`}/><small>{h.time?new Date(h.time*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):''}</small></div>)}</div><div className="chartLegend"><span>● Estimated demand</span><span>Limit: {status.limit_w} W</span></div></section><section className="panel"><div className="panelHead"><div><h2>Load Management</h2><p>Current device-reported states</p></div><span className="tag">2 LOADS</span></div><div className="loadItem"><div className="loadIcon">⚡</div><div><b>Load 01 · Critical</b><small>15 W nominal (demo assumption)</small></div><span className={'state '+(status.load1?'on':'off')}>{known(connected?status.load1:undefined)}</span></div><div className="loadItem"><div className="loadIcon">⚡</div><div><b>Load 02 · Non-critical</b><small>60 W nominal (demo assumption)</small></div><span className={'state '+(status.load2?'on':'off')}>{known(connected?status.load2:undefined)}</span></div><div className="panelFoot">Automatic load management <b>{known(connected?status.auto:undefined,'ENABLED','DISABLED')}</b></div><button className="outline wide" onClick={()=>setTab('Load Control')}>Open Load Controls →</button></section></div><section className="panel"><div className="panelHead"><div><h2>Recent System Events</h2><p>Load shedding, recovery and temperature protection</p></div><button className="textBtn" onClick={()=>setTab('Faults & Events')}>View all →</button></div><EventTable events={status.events||[]}/></section></>}

 {!initialLoading && tab==='Live Monitoring'&&<><section className="panel"><div className="panelHead"><div><h2>Live Electrical Measurements</h2><p>PZEM-004T V4.0 · measured electrical data from the monitored circuit</p></div><span className="tag">{livePzem?'PZEM ONLINE':'PZEM UNAVAILABLE'}</span></div><section className="metrics"><Metric label="AC Voltage" value={livePzem?measurement(status.voltage_v,1):'—'} unit="V" foot="Measured RMS voltage"/><Metric label="AC Current" value={livePzem?measurement(status.current_a,3):'—'} unit="A" foot="Measured CT current"/><Metric label="Active Power" value={livePzem?measurement(status.power_w,1):'—'} unit="W" foot="Measured, not simulated"/><Metric label="Meter Energy" value={livePzem?measurement(status.energy_kwh,4):'—'} unit="kWh" foot="Cumulative PZEM register"/><Metric label="Frequency" value={livePzem?measurement(status.frequency_hz,1):'—'} unit="Hz" foot="Measured AC frequency"/><Metric label="Power Factor" value={livePzem&&typeof status.current_a==='number'&&status.current_a>0?measurement(status.pf,2):'—'} foot="Undefined at zero current"/></section><p className="foot">Readings are from the PZEM-monitored circuit. They are not necessarily the total power of both loads. No automatic protection decision is based on these measurements yet.</p></section><section className="metrics"><Metric label="Device Connection" value={connected&&status.online?'Online':'Offline'} foot="Telemetry status"/><Metric label="Temperature" value={connected?status.temperature_c??'—':'—'} unit="°C" foot="Sensor reading"/><Metric label="Demand" value={connected?status.demand_w??'—':'—'} unit="W" foot="Estimated demand"/><Metric label="Configured Limit" value={connected?status.limit_w??'—':'—'} unit="W" foot="Demo threshold"/></section><section className="panel"><h2>Telemetry Details</h2><div className="detailGrid">{Object.entries({Device:status.device,Mode:readableMode(status.mode),'Last Update':stamp(status.updated_at||undefined),'Load 1':known(connected?status.load1:undefined),'Load 2':known(connected?status.load2:undefined),'Auto Mode':known(connected?status.auto:undefined),'Estimated demand limit exceeded':known(connected?status.overload:undefined,'YES','NO'),'Thermal Trip':known(connected?status.thermal_trip:undefined,'YES','NO')}).map(([k,v])=><div key={k}><small>{k}</small><b>{v}</b></div>)}</div></section></>}

 {!initialLoading && tab==='Load Control'&&<section className="panel"><div className="panelHead"><div><h2>Remote Load Management</h2><p>Commands are queued to the ESP32. Verify actual lamp states on hardware.</p></div><span className="tag">{connected&&status.online?'DEVICE READY':'CONTROLS UNAVAILABLE'}</span></div><div className="controlGrid"><div className="controlCard"><h3>Load 01 · Critical</h3><p>Current reported state: {known(connected?status.load1:undefined)}</p><button disabled={!connected||!status.online||busy} className="primary" onClick={()=>command('1')}>Toggle Load 1</button></div><div className="controlCard"><h3>Load 02 · Non-critical</h3><p>Current reported state: {known(connected?status.load2:undefined)}</p><button disabled={!connected||!status.online||busy} className="primary" onClick={()=>command('2')}>Toggle Load 2</button></div><div className="controlCard"><h3>Automation</h3><p>Auto mode: {known(connected?status.auto:undefined)}</p><button disabled={!connected||!status.online||busy} className="outline" onClick={()=>command('auto')}>Toggle Auto Mode</button></div><div className="controlCard"><h3>Demo Scenario</h3><p>Run the configured demonstration routine</p><button disabled={!connected||!status.online||busy} className="outline" onClick={()=>command('demo')}>Run Demo Scenario</button></div></div><div className="commandRow"><button disabled={!connected||!status.online||busy} className="outline" onClick={()=>command('limit 70')}>Set Limit 70 W</button><button disabled={!connected||!status.online||busy} className="outline" onClick={()=>command('limit 100')}>Set Limit 100 W</button><button disabled={!connected||!status.online||busy} className="outline" onClick={()=>command('reset')}>Reset</button></div>
<MSFLibThreshold
  currentLimit={Number(status.limit_w ?? 70)}
  onApply={async (watts) => {
    if (!connected || !status.online) {
      throw new Error('ESP32 is offline.');
    }

    await command(`limit ${watts}`);
  }}
/>
</section>}

 
{!initialLoading && tab === 'Faults & Events' && (
  <section className="panel">
    <div className="panelHead">
      <div>
        <h2>Fault & Event History</h2>
        <p>Timestamped operational events reported to the backend</p>
      </div>
      <span className="tag">
        {status.events?.length || 0} EVENTS
      </span>
    </div>

    <MSFLibEvents events={status.events ?? []} />
  </section>
)}


 {!initialLoading && tab === 'Reports & Analytics' && (

  <section className="panel">

    <div className="panelHead">

      <div>

        <h2>Generate an Energy Report</h2>

        <p>

          Download historical telemetry and operational reports

        </p>

      </div>

      <span className="tag">DATABASE REPORTING</span>

    </div>



    <div className="reportBox">

      <label>

        Reporting period

        <select

          value={period}

          onChange={(e) => setPeriod(e.target.value)}

        >

          <option value="daily">Daily</option>

          <option value="weekly">Weekly</option>

          <option value="monthly">Monthly</option>

          <option value="annual">Annual</option>

        </select>

      </label>



      <label>

        Report date

        <input

          type="date"

          value={reportDate}

          onChange={(e) => setReportDate(e.target.value)}

        />

      </label>



      <div className="reportWarning">

        Electrical demand and automatic load shedding use simulated/estimated values. Real PZEM voltage, current, power, energy, frequency and power factor are recorded when available.

        Temperature is measured using the DS18B20 sensor.

        Reports include only records available in the database

        for the selected period.

      </div>



      <div className="commandRow">

        <button

          className="primary"

          disabled={!connected || downloading}

          onClick={() => downloadReport('pdf')}

        >

          ↓ Download PDF

        </button>



        <button

          className="primary"

          disabled={!connected || downloading}

          onClick={() => downloadReport('xlsx')}

        >

          ↓ Download Excel

        </button>



        <button

          className="outline"

          disabled={!connected || downloading}

          onClick={() => downloadReport('csv')}

        >

          ↓ Download CSV

        </button>

      </div>



      {reportMessage && (

        <p role="status">{reportMessage}</p>

      )}

    </div>

  </section>

)}

 {!initialLoading && tab==='Settings'&&<section className="panel"><div className="panelHead"><div><h2>Secure Local API Connection</h2><p>Admin credentials stay in the Vite development server process, not in browser storage.</p></div></div><div className="settingsForm"><p>API proxy: <code>/gridnova-proxy</code></p><p>Backend: https\://gridnova-ai-kodehouz.onrender.com</p><p className="foot">Set GRIDNOVA_ADMIN_KEY in the PowerShell session that starts Vite, then restart npm run dev. Never deploy this development proxy as a public application.</p></div></section>}

 <footer>© Gridnova AI · Team GridNova &nbsp; | &nbsp; Sense. Detect. Decide. Protect. <span>Version 0.2 · PZEM Monitoring</span></footer></div></main></div>

}

function EventTable({events}:{events:Status['events']}){return <div className="eventTable"><div className="eventHeader"><span>EVENT</span><span>TIME</span><span>SEVERITY</span></div>{events?.length?events.slice().reverse().slice(0,12).map((e,i)=><div className="eventRow" key={i}><span><i className="dot"/> {eventLabel(e.event)}</span><span>{stamp(e.time)}</span><span className="severity">{String(e.event||'').includes('trip')?'Critical':String(e.event||'').includes('cleared')?'Resolved':'Notice'}</span></div>):<div className="empty">No recorded events yet.</div>}</div>}
