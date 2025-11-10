// scripts/map-sizer.js — keep Leaflet map sized to viewport
import { debounce, invalidateMap } from './shared.js';

const container = document.getElementById('mapContainer');

function resize(){
  if (!container) return;
  const header = document.querySelector('header, .aa-header');
  const footer = document.querySelector('footer, .aa-footer');
  const vh = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
  const headerH = header ? header.getBoundingClientRect().height : 0;
  const footerH = footer ? footer.getBoundingClientRect().height : 0;
  const target = Math.max(320, vh - headerH - footerH - 16);
  container.style.minHeight = `${target}px`;
  if (window.map) invalidateMap(window.map);
}

const doResize = debounce(resize, 100);
window.addEventListener('resize', doResize);
window.addEventListener('orientationchange', doResize);
document.addEventListener('DOMContentLoaded', resize);
setTimeout(resize, 200);
