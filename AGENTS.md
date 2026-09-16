# AGENTS.md — System & Development Guide for AI Assistants
> **Vigil AI Smart Security & IoT Face Recognition System**  
> Main Entry Point and Technical Reference for AI Coding Agents.

---

## 1. System Identity & Mission

**Vigil** is an end-to-end intelligent IoT security and facial recognition platform. It integrates:
1. **IoT Edge Node**: ESP32-S3 AI Camera (OV3660 sensor) streaming live video and snapshots.
2. **AI Inference Pipeline**: Ultralytics YOLOv8 for person detection + MobileNetV3 (576-dim L2-normalized metric learning) for facial classification.
3. **Backend Server**: FastAPI with SQLite (`vigil.db`) and SQLAlchemy 2.0 ORM with JWT authentication.
4. **Web Frontend**: Modern React 19 dashboard styled with Tailwind CSS v4 (Peach & Cream theme palette).

The system classifies individuals into **3 Categories**:
- `household` (🟢 Green): Recognized family members / residents.
- `delivery` (🟡 Amber): Delivery couriers (Flash, Kerry, Grab) or registered couriers.
- `stranger` (🔴 Red): Unidentified individuals triggering automatic security alerts.

---

## 2. Repository Layout

```text
web-iot/
├── AGENTS.md                 # Primary AI Entry Point (this document)
├── README.md                 # Human-facing project overview and quickstart
├── docs/                     # Full technical documentation suite
│   ├── architecture.md       # High-level architecture, 3 categories, data flow, tech stack
│   ├── backend-api.md        # FastAPI architecture, SQLite schema (4 tables), REST API specs
│   ├── ai-vision.md          # YOLOv8 + MobileNetV3 Metric Learning, Face Embeddings & Training
│   ├── frontend.md           # React 19 architecture, 7 pages specification, real-time audio & theme
│   └── hardware-iot.md       # ESP32-S3 OV3660 Camera, Arduino code, streaming & fallback
├── backend/                  # FastAPI Application
│   ├── run.py                # Server entry point
│   ├── requirements.txt      # Python dependencies
│   ├── .env                  # Configuration variables
│   ├── data/                 # SQLite database (vigil.db), datasets, snapshots, face_embeddings.json
│   └── app/
│       ├── main.py           # FastAPI initialization and middleware
│       ├── core/             # config.py, database.py, security.py
│       ├── models/           # user.py, person.py, detection_history.py, alert.py
│       ├── schemas/          # Pydantic models for validation
│       ├── services/         # yolo_service.py, face_embedding_service.py, person_classifier.py
│       └── api/v1/endpoints/ # auth.py, detection.py, alerts.py, persons.py
├── frontend/                 # React 19 Application
│   ├── package.json          # Dependencies & build scripts
│   ├── vite.config.js        # Vite configuration
│   └── src/
│       ├── main.jsx          # App entry point
│       ├── index.css         # Tailwind v4 theme tokens
│       ├── routes/routes.tsx # Data router with Protected/Guest guards
│       ├── context/          # AuthContext, DetectionContext (24/7 background camera runner)
│       ├── components/       # layout (Navbar, Footer, MainLayout), guards, common UI (GlobalAlertToast)
│       ├── pages/            # detection, training, history, add-person, alerts, auth, landing
│       └── services/api.js   # Axios API client
└── esp32_camera_capture/     # Arduino C++ firmware for DFRobot ESP32-S3 (OV3660)
    └── esp32_camera_capture.ino
```

---

## 3. Documentation Sitemap

When investigating or implementing features, refer to the corresponding specialized documentation:

