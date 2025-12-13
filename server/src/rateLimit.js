const { RateLimiterMemory } = require("rate-limiter-flexible");

const RATE_LIMIT_POINTS = Number(process.env.RATE_LIMIT_POINTS || 20);
const RATE_LIMIT_DURATION = Number(process.env.RATE_LIMIT_DURATION || 1);

const limiter = new RateLimiterMemory({
  points: RATE_LIMIT_POINTS,
  duration: RATE_LIMIT_DURATION,
});

function rateLimitMiddleware(req, res, next) {
  const ip =
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "unknown";

  limiter
    .consume(ip)
    .then((rate) => {
      // Optional: surface remaining quota to the client for debugging
      res.setHeader("x-rate-limit-remaining", String(rate.remainingPoints));
      res.setHeader("x-rate-limit-reset-ms", String(rate.msBeforeNext));
      next();
    })
    .catch((rate) => {
      res.status(429).json({
        error: "rate_limited",
        retry_after_ms: rate.msBeforeNext,
      });
    });
}

module.exports = { rateLimitMiddleware };
