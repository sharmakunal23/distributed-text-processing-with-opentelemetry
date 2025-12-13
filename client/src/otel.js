/**
 * OpenTelemetry bootstrap for the browser client.
 *
 * - Instruments fetch() calls
 * - Exports spans to DevTools console
 * - Optionally exports to OTLP/HTTP at /otlp/v1/traces (enabled automatically when served by the edge Nginx)
 *
 * The client uses W3C Trace Context (`traceparent`) so the server can join the same trace.
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

if (import.meta.env.DEV) {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);
}

const provider = new WebTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: "web-client",
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: import.meta.env.MODE,
  }),
});

// Always log spans to the console for the exercise
provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))

// Enable OTLP export automatically when running via the edge Nginx (Docker mode: :8080),
// or if explicitly enabled via VITE_ENABLE_OTLP=1.
const enableOtlp =
  window.location.port === "8080" || import.meta.env.VITE_ENABLE_OTLP === "1";

if (enableOtlp) {
  provider.addSpanProcessor(
    new SimpleSpanProcessor(
      new OTLPTraceExporter({
        url: `${window.location.origin}/otlp/v1/traces`,
      })
    )
  );
}

provider.register({
  contextManager: new ZoneContextManager(),
});

registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      // Ensure trace headers propagate to our API calls
      propagateTraceHeaderCorsUrls: [/.*/],
      clearTimingResources: true,
    }),
  ],
});
