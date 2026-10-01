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
  --bg-primary:    #e2dfd8;
  --bg-secondary:  #e9e6df;
  --bg-card:       #edeae3;
  --bg-hover:      #d8d5cd;
  --bg-input:      #f1eee8;
  --bg-modal:      #edeae3;
  --bg-header:     #edeae3;
  --bg-badge:      rgba(127,119,221,0.10);

  --text-primary:  #1d1e22;
  --text-secondary:#4a4c56;
  --text-muted:    #777a85;
  --text-dim:      #777a85;

  --border-primary:#cdc9c0;
  --border-light:  #c0bcb2;
  --border-input:  #a7a399;

  --shadow-card:   0 6px 20px rgba(40,36,28,0.10);
  --shadow-hover:  0 12px 30px rgba(40,36,28,0.16);

  --accent:        #6c63cf;
  --accent-hover:  #5b52bd;
  --toggle-bg:     #edeae3;
  --toggle-knob:   #1d1e22;
}

/*TEMA-CLARO-AUTO:START*/
body.light-mode {
  --k-bd-000000: #d5d2cd;
  --k-bd-1a1c1f: #cac7c1;
  --k-bd-25272a: #c6c2bc;
  --k-bd-272a2e: #c4c1ba;
  --k-bd-2a2a2a: #c5c1ba;
  --k-bd-2a2d30: #c3c0b9;
  --k-bd-2e2e2e: #c3bfb9;
  --k-bd-333333: #c1bdb6;
  --k-bd-3a3a3a: #bebbb3;
  --k-bd-3b6d11: #bdd6a9;
  --k-bd-444444: #bab6af;
  --k-bd-4a44a5: #4a44a5;
  --k-bd-555555: #b4afa7;
  --k-bd-a32d2d: #a32d2d;
  --k-bd-w004: rgba(40, 36, 28, 0.052);
  --k-bd-w005: rgba(40, 36, 28, 0.065);
  --k-bd-w006: rgba(40, 36, 28, 0.078);
  --k-bd-w007: rgba(40, 36, 28, 0.091);
  --k-bd-w008: rgba(40, 36, 28, 0.104);
  --k-bd-w01: rgba(40, 36, 28, 0.13);
  --k-bd-w012: rgba(40, 36, 28, 0.156);
  --k-bd-w015: rgba(40, 36, 28, 0.195);
  --k-bd-w02: rgba(40, 36, 28, 0.26);
  --k-bd-w022: rgba(40, 36, 28, 0.286);
  --k-bd-w08: rgba(40, 36, 28, 0.104);
  --k-bg-000000: #000000;
  --k-bg-08090d: #dfe2ec;
  --k-bg-091f17: #daf1e9;
  --k-bg-0a0c10: #e0e4eb;
  --k-bg-0a2e24: #daf1eb;
  --k-bg-0c2a1e: #daf1e8;
  --k-bg-0c2a45: #dae6f1;
  --k-bg-0c447c: #0c447c;
  --k-bg-0d1a2e: #dae3f1;
  --k-bg-0d2318: #daf1e6;
  --k-bg-0d2420: #daf1ed;
  --k-bg-0d2e1a: #daf1e3;
  --k-bg-0f6e56: #0f6e56;
  --k-bg-111111: #d7d4ce;
  --k-bg-111315: #d8d5cf;
  --k-bg-120f2e: #dcdaf1;
  --k-bg-141414: #d8d5d0;
  --k-bg-16181e: #dad8d2;
  --k-bg-171730: #ddddee;
  --k-bg-17191c: #dad8d2;
  --k-bg-18143a: #dcdaf1;
  --k-bg-185fa5: #185fa5;
  --k-bg-1a1730: #dfddee;
  --k-bg-1a1a2e: #dedeed;
  --k-bg-1a1c20: #dcd9d4;
  --k-bg-1a1f1e: #dbd9d3;
  --k-bg-1a2e0a: #e4f1da;
  --k-bg-1c1e21: #dcd9d4;
  --k-bg-1c1e22: #dcdad5;
  --k-bg-1c2420: #dddad5;
  --k-bg-1e1e1e: #dcd9d4;
  --k-bg-1e2023: #dddad5;
  --k-bg-1e2024: #dddad5;
  --k-bg-1e2126: #dddbd6;
  --k-bg-1f0909: #f1dada;
  --k-bg-1f1505: #f1e8da;
  --k-bg-22224a: #dcdcef;
  --k-bg-232323: #dedbd6;
  --k-bg-242424: #dedcd7;
  --k-bg-252525: #dedcd7;
  --k-bg-252729: #dfddd8;
  --k-bg-27500a: #27500a;
  --k-bg-2a0e0e: #f1dada;
  --k-bg-2a1711: #f0e0db;
  --k-bg-2a1d08: #f1e8da;
  --k-bg-2a2a2a: #e0ded9;
  --k-bg-2a2d30: #e1dfdb;
  --k-bg-2d3033: #e2e0dc;
  --k-bg-2e1a1a: #eddede;
  --k-bg-2e1e00: #f1e9da;
  --k-bg-2e3033: #e3e0dc;
  --k-bg-333333: #e3e1dd;
  --k-bg-333639: #e5e3df;
  --k-bg-3a2020: #eddede;
  --k-bg-3a2500: #f1e9da;
  --k-bg-3b6d11: #3b6d11;
  --k-bg-444350: #eceae7;
  --k-bg-444444: #eae8e5;
  --k-bg-4a3fb5: #4a3fb5;
  --k-bg-w002: rgba(40, 36, 28, 0.026);
  --k-bg-w0025: rgba(40, 36, 28, 0.033);
  --k-bg-w003: rgba(40, 36, 28, 0.039);
  --k-bg-w0035: rgba(40, 36, 28, 0.046);
  --k-bg-w004: rgba(40, 36, 28, 0.052);
  --k-bg-w005: rgba(40, 36, 28, 0.065);
  --k-bg-w006: rgba(40, 36, 28, 0.078);
  --k-bg-w012: rgba(40, 36, 28, 0.156);
  --k-bg-w015: rgba(40, 36, 28, 0.195);
  --k-bg-w02: rgba(40, 36, 28, 0.26);
  --k-bg-w04: rgba(40, 36, 28, 0.052);
  --k-bg-w05: rgba(40, 36, 28, 0.65);
  --k-bg-w18: rgba(40, 36, 28, 0.234);
  --k-tx-0a7a52: #0f704e;
  --k-tx-0db6cc: #0e6b77;
  --k-tx-1d9e75: #1a7054;
  --k-tx-25c491: #1b6f54;
  --k-tx-2dbd8e: #206f55;
  --k-tx-33d4ea: #126b77;
  --k-tx-378add: #2463a3;
  --k-tx-4cc79b: #276d54;
  --k-tx-555555: #555555;
  --k-tx-5a7fa8: #4a6582;
  --k-tx-5b8dde: #2d60b3;
  --k-tx-5ba3d9: #296693;
  --k-tx-5db85d: #356e35;
  --k-tx-5dcaa5: #286c55;
  --k-tx-5fa8e8: #2065a2;
  --k-tx-639922: #486c1d;
  --k-tx-6a6a6a: #6a6a6a;
  --k-tx-6fcf74: #2a6f2e;
  --k-tx-76abff: #165cca;
  --k-tx-777777: #5d5e6d;
  --k-tx-7cc8f8: #11669c;
  --k-tx-7f77dd: #453bc4;
  --k-tx-85b7eb: #2465a8;
  --k-tx-888798: #525461;
  --k-tx-888888: #565764;
  --k-tx-8a8a8a: #555663;
  --k-tx-97c459: #4f6a2a;
  --k-tx-999999: #4e505c;
  --k-tx-9a6060: #855757;
  --k-tx-9a95dd: #4d44bb;
  --k-tx-9b8fdd: #5542bd;
  --k-tx-9b93e8: #4335ca;
  --k-tx-9b93ee: #3b2cd3;
  --k-tx-9c9c9c: #4d4e5a;
  --k-tx-a0492a: #a0492a;
  --k-tx-a09aff: #2619e6;
  --k-tx-a9a3ee: #3d31ce;
  --k-tx-b06000: #8e5510;
  --k-tx-b0a8f5: #3724db;
  --k-tx-b6acff: #3219e6;
  --k-tx-b7b2ff: #2719e6;
  --k-tx-bbbbbb: #40414b;
  --k-tx-bdb8ff: #2819e6;
  --k-tx-c0c0c0: #3e3f49;
  --k-tx-c0dd97: #4d6827;
  --k-tx-c4c4c4: #3c3d47;
  --k-tx-c9c5ff: #2819e6;
  --k-tx-cccccc: #393a43;
  --k-tx-d0d0d0: #373841;
  --k-tx-d85a30: #a14526;
  --k-tx-dddddd: #32323a;
  --k-tx-e05050: #bb2b2b;
  --k-tx-e05277: #b62a4f;
  --k-tx-e06060: #b82d2d;
  --k-tx-e07070: #b53030;
  --k-tx-e07a7a: #b33333;
  --k-tx-e88080: #ba2b2b;
  --k-tx-e8c94a: #715e14;
  --k-tx-ee0055: #c11553;
  --k-tx-eeeeee: #2a2b32;
  --k-tx-ef9f27: #885811;
  --k-tx-f09595: #bc2424;
  --k-tx-f0f0f0: #2a2a31;
  --k-tx-f2f1f7: #28292f;
  --k-tx-f2f2f2: #292930;
  --k-tx-f79fcb: #b81969;
  --k-tx-fac775: #85580f;
  --k-tx-ff8e8e: #c51616;
  --k-tx-ffffff: #232429;
  --k-tx-w025: rgba(40, 36, 28, 0.325);
}
/*TEMA-CLARO-AUTO:END*/

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
    radial-gradient(ellipse at 60% 15%, rgba(55,138,221,0.07) 0%, transparent 55%),
    radial-gradient(ellipse at 18% 80%, rgba(29,158,117,0.05) 0%, transparent 48%),
    radial-gradient(ellipse at 85% 20%, rgba(127,119,221,0.08) 0%, transparent 52%);
}

