## Setup and Running Instructions

### Prerequisites

**Docker (recommended)**
- Docker Desktop (or Docker Engine) + Docker Compose

**Local dev (no Docker)**
- Node.js: **24.x** or newer
- npm: **11.x** or newer (comes with Node 24+)

### Installation

```bash
# Clone the repository
git clone https://github.com/sharmakunal23/distributed-text-processing-with-opentelemetry.git
cd distributed-text-processing-with-opentelemetry
```

---

## Running the Application

### Option A: Docker (recommended)

Runs: **edge nginx + client UI + 3x backend servers + otel-collector + redpanda + redpanda-console**

```bash
docker compose up -d --build --force-recreate --scale server=3
```

Access:
- App: http://localhost:8080
- Redpanda Console (Kafka UI): http://localhost:8081
   - To view traces in JSON format: http://localhost:8081 -> Topics -> otel-traces-json

Stop:
```bash
docker compose down -v --rmi all --remove-orphans
```

### Option B: Local dev (no Docker)

Runs the client and server as **two local processes** (via a single command):

```bash
npm install && npm run dev
```

Access:
- Client: http://localhost:5173
- Server: http://localhost:3000

> Note: In non-docker mode, traces default to the **browser console** and **server console**.
> For the Kafka/collector pipeline, use Docker mode.

---

## Testing OpenTelemetry Output

### 1) Confirm trace correlation (client → server)

1. Open the app.
2. Open DevTools → **Network**.
3. Submit text in the UI.
4. Click either request (`/api/length` or `/api/num_vowels`) and confirm the request includes a header like:
   - `traceparent: 00-<traceId>-<spanId>-01`
5. Confirm the response includes:
   - `x-trace-id: <traceId>` (this should match the `<traceId>` inside `traceparent`)
   - `x-processing-ms`, `x-backend-instance`, `x-cache`

### 2) Confirm traces are hitting the Collector

```bash
docker compose logs -f otel-collector
```

You should see trace activity from the Collector’s **`debug` exporter**.

### 3) Confirm traces are being written to Kafka (Redpanda)

- Open Redpanda Console at http://localhost:8081
- Look for the topic: `otel-traces-json`

---

## Developer’s Choice Enhancement

### Enhancement: Event-driven observability pipeline + scalable backend processing

**Description:**
- Traces are exported from client/server to an **OpenTelemetry Collector** and then published to **Kafka (Redpanda)**.
- Backend processing for vowel counting uses a **worker thread pool** and chunks text for throughput.
- Nginx load-balances across multiple backend instances.
- A simple in-memory **rate limiter** and **LRU cache** help protect the server and reduce repeat work.

**Rationale:**
- Kafka decouples application code from the observability backend and provides buffering/backpressure for production-like resilience.
- Worker threads allow CPU-heavy text scanning to scale better per instance without blocking the Node event loop.
- Load balancing demonstrates horizontal scaling and instance-level variance.
- Rate limiting reduces blast radius from a single noisy client.

**Implementation Notes:**
- Trace correlation uses W3C `traceparent` propagation; the server extracts context and echoes `x-trace-id` so the UI can verify correlation quickly.
- Traces are exported in OTLP Protobuf for efficiency; a downstream consumer/collector would typically decode and ship to a tracing backend (Tempo/Jaeger/vendor).

---

## Technology Stack

- Client-side:
   - React + Vite
   - OpenTelemetry Web SDK + Fetch/XHR instrumentation
- Server-side:
   - Node.js 24 + Express
   - Worker threads (pool) for chunk processing
   - Rate limiting + in-memory caching
- OpenTelemetry:
   - Server: OpenTelemetry Node SDK + auto-instrumentations
   - Export: OTLP (to Collector)
   - Collector: OTLP receiver + batch/memory_limiter processors + Kafka exporter
- Infra (Docker mode):
   - Nginx (reverse proxy + load balancer + OTLP proxy)
   - Redpanda (Kafka-compatible broker) + Redpanda Console

---

## API Documentation

### Endpoints

#### `POST /length`

- **Request body**
  ```json
  { "text": "inputText" }
  ```

- **Response body**
  ```json
  { "length": 9 }
  ```

- **Response headers (debug/verification)**
   - `x-trace-id`
   - `x-processing-ms`
   - `x-backend-instance`
   - `x-cache`

#### `POST /num_vowels`

Counts vowels (a, e, i, o, u; case-insensitive).

- **Request body**
  ```json
  { "text": "inputText" }
  ```

- **Response body**
  ```json
  { "vowel_count": 2 }
  ```

- **Response headers (debug/verification)**
   - `x-trace-id`
   - `x-processing-ms`
   - `x-backend-instance`
   - `x-cache`