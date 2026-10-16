# Gridnova AI

**Intelligent Energy Monitoring, Fault Detection & Automated Load Management**  
**Team:** GridNova  
**Tagline:** *Sense. Detect. Decide. Protect.*

Gridnova AI is an ESP32-based edge-IoT prototype that monitors electrical conditions and device temperature, displays operating information locally, sends telemetry to a cloud API, and supports remote load management through a React dashboard. It demonstrates threshold-based load management, event monitoring, and downloadable reports.

> **Prototype and safety notice:** This is a demonstration system, not a certified electrical protection device. AC mains wiring and testing must be performed by qualified personnel using appropriate isolation, enclosures and protective devices. Do not use the prototype as a substitute for an approved breaker or protection relay.

## Features

- ESP32 edge controller with Wi-Fi telemetry and command polling.
- PZEM-004T monitoring of electrical parameters **when a valid meter reading is available**.
- DS18B20 temperature monitoring and local OLED status display.
- Two remotely controlled demonstration loads via relay channels.
- Configurable **estimated-demand** threshold and automatic load-management demonstration.
- Device status, fault/event history and reporting interface.
- Password-protected production dashboard with a server-side API gateway.
- MSFLib UI integration in the dashboard.

## How the system works

```text
Electrical meter + temperature sensor
                 |
                 v
             ESP32 edge unit ----> OLED / indicators / buzzer
                 |
                 +----> relay module ----> demonstration loads
                 |
             Wi-Fi / HTTPS
                 |
                 v
         FastAPI cloud backend
                 ^
                 |
      Authenticated Express gateway
                 ^
                 |
       React + MSFLib dashboard
```

The ESP32 publishes telemetry and polls for commands. The backend maintains the current reported device state and relays queued commands. The dashboard displays the device-reported state; a successful command submission does **not** by itself prove that a physical relay contact or appliance has changed state.

**Measurement integrity:** PZEM voltage, current, power, frequency and energy should be presented as measured values only when the ESP32 reports a valid meter reading (`pzem_valid`). The separately displayed `demand_w`, `connected_w`, and load-management limit are demonstration estimates/settings; they are not substitutes for measured electrical power or energy. Do not infer historical kWh from estimated demand.

## How to use Gridnova AI

1. **Prepare the hardware:** Verify the low-voltage modules, sensor connections and relay logic with AC mains disconnected. Qualified personnel must inspect any mains-powered installation before energizing it.
2. **Power the controller:** Start the ESP32 and confirm the OLED displays its operating state and the Wi-Fi connection becomes available.
3. **Open the dashboard:** Visit the deployed dashboard URL provided by the project administrator. Log in using the dashboard credentials. Do not enter the backend admin API key into the browser.
4. **Overview:** Confirm the device-online indicator and review temperature, load states, estimated demand, configured limit and any valid PZEM measurements.
5. **Live Monitoring:** Observe updates as telemetry arrives. An offline device or invalid meter reading must not be interpreted as a zero measurement.
6. **Load Control:** Use **Toggle Load 1** or **Toggle Load 2** to queue a command. Confirm the resulting state in new ESP32 telemetry and, during a supervised demonstration, visually verify the physical load.
7. **Automation:** Use **Toggle Auto Mode** to enable/disable the demonstration logic. Use **Set Limit 70 W**, **Set Limit 100 W**, or the **MSFLib Smart Threshold Configuration** form to set a whole-number estimated-demand limit from 1 to 999 W. Wait for the ESP32 to report the applied value.
8. **Demo Scenario:** Run the configured scenario to demonstrate threshold-based load management. Observe the event history and actual reported load states; behavior depends on current firmware configuration and operating conditions.
9. **Faults & Events:** Review timestamped alerts and operational events. Events reflect backend/device reporting and are not a certified fault diagnosis.
10. **Reports & Analytics:** Choose the supported period and format and download a report. Available history may be limited if the backend uses in-memory storage or has restarted; verify the report period and whether readings are measured or estimated.
11. **Sign out:** Select **Logout** in the dashboard sidebar. On shared computers, close the browser when finished.

## Technology stack

| Layer | Implementation |
| --- | --- |
| Edge hardware | ESP32 DevKit V1, DS18B20, PZEM-004T, OLED, relay module, LEDs and buzzer |
| Firmware | Arduino-compatible ESP32 firmware |
| API | Python FastAPI (standalone backend currently deployed) |
| Dashboard | React 19, TypeScript, Vite 8 |
| Production gateway | Node.js, Express, HttpOnly session cookie, server-side backend key |
| MSFLib | `@msflib/react-components` FormBuilder, event table and loading skeleton |
| Hosting | Render (backend and dashboard as separate services) |

