import { CONFIG } from './config.js';
import { fetchCSV } from './shared.js';

const STORAGE_KEY = 'accelrfx_profile_ACTIVE';

// Canonical profile schema
export const ProfileSchema = {
  id: 'USR001',
  defaultSiteId: 'primary', // 'primary' or a site.id
  company: {
    name: 'Smith Engineering',
    dba: '',
    website: '',
    brandColor: '#2F5597',
    tagline: '',
    description: '',
    naics: '',
    capabilities: ''
  },
  contacts: {
    primary: { name: 'Jane Smith', title: 'Principal', email: 'jane@example.com', phone: '' },
    secondary: { name: '', title: '', email: '', phone: '' }
  },
  compliance: {
    certifications: '',
    insurance: '',
    licenses: '',
    referralPolicy: ''
  },
  social: {
    linkedin: '',
    youtube: '',
    x: '',
    facebook: ''
  },
  media: {
    videoUrl: '',
    logoUrl: ''
  },
  primarySite: {
    addr1: '', addr2: '', city: '', state: '', postal: '', country: 'USA',
    lat: 36.8508, lng: -76.2859
  },
  sites: []
};

export let activeUser = structuredClone(ProfileSchema);

// Helpers
export function getPrimarySite() {
  const id = activeUser.defaultSiteId;
  if (id && id !== 'primary') {
    const s = activeUser.sites.find(x => x.id === id);
    if (s && isFinite(s.lat) && isFinite(s.lng)) return s;
  }
  return activeUser.primarySite;
}

export function getVideoEmbed(url) {
  if (!url) return '';
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v');
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1);
      return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&rel=0`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1&muted=1`;
    }
  } catch {}
  return '';
}

export async function loadUserProfile() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try { activeUser = JSON.parse(saved); } catch {}
  } else if (CONFIG.MODE === 'local') {
    try {
      const users = await fetchCSV(CONFIG.DATA.USERS_CSV);
      const me = users.find(u => u.UserID === activeUser.id) || users[0];
      if (me) applyLocalUser(me);
    } catch (e) { console.warn('Local CSV load failed:', e); }
  } else if (CONFIG.MODE === 'remote' && CONFIG.BACKEND_URL) {
    try {
      const res = await fetch(`${CONFIG.BACKEND_URL}?action=getUsers`);
      const users = await res.json();
      const me = users.find(u => u.UserID === activeUser.id);
      if (me) applyRemoteUser(me);
    } catch (e) { console.warn('Remote user fetch failed:', e); }
  }
  persist();
  return activeUser;
}

export function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(activeUser));
}

function applyLocalUser(u) {
  activeUser.company.name = u.Company || activeUser.company.name;
  activeUser.contacts.primary.name = u.Name || activeUser.contacts.primary.name;
  activeUser.contacts.primary.email = u.Email || activeUser.contacts.primary.email;
  activeUser.primarySite.lat = parseFloat(u.PrimaryLat) || activeUser.primarySite.lat;
  activeUser.primarySite.lng = parseFloat(u.PrimaryLng) || activeUser.primarySite.lng;
  try { activeUser.sites = JSON.parse(u.SitesJSON || '[]'); } catch { activeUser.sites = []; }
  activeUser.defaultSiteId = u.DefaultSiteId || 'primary';
}

function applyRemoteUser(u) {
  activeUser.company.name = u.Name || activeUser.company.name;
  activeUser.company.website = u.Website || '';
  activeUser.contacts.primary.name = u.PrimaryName || u.Name || activeUser.contacts.primary.name;
  activeUser.contacts.primary.email = u.PrimaryEmail || activeUser.contacts.primary.email;
  activeUser.primarySite.lat = parseFloat(u.PrimaryLat) || activeUser.primarySite.lat;
  activeUser.primarySite.lng = parseFloat(u.PrimaryLng) || activeUser.primarySite.lng;
  try { activeUser.sites = JSON.parse(u.SitesJSON || '[]'); } catch { activeUser.sites = []; }
  activeUser.defaultSiteId = u.DefaultSiteId || 'primary';
}

// ---------- UI Wiring (profile.html) ----------
if (document.getElementById('profileForm')) {
  (async function initProfilePage(){
    await loadUserProfile();
    hydrateForm();
    initMap();
    bindEvents();
  })();
}

let map, primaryMarker, sitesLayer = L.layerGroup();

function initMap(){
  const c = getPrimarySite();
  map = L.map('profileMap', { zoomControl: true }).setView([c.lat, c.lng], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    detectRetina: true
  }).addTo(map);
  primaryMarker = L.marker([activeUser.primarySite.lat, activeUser.primarySite.lng]).addTo(map).bindTooltip('Primary');
  sitesLayer.addTo(map);
  renderSitesOnMap();
  setTimeout(()=> map.invalidateSize(), 0);
}

