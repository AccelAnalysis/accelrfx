import { CONFIG } from './config.js';
import { fetchCSV, debounce } from './shared.js';
import { getPrimarySite, loadUserProfile } from './profile.js';

let mapRef;
let ringLayer = L.layerGroup();
let targetPoints = [];
let radiiMiles = [1, 2, 3]; // derived from count/step
let countsCache = [];
let centerLatLng;

export async function initTargeting(map){
  mapRef = map;
  ringLayer.addTo(mapRef);
  await loadTargets();
  wireSheet();
}

export function openTargetSheet(){
  centerLatLng = L.latLng(getPrimarySite().lat, getPrimarySite().lng);
  deriveRingsFromInputs();
  drawRings();
  computeCounts();
  const sheet = document.getElementById('targetSheet');
  const overlay = document.getElementById('targetOverlay');
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden','false');
  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden','false');
}

function closeTargetSheet(){
  const sheet = document.getElementById('targetSheet');
  const overlay = document.getElementById('targetOverlay');
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden','true');
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden','true');
}

async function loadTargets(){
  const src = (CONFIG.DATA && (CONFIG.DATA.TARGETS_CSV || CONFIG.DATA.RFP_CSV)) || 'data/sample_rfps.csv';
  try {
    targetPoints = (await fetchCSV(src))
      .map(r => ({
        lat: parseFloat(r.lat || r.Lat || r.latitude || r.Latitude),
        lng: parseFloat(r.lng || r.Lng || r.longitude || r.Longitude || r.lon),
        income: num(r.income || r.Income),
        age: num(r.age || r.Age || r.MedianAge),
        owner: lower(r.owner || r.Owner || r.Homeowner),
        hhsize: num(r.hhsize || r.HHSize || r.HouseholdSize),
        lifestyle: lower(r.lifestyle || r.Lifestyle || r.tags || r.Tags),
        naics: String(r.naics || r.NAICS || '').trim(),
        employees: num(r.employees || r.Employees || r.Headcount),
        revenue: num(r.revenue || r.Revenue || r.Sales)
      }))
      .filter(p => isFinite(p.lat) && isFinite(p.lng));
  } catch (e) {
    console.warn('Failed to load target CSV, counts may be zero.', e);
    targetPoints = [];
  }
}
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : undefined; };
const lower = v => (v==null ? '' : String(v).toLowerCase());

function wireSheet(){
  const sheet = document.getElementById('targetSheet');
  const close = document.getElementById('targetClose');
  const overlay = document.getElementById('targetOverlay');
  close.addEventListener('click', closeTargetSheet);
  overlay.addEventListener('click', closeTargetSheet);
  document.addEventListener('keydown', (e)=>{
    if (e.key === 'Escape' && sheet.classList.contains('open')) closeTargetSheet();
  });

  document.getElementById('applyRings').addEventListener('click', ()=>{
    deriveRingsFromInputs();
    drawRings();
    computeCounts();
  });
  document.getElementById('applyFilters').addEventListener('click', ()=> computeCounts());

  document.getElementById('ctaMail').addEventListener('click', ()=>{
    const qs = new URLSearchParams({
      rings: radiiMiles.join(','),
      income_min: gv('f_income_min'), income_max: gv('f_income_max'),
      age_min: gv('f_age_min'), age_max: gv('f_age_max'),
      owner: gv('f_owner'), lifestyle: gv('f_lifestyle'),
      hh_min: gv('f_hh_min'), hh_max: gv('f_hh_max'),
      naics: gv('f_naics'),
      emp_min: gv('f_emp_min'), emp_max: gv('f_emp_max'),
      rev_min: gv('f_rev_min'), rev_max: gv('f_rev_max')
    });
    window.location.href = `proposal.html?${qs.toString()}`;
  });

  mapRef.on('zoomend', debounce(computeCounts, 120));
}
const gv = id => (document.getElementById(id)?.value || '').trim();

function deriveRingsFromInputs(){
  const count = Math.max(1, Math.min(5, parseInt(document.getElementById('ringCount').value)||3));
  const step = Math.max(0.1, parseFloat(document.getElementById('ringStep').value)||1);
  const arr = [];
  for (let i=1; i<=count; i++) arr.push(i*step);
  radiiMiles = arr;
}

function milesToMeters(mi){ return mi * 1609.344; }

