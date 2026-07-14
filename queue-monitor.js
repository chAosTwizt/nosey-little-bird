// queue-monitor.js
import { THREAT_SECONDS } from "./strobe-api.js";
export { THREAT_SECONDS };

export function applyQueueSnapshot(state, orders, nowMs) {
  const byId = { ...(state.byId || {}) };
  const seen = new Set();
  for (const o of orders) {
    seen.add(o.id);
    const existing = byId[o.id];
    const firstSeenAt =
      existing?.firstSeenAt ??
      (o.createdAtMs != null ? o.createdAtMs : nowMs);
    byId[o.id] = {
      id: o.id,
      staff: o.staff || existing?.staff || "??",
      status: o.status || existing?.status || "",
      firstSeenAt,
    };
  }
  for (const id of Object.keys(byId)) {
    if (!seen.has(id)) delete byId[id];
  }
  const whistled = { ...(state.whistled || {}) };
  for (const id of Object.keys(whistled)) {
    if (!byId[id]) delete whistled[id];
  }
  return { byId, whistled };
}

export function ordersCrossingThreat(state, nowMs, threatLevel) {
  if (!threatLevel || threatLevel === "off") return [];
  const need = THREAT_SECONDS[threatLevel];
  if (need == null) return [];
  const out = [];
  for (const [id, row] of Object.entries(state.byId || {})) {
    if (state.whistled?.[id]) continue;
    if (nowMs - row.firstSeenAt >= need * 1000) out.push(id);
  }
  return out;
}

/** True if any tracked unfilled order has sat >= seconds (default 15m). */
export function queueHasLongWait(state, nowMs, seconds = 900) {
  const needMs = seconds * 1000;
  for (const row of Object.values(state.byId || {})) {
    if (nowMs - row.firstSeenAt >= needMs) return true;
  }
  return false;
}

export function markWhistled(state, ids) {
  const whistled = { ...(state.whistled || {}) };
  for (const id of ids) whistled[id] = true;
  return { ...state, whistled };
}
