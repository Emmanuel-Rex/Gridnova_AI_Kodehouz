GRIDNOVA AI LIVE DASHBOARD PATCH (LOCAL DEVELOPMENT ONLY)

1. Backup src/App.tsx, src/App.css, and vite.config.ts in C:\GridSenseAI\gridsense-dashboard.
2. Copy src/App.tsx, src/App.css and vite.config.ts from this archive into your project, replacing the existing files.
3. Stop npm run dev with Ctrl+C.
4. In the SAME PowerShell window where you will start Vite, enter:
   $env:GRIDNOVA_ADMIN_KEY = Read-Host "Enter Render ADMIN_KEY"
   npm run dev
5. Open http://localhost:5173/ . The dashboard polls the real /status endpoint every 6 seconds.
6. The admin key is never sent to the browser, but any process or user with access to the local dev server can use the proxy. Do not expose port 5173 on your network, deploy this Vite middleware publicly, or use this setup as production authentication.
7. The backend history is in-memory only; reports cannot yet cover reliable long periods.
8. Never add the key to .env files, frontend code, Git, screenshots or chat messages.
