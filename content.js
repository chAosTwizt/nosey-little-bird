// HubSpot inbox only — API-first bird does not scan Strobe DOM.
if (!location.hostname.includes('app.hubspot.com')) return;

// === BIRD BRAIN HUD SETUP ===
const hud = document.createElement('div');
hud.style = 'position:fixed; bottom:10px; right:10px; width:320px; background:rgba(10,10,10,0.95); color:#eee; font-family:monospace; font-size:11px; border:1px solid #444; border-radius:6px; z-index:999999; box-shadow:0 0 15px rgba(0,0,0,0.7); display:flex; flex-direction:column;';
hud.style.cursor = 'move';
hud.draggable = false;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
hud.addEventListener('mousedown', (e) => {
    if (e.target === hud || hud.contains(e.target)) {
        isDragging = true;
        const rect = hud.getBoundingClientRect();
        dragOffset.x = e.clientX - rect.left;
        dragOffset.y = e.clientY - rect.top;
        hud.style.userSelect = 'none';
    }
});
document.addEventListener('mousemove', (e) => {
    if (isDragging) {
        hud.style.left = (e.clientX - dragOffset.x) + 'px';
        hud.style.top = (e.clientY - dragOffset.y) + 'px';
        hud.style.right = 'auto';
        hud.style.bottom = 'auto';
    }
});
document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        hud.style.userSelect = '';
    }
});
document.body.appendChild(hud);

const loreBox = document.createElement('div');
loreBox.style = 'padding:8px; max-height:180px; overflow-y:auto;';
hud.appendChild(loreBox);

// --- HUD LIVE LIST (max 5 orders) ---
const hudRows = new Map(); // id -> { el, staff, status, satFor, note, color }
const hudOrderIds = []; // most-recent first

function moveToFront(id) {
    const idx = hudOrderIds.indexOf(id);
    if (idx >= 0) hudOrderIds.splice(idx, 1);
    hudOrderIds.unshift(id);
    while (hudOrderIds.length > 5) {
        const evict = hudOrderIds.pop();
        const row = hudRows.get(evict);
        if (row?.el) row.el.remove();
        hudRows.delete(evict);
    }
}

function renderRow(id) {
    const row = hudRows.get(id);
    if (!row) return;
    const staff = row.staff && row.staff !== "??" ? row.staff : "??";
    const right = row.note || "SEEN";

    row.el.style = `padding:5px; border-bottom:1px solid #222; cursor:default; display:flex; justify-content:space-between; color:${row.color || "#888"}`;
    row.el.innerHTML = `
      <div style="min-width:0; flex:1;">
        <div style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"><b>${id}</b></div>
        <div style="font-size:10px; opacity:0.9; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
          <span style="color:#ff9800; font-weight:bold;">${staff}</span>
        </div>
      </div>
      <div style="margin-left:8px; white-space:nowrap; font-weight:bold; color:#bbb;">${right}</div>
    `;
}

function upsertHudOrder(update) {
    const id = update?.id;
    if (!id) return;
    const allowCreate = !!update.allowCreate;
    const existing = hudRows.get(id);

    if (!existing && !allowCreate) {
        return;
    }
    if (!existing && allowCreate) {
        const el = document.createElement('div');
        hudRows.set(id, {
            el,
            staff: update.staff,
            status: update.status,
            satFor: update.satFor,
            note: update.note,
            color: update.color
        });
        loreBox.appendChild(el);
    } else {
        if (update.staff != null) existing.staff = update.staff;
        if (update.status != null) existing.status = update.status;
        if (update.satFor != null) existing.satFor = update.satFor;
        if (update.note != null) existing.note = update.note;
        if (update.color != null) existing.color = update.color;
    }

    const row = hudRows.get(id);
    const status = row?.status || update.status;
    if (!status || status.toLowerCase() !== "paused") {
        const idx = hudOrderIds.indexOf(id);
        if (idx >= 0) hudOrderIds.splice(idx, 1);
        if (row?.el) row.el.remove();
        hudRows.delete(id);
        return;
    }

    moveToFront(id);
    for (let i = 0; i < hudOrderIds.length; i++) {
        const rid = hudOrderIds[i];
        const r = hudRows.get(rid);
        if (r?.el) loreBox.appendChild(r.el);
    }
    renderRow(id);
}

// === STYLES FOR HIGHLIGHTING ===
const style = document.createElement('style');
style.textContent = `
.bird-id-hit { color: #00e5ff !important; font-weight: bold; text-decoration: underline; }
.bird-id-copyable { color: #ff9800 !important; font-weight: bold; }
.bird-id-clickable { cursor: pointer !important; }
.bird-id-clickable:hover { opacity: 0.8; }
.bird-hud-bounce { animation: birdHudBounce 0.6s ease-out 2; }
@keyframes birdHudBounce {
  0%, 100% { transform: scale(1); }
  25% { transform: scale(1.02); }
  50% { transform: scale(0.98); }
  75% { transform: scale(1.01); }
}
.bird-hud-flash { animation: birdFlash 0.8s ease-in-out 2; }
@keyframes birdFlash {
  0%   { background-color: rgba(76, 175, 80, 0.05); }
  50%  { background-color: rgba(76, 175, 80, 0.2); }
  100% { background-color: rgba(76, 175, 80, 0.05); }
}
.bird-page-flash { animation: birdFlash 0.8s ease-in-out 2 !important; }
.bird-page-bounce { animation: birdHudBounce 0.6s ease-out 2 !important; }
`;
document.head.appendChild(style);

