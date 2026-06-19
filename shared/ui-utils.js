/* ═══════════════════════════════════════════════════════
   ui-utils.js  v3 —  Modales · Pickers · Logo · Loading · Tema
   Congregación Sur · Territory App
   ═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   THEME SYSTEM — Variables CSS
───────────────────────────────────────── */
(function injectThemeVars() {
  const style = document.createElement('style');
  style.id = 'ui-theme-vars';
  style.textContent = `
:root {
  /* ── MODO OSCURO (default) ── */
  --bg-primary:    #1a1c1f;
  --bg-secondary:  #232628;
  --bg-card:       #232628;
  --bg-hover:      #272a2e;
  --bg-input:      #232628;
  --bg-modal:      #232628;
  --bg-header:     #232628;
  --bg-badge:      rgba(127,119,221,0.10);

  --text-primary:  #e8e8e8;
  --text-secondary:#aaa;
  --text-muted:    #666;
  --text-dim:      #666;

  --border-primary:#2e3033;
  --border-light:  #3a3d42;
  --border-input:  #4a4d52;

  --shadow-card:   0 2px 12px rgba(0,0,0,0.25);
  --shadow-hover:  0 8px 28px rgba(0,0,0,0.24);

  --accent:        #7F77DD;
  --accent-hover:  #6a62cc;
  --toggle-bg:     #232628;
  --toggle-knob:   #e8e8e8;
}

/* ── MODO CLARO — respeta estructura visual, colores claros ── */
body.light-mode {
  --bg-primary:    #f4f5f7;
  --bg-secondary:  #ffffff;
  --bg-card:       #ffffff;
  --bg-hover:      #ebebef;
  --bg-input:      #ffffff;
  --bg-modal:      #ffffff;
  --bg-header:     #ffffff;
  --bg-badge:      rgba(127,119,221,0.08);

  --text-primary:  #18191c;
  --text-secondary:#5a5a68;
  --text-muted:    #9595a2;
  --text-dim:      #9595a2;

  --border-primary:#dddde3;
  --border-light:  #d2d3dd;
  --border-input:  #b8b8c2;

  --shadow-card:   0 8px 24px rgba(47,55,78,0.08);
  --shadow-hover:  0 14px 34px rgba(47,55,78,0.14);

  --accent:        #7F77DD;
  --accent-hover:  #6a62cc;
  --toggle-bg:     #ffffff;
  --toggle-knob:   #18191c;
}

/* ── Background del body ── */
body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color .25s, color .25s;
}
body:not(.light-mode) {
  background-image:
    radial-gradient(ellipse at 18% 22%, rgba(55,138,221,0.13) 0%, transparent 52%),
    radial-gradient(ellipse at 82% 78%, rgba(127,119,221,0.11) 0%, transparent 52%),
    radial-gradient(ellipse at 60% 10%, rgba(29,158,117,0.07) 0%, transparent 40%);
}
body.light-mode {
  background-image:
    radial-gradient(ellipse at 60% 15%, rgba(55,138,221,0.13) 0%, transparent 55%),
    radial-gradient(ellipse at 18% 80%, rgba(29,158,117,0.09) 0%, transparent 48%),
    radial-gradient(ellipse at 85% 20%, rgba(127,119,221,0.16) 0%, transparent 52%),
    radial-gradient(ellipse at 40% 90%, rgba(155,143,255,0.08) 0%, transparent 46%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
}

/* ── Botón toggle tema ── */
.theme-toggle {
  position: fixed;
  bottom: 20px;
  left: 20px;
  width: 44px;
  height: 44px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  transition: background .15s, border-color .15s, color .15s;
}
.theme-toggle:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
  color: var(--text-primary);
}
body.en-menu .theme-toggle { display: none !important; }
`;
  document.head.appendChild(style);
})();

