# Wildlife Sentinel interface refresh

The command center keeps the forest-green identity and existing wildlife assets, with a quieter workspace background, clearer typography, consistent surfaces, and responsive layouts. Illustrative imagery is labeled separately from live telemetry. Backend availability and WebSocket connectivity are reported independently; the unresolved count describes the currently loaded feed.

## Changed files

| Files | Change |
| --- | --- |
| `frontend/src/App.jsx` | Updated shell, accessible navigation, working mobile menu, labeled header actions, dashboard shortcuts and live-status props. Existing API handlers and tab identifiers are preserved. |
| `frontend/src/App.css`, `index.css`, `main.jsx` | Shared styling, stylesheet imports, responsive breakpoints, keyboard focus, reduced CSS motion, and removal of unused Vite starter styling. |
| `frontend/src/constants/theme.js` | Forest surfaces and more readable secondary text. |
| `frontend/src/components/AuthGate.jsx` | Responsive sign-in presentation and sign-out control; token verification and in-memory storage remain unchanged. |
| `frontend/src/components/GlassButton.jsx` | Consistent interactive styling and forwarding of standard button attributes, including accessible labels. |
| `frontend/src/components/SectionHeader.jsx`, `StatCard.jsx`, `StatusBadge.jsx` | Consistent section headings, summary cards and connection pills. Section headers now render the existing optional action prop. |
| `frontend/src/components/SeverityBadge.jsx` | Shared critical, high, monitored, low and resolved styling, with text labels as well as color. |
| `frontend/src/pages/DashboardPage.jsx` | Redesigned overview, illustrative carousel, service status, shortcuts and clickable recent telemetry. |
| `frontend/src/pages/AlertsPage.jsx` | Severity rails and badges, resolved styling, responsive ranger actions and clearer empty state. Resolution, explanation and feedback handlers are preserved. |
| `frontend/src/pages/CameraPage.jsx` | Camera standby state, image/video/audio ingestion cards, responsive preview/results layout and upload status announcement. |
| `frontend/src/pages/CamerasPage.jsx` | Responsive camera detail grid using shared card styling. |
| `frontend/src/pages/MonitoringPage.jsx`, `SettingsPage.jsx` | Accessible labels for existing stream and settings controls. Shared styles apply to these pages. |
| `frontend/src/pages/BenchmarkPage.jsx` | Existing lint cleanup, visible loading state and refresh action through the shared section header. Polling endpoints and cadence are preserved. |

The reserve map, analytics, landing experience, protected evidence fetching, authenticated HTTP client, WebSocket tickets/ACK handling, alert merging, backend code and hardware scripts retain their contracts. Resolve still uses the same backend endpoint, so hardware listeners observe the same resolved state.

## Run locally

Use Node.js 24, as required by the existing frontend package.

```sh
cd frontend
npm ci
```

Copy `.env.example` to `.env` if needed. Leave `VITE_API_BASE` empty during local development: Vite forwards API and WebSocket requests to port 8000, including when the frontend uses an alternate port. The WebSocket proxy presents the canonical local frontend origin (5173) to the backend. For a separately hosted API, set its absolute URL and configure the backend to allow your frontend origin. Production keeps the existing default API address. Start the backend and other services using the root README, then run:

```sh
npm run dev
```

Open the URL printed by Vite, sign in using your administrator-supplied role token, then choose **Enter Sentinel**. Authentication behavior is unchanged.

## Checks

```sh
cd frontend
npm run lint
npm test
npm run build
```

All three commands passed. The four existing tests cover credential scoping, unsuccessful HTTP responses, one-use WebSocket tickets and alert deduplication. Vite still reports its advisory about a main JavaScript chunk exceeding 500 kB.

Additional headless Edge checks used simulated API responses at desktop (1440 px) and phone widths (390 px and 320 px): sign-in rejection/success, all nine workspace tabs, image/video/audio ingestion requests, severity filters, resolution, explanation, ranger feedback, settings writes, WebSocket new/update events, mobile menu, shortcuts and sign-out. Desktop and mobile screenshots were inspected. Simulated responses were confined to the test browser; no authentication or API bypass was added to the application.

These checks validate the UI and request contracts. A live camera, microphone, model server, ESP32 buzzer and Discord delivery were not available for an end-to-end field test. Verify those against your running services using the existing project setup.

The subsequent [reliability/security audit](audit-fixes.md) adds real-backend browser integration tests and fixes feedback, evidence, permissions, session cleanup, camera buffering and proxy validation. Its verification notes supersede the initial four-test and simulated-API coverage above.