function renderSitesOnMap(){
  sitesLayer.clearLayers();
  activeUser.sites.forEach(s => {
    if (isFinite(s.lat) && isFinite(s.lng)) {
      const m = L.marker([s.lat, s.lng]);
      const label = s.name || s.addr1 || 'Site';
      m.bindTooltip(activeUser.defaultSiteId === s.id ? `${label} (Default)` : label);
      sitesLayer.addLayer(m);
    }
  });
}

function hydrateForm(){
  // Company
  document.getElementById('companyName').value = activeUser.company.name || '';
  document.getElementById('companyDBA').value = activeUser.company.dba || '';
  document.getElementById('companyWebsite').value = activeUser.company.website || '';
  document.getElementById('brandColor').value = activeUser.company.brandColor || '#2F5597';
  document.getElementById('tagline').value = activeUser.company.tagline || '';
  document.getElementById('companyDescription').value = activeUser.company.description || '';
  document.getElementById('naics').value = activeUser.company.naics || '';
  document.getElementById('capabilities').value = activeUser.company.capabilities || '';

  // Contacts
  document.getElementById('primaryName').value = activeUser.contacts.primary.name || '';
  document.getElementById('primaryTitle').value = activeUser.contacts.primary.title || '';
  document.getElementById('primaryEmail').value = activeUser.contacts.primary.email || '';
  document.getElementById('primaryPhone').value = activeUser.contacts.primary.phone || '';
  document.getElementById('secondaryName').value = activeUser.contacts.secondary.name || '';
  document.getElementById('secondaryTitle').value = activeUser.contacts.secondary.title || '';
  document.getElementById('secondaryEmail').value = activeUser.contacts.secondary.email || '';
  document.getElementById('secondaryPhone').value = activeUser.contacts.secondary.phone || '';

  // Compliance
  document.getElementById('certifications').value = activeUser.compliance.certifications || '';
  document.getElementById('insurance').value = activeUser.compliance.insurance || '';
  document.getElementById('licenses').value = activeUser.compliance.licenses || '';
  document.getElementById('referralPolicy').value = activeUser.compliance.referralPolicy || '';

  // Social
  document.getElementById('socialLinkedIn').value = activeUser.social.linkedin || '';
  document.getElementById('socialYouTube').value = activeUser.social.youtube || '';
  document.getElementById('socialX').value = activeUser.social.x || '';
  document.getElementById('socialFacebook').value = activeUser.social.facebook || '';

  // Media
  document.getElementById('videoUrl').value = activeUser.media.videoUrl || '';
  document.getElementById('logoUrl').value = activeUser.media.logoUrl || '';

  // Primary site
  document.getElementById('addr1').value = activeUser.primarySite.addr1 || '';
  document.getElementById('addr2').value = activeUser.primarySite.addr2 || '';
  document.getElementById('city').value = activeUser.primarySite.city || '';
  document.getElementById('state').value = activeUser.primarySite.state || '';
  document.getElementById('postal').value = activeUser.primarySite.postal || '';
  document.getElementById('country').value = activeUser.primarySite.country || 'USA';
  document.getElementById('lat').value = activeUser.primarySite.lat ?? '';
  document.getElementById('lng').value = activeUser.primarySite.lng ?? '';

  // Default radio
  document.getElementById('defaultPrimary').checked = (activeUser.defaultSiteId === 'primary');

  renderSitesList();
}