/* ─────────────────────────────────────────
   THEME TOGGLE — Lógica
───────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('ziv-theme');
  if (saved === 'light') document.body.classList.add('light-mode');
})();

window.uiToggleTheme = function() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('ziv-theme', isLight ? 'light' : 'dark');
  // Actualizar iconos
  const sun = document.getElementById('theme-icon-sun');
  const moon = document.getElementById('theme-icon-moon');
  if (sun) sun.style.display = isLight ? '' : 'none';
  if (moon) moon.style.display = isLight ? 'none' : '';
  document.querySelectorAll('[data-theme-sun]').forEach(el => {
    el.style.display = isLight ? '' : 'none';
  });
  document.querySelectorAll('[data-theme-moon]').forEach(el => {
    el.style.display = isLight ? 'none' : '';
  });
};

// Insertar botón toggle cuando el DOM esté listo
// SOLO en el index.html raíz (página de congregaciones)
function shouldShowThemeToggle() {
  const path = window.location.pathname;
  // Mostrar solo en /index.html o / (raíz), NO en subcarpetas como /territorios/index.html
  return path === '/' || path === '/index.html';
}

function insertThemeToggle() {
  if (document.querySelector('[data-theme-sun], [data-theme-moon]')) return;
  if (!shouldShowThemeToggle()) return;
  if (document.getElementById('btn-theme')) return;
  const btn = document.createElement('button');
  btn.className = 'theme-toggle';
  btn.id = 'btn-theme';
  btn.title = 'Cambiar tema';
  btn.onclick = window.uiToggleTheme;
  btn.innerHTML = `
    <svg id="theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" style="display:${document.body.classList.contains('light-mode') ? '' : 'none'};">
      <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.8"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
    <svg id="theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" style="display:${document.body.classList.contains('light-mode') ? 'none' : ''};">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  document.body.appendChild(btn);
}
if (document.body) insertThemeToggle();
else document.addEventListener('DOMContentLoaded', insertThemeToggle);

/* ─────────────────────────────────────────
   CSS GLOBAL
───────────────────────────────────────── */
(function injectCSS() {
  const style = document.createElement('style');
  style.textContent = `
/* ── Modal base ── */
.ui-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex; align-items: center; justify-content: center;
  z-index: 9000; padding: 1rem;
  animation: uiFadeIn 0.15s ease;
}
@keyframes uiFadeIn { from { opacity:0 } to { opacity:1 } }

.ui-modal {
  background: var(--bg-modal);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  padding: 1.75rem 1.5rem 1.5rem;
  width: 100%; max-width: 340px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  animation: uiSlideUp 0.18s ease;
}
@keyframes uiSlideUp { from { transform:translateY(12px); opacity:0 } to { transform:translateY(0); opacity:1 } }

.ui-modal-icon {
  width: 48px; height: 48px; border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 14px; font-size: 22px;
}
.ui-modal-icon.warn   { background: rgba(239,159,39,0.15); }
.ui-modal-icon.danger { background: rgba(240,149,149,0.15); }
.ui-modal-icon.info   { background: rgba(29,158,117,0.15); }
.ui-modal-icon.purple { background: rgba(127,119,221,0.15); }

.ui-modal-title {
  font-size: 17px; font-weight: 600; color: var(--text-primary);
  text-align: center; margin-bottom: 8px;
}
.ui-modal-msg {
  font-size: 14px; color: var(--text-secondary); text-align: center;
  line-height: 1.5; margin-bottom: 20px;
}
.ui-modal-btns { display: flex; gap: 8px; }
.ui-modal-btns button {
  flex: 1; padding: 11px;
  font-size: 14px; font-weight: 500;
  border-radius: 12px; border: none; cursor: pointer;
  transition: filter 0.1s, transform 0.1s;
}
.ui-modal-btns button:active { transform: scale(0.97); }
.ui-btn-cancel  { background: var(--bg-header); color: var(--text-secondary); border: 0.5px solid var(--border-input) !important; }
.ui-btn-cancel:hover { filter: brightness(1.15); }
.ui-btn-confirm-warn   { background: #EF9F27; color: #fff; }
.ui-btn-confirm-danger { background: #A32D2D; color: #F09595; }
.ui-btn-confirm-info   { background: #1D9E75; color: #fff; }
.ui-btn-confirm-purple { background: #7F77DD; color: #fff; }
.ui-btn-confirm-warn:hover,
.ui-btn-confirm-danger:hover,
.ui-btn-confirm-info:hover,
.ui-btn-confirm-purple:hover { filter: brightness(1.1); }
.ui-btn-ok { background: var(--bg-header); color: var(--text-primary); border: 0.5px solid var(--border-input) !important; }
.ui-btn-ok:hover { filter: brightness(1.15); }

/* ═══════════════════════════════════════════
   BOTTOM SHEET base (date, time, conductor, territorio)
═══════════════════════════════════════════ */
.bs-overlay {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.72);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 9100;
  animation: uiFadeIn 0.15s ease;
}
@media (min-height: 600px) {
  .bs-overlay { align-items: center; padding: 1rem; }
}
.bs-card {
  background: var(--bg-modal);
  border: 1px solid var(--border-light);
  border-radius: 24px 24px 0 0;
  width: 100%; max-width: 480px;
  box-shadow: 0 -16px 48px rgba(0,0,0,0.5);
  animation: bsSlideUp 0.22s cubic-bezier(.22,.68,0,1.2);
  user-select: none; overflow: hidden;
}
@media (min-height: 600px) {
  .bs-card { border-radius: 24px; box-shadow: 0 24px 64px rgba(0,0,0,0.6); }
}
@keyframes bsSlideUp { from { transform:translateY(40px); opacity:0 } to { transform:translateY(0); opacity:1 } }

.bs-handle {
  width: 36px; height: 4px; border-radius: 2px;
  background: var(--border-input); margin: 12px auto 0;
}
.bs-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 10px;
}
.bs-title { font-size: 15px; font-weight: 600; color: var(--text-primary); }
.bs-close-btn {
  width: 30px; height: 30px; border-radius: 8px;
  border: 0.5px solid var(--border-input); background: var(--bg-input); color: var(--text-muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.1s;
}
.bs-close-btn:hover { background: var(--bg-hover); color: var(--text-primary); }

.bs-footer {
  display: flex; gap: 8px; padding: 12px 16px 16px;
}
.bs-footer button {
  flex: 1; padding: 11px; font-size: 14px; font-weight: 500;
  border-radius: 12px; border: none; cursor: pointer; transition: filter 0.1s;
}
.bs-btn-cancel { background: var(--bg-header); color: var(--text-secondary); border: 0.5px solid var(--border-input) !important; }
.bs-btn-cancel:hover { filter: brightness(1.15); }
.bs-btn-ok { background: #185FA5; color: #fff; }
.bs-btn-ok:hover { filter: brightness(1.1); }

/* ═══════════════════════════════════════════
   DATE PICKER
═══════════════════════════════════════════ */
.dp-nav-btn {
  width: 34px; height: 34px; border-radius: 10px;
  border: 0.5px solid var(--border-input); background: var(--bg-input); color: var(--text-secondary);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  font-size: 16px; transition: background 0.1s, color 0.1s;
}
.dp-nav-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
.dp-month-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px 10px;
}
.dp-month-title { font-size: 14px; font-weight: 600; color: var(--text-primary); }
.dp-weekdays {
  display: grid; grid-template-columns: repeat(7,1fr);
  text-align: center; padding: 0 10px; margin-bottom: 4px;
}
.dp-wd { font-size: 11px; font-weight: 600; color: var(--text-dim); padding: 4px 0; }
.dp-days {
  display: grid; grid-template-columns: repeat(7,1fr);
  gap: 2px; padding: 0 10px;
}
.dp-day {
  aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 500; color: var(--text-secondary);
  border-radius: 10px; cursor: pointer;
  transition: background 0.1s; border: none; background: transparent;
}
.dp-day:hover:not(.dp-day-other):not(.dp-day-disabled) { background: var(--bg-header); color: var(--text-primary); }
.dp-day-other    { color: var(--text-dim); cursor: default; }
.dp-day-disabled { color: var(--text-muted); cursor: not-allowed; }
.dp-day-today    { color: #97C459; font-weight: 700; }
.dp-day-selected { background: #185FA5 !important; color: #fff !important; font-weight: 700; }

/* ═══════════════════════════════════════════
   TIME PICKER
═══════════════════════════════════════════ */
.tp-display {
  display: flex; align-items: center; justify-content: center;
  gap: 4px; padding: 4px 16px 16px;
}
.tp-display-num {
  font-size: 52px; font-weight: 300; color: var(--text-primary);
  min-width: 80px; text-align: center; line-height: 1;
  background: var(--bg-input); border-radius: 14px; padding: 8px 12px;
  cursor: pointer; transition: background 0.1s;
}
.tp-display-num.active { background: #185FA5; color: #fff; }
.tp-display-num:hover:not(.active) { background: var(--bg-hover); }
.tp-display-sep { font-size: 44px; font-weight: 300; color: var(--text-dim); line-height: 1; }
.tp-numpad {
  display: grid; grid-template-columns: repeat(3,1fr); gap: 8px;
  padding: 0 16px 4px;
}
.tp-num-btn {
  padding: 14px; font-size: 20px; font-weight: 400; color: var(--text-primary);
  background: var(--bg-input); border: none; border-radius: 12px; cursor: pointer;
  transition: background 0.1s, transform 0.08s;
}
.tp-num-btn:hover { background: var(--bg-hover); }
.tp-num-btn:active { transform: scale(0.93); background: var(--bg-header); }
.tp-num-btn.tp-del { color: #F09595; background: rgba(240,149,149,0.1); }
.tp-num-btn.tp-del:hover { background: rgba(240,149,149,0.15); }
.tp-num-btn.tp-empty { background: transparent; cursor: default; }

/* ═══════════════════════════════════════════
   CONDUCTOR PICKER
═══════════════════════════════════════════ */
.cp-search-wrap {
  padding: 0 14px 10px;
  display: flex; align-items: center; gap: 8px;
}
.cp-search-input {
  flex: 1; padding: 9px 12px;
  background: var(--bg-input); border: 0.5px solid var(--border-input); border-radius: 10px;
  color: var(--text-primary); font-size: 14px; outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.cp-search-input:focus { border-color: var(--border-light); }
.cp-search-icon {
  color: var(--text-dim); flex-shrink: 0;
  display: flex; align-items: center;
}
.cp-list {
  max-height: 280px; overflow-y: auto;
  padding: 0 6px 10px;
}
.cp-list::-webkit-scrollbar { width: 3px; }
.cp-list::-webkit-scrollbar-track { background: transparent; }
.cp-list::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 2px; }
.cp-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  transition: background 0.1s; border: none; background: transparent;
  width: 100%; text-align: left;
}
.cp-item:hover { background: var(--bg-hover); }
.cp-item.selected { background: rgba(24,95,165,0.18); }
.cp-item-avatar {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg-hover); border: 1px solid var(--border-light);
  display: flex; align-items: center; justify-content: center;
  font-size: 12px; font-weight: 700; color: var(--text-muted);
  text-transform: uppercase;
}
.cp-item.selected .cp-item-avatar {
  background: rgba(24,95,165,0.25); border-color: #185FA5; color: #85B7EB;
}
.cp-item-name { font-size: 14px; font-weight: 500; color: var(--text-primary); flex: 1; }
.cp-item.selected .cp-item-name { color: var(--text-primary); }
.cp-item-check {
  color: #185FA5; flex-shrink: 0;
  opacity: 0; transition: opacity 0.1s;
  display: flex; align-items: center;
}
.cp-item.selected .cp-item-check { opacity: 1; }
.cp-empty { text-align: center; padding: 28px 16px; color: var(--text-dim); font-size: 13px; }
.cp-divider {
  height: 0.5px; background: var(--border-primary);
  margin: 2px 10px 6px;
}
.cp-sin-asignar {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  border: none; background: transparent; width: 100%; text-align: left;
  transition: background 0.1s;
}
.cp-sin-asignar:hover { background: var(--bg-hover); }
.cp-sin-asignar-icon {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: var(--bg-modal); border: 1px solid var(--border-light);
  display: flex; align-items: center; justify-content: center;
}
.cp-sin-asignar-txt { font-size: 13px; color: var(--text-muted); }

/* ═══════════════════════════════════════════
   TERRITORIO PICKER
═══════════════════════════════════════════ */
.tp-search-wrap {
  padding: 0 14px 10px;
  display: flex; align-items: center; gap: 8px;
}
.tp-search-input {
  flex: 1; padding: 9px 12px;
  background: var(--bg-input); border: 0.5px solid var(--border-input); border-radius: 10px;
  color: var(--text-primary); font-size: 14px; outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.tp-search-input:focus { border-color: var(--border-light); }
.tp-search-icon {
  color: var(--text-dim); flex-shrink: 0;
  display: flex; align-items: center;
}
.tp-list {
  max-height: min(55vh, 420px); overflow-y: auto;
  padding: 0 6px 10px;
}
.tp-list::-webkit-scrollbar { width: 3px; }
.tp-list::-webkit-scrollbar-track { background: transparent; }
.tp-list::-webkit-scrollbar-thumb { background: #3a3a3a; border-radius: 2px; }
.tp-section-title {
  font-size: 11px; font-weight: 700; color: var(--text-dim);
  text-transform: uppercase; letter-spacing: 0.05em;
  padding: 10px 10px 6px; margin-top: 4px;
}
.tp-item {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border-radius: 10px; cursor: pointer;
  transition: background 0.1s; border: none; background: transparent;
  width: 100%; text-align: left;
}
.tp-item:hover { background: var(--bg-hover); }
.tp-item-num {
  width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
  background: var(--bg-hover); border: 1px solid var(--border-light);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: var(--text-secondary);
}
.tp-item-info { flex: 1; }
.tp-item-label { font-size: 13px; font-weight: 500; color: var(--text-primary); }
.tp-item-days { font-size: 11px; color: var(--text-muted); }
.tp-empty { text-align: center; padding: 28px 16px; color: var(--text-dim); font-size: 13px; }
.tp-divider {
  height: 0.5px; background: var(--border-primary);
  margin: 2px 10px 6px;
}
.tp-expand-btn {
  display: flex; align-items: center; justify-content: space-between;
  width: 100%; padding: 10px 10px; margin: 4px 0;
  background: transparent; border: 0.5px solid var(--border-light); border-radius: 10px;
  color: var(--text-muted); font-size: 13px; cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.tp-expand-btn:hover { background: var(--bg-hover); color: var(--text-secondary); }
.tp-expand-btn.expanded { color: var(--text-secondary); border-color: var(--border-input); }
.tp-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 5px; padding: 2px 4px 6px;
}
.tp-grid-item {
  border-radius: 10px; padding: 7px 4px 6px;
  border: 1.5px solid var(--border-light); background: var(--bg-hover);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  cursor: pointer; transition: background 0.12s, transform 0.1s;
  position: relative;
}
.tp-grid-item:hover { background: var(--bg-secondary); transform: scale(1.04); }
.tp-grid-item:active { transform: scale(0.93); }
.tp-gi-num { font-size: 18px; font-weight: 700; line-height: 1; }
.tp-gi-days { font-size: 10px; font-weight: 500; opacity: 0.75; line-height: 1; }
.tp-grid-item.en-progreso::after {
  content: ''; position: absolute; top: 4px; right: 4px;
  width: 6px; height: 6px; border-radius: 50%; background: #5DCAA5;
}
.tp-grid-item.tiene-notas::before {
  content: ''; position: absolute; top: 4px; left: 4px;
  width: 5px; height: 5px; border-radius: 50%; background: #888;
}

/* ── Fake input (reemplaza select/date/time nativos) ── */
.ui-fake-input {
  width: 100%; font-size: 13px; padding: 6px 8px;
  border: 0.5px solid var(--border-input); border-radius: 8px;
  background: var(--bg-input); color: var(--text-primary);
  cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 6px;
  transition: border-color 0.15s;
  box-sizing: border-box;
}
.ui-fake-input:hover { border-color: var(--text-dim); }
.ui-fake-input.empty { color: var(--text-dim); }
.ui-fake-input-icon { font-size: 14px; flex-shrink: 0; opacity: 0.6; }

/* ═══════════════════════════════════════════
   LOADING OVERLAY
═══════════════════════════════════════════ */
.ui-loading-overlay {
  position: fixed; inset: 0;
  background: rgba(10,10,10,0.82);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  z-index: 9500;
  backdrop-filter: blur(4px);
  animation: uiFadeIn 0.2s ease;
  gap: 18px;
}
.ui-loading-overlay.hiding {
  animation: uiFadeOut 0.25s ease forwards;
}
@keyframes uiFadeOut { from { opacity:1 } to { opacity:0 } }

.ui-loading-spinner {
  width: 52px; height: 52px;
  position: relative;
}
.ui-loading-spinner::before,
.ui-loading-spinner::after {
  content: ''; position: absolute; border-radius: 50%;
}
.ui-loading-spinner::before {
  inset: 0;
  border: 3px solid #2a2a2a;
}
.ui-loading-spinner::after {
  inset: 0;
  border: 3px solid transparent;
  border-top-color: #7F77DD;
  border-right-color: #5B8DDE;
  animation: uiSpin 0.7s linear infinite;
}
@keyframes uiSpin { to { transform: rotate(360deg); } }

.ui-loading-text {
  font-size: 14px; color: var(--text-muted);
  font-family: system-ui, sans-serif;
  letter-spacing: 0.02em;
}

/* ═══════════════════════════════════════════
   LOGO SVG (hexágono violeta estilo jw.org)
═══════════════════════════════════════════ */
.cs-logo-svg {
  display: block;
}

/* ═══════════════════════════════════════════
   PANTALLA INICIAL (index.html)
═══════════════════════════════════════════ */
.cs-home-body {
  background-color: var(--bg-primary) !important;
}

.cs-nav-card {
  width: 100%;
  background: var(--bg-card);
  border: 1px solid var(--border-primary);
  border-radius: 18px;
  padding: 1.1rem 1.25rem;
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 14px;
  transition: border-color 0.18s, background 0.18s, transform 0.1s, box-shadow 0.18s;
  text-decoration: none;
  color: inherit;
  box-shadow: var(--shadow-card);
}
.cs-nav-card:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-hover);
}
.cs-nav-card:active { transform: scale(0.98); box-shadow: none; }

.cs-nav-icon {
  width: 46px; height: 46px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  position: relative; overflow: hidden;
}
.cs-nav-icon::before,
.cs-nav-icon::after {
  content: '';
  position: absolute; aspect-ratio: 1; width: 220%;
  top: 50%; left: 50%;
  z-index: 0;
}
.cs-nav-icon::before {
  background: conic-gradient(from 0deg,
    transparent 0%, transparent 70%,
    var(--nav-c-dim, rgba(127,119,221,0.2)) 76%,
    var(--nav-c, #7F77DD) 81%,
    var(--nav-c-dim, rgba(127,119,221,0.2)) 86%,
    transparent 92%, transparent 100%);
  animation: cs-nav-spin 4s linear infinite;
  transform: translate(-50%, -50%) rotate(0deg);
}
.cs-nav-icon::after {
  background: conic-gradient(from 0deg,
    transparent 0%, transparent 70%,
    var(--nav-c-dim, rgba(127,119,221,0.2)) 76%,
    var(--nav-c, #7F77DD) 80%,
    var(--nav-c-dim, rgba(127,119,221,0.2)) 85%,
    transparent 91%, transparent 100%);
  animation: cs-nav-spin-rev 6s linear infinite;
  transform: translate(-50%, -50%) rotate(0deg);
}
.cs-nav-icon svg { position: relative; z-index: 1; }
@keyframes cs-nav-spin     { to { transform: translate(-50%, -50%) rotate(360deg);  } }
@keyframes cs-nav-spin-rev { to { transform: translate(-50%, -50%) rotate(-360deg); } }
.cs-nav-icon-terr  { --nav-c: #97C459; --nav-c-dim: rgba(151,196,89,0.2); background: rgba(151,196,89,0.13); border: 1px solid rgba(151,196,89,0.22); }
.cs-nav-icon-asign { --nav-c: #378ADD; --nav-c-dim: rgba(55,138,221,0.2);  background: rgba(55,138,221,0.13);  border: 1px solid rgba(55,138,221,0.22); }
.cs-nav-icon-herm  { --nav-c: #D85A30; --nav-c-dim: rgba(216,90,48,0.2);   background: rgba(216,90,48,0.13);   border: 1px solid rgba(216,90,48,0.22); }
.cs-nav-icon-vm    { --nav-c: #EF9F27; --nav-c-dim: rgba(239,159,39,0.2);  background: rgba(239,159,39,0.13);  border: 1px solid rgba(239,159,39,0.22); }
.cs-nav-icon-pred  { --nav-c: #E05277; --nav-c-dim: rgba(224,82,119,0.2);  background: rgba(224,82,119,0.13);  border: 1px solid rgba(224,82,119,0.22); }
.cs-nav-icon-conf  { --nav-c: #0DB6CC; --nav-c-dim: rgba(13,182,204,0.2);  background: rgba(13,182,204,0.13);  border: 1px solid rgba(13,182,204,0.22); }

.cs-nav-card-terr:hover  { border-color: rgba(151,196,89,0.55);  background: #1e2810; box-shadow: 0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(151,196,89,0.55),  0 4px 20px rgba(151,196,89,0.12); }
.cs-nav-card-asign:hover { border-color: rgba(55,138,221,0.55);  background: #101e28; box-shadow: 0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(55,138,221,0.55),  0 4px 20px rgba(55,138,221,0.12); }
.cs-nav-card-herm:hover  { border-color: rgba(216,90,48,0.55);   background: #2a1711; box-shadow: 0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(216,90,48,0.55),   0 4px 20px rgba(216,90,48,0.12); }
.cs-nav-card-vm:hover    { border-color: rgba(239,159,39,0.55);  background: #272010; box-shadow: 0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(239,159,39,0.55),  0 4px 20px rgba(239,159,39,0.12); }
.cs-nav-card-pred:hover  { border-color: rgba(224,82,119,0.55);  background: #2a1018; box-shadow: 0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(224,82,119,0.55),  0 4px 20px rgba(224,82,119,0.12); }
.cs-nav-card-conf:hover  { border-color: rgba(13,182,204,0.55);  background: #091e22; box-shadow: 0 6px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(13,182,204,0.55),  0 4px 20px rgba(13,182,204,0.12); }

body.light-mode .cs-nav-card-terr:hover  { border-color: rgba(151,196,89,0.55); background: #f1f8e8; box-shadow: 0 8px 26px rgba(93,130,53,0.18), 0 0 0 1px rgba(151,196,89,0.5); }
body.light-mode .cs-nav-card-asign:hover { border-color: rgba(55,138,221,0.52); background: #ebf5ff; box-shadow: 0 8px 26px rgba(43,114,191,0.16), 0 0 0 1px rgba(55,138,221,0.5); }
body.light-mode .cs-nav-card-herm:hover  { border-color: rgba(216,90,48,0.52);  background: #fff0ea; box-shadow: 0 8px 26px rgba(174,76,41,0.16), 0 0 0 1px rgba(216,90,48,0.5); }
body.light-mode .cs-nav-card-vm:hover    { border-color: rgba(239,159,39,0.52); background: #fff7e8; box-shadow: 0 8px 26px rgba(195,131,34,0.16), 0 0 0 1px rgba(239,159,39,0.5); }
body.light-mode .cs-nav-card-pred:hover  { border-color: rgba(224,82,119,0.52); background: #fff0f4; box-shadow: 0 8px 26px rgba(180,66,95,0.16), 0 0 0 1px rgba(224,82,119,0.5); }
body.light-mode .cs-nav-card-conf:hover  { border-color: rgba(13,182,204,0.52); background: #e8f9fc; box-shadow: 0 8px 26px rgba(10,146,163,0.16), 0 0 0 1px rgba(13,182,204,0.5); }

.cs-nav-title { font-size: 21px; font-weight: 600; color: var(--text-primary); margin-bottom: 3px; }
.cs-nav-sub   { font-size: 14px; color: var(--text-muted); }

.cs-logo-title {
  font-size: 34px; font-weight: 700;
  color: var(--text-primary); letter-spacing: -0.5px;
}
.cs-logo-sub { font-size: 14px; color: var(--text-dim); }
.cs-footer   { font-size: 12px; color: var(--text-dim); margin-top: 4px; }
.cs-back-btn { display:block; width:100%; max-width:320px; padding:11px; text-align:center; font-size:13px; color:var(--text-secondary); text-decoration:none; border:1px solid var(--border-light); border-radius:14px; transition:color 0.15s, border-color 0.15s, background 0.15s; margin-top:4px; }
.cs-back-btn:hover { color:var(--text-primary); border-color:var(--border-input); background:var(--bg-hover); }

/* ═══════════════════════════════════════════
   TOAST
═══════════════════════════════════════════ */
.ui-toast-container {
  position: fixed; bottom: 24px; left: 50%;
  transform: translateX(-50%);
  z-index: 9800; display: flex; flex-direction: column;
  align-items: center; gap: 8px; pointer-events: none;
}
.ui-toast {
  background: var(--bg-hover); border: 1px solid var(--border-light);
  border-radius: 30px; padding: 10px 20px;
  font-size: 13px; font-weight: 500; color: var(--text-primary);
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  animation: toastIn 0.2s cubic-bezier(.22,.68,0,1.2);
  white-space: nowrap;
}
.ui-toast.success { border-color: #1D9E75; color: #5DCAA5; }
.ui-toast.error   { border-color: #A32D2D; color: #F09595; }
.ui-toast.hiding  { animation: toastOut 0.2s ease forwards; }
@keyframes toastIn  { from { transform:translateY(16px); opacity:0 } to { transform:translateY(0); opacity:1 } }
@keyframes toastOut { from { opacity:1 } to { opacity:0; transform:translateY(8px) } }
`;
  document.head.appendChild(style);
})();

