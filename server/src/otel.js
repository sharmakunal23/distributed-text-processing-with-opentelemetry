/**
 * OpenTelemetry bootstrap for the Node.js API.
 *
 * - Uses NodeSDK + auto-instrumentations
 * - Exports configured via standard OTEL_* environment variables (see docker-compose.yml)
 *
 * IMPORTANT: this file must be loaded BEFORE your app code so it can patch modules.
 */
const process = require("node:process");
const { diag, DiagConsoleLogger, DiagLogLevel } = require("@opentelemetry/api");
const { NodeSDK } = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");

const logger = require('./logger');

const diagLevel = (process.env.OTEL_DIAGNOSTIC_LOG_LEVEL || "").toUpperCase();
if (diagLevel === "DEBUG") diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const serviceName = process.env.OTEL_SERVICE_NAME || "text-api";

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Keep it lean; you can enable/disable instrumentations here.
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

(async () => {
  try {
    await sdk.start(); // ok even if start() returns undefined
    logger.info(`[otel] started (service.name=${serviceName})`);
  } catch (err) {
    logger.error("[otel] failed to start", err);
  }
})();

async function shutdown(signal) {
  try {
    logger.info(`[otel] shutting down (${signal})...`);
    await sdk.shutdown();
    logger.info("[otel] shutdown complete");
  } catch (err) {
    logger.error("[otel] shutdown error", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