function drawRings(){
  ringLayer.clearLayers();
  if (!centerLatLng) return;
  // draw outer -> inner then bring inner to front; give explicit style
  const sorted = [...radiiMiles].sort((a,b)=>b-a);
  sorted.forEach((miles, idx) => {
    const radius = milesToMeters(miles);
    const c = L.circle(centerLatLng, {
      radius,
      className: 'ring-path',
      color: 'rgba(47,85,151,0.72)',
      fillColor: 'rgba(47,85,151,0.32)',
      fillOpacity: 0.22,
      weight: 2
    });
    ringLayer.addLayer(c);
  });
  ringLayer.eachLayer(l => { if (l.bringToFront) l.bringToFront(); });
}

function computeCounts(){
  if (!centerLatLng) return;
  const f = readFilters();
  const dists = radiiMiles.map(mi => milesToMeters(mi)).sort((a,b)=>a-b);
  const ranges = dists.map((outer, idx) => [idx===0?0:dists[idx-1], outer]);

  const counts = ranges.map(()=>0);
  const filtered = targetPoints.filter(p => {
    if (!applyFilters(p, f)) return false;
    const d = mapRef.distance(centerLatLng, L.latLng(p.lat, p.lng));
    p._dist = d;
    return d <= dists[dists.length-1];
  });
  filtered.forEach(p => {
    for (let i=0;i<ranges.length;i++){
      const [inner, outer] = ranges[i];
      if (p._dist > inner && p._dist <= outer){ counts[i]++; break; }
    }
  });
  countsCache = counts;
  renderCounts(ranges, counts);
}

function readFilters(){
  const toNum = v => { const n = parseFloat(v); return isFinite(n) ? n : undefined; };
  return {
    income_min: toNum(gv('f_income_min')),
    income_max: toNum(gv('f_income_max')),
    age_min: toNum(gv('f_age_min')),
    age_max: toNum(gv('f_age_max')),
    owner: gv('f_owner').toLowerCase(),
    hh_min: toNum(gv('f_hh_min')),
    hh_max: toNum(gv('f_hh_max')),
    lifestyle: gv('f_lifestyle').toLowerCase(),
    naics: gv('f_naics'),
    emp_min: toNum(gv('f_emp_min')),
    emp_max: toNum(gv('f_emp_max')),
    rev_min: toNum(gv('f_rev_min')),
    rev_max: toNum(gv('f_rev_max'))
  };
}

function applyFilters(p, f){
  if (f.income_min!=null && (p.income==null || p.income < f.income_min)) return false;
  if (f.income_max!=null && (p.income==null || p.income > f.income_max)) return false;

  if (f.age_min!=null && (p.age==null || p.age < f.age_min)) return false;
  if (f.age_max!=null && (p.age==null || p.age > f.age_max)) return false;

  if (f.owner && !String(p.owner||'').startsWith(f.owner)) return false;

  if (f.hh_min!=null && (p.hhsize==null || p.hhsize < f.hh_min)) return false;
  if (f.hh_max!=null && (p.hhsize==null || p.hhsize > f.hh_max)) return false;

  if (f.lifestyle){
    const need = f.lifestyle.split(',').map(s=>s.trim()).filter(Boolean);
    const have = String(p.lifestyle||'').toLowerCase();
    if (need.length && !need.every(tag => have.includes(tag))) return false;
  }

  if (f.naics){
    const needles = f.naics.split(',').map(s=>s.trim()).filter(Boolean);
    if (needles.length && !needles.some(code => String(p.naics||'').includes(code))) return false;
  }

  if (f.emp_min!=null && (p.employees==null || p.employees < f.emp_min)) return false;
  if (f.emp_max!=null && (p.employees==null || p.employees > f.emp_max)) return false;

  if (f.rev_min!=null && (p.revenue==null || p.revenue < f.rev_min)) return false;
  if (f.rev_max!=null && (p.revenue==null || p.revenue > f.rev_max)) return false;

  return true;
}

function renderCounts(ranges, counts){
  const wrap = document.getElementById('tmCounts');
  wrap.innerHTML = '';
  counts.forEach((c, i) => {
    const [inner, outer] = ranges[i];
    const miIn = (inner/1609.344).toFixed(1);
    const miOut = (outer/1609.344).toFixed(1);
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<span>${miIn}–${miOut} mi</span><span>${c.toLocaleString()}</span>`;
    wrap.appendChild(row);
  });
}

// expose (for diagnostics if needed)
window.AccelTargeting = { initTargeting, openTargetSheet };