/* ─────────────────────────────────────────
   LOGO SVG — Hexágono azul-teal
───────────────────────────────────────── */
window.CS_LOGO_SVG = `<svg class="cs-logo-svg" width="80" height="80" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="csLogoGrad" x1="8" y1="4" x2="64" y2="68" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#9B8FFF"/>
      <stop offset="50%" stop-color="#7061E0"/>
      <stop offset="100%" stop-color="#4A3FB5"/>
    </linearGradient>
    <linearGradient id="csIconGrad" x1="18" y1="18" x2="54" y2="54" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#C4BEFF"/>
      <stop offset="100%" stop-color="#9B8FFF"/>
    </linearGradient>
    <filter id="csShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#4A3FB5" flood-opacity="0.5"/>
    </filter>
  </defs>
  <path d="M36 4 L64 20 L64 52 L36 68 L8 52 L8 20 Z"
    fill="url(#csLogoGrad)" filter="url(#csShadow)"/>
  <path d="M36 9 L60 23 L60 49 L36 63 L12 49 L12 23 Z"
    fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
  <circle cx="28" cy="27" r="6" fill="url(#csIconGrad)"/>
  <path d="M16 48 C16 40 22 36 28 36 C31 36 33.5 37.2 35.5 39" stroke="url(#csIconGrad)" stroke-width="2.8" stroke-linecap="round" fill="none"/>
  <circle cx="40" cy="25" r="7" fill="url(#csIconGrad)"/>
  <path d="M26 50 C27 41.5 33 37 40 37 C47 37 53 41.5 54 50" stroke="url(#csIconGrad)" stroke-width="3.2" stroke-linecap="round" fill="none"/>
</svg>`;

