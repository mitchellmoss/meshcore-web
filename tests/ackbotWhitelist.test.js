import test from "node:test";
import assert from "node:assert/strict";

import {isSenderAllowed} from "../src/js/AckBotUtils.js";

test("allows all senders when whitelist is empty", () => {
    assert.equal(isSenderAllowed("Alice", []), true);
    assert.equal(isSenderAllowed("Bob", null), true);
});

test("matches sender names case-insensitively", () => {
    const whitelist = ["Alice", "Bob"];
    assert.equal(isSenderAllowed("alice", whitelist), true);
    assert.equal(isSenderAllowed("ALICE", whitelist), true);
    assert.equal(isSenderAllowed("Bob", whitelist), true);
});

test("rejects senders not in the whitelist", () => {
    const whitelist = ["Alice", "Bob"];
    assert.equal(isSenderAllowed("Charlie", whitelist), false);
});

test("handles leading/trailing whitespace", () => {
    const whitelist = ["  Alice  ", "Bob"];
    assert.equal(isSenderAllowed("alice", whitelist), true);
    assert.equal(isSenderAllowed("bob ", whitelist), true);
    assert.equal(isSenderAllowed(" ", whitelist), false);
});
