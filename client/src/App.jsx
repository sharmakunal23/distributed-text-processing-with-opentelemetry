import "./otel";
import React, { useMemo, useState } from "react";
import { context, trace, propagation } from "@opentelemetry/api";

const MAX_CHARS = 1024 * 1024;

async function postJson(url, payload, extraHeaders = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...extraHeaders },
    body: JSON.stringify(payload),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error || body?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return { body, headers: res.headers };
}

export default function App() {
  const [text, setText] = useState("Type or paste text here…");
  const [error, setError] = useState(null);

  const [lengthResult, setLengthResult] = useState(null);
  const [vowelResult, setVowelResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const charCount = text.length;
  const tooLarge = charCount > MAX_CHARS;

  const tracer = useMemo(() => trace.getTracer("ui"), []);

  async function callEndpoint(label, url) {
    const start = performance.now();

    const span = tracer.startSpan(`ui.call.${label}`, {
      attributes: {
        "app.text_length": charCount,
        "http.url": url,
      },
    });

    try {
      const ctx = trace.setSpan(context.active(), span);

      // Inject headers from *this span's context*
      const otelHeaders = {};
      propagation.inject(ctx, otelHeaders, {
        set: (carrier, key, value) => {
          // normalize for easy access + fetch header casing
          carrier[key.toLowerCase()] = value;
        },
      });

      // Show exactly what we send to the backend
      const clientTraceparent = otelHeaders["traceparent"] || "";
      // W3C format: 00-<traceId>-<spanId>-01
      const clientTraceIdFromHeader = clientTraceparent.split("-")[1] || "";

      // If for some reason traceparent isn't present, fallback to spanContext
      const clientTraceId = clientTraceIdFromHeader || span.spanContext().traceId || "";

      const { body, headers } = await postJson(url, { text }, otelHeaders);

      const durationMs = performance.now() - start;

      return {
        body,
        durationMs,
        clientTraceId,
        clientTraceparent,
        serverTraceId: headers.get("x-trace-id"),
        backendInstance: headers.get("x-backend-instance"),
        processingMs: headers.get("x-processing-ms") ? Number(headers.get("x-processing-ms")) : null,
        cache: headers.get("x-cache"),
      };
    } finally {
      span.end();
    }
  }


  async function onSubmit(e) {
    e.preventDefault();
    setError(null);

    if (tooLarge) {
      setError(`Text exceeds ${MAX_CHARS.toLocaleString()} characters.`);
      return;
    }

    setLoading(true);
    setLengthResult(null);
    setVowelResult(null);

    try {
      // Two concurrent calls, per the exercise
      const [length, vowels] = await Promise.all([
        callEndpoint("length", "/api/length"),
        callEndpoint("num_vowels", "/api/num_vowels"),
      ]);

      setLengthResult(length);
      setVowelResult(vowels);
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <div className="logo">🔭</div>
          <div>
            <h1>OTel Text Analyzer</h1>
            <p>
              Enter up to <b>{MAX_CHARS.toLocaleString()}</b> characters. On submit, the client makes{" "}
              <b>two concurrent</b> calls: <code>/length</code> and <code>/num_vowels</code>.
            </p>
          </div>
        </div>
      </header>

      <main className="content">
        <form className="card" onSubmit={onSubmit}>
          <label className="label">
            Text input
            <textarea
              className={`textarea ${tooLarge ? "textarea--error" : ""}`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              spellCheck={false}
            />
          </label>

          <div className="row">
            <div className={`pill ${tooLarge ? "pill--warn" : ""}`}>
              {charCount.toLocaleString()} chars
            </div>
            {tooLarge && <div className="pill pill--warn">Too large</div>}
            <div style={{ flex: 1 }} />
            <button className="button" type="submit" disabled={loading || tooLarge}>
              {loading ? "Processing…" : "Submit"}
            </button>
          </div>

          {error && <div className="error">Error: {error}</div>}
        </form>

        <div className="grid">
          <ResultCard title="POST /length" result={lengthResult} loading={loading} />
          <ResultCard title="POST /num_vowels" result={vowelResult} loading={loading} />
        </div>

        <div className="hint card">
          <h2>Trace correlation</h2>
          <ul>
            <li>
              The client automatically injects <code>traceparent</code> into API calls (Fetch
              instrumentation).
            </li>
            <li>
              The server extracts that context and continues the trace (Node auto-instrumentation).
            </li>
            <li>
              The server echoes <code>x-trace-id</code> so you can confirm it matches the client trace id
              shown below.
            </li>
          </ul>
        </div>
      </main>

      <footer className="footer">
        <span>Tip: open DevTools Console to see client spans and OTLP exporter activity.</span>
      </footer>
    </div>
  );
}

function ResultCard({ title, result, loading }) {
  return (
    <div className="card">
      <h2>{title}</h2>

      {loading && !result && <div className="loading">Loading…</div>}
      {!loading && !result && <div className="muted">No result yet.</div>}

      {result && (
        <>
          <pre className="pre">{JSON.stringify(result.body, null, 2)}</pre>

          <div className="meta">
            <MetaRow label="Client duration" value={`${result.durationMs.toFixed(1)} ms`} />
            <MetaRow label="Server processing" value={result.processingMs != null ? `${result.processingMs} ms` : "—"} />
            <MetaRow label="Backend instance" value={result.backendInstance || "—"} />
            <MetaRow label="Cache" value={result.cache || "—"} />
            <MetaRow label="Traceparent" value={result.clientTraceparent || "—"} mono />
            <MetaRow label="Client traceId" value={result.clientTraceId || "—"} mono />
            <MetaRow label="Server traceId" value={result.serverTraceId || "—"} mono />
          </div>
        </>
      )}
    </div>
  );
}

function MetaRow({ label, value, mono }) {
  return (
    <div className="metaRow">
      <div className="metaLabel">{label}</div>
      <div className={`metaValue ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}