/* Helper para insertar el logo donde haya .cs-logo-placeholder */
window.insertLogos = function() {
  document.querySelectorAll('.cs-logo-placeholder').forEach(el => {
    el.innerHTML = '<img src="/assets/icon-192.png" width="120" height="120" style="border-radius:26px;display:block;" alt="Ziv">';
  });
};
document.addEventListener('DOMContentLoaded', insertLogos);

/* ─────────────────────────────────────────
   LOADING OVERLAY
───────────────────────────────────────── */
let _loadingEl = null;

window.uiLoading = {
  show(text = 'Cargando...') {
    if (_loadingEl) return;
    _loadingEl = document.createElement('div');
    _loadingEl.className = 'ui-loading-overlay';
    _loadingEl.innerHTML = `
      <div class="ui-loading-spinner"></div>
      <div class="ui-loading-text" id="ui-loading-text">${text}</div>`;
    document.body.appendChild(_loadingEl);
  },
  setText(text) {
    const el = document.getElementById('ui-loading-text');
    if (el) el.textContent = text;
  },
  hide() {
    if (!_loadingEl) return;
    _loadingEl.classList.add('hiding');
    setTimeout(() => {
      if (_loadingEl) { _loadingEl.remove(); _loadingEl = null; }
    }, 260);
  }
};

/* ─────────────────────────────────────────
   TOAST
───────────────────────────────────────── */
(function() {
  let container;
  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.className = 'ui-toast-container';
      document.body.appendChild(container);
    }
    return container;
  }
  window.uiToast = function(msg, type = '', duration = 2500) {
    const c = getContainer();
    const t = document.createElement('div');
    t.className = 'ui-toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
      t.classList.add('hiding');
      setTimeout(() => t.remove(), 220);
    }, duration);
  };
})();

/* ─────────────────────────────────────────
   MODAL CONFIRM
───────────────────────────────────────── */
window.uiConfirm = function({ title = '¿Estás seguro?', msg = '', confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'warn' } = {}) {
  return new Promise(resolve => {
    const icons = { warn: '⚠️', danger: '🗑️', info: 'ℹ️' };
    const overlay = document.createElement('div');
    overlay.className = 'ui-overlay';
    overlay.innerHTML = `
      <div class="ui-modal">
        <div class="ui-modal-icon ${type}"><span>${icons[type] || '⚠️'}</span></div>
        <div class="ui-modal-title">${title}</div>
        ${msg ? `<div class="ui-modal-msg">${msg}</div>` : ''}
        <div class="ui-modal-btns">
          <button class="ui-btn-cancel">${cancelText}</button>
          <button class="ui-btn-confirm-${type}">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const [btnCancel, btnConfirm] = overlay.querySelectorAll('button');
    const close = val => { overlay.remove(); resolve(val); };
    btnCancel.onclick  = () => close(false);
    btnConfirm.onclick = () => close(true);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(false); });
  });
};

/* ─────────────────────────────────────────
   MODAL ALERT
───────────────────────────────────────── */
window.uiAlert = function(msg, title = 'Atención') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'ui-overlay';
    overlay.innerHTML = `
      <div class="ui-modal">
        <div class="ui-modal-icon info"><span>ℹ️</span></div>
        <div class="ui-modal-title">${title}</div>
        <div class="ui-modal-msg">${msg}</div>
        <div class="ui-modal-btns">
          <button class="ui-btn-ok" style="flex:1;">Entendido</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    const btn = overlay.querySelector('button');
    const close = () => { overlay.remove(); resolve(); };
    btn.onclick = close;
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  });
};

