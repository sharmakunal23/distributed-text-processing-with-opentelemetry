const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveSrc } = require("./helpers");

const worker = require(resolveSrc("worker.js"));

test("worker: length op returns string length", () => {
    assert.equal(worker({ op: "length", text: "abcd" }), 4);
});

test("worker: vowels op counts ASCII vowels case-insensitively", () => {
    assert.equal(worker({ op: "vowels", text: "AEIOUaeiou" }), 10);
    assert.equal(worker({ op: "vowels", text: "hello" }), 2); // e, o
    assert.equal(worker({ op: "vowels", text: "rhythm" }), 0);
});

test("worker: throws for non-string text", () => {
    assert.throws(() => worker({ op: "vowels", text: 123 }), /text must be a string/);
});

test("worker: throws for unknown op", () => {
    assert.throws(() => worker({ op: "nope", text: "abc" }), /unknown op/);
});