/* ── Escala global: misma regla que shared/styles-base.css (acá para las páginas que no lo cargan) ── */
body { zoom: var(--ziv-z, 1); min-height: calc(100vh / var(--ziv-z, 1)) !important; }

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

/* ─────────────────────────────────────────
   TAMAÑO DE LETRA — escala global (menú del usuario)
   Se guarda en localStorage 'ziv-escala2'. Sin valor guardado: según el ancho (1.2 desde 1100px hasta 1.75 desde 1900px), 1 en el resto.
   Pone --ziv-z en <html>; styles-base.css lo usa como `zoom` del body, así que escala todo junto
   (texto, botones, espacios). Las páginas sin styles-base no se escalan.
───────────────────────────────────────── */
window.ZIV_ESCALAS = [0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.75, 2];
// admin.html tiene un picker con Leaflet, que se lleva mal con el zoom: ahí no se escala
window.ZIV_SIN_ESCALA = /\/admin\.html$/.test(location.pathname);
// Pantallas anchas = columna de 480px chica: se agranda según el ancho (mismos cortes que styles-base.css)
window.zivEscalaPorDefecto = function() {
  const w = window.innerWidth;
  return w >= 1900 ? 1.75 : w >= 1500 ? 1.5 : w >= 1280 ? 1.35 : w >= 1100 ? 1.2 : 1;
};
window.zivEscalaActual = function() {
  try {
    const v = parseFloat(localStorage.getItem('ziv-escala2'));
    if (ZIV_ESCALAS.includes(v)) return v;
  } catch (e) {}
  return window.zivEscalaPorDefecto();
};
window.zivAplicarEscala = function(e) {
  if (!document.body) return;
  document.documentElement.style.setProperty('--ziv-z', window.ZIV_SIN_ESCALA ? 1 : e);
  window.zivSyncAjustes();
};
window.zivCambiarEscala = function(delta) {
  const i = ZIV_ESCALAS.indexOf(window.zivEscalaActual());
  const n = ZIV_ESCALAS[Math.min(ZIV_ESCALAS.length - 1, Math.max(0, (i < 0 ? 1 : i) + delta))];
  try { localStorage.setItem('ziv-escala2', String(n)); } catch (e) {}
  window.zivAplicarEscala(n);
};
window.zivRestablecerEscala = function() {
  try { localStorage.removeItem('ziv-escala2'); } catch (e) {}
  window.zivAplicarEscala(window.zivEscalaPorDefecto());
};
// Refresca los controles del menú del usuario (porcentaje, límites, etiqueta del tema)
window.zivSyncAjustes = function() {
  const e = window.zivEscalaActual();
  const fila = document.getElementById('ziv-sFilaEscala');
  if (fila) fila.style.display = window.ZIV_SIN_ESCALA ? 'none' : '';
  const pct = document.getElementById('ziv-sPct');
  if (pct) pct.textContent = Math.round(e * 100) + '%';
  const i = ZIV_ESCALAS.indexOf(e);
  const menos = document.getElementById('ziv-sMenos'), mas = document.getElementById('ziv-sMas');
  if (menos) menos.disabled = i <= 0;
  if (mas) mas.disabled = i >= ZIV_ESCALAS.length - 1;
  const tema = document.getElementById('ziv-sTema');
  if (tema) tema.textContent = document.body.classList.contains('light-mode') ? '☾ Cambiar a tema oscuro' : '☀ Cambiar a tema claro';
};
(function initEscala() {
  const aplicar = () => window.zivAplicarEscala(window.zivEscalaActual());
  if (document.body) aplicar(); else document.addEventListener('DOMContentLoaded', aplicar);
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
  if (window.zivSyncAjustes) window.zivSyncAjustes();
};


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

body.light-mode .cs-nav-card-terr:hover  { border-color: rgba(151,196,89,0.55); background: #e4ecd6; box-shadow: 0 8px 26px rgba(93,130,53,0.18), 0 0 0 1px rgba(151,196,89,0.5); }
body.light-mode .cs-nav-card-asign:hover { border-color: rgba(55,138,221,0.52); background: #dce8f3; box-shadow: 0 8px 26px rgba(43,114,191,0.16), 0 0 0 1px rgba(55,138,221,0.5); }
body.light-mode .cs-nav-card-herm:hover  { border-color: rgba(216,90,48,0.52);  background: #efdfd6; box-shadow: 0 8px 26px rgba(174,76,41,0.16), 0 0 0 1px rgba(216,90,48,0.5); }
body.light-mode .cs-nav-card-vm:hover    { border-color: rgba(239,159,39,0.52); background: #f0e6d0; box-shadow: 0 8px 26px rgba(195,131,34,0.16), 0 0 0 1px rgba(239,159,39,0.5); }
body.light-mode .cs-nav-card-pred:hover  { border-color: rgba(224,82,119,0.52); background: #efdde2; box-shadow: 0 8px 26px rgba(180,66,95,0.16), 0 0 0 1px rgba(224,82,119,0.5); }
body.light-mode .cs-nav-card-conf:hover  { border-color: rgba(13,182,204,0.52); background: #d6ebee; box-shadow: 0 8px 26px rgba(10,146,163,0.16), 0 0 0 1px rgba(13,182,204,0.5); }

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

// Escapa texto de usuario para meterlo en innerHTML (único lugar: no redefinir en los módulos)
window.esc = function(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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
  border-color: var(--card-hover-border-light, var(--card-hover-border, #c9bfe2));
  background: var(--card-hover-bg-light, linear-gradient(180deg, #f1eee8 0%, #ece6f1 100%));
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
      border-radius: 12px; min-width: 230px;
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
    .ziv-sRow {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 8px 14px; font-size: 13px; color: #aaa; font-family: system-ui, sans-serif;
    }
    .ziv-sStep { display: flex; align-items: center; gap: 4px; }
    .ziv-sStep button {
      width: 32px; height: 30px; border-radius: 8px; cursor: pointer;
      background: #2e2e2e; border: 1px solid #3a3a3a; color: #e8e8e8;
      font: 600 13px system-ui, sans-serif;
    }
    .ziv-sStep button:hover:not(:disabled) { background: #3a3a3a; }
    .ziv-sStep button:disabled { opacity: 0.35; cursor: default; }
    .ziv-sStep button:focus-visible, .ziv-sItem:focus-visible { outline: 2px solid #9B8FFF; outline-offset: -2px; }
    .ziv-sStep .ziv-sPct { width: auto; min-width: 46px; background: none; border-color: transparent; }
    body.light-mode .ziv-sBtn {
      background: rgba(237,234,227,0.92); border-color: rgba(0,0,0,0.1); color: #555;
    }
    body.light-mode .ziv-sBtn:hover { background: rgba(241,238,232,0.98); }
    body.light-mode .ziv-sMenu {
      background: #edeae3; border-color: #cdc9c0;
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    }
    body.light-mode .ziv-sItem { color: #2a2a2a; }
    body.light-mode .ziv-sItem:hover { background: #e2dfd8; }
    body.light-mode .ziv-sDivider { background: #cdc9c0; }
    body.light-mode .ziv-sRow { color: #666; }
    body.light-mode .ziv-sStep button { background: #e2dfd8; border-color: #cdc9c0; color: #2a2a2a; }
    body.light-mode .ziv-sStep button:hover:not(:disabled) { background: #d8d5cd; }
    body.light-mode .ziv-sStep .ziv-sPct { background: none; border-color: transparent; }
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
      <div class="ziv-sRow" id="ziv-sFilaEscala">
        <span>Tamaño</span>
        <span class="ziv-sStep">
          <button id="ziv-sMenos" aria-label="Achicar letra" onclick="zivCambiarEscala(-1)">A−</button>
          <button class="ziv-sPct" id="ziv-sPct" title="Restablecer tamaño" aria-label="Restablecer tamaño" onclick="zivRestablecerEscala()">100%</button>
          <button id="ziv-sMas" aria-label="Agrandar letra" onclick="zivCambiarEscala(1)">A+</button>
        </span>
      </div>
      <button class="ziv-sItem" id="ziv-sTema" onclick="uiToggleTheme()"></button>
      <div class="ziv-sDivider"></div>
      <a id="ziv-sPerfil" href="/perfil.html" class="ziv-sItem">Ver perfil</a>
      <div class="ziv-sDivider"></div>
      <button class="ziv-sItem ziv-sItem--danger" onclick="sessionSignOut()">Cerrar sesión</button>
    </div>
  `;
  document.body.appendChild(el);
  window.zivSyncAjustes();

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

/* ─────────────────────────────────────────
   FESTEJO: pelota rebotando (guardado exitoso)
   Usar tras un guardado importante: window.lanzarPelotaFestejo()
───────────────────────────────────────── */
(function initPelotaFestejo() {
  let canvas, ctx, pelota = null, animando = false;

  function getCanvas() {
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.id = 'ziv-pelota-canvas';
    canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9998;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    resize();
    return canvas;
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (pelota) {
      const p = pelota;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.9;
      p.rot += p.vx * 0.03;

      if (p.y >= p.groundY) {
        p.y = p.groundY;
        p.vy *= -0.68;
        if (Math.abs(p.vy) < 4) p.vy = -9;
      }

      const alturaRel = Math.max(0, (p.groundY - p.y) / 180);
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - Math.min(alturaRel, 0.8));
      ctx.beginPath();
      ctx.ellipse(p.x, p.groundY + p.radio * 0.6, p.radio * (1 - alturaRel * 0.4), 6, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.font = `${p.radio * 2}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();

      if (p.x > canvas.width + 60) pelota = null;
    }
    if (pelota) {
      requestAnimationFrame(tick);
    } else {
      animando = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  window.lanzarPelotaFestejo = function(emoji = '⚽') {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    getCanvas();
    const groundY = canvas.height - 70;
    pelota = { emoji, x: -40, y: groundY, vx: Math.max(5, canvas.width / 130), vy: -18, radio: 22, rot: 0, groundY };
    if (!animando) { animando = true; requestAnimationFrame(tick); }
  };
})();

window.sessionSignOut = async function() {
  ['ziv_congre_id', 'ziv_congre_nombre', 'ziv_congre_color'].forEach(k => localStorage.removeItem(k));
  ['congreId', 'congreNombre', 'congreColor'].forEach(k => sessionStorage.removeItem(k));
  if (typeof window.signOutUser === 'function') await window.signOutUser();
  window.location.replace('/');
};

/* ─────────────────────────────────────────
   ACTUALIZACIÓN DE LA APP
   sw.js se instala solo cuando cambia (skipWaiting + clients.claim). Acá se detecta el cambio de
   controlador: si la pestaña recién se abrió y la persona no está escribiendo, se recarga sola; si
   no, aparece un aviso con botón (recargar a la fuerza pierde lo que se esté cargando).
───────────────────────────────────────── */
(function initActualizacionApp() {
  if (!('serviceWorker' in navigator)) return;
  const teniaControlador = !!navigator.serviceWorker.controller;
  const abierta = Date.now();
  let avisado = false;

  function escribiendo() {
    const a = document.activeElement;
    return !!a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
  }

  function mostrarAviso() {
    if (document.getElementById('ziv-update')) return;
    const el = document.createElement('div');
    el.id = 'ziv-update';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:10000;display:flex;align-items:center;gap:12px;'
      + 'padding:10px 14px;border-radius:14px;font:500 13px system-ui,sans-serif;max-width:calc(100vw - 32px);'
      + 'background:var(--bg-modal,#232628);color:var(--text-primary,#e8e8e8);border:1px solid var(--border-light,#3a3d42);box-shadow:0 8px 28px rgba(0,0,0,.35);';
    el.innerHTML = '<span>Hay una versión nueva de la app</span>'
      + '<button type="button" style="font:600 13px system-ui,sans-serif;padding:6px 12px;border-radius:10px;border:none;cursor:pointer;background:#7F77DD;color:#fff;">Actualizar</button>';
    el.querySelector('button').onclick = () => location.reload();
    document.body.appendChild(el);
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!teniaControlador || avisado) return;   // primera instalación: no hay nada viejo que reemplazar
    avisado = true;
    let ultima = 0;
    try { ultima = +sessionStorage.getItem('ziv-upd') || 0; } catch (e) {}
    // a lo sumo una recarga automática por minuto: si algo raro hiciera cambiar el service worker en
    // cada carga, esto evita un bucle y cae al aviso
    if (Date.now() - abierta < 20000 && !escribiendo() && Date.now() - ultima > 60000) {
      try { sessionStorage.setItem('ziv-upd', String(Date.now())); } catch (e) {}
      location.reload();
    } else {
      mostrarAviso();
    }
  });

  // La PWA puede quedar abierta días: al volver a la pestaña se pregunta si hay versión nueva
  const buscar = () => navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') buscar(); });
  setInterval(buscar, 30 * 60 * 1000);
})();