/* ─────────────────────────────────────────
   FECHA UTILS
───────────────────────────────────────── */
// Formatea un Date a 'YYYY-MM-DD' en hora local (evita bug UTC)
window.fmtDateLocal = function(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

/* ─────────────────────────────────────────
   DATE PICKER
───────────────────────────────────────── */
window.uiDatePicker = function({ value = '', min = null, label = 'Elegir fecha' } = {}) {
  return new Promise(resolve => {
    const today = new Date(); today.setHours(0,0,0,0);
    let viewYear, viewMonth, selDate;
    if (value) {
      const d = new Date(value + 'T00:00:00');
      viewYear = d.getFullYear(); viewMonth = d.getMonth(); selDate = new Date(d);
    } else {
      viewYear = today.getFullYear(); viewMonth = today.getMonth(); selDate = null;
    }
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const DS = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
    function pad(n) { return String(n).padStart(2,'0'); }
    function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
    function minDate() { return min ? new Date(min + 'T00:00:00') : null; }
    function render() {
      const firstDay = new Date(viewYear, viewMonth, 1);
      const lastDay  = new Date(viewYear, viewMonth + 1, 0);
      let startDow = firstDay.getDay() - 1; if (startDow < 0) startDow = 6;
      const cells = [];
      for (let i = startDow - 1; i >= 0; i--) cells.push({ d: new Date(viewYear, viewMonth, -i), other: true });
      for (let i = 1; i <= lastDay.getDate(); i++) cells.push({ d: new Date(viewYear, viewMonth, i), other: false });
      while (cells.length % 7 !== 0) cells.push({ d: new Date(viewYear, viewMonth + 1, cells.length - lastDay.getDate() - startDow + 1), other: true });
      const mn = minDate();
      const daysHTML = cells.map(({ d, other }) => {
        const isToday   = !other && d.toDateString() === today.toDateString();
        const isSel     = selDate && !other && d.toDateString() === selDate.toDateString();
        const isDisabled = mn && d < mn;
        let cls = 'dp-day';
        if (other) cls += ' dp-day-other';
        else if (isDisabled) cls += ' dp-day-disabled';
        else if (isToday) cls += ' dp-day-today';
        if (isSel) cls += ' dp-day-selected';
        return `<button class="${cls}" data-date="${toISO(d)}" ${isDisabled||other?'disabled':''}>${d.getDate()}</button>`;
      }).join('');
      overlay.innerHTML = `
        <div class="bs-card">
          <div class="bs-handle"></div>
          <div class="bs-header">
            <div class="bs-title">${label}</div>
            <button class="bs-close-btn">✕</button>
          </div>
          <div class="dp-month-header">
            <button class="dp-nav-btn" id="dp-prev">‹</button>
            <div class="dp-month-title">${MESES[viewMonth]} ${viewYear}</div>
            <button class="dp-nav-btn" id="dp-next">›</button>
          </div>
          <div class="dp-weekdays">${DS.map(d=>`<div class="dp-wd">${d}</div>`).join('')}</div>
          <div class="dp-days">${daysHTML}</div>
          <div class="bs-footer">
            <button class="bs-btn-cancel">Cancelar</button>
            <button class="bs-btn-ok" ${!selDate?'disabled style="opacity:.4;cursor:not-allowed"':''}>Listo</button>
          </div>
        </div>`;
      overlay.querySelector('#dp-prev').onclick = () => { viewMonth--; if (viewMonth<0){viewMonth=11;viewYear--;} render(); };
      overlay.querySelector('#dp-next').onclick = () => { viewMonth++; if (viewMonth>11){viewMonth=0;viewYear++;} render(); };
      overlay.querySelectorAll('.dp-day:not([disabled])').forEach(btn => {
        btn.onclick = () => { selDate = new Date(btn.dataset.date + 'T00:00:00'); render(); };
      });
      overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-cancel').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-ok').onclick = () => {
        if (!selDate) return;
        overlay.remove(); resolve(toISO(selDate));
      };
      overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    }
    render();
  });
};

/* ─────────────────────────────────────────
   TIME PICKER
───────────────────────────────────────── */
window.uiTimePicker = function({ value = '', label = 'Elegir hora' } = {}) {
  return new Promise(resolve => {
    let hh = '', mm = '', editing = 'h', buffer = '';
    if (value && value.includes(':')) [hh, mm] = value.split(':');
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);
    function dispH() { return hh !== '' ? String(hh).padStart(2,'0') : '--'; }
    function dispM() { return mm !== '' ? String(mm).padStart(2,'0') : '--'; }
    function validate() {
      let h = parseInt(hh), m = parseInt(mm);
      if (isNaN(h)||h<0||h>23) hh='';
      if (isNaN(m)||m<0||m>59) mm='';
    }
    function render() {
      const ok = hh !== '' && mm !== '';
      overlay.innerHTML = `
        <div class="bs-card">
          <div class="bs-handle"></div>
          <div class="bs-header">
            <div class="bs-title">${label}</div>
            <button class="bs-close-btn">✕</button>
          </div>
          <div class="tp-display">
            <div class="tp-display-num ${editing==='h'?'active':''}" id="tp-h">${dispH()}</div>
            <div class="tp-display-sep">:</div>
            <div class="tp-display-num ${editing==='m'?'active':''}" id="tp-m">${dispM()}</div>
          </div>
          <div class="tp-numpad">
            ${[1,2,3,4,5,6,7,8,9,'',0,'del'].map(n => {
              if (n==='') return `<button class="tp-num-btn tp-empty"></button>`;
              if (n==='del') return `<button class="tp-num-btn tp-del" data-del>⌫</button>`;
              return `<button class="tp-num-btn" data-n="${n}">${n}</button>`;
            }).join('')}
          </div>
          <div class="bs-footer">
            <button class="bs-btn-cancel">Cancelar</button>
            <button class="bs-btn-ok" ${!ok?'disabled style="opacity:.4;cursor:not-allowed"':''}>Listo</button>
          </div>
        </div>`;
      overlay.querySelector('#tp-h').onclick = () => { editing='h'; buffer=''; render(); };
      overlay.querySelector('#tp-m').onclick = () => { editing='m'; buffer=''; render(); };
      overlay.querySelectorAll('[data-n]').forEach(btn => {
        btn.onclick = () => {
          const digit = btn.dataset.n;
          if (editing==='h') {
            if (buffer==='') { if(parseInt(digit)<=2){buffer=digit;hh=digit;}else{hh=digit;buffer='';editing='m';} }
            else { const c=buffer+digit; if(parseInt(c)<=23){hh=c;buffer='';editing='m';}else{hh=digit;buffer='';if(parseInt(digit)>2)editing='m';} }
          } else {
            if (buffer==='') { if(parseInt(digit)<=5){buffer=digit;mm=digit;}else{mm=digit;buffer='';} }
            else { const c=buffer+digit; if(parseInt(c)<=59){mm=c;buffer='';}else{mm=digit;buffer='';} }
          }
          render();
        };
      });
      overlay.querySelector('[data-del]').onclick = () => { buffer=''; if(editing==='h')hh='';else mm=''; render(); };
      overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-cancel').onclick = () => { overlay.remove(); resolve(null); };
      overlay.querySelector('.bs-btn-ok').onclick = () => {
        if (!ok) return;
        validate();
        if (hh===''||mm==='') { render(); return; }
        overlay.remove();
        resolve(`${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`);
      };
      overlay.addEventListener('click', e => { if (e.target===overlay){overlay.remove();resolve(null);} });
    }
    render();
  });
};

