const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveSrc, clearModule } = require("./helpers");

function makeReq(ip = "1.2.3.4") {
    return {
        headers: { "x-forwarded-for": ip },
        socket: { remoteAddress: ip },
    };
}

function makeRes() {
    return {
        headers: {},
        statusCode: 200,
        body: null,
        setHeader(k, v) {
            this.headers[k.toLowerCase()] = String(v);
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
    };
}

async function callMw(mw, req, res) {
    let nextCalled = false;
    await new Promise((resolve) => {
        mw(req, res, () => {
            nextCalled = true;
            resolve();
        });

        // if mw responds with 429, it won't call next; poll briefly
        setTimeout(resolve, 20);
    });
    return { nextCalled };
}

test("rateLimitMiddleware: allows first N requests then 429", async () => {
    process.env.RATE_LIMIT_POINTS = "2";
    process.env.RATE_LIMIT_DURATION = "60";

    const p = resolveSrc("rateLimit.js");
    clearModule(p);
    const { rateLimitMiddleware } = require(p);

    // 1st
    {
        const req = makeReq("9.9.9.9");
        const res = makeRes();
        const { nextCalled } = await callMw(rateLimitMiddleware, req, res);
        assert.equal(nextCalled, true);
        assert.ok("x-rate-limit-remaining" in res.headers);
        assert.ok("x-rate-limit-reset-ms" in res.headers);
    }

    // 2nd
    {
        const req = makeReq("9.9.9.9");
        const res = makeRes();
        const { nextCalled } = await callMw(rateLimitMiddleware, req, res);
        assert.equal(nextCalled, true);
    }

    // 3rd => 429
    {
        const req = makeReq("9.9.9.9");
        const res = makeRes();
        const { nextCalled } = await callMw(rateLimitMiddleware, req, res);
        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 429);
        assert.equal(res.body?.error, "rate_limited");
        assert.ok(typeof res.body?.retry_after_ms === "number");
    }
});
