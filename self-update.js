/** One-shot GitHub release check for unpacked staff installs. */

export const UPDATE_REPO = "TWIZT-SHOP/nosey-little-bird";
export const UPDATE_API =
  `https://api.github.com/repos/${UPDATE_REPO}/releases/latest`;

/** @param {string} a @param {string} b */
export function compareSemver(a, b) {
  const pa = String(a || "0")
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
  const pb = String(b || "0")
    .replace(/^v/i, "")
    .split(/[.+-]/)
    .map((x) => parseInt(x, 10) || 0);
  const n = Math.max(pa.length, pb.length);
  for (let i = 0; i < n; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function pickStaffZipAsset(assets) {
  const list = Array.isArray(assets) ? assets : [];
  const named = list.find((a) =>
    /nosey-little-bird-.*-staff\.zip$/i.test(String(a?.name || ""))
  );
  if (named) return named;
  return list.find((a) => /\.zip$/i.test(String(a?.name || "")) && !/source/i.test(String(a?.name || ""))) || null;
}

/**
 * @param {{ token?: string }} [opts]
 * @returns {Promise<{ ok: boolean, update?: object, error?: string, current?: string }>}
 */
export async function fetchLatestRelease(opts = {}) {
  const current = chrome.runtime.getManifest().version;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = String(opts.token || "").trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 12_000);
    try {
      res = await fetch(UPDATE_API, { headers, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    const msg = String(e?.message || e);
    return {
      ok: false,
      current,
      error: /abort/i.test(msg) ? "GitHub check timed out" : msg,
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      current,
      error:
        res.status === 404
          ? "Release feed not found (repo private or no releases)"
          : `GitHub HTTP ${res.status}`,
    };
  }
  const data = await res.json();
  const tag = String(data.tag_name || data.name || "").replace(/^v/i, "");
  const asset = pickStaffZipAsset(data.assets);
  if (!tag || !asset?.browser_download_url) {
    return { ok: false, current, error: "No staff zip on latest release" };
  }
  const newer = compareSemver(current, tag) < 0;
  return {
    ok: true,
    current,
    update: newer
      ? {
          version: tag,
          tag: data.tag_name || `v${tag}`,
          zipUrl: asset.browser_download_url,
          zipName: asset.name,
          notes: String(data.body || "").slice(0, 500),
          htmlUrl: data.html_url || `https://github.com/${UPDATE_REPO}/releases/latest`,
        }
      : null,
  };
}