function bindEvents(){
  document.getElementById('profileForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    // Save back
    activeUser.company.name = document.getElementById('companyName').value.trim();
    activeUser.company.dba = document.getElementById('companyDBA').value.trim();
    activeUser.company.website = document.getElementById('companyWebsite').value.trim();
    activeUser.company.brandColor = document.getElementById('brandColor').value.trim() || '#2F5597';
    activeUser.company.tagline = document.getElementById('tagline').value.trim();
    activeUser.company.description = document.getElementById('companyDescription').value.trim();
    activeUser.company.naics = document.getElementById('naics').value.trim();
    activeUser.company.capabilities = document.getElementById('capabilities').value.trim();

    activeUser.contacts.primary.name = document.getElementById('primaryName').value.trim();
    activeUser.contacts.primary.title = document.getElementById('primaryTitle').value.trim();
    activeUser.contacts.primary.email = document.getElementById('primaryEmail').value.trim();
    activeUser.contacts.primary.phone = document.getElementById('primaryPhone').value.trim();

    activeUser.contacts.secondary.name = document.getElementById('secondaryName').value.trim();
    activeUser.contacts.secondary.title = document.getElementById('secondaryTitle').value.trim();
    activeUser.contacts.secondary.email = document.getElementById('secondaryEmail').value.trim();
    activeUser.contacts.secondary.phone = document.getElementById('secondaryPhone').value.trim();

    activeUser.compliance.certifications = document.getElementById('certifications').value.trim();
    activeUser.compliance.insurance = document.getElementById('insurance').value.trim();
    activeUser.compliance.licenses = document.getElementById('licenses').value.trim();
    activeUser.compliance.referralPolicy = document.getElementById('referralPolicy').value.trim();

    activeUser.social.linkedin = document.getElementById('socialLinkedIn').value.trim();
    activeUser.social.youtube = document.getElementById('socialYouTube').value.trim();
    activeUser.social.x = document.getElementById('socialX').value.trim();
    activeUser.social.facebook = document.getElementById('socialFacebook').value.trim();

    activeUser.media.videoUrl = document.getElementById('videoUrl').value.trim();
    activeUser.media.logoUrl = document.getElementById('logoUrl').value.trim();

    activeUser.primarySite.addr1 = document.getElementById('addr1').value.trim();
    activeUser.primarySite.addr2 = document.getElementById('addr2').value.trim();
    activeUser.primarySite.city = document.getElementById('city').value.trim();
    activeUser.primarySite.state = document.getElementById('state').value.trim();
    activeUser.primarySite.postal = document.getElementById('postal').value.trim();
    activeUser.primarySite.country = document.getElementById('country').value.trim() || 'USA';
    activeUser.primarySite.lat = parseFloat(document.getElementById('lat').value) || activeUser.primarySite.lat;
    activeUser.primarySite.lng = parseFloat(document.getElementById('lng').value) || activeUser.primarySite.lng;

    // defaultSiteId is set by radio change handlers

    persist();
    renderSitesOnMap();
    alert('Profile saved.');
  });

  document.getElementById('addSiteBtn').addEventListener('click', ()=>{
    const id = crypto.randomUUID ? crypto.randomUUID() : ('SITE_' + Math.random().toString(36).slice(2,8));
    activeUser.sites.push({
      id, name:'', addr1:'', addr2:'', city:'', state:'', postal:'', country:'USA', lat: undefined, lng: undefined
    });
    persist();
    renderSitesList();
    renderSitesOnMap();
  });

  // Primary default radio
  const defaultPrimary = document.getElementById('defaultPrimary');
  defaultPrimary.addEventListener('change', ()=>{
    if (defaultPrimary.checked) {
      activeUser.defaultSiteId = 'primary';
      persist();
      renderSitesOnMap();
    }
  });
}

function renderSitesList(){
  const container = document.getElementById('sitesList');
  container.innerHTML = '';

  activeUser.sites.forEach((s, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'site-block';
    wrap.dataset.id = s.id;

    wrap.innerHTML = `
      <div class="site-block-header">
        <div class="site-block-title">
          <input type="radio" name="defaultSite" ${activeUser.defaultSiteId === s.id ? 'checked' : ''} aria-label="Set default" class="site-default-radio" />
          <input type="text" class="site-name" placeholder="Site Label (e.g., HQ, Plant #2)" value="${s.name || ''}"/>
        </div>
        <div class="site-actions">
          <button type="button" class="icon-btn site-remove">Remove</button>
        </div>
      </div>
      <div class="form-grid">
        <label>Address Line 1<input class="site-addr1" value="${s.addr1 || ''}"/></label>
        <label>Address Line 2<input class="site-addr2" value="${s.addr2 || ''}"/></label>
        <label>City<input class="site-city" value="${s.city || ''}"/></label>
        <label>State/Region<input class="site-state" value="${s.state || ''}"/></label>
        <label>Postal Code<input class="site-postal" value="${s.postal || ''}"/></label>
        <label>Country<input class="site-country" value="${s.country || 'USA'}"/></label>
        <label>Latitude<input type="number" step="any" class="site-lat" value="${isFinite(s.lat) ? s.lat : ''}"/></label>
        <label>Longitude<input type="number" step="any" class="site-lng" value="${isFinite(s.lng) ? s.lng : ''}"/></label>
      </div>
    `;

    // Wire inputs
    const radio = wrap.querySelector('.site-default-radio');
    radio.addEventListener('change', ()=>{
      if (radio.checked) {
        activeUser.defaultSiteId = s.id;
        persist(); renderSitesOnMap();
      }
    });

    wrap.querySelector('.site-remove').addEventListener('click', ()=>{
      activeUser.sites = activeUser.sites.filter(x => x.id !== s.id);
      if (activeUser.defaultSiteId === s.id) activeUser.defaultSiteId = 'primary';
      persist(); renderSitesList(); renderSitesOnMap();
    });

    const bind = (sel, key, transform=(v)=>v)=>{
      wrap.querySelector(sel).addEventListener('input', (e)=>{
        s[key] = transform(e.target.value);
        persist();
      });
    };
    bind('.site-name','name');
    bind('.site-addr1','addr1');
    bind('.site-addr2','addr2');
    bind('.site-city','city');
    bind('.site-state','state');
    bind('.site-postal','postal');
    bind('.site-country','country');
    bind('.site-lat','lat', v => { const n = parseFloat(v); return isFinite(n)?n:undefined; });
    bind('.site-lng','lng', v => { const n = parseFloat(v); return isFinite(n)?n:undefined; });

    container.appendChild(wrap);
  });
}