/* ─────────────────────────────────────────
   CONDUCTOR PICKER
   uiConductorPicker({ conductores, value, label, ordenPrioridad })
   ordenPrioridad: array opcional de nombres en orden de prioridad. Si se pasa,
   muestra un toggle "A–Z / A quién le toca" y un badge de rango en modo prioridad.
   Returns Promise<string|null>
───────────────────────────────────────── */
window.uiConductorPicker = function({ conductores = [], value = '', label = 'Elegir conductor', ordenPrioridad = null } = {}) {
  return new Promise(resolve => {
    let sel = value;
    let query = '';
    let modo = 'abc'; // 'abc' | 'prioridad'
    const tienePrioridad = Array.isArray(ordenPrioridad) && ordenPrioridad.length > 0;
    const prioPos  = new Map(tienePrioridad ? ordenPrioridad.map((n, i) => [n, i]) : []);
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);

    function ordenar(list) {
      if (modo !== 'prioridad' || !tienePrioridad) return list;
      return [...list].sort((a, b) =>
        (prioPos.has(a) ? prioPos.get(a) : 9999) - (prioPos.has(b) ? prioPos.get(b) : 9999));
    }

    function filtered() {
      let list = conductores;
      if (query) {
        const q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
        list = conductores.filter(c => c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').includes(q));
      }
      return ordenar(list);
    }

    function renderList() {
      const lista = filtered();
      const listEl = overlay.querySelector('.cp-list');
      listEl.innerHTML = `
            <button class="cp-sin-asignar" data-clear>
              <span class="cp-sin-asignar-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="4" stroke="#555" stroke-width="1.8"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="#555" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </span>
              <span class="cp-sin-asignar-txt">Sin asignar</span>
            </button>
            <div class="cp-divider"></div>
            ${lista.length === 0
              ? `<div class="cp-empty">Sin resultados</div>`
              : lista.map(c => {
                  const initials = c.split(' ').map(w=>w[0]).slice(0,2).join('').toUpperCase();
                  const enPrio = modo === 'prioridad' && tienePrioridad;
                  const rango = enPrio
                    ? `<span class="cp-rank" style="min-width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;background:#185FA5;color:#fff;border-radius:50%;font-size:11px;font-weight:700;margin-right:8px;flex:0 0 auto;">${(prioPos.get(c) ?? 0) + 1}</span>`
                    : '';
                  return `<button class="cp-item ${c===sel?'selected':''}" data-name="${c.replace(/"/g,'&quot;')}">
                    ${enPrio ? rango : `<span class="cp-item-avatar">${initials}</span>`}
                    <span class="cp-item-name">${c}</span>
                    <span class="cp-item-check">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke="#185FA5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </span>
                  </button>`;
                }).join('')
            }`;

      // Sin asignar
      listEl.querySelector('[data-clear]').onclick = () => { overlay.remove(); resolve(''); };
      // Items
      listEl.querySelectorAll('.cp-item').forEach(btn => {
        btn.onclick = () => { sel = btn.dataset.name; overlay.remove(); resolve(sel); };
      });
    }

    // Construir estructura una sola vez — el input NO se re-crea en cada búsqueda
    overlay.innerHTML = `
      <div class="bs-card">
        <div class="bs-handle"></div>
        <div class="bs-header">
          <div class="bs-title">${label}</div>
          <button class="bs-close-btn">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="cp-search-wrap">
          <span class="cp-search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
              <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </span>
          <input class="cp-search-input" type="text" placeholder="Buscar..." autocomplete="off">
        </div>
        ${tienePrioridad ? `
        <div class="cp-orden-row" style="display:flex;gap:6px;padding:2px 4px 10px;">
          <button type="button" class="cp-orden-btn" data-orden="abc" style="flex:1;padding:7px 0;border-radius:9px;border:1px solid var(--border-primary,#333);background:transparent;color:var(--text-muted,#999);font-family:inherit;font-size:13px;cursor:pointer;">A–Z</button>
          <button type="button" class="cp-orden-btn" data-orden="prioridad" style="flex:1;padding:7px 0;border-radius:9px;border:1px solid var(--border-primary,#333);background:transparent;color:var(--text-muted,#999);font-family:inherit;font-size:13px;cursor:pointer;">★ A quién le toca</button>
        </div>` : ''}
        <div class="cp-list"></div>
      </div>`;

    // Búsqueda: listener una sola vez, solo actualiza la lista
    const searchInput = overlay.querySelector('.cp-search-input');
    searchInput.addEventListener('input', e => { query = e.target.value; renderList(); });
    setTimeout(() => searchInput.focus(), 80);

    // Toggle de orden (solo si se pasó ordenPrioridad)
    function pintarOrdenBtns() {
      overlay.querySelectorAll('.cp-orden-btn').forEach(b => {
        const activo = b.dataset.orden === modo;
        b.style.background  = activo ? 'rgba(24,95,165,0.15)' : 'transparent';
        b.style.borderColor = activo ? '#185FA5' : 'var(--border-primary,#333)';
        b.style.color       = activo ? '#5BA3D9' : 'var(--text-muted,#999)';
        b.style.fontWeight  = activo ? '600' : '400';
      });
    }
    if (tienePrioridad) {
      overlay.querySelectorAll('.cp-orden-btn').forEach(b => {
        b.onclick = () => { modo = b.dataset.orden; pintarOrdenBtns(); renderList(); };
      });
      pintarOrdenBtns();
    }

    overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
    overlay.addEventListener('click', e => { if (e.target===overlay){overlay.remove();resolve(null);} });

    renderList();
  });
};

/* ─────────────────────────────────────────
   TERRITORIO PICKER
   uiTerritorioPicker({ territoriosData, allData, grupo, configData, label, color })
   Returns Promise<string|null>
───────────────────────────────────────── */
window.uiTerritorioPicker = function({
  territoriosData = {},
  allData = {},
  grupo = null,
  configData = {},
  label = 'Elegir territorio',
  color = '#97C459'
} = {}) {
  return new Promise(resolve => {
    let query = '';
    let gruposExpanded = false;
    const overlay = document.createElement('div');
    overlay.className = 'bs-overlay';
    document.body.appendChild(overlay);

    function daysSince(ds) {
      if (!ds) return 9999;
      return Math.floor((new Date() - new Date(ds + 'T00:00:00')) / 86400000);
    }

    function daysColor(dias) {
      if (!dias || dias >= 9999) return '#555';
      if (dias <= 30)  return '#4CAF50';
      if (dias <= 45)  return '#8BC34A';
      if (dias <= 60)  return '#FFC107';
      if (dias <= 90)  return '#FF9800';
      if (dias <= 120) return '#FF5722';
      return '#F44336';
    }

    function buildLista() {
      const enProgreso = [];
      const resto = [];

      Object.keys(territoriosData).forEach(n => {
        if ((configData[n] || 'normal') === 'no_predica') return;
        const t = territoriosData[n];
        const lastDate = t.lastFin || t.lastIni;
        const dias = daysSince(lastDate);
        const ciudad = t.ciudad || null;
        if (t.enProgreso) {
          enProgreso.push({ n, dias, lastDate, ciudad, notas: t.notas || null });
        } else {
          resto.push({ n, dias, lastDate, ciudad, notas: t.notas || null });
        }
      });

      enProgreso.sort((a,b) => b.dias - a.dias);
      resto.sort((a,b) => b.dias - a.dias);

      const deGrupos = [];
      if (grupo === 'C' && allData) {
        [1,2,3,4].forEach(g => {
          const data = allData[g];
          if (!data) return;
          Object.keys(data).forEach(n => {
            const t = data[n];
            const lastDate = t.lastFin || t.lastIni;
            const dias = daysSince(lastDate);
            deGrupos.push({ n, dias, lastDate, grupo: g, enProgreso: t.enProgreso });
          });
        });
        deGrupos.sort((a,b) => b.dias - a.dias);
      }

      return { enProgreso, resto, deGrupos };
    }

    function filtered(lista) {
      if (!query) return lista;
      return lista.filter(t => t.n.toString().includes(query.trim()));
    }

    function itemHTML(t, subOverride) {
      const col = daysColor(t.dias);
      const diasLabel = t.dias >= 9999 ? 'sin registros' : `${t.dias}d · ${t.lastDate ? t.lastDate.split('-').slice(1).reverse().join('/') : '—'}`;
      const sub = subOverride !== undefined ? subOverride
        : (t.enProgreso ? '<span style="color:#5DCAA5;">⟳ En progreso</span>' : diasLabel);
      const notasIcon = t.notas ? ' <span title="' + t.notas + '" style="font-style:normal;">📝</span>' : '';
      return `<button class="tp-item" data-terr="${t.n}">
        <span class="tp-item-num" style="color:${col};border-color:${col}33;">${t.n}</span>
        <span class="tp-item-info">
          <span class="tp-item-label">Territorio ${t.n}${notasIcon}</span>
          <span class="tp-item-days">${sub}</span>
        </span>
      </button>`;
    }

    function gridItemHTML(t, enProgresoOverride) {
      const col = daysColor(t.dias);
      const esProg = enProgresoOverride !== undefined ? enProgresoOverride : !!t.enProgreso;
      const classes = ['tp-grid-item', esProg ? 'en-progreso' : '', t.notas ? 'tiene-notas' : ''].filter(Boolean).join(' ');
      const diasLabel = esProg ? '⟳' : (t.dias >= 9999 ? '—' : `${t.dias}d`);
      return `<button class="${classes}" data-terr="${t.n}" style="border-color:${col}55;color:${col};">
        <span class="tp-gi-num">${t.n}</span>
        <span class="tp-gi-days">${diasLabel}</span>
      </button>`;
    }

    function render() {
      const { enProgreso, resto, deGrupos } = buildLista();
      const hayQuery = query.trim() !== '';
      const fProgreso = filtered(enProgreso);
      const fResto    = filtered(resto);
      const fGrupos   = filtered(deGrupos);

      let html = `
        <div class="bs-card">
          <div class="bs-handle"></div>
          <div class="bs-header">
            <div class="bs-title">${label}</div>
            <button class="bs-close-btn">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="tp-search-wrap">
            <span class="tp-search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                <path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </span>
            <input class="tp-search-input" type="text" placeholder="Buscar por número..." value="${query}" autocomplete="off" inputmode="numeric">
          </div>
          <div class="tp-list">`;

      // ── En progreso ──
      if (fProgreso.length > 0) {
        html += `<div class="tp-section-title">⟳ En progreso</div>`;
        html += `<div class="tp-grid">`;
        fProgreso.forEach(t => { html += gridItemHTML(t, true); });
        html += `</div><div class="tp-divider"></div>`;
      }

      // ── Propios (principal + extra por ciudad) ──
      const restoMain   = fResto.filter(t => !t.ciudad);
      const restoCiudad = {};
      fResto.filter(t => t.ciudad).forEach(t => {
        if (!restoCiudad[t.ciudad]) restoCiudad[t.ciudad] = [];
        restoCiudad[t.ciudad].push(t);
      });
      const hayCiudades = Object.keys(restoCiudad).length > 0;

      if (!hayQuery && grupo === 'C' && hayCiudades) html += `<div class="tp-section-title">Congregación</div>`;
      if (restoMain.length === 0 && fProgreso.length === 0 && !hayCiudades && !hayQuery) {
        html += `<div class="tp-empty">Sin territorios disponibles</div>`;
      } else if (restoMain.length > 0) {
        html += `<div class="tp-grid">`;
        restoMain.forEach(t => { html += gridItemHTML(t); });
        html += `</div>`;
      }

      // ── Ciudades extra ──
      Object.entries(restoCiudad).forEach(([ciudad, terrs]) => {
        html += `<div class="tp-divider"></div>`;
        html += `<div class="tp-section-title">${ciudad}</div>`;
        html += `<div class="tp-grid">`;
        terrs.forEach(t => { html += gridItemHTML(t); });
        html += `</div>`;
      });

      // ── Territorios de grupos (solo Congregación) ──
      if (grupo === 'C') {
        if (hayQuery) {
          if (fGrupos.length > 0) {
            html += `<div class="tp-divider"></div>`;
            html += `<div class="tp-section-title">Grupos 1–4</div>`;
            html += `<div class="tp-grid">`;
            fGrupos.forEach(t => { html += gridItemHTML(t); });
            html += `</div>`;
          } else if (fResto.length === 0 && fProgreso.length === 0) {
            html += `<div class="tp-empty">Sin resultados para "${query}"</div>`;
          }
        } else {
          html += `<div class="tp-divider"></div>`;
          if (!gruposExpanded) {
            html += `<button class="tp-expand-btn" id="tp-expand-grupos">
              <span>Ver territorios de grupos</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>`;
          } else {
            html += `<button class="tp-expand-btn expanded" id="tp-expand-grupos">
              <span>Ocultar territorios de grupos</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 15l-6-6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>`;
            [1,2,3,4].forEach(g => {
              const lista = deGrupos.filter(t => t.grupo === g);
              if (lista.length === 0) return;
              html += `<div class="tp-section-title" style="color:#555;">Grupo ${g}</div>`;
              html += `<div class="tp-grid">`;
              lista.forEach(t => { html += gridItemHTML(t); });
              html += `</div>`;
            });
          }
        }
      }

      if (hayQuery && fProgreso.length === 0 && fResto.length === 0 && (grupo !== 'C' || fGrupos.length === 0)) {
        html += `<div class="tp-empty">Sin resultados para "${query}"</div>`;
      }

      html += `</div></div>`;
      overlay.innerHTML = html;

      const searchInput = overlay.querySelector('.tp-search-input');
      searchInput.addEventListener('input', e => { query = e.target.value; render(); });
      if (query) {
        searchInput.focus();
        searchInput.setSelectionRange(query.length, query.length);
      } else {
        setTimeout(() => searchInput.focus(), 80);
      }

      const expandBtn = overlay.querySelector('#tp-expand-grupos');
      if (expandBtn) expandBtn.onclick = () => { gruposExpanded = !gruposExpanded; render(); };

      overlay.querySelectorAll('.tp-item, .tp-grid-item').forEach(btn => {
        btn.onclick = () => { overlay.remove(); resolve(btn.dataset.terr); };
      });

      overlay.querySelector('.bs-close-btn').onclick = () => { overlay.remove(); resolve(null); };
      overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    }
    render();
  });
};

