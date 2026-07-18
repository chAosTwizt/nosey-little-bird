/** Background schedule.json refresh (Cloudflare Access cookie from this browser). */

export const SCHEDULE_JSON_URL = "https://strobe.twizt.shop/schedule.json";
export const SCHEDULE_SITE_URL = "https://strobe.twizt.shop/";
/** How often the bird tries to refresh who’s-on-shift without anyone opening the page. */
export const SCHEDULE_REFRESH_HOURS = 4;
/** Soft stale: nag unlock if cache older than this and refresh fails. */
export const SCHEDULE_STALE_HOURS = 24;

export function looksLikeAccessWall(status, contentType, bodyText) {
  if (status === 401 || status === 403) return true;
  const ct = String(contentType || "").toLowerCase();
  const t = String(bodyText || "");
  if (ct.includes("application/json")) return false;
  // schedule.json must be JSON — any HTML/login wall means Access needs unlock
  if (ct.includes("text/html") || t.trimStart().startsWith("<!")) {
    return true;
  }
  return false;
}

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   data?: object,
 *   needsUnlock?: boolean,
 *   error?: string,
 * }>}
 */
export async function fetchScheduleJson(fetchImpl = fetch) {
  let res;
  try {
    res = await fetchImpl(SCHEDULE_JSON_URL, {
      credentials: "include",
      cache: "no-store",
      redirect: "follow",
    });
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();

  if (looksLikeAccessWall(res.status, ct, text)) {
    return {
      ok: false,
      needsUnlock: true,
      error: "Schedule page needs a new Access code / sign-in",
    };
  }

  if (!res.ok) {
    return { ok: false, error: `HTTP ${res.status}` };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    return {
      ok: false,
      needsUnlock: looksLikeAccessWall(res.status, "text/html", text),
      error: "Schedule response was not JSON",
    };
  }

  if (!data?.weeks) {
    return { ok: false, error: "Schedule JSON missing weeks" };
  }
  return { ok: true, data };
}