| Document | Key Contents | Primary Use Cases |
| :--- | :--- | :--- |
| **[docs/architecture.md](docs/architecture.md)** | End-to-end data flow, 3 categories, sequence diagrams | Understanding overall system interactions and categorization logic |
| **[docs/backend-api.md](docs/backend-api.md)** | All 4 database schemas, all REST endpoints, FK safety, auth | Modifying backend routes, database models, or API contracts |
| **[docs/ai-vision.md](docs/ai-vision.md)** | YOLOv8 + MobileNetV3 576-dim L2 embeddings, centroid math | Adjusting face matching threshold, training pipeline, or embeddings |
| **[docs/frontend.md](docs/frontend.md)** | 7 page specs, `isDetectingRef` pattern, Web Audio chimes, theme | Modifying UI components, navigation, styling, or real-time detection |
| **[docs/hardware-iot.md](docs/hardware-iot.md)** | ESP32-S3 pinout, Arduino flashing, `/stream`, proxy & fallback | Working with camera firmware, Wi-Fi connectivity, or video streaming |

---

## 4. Critical Invariants & Rules for AI Agents

When reading or modifying code in this repository, you **MUST** uphold the following rules:

### 4.1 Frontend Navigation Order
The navigation bar ([Navbar.jsx](frontend/src/components/layout/Navbar.jsx)) and router ([routes.tsx](frontend/src/routes/routes.tsx)) must maintain this strict order:
1. **Live Detection** (`/detection`)
2. **Training & DB** (`/training`)
3. **History** (`/history`)
4. **Alerts** (`/alerts`)

### 4.2 Continuous Auto-Detection (`isDetectingRef`)
In [DetectionPage.jsx](frontend/src/pages/detection/DetectionPage.jsx), the timer interval MUST NOT depend on standard state in its dependency array. Always maintain the `isDetectingRef = useRef(false)` guard pattern to prevent timer teardown and continuous detection freezing.

### 4.3 Database Foreign Key Safety
When deleting detection history records in [detection.py](backend/app/api/v1/endpoints/detection.py), always unlink `alerts.detection_id = None` prior to executing the delete statement. This avoids SQLite FK constraint violations while preserving security alert logs.

### 4.4 Face Embeddings & Centroid Normalization
In [face_embedding_service.py](backend/app/services/face_embedding_service.py), all face vectors MUST be 576-dimensional and $L_2$-normalized (`norm == 1.0`). Centroid calculation must normalize after computing the sum vector. The cosine similarity matching threshold is calibrated at `0.58`.

### 4.5 Real-Time Badge Sync
Whenever alerts are read or deleted, always dispatch `window.dispatchEvent(new CustomEvent("vigil-alerts-updated"))` so that the Navbar unread badge updates immediately without page reloads.

### 4.6 Windows Shell Execution
On Windows systems where PowerShell execution policy may restrict scripts, execute npm/vite commands using `cmd /c` (e.g. `cmd.exe /c "npm run dev"` or `cmd.exe /c "npm run build"`).

### 4.7 Mandatory Documentation Synchronization (`docs/`)
Whenever any change, refactoring, feature addition, or bug fix is made to any file in the repository (Frontend, Backend, Database Models, API Routes, AI Pipeline, or Hardware Firmware), AI agents **MUST ALWAYS** update the corresponding documentation file(s) in `docs/` immediately to reflect the changes:
- **Backend Changes** (API endpoints, SQLAlchemy models, Pydantic schemas, Auth, DB queries) $\rightarrow$ Update [docs/backend-api.md](docs/backend-api.md)
- **AI & Vision Changes** (YOLOv8 logic, MobileNetV3 embeddings, centroid formulas, training endpoints) $\rightarrow$ Update [docs/ai-vision.md](docs/ai-vision.md)
- **Frontend Changes** (Components, pages, routes, CSS tokens, hooks, audio synthesizers) $\rightarrow$ Update [docs/frontend.md](docs/frontend.md)
- **Hardware / IoT Changes** (ESP32-S3 firmware, Arduino endpoints, stream/capture logic, proxy) $\rightarrow$ Update [docs/hardware-iot.md](docs/hardware-iot.md)
- **Architecture & System Changes** (Categorization criteria, data flow, security policy) $\rightarrow$ Update [docs/architecture.md](docs/architecture.md)

