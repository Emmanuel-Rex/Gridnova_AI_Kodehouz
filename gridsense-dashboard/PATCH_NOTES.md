# Gridnova AI dashboard corrections

- Corrected global dark-theme typography; default Vite `index.css` caused black headings.
- Improved card sizing, load panel layout, responsive spacing and text wrapping.
- Improved offline/error states: a failed API request no longer silently overwrites the last received telemetry, and unknown relay states display as Unavailable.
- Proxy now exposes the upstream error detail to the local dashboard; an HTTP 502 still requires checking network connectivity or Render availability.
- Reports remain limited to CSV export of available in-memory history. Do not claim complete daily/weekly/monthly/annual reports without persistent storage.
- The development proxy is for localhost only. Never publish a Vite development server with GRIDNOVA_ADMIN_KEY.
- Remote commands are queued, not automatically confirmed executed.

## Start

PowerShell:

```powershell
cd C:\GridSenseAI\gridsense-dashboard
$env:GRIDNOVA_ADMIN_KEY = Read-Host 'Enter Render ADMIN_KEY'
npm run dev
```

Ensure you use the exact key configured in Render. Restart Vite after setting it.
