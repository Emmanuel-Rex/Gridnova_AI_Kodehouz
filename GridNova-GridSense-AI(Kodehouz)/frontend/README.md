# GridSense AI — MSFLib React integration

This is a **real MSFLib frontend source integration**: `src/msflib.ts` imports `configureApplication` and `configuredApiClient` from `@msflib/core`; `src/main.tsx` invokes the returned `apiClient.get` and `apiClient.post` against the existing GridSense FastAPI endpoints.

## Fastest run on Windows

1. Extract the previously supplied `GridSensewithMSFLib.zip` and run its FastAPI backend in PowerShell from the directory containing `server.py`:
   `py -m pip install -r requirements.txt`
   `py -m uvicorn server:app --host 0.0.0.0 --port 8000`
2. Install Node.js LTS (which includes npm) if not installed. Verify `node -v` and `npm -v`.
3. Open another PowerShell in **this** folder (where `package.json` exists).
4. Run `npm install` (needs registry access to `@msflib/core`). If package is only on the organizer's private registry, follow their authentication/registry instructions; do not share credentials.
5. Run `npm run dev` and open `http://localhost:5173`.
6. The admin key default in the previous backend demo is `gridnova-admin-change-me`; change it before any nonlocal deployment.

## Verification

Browser Developer Tools > Network should show GET `/api/v1/gridsense/status` requests and POST `/api/v1/gridsense/control` for button presses. `src/main.tsx` uses MSFLib's `apiClient`, not fetch. The installed package may have different client method signatures; check organizer docs if TypeScript compilation fails.

## Safety

SIMULATION ONLY for power values. No PZEM mains wiring, no AC loads on exposed relay contacts. ESP32 retains local load-shedding logic; server commands are not safety interlocks. No public exposure of demo backend; authentication and HTTPS are required for production.
