(async function () {
  const MAX_TRIES = 8;
  const DELAY_MS = 1500;
  let inFlight = false;

  function onAccessWall() {
    const title = String(document.title || "");
    const html = String(document.documentElement?.innerText || "").slice(0, 2000);
    return /cloudflare\s*access|sign in/i.test(title) || /cloudflare\s*access/i.test(html);
  }

  function markNeedsUnlock(reason) {
    try {
      chrome.storage.local.set({
        scheduleNeedsUnlock: true,
        scheduleCacheError: reason || "Needs Access unlock",
      });
    } catch (_) {
      /* ignore */
    }
  }

  async function tryFetchSchedule() {
    if (onAccessWall()) {
      return {
        needsUnlock: true,
        error: "Schedule page needs a new Access code / sign-in",
      };
    }
    try {
      const url = new URL("/schedule.json", location.origin).href;
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          return { needsUnlock: true, error: `HTTP ${res.status}` };
        }
        return { error: `HTTP ${res.status}` };
      }
      if (ct.includes("text/html")) {
        return {
          needsUnlock: true,
          error: "Schedule page needs a new Access code / sign-in",
        };
      }
      const data = await res.json();
      if (!data?.weeks) return { error: "missing weeks" };
      return { data };
    } catch (e) {
      return { error: String(e?.message || e) };
    }
  }

  /** Write cache from the page — do not rely on the service worker being awake. */
  function persistSchedule(data) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set(
          {
            scheduleJson: data,
            scheduleCachedAt: Date.now(),
            scheduleCacheError: "",
            scheduleNeedsUnlock: false,
          },
          () => {
            void chrome.runtime.lastError;
            resolve(true);
          }
        );
      } catch (_) {
        resolve(false);
      }
    });
  }

  async function cacheSchedule() {
    if (inFlight) return;
    inFlight = true;
    try {
      for (let i = 0; i < MAX_TRIES; i++) {
        const result = await tryFetchSchedule();
        if (result.data) {
          await persistSchedule(result.data);
          // Best-effort: also notify SW so it can rebuild CSV for paste/legacy.
          try {
            chrome.runtime.sendMessage(
              { type: "SCHEDULE_RAW_JSON", data: result.data },
              () => {
                void chrome.runtime.lastError;
              }
            );
          } catch (_) {
            /* ignore */
          }
          return;
        }
        if (result.needsUnlock) {
          markNeedsUnlock(result.error);
          return;
        }
        if (i === MAX_TRIES - 1) {
          try {
            chrome.storage.local.set({
              scheduleCacheError: String(result.error || "fetch failed"),
            });
          } catch (_) {
            /* ignore */
          }
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    } finally {
      inFlight = false;
    }
  }

  if (onAccessWall()) {
    markNeedsUnlock("Schedule page needs a new Access code / sign-in");
  }

  await cacheSchedule();

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") cacheSchedule();
  });
})();
