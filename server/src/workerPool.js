const os = require("node:os");
const path = require("node:path");
const Piscina = require("piscina");

const configuredThreads = Number(process.env.WORKER_THREADS || 0);
const maxThreads = configuredThreads > 0 ? configuredThreads : Math.max(2, os.cpus().length);

const pool = new Piscina({
  filename: path.join(__dirname, "worker.js"),
  maxThreads,
  minThreads: Math.min(2, maxThreads),
  idleTimeout: 10_000,
});

module.exports = { pool, maxThreads };
