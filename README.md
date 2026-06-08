# ☁️ CloudScope — Cloud Logging & Monitoring Dashboard
### MMC452 Technical Seminar Project | RV Institute of Technology and Management

---

## 🗂️ Project Structure

```
cloud-monitor/
├── backend/
│   ├── app.py              ← Flask API server
│   └── requirements.txt    ← Python dependencies
└── frontend/
    ├── src/
    │   └── App.jsx         ← React dashboard
    ├── package.json
    └── index.html
```

---

## 🚀 How to Run

### Step 1 — Backend (Python + Flask)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the server
python app.py
```

Backend runs at: **http://localhost:5000**

---

### Step 2 — Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## 📡 API Endpoints

| Method | Endpoint                    | Description                      |
|--------|-----------------------------|----------------------------------|
| GET    | /api/logs                   | Get all recent logs              |
| GET    | /api/logs/<level>           | Filter logs by level             |
| GET    | /api/metrics                | Current + historical metrics     |
| GET    | /api/alerts                 | All alerts                       |
| POST   | /api/alerts/<id>/resolve    | Resolve an alert                 |
| GET    | /api/health                 | System health status             |
| GET    | /api/summary                | Log count summary by level       |

---

## ✨ Features

- 📊 **Real-time metrics** — CPU, Memory, Disk, Requests/sec, Error Rate
- 📋 **Live log stream** — Auto-updating with 200 entries
- 🔍 **Log filtering** — Filter by level (INFO/WARNING/ERROR/DEBUG) + search
- 🚨 **Smart alerts** — Auto-triggered when CPU > 85%, Memory > 80%, Error Rate > 10%
- ✅ **Alert resolution** — Resolve alerts from the dashboard
- 🟢 **Service health** — Monitor 6 cloud microservices
- 📈 **Charts** — Area charts & line charts for all metrics

---

## 🛠️ Tech Stack

| Layer    | Technology        |
|----------|-------------------|
| Backend  | Python + Flask    |
| Frontend | React + Recharts  |
| Styling  | Inline CSS (React)|
| Charts   | Recharts          |
| Real-time| Polling (1.5s)    |
