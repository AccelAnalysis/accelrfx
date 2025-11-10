import { CONFIG } from './config.js';
import { updateCreditDisplay, fetchCSV, fitMapToMarkers, invalidateMap, debounce } from './shared.js';
import { activeUser, loadUserProfile, getPrimarySite, getVideoEmbed } from './profile.js';

let map;
let userMarker;
const resultsLayer = L.layerGroup();
const userSitesLayer = L.layerGroup();

async function init() {
  const user = await loadUserProfile();
  updateCreditDisplay(user?.credits ?? CONFIG.CREDITS.STARTING);

  const profileBtn = document.getElementById('profileBtn');
  if (profileBtn) profileBtn.addEventListener('click', ()=> window.location.href = 'profile.html');

  const center = getPrimarySite();
  map = L.map('map', { zoomControl: false }).setView([center.lat, center.lng], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    detectRetina: true
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);
  addMapControls();

  userMarker = L.marker([center.lat, center.lng]).addTo(map);
  const video = getVideoEmbed(user.media?.videoUrl || '');
  const videoHTML = video ? `<div class="video-embed" style="margin-top:8px; border-radius:10px; overflow:hidden;">
      <iframe width="280" height="158" src="${video}" title="Profile Video"
        frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen></iframe></div>` : '';
  userMarker.bindPopup(`
    <div class="popup-content">
      <h3>${user.company?.name || 'My Company'}</h3>
      <p>${user.company?.tagline || ''}</p>
      <div class="popup-actions">
        <button class="popup-btn" data-action="create">Create RFPx</button>
        <button class="popup-btn" data-action="target">Target Market</button>
        <button class="popup-btn" data-action="responses">Responses</button>
        <button class="popup-btn" data-action="edit">Edit</button>
      </div>
      ${videoHTML}
    </div>
  `);

  userMarker.on('popupopen', () => {
    const container = userMarker.getPopup().getElement();
    container.querySelectorAll('.popup-btn').forEach(btn => {
      btn.addEventListener('click', () => handleUserPopup(btn.dataset.action));
    });
  });

  userSitesLayer.addTo(map);
  renderUserSites();

  resultsLayer.addTo(map);

  initDrawer();

  const onSearch = async () => {
    const q = document.getElementById('searchInput').value.trim().toLowerCase();
    await renderSearchResults(q);
  };
  document.getElementById('searchBtn').addEventListener('click', onSearch);
  document.getElementById('searchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onSearch();
  });

  window.addEventListener('resize', debounce(() => invalidateMap(map), 150));
  invalidateMap(map);

  if (window.AccelTargeting && window.AccelTargeting.initTargeting) {
    window.AccelTargeting.initTargeting(map);
  }
}

function renderUserSites(){
  userSitesLayer.clearLayers();
  (activeUser.sites || []).forEach(s => {
    if (isFinite(s.lat) && isFinite(s.lng)) {
      const m = L.marker([s.lat, s.lng]);
      const label = s.name || s.addr1 || 'Site';
      m.bindTooltip(activeUser.defaultSiteId === s.id ? `${label} (Default)` : label);
      userSitesLayer.addLayer(m);
    }
  });
  const c = getPrimarySite();
  if (userMarker) userMarker.setLatLng([c.lat, c.lng]);
}

function addMapControls() {
  const Recenter = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
      const btn = L.DomUtil.create('button', 'secondary-btn');
      btn.innerHTML = 'My Site';
      btn.title = 'Recenter to Default Site';
      L.DomEvent.on(btn, 'click', () => {
        const c = getPrimarySite();
        map.setView([c.lat, c.lng], 12);
      });
      return btn;
    }
  });
  map.addControl(new Recenter());

  const FitResults = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
      const btn = L.DomUtil.create('button', 'secondary-btn');
      btn.innerHTML = 'Results';
      btn.title = 'Zoom to Search Results';
      L.DomEvent.on(btn, 'click', () => fitMapToMarkers(map, resultsLayer));
      return btn;
    }
  });
  map.addControl(new FitResults());

  const Lasso = L.Control.extend({
    options: { position: 'topright' },
    onAdd: function() {
      const btn = L.DomUtil.create('button', 'secondary-btn');
      btn.innerHTML = 'Lasso';
      btn.title = 'Select markers (coming soon)';
      L.DomEvent.on(btn, 'click', () => alert('Lasso select coming soon.'));
      return btn;
    }
  });
  map.addControl(new Lasso());
}

function initDrawer() {
  const drawer = document.getElementById('drawerMenu');
  const toggle = document.getElementById('drawerToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      drawer.classList.toggle('open');
      invalidateMap(map);
    });
  }
  if (drawer) {
    drawer.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        const nav = li.dataset.nav;
        if (nav === 'create') window.location.href = 'proposal.html';
        if (nav === 'dashboard') window.location.href = 'index.html';
        if (nav === 'settings') window.location.href = 'profile.html';
      });
    });
  }
}

function handleUserPopup(action) {
  if (action === 'create') return window.location.href = 'proposal.html';
  if (action === 'target') {
    if (window.AccelTargeting && window.AccelTargeting.openTargetSheet) {
      window.AccelTargeting.openTargetSheet();
    }
    return;
  }
  if (action === 'responses') return alert('Responses view coming soon.');
  if (action === 'edit') return window.location.href = 'profile.html';
}

async function renderSearchResults(query) {
  resultsLayer.clearLayers();

  let records = [];
  if (CONFIG.MODE === 'remote' && CONFIG.BACKEND_URL) {
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}?action=getRFPs`);
      records = await res.json();
    } catch (e) { console.warn('Remote RFP fetch failed, falling back to local:', e); }
  }
  if (!records.length) {
    records = await fetchCSV(CONFIG.DATA.RFP_CSV);
  }

  const filtered = !query ? records : records.filter(r => {
    const t = `${r.Title} ${r.Description} ${r.Company} ${r.Tags}`.toLowerCase();
    return t.includes(query);
  });

  filtered.forEach(r => {
    const lat = parseFloat(r.Lat || r.lat);
    const lng = parseFloat(r.Lng || r.lon || r.long);
    if (isFinite(lat) && isFinite(lng)) {
      const m = L.marker([lat, lng]);
      m.bindPopup(`
        <div class="popup-content">
          <h3>${r.Title}</h3>
          <p><strong>Type:</strong> ${r.Type} &nbsp; <strong>Close:</strong> ${r.Close}</p>
          <p><strong>Company:</strong> ${r.Company}</p>
          <div class="popup-actions">
            <button class="popup-btn" data-act="opps">Opportunities</button>
            <button class="popup-btn" data-act="team">Team</button>
            <button class="popup-btn" data-act="profile">Profile</button>
            <button class="popup-btn" data-act="save">Save</button>
          </div>
        </div>
      `);
      m.on('popupopen', () => {
        const el = m.getPopup().getElement();
        el.querySelectorAll('.popup-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            if (act === 'opps') alert('Viewing org opportunities…');
            if (act === 'team') alert('Viewing team…');
            if (act === 'profile') alert('Opening profile…');
            if (act === 'save') alert('Saved vendor.');
          });
        });
      });
      resultsLayer.addLayer(m);
    }
  });

  if (resultsLayer.getLayers().length) fitMapToMarkers(map, resultsLayer);
  invalidateMap(map);
}

init();
