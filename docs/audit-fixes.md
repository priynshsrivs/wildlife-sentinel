# Reliability and security audit

This audit covers the repository's browser/API integration, authentication and development proxy, uploads, incident feedback and evidence, camera buffering, and dispatch lifecycle. It fixes the verified failures below. Passing tests does not prove the absence of every possible vulnerability.

## Verified findings and fixes

| Finding | Fix and regression coverage |
| --- | --- |
| Remote feeds requested `/api/api/cameras` and `/api/health`, which do not exist. | Correct camera/frame paths and the root health endpoint; actual browser integration checks reject the bad URL patterns. |
| Feedback sent `classification` and an unsupported `HARD_NEGATIVE` value, so valid-looking actions returned 422. | Send the existing `feedback_type` contract and supported categories. False positives use the backend's existing hard-negative export behavior. Errors are shown and retries remain available. |
| Feedback manager captured the original database instead of the active repository. | Resolve the store at call time with a write transaction; test verifies the feedback lands in the active isolated database. |
| Evidence image references were read from serialized alerts after serialization removed them. | Resolve images directly from storage with the same containment checks as protected image serving; real browser test verifies a false-positive image export. |
| Export filenames incorporated an alert ID directly. | Use a deterministic SHA-256 filename so legacy or unexpected IDs cannot escape the collection directory. |
| Explanation endpoint accessed removed latitude/longitude keys and could fail with 500. | Read the serialized `location` contract; API tests exercise actual persisted incidents. |
| Explanation UI fabricated rationale, health, uncertainty, model traces and evidence on errors or missing fields. | Render recorded server data and explicit unavailable/error states. The endpoint no longer invents historical thresholds, confirmed frame ratios or escalation details. Zero confidence remains zero. |
| Explanation overlay could appear behind the header. | Render it through a document portal with bounded scrolling, focus containment, Escape handling and focus restoration. Browser tests exercise keyboard dismissal. |
| Viewer/operator interfaces offered actions their roles could not perform. | Use the verified sign-in role to disable uploads, resolution, feedback, settings and clearing at the appropriate permission boundary. Backend RBAC remains authoritative. |
| Expired sessions could keep polling and reconnecting; sign-out left in-flight work alive. | Invalidate credentials on 401, abort session requests, close registered sockets, and return to sign-in. Unit and browser tests cover expiration and sign-out cancellation. |
| A late HTTP refresh could erase an alert received over WebSocket. | Guard snapshots by request/alert revisions; browser test holds an old real API snapshot while injecting a real new incident and verifies it survives. |
| Missing timestamps or malformed realtime objects could crash sorting; resolution updates were labeled as new threats. | Validate incoming objects, tolerate absent timestamps, sort by latest observation and distinguish resolution notifications. |
| Rejected uploads had only a generic error; valid AVI browser MIME variants were rejected. | Show actual backend errors, check empty/oversized files before upload, and accept common AVI MIME aliases while retaining signature/decoded-content validation. Real browser tests use genuine image/video/audio files. |
| ROI-tagged model output violated the strict detection schema. | Add a bounded, validated `matched_rois` field; API regression verifies persistence. |
| Remote inference repeatedly consumed the same captured frame, including stale frames. | Consume each buffered frame once, reject frames older than 10 seconds, and derive inference cadence from the persisted alert severity. |
| Motion/tracking state was shared across camera feeds. | Maintain bounded per-camera state and serialize pipeline mutations; regression verifies one camera's static background cannot suppress another's first frame. Video inference now receives its camera ID and geofence context. Wildlife-monitoring mode retains wildlife sightings. |
| Arbitrary WebSocket origins were rewritten into a trusted origin by the local development proxy. | Bind locally, verify local same-origin requests before proxying, then translate the validated origin. Test rejects a foreign-origin upgrade before it reaches the upstream. See [Vite's WebSocket origin guidance](https://vite.dev/config/server-options#server-proxy). |
| Malformed credentials/ACKs or binary WebSocket messages could produce server errors; ticket issuance was unsynchronized. | Bound and validate tokens/messages, accept bearer scheme casing, serialize ticket issue/consume operations, and cap concurrent socket connections. Tests cover malformed input and single-use tickets. |
| Viewer uploads could reach multipart parsing before permission rejection. | Reject viewer inference/telemetry POST requests in the authentication middleware before parsing their bodies. |
| Resolved incidents could retain pending notifications. | Cancel unsent outbox entries during resolution and skip resolved incidents during dispatch. Notifications already in flight cannot be recalled. |
| Launcher printed the administrator credential. | Refer users to their local configuration file without displaying its contents. |
| Frontend lockfile contained vulnerable `brace-expansion` and `source-map-js` versions. | Update to patched compatible releases. `npm audit` reports zero known vulnerabilities for the resulting lockfile. Advisories: [brace-expansion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p), [source-map-js](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |

## Run the checks

Use Python 3.13 and Node 24 with the repository dependencies installed. Run backend tests against isolated storage so imports cannot initialize a real deployment database. For example, in PowerShell:

```powershell
$env:DATA_DIR = Join-Path $env:TEMP 'wildlife-audit-test-data'
$env:DATABASE_PATH = Join-Path $env:TEMP 'wildlife-audit-test.db'
python -m pytest -q
```

Frontend checks:

```sh
cd frontend
npm ci
npm run lint
npm test
npm run build
npm audit
npm run test:browser
```

The browser test starts a separate backend and Vite server on available loopback ports. It uses the real API implementation and temporary storage, with deterministic model/audio fixtures and test-only credentials confined to that process. It does not modify a running deployment or contact Discord. Windows uses installed Edge; on other systems install Chromium with `npx playwright install chromium`. Set `PYTHON` if the backend dependencies are in a particular virtual environment. Temporary test data is retained under the printed audit directory for inspection.

The browser test covers image/video/audio ingestion, actual feedback and export contracts, evidence and failure states, HTTP/WebSocket races, resolution, settings, session expiry, viewer/operator permissions and all nine tabs at 1440, 390 and 320 px. It uses synthetic camera input. It does not validate real model accuracy, physical camera/network performance, actual Discord delivery or ESP32 behavior. No ESP32 firmware/listener is present in this repository.

Final verification: **172 backend tests passed, one model-dependent test skipped; nine frontend/proxy tests passed; the real-backend browser integration suite passed; frontend lint/build and Python undefined/unused-name checks passed.**

The pinned direct Python requirements were checked with `pip-audit --no-deps --disable-pip -r backend/requirements.txt`; no known vulnerabilities were reported for those direct pins. This is not a complete transitive dependency audit. Vite's existing large-chunk advisory and a test-client deprecation warning remain informational.

## Applying backend changes

The running backend observed during this audit uses `D:\AI\wildlife-sentinel`, while this chat's updated checkout is under the Wildlife Sentinel workspace. Repository fixes do not hot-reload that separate running process. Apply the reviewed update to the deployment checkout and restart its backend using its existing configuration. Preserve its `.env`, database, model weights and camera configuration. The audit deliberately leaves that deployment's files and data untouched.