/* ─────────────────────────────────────────
   HELPER: upgrade inputs date/time/select en DOM
───────────────────────────────────────── */
window.upgradeInputs = function(container) {
  container = container || document;

  // ── DATE inputs ──
  container.querySelectorAll('input[type="date"]').forEach(input => {
    if (input.dataset.upgraded) return;
    input.dataset.upgraded = 'true';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-fake-input' + (input.value ? '' : ' empty');
    function updateBtn() {
      const v = input.value;
      if (v) {
        const d = new Date(v + 'T00:00:00');
        const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
        const fmtd = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
        btn.innerHTML = `<span class="ui-fake-input-icon">📅</span><span style="color:#eee;">${days} ${fmtd}</span>`;
        btn.classList.remove('empty');
      } else {
        btn.innerHTML = `<span class="ui-fake-input-icon">📅</span><span>Elegir fecha</span>`;
        btn.classList.add('empty');
      }
    }
    updateBtn();
    btn.onclick = async () => {
      const result = await uiDatePicker({ value: input.value, min: input.min || null });
      if (result !== null) { input.value = result; input.dispatchEvent(new Event('change',{bubbles:true})); updateBtn(); }
    };
    input.addEventListener('change', updateBtn);
    input.style.display = 'none';
    input.insertAdjacentElement('afterend', btn);
  });

  // ── TIME inputs ──
  container.querySelectorAll('input[type="time"]').forEach(input => {
    if (input.dataset.upgraded) return;
    input.dataset.upgraded = 'true';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-fake-input' + (input.value ? '' : ' empty');
    function updateBtn() {
      const v = input.value;
      if (v) {
        btn.innerHTML = `<span class="ui-fake-input-icon">🕐</span><span style="color:#eee;">${v}</span>`;
        btn.classList.remove('empty');
      } else {
        btn.innerHTML = `<span class="ui-fake-input-icon">🕐</span><span>Elegir hora</span>`;
        btn.classList.add('empty');
      }
    }
    updateBtn();
    btn.onclick = async () => {
      const result = await uiTimePicker({ value: input.value });
      if (result !== null) { input.value = result; input.dispatchEvent(new Event('change',{bubbles:true})); updateBtn(); }
    };
    input.addEventListener('change', updateBtn);
    input.style.display = 'none';
    input.insertAdjacentElement('afterend', btn);
  });

  // ── SELECT de conductor (los que tienen id que empieza con sal-cond- o reg-cond-) ──
  container.querySelectorAll('select[id^="sal-cond-"], select[id^="reg-cond-"], select[id^="edit-cond"]').forEach(select => {
    if (select.dataset.upgraded) return;
    // Solo si es un <select> (no el input de texto del modal de historial)
    if (select.tagName !== 'SELECT') return;
    select.dataset.upgraded = 'true';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ui-fake-input' + (select.value ? '' : ' empty');

    function updateBtn() {
      const v = select.value;
      if (v) {
        btn.innerHTML = `<span class="ui-fake-input-icon">👤</span><span style="color:#eee;">${v}</span>`;
        btn.classList.remove('empty');
      } else {
        btn.innerHTML = `<span class="ui-fake-input-icon">👤</span><span>Elegir conductor</span>`;
        btn.classList.add('empty');
      }
    }
    updateBtn();

    btn.onclick = async () => {
      // Obtener opciones del select (excluye la primera vacía)
      const conductores = [...select.options]
        .filter(o => o.value)
        .map(o => o.value);
      const result = await uiConductorPicker({
        conductores,
        value: select.value,
        label: 'Elegir conductor'
      });
      if (result !== null) {
        select.value = result;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        updateBtn();
      }
    };

    select.style.display = 'none';
    select.insertAdjacentElement('afterend', btn);
  });
};

/* ─────────────────────────────────────────
   AUTO-UPGRADE al cargar
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => upgradeInputs(document));

const _uiObserver = new MutationObserver(mutations => {
  mutations.forEach(m => {
    m.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      upgradeInputs(node);
    });
  });
});
_uiObserver.observe(document.body, { childList: true, subtree: true });

/* ─────────────────────────────────────────
   AUTO-APPLY cs-home-body + cs-module-cover
───────────────────────────────────────── */
(function() {
  function applyBg() {
    document.body.classList.add('cs-home-body');
  }
  if (document.body) applyBg();
  else document.addEventListener('DOMContentLoaded', applyBg);
})();


