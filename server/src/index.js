require("./otel");

const logger = require('./logger');

const os = require("node:os");
const process = require("node:process");

const express = require("express");
const { trace, context } = require("@opentelemetry/api");

const { pool, maxThreads } = require("./workerPool");
const { rateLimitMiddleware } = require("./rateLimit");
const { cache, cacheKey } = require("./cache");

const PORT = Number(process.env.PORT || 3000);
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || 262144); // 256 KiB
const MAX_TEXT_CHARS = 1024 * 1024; // 1,048,576

const tracer = trace.getTracer("text-api");

function nowMs() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function chunkString(str, chunkSize) {
  const chunks = [];
  for (let i = 0; i < str.length; i += chunkSize) {
    chunks.push(str.slice(i, i + chunkSize));
  }
  return chunks;
}

async function computeDistributed(op, text) {
  const chunks = chunkString(text, CHUNK_SIZE);
  const span = tracer.startSpan(`compute.${op}`, {
    attributes: {
      "app.text_length": text.length,
      "app.chunk_size": CHUNK_SIZE,
      "app.chunks": chunks.length,
      "app.worker_threads": maxThreads,
    },
  });

  try {
    return await context.with(trace.setSpan(context.active(), span), async () => {
      const tasks = chunks.map((c) => pool.run({ op, text: c }));
      const parts = await Promise.all(tasks);
      return parts.reduce((a, b) => a + b, 0);
    });
  } finally {
    span.end();
  }
}

const app = express();
if (TRUST_PROXY) app.set("trust proxy", 1);

// Keep JSON parsing tight for performance + safety
app.use(express.json({ limit: "2mb" }));

// Basic protection against single-client surges (per-instance; behind Nginx)
app.use(rateLimitMiddleware);

// Health
app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/length", async (req, res) => {
  const start = nowMs();
  const text = (req.body && req.body.text) || "";

  if (typeof text !== "string") return res.status(400).json({ error: "text must be a string" });
  if (text.length > MAX_TEXT_CHARS) return res.status(413).json({ error: "text too large" });

  // For length, the fastest path is text.length.
  // (Worker distribution for length is optional, but typically unnecessary.)
  const length = text.length;

  const activeSpan = trace.getSpan(context.active());
  const traceId = activeSpan?.spanContext().traceId;

  res.setHeader("x-trace-id", traceId || "");
  res.setHeader("x-backend-instance", `${os.hostname()}:${process.pid}`);
  res.setHeader("x-processing-ms", String(nowMs() - start));
  res.setHeader("x-cache", "ByPass");

  return res.json({ length });
});

app.post("/num_vowels", async (req, res) => {
  const start = nowMs();
  const text = (req.body && req.body.text) || "";

  if (typeof text !== "string") return res.status(400).json({ error: "text must be a string" });
  if (text.length > MAX_TEXT_CHARS) return res.status(413).json({ error: "text too large" });

  // Small-input caching (skip hashing for huge texts)
  const key = cacheKey("num_vowels", text);
  if (key) {
    const cached = cache.get(key);
    if (cached !== undefined) {
      const activeSpan = trace.getSpan(context.active());
      const traceId = activeSpan?.spanContext().traceId;

      res.setHeader("x-trace-id", traceId || "");
      res.setHeader("x-backend-instance", `${os.hostname()}:${process.pid}`);
      res.setHeader("x-processing-ms", String(nowMs() - start));
      res.setHeader("x-cache", "HIT");

      return res.json({ vowel_count: cached });
    }
  }

  // Distributed chunk processing via worker threads
  const vowelCount = await computeDistributed("vowels", text);

  if (key) cache.set(key, vowelCount);

  const activeSpan = trace.getSpan(context.active());
  const traceId = activeSpan?.spanContext().traceId;

  res.setHeader("x-trace-id", traceId || "");
  res.setHeader("x-backend-instance", `${os.hostname()}:${process.pid}`);
  res.setHeader("x-processing-ms", String(nowMs() - start));
  res.setHeader("x-cache", "MISS");

  return res.json({ vowel_count: vowelCount });
});

function start() {
  return app.listen(PORT, () => {
    logger.info(
        { port: PORT, chunk_size: CHUNK_SIZE, max_text: MAX_TEXT_CHARS, workers: maxThreads },
        "server listening"
    );
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, start };