### MSFLib integration

The dashboard uses MSFLib `FormBuilder` for custom threshold input and submission; a test change to **85 W** was confirmed by subsequent ESP32 telemetry. MSFLib table and skeleton components were also tested. Other MSFLib packages were installed or evaluated, but installation alone does not establish runtime integration. The production login uses an Express cookie-session gateway rather than MSFLib `react-auth`, because the existing backend's password-only authentication contract differs from the package's token-oriented email/password contract. See [`docs/GRIDNOVA_MSFLIB_DEVELOPER_EXPERIENCE.md`](docs/GRIDNOVA_MSFLIB_DEVELOPER_EXPERIENCE.md).

## Repository layout

The repository contains the dashboard, backend and public documentation. The exact backend directory may vary depending on the existing deployment layout.

```text
Gridnova_AI_Kodehouz/
├── gridsense-dashboard/          # React UI + production Express server
├── firmware/                     # Public firmware only if disclosure is permitted
├── docs/
│   ├── GRIDNOVA_SIMPLE_HARDWARE_CONNECTIONS.md
│   └── GRIDNOVA_MSFLIB_DEVELOPER_EXPERIENCE.md
└── README.md
```

**Publication policy:** Exact mains schematics, private hardware notes, Wi-Fi credentials, API keys, dashboard passwords and session secrets must not be committed. Firmware should be reviewed for secrets and intellectual-property disclosure before publication. Hackathon rules may require additional source disclosure; verify them before omitting required deliverables.

## Run the dashboard locally

Prerequisites: Node.js compatible with the project lockfile, npm, access to the running backend, and administrator-provided credentials.

```powershell
cd gridsense-dashboard
npm ci
npm run build
```

For the **production Express server** (not the Vite development proxy), configure these environment variables **in your current shell or deployment secret settings**, without writing actual values into tracked files:

- `GRIDNOVA_ADMIN_KEY` — existing backend administrator key.
- `GRIDNOVA_DASHBOARD_PASSWORD` — dashboard login password.
- `GRIDNOVA_SESSION_SECRET` — randomly generated secret at least 32 characters long.
- `NODE_ENV=production` — required when deployed over HTTPS so cookies use the secure attribute.
- `PORT` — optional; hosting provider usually supplies it.

Start the server:

```powershell
npm start
```

The Express service listens on the configured port (default `3000`) and serves the built dashboard and authenticated `/gridnova-proxy` routes. Its `/health` endpoint can be used for deployment checks. **Do not expose the Vite development server or its development-only API proxy publicly.**

## Deployment notes

Deploy the dashboard as a separate **Render Web Service** from the existing FastAPI backend:

- **Root directory:** `gridsense-dashboard` (if stored there in GitHub)
- **Build:** `npm ci && npm run build`
- **Start:** `npm start`
- **Environment:** `NODE_ENV=production` plus the three secret environment variables above
- **Health check:** `/health`

The backend API address is configured in `gridsense-dashboard/server.mjs`; verify it matches the active backend before deployment. The current implementation uses an in-memory session map; a restart invalidates sessions, and multiple replicas require shared session storage. Persistent telemetry/event storage is recommended for reliable long-term reporting.

**Security before publication:** Rotate any keys/passwords previously pasted into chats or terminals that were shared, and confirm no secrets appear in Git history. The current production gateway uses password-based access; add named users and role-based access before multi-user deployment.

## Testing checklist

- [ ] Production build succeeds.
- [ ] Unauthenticated API requests return 401.
- [ ] Login and logout work; refresh after logout stays unauthenticated.
- [ ] Device online/offline indicators reflect fresh telemetry.
- [ ] Temperature readings update.
- [ ] PZEM metrics are shown as measured only when valid.
- [ ] Load commands are acknowledged by new device telemetry.
- [ ] Physical relay behavior is verified safely and separately from software state.
- [ ] Threshold changes are confirmed from device telemetry.
- [ ] Event history and available report formats work.
- [ ] No secrets or detailed private wiring are published.

## Documentation

- [Simplified hardware connections](docs/GRIDNOVA_SIMPLE_HARDWARE_CONNECTIONS.md)
- [MSFLib integration and developer experience](docs/GRIDNOVA_MSFLIB_DEVELOPER_EXPERIENCE.md)

## Credits

**Team GridNova** — Gridnova AI hackathon prototype.

*Sense. Detect. Decide. Protect.*
