### This repo is a full-stack JavaScript (browser + Node.js) demo that:
- Takes a large text input (up to 1,048,576 characters)
- Makes **two concurrent** API calls: `/length` and `/num_vowels`
- Correlates client/server traces via W3C `traceparent`
- Ships traces to an **OpenTelemetry Collector**, which exports to a Kafka-compatible stream (**Redpanda**) for decoupling
- Runs multiple backend instances behind **Nginx** (load balancer / reverse proxy)
- Uses a **worker thread pool** on each backend instance to process large texts in chunks
- Adds a simple **in-memory rate limiter** and an **LRU cache** (for smaller inputs) on the backend

---

## Quick start (Docker - recommended)

### Prereqs
- Docker + Docker Compose

### Run everything (client + edge nginx + 3 backend instances + collector + redpanda + console)
```bash
docker compose up -d --build --force-recreate --scale server=3
```

### Open the UI
- App: http://localhost:8080
- Redpanda Console (Kafka UI): http://localhost:8081
   - To view traces in JSON format: http://localhost:8081 -> Topics -> otel-traces-json

### Stop & clean up
```bash
docker compose down -v --rmi all --remove-orphans
```

---

## Local dev (no Docker)

### Prereqs
- Node.js 24+

### Install deps
```bash
npm install
```

### Start client + server (two processes)
```bash
npm run dev
```

Open:
- Client: http://localhost:5173
- Server: http://localhost:3000

> Note: In non-docker mode, traces default to the browser console and server console.
> For the Kafka/collector pipeline, run Docker mode.

---

## Useful verification steps

### 1) Confirm trace correlation (client -> server)
1. Open DevTools Console in the browser.
2. Submit text in the UI.
3. You should see a trace id displayed per request in the UI (client + server header echo).
4. Server responses also include:
    - `x-trace-id`
    - `x-processing-ms`
    - `x-backend-instance` (useful to see Nginx load balancing)

### 2) Confirm traces are hitting the collector
```bash
docker compose logs -f otel-collector
```
You should see `logging` exporter output for spans.

### 3) Confirm traces are in Kafka (Redpanda)
Open Redpanda Console at http://localhost:8081 and look for topic:
- `otel-traces`

---

## Configuration knobs

### Backend (server)
Environment variables (see `docker-compose.yml`):
- `CHUNK_SIZE` (default: 65536)
- `WORKER_THREADS` (default: CPU count)
- `RATE_LIMIT_POINTS` (default: 20)
- `RATE_LIMIT_DURATION` (default: 1)
- `CACHE_MAX_TEXT_CHARS` (default: 100000)
- `CACHE_TTL_MS` (default: 60000)

### OpenTelemetry
- Client exports to `/otlp/v1/traces` (proxied by Nginx to the collector)
- Server exports to the collector via OTLP/HTTP

---

## Project layout
```
.
├── client/                 # Vite + React browser app + OTel web SDK
├── server/                 # Node.js + Express API + OTel Node SDK + worker pool
├── nginx/                  # Edge reverse proxy + load balancer + OTLP proxy
├── otel-collector/         # Collector pipeline -> Kafka topic (otel-traces)
└── docker-compose.yml
```