### 4.8 Persistent Background AI Camera Detection & Global Alerting (`DetectionContext`)
The camera surveillance and AI face recognition pipeline operates continuously 24/7 across all pages of the web dashboard, ensuring instant notifications even when navigating outside `/detection`:
- **Context Architecture**: The detection loop, camera state, and alert monitoring are globally managed by `DetectionContext` ([DetectionContext.jsx](frontend/src/context/DetectionContext.jsx)) mounted at [MainLayout.jsx](frontend/src/components/layout/MainLayout.jsx). Navigating to `/training`, `/history`, `/alerts`, or `/add-person` never tears down the surveillance loop.
- **Persistent Off-Screen Stream Element (`vigil-persistent-stream-img`)**:
  - `DetectionProvider` maintains a hidden stream element (`<img id="vigil-persistent-stream-img" ... />`) in the DOM at all times.
  - When outside `/detection` (where the main `#esp32-stream-img` is unmounted), the background detection loop seamlessly grabs frames from `#vigil-persistent-stream-img` using HTML5 Canvas and calls `POST /api/v1/detection/detect-image`.
  - If canvas frame grabbing is unavailable, it gracefully falls back to `POST /api/v1/detection/detect-esp32` (FastAPI backend proxy grab).
- **Dual-Trigger Instant Notification System**:
  1. **Direct Detection Trigger**: As soon as `runDetection()` receives a positive identification (`stranger` or `delivery`), it immediately invokes `playAlertChime()` and sets `alertNotification` state.
  2. **SQLite Alert Poller Trigger (`syncUnreadAlerts`)**: Every 4 seconds, `DetectionContext` queries `GET /api/v1/alerts?unread_only=true&limit=1`. If a new alert record is created in SQLite (via local detection, backend workers, or proxy), it immediately sounds the alarm, triggers `GlobalAlertToast`, and dispatches `vigil-alerts-updated`.
- **Audio Autoplay & Desktop Notification Compliance**:
  - `playAlertChime()` automatically calls `ctx.resume()` if the browser's `AudioContext` is in a `"suspended"` state.
  - Generates HTML5 Web Desktop Notifications (`window.Notification`) when permission is granted.
- **Global Alert UI (`GlobalAlertToast.jsx`)**:
  - When on non-detection pages, detections float an interactive toast at the top-right corner with direct quick-action links to `/alerts` or `/detection`.
- **Page Synchronization (`DetectionPage.jsx`)**:
  - In Live Detection view, the component consumes `useDetection()` for stream state and active detections. It uses `fetchStatsAndHistory()` to refresh visitor history and statistics cards without spawning redundant background intervals.

---

## 5. Quick Reference: Key Files & Symbols

| Component | Path | Key Responsibility |
| :--- | :--- | :--- |
| **Detection Provider** | `frontend/src/context/DetectionContext.jsx` | 24/7 background camera loop, Web Audio synthesizer, global alert state |
| **Global Alert Toast** | `frontend/src/components/common/GlobalAlertToast.jsx`| Actionable floating toast for background detections on all pages |
| **Detection Endpoint** | `backend/app/api/v1/endpoints/detection.py` | ESP32 frame grab, canvas detect, history delete & FK safety |
| **Face Training Endpoint** | `backend/app/api/v1/endpoints/persons.py` | Model status, real-time retraining, face registration |
| **Alerts Endpoint** | `backend/app/api/v1/endpoints/alerts.py` | Alert listing, unread count, bulk clear, single delete |
| **Classifier Engine** | `backend/app/services/person_classifier.py` | 3-category evaluation and automatic alert creation |
| **Embedding Extractor** | `backend/app/services/face_embedding_service.py`| MobileNetV3 576-dim L2 vector extraction |
| **Navbar Component** | `frontend/src/components/layout/Navbar.jsx` | Navigation pills, real-time alert badge, live camera 24/7 indicator |
| **Data Router** | `frontend/src/routes/routes.tsx` | Protected routes and authentication redirects |
| **API Service Client** | `frontend/src/services/api.js` | Axios client with JWT interceptors |
| **Design Tokens** | `frontend/src/index.css` | Peach & Cream Tailwind v4 color scheme |
| **Arduino Firmware** | `esp32_camera_capture/esp32_camera_capture.ino` | ESP32-S3 MJPEG streaming & capture server |
