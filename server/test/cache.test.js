const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { resolveSrc, clearModule } = require("./helpers");

test("cacheKey: returns null when text is too large", () => {
    // Make module read small max size from env
    process.env.CACHE_MAX_TEXT_CHARS = "5";

    const p = resolveSrc("cache.js");
    clearModule(p);
    const { cacheKey } = require(p);

    assert.equal(cacheKey("num_vowels", "123456"), null);
});

test("cacheKey: returns endpoint:sha1(base64url) for small text", () => {
    process.env.CACHE_MAX_TEXT_CHARS = "1000";

    const p = resolveSrc("cache.js");
    clearModule(p);
    const { cacheKey } = require(p);

    const endpoint = "num_vowels";
    const text = "hello";

    const expectedHash = crypto.createHash("sha1").update(text).digest("base64url");
    assert.equal(cacheKey(endpoint, text), `${endpoint}:${expectedHash}`);
});