function wrapOrderIdInElementForHubspot(root, orderId, isHudMatch) {
    const spans = root.querySelectorAll ? root.querySelectorAll('.bird-id-hit, .bird-id-copyable') : [];
    if ([...spans].some(s => s.textContent.trim() === orderId)) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    let node;
    while ((node = walker.nextNode())) {
        const text = node.textContent || "";
        const idx = text.indexOf(orderId);
        if (idx === -1) continue;
        const parent = node.parentNode;
        if (parent.classList && (parent.classList.contains('bird-id-hit') || parent.classList.contains('bird-id-copyable') || parent.classList.contains('bird-id-clickable'))) continue;
        const before = text.slice(0, idx);
        const after = text.slice(idx + orderId.length);
        const span = document.createElement('span');
        span.className = isHudMatch ? 'bird-id-hit bird-id-clickable' : 'bird-id-copyable bird-id-clickable';
        span.textContent = orderId;
        span.title = 'Click to copy';
        span.onclick = (e) => {
            e.stopPropagation();
            e.preventDefault();
            navigator.clipboard.writeText(orderId);
            const orig = span.textContent;
            span.textContent = 'COPIED';
            span.style.color = '#4caf50';
            setTimeout(() => { span.textContent = orig; span.style.color = ''; }, 1000);
        };
        if (before) parent.insertBefore(document.createTextNode(before), node);
        parent.insertBefore(span, node);
        if (after) parent.insertBefore(document.createTextNode(after), node);
        parent.removeChild(node);
        return true;
    }
    return false;
}

function highlightHubspotMatches(pausedList) {
    const pausedIds = new Set((pausedList || []).map(p => p.id));

    hudOrderIds.forEach(id => {
        const row = hudRows.get(id);
        if (row?.el) row.el.classList.remove('bird-hud-flash', 'bird-hud-bounce');
    });
    document.querySelectorAll('.bird-page-flash').forEach(el => {
        if (!hud.contains(el)) el.classList.remove('bird-page-flash', 'bird-page-bounce');
    });

    hudOrderIds.forEach(id => {
        if (!pausedIds.has(id)) return;
        const row = hudRows.get(id);
        if (!row?.el) return;

        let foundOnPage = false;
        let pageNode = null;
        const nodes = document.querySelectorAll('span, div, a');
        for (const node of nodes) {
            if (hud.contains(node)) continue;
            const text = (node.textContent || "").trim();
            if (!text.includes(id)) continue;
            foundOnPage = true;
            pageNode = node;
            wrapOrderIdInElementForHubspot(node, id, true);
            break;
        }

        if (foundOnPage) {
            row.el.classList.add('bird-hud-bounce', 'bird-hud-flash');
            const idSpan = pageNode && (pageNode.querySelector('.bird-id-hit') || pageNode.querySelector('.bird-id-copyable'));
            if (idSpan && idSpan.textContent.trim() === id) idSpan.classList.add('bird-page-bounce', 'bird-page-flash');
        }
    });

    const allIds = new Set();
    document.querySelectorAll('span, div, a, p, td, li').forEach(node => {
        if (hud.contains(node)) return;
        const text = node.innerText || '';
        const matches = text.match(/\b[A-Z0-9]{14}\b/g);
        if (!matches) return;
        matches.forEach(id => {
            if (pausedIds.has(id)) return;
            allIds.add(id);
        });
    });
    allIds.forEach(id => {
        const nodes = document.querySelectorAll('span, div, a, p, td, li');
        for (const node of nodes) {
            if (hud.contains(node)) continue;
            if (!(node.innerText || '').includes(id)) continue;
            if (wrapOrderIdInElementForHubspot(node, id, false)) break;
        }
    });
}

function refreshHubspotHud() {
    chrome.storage.local.get({ pausedOrders: [] }, (data) => {
        let paused = (data.pausedOrders || []).filter(p => p && (p.status || '').toLowerCase() === 'paused');
        const sortTs = (p) => p.orderDateTs ?? p.pausedAt ?? 0;
        paused = paused.slice().sort((a, b) => (sortTs(b) - sortTs(a)));
        const seenIds = new Set(paused.map(p => p.id));

        hudOrderIds.slice().forEach(id => {
            if (!seenIds.has(id)) {
                const row = hudRows.get(id);
                const idx = hudOrderIds.indexOf(id);
                if (idx >= 0) hudOrderIds.splice(idx, 1);
                if (row?.el) row.el.remove();
                hudRows.delete(id);
            }
        });

        hudOrderIds.length = 0;
        paused.forEach(p => {
            hudOrderIds.push(p.id);
            let row = hudRows.get(p.id);
            if (!row) {
                const el = document.createElement('div');
                row = { el, staff: p.staff, status: p.status, satFor: null, note: 'PAUSED', color: '#00e5ff' };
                hudRows.set(p.id, row);
            } else {
                row.staff = p.staff;
                row.status = p.status;
                row.note = 'PAUSED';
                row.color = '#00e5ff';
            }
        });

        while (loreBox.firstChild) loreBox.removeChild(loreBox.firstChild);
        hudOrderIds.forEach(id => {
            const row = hudRows.get(id);
            if (row?.el) loreBox.appendChild(row.el);
        });
        hudOrderIds.forEach(id => renderRow(id));

        highlightHubspotMatches(paused);
    });
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "HUD_UPSERT" && message.id) {
        upsertHudOrder({
            id: message.id,
            staff: message.staff,
            status: message.status,
            satFor: message.satFor,
            note: message.note,
            color: message.color
        });
    }
    if (message.type === "LORE_UPDATE" && message.entry) {
        const e = message.entry;
        const color = e.status === "CLAIMED" ? "#00ff00" : "#ff4444";
        upsertHudOrder({
            id: e.id,
            staff: e.user,
            status: e.status,
            satFor: e.satFor,
            note: null,
            color
        });
    }
});

refreshHubspotHud();
setInterval(refreshHubspotHud, 1000);
