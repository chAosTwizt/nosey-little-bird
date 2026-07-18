chrome.storage.local.get({ pendingUpdate: null, lastUpdateDownload: null }, (data) => {
  const u = data.lastUpdateDownload || data.pendingUpdate;
  if (!u) return;
  const meta = document.getElementById("meta");
  const zip = document.getElementById("zipName");
  if (meta && u.version) {
    meta.textContent = `Version ${u.version} zip is in Downloads. Unzip over your bird folder, then Reload.`;
  }
  if (zip && u.zipName) zip.textContent = u.zipName;
});
