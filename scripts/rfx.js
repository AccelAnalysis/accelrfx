// rfx.js — Create RFx page logic (AccelRFx)
// - Mounts Global Total Weight into existing persistent banner if present
// - Fixes Leaflet init (grey map) with invalidateSize on open
// - Wires Save / Publish / Cancel to shared.js (Apps Script backend)

(() => {
  const qs  = (s, r=document)=>r.querySelector(s);
  const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const byId= id=>document.getElementById(id);

  // ---------- Sticky KPI mount ----------
  function mountBanner() {
    // If your layout has a persistent banner actions container, inject into it
    const host = byId('aa-persistent-banner-actions');
    if (host) {
      host.innerHTML = `
        <div class="rfx-kpi-pill" style="margin-right:.5rem;">
          Global Total Weight: <span id="globalWeightDisplay">0%</span>
        </div>
        <span id="globalWeightWarn" style="display:none;color:#C0392B;font-weight:600;margin-right:1rem;">Must equal 100%</span>
        <button id="btnSave" class="aa-btn aa-btn--secondary">Save</button>
        <button id="btnSaveClose" class="aa-btn aa-btn--secondary">Save & Close</button>
        <button id="btnCloseNoSave" class="aa-btn aa-btn--secondary">Close without Saving</button>
        <button id="btnPublish" class="aa-btn aa-btn--primary">Publish</button>
        <button id="btnCancel" class="aa-btn aa-btn--danger" style="display:none;">Cancel RFx</button>
      `;
      return;
    }
    // Else show fallback sticky bar
    byId('rfx-sticky-fallback').style.display = '';
  }

  // ---------- Collapsibles ----------
  function initCollapsibles() {
    qsa('.aa-collapsible').forEach(sec => {
      const header = sec.querySelector('.aa-collapsible__toggle');
      const body   = sec.querySelector('.aa-collapsible__body');
      if (!header || !body) return;
      header.addEventListener('click', () => {
        const nowCollapsed = sec.getAttribute('data-collapsed') === 'true' ? false : true;
        sec.setAttribute('data-collapsed', nowCollapsed ? 'true' : 'false');
        body.style.display = nowCollapsed ? 'none' : '';
        if (!nowCollapsed && body.contains(byId('rfxMap'))) {
          setTimeout(()=> map?.invalidateSize(), 150);
        }
      });
      if (sec.getAttribute('data-collapsed') === 'true') body.style.display = 'none';
    });
  }

  // ---------- Map ----------
  let map, centerMarker=null, ringLayerGroup=null;

  function initMap() {
    const el = byId('rfxMap');
    if (!el) return;
    map = L.map(el, { zoomControl: true }).setView([36.85, -76.29], 11);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:'&copy; OpenStreetMap'
    }).addTo(map);
    ringLayerGroup = L.layerGroup().addTo(map);

    // grey map fix: invalidate once visible
    setTimeout(()=> map.invalidateSize(), 250);

    map.on('click', e => {
      if (byId('scopeSelect').value !== 'radius') return;
      setCenterMarker(e.latlng);
      redrawRings();
    });
  }
  function setCenterMarker(latlng){
    if (!centerMarker){
      centerMarker = L.marker(latlng, {draggable:true}).addTo(map);
      centerMarker.on('dragend', redrawRings);
    } else centerMarker.setLatLng(latlng);
  }
  const milesToMeters = mi => mi*1609.344;

  function redrawRings(){
    ringLayerGroup.clearLayers();
    if (!centerMarker) return;
    const raw = byId('ringMiles').value.trim();
    if (!raw) return;
    const distances = raw.split(',').map(s=>parseFloat(s)).filter(v=>!isNaN(v)&&v>0);
    if (!distances.length) return;
    const latlng = centerMarker.getLatLng();
    distances.sort((a,b)=>b-a).forEach(mi=>{
      L.circle(latlng,{radius:milesToMeters(mi),weight:2,fillOpacity:.07}).addTo(ringLayerGroup);
    });
  }

  function handleScopeChange(){
    const scope = byId('scopeSelect').value;
    byId('radiusControls').style.display = scope==='radius' ? '' : 'none';
    byId('geoControls').style.display    = scope==='geo'    ? '' : 'none';
    if (scope==='radius') setTimeout(()=> map?.invalidateSize(), 100);
  }

  async function loadSites(){
    let sites = [
      { id:'site-1', name:'Chesapeake HQ', lat:36.719, lon:-76.245 },
      { id:'site-2', name:'Norfolk Office', lat:36.8508, lon:-76.2859 },
      { id:'site-3', name:'Newport News Hub', lat:37.0871, lon:-76.4730 }
    ];
    try {
      if (window.shared?.getSites) {
        const res = await shared.getSites();
        if (Array.isArray(res) && res.length) sites = res;
      }
    } catch(e){ console.warn('getSites failed; using fallback.', e); }

    const sel = byId('siteSelect');
    sel.innerHTML = sites.map(s=>`<option value="${s.id}" data-lat="${s.lat}" data-lon="${s.lon}">${s.name}</option>`).join('');
    sel.addEventListener('change', ()=>{
      const o = sel.selectedOptions[0]; if(!o) return;
      const lat = parseFloat(o.dataset.lat), lon=parseFloat(o.dataset.lon);
      if (!isNaN(lat)&&!isNaN(lon)){
        map.setView([lat,lon], 12);
        if (byId('scopeSelect').value==='radius'){
          setCenterMarker({lat, lng:lon}); redrawRings();
        }
      }
    });
    if (sel.options.length) sel.dispatchEvent(new Event('change'));
  }

  // ---------- Tables + Weights ----------
  const weightDisplay = ()=> byId('globalWeightDisplay');
  const weightWarn    = ()=> byId('globalWeightWarn');

  function addDocRow(){
    const tb = byId('docsTable').querySelector('tbody');
    const tr = tb.insertRow();
    const now = new Date().toLocaleString();
    tr.insertCell().textContent = byId('docName').value || 'Untitled';
    tr.insertCell().textContent = 'RFx Document (Approved)';
    tr.insertCell().textContent = byId('docFile').files?.length ? '📎' : '';
    tr.insertCell().textContent = 'Current User';
    tr.insertCell().textContent = now;
    tr.insertCell().textContent = now;
    tr.insertCell().innerHTML = `<input type="date" class="aa-input">`;
    tr.insertCell().innerHTML = `<button type="button" class="aa-btn aa-btn--secondary">Remove</button>`;
    tr.lastChild.firstChild.addEventListener('click',()=>{ tr.remove(); updateDocCount(); });
    byId('docName').value=''; byId('docFile').value='';
    updateDocCount();
  }
  function updateDocCount(){
    const n = byId('docsTable').querySelectorAll('tbody tr').length;
    byId('docCount').textContent = `${n} Record(s)`;
  }

  function addRowGeneric(tid, cells){
    const tb = byId(tid).querySelector('tbody');
    const tr = tb.insertRow();
    cells.forEach(html=> { tr.insertCell().innerHTML = html; });
    // weight inputs trigger recompute
    tr.addEventListener('input', updateGlobalWeight);
    // add remove
    const last = tr.lastChild?.querySelector('button');
    if (last) last.addEventListener('click', ()=>{ tr.remove(); updateGlobalWeight(); });
    updateGlobalWeight();
  }

  function addSkillRow(){
    addRowGeneric('skillsTable', [
      `<input class="aa-input" type="text" value="New Skill">`,
      `<select class="aa-select"><option>Beginner</option><option>Intermediate</option><option>Expert</option></select>`,
      `<input type="checkbox" checked>`,
      `<input class="aa-input" type="number" min="0" max="100" step="0.5" value="0">`,
      `<button type="button" class="aa-btn aa-btn--secondary">Remove</button>`
    ]);
  }
  function addExperienceRow(){
    addRowGeneric('experienceTable', [
      `<input class="aa-input" type="text" value="New Project">`,
      `<textarea class="aa-textarea" rows="2"></textarea>`,
      `<input class="aa-input" type="number" min="0" value="0">`,
      `<input type="checkbox" checked>`,
      `<input class="aa-input" type="number" min="0" max="100" step="0.5" value="0">`,
      `<button type="button" class="aa-btn aa-btn--secondary">Remove</button>`
    ]);
  }
  function addCertRow(){
    addRowGeneric('certTable', [
      `<input class="aa-input" type="text" value="New Certification">`,
      `<input class="aa-input" type="text" placeholder="Issuing body">`,
      `<input class="aa-input" type="date">`,
      `<input class="aa-input" type="file">`,
      `<input type="checkbox" checked>`,
      `<input class="aa-input" type="number" min="0" max="100" step="0.5" value="0">`,
      `<button type="button" class="aa-btn aa-btn--secondary">Remove</button>`
    ]);
  }
  function addRefRow(){
    addRowGeneric('refTable', [
      `<select class="aa-select"><option>Business Reference</option><option>Personal Reference</option></select>`,
      `<input type="checkbox" checked>`,
      `<input class="aa-input" type="number" min="0" max="100" step="0.5" value="0">`,
      `<button type="button" class="aa-btn aa-btn--secondary">Remove</button>`
    ]);
  }

  let criteriaCounter = 0;
  function addCriterionRow(){
    const tb = byId('criteriaTable').querySelector('tbody');
    const tr = tb.insertRow();
    criteriaCounter += 1;
    tr.insertCell().textContent = criteriaCounter;
    tr.insertCell().innerHTML = `<input class="aa-input" type="text" value="New Criterion">`;
    tr.insertCell().innerHTML = `<textarea class="aa-textarea" rows="2"></textarea>`;
    tr.insertCell().innerHTML = `<input class="aa-input" type="number" min="0" max="100" step="0.5" value="0">`;
    const max = tr.insertCell(); max.textContent = '0';
    tr.insertCell().innerHTML = `
      <select class="aa-select">
        <option>Qualitative Narrative</option>
        <option>Scored Rubric (1-5)</option>
        <option>Pass/Fail</option>
        <option>Cost</option>
      </select>`;
    tr.insertCell().innerHTML = `<input type="checkbox" checked>`;
    tr.insertCell().innerHTML = `<input class="aa-input" type="file">`;
    tr.insertCell().innerHTML = `<button type="button" class="aa-btn aa-btn--secondary">Remove</button>`;
    tr.addEventListener('input', ()=>{
      const w = parseFloat(tr.cells[3].querySelector('input').value || '0');
      max.textContent = (w*10).toFixed(0);
      updateGlobalWeight();
    });
    tr.lastChild.firstChild.addEventListener('click', ()=>{
      tr.remove();
      qsa('#criteriaTable tbody tr').forEach((row,i)=> row.cells[0].textContent = String(i+1));
      criteriaCounter = qsa('#criteriaTable tbody tr').length;
      updateGlobalWeight();
    });
    updateGlobalWeight();
  }

  function addCostRow(){
    addRowGeneric('costTable', [
      `<input class="aa-input" type="text" value="New Item">`,
      `<input class="aa-input" type="number" min="0" value="0">`,
      `<textarea class="aa-textarea" rows="2"></textarea>`,
      `<input type="checkbox" checked>`,
      `<input class="aa-input" type="number" min="0" max="100" step="0.5" value="0">`,
      `<button type="button" class="aa-btn aa-btn--secondary">Remove</button>`
    ]);
  }

  function updateGlobalWeight(){
    const sets = [
      ['skillsTable',3],
      ['experienceTable',4],
      ['certTable',5],
      ['refTable',2],
      ['criteriaTable',3],
      ['costTable',4]
    ];
    let total=0;
    sets.forEach(([id,idx])=>{
      if (id==='costTable' && byId('costSection').style.display==='none') return;
      qsa(`#${id} tbody tr`).forEach(tr=>{
        const inp = tr.cells[idx]?.querySelector('input[type="number"]');
        if (inp) total += parseFloat(inp.value||'0');
      });
    });
    const disp = weightDisplay(); if (disp) disp.textContent = `${total.toFixed(1)}%`;
    const warn = weightWarn(); if (warn) warn.style.display = Math.abs(total-100)>0.001 ? '' : 'none';
  }

  function toggleCostSection(){
    const show = byId('oppType').value==='RFP';
    byId('costSection').style.display = show ? '' : 'none';
    updateGlobalWeight();
  }

  // ---------- Payload + API wiring ----------
  function tableToJson(id){
    const head = qsa(`#${id} thead th`).map(th=>th.textContent.trim());
    return qsa(`#${id} tbody tr`).map(tr=>{
      const obj={};
      qsa('td',tr).forEach((td,i)=>{
        const inp = td.querySelector('input,select,textarea');
        if (!inp){ obj[head[i]] = td.textContent.trim(); return; }
        if (inp.type==='checkbox') obj[head[i]] = inp.checked;
        else if (inp.type==='file') obj[head[i]] = inp.files && inp.files.length ? inp.files[0].name : '';
        else obj[head[i]] = (inp.value ?? '').toString();
      });
      return obj;
    });
  }

  function collectPayload(){
    return {
      meta:{
        bpCode: byId('bpCode').value.trim(),
        oppTitle: byId('oppTitle').value.trim(),
        oppType: byId('oppType').value,
        lot: byId('lot').value,
        round: byId('round').value,
        issuedDate: byId('issuedDate').value,
        closeDate: byId('closeDate').value,
        setAside: byId('setAside').value.trim(),
        process: byId('process').value,
        website: byId('website').value.trim(),
        summary: byId('summary').value.trim(),
        amendDesc: byId('amendDesc').value.trim(),
        cancelDesc: byId('cancelDesc').value.trim()
      },
      availability:{
        siteId: byId('siteSelect').value,
        scope: byId('scopeSelect').value,
        ringMiles: byId('ringMiles').value.trim(),
        geoList: byId('geoList').value.trim(),
        aopSearch: byId('aopSearch').value.trim(),
        center: centerMarker ? centerMarker.getLatLng() : null
      },
      docs: tableToJson('docsTable'),
      skills: tableToJson('skillsTable'),
      experience: tableToJson('experienceTable'),
      certs: tableToJson('certTable'),
      refs: tableToJson('refTable'),
      criteria: tableToJson('criteriaTable'),
      cost: (byId('costSection').style.display==='none') ? [] : tableToJson('costTable'),
      totalWeightPct: (byId('globalWeightDisplay')?.textContent || '0%')
    };
  }

  async function doSave(closeAfter=false){
    const payload = collectPayload();
    try{
      const res = await shared.saveRFx(payload); // returns {id}
      alert('Saved.');
      if (closeAfter) window.history.back();
      // After first save, publishing and canceling can reference id
      if (res?.id) sessionStorage.setItem('current_rfx_id', res.id);
      showCancelIfPublished(false);
    }catch(e){ console.error(e); alert('Save failed.'); }
  }

  async function doPublish(){
    const total = parseFloat((byId('globalWeightDisplay')?.textContent||'0').replace('%','')||'0');
    if (Math.abs(total-100)>0.001){ alert('Global Total Weight must equal 100% to publish.'); return; }
    const id = sessionStorage.getItem('current_rfx_id');
    if (!id){ await doSave(false); }
    const rfxId = sessionStorage.getItem('current_rfx_id');
    try{
      await shared.publishRFx(rfxId);
      alert('Published.');
      showCancelIfPublished(true);
    }catch(e){ console.error(e); alert('Publish failed.'); }
  }

  function showCancelIfPublished(isPublished){
    const btn = byId('btnCancel'); if (btn) btn.style.display = isPublished ? '' : 'none';
  }

  // Cancel modal
  function openCancel(){ byId('cancelModal').style.display=''; }
  function closeCancel(){ byId('cancelModal').style.display='none'; }
  async function submitCancel(){
    const reason = byId('cancelReason').value.trim();
    if (!reason){ alert('Please provide a reason.'); return; }
    const id = sessionStorage.getItem('current_rfx_id');
    if (!id){ alert('Save or publish the RFx first.'); return; }
    try{
      await shared.cancelRFx(id, reason);
      byId('cancelDesc').value += (byId('cancelDesc').value?'\n':'') + `Reason: ${reason}`;
      alert('RFx canceled.');
      closeCancel();
    }catch(e){ console.error(e); alert('Cancel failed.'); }
  }

  // ---------- Wire ----------
  function wire(){
    // header mount
    mountBanner();

    // issued now (UTC-5 approx)
    const now = new Date(); const utc5 = new Date(now.getTime() - (now.getTimezoneOffset()+300)*60000);
    byId('issuedDate').value = utc5.toISOString().slice(0,16);

    // sections and map
    initCollapsibles(); initMap(); loadSites();
    byId('scopeSelect').addEventListener('change', handleScopeChange);
    byId('btnRedrawRings').addEventListener('click', redrawRings);
    handleScopeChange();

    // adders
    byId('addDocBtn').addEventListener('click', addDocRow);
    byId('addSkillBtn').addEventListener('click', addSkillRow);
    byId('addExpBtn').addEventListener('click', addExperienceRow);
    byId('addCertBtn').addEventListener('click', addCertRow);
    byId('addRefBtn').addEventListener('click', addRefRow);
    byId('addCritBtn').addEventListener('click', addCriterionRow);
    byId('addCostBtn').addEventListener('click', addCostRow);

    // type toggle
    byId('oppType').addEventListener('change', toggleCostSection);
    toggleCostSection();

    // inputs cause weight recompute
    qsa('table').forEach(t=> t.addEventListener('input', updateGlobalWeight));
    updateGlobalWeight();

    // banner buttons
    byId('btnSave').addEventListener('click', ()=>doSave(false));
    byId('btnSaveClose').addEventListener('click', ()=>doSave(true));
    byId('btnCloseNoSave').addEventListener('click', ()=>window.history.back());
    byId('btnPublish').addEventListener('click', doPublish);
    byId('btnCancel').addEventListener('click', openCancel);

    // cancel modal buttons
    byId('cancelModalClose').addEventListener('click', closeCancel);
    byId('cancelDismiss').addEventListener('click', closeCancel);
    byId('cancelSubmit').addEventListener('click', submitCancel);
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
