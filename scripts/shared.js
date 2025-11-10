// shared.js — ESM + global bridge for AccelRFx
// Adds missing utilities: debounce, fitMapToMarkers

// ---- CSV + JSON helpers ----
export async function fetchJSON(url, init = {}) {
  const res = await fetch(url, { method: 'GET', ...init });
  if (!res.ok) throw new Error(`fetchJSON ${res.status} for ${url}`);
  return res.json();
}

export async function fetchCSV(url, init = {}) {
  const res = await fetch(url, { method: 'GET', ...init });
  if (!res.ok) throw new Error(`fetchCSV ${res.status} for ${url}`);
  const text = await res.text();
  return parseCSV(text);
}

// RFC4180-ish CSV → array of objects (header row required)
function parseCSV(text) {
  const rows = [];
  let i = 0, f = '', r = [], inQ = false;

  const pushF = () => { r.push(f); f = ''; };
  const pushR = () => { rows.push(r); r = []; };

  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i+1] === '"') { f += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      f += c; i++; continue;
    } else {
      if (c === '"') { inQ = true; i++; continue; }
      if (c === ',') { pushF(); i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { pushF(); pushR(); i++; continue; }
      f += c; i++; continue;
    }
  }
  if (f.length || r.length) { pushF(); pushR(); }

  if (!rows.length) return [];
  const headers = rows.shift().map(h => String(h||'').trim());
  return rows
    .filter(rr => rr.some(v => String(v).trim() !== ''))
    .map(rr => {
      const o = {};
      for (let j = 0; j < headers.length; j++) o[headers[j] || `col_${j}`] = rr[j] ?? '';
      return o;
    });
}

// ---- Utilities ----
// ---- Map utilities ----
export function invalidateMap(map, delay = 150) {
  try {
    if (!map) return false;
    const run = () => {
      if (typeof map.invalidateSize === 'function') {
        map.invalidateSize();
      }
      // If Leaflet resize handler exists, nudge it
      if (typeof map._onResize === 'function') {
        try { map._onResize(); } catch(_) {}
      }
    };
    if (document && document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', () => run(), { once: true });
      return true;
    }
    setTimeout(() => {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(run);
      } else {
        run();
      }
    }, delay);
    return true;
  } catch (e) {
    console.warn('invalidateMap failed:', e);
    return false;
  }
}

export function debounce(fn, wait = 250) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function fitMapToMarkers(map, markers, padding = [24, 24]) {
  try {
    if (!map || !markers || !markers.length) return;
    // Accept arrays of L.Marker, L.Circle, or [lat, lng]
    const layers = [];
    markers.forEach(m => {
      if (!m) return;
      if (m.getLatLng) { layers.push(m); }
      else if (Array.isArray(m) && m.length >= 2) {
        layers.push(L.marker([Number(m[0]), Number(m[1])]));
      }
    });
    if (!layers.length) return;
    const fg = L.featureGroup(layers);
    const b = fg.getBounds();
    if (b.isValid()) {
      map.fitBounds(b, { padding });
      setTimeout(() => map.invalidateSize(), 100);
    }
  } catch (e) {
    console.warn('fitMapToMarkers failed:', e);
  }
}

// ---- Apps Script bridge (optional if configured) ----
export const CONFIG = (typeof window !== 'undefined' && window.CONFIG) ? window.CONFIG : (typeof CONFIG !== 'undefined' ? CONFIG : undefined);
const WEBAPP_URL = CONFIG && CONFIG.WEBAPP_URL ? CONFIG.WEBAPP_URL : '';

async function apiPost(action, payload = {}) {
  if (!WEBAPP_URL) throw new Error('CONFIG.WEBAPP_URL not set');
  const res = await fetch(WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  const json = await res.json();
  if (!res.ok || json?.error) throw new Error(json?.error || `API ${action} failed`);
  return json.data ?? json;
}
async function apiGet(params = {}) {
  if (!WEBAPP_URL) throw new Error('CONFIG.WEBAPP_URL not set');
  const u = new URL(WEBAPP_URL);
  Object.entries(params).forEach(([k,v]) => u.searchParams.set(k, v));
  const res = await fetch(u); const json = await res.json();
  if (!res.ok || json?.error) throw new Error(json?.error || 'API GET failed');
  return json.data ?? json;
}

export async function saveRFx(payload){ return apiPost('saveRfx', { payload }); }
export async function publishRFx(id){   return apiPost('publishRfx', { id }); }
export async function cancelRFx(id, reason){ return apiPost('cancelRfx', { id, reason }); }
export async function getRFx(id){ return apiGet({ action:'getRfx', id }); }
export async function getSites(){ const r = await apiGet({ action:'getSites' }); return Array.isArray(r) ? r : (r?.data || r); }

// ---- Global bridge for classic scripts

// ---- Credits UI helper ----
export function updateCreditDisplay(value){
  try{
    const valStr = (value ?? '').toString();
    const candidates = [
      '#creditBalance',             // primary id
      '.js-credit-balance',         // class hook
      '[data-credit-balance]'       // data-attribute
    ];
    let updated = 0;
    candidates.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        el.textContent = valStr;
        updated++;
      });
    });
    // Also reflect in header pills if present
    const pill = document.getElementById('aa-credit-pill');
    if (pill) { pill.textContent = valStr; updated++; }
    return updated;
  }catch(e){
    console.warn('updateCreditDisplay failed:', e);
    return 0;
  }
}

const sharedObj = { fetchJSON, fetchCSV, debounce, fitMapToMarkers, saveRFx, publishRFx, cancelRFx, getRFx, getSites, CONFIG };
try { if (typeof window !== 'undefined') window.shared = sharedObj; } catch(_) {}
export default sharedObj;
