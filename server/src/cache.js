const crypto = require("node:crypto");
const { LRUCache } = require("lru-cache");

const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 60_000);
const CACHE_MAX_TEXT_CHARS = Number(process.env.CACHE_MAX_TEXT_CHARS || 100_000);

const cache = new LRUCache({
  max: 500, // max entries
  ttl: CACHE_TTL_MS,
});

/**
 * Hashes text for cache keying.
 * NOTE: For very large texts we skip caching to avoid hashing overhead.
 */
function cacheKey(endpoint, text) {
  if (text.length > CACHE_MAX_TEXT_CHARS) return null;
  const h = crypto.createHash("sha1").update(text).digest("base64url");
  return `${endpoint}:${h}`;
}

module.exports = {
  cache,
  cacheKey,
  CACHE_MAX_TEXT_CHARS,
};
