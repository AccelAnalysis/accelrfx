
/* proposal.js — robust, brand-matched behaviour; no duplicate includes.
   - Collapsibles
   - Leaflet map + concentric rings (inner rings on top)
   - Live estimate (Setup + Quantity*UnitCost + Other)
   - Save Draft via localStorage
*/

// --- Collapsibles ---
document.addEventListener('click', (e) => {
  const header = e.target.closest('.aa-card__header');
  if (!header) return;
  const card = header.closest('.aa-collapsible');
  if (!card) return;
  const collapsed = card.getAttribute('data-collapsed') === 'true';
  card.setAttribute('data-collapsed', (!collapsed).toString());
});

// --- Leaflet Map + Rings ---
let map, centerMarker, ringsGroup;
const milesToMeters = (mi) => mi * 1609.34;

function initMap(){
  map = L.map('map').setView([36.7682, -76.2875], 10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  map.on('click', (e) => {
    if(!centerMarker){
      centerMarker = L.marker(e.latlng,{draggable:true}).addTo(map);
      centerMarker.on('dragend', drawRings);
    }else{
      centerMarker.setLatLng(e.latlng);
    }
    drawRings();
  });
}

function drawRings(){
  const input = document.getElementById('ringMiles').value.trim();
  const miles = input.split(',').map(s=>parseFloat(s)).filter(n=>!isNaN(n)).sort((a,b)=>a-b);
  if(!centerMarker || miles.length===0) return;

  if(ringsGroup){ ringsGroup.remove(); }
  ringsGroup = L.layerGroup().addTo(map);

  // Draw outermost first, innermost last to place inner on top (better hover/visual).
  for(let i = miles.length - 1; i >= 0; i--){
    const m = miles[i];
    L.circle(centerMarker.getLatLng(), {
      radius: milesToMeters(m),
      color: '#2F5597',
      fillColor: '#2F5597',
      fillOpacity: 0.06,
      weight: 1.25
    }).addTo(ringsGroup).bindTooltip(`${m} mile${m!==1?'s':''} radius`, {sticky:true});
  }
  map.fitBounds(ringsGroup.getBounds(), {padding:[24,24]});
}

function clearCenter(){
  if(centerMarker){ centerMarker.remove(); centerMarker = null; }
  if(ringsGroup){ ringsGroup.remove(); ringsGroup = null; }
}

document.getElementById('btnRedrawRings').addEventListener('click', drawRings);
document.getElementById('btnClearCenter').addEventListener('click', clearCenter);

window.addEventListener('load', initMap);

// --- Estimate ---
const fmt = (n)=> n.toLocaleString('en-US',{style:'currency',currency:'USD'});
function computeEstimate(){
  const qty = parseInt(document.getElementById('quantity').value || '0',10);
  const setup = parseFloat(document.getElementById('setupFee').value || '0');
  const unit = parseFloat(document.getElementById('unitCost').value || '0');
  const other = parseFloat(document.getElementById('otherCost').value || '0');
  const waves = Math.max(1, parseInt(document.getElementById('waves').value || '1',10));
  const total = (setup) + (qty * unit) + (other) + 0; // adjust if wave-based fees apply
  document.getElementById('estTotal').textContent = fmt(total);
}
['quantity','setupFee','unitCost','otherCost','waves']
  .forEach(id => document.getElementById(id).addEventListener('input', computeEstimate));
computeEstimate();

// --- Save Draft (localStorage) ---
const FORM_KEY = 'aa_proposal_draft_v1';
function saveDraft(){
  const data = Object.fromEntries(new FormData(document.getElementById('proposalForm')).entries());
  // Include map center (if placed) + rings
  data.mapCenter = centerMarker ? centerMarker.getLatLng() : null;
  data.rings = document.getElementById('ringMiles').value;
  localStorage.setItem(FORM_KEY, JSON.stringify(data));
  alert('Draft saved locally.');
}
document.getElementById('btnSaveDraft').addEventListener('click', saveDraft);

function loadDraft(){
  const raw = localStorage.getItem(FORM_KEY);
  if(!raw) return;
  try{
    const data = JSON.parse(raw);
    for(const [k,v] of Object.entries(data)){
      const el = document.getElementById(k);
      if(el && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)){
        el.value = v;
      }
    }
    if(data.mapCenter){
      centerMarker = L.marker(data.mapCenter, {draggable:true}).addTo(map);
      centerMarker.on('dragend', drawRings);
      drawRings();
    }
    computeEstimate();
  }catch(e){ console.warn('Draft load failed', e); }
}
window.addEventListener('load', ()=> setTimeout(loadDraft, 250));

// --- Reset ---
document.getElementById('btnReset').addEventListener('click', ()=>{
  document.getElementById('proposalForm').reset();
  computeEstimate();
  clearCenter();
});

// --- Submit (placeholder) ---
document.getElementById('proposalForm').addEventListener('submit', (e)=>{
  e.preventDefault();
  const payload = Object.fromEntries(new FormData(e.target).entries());
  payload.mapCenter = centerMarker ? centerMarker.getLatLng() : null;
  payload.rings = document.getElementById('ringMiles').value;
  console.log('Submit payload →', payload);
  alert('Proposal submitted (placeholder). Hook this to shared.js / backend as needed.');
});