/* ─────────────────────────────────────────
   CSS MÓDULOS (covers de territorios/asignaciones)
───────────────────────────────────────── */
(function injectModuleCSS() {
  const style = document.createElement('style');
  style.textContent = `
.cs-module-cover {
  min-height: calc(100vh - 2rem);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 10px; padding: 2rem 1rem;
  max-width: 340px; margin: 0 auto;
}
.cs-module-icon-wrap {
  width: 80px; height: 80px; border-radius: 24px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}
/* ── Ícono con borde neon animado ── */
.cs-module-icon-anim {
  position: relative;
  width: 86px; height: 86px;
  border-radius: 28px;
  overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  margin-bottom: 4px;
  --module-color: #7F77DD;
  --module-color-dim: rgba(127,119,221,0.3);
  box-shadow: 0 0 36px var(--module-color-dim), 0 0 14px var(--module-color-dim), 0 4px 20px rgba(0,0,0,0.5);
}
body.light-mode .cs-module-icon-anim {
  box-shadow: 0 0 24px var(--module-color-dim), 0 0 8px var(--module-color-dim), 0 4px 18px rgba(122,110,190,0.2);
}
.cs-module-icon-anim::before,
.cs-module-icon-anim::after {
  content: '';
  position: absolute;
  aspect-ratio: 1;
  width: 220%;
  top: 50%; left: 50%;
  z-index: 0;
}
.cs-module-icon-anim::before {
  background: conic-gradient(
    from 0deg,
    transparent 0%, transparent 70%,
    var(--module-color-dim) 76%,
    var(--module-color) 81%,
    var(--module-color-dim) 86%,
    transparent 92%, transparent 100%
  );
  animation: cs-icon-spin 4s linear infinite;
  transform: translate(-50%, -50%) rotate(0deg);
}
.cs-module-icon-anim::after {
  background: conic-gradient(
    from 0deg,
    transparent 0%, transparent 70%,
    var(--module-color-dim) 76%,
    var(--module-color) 80%,
    var(--module-color-dim) 85%,
    transparent 91%, transparent 100%
  );
  animation: cs-icon-spin-rev 6s linear infinite;
  transform: translate(-50%, -50%) rotate(0deg);
}
@keyframes cs-icon-spin     { to { transform: translate(-50%, -50%) rotate(360deg);  } }
@keyframes cs-icon-spin-rev { to { transform: translate(-50%, -50%) rotate(-360deg); } }
.cs-module-icon-anim .cs-module-icon-wrap {
  position: relative; z-index: 1;
  margin-bottom: 0; box-shadow: none; border: none !important;
}
.cs-module-title {
  font-size: 48px; font-weight: 700; color: var(--text-primary);
  letter-spacing: -0.5px; line-height: 1; text-align: center;
}
.cs-module-sub  { font-size: 15px; font-weight: 500; text-align: center; margin-bottom: 2px; color: var(--text-secondary); }
.cs-module-label { font-size: 13px; color: var(--text-muted); text-align: center; }
.cs-module-card {
  width: 100%; background: var(--bg-card);
  border: 1px solid var(--border-primary); border-radius: 18px;
  padding: 1rem 1.25rem; cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 14px;
  transition: border-color 0.18s, background 0.18s, transform 0.1s, box-shadow 0.18s;
  text-decoration: none; color: inherit;
  box-shadow: var(--shadow-card); outline: none;
}
.cs-module-card:hover {
  border-color: var(--card-hover-border, var(--border-light));
  background: var(--card-hover-bg, var(--bg-hover));
  transform: translateY(-1px);
  box-shadow: var(--card-hover-shadow, var(--shadow-hover));
}
body.light-mode .cs-module-card:hover {
  border-color: var(--card-hover-border-light, var(--card-hover-border, #cfc0ef));
  background: var(--card-hover-bg-light, linear-gradient(180deg, #ffffff 0%, #faf6ff 100%));
  box-shadow: var(--card-hover-shadow-light, 0 10px 24px rgba(122,110,190,0.16), 0 0 0 1px rgba(127,119,221,0.24));
}
.cs-module-card:active { transform: scale(0.98); box-shadow: none; }
.cs-module-card-icon {
  width: 44px; height: 44px; border-radius: 13px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.cs-module-card-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin-bottom: 2px; }
.cs-module-card-sub   { font-size: 13px; color: var(--text-muted); }
`;
  document.head.appendChild(style);
})();

/* ─────────────────────────────────────────
   SESSION HEADER — chip flotante top-right
   Actualizado desde auth.js via window.updateSessionHeader(user)
───────────────────────────────────────── */
(function initSessionHeader() {
  const style = document.createElement('style');
  style.textContent = `
    #ziv-session {
      position: fixed; top: 12px; right: 12px; z-index: 300;
    }
    .ziv-sBtn {
      display: flex; align-items: center; gap: 6px;
      background: rgba(35,38,40,0.9);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 20px; padding: 5px 10px 5px 5px;
      cursor: pointer; font-family: system-ui, sans-serif;
      color: #aaa; font-size: 13px;
      backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      transition: background 0.15s, border-color 0.15s;
      white-space: nowrap; max-width: 200px;
    }
    .ziv-sBtn:hover { background: rgba(50,53,58,0.95); border-color: rgba(255,255,255,0.14); }
    .ziv-sAvatar {
      width: 26px; height: 26px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
    }
    .ziv-sAvatarFallback {
      width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
      background: rgba(127,119,221,0.25); color: #7F77DD;
      font-size: 10px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
    }
    .ziv-sAvatarAnon {
      width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
      background: rgba(255,255,255,0.07); color: #666;
      display: flex; align-items: center; justify-content: center;
    }
    .ziv-sName {
      overflow: hidden; text-overflow: ellipsis; max-width: 100px;
    }
    .ziv-sChevron { color: #555; flex-shrink: 0; transition: transform 0.15s; }
    .ziv-sBtn.open .ziv-sChevron { transform: rotate(180deg); }
    .ziv-sMenu {
      position: absolute; top: calc(100% + 6px); right: 0;
      background: #252525; border: 1px solid #3a3a3a;
      border-radius: 12px; min-width: 168px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.55); overflow: hidden;
    }
    .ziv-sItem {
      display: block; width: 100%; padding: 10px 14px;
      font-size: 14px; color: #e8e8e8; text-decoration: none;
      background: none; border: none; text-align: left;
      cursor: pointer; font-family: system-ui, sans-serif;
      transition: background 0.12s;
    }
    .ziv-sItem:hover { background: #2e2e2e; }
    .ziv-sItem--danger { color: #F09595; }
    .ziv-sDivider { height: 1px; background: #333; }
    body.light-mode .ziv-sBtn {
      background: rgba(255,255,255,0.88); border-color: rgba(0,0,0,0.1); color: #555;
    }
    body.light-mode .ziv-sBtn:hover { background: rgba(255,255,255,0.98); }
    body.light-mode .ziv-sMenu {
      background: #fff; border-color: #e8e0d4;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    }
    body.light-mode .ziv-sItem { color: #2a2a2a; }
    body.light-mode .ziv-sItem:hover { background: #f7f3ed; }
    body.light-mode .ziv-sDivider { background: #e8e0d4; }
  `;
  document.head.appendChild(style);

  const el = document.createElement('div');
  el.id = 'ziv-session';
  el.style.display = 'none';
  el.innerHTML = `
    <button class="ziv-sBtn" id="ziv-sBtn" onclick="toggleSessionMenu()">
      <span id="ziv-sAvatarWrap"></span>
      <span class="ziv-sName" id="ziv-sName"></span>
      <svg class="ziv-sChevron" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="ziv-sMenu" id="ziv-sMenu" style="display:none">
      <a id="ziv-sPerfil" href="/perfil.html" class="ziv-sItem">Ver perfil</a>
      <div class="ziv-sDivider"></div>
      <button class="ziv-sItem ziv-sItem--danger" onclick="sessionSignOut()">Cerrar sesión</button>
    </div>
  `;
  document.body.appendChild(el);

  document.addEventListener('click', function(e) {
    if (!el.contains(e.target)) {
      const m = document.getElementById('ziv-sMenu');
      const b = document.getElementById('ziv-sBtn');
      if (m) m.style.display = 'none';
      if (b) b.classList.remove('open');
    }
  });
})();

window.updateSessionHeader = function(user) {
  const el     = document.getElementById('ziv-session');
  const wrap   = document.getElementById('ziv-sAvatarWrap');
  const name   = document.getElementById('ziv-sName');
  const perfil = document.getElementById('ziv-sPerfil');
  if (!el) return;

  if (!user) { el.style.display = 'none'; return; }

  el.style.display = 'block';

  if (user.isAnonymous) {
    wrap.innerHTML = `
      <div class="ziv-sAvatarAnon">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
      </div>`;
    name.textContent   = 'Invitado';
    perfil.textContent = 'Vincular con Google';
    perfil.removeAttribute('href');
    perfil.onclick = function(e) {
      e.preventDefault();
      window.closeSessionMenu();
      if (typeof window.linkWithGoogle === 'function') {
        window.linkWithGoogle()
          .then(() => window.location.replace('/perfil.html'))
          .catch(err => console.error(err));
      }
    };
  } else {
    const ini = (user.displayName || user.email || '?')
      .trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
    wrap.innerHTML = user.photoURL
      ? `<img class="ziv-sAvatar" src="${user.photoURL}" alt="">`
      : `<div class="ziv-sAvatarFallback">${ini}</div>`;
    name.textContent   = (user.displayName || user.email || '').split(' ')[0];
    perfil.textContent = 'Ver perfil';
    perfil.href        = '/perfil.html';
    perfil.onclick     = null;
  }
};

window.toggleSessionMenu = function() {
  const m    = document.getElementById('ziv-sMenu');
  const b    = document.getElementById('ziv-sBtn');
  const open = m && m.style.display !== 'none';
  if (m) m.style.display = open ? 'none' : 'block';
  if (b) b.classList.toggle('open', !open);
};

window.closeSessionMenu = function() {
  const m = document.getElementById('ziv-sMenu');
  const b = document.getElementById('ziv-sBtn');
  if (m) m.style.display = 'none';
  if (b) b.classList.remove('open');
};

window.sessionSignOut = async function() {
  ['ziv_congre_id', 'ziv_congre_nombre', 'ziv_congre_color'].forEach(k => localStorage.removeItem(k));
  ['congreId', 'congreNombre', 'congreColor'].forEach(k => sessionStorage.removeItem(k));
  if (typeof window.signOutUser === 'function') await window.signOutUser();
  window.location.replace('/');
};
