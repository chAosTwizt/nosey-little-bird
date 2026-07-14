// tests/queue-monitor.test.mjs
import assert from "node:assert/strict";
import {
  applyQueueSnapshot,
  ordersCrossingThreat,
  ordersForOneAlert,
  markWhistled,
  queueHasLongWait,
  THREAT_SECONDS,
} from "../queue-monitor.js";
import { LONG_WAIT_SECONDS } from "../strobe-api.js";

let state = { byId: {}, whistled: {} };
const t0 = 1_000_000;

state = applyQueueSnapshot(state, [{ id: "A", createdAtMs: null }], t0);
assert.equal(state.byId.A.firstSeenAt, t0);

state = applyQueueSnapshot(state, [{ id: "A", createdAtMs: null }], t0 + 1000);
assert.equal(state.byId.A.firstSeenAt, t0);

const cross = ordersCrossingThreat(
  state,
  t0 + THREAT_SECONDS.high * 1000,
  "high"
);
assert.deepEqual(cross, ["A"]);

state = markWhistled(state, ["A"]);
assert.deepEqual(
  ordersCrossingThreat(state, t0 + THREAT_SECONDS.high * 1000, "high"),
  []
);

state = applyQueueSnapshot(state, [], t0 + 5000);
assert.equal(state.byId.A, undefined);

// 1-order mode: whistle as soon as an order is seen
state = applyQueueSnapshot({ byId: {}, whistled: {} }, [{ id: "N", createdAtMs: null }], t0);
assert.deepEqual(ordersCrossingThreat(state, t0, "one"), ["N"]);
state = markWhistled(state, ["N"]);
assert.deepEqual(ordersCrossingThreat(state, t0 + 60_000, "one"), []);

// 15m long-wait flash gate
state = applyQueueSnapshot({ byId: {}, whistled: {} }, [{ id: "L", createdAtMs: null }], t0);
assert.equal(queueHasLongWait(state, t0 + (LONG_WAIT_SECONDS - 1) * 1000), false);
assert.equal(queueHasLongWait(state, t0 + LONG_WAIT_SECONDS * 1000), true);

// 1-ORDER: new arrival (not in prev) alerts once
state = applyQueueSnapshot({ byId: {}, whistled: {} }, [{ id: "N", createdAtMs: null }], t0);
assert.deepEqual(ordersForOneAlert(state, {}, false), ["N"]);
assert.deepEqual(ordersForOneAlert(state, { N: { firstSeenAt: t0 } }, false), []);
assert.deepEqual(ordersForOneAlert(state, { N: { firstSeenAt: t0 } }, true), ["N"]);
state = markWhistled(state, ["N"]);
assert.deepEqual(ordersForOneAlert(state, {}, true), []);

console.log("queue-monitor tests ok");
