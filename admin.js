import { db } from './shared/firebase.js';
import './shared/auth.js';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, writeBatch, Timestamp, deleteField,
  query, where, orderBy, limit,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ── Super-admin PIN ──
let ADMIN_PIN = null;
let _adminAuthOk = false;

function setAdminAuthStatus(text, showButton = false) {
  const el = document.getElementById('admin-auth-status');
  const btn = document.getElementById('admin-auth-btn');
  if (el) el.innerHTML = text;
  if (btn) btn.style.display = showButton ? '' : 'none';
}

(async function loadAdminPin() {
  await window.waitForAuth();
  const user = window.currentUser;
  if (!user) {
    setAdminAuthStatus('Necesitás iniciar sesión con una cuenta de <strong>admin general</strong>.', true);
    return;
  }
  if (!window.hasPermission('acceso_admin')) {
    setAdminAuthStatus(`La cuenta <strong>${user.email || user.displayName || 'actual'}</strong> no tiene permiso de admin.`, false);
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'config', 'superadmin'));
    if (snap.exists() && snap.data().pin) {
      ADMIN_PIN = snap.data().pin;
      _adminAuthOk = true;
      setAdminAuthStatus(`Sesión activa: <strong>${user.email || user.displayName || user.uid}</strong>`, false);
    } else {
      _adminAuthOk = false;
      setAdminAuthStatus(`Sesión activa: <strong>${user.email || user.displayName || user.uid}</strong>`, false);
      document.getElementById('pin-error').textContent =
        'Falta crear config/superadmin → { pin } en Firestore';
    }
  } catch(e) {
    _adminAuthOk = false;
    setAdminAuthStatus(`Sesión activa: <strong>${user.email || user.displayName || user.uid}</strong>`, false);
    document.getElementById('pin-error').textContent = 'Error al conectar con Firestore';
  }
})();

window.adminSignIn = async function() {
  try {
    await window.signInWithGoogle();
    window.location.reload();
  } catch (err) {
    setAdminAuthStatus(`No se pudo iniciar sesión: <strong>${err.message}</strong>`, true);
  }
};

// ─────────────────────────────────────────
//   PIN
// ─────────────────────────────────────────
let pinBuffer = '';

function pinPress(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
}

function pinDelete() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
}

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('ad' + i).classList.toggle('filled', i < pinBuffer.length);
  }
}

function checkPin() {
  if (!_adminAuthOk) {
    document.getElementById('pin-error').textContent = 'Primero iniciá sesión con una cuenta admin.';
    pinBuffer = '';
    updatePinDots();
    return;
  }
  if (ADMIN_PIN === null) {
    document.getElementById('pin-error').textContent = 'PIN no cargado, revisá la configuración en Firestore';
    pinBuffer = '';
    updatePinDots();
    return;
  }
  if (pinBuffer === ADMIN_PIN) {
    showView('view-dashboard');
    loadDashboard();
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto';
    pinBuffer = '';
    updatePinDots();
  }
}

// ─────────────────────────────────────────
//   NAVEGACIÓN
// ─────────────────────────────────────────
function showView(id) {
  ['view-pin', 'view-dashboard', 'view-wizard', 'view-territorios', 'view-matches', 'view-usuarios', 'view-actividad'].forEach(v => {
    document.getElementById(v).style.display = v === id ? '' : 'none';
  });
}

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

let userEditedId = false;
function onNombreInput() {
  if (!userEditedId) {
    document.getElementById('w-id').value = slugify(document.getElementById('w-nombre').value);
  }
  // Mantener actualizado el header del wizard mientras se escribe
  if (typeof renderWizardHeader === 'function') renderWizardHeader();
}
function onIdInput() {
  userEditedId = true;
  const el = document.getElementById('w-id');
  el.value = el.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

// ─────────────────────────────────────────
//   DASHBOARD
// ─────────────────────────────────────────
async function loadDashboard() {
  const loading = document.getElementById('dash-loading');
  const list    = document.getElementById('dash-list');
  loading.style.display = 'flex';
  list.style.display    = 'none';
  try {
    const snap = await getDocs(collection(db, 'congregaciones'));
    list.innerHTML = '';
    if (snap.empty) {
      list.innerHTML = '<p style="color:var(--text-muted, #666);font-size:14px;text-align:center;padding:24px 0;">No hay congregaciones todavía.</p>';
    } else {
      const ICO = {
        map:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4l-6 2v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
        users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 11a3 3 0 100-6"/><path d="M21 19a4.5 4.5 0 00-4-4.5"/></svg>',
        chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
        edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
        trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14"/></svg>',
      };
      list.classList.add('dash-list');
      snap.forEach(d => {
        const data = d.data();
        const { nombre, creadoEn, color } = data;
        const fecha = creadoEn
          ? new Date(creadoEn.seconds * 1000).toLocaleDateString('es-AR')
          : '—';
        const nombreSafe = (nombre || '(sin nombre)').replace(/'/g, "\\'");
        const cc = color || '#7F77DD';
        list.innerHTML += `
          <div class="dash-card" style="--cc:${cc};">
            <div class="dash-card-hd">
              <div style="flex:1;min-width:0;">
                <div class="dash-card-nm">${nombre || '(sin nombre)'}</div>
                <div class="dash-card-mt">/${d.id} · alta ${fecha}</div>
              </div>
              <div class="dash-corner">
                <button onclick="editCongre('${d.id}')" title="Editar">${ICO.edit}</button>
                <button class="del" onclick="deleteCongre('${d.id}','${nombreSafe}')" title="Eliminar">${ICO.trash}</button>
              </div>
            </div>
            <div class="dash-acts">
              <button class="dash-act" onclick="openTerritorios('${d.id}','${nombreSafe}')" title="Territorios">${ICO.map} Territorios</button>
              <button class="dash-act" onclick="openUsuarios('${d.id}','${nombreSafe}')" title="Usuarios">${ICO.users} Usuarios</button>
              <button class="dash-act" onclick="openActividad('${d.id}','${nombreSafe}')" title="Actividad">${ICO.chart} Actividad</button>
            </div>
          </div>`;
      });
    }
    loading.style.display = 'none';
    list.style.display    = '';
  } catch(err) {
    loading.innerHTML = `<span style="color:var(--k-tx-f09595, #F09595);font-size:14px;">Error: ${err.message}</span>`;
  }

  // Badge de matches pendientes
  try {
    const pendSnap = await getDocs(query(collection(db, 'usuarios'), where('matchEstado', '==', 'pendiente')));
    const banner = document.getElementById('dash-matches-banner');
    if (pendSnap.size > 0) {
      document.getElementById('dash-matches-n').textContent = pendSnap.size;
      banner.style.display = '';
    } else {
      banner.style.display = 'none';
    }
  } catch(_) { /* ignora si no hay índice aún */ }
}

// ─────────────────────────────────────────
//   WIZARD
// ─────────────────────────────────────────
const PALETA_COLORES = ['#378ADD','#97C459','#7F77DD','#EF9F27','#1D9E75','#D85A30'];

function setWizardCC(hex) {
  const view = document.getElementById('view-wizard');
  if (view) view.style.setProperty('--cc', hex || '#7F77DD');
  const swatch = document.getElementById('wiz-hd-swatch');
  if (swatch) swatch.style.background = hex || '#7F77DD';
}

function initials(s) {
  if (!s) return '+';
  return s.trim().split(/\s+/).map(w => w[0]).slice(0,2).join('').toUpperCase() || '+';
}

const STEP_LABELS = ['Datos básicos','Grupos','Territorios'];

function renderWizardHeader() {
  const isEdit = !!editingCongreId;
  const nombre = document.getElementById('w-nombre')?.value.trim() || '';
  document.getElementById('wiz-hd-swatch').textContent = isEdit ? initials(nombre) : '+';
  document.getElementById('wiz-hd-eyebrow').textContent = isEdit
    ? `Editando · ${editingCongreId}`
    : 'Nueva';
  document.getElementById('wiz-hd-title').textContent = isEdit && nombre
    ? nombre
    : 'Nueva congregación';
  const label = STEP_LABELS[wizardStep] || '';
  document.getElementById('wiz-hd-sub').textContent = `${label} · ${wizardStep + 1} de 3`;
  const cur = document.getElementById('step-curr');
  if (cur) cur.textContent = String(wizardStep + 1);
}

function renderColorSwatches(selectedColor) {
  const wrap = document.getElementById('w-color-swatches');
  if (!wrap) return;
  const colorInput = document.getElementById('w-color');
  if (colorInput) colorInput.value = selectedColor || '#378ADD';
  const inPaleta = PALETA_COLORES.includes((selectedColor || '').toUpperCase()) || PALETA_COLORES.includes(selectedColor);
  wrap.innerHTML = PALETA_COLORES.map(c => `
    <div class="color-swatch ${c.toLowerCase() === (selectedColor || '').toLowerCase() ? 'sel' : ''}"
         style="background:${c};color:${c};"
         data-color="${c}"
         onclick="selectCongreColor('${c}')"></div>
  `).join('') + `
    <div class="color-swatch custom ${!inPaleta && selectedColor ? 'sel' : ''}"
         title="Color personalizado"
         ${!inPaleta && selectedColor ? `style="color:${selectedColor};"` : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
      <input type="color" value="${selectedColor || '#7F77DD'}" oninput="selectCongreColor(this.value)">
    </div>`;
}

function selectCongreColor(hex) {
  document.getElementById('w-color').value = hex;
  renderColorSwatches(hex);
  setWizardCC(hex);
}

const GRUPOS_DEFAULT = [
  { id: '1', label: 'Grupo 1',      color: '#378ADD' },
  { id: '2', label: 'Grupo 2',      color: '#EF9F27' },
  { id: '3', label: 'Grupo 3',      color: '#97C459' },
  { id: '4', label: 'Grupo 4',      color: '#D85A30' },
  { id: 'C', label: 'Congregación', color: '#7F77DD' },
];

let wizardStep        = 0;
let kmlTerritories    = null;
let wizardGrupos      = [];
let editingCongreId   = null;
let ciudadesExtrasKml = []; // [{ nombre, offset, territories }]
let wizardSalon       = null; // { lat, lng } — Salón del Reino (marcador del mapa)

// ─────────────────────────────────────────
//   SALÓN DEL REINO (marcador del mapa)
// ─────────────────────────────────────────
const SALON_NOMBRE = 'Salón del Reino';
const SALON_PIN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 3l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/></svg>';

// El pin usa el color del grupo "Congregación" (mismo criterio que mapa.html)
function salonPinColor() {
  const congre = wizardGrupos.find(g => String(g.id) === 'C');
  return congre?.color || document.getElementById('w-color')?.value || '#E8E8E8';
}

function salonParaGuardar() {
  if (!wizardSalon) return null;
  return { lat: wizardSalon.lat, lng: wizardSalon.lng, nombre: SALON_NOMBRE };
}

function renderSalonField() {
  const txt = document.getElementById('w-salon-txt');
  const rm  = document.getElementById('w-salon-rm');
  if (!txt) return;
  if (wizardSalon) {
    txt.textContent = `${wizardSalon.lat.toFixed(6)}, ${wizardSalon.lng.toFixed(6)}`;
    txt.classList.remove('empty');
    if (rm) rm.style.display = '';
  } else {
    txt.textContent = 'Sin ubicación';
    txt.classList.add('empty');
    if (rm) rm.style.display = 'none';
  }
}

function quitarSalon() {
  wizardSalon = null;
  renderSalonField();
}

// Leaflet se carga sólo cuando se abre el picker (no hace falta en el resto del panel)
let _leafletPromise = null;
function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel  = 'stylesheet';
    css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src     = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload  = () => resolve();
    js.onerror = () => reject(new Error('No se pudo cargar el mapa'));
    document.head.appendChild(js);
  });
  return _leafletPromise;
}

let _salonMap    = null;
let _salonMarker = null;
let _salonSel    = null;

function cerrarSalonPicker() {
  const m = document.getElementById('salon-modal');
  if (m) m.remove();
  _salonMap = _salonMarker = _salonSel = null;
}

async function abrirSalonPicker() {
  cerrarSalonPicker();

  const modal = document.createElement('div');
  modal.id = 'salon-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:500;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `
    <div class="salon-sheet">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--k-tx-eeeeee, #eee);">Salón del Reino</div>
          <div style="font-size:12px;color:var(--text-muted, #666);margin-top:2px;">Arrastrá el marcador o tocá el mapa</div>
        </div>
        <button onclick="cerrarSalonPicker()" style="background:var(--k-bg-333333, #333);border:none;border-radius:8px;width:32px;height:32px;color:var(--text-secondary, #aaa);font-size:20px;cursor:pointer;line-height:1;">×</button>
      </div>
      <input class="vincular-search" id="salon-search" type="text" autocomplete="off"
             placeholder="Buscar dirección o esquina…" onkeydown="if(event.key==='Enter'){event.preventDefault();buscarDireccionSalon();}">
      <div id="salon-map"></div>
      <div class="salon-hint" id="salon-coords">Sin ubicación elegida</div>
      <div style="display:flex;gap:8px;">
        <button class="btn-sec" style="flex:1;" onclick="cerrarSalonPicker()">Cancelar</button>
        <button class="btn-pri" style="flex:1;" id="salon-ok" onclick="confirmarSalon()">Usar esta ubicación</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) cerrarSalonPicker(); });
  document.body.appendChild(modal);

  try {
    await cargarLeaflet();
  } catch (err) {
    await uiAlert('No se pudo cargar el mapa: ' + err.message);
    cerrarSalonPicker();
    return;
  }
  if (!document.getElementById('salon-modal')) return; // se cerró mientras cargaba

  _salonMap = L.map('salon-map', { zoomControl: true, attributionControl: false })
    .setView([-38.4, -63.6], 4);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(_salonMap);
  setTimeout(() => _salonMap && _salonMap.invalidateSize(), 60);
  _salonMap.on('click', e => ponerSalonEn(e.latlng.lat, e.latlng.lng, null));

  if (wizardSalon) {
    ponerSalonEn(wizardSalon.lat, wizardSalon.lng, 17);
  } else {
    // Sin ubicación previa: centrar en la ciudad principal y dejar el pin listo para arrastrar
    const ciudad = document.getElementById('w-ciudad-principal')?.value.trim();
    if (ciudad) {
      const p = await geocodificar(ciudad + ', Argentina');
      if (p && _salonMap) ponerSalonEn(p.lat, p.lng, 15);
    }
  }
}

function ponerSalonEn(lat, lng, zoom) {
  if (!_salonMap) return;
  _salonSel = { lat, lng };
  if (_salonMarker) {
    _salonMarker.setLatLng([lat, lng]);
  } else {
    _salonMarker = L.marker([lat, lng], {
      draggable: true,
      autoPan: true,
      icon: L.divIcon({
        className: '',
        html: `<div class="salon-pin" style="--sc:${salonPinColor()}">${SALON_PIN_SVG}</div>`,
        iconSize: [28, 35], iconAnchor: [14, 35],
      })
    }).addTo(_salonMap);
    _salonMarker.on('drag dragend', e => {
      const p = e.target.getLatLng();
      _salonSel = { lat: p.lat, lng: p.lng };
      mostrarCoordsSalon(p.lat, p.lng);
    });
  }
  if (zoom) _salonMap.setView([lat, lng], zoom);
  mostrarCoordsSalon(lat, lng);
}

function mostrarCoordsSalon(lat, lng) {
  const coords = document.getElementById('salon-coords');
  if (coords) coords.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function geocodificar(q) {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { 'Accept-Language': 'es' } }
    );
    const data = await resp.json();
    if (!data?.length) return null;
    const r  = data[0];
    const bb = r.boundingbox?.map(Number); // [sur, norte, oeste, este]
    return {
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      bbox: bb?.length === 4 ? { s: bb[0], n: bb[1], o: bb[2], e: bb[3] } : null,
    };
  } catch (_) {
    return null;
  }
}

// Nominatim no resuelve esquinas ("calle A y calle B"): se busca el nodo que
// comparten las dos calles con Overpass, acotado al bbox de la ciudad.
async function buscarEsquina(calleA, calleB, bbox) {
  const esc  = s => s.replace(/["\\\n]/g, ' ').trim();
  const area = `${bbox.s},${bbox.o},${bbox.n},${bbox.e}`;
  const q = `[out:json][timeout:20];`
    + `way["highway"]["name"~"${esc(calleA)}",i](${area});node(w)->.a;`
    + `way["highway"]["name"~"${esc(calleB)}",i](${area});node(w)->.b;`
    + `node.a.b;out 1;`;
  try {
    const resp = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: q });
    const data = await resp.json();
    const n = (data.elements || [])[0];
    return n ? { lat: n.lat, lng: n.lon } : null;
  } catch (_) {
    return null;
  }
}

async function buscarDireccionSalon() {
  const q = document.getElementById('salon-search')?.value.trim();
  if (!q) return;
  const ciudad = document.getElementById('w-ciudad-principal')?.value.trim();
  const coords = document.getElementById('salon-coords');
  if (coords) coords.textContent = 'Buscando…';

  const esquina = q.split(/\s+(?:y|esq\.?|esquina)\s+/i);
  if (esquina.length === 2 && ciudad) {
    const ref = await geocodificar(`${ciudad}, Argentina`);
    if (ref?.bbox) {
      const p = await buscarEsquina(esquina[0], esquina[1], ref.bbox);
      if (p) {
        ponerSalonEn(p.lat, p.lng, 18);
        return;
      }
    }
  }

  const p = await geocodificar(ciudad ? `${q}, ${ciudad}, Argentina` : q) || await geocodificar(q);
  if (!p) {
    if (coords) coords.textContent = 'No se encontró — probá con calle y número, o tocá el mapa';
    return;
  }
  ponerSalonEn(p.lat, p.lng, 17);
}

async function confirmarSalon() {
  if (!_salonSel) {
    await uiAlert('Tocá el mapa para elegir dónde está el Salón.');
    return;
  }
  wizardSalon = { lat: _salonSel.lat, lng: _salonSel.lng };
  cerrarSalonPicker();
  renderSalonField();
}

function renderGruposConfig() {
  const gc = document.getElementById('grupos-config');
  const showRm = wizardGrupos.length > 1;
  gc.innerHTML = wizardGrupos.map((g, i) => {
    const label = (g.label || '').replace(/"/g, '&quot;');
    const color = g.color || '#888888';
    const swatches = PALETA_COLORES.map(c => `
      <div class="grupo-sw ${c.toLowerCase() === color.toLowerCase() ? 'sel' : ''}"
           data-color="${c}"
           style="background:${c};color:${c};"
           onclick="onGrupoColorPick(${i}, '${c}')"></div>
    `).join('');
    return `
    <div class="grupo-card" data-idx="${i}" style="--gc:${color};">
      <div class="grupo-top">
        <span class="grupo-badge">${g.id}</span>
        <input type="text" class="gc-label" value="${label}" placeholder="Nombre del grupo">
        ${showRm
          ? `<button class="grupo-rm" onclick="removeGrupo(${i})" title="Eliminar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M6 18L18 6"/></svg></button>`
          : ''}
      </div>
      <input type="hidden" class="gc-color" value="${color}">
      <div class="grupo-row-2">
        <div class="grupo-col">
          <div class="grupo-col-lbl">Color</div>
          <div class="grupo-color-mini">${swatches}</div>
        </div>
      </div>
    </div>`;
  }).join('') + `<button class="btn-add-grupo" onclick="addGrupo()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="14" height="14"><path d="M12 5v14M5 12h14"/></svg> Agregar grupo</button>`;
}

function syncGruposFromDOM() {
  document.querySelectorAll('#grupos-config .grupo-card').forEach((row, i) => {
    if (!wizardGrupos[i]) return;
    wizardGrupos[i].color = row.querySelector('.gc-color').value;
    wizardGrupos[i].label = row.querySelector('.gc-label').value.trim();
  });
}

function onGrupoColorPick(i, hex) {
  if (!wizardGrupos[i]) return;
  syncGruposFromDOM();
  wizardGrupos[i].color = hex;
  const card = document.querySelector(`.grupo-card[data-idx="${i}"]`);
  if (!card) return;
  card.style.setProperty('--gc', hex);
  const hidden = card.querySelector('.gc-color');
  if (hidden) hidden.value = hex;
  card.querySelectorAll('.grupo-sw').forEach(sw => {
    sw.classList.toggle('sel', (sw.dataset.color || '').toLowerCase() === hex.toLowerCase());
  });
}

function addGrupo() {
  syncGruposFromDOM();
  const maxNum = Math.max(0, ...wizardGrupos.map(g => isNaN(g.id) ? 0 : parseInt(g.id)));
  wizardGrupos.push({ id: String(maxNum + 1), label: `Grupo ${maxNum + 1}`, color: '#888888' });
  renderGruposConfig();
}

function removeGrupo(idx) {
  syncGruposFromDOM();
  wizardGrupos.splice(idx, 1);
  renderGruposConfig();
}

function startWizard(prefill = null) {
  wizardStep     = 0;
  kmlTerritories = null;
  userEditedId   = false;
  if (!prefill) editingCongreId = null;
  wizardGrupos   = prefill?.grupos?.map(g => ({ ...g })) ?? GRUPOS_DEFAULT.map(g => ({ ...g }));

  const isEdit = !!editingCongreId;
  document.getElementById('w-nombre').value           = prefill?.nombre            || '';
  document.getElementById('w-id').value               = isEdit ? editingCongreId : '';
  document.getElementById('w-vm-script-url').value    = prefill?.vmScriptUrl         || '';
  document.getElementById('w-ciudad-principal').value = prefill?.ciudadPrincipal    || '';
  ciudadesExtrasKml = prefill?.ciudadesExtras?.map(c => ({ nombre: c.nombre, offset: c.offset, territories: null })) ?? [];
  renderCiudadesExtra();
  const ps = prefill?.salonDelReino;
  wizardSalon = (ps && isFinite(ps.lat) && isFinite(ps.lng)) ? { lat: Number(ps.lat), lng: Number(ps.lng) } : null;
  renderSalonField();
  const initColor = prefill?.color || PALETA_COLORES[Math.floor(Math.random() * PALETA_COLORES.length)];
  renderColorSwatches(initColor);
  setWizardCC(initColor);
  document.getElementById('kml-input').value = '';
  document.getElementById('kml-preview').style.display  = 'none';
  document.getElementById('btn-crear').disabled          = !isEdit;
  document.getElementById('btn-crear').textContent       = isEdit ? 'Guardar →' : 'Crear →';
  document.getElementById('wizard-status').textContent   = '';
  document.getElementById('field-id').style.display      = '';
  document.getElementById('field-id-hint').textContent   = isEdit
    ? '· cambiar el ID moverá todos los datos a la nueva dirección'
    : '· solo minúsculas, números y guiones';
  // legacy (hidden), kept for backwards compat
  const t0 = document.getElementById('step0-title');
  if (t0) t0.textContent = isEdit ? 'Editar congregación' : 'Nueva congregación';
  const s0 = document.getElementById('step0-sub');
  if (s0) s0.textContent = isEdit ? 'Editando datos básicos' : 'Paso 1 de 3 · Datos básicos';

  renderGruposConfig();
  showWizardStep(0);
  renderWizardHeader();
  showView('view-wizard');
}

async function editCongre(id) {
  editingCongreId = id;
  uiLoading.show('Cargando datos...');
  try {
    const [congreSnap, gruposSnap, privateSnap] = await Promise.all([
      getDoc(doc(db, 'congregaciones', id)),
      getDocs(collection(db, 'congregaciones', id, 'grupos')),
      getDoc(privateModuleConfigRef(id)).catch(() => null),
    ]);
    uiLoading.hide();
    const data   = congreSnap.data();
    const privateData = privateSnap?.exists?.() ? privateSnap.data() : {};
    const grupos = [];
    gruposSnap.forEach(d => grupos.push(d.data()));
    grupos.sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);
    startWizard({
      nombre:            data.nombre,
      vmScriptUrl:       privateData.vmScriptUrl ?? '',
      color:             data.color || null,
      ciudadPrincipal:   data.ciudadPrincipal || '',
      ciudadesExtras:    data.ciudadesExtras || [],
      salonDelReino:     data.salonDelReino || null,
      grupos,
    });
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al cargar los datos: ' + e.message);
  }
}

async function deleteCongre(id, nombre) {
  const ok = await uiConfirm({
    title: 'Eliminar congregación',
    msg: `¿Seguro que querés eliminar "${nombre}"? Se borrarán también sus grupos, territorios, publicadores y asignaciones. Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger',
  });
  if (!ok) return;

  uiLoading.show('Eliminando...');
  try {
    const subcols = ['grupos', 'territorios', 'salidas', 'publicadores', 'asignaciones', 'vidaministerio', 'mapa_grupos', 'mapa_territorios', 'config_privada', 'vm_programa', 'vm_publicadores', 'vm_especiales', 'asig_programa', 'asig_especiales'];
    for (const sub of subcols) {
      const snap = await getDocs(collection(db, 'congregaciones', id, sub));
      if (snap.empty) continue;
      const batch = writeBatch(db);
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    await deleteDoc(publicConfigRef(id)).catch(() => {});
    await deleteDoc(doc(db, 'congregaciones', id));
    uiLoading.hide();
    uiToast('Congregación eliminada', 'success');
    loadDashboard();
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al eliminar: ' + e.message);
  }
}

function showWizardStep(step) {
  [0, 1, 2].forEach(i => {
    document.getElementById(`step-${i}`).style.display  = i === step ? '' : 'none';
    const seg = document.getElementById(`sdot-${i}`);
    if (seg) {
      seg.classList.toggle('done',   i < step);
      seg.classList.toggle('active', i === step);
    }
  });
  wizardStep = step;
  renderWizardHeader();
}

function wizardNext() {
  if (wizardStep === 0) {
    const nombre = document.getElementById('w-nombre').value.trim();
    const id     = document.getElementById('w-id').value.trim();
    if (!nombre)                             { uiAlert('Ingresá el nombre de la congregación.'); return; }
    if (!id)                                 { uiAlert('Ingresá un ID para la congregación.'); return; }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id))  {
      uiAlert('El ID solo puede tener minúsculas, números y guiones, y debe empezar con una letra o número.');
      return;
    }
  }
  if (wizardStep === 1) {
    syncGruposFromDOM();
    for (const g of wizardGrupos) {
      if (!g.label) { uiAlert('Todos los grupos deben tener un nombre.'); return; }
    }
  }
  showWizardStep(wizardStep + 1);
}

function wizardPrev() {
  showWizardStep(wizardStep - 1);
}

// ─────────────────────────────────────────
//   KML
// ─────────────────────────────────────────
function onKmlFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      kmlTerritories = parseKML(e.target.result);
      const preview = document.getElementById('kml-preview');
      preview.style.display = '';
      preview.textContent = `✓ ${kmlTerritories.length} territorios encontrados en el KML`;
      document.getElementById('btn-crear').disabled = false;
    } catch(err) {
      uiAlert('Error al procesar el KML: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// Drag & drop
const kmlDrop = document.getElementById('kml-drop');
kmlDrop.addEventListener('dragover',  e => { e.preventDefault(); kmlDrop.classList.add('drag'); });
kmlDrop.addEventListener('dragleave', ()  => kmlDrop.classList.remove('drag'));
kmlDrop.addEventListener('drop', e => {
  e.preventDefault();
  kmlDrop.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file) onKmlFile({ files: [file] });
});

function parseKML(text) {
  const xml        = new DOMParser().parseFromString(text, 'text/xml');
  const placemarks = xml.getElementsByTagName('Placemark');
  const territories = {};

  for (const pm of placemarks) {
    const name     = pm.getElementsByTagName('name')[0]?.textContent?.trim() || '';
    // Soporta "1", "1a", "92b", "Territorio 1", "Territorio 1a", etc.
    const numMatch = name.match(/(\d+)[a-zA-Z]*$/);
    if (!numMatch) continue;
    const baseNum = numMatch[1];

    if (!territories[baseNum]) {
      territories[baseNum] = {
        id:       parseInt(baseNum),
        nombre:   `Territorio ${baseNum}`,
        tipo:     'normal',
        grupoId:  null,
        punto:    null,
        poligonos: [],
      };
    }

    // Punto central
    const pointEls = pm.getElementsByTagName('Point');
    if (pointEls.length > 0) {
      const coordEl = pointEls[0].getElementsByTagName('coordinates')[0];
      if (coordEl) {
        const [lng, lat] = coordEl.textContent.trim().split(',').map(Number);
        if (!isNaN(lat) && !isNaN(lng)) territories[baseNum].punto = { lat, lng };
      }
    }

    // Polígono — usa getElementsByTagName para mayor compatibilidad con KMLs de Google My Maps
    const polygonEls = pm.getElementsByTagName('Polygon');
    for (const poly of polygonEls) {
      const outerEls = poly.getElementsByTagName('outerBoundaryIs');
      if (!outerEls.length) continue;
      const ringEls = outerEls[0].getElementsByTagName('LinearRing');
      if (!ringEls.length) continue;
      const coordEl = ringEls[0].getElementsByTagName('coordinates')[0];
      if (!coordEl) continue;
      const coords = coordEl.textContent.trim().split(/\s+/)
        .map(c => { const p = c.split(',').map(Number); return { lat: p[1], lng: p[0] }; })
        .filter(c => !isNaN(c.lat) && !isNaN(c.lng));
      if (coords.length > 0) territories[baseNum].poligonos.push({ coords });
    }
  }

  return Object.values(territories).filter(t => t.poligonos.length > 0);
}

// ─────────────────────────────────────────
//   CIUDADES EXTRA
// ─────────────────────────────────────────
function renderCiudadesExtra() {
  const list = document.getElementById('ciudades-extra-list');
  if (!list) return;
  list.innerHTML = ciudadesExtrasKml.map((c, i) => `
    <div class="ciudad-extra-row" data-idx="${i}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <input class="ce-nombre gc-label" value="${c.nombre}" placeholder="Nombre de la ciudad (ej: Ataliva Roca)" style="flex:1;">
        <button class="btn-remove-grupo" onclick="removeCiudadExtra(${i})" title="Eliminar">×</button>
      </div>
      <div class="kml-drop kml-drop-sm" onclick="document.getElementById('ce-kml-${i}').click()">
        ${c.territories
          ? `<span style="color:var(--k-tx-5dcaa5, #5DCAA5);font-size:12px;">✓ ${c.territories.length} territorios cargados (IDs +${c.offset})</span>`
          : `<span style="font-size:12px;color:var(--k-tx-888888, #888);">Subir KML · se numeran desde 1, se guardan con ID +${c.offset}</span>`}
      </div>
      <input type="file" id="ce-kml-${i}" accept=".kml" style="display:none" onchange="onCiudadExtraKmlFile(${i}, this)">
    </div>`).join('');
}

function syncCiudadesExtraFromDOM() {
  document.querySelectorAll('#ciudades-extra-list .ciudad-extra-row').forEach((row, i) => {
    if (ciudadesExtrasKml[i]) {
      ciudadesExtrasKml[i].nombre = row.querySelector('.ce-nombre')?.value.trim() || '';
    }
  });
}

function addCiudadExtra() {
  syncCiudadesExtraFromDOM();
  const maxOffset = ciudadesExtrasKml.length > 0
    ? Math.max(...ciudadesExtrasKml.map(c => c.offset || 0))
    : 0;
  ciudadesExtrasKml.push({ nombre: '', offset: maxOffset + 1000, territories: null });
  renderCiudadesExtra();
}

function removeCiudadExtra(idx) {
  syncCiudadesExtraFromDOM();
  ciudadesExtrasKml.splice(idx, 1);
  renderCiudadesExtra();
}

function onCiudadExtraKmlFile(idx, input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      syncCiudadesExtraFromDOM();
      const offset = ciudadesExtrasKml[idx].offset;
      const terrs = parseKML(e.target.result).map(t => ({
        ...t,
        id:     t.id + offset,
        nombre: `Territorio ${t.id}`,
        grupoId: 'C',
      }));
      ciudadesExtrasKml[idx].territories = terrs;
      renderCiudadesExtra();
    } catch(err) {
      uiAlert('Error al procesar el KML: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function publicConfigRef(congreId) {
  return doc(db, 'congregaciones', congreId, 'mapa_config', 'publico');
}

function privateModuleConfigRef(congreId) {
  return doc(db, 'congregaciones', congreId, 'config_privada', 'modulos');
}

function publicGruposCol(congreId) {
  return collection(db, 'congregaciones', congreId, 'mapa_grupos');
}

function publicTerritoriosCol(congreId) {
  return collection(db, 'congregaciones', congreId, 'mapa_territorios');
}

function toPublicTerritorio(t) {
  return {
    id: t.id,
    nombre: t.nombre || `Territorio ${t.id}`,
    tipo: t.tipo || 'normal',
    grupoId: t.grupoId || null,
    punto: t.punto || null,
    poligonos: t.poligonos || [],
    ciudad: t.ciudad || null,
  };
}

async function syncPublicMapConfig(congreId, data) {
  await setDoc(publicConfigRef(congreId), {
    nombre: data.nombre || congreId,
    color: data.color || null,
    ciudadPrincipal: data.ciudadPrincipal || null,
    ciudadesExtras: data.ciudadesExtras || [],
    salonDelReino: data.salonDelReino || null,
    updatedAt: Timestamp.now(),
  });
}

async function replacePublicMapGroups(congreId, grupos) {
  const existing = await getDocs(publicGruposCol(congreId));
  if (!existing.empty) {
    for (let i = 0; i < existing.docs.length; i += 400) {
      const batch = writeBatch(db);
      existing.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  for (let i = 0; i < grupos.length; i += 400) {
    const batch = writeBatch(db);
    grupos.slice(i, i + 400).forEach(g => {
      batch.set(doc(db, 'congregaciones', congreId, 'mapa_grupos', String(g.id)), {
        id: String(g.id),
        label: g.label || `Grupo ${g.id}`,
        color: g.color || '#888',
      });
    });
    await batch.commit();
  }
}

async function replacePublicMapTerritories(congreId, territorios) {
  const existing = await getDocs(publicTerritoriosCol(congreId));
  if (!existing.empty) {
    for (let i = 0; i < existing.docs.length; i += 400) {
      const batch = writeBatch(db);
      existing.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  for (let i = 0; i < territorios.length; i += 400) {
    const batch = writeBatch(db);
    territorios.slice(i, i + 400).forEach(t => {
      batch.set(doc(db, 'congregaciones', congreId, 'mapa_territorios', String(t.id)), toPublicTerritorio(t));
    });
    await batch.commit();
  }
}

async function ensurePublicMapMirror(congreId, congreData, grupos, territorios) {
  await syncPublicMapConfig(congreId, {
    nombre: congreData?.nombre || congreId,
    color: congreData?.color || null,
    ciudadPrincipal: congreData?.ciudadPrincipal || null,
    ciudadesExtras: congreData?.ciudadesExtras || [],
    salonDelReino: congreData?.salonDelReino || null,
  });
  await replacePublicMapGroups(congreId, grupos || []);
  await replacePublicMapTerritories(congreId, territorios || []);
}

// ─────────────────────────────────────────
//   RENAME CONGREGACIÓN (copia + elimina)
// ─────────────────────────────────────────
async function renameCongre(oldId, newId) {
  const existing = await getDoc(doc(db, 'congregaciones', newId));
  if (existing.exists()) throw new Error(`Ya existe una congregación con el ID "${newId}".`);

  const oldSnap = await getDoc(doc(db, 'congregaciones', oldId));
  await setDoc(doc(db, 'congregaciones', newId), oldSnap.data());

  const subcols = ['grupos', 'territorios', 'historial', 'salidas', 'publicadores', 'asignaciones', 'vidaministerio', 'mapa_grupos', 'mapa_territorios', 'config_privada', 'vm_programa', 'vm_publicadores', 'vm_especiales', 'asig_programa', 'asig_especiales'];
  for (const sub of subcols) {
    const snap = await getDocs(collection(db, 'congregaciones', oldId, sub));
    if (snap.empty) continue;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.set(doc(db, 'congregaciones', newId, sub, d.id), d.data()));
      await batch.commit();
    }
  }

  const oldPublicConfig = await getDoc(publicConfigRef(oldId));
  if (oldPublicConfig.exists()) {
    await setDoc(publicConfigRef(newId), oldPublicConfig.data());
    await deleteDoc(publicConfigRef(oldId));
  }

  for (const sub of subcols) {
    const snap = await getDocs(collection(db, 'congregaciones', oldId, sub));
    if (snap.empty) continue;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'congregaciones', oldId));
}

// ─────────────────────────────────────────
//   CREAR CONGREGACIÓN
// ─────────────────────────────────────────
async function crearCongregacion(skipKml) {
  if (!skipKml && !kmlTerritories) {
    await uiAlert('Subí un archivo KML primero, o usá "Omitir KML".');
    return;
  }

  const nombre            = document.getElementById('w-nombre').value.trim();
  const vmScriptUrl       = document.getElementById('w-vm-script-url').value.trim();
  const ciudadPrincipal   = document.getElementById('w-ciudad-principal').value.trim();
  const status       = document.getElementById('wizard-status');
  status.textContent = '';

  syncCiudadesExtraFromDOM();
  const ciudadesExtrasMetadata = ciudadesExtrasKml
    .filter(ec => ec.nombre)
    .map(ec => ({ nombre: ec.nombre, offset: ec.offset }));
  const salon = salonParaGuardar();

  const grupos = wizardGrupos;

  uiLoading.show(editingCongreId ? 'Guardando cambios...' : 'Creando congregación...');
  try {
    let congreId;

    if (editingCongreId) {
      // ── MODO EDICIÓN ──
      const newId = document.getElementById('w-id').value.trim();
      if (newId !== editingCongreId) {
        uiLoading.show('Renombrando congregación...');
        const oldId = editingCongreId;
        await renameCongre(oldId, newId);
        if (sessionStorage.getItem('congreId') === oldId) sessionStorage.setItem('congreId', newId);
        editingCongreId = newId;
      }
      congreId = editingCongreId;
      const color = document.getElementById('w-color')?.value || null;
      await setDoc(privateModuleConfigRef(congreId), {
        vmScriptUrl: vmScriptUrl || null,
        pinEncargado: deleteField(),
        pinVidaMinisterio: deleteField(),
      }, { merge: true });
      await updateDoc(doc(db, 'congregaciones', congreId), {
        nombre,
        ciudadPrincipal: ciudadPrincipal || null,
        ciudadesExtras: ciudadesExtrasMetadata,
        salonDelReino: salon || deleteField(),
        ...(color && { color }),
        pinEncargado: deleteField(),
        pinVidaMinisterio: deleteField(),
      });
      await syncPublicMapConfig(congreId, {
        nombre,
        color,
        ciudadPrincipal: ciudadPrincipal || null,
        ciudadesExtras: ciudadesExtrasMetadata,
        salonDelReino: salon,
      });

      // Reemplazar grupos: borrar existentes y crear los nuevos
      const existSnap = await getDocs(collection(db, 'congregaciones', congreId, 'grupos'));
      const delBatch = writeBatch(db);
      existSnap.forEach(d => delBatch.delete(d.ref));
      await delBatch.commit();
    } else {
      // ── MODO CREACIÓN ──
      congreId = document.getElementById('w-id').value.trim();
      const existing = await getDoc(doc(db, 'congregaciones', congreId));
      if (existing.exists()) {
        uiLoading.hide();
        await uiAlert(`Ya existe una congregación con el ID "${congreId}".`);
        return;
      }
      const color = document.getElementById('w-color')?.value || PALETA_COLORES[0];
      await setDoc(doc(db, 'congregaciones', congreId), {
        nombre,
        ciudadPrincipal: ciudadPrincipal || null,
        ciudadesExtras: ciudadesExtrasMetadata,
        ...(salon && { salonDelReino: salon }),
        color,
        creadoEn: Timestamp.now(),
      });
      await setDoc(privateModuleConfigRef(congreId), {
        vmScriptUrl: vmScriptUrl || null,
      });
      await syncPublicMapConfig(congreId, {
        nombre,
        color,
        ciudadPrincipal: ciudadPrincipal || null,
        ciudadesExtras: ciudadesExtrasMetadata,
        salonDelReino: salon,
      });
    }

    // Grupos en batch
    const gruposBatch = writeBatch(db);
    grupos.forEach(g => {
      gruposBatch.set(doc(db, 'congregaciones', congreId, 'grupos', g.id), g);
    });
    await gruposBatch.commit();
    await replacePublicMapGroups(congreId, grupos);

    // Territorios del KML en batches de 400
    const terrColRef = collection(db, 'congregaciones', congreId, 'territorios');
    const publicTerritories = [];
    if (!skipKml && kmlTerritories?.length > 0) {
      const total = kmlTerritories.length;
      for (let i = 0; i < total; i += 400) {
        uiLoading.show(`Subiendo territorios... (${Math.min(i + 400, total)}/${total})`);
        const batch = writeBatch(db);
        kmlTerritories.slice(i, i + 400).forEach(t => {
          batch.set(doc(terrColRef, String(t.id)), t);
          publicTerritories.push(toPublicTerritorio(t));
        });
        await batch.commit();
      }
    }

    // Territorios de ciudades extra
    for (const ec of ciudadesExtrasKml) {
      if (!ec.nombre || !ec.territories?.length) continue;
      const total = ec.territories.length;
      for (let i = 0; i < total; i += 400) {
        uiLoading.show(`Subiendo ${ec.nombre}... (${Math.min(i + 400, total)}/${total})`);
        const batch = writeBatch(db);
        ec.territories.slice(i, i + 400).forEach(t => {
          const saved = { ...t, ciudad: ec.nombre };
          batch.set(doc(terrColRef, String(t.id)), saved);
          publicTerritories.push(toPublicTerritorio(saved));
        });
        await batch.commit();
      }
    }
    const shouldReplacePublicTerritories =
      !editingCongreId || (!skipKml && publicTerritories.length > 0);
    if (shouldReplacePublicTerritories) {
      await replacePublicMapTerritories(congreId, publicTerritories);
    }

    uiLoading.hide();
    const wasEditing = !!editingCongreId;
    editingCongreId = null;
    await uiAlert(
      wasEditing
        ? `Cambios guardados en "${nombre}".`
        : `Congregación "${nombre}" creada.\n\nID: ${congreId}`,
      '¡Listo!'
    );
    showView('view-dashboard');
    loadDashboard();

  } catch(err) {
    uiLoading.hide();
    status.className   = 'status-err';
    status.textContent = 'Error: ' + err.message;
  }
}

// ─────────────────────────────────────────
//   TERRITORIOS
// ─────────────────────────────────────────
let terrCongreId = null;
let terrData     = [];
let terrGrupos   = [];
let terrChanges  = {};
let terrFiltro   = null; // null=todos, '__none__'=sin grupo, o grupoId

async function openTerritorios(id, nombre) {
  terrCongreId = id;
  terrChanges  = {};
  terrFiltro   = null;
  document.getElementById('terr-title').textContent = nombre;
  showView('view-territorios');

  const loading = document.getElementById('terr-loading');
  document.getElementById('terr-list').innerHTML = '';
  document.getElementById('terr-save-bar').style.display = 'none';
  loading.style.display = 'flex';

  try {
    const [terrSnap, gruposSnap] = await Promise.all([
      getDocs(collection(db, 'congregaciones', id, 'territorios')),
      getDocs(collection(db, 'congregaciones', id, 'grupos')),
    ]);
    terrData = [];
    terrSnap.forEach(d => terrData.push({ ...d.data(), _docId: d.id }));
    terrData.sort((a, b) => (parseInt(a.id) || 0) - (parseInt(b.id) || 0));

    terrGrupos = [];
    gruposSnap.forEach(d => terrGrupos.push(d.data()));
    terrGrupos.sort((a, b) => String(a.id) < String(b.id) ? -1 : 1);

    loading.style.display = 'none';
    renderTerrFiltros();
    renderTerrList();
  } catch(e) {
    loading.innerHTML = `<span class="status-err">Error: ${e.message}</span>`;
  }
}

function renderTerrFiltros() {
  const filtros = [
    { id: null,       label: 'Todos',     color: '#555' },
    { id: '__none__', label: 'Sin grupo', color: '#444' },
    ...terrGrupos,
  ];
  document.getElementById('terr-filtros').innerHTML = filtros.map(f => {
    const active = terrFiltro === f.id;
    return `<button class="terr-filtro-btn ${active ? 'active' : ''}"
      style="border-color:${f.color};${active ? `background:${f.color};` : `color:${f.color};`}"
      onclick="setTerrFiltro(${f.id === null ? 'null' : `'${f.id}'`})">${f.label}</button>`;
  }).join('');
}

function setTerrFiltro(f) {
  terrFiltro = f;
  renderTerrFiltros();
  renderTerrList();
}

function renderTerrList() {
  let lista = terrData;
  if (terrFiltro === '__none__') {
    lista = terrData.filter(t => !(terrChanges[t._docId] ?? t.grupoId));
  } else if (terrFiltro !== null) {
    lista = terrData.filter(t => (terrChanges[t._docId] ?? t.grupoId) === terrFiltro);
  }

  const noBtn = `<button class="terr-g-btn" data-grupo="" style="border-color:var(--k-bd-555555, #555);"
    onclick="assignGrupo('{ID}','')">—</button>`;

  document.getElementById('terr-list').innerHTML = lista.length === 0
    ? '<p style="color:var(--text-muted, #666);font-size:14px;text-align:center;padding:20px 0;">Sin territorios en este filtro.</p>'
    : lista.map(t => {
        const cur     = terrChanges[t._docId] ?? t.grupoId ?? '';
        const changed = t._docId in terrChanges;
        const btns = [
          ...terrGrupos.map(g => {
            const sel = cur === g.id;
            return `<button class="terr-g-btn${sel ? ' sel' : ''}" data-grupo="${g.id}"
              style="border-color:${g.color};${sel ? `background:${g.color};` : ''}"
              onclick="assignGrupo('${t._docId}','${g.id}')">${g.label.replace(/^Grupo\s*/i,'').substring(0,5)}</button>`;
          }),
          `<button class="terr-g-btn${!cur ? ' sel' : ''}" data-grupo=""
            style="border-color:var(--k-bd-555555, #555);${!cur ? 'background:#555;' : ''}"
            onclick="assignGrupo('${t._docId}','')">—</button>`,
        ].join('');
        const displayNum = t.nombre ? t.nombre.replace('Territorio ', '') : String(t.id);
        return `<div class="terr-row${changed ? ' changed' : ''}" id="terr-row-${t._docId}">
          <div style="min-width:36px;">
            <span class="terr-num">${displayNum}</span>
            ${t.ciudad ? `<div style="font-size:9px;color:var(--k-tx-888888, #888);line-height:1.2;margin-top:1px;">${t.ciudad}</div>` : ''}
          </div>
          <div class="terr-g-btns">${btns}</div>
        </div>`;
      }).join('');
}

function assignGrupo(docId, grupoId) {
  const terr = terrData.find(t => t._docId === docId);
  if (!terr) return;

  const original = terr.grupoId ?? '';
  if (grupoId === original) delete terrChanges[docId];
  else terrChanges[docId] = grupoId;

  const cur     = terrChanges[docId] ?? original;
  const changed = docId in terrChanges;
  const row = document.getElementById(`terr-row-${docId}`);
  if (row) {
    row.classList.toggle('changed', changed);
    row.querySelectorAll('.terr-g-btn').forEach(btn => {
      const bg = btn.dataset.grupo;
      const g  = terrGrupos.find(x => x.id === bg);
      const sel = bg === cur || (!bg && !cur);
      btn.classList.toggle('sel', sel);
      btn.style.background = sel ? (g ? g.color : '#555') : '';
    });
  }
  updateTerrSaveBar();
}

function updateTerrSaveBar() {
  const n = Object.keys(terrChanges).length;
  document.getElementById('terr-changes-count').textContent = n;
  document.getElementById('terr-save-bar').style.display = n > 0 ? '' : 'none';
}

async function saveTerritorios() {
  const entries = Object.entries(terrChanges);
  if (!entries.length) return;
  uiLoading.show(`Guardando ${entries.length} territorios...`);
  try {
    const publicSnap = await getDocs(collection(db, 'congregaciones', terrCongreId, 'mapa_territorios'));
    const expectedPublicIds = new Set(terrData.map(t => String(t.id)));
    const hasUnexpectedPublicIds = publicSnap.docs.some(d => !expectedPublicIds.has(String(d.id)));
    const needsFullMirror =
      publicSnap.empty || publicSnap.size !== terrData.length || hasUnexpectedPublicIds;
    if (needsFullMirror) {
      const congreSnap = await getDoc(doc(db, 'congregaciones', terrCongreId));
      const territoriosPublicos = terrData.map(t => toPublicTerritorio({
        ...t,
        grupoId: terrChanges[t._docId] ?? t.grupoId ?? null,
      }));
      await ensurePublicMapMirror(
        terrCongreId,
        congreSnap.exists() ? congreSnap.data() : {},
        terrGrupos,
        territoriosPublicos
      );
    }

    for (let i = 0; i < entries.length; i += 400) {
      const batch = writeBatch(db);
      const publicBatch = writeBatch(db);
      entries.slice(i, i + 400).forEach(([docId, grupoId]) => {
        const terr = terrData.find(t => t._docId === docId);
        batch.update(doc(db, 'congregaciones', terrCongreId, 'territorios', docId), {
          grupoId: grupoId || null,
        });
        publicBatch.set(doc(db, 'congregaciones', terrCongreId, 'mapa_territorios', String(terr.id)), {
          ...toPublicTerritorio({
            ...terr,
            grupoId: grupoId || null,
          }),
        }, { merge: true });
      });
      await batch.commit();
      await publicBatch.commit();
    }
    entries.forEach(([docId, grupoId]) => {
      const t = terrData.find(x => x._docId === docId);
      if (t) t.grupoId = grupoId || null;
    });
    terrChanges = {};
    uiLoading.hide();
    updateTerrSaveBar();
    renderTerrList();
    uiToast(`${entries.length} territorios guardados`, 'success');
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al guardar: ' + e.message);
  }
}

// ─────────────────────────────────────────
//   HELPERS DE SINCRONIZACIÓN DE ROLES
// ─────────────────────────────────────────
const _ROL_PUB_A_APP = {
  PRECURSOR_REGULAR:  'precursor_regular',
  PRECURSOR_AUXILIAR: 'precursor_auxiliar',
  ANCIANO:            'anciano',
  SIERVO_MINISTERIAL: 'siervo_ministerial',
};
async function _rolesDesdePublicador(congreId, pubId) {
  try {
    const snap = await getDoc(doc(db, 'congregaciones', congreId, 'publicadores', pubId));
    if (!snap.exists()) return [];
    return (snap.data().roles || []).filter(r => _ROL_PUB_A_APP[r]).map(r => _ROL_PUB_A_APP[r]);
  } catch { return []; }
}

// ─────────────────────────────────────────
//   MATCHES PENDIENTES
// ─────────────────────────────────────────
let matchesList = [];

function normalizeMatch(str) {
  if (!str) return '';
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
}

function getCandidates(displayName, pubs) {
  const tokens = normalizeMatch(displayName).split(' ').filter(Boolean);
  return pubs.filter(p => {
    const n = normalizeMatch(p.nombre);
    return tokens.every(t => n.includes(t));
  });
}

async function openMatches() {
  showView('view-matches');
  const loading = document.getElementById('matches-loading');
  const list    = document.getElementById('matches-list');
  loading.style.display = 'flex';
  list.innerHTML = '';

  try {
    const snap = await getDocs(query(collection(db, 'usuarios'), where('matchEstado', '==', 'pendiente')));
    matchesList = [];

    // Caché de publicadores por congregación para no recargar múltiples veces
    const pubsCache = {};
    for (const d of snap.docs) {
      const user = { uid: d.id, ...d.data() };
      let candidates = [];
      if (user.congregacionId && user.displayName) {
        if (!pubsCache[user.congregacionId]) {
          const pubSnap = await getDocs(collection(db, 'congregaciones', user.congregacionId, 'publicadores'));
          pubsCache[user.congregacionId] = pubSnap.docs.map(p => ({ id: p.id, ...p.data() }));
        }
        candidates = getCandidates(user.displayName, pubsCache[user.congregacionId]);
      }
      matchesList.push({ uid: user.uid, displayName: user.displayName, email: user.email, congregacionId: user.congregacionId, candidates });
    }
  } catch(err) {
    document.getElementById('matches-list').innerHTML = `<p style="color:var(--k-tx-f09595, #F09595);font-size:14px;">Error: ${err.message}</p>`;
    loading.style.display = 'none';
    return;
  }

  loading.style.display = 'none';
  renderMatchesList();
}

function fmtRoles(roles) {
  if (!roles?.length) return '';
  return roles.slice(0, 3)
    .map(r => r.replace(/^VM_/, '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()))
    .join(' · ');
}

function renderMatchesList() {
  const list = document.getElementById('matches-list');
  if (matchesList.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted, #666);font-size:14px;text-align:center;padding:24px 0;">No hay matches pendientes.</p>';
    return;
  }
  list.innerHTML = matchesList.map(m => {
    const rolesHtml = roles => fmtRoles(roles)
      ? `<div style="font-size:11px;color:var(--text-muted, #666);margin-top:2px;">${fmtRoles(roles)}</div>` : '';
    const candidatesHtml = m.candidates.length > 0
      ? m.candidates.map(p => `
          <div class="match-pub-row">
            <div style="flex:1;min-width:0;">
              <div style="font-size:14px;color:var(--k-tx-dddddd, #ddd);">${p.nombre}</div>
              ${rolesHtml(p.roles)}
            </div>
            <button class="btn-match-sel" onclick="resolverMatch('${m.uid}','${p.id}','${p.nombre.replace(/'/g,"\\'")}','${m.congregacionId||''}')">Seleccionar</button>
          </div>`).join('')
      : '<p style="font-size:13px;color:var(--text-muted, #666);margin:6px 0;">No se encontraron coincidencias en la base.</p>';

    return `<div class="match-card">
      <div style="font-size:16px;font-weight:600;color:var(--k-tx-eeeeee, #eee);">${m.displayName || '(sin nombre)'}</div>
      <div style="font-size:12px;color:var(--text-muted, #666);margin-top:2px;">${m.email || 'Sin email'}${m.congregacionId ? ' · ' + m.congregacionId : ''}</div>
      ${m.candidates.length > 0
        ? '<div style="font-size:11px;color:var(--k-tx-888888, #888);text-transform:uppercase;letter-spacing:.5px;margin:12px 0 8px;">Posibles coincidencias</div>'
        : ''}
      <div>${candidatesHtml}</div>
      <button class="btn-match-none" onclick="marcarSinMatch('${m.uid}')">No encontrado</button>
    </div>`;
  }).join('');
}

async function resolverMatch(uid, pubId, pubNombre, congreId) {
  const ok = await uiConfirm({ title: 'Confirmar match', msg: `¿Vincular este usuario con "${pubNombre}"?`, confirmText: 'Confirmar', type: 'info' });
  if (!ok) return;
  try {
    const extraRoles = congreId ? await _rolesDesdePublicador(congreId, pubId) : [];
    const appRoles = [...new Set(['publicador', ...extraRoles])];
    await updateDoc(doc(db, 'usuarios', uid), { matchedPublisherId: pubId, matchEstado: 'ok', appRol: 'publicador', appRoles });
    matchesList = matchesList.filter(m => m.uid !== uid);
    renderMatchesList();
    uiToast('Match confirmado', 'success');
  } catch(err) {
    await uiAlert('Error al guardar: ' + err.message);
  }
}

async function marcarSinMatch(uid) {
  const ok = await uiConfirm({ title: 'Sin match', msg: 'El usuario recibirá acceso básico como publicador sin vincular a nadie.', confirmText: 'Confirmar', type: 'warn' });
  if (!ok) return;
  try {
    await updateDoc(doc(db, 'usuarios', uid), { matchedPublisherId: null, matchEstado: 'sin_match', appRol: 'publicador', appRoles: ['publicador'] });
    matchesList = matchesList.filter(m => m.uid !== uid);
    renderMatchesList();
    uiToast('Marcado sin match', 'success');
  } catch(err) {
    await uiAlert('Error al guardar: ' + err.message);
  }
}

// ─────────────────────────────────────────
//   USUARIOS POR CONGREGACIÓN
// ─────────────────────────────────────────
const ROL_LABELS = {
  publicador:               'Publicador',
  precursor_auxiliar:       'Precursor auxiliar',
  precursor_regular:        'Precursor regular',
  siervo_ministerial:       'Siervo ministerial',
  anciano:                  'Anciano',
  encargado_grupo:          'Encargado de grupo',
  encargado_asignaciones:   'Encargado de asignaciones',
  encargado_vm:             'Encargado de VM',
  encargado_conferencias:   'Encargado de conferencias',
  admin_congre:             'Admin congregación',
  pendiente:                'Pendiente (sin acceso)',
};

const ROLES_ASIGNABLES = [
  'publicador', 'precursor_auxiliar', 'precursor_regular',
  'siervo_ministerial', 'anciano', 'encargado_grupo',
  'encargado_asignaciones', 'encargado_vm', 'encargado_conferencias',
  'admin_congre', 'pendiente',
];

// Estado de la vista de usuarios (necesario para refrescar tras vincular)
let _usuariosCongreId     = null;
let _usuariosCongreNombre = null;

async function openUsuarios(congreId, congreNombre) {
  _usuariosCongreId     = congreId;
  _usuariosCongreNombre = congreNombre;
  showView('view-usuarios');
  document.getElementById('usuarios-title').textContent = congreNombre;
  document.getElementById('usuarios-sub').textContent   = 'Cargando...';
  const loading = document.getElementById('usuarios-loading');
  const list    = document.getElementById('usuarios-list');
  loading.style.display = 'flex';
  list.innerHTML = '';

  try {
    const snap    = await getDocs(query(collection(db, 'usuarios'), where('congregacionId', '==', congreId)));
    const usuarios = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => !u.isAnonymous)
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'es'));

    document.getElementById('usuarios-sub').textContent =
      usuarios.length === 0
        ? 'Sin usuarios registrados'
        : `${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''} registrado${usuarios.length !== 1 ? 's' : ''}`;

    loading.style.display = 'none';

    if (usuarios.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted, #666);font-size:14px;text-align:center;padding:24px 0;">Ningún usuario registrado en esta congregación.</p>';
      return;
    }

    list.innerHTML = usuarios.map(u => {
      const ini = (u.displayName || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
      const badge = {
        ok:        '<span class="mbadge ok">✓ Vinculado</span>',
        pendiente: '<span class="mbadge pendiente">⚠ Ambiguo</span>',
        sin_match: '<span class="mbadge sin_match">Sin match</span>',
      }[u.matchEstado] || '';
      const vincularBtn = u.matchEstado !== 'ok'
        ? `<button class="btn-vincular" onclick="abrirVincularModal('${u.uid}','${(u.displayName||'').replace(/'/g,"\\'")}')">🔗 Vincular</button>`
        : '';
      const nameSafe  = (u.displayName || '').replace(/'/g, "\\'");
      const roles     = u.appRoles || (u.appRol ? [u.appRol] : ['publicador']);
      const rolesStr  = roles.join(',');
      const grupoEnc  = u.grupoEncargado || '';
      const pendienteAprobacion = roles.includes('pendiente');
      const rolesPills = roles.map(r =>
        `<span style="font-size:10px;color:var(--k-tx-9b8fdd, #9b8fdd);background:rgba(127,119,221,0.12);border:0.5px solid rgba(127,119,221,0.25);border-radius:6px;padding:2px 7px;">${ROL_LABELS[r] || r}</span>`
      ).join('');
      const aprobarBtn = pendienteAprobacion
        ? `<button onclick="aprobarComoPublicador('${u.uid}')"
             style="font-size:11px;color:var(--k-tx-1d9e75, #1D9E75);background:rgba(29,158,117,0.12);border:0.5px solid rgba(29,158,117,0.25);border-radius:7px;padding:3px 9px;cursor:pointer;">✓ Aprobar acceso</button>`
        : '';
      return `
        <div class="usuario-row">
          <div class="usuario-avatar">${ini}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;color:var(--k-tx-eeeeee, #eee);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.displayName || '(sin nombre)'}</div>
            <div style="font-size:11px;color:var(--text-muted, #666);margin-top:1px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
              <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${u.email || 'Sin email'}</span>${badge}${vincularBtn}
            </div>
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:6px;">
              ${rolesPills}
              ${aprobarBtn}
              <button onclick="abrirRolesModal('${u.uid}','${nameSafe}','${rolesStr}','${grupoEnc}')"
                style="font-size:11px;color:var(--k-tx-888888, #888);background:var(--k-bg-2a2a2a, #2a2a2a);border:0.5px solid var(--k-bd-3a3a3a, #3a3a3a);border-radius:7px;padding:3px 9px;cursor:pointer;">✏ Editar roles</button>
            </div>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    loading.innerHTML = `<span style="color:var(--k-tx-f09595, #F09595);font-size:14px;">Error: ${err.message}</span>`;
  }
}

// ─────────────────────────────────────────
//   MODAL VINCULAR
// ─────────────────────────────────────────
let _vincPubs    = [];
let _vincUid     = null;
let _vincNombre  = null;

function cerrarVincularModal() {
  const m = document.getElementById('vincular-modal');
  if (m) m.remove();
}

async function abrirVincularModal(uid, nombre) {
  cerrarVincularModal();

  const modal = document.createElement('div');
  modal.id = 'vincular-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:500;display:flex;align-items:flex-end;justify-content:center;';
  modal.innerHTML = `
    <div class="vincular-sheet">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--k-tx-eeeeee, #eee);">Vincular publicador</div>
          <div style="font-size:12px;color:var(--text-muted, #666);margin-top:2px;">${nombre}</div>
        </div>
        <button onclick="cerrarVincularModal()" style="background:var(--k-bg-333333, #333);border:none;border-radius:8px;width:32px;height:32px;color:var(--text-secondary, #aaa);font-size:20px;cursor:pointer;line-height:1;">×</button>
      </div>
      <input class="vincular-search" id="vincular-search" type="text" placeholder="Buscar publicador…" oninput="filtrarVincPubs(this.value)">
      <div class="vincular-pub-list" id="vincular-list">
        <div class="loading-wrap"><div class="spinner"></div><div>Cargando...</div></div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) cerrarVincularModal(); });
  document.body.appendChild(modal);

  _vincUid    = uid;
  _vincNombre = nombre;
  _vincPubs   = [];

  try {
    const snap = await getDocs(collection(db, 'congregaciones', _usuariosCongreId, 'publicadores'));
    _vincPubs  = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.activo !== false)
      .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    filtrarVincPubs('');
  } catch (err) {
    document.getElementById('vincular-list').innerHTML =
      `<p style="color:var(--k-tx-f09595, #F09595);font-size:14px;">Error: ${err.message}</p>`;
  }
}

function filtrarVincPubs(q) {
  const norm = q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const list = document.getElementById('vincular-list');
  if (!list) return;
  const filtrados = _vincPubs.filter(p =>
    (p.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(norm)
  );
  if (filtrados.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted, #666);font-size:14px;text-align:center;padding:16px 0;">Sin resultados</p>';
    return;
  }
  list.innerHTML = filtrados.map(p => `
    <div class="match-pub-row">
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;color:var(--k-tx-dddddd, #ddd);">${p.nombre}</div>
        ${p.roles?.length ? `<div style="font-size:11px;color:var(--text-muted, #666);margin-top:2px;">${fmtRoles(p.roles)}</div>` : ''}
      </div>
      <button class="btn-match-sel" onclick="confirmarVinculo('${p.id}','${(p.nombre||'').replace(/'/g,"\\'")}')">Vincular</button>
    </div>`).join('');
}

async function aprobarComoPublicador(uid) {
  const ok = await uiConfirm({
    title:       'Aprobar acceso',
    msg:         '¿Dar acceso de publicador a este usuario?',
    confirmText: 'Aprobar',
    type:        'info',
  });
  if (!ok) return;
  try {
    const snap = await getDoc(doc(db, 'usuarios', uid));
    const data = snap.exists() ? snap.data() : {};
    const extraRoles = (data.matchEstado === 'ok' && data.matchedPublisherId && _usuariosCongreId)
      ? await _rolesDesdePublicador(_usuariosCongreId, data.matchedPublisherId)
      : [];
    const appRoles = [...new Set(['publicador', ...extraRoles])];
    await updateDoc(doc(db, 'usuarios', uid), { appRol: 'publicador', appRoles });
    uiToast('Usuario aprobado', 'success');
    openUsuarios(_usuariosCongreId, _usuariosCongreNombre);
  } catch (err) {
    await uiAlert('Error al aprobar: ' + err.message);
  }
}

async function confirmarVinculo(pubId, pubNombre) {
  const ok = await uiConfirm({
    title:       'Confirmar vínculo',
    msg:         `¿Vincular "${_vincNombre}" con "${pubNombre}"?`,
    confirmText: 'Vincular',
    type:        'info',
  });
  if (!ok) return;
  try {
    const extraRoles = _usuariosCongreId ? await _rolesDesdePublicador(_usuariosCongreId, pubId) : [];
    const appRoles = [...new Set(['publicador', ...extraRoles])];
    await updateDoc(doc(db, 'usuarios', _vincUid), { matchedPublisherId: pubId, matchEstado: 'ok', appRol: 'publicador', appRoles });
    cerrarVincularModal();
    uiToast('Vínculo guardado', 'success');
    openUsuarios(_usuariosCongreId, _usuariosCongreNombre);
  } catch (err) {
    uiToast('Error: ' + err.message, 'error');
  }
}

// ─────────────────────────────────────────
//   MODAL EDITAR ROLES (multi-rol)
// ─────────────────────────────────────────
let _rolesUid    = null;
let _rolesNombre = null;

function cerrarRolesModal() {
  const m = document.getElementById('roles-modal');
  if (m) m.remove();
}

// Muestra/oculta el selector de grupo cuando se marca encargado_grupo
window.toggleEncargadoGrupoSel = function() {
  const checked = !!document.querySelector('#roles-cb-list input[value="encargado_grupo"]:checked');
  const wrap    = document.getElementById('roles-grupo-wrap');
  if (wrap) wrap.style.display = checked ? '' : 'none';
};

async function abrirRolesModal(uid, nombre, rolesStr, grupoEncargado) {
  cerrarRolesModal();
  _rolesUid    = uid;
  _rolesNombre = nombre;

  const currentRoles = rolesStr ? rolesStr.split(',').filter(Boolean) : ['publicador'];

  const checkboxes = ROLES_ASIGNABLES.map(r => `
    <label style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid var(--k-bd-2a2a2a, #2a2a2a);cursor:pointer;">
      <input type="checkbox" value="${r}" ${currentRoles.includes(r) ? 'checked' : ''}
        onchange="toggleEncargadoGrupoSel()"
        style="width:16px;height:16px;accent-color:#7F77DD;flex-shrink:0;cursor:pointer;">
      <span style="font-size:13px;color:var(--k-tx-dddddd, #ddd);">${ROL_LABELS[r] || r}</span>
    </label>`).join('');

  const modal = document.createElement('div');
  modal.id = 'roles-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:var(--bg-card, #232628);border:0.5px solid var(--k-bd-3a3a3a, #3a3a3a);border-radius:16px;padding:20px;width:100%;max-width:340px;">
      <div style="font-size:15px;font-weight:600;color:var(--k-tx-eeeeee, #eee);margin-bottom:2px;">Roles</div>
      <div style="font-size:12px;color:var(--text-muted, #666);margin-bottom:14px;">${nombre}</div>
      <div id="roles-cb-list" style="max-height:300px;overflow-y:auto;">${checkboxes}</div>
      <div id="roles-grupo-wrap" style="display:${currentRoles.includes('encargado_grupo') ? '' : 'none'};margin-top:12px;">
        <div style="font-size:12px;color:var(--k-tx-888888, #888);margin-bottom:6px;">Grupo asignado</div>
        <select id="roles-grupo-sel" style="width:100%;padding:8px 10px;background:var(--bg-primary, #1a1c1f);border:0.5px solid var(--k-bd-3a3a3a, #3a3a3a);border-radius:8px;color:var(--k-tx-dddddd, #ddd);font-size:13px;">
          <option value="">— Cargando grupos… —</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px;">
        <button onclick="cerrarRolesModal()" style="flex:1;padding:10px;background:var(--k-bg-2a2a2a, #2a2a2a);border:0.5px solid var(--k-bd-3a3a3a, #3a3a3a);border-radius:10px;color:var(--text-secondary, #aaa);font-size:13px;cursor:pointer;">Cancelar</button>
        <button onclick="confirmarRolesModal()" style="flex:2;padding:10px;background:#7F77DD;border:none;border-radius:10px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Guardar</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) cerrarRolesModal(); });
  document.body.appendChild(modal);

  // Cargar grupos de Firestore para el selector de encargado_grupo
  try {
    const snap   = await getDocs(collection(db, 'congregaciones', _usuariosCongreId, 'grupos'));
    const grupos = snap.docs.map(d => d.data()).filter(g => g.id).sort((a, b) => {
      const an = parseInt(a.id), bn = parseInt(b.id);
      return (!isNaN(an) && !isNaN(bn)) ? an - bn : String(a.id).localeCompare(String(b.id));
    });
    const sel = document.getElementById('roles-grupo-sel');
    if (sel) {
      sel.innerHTML = '<option value="">— Elegir grupo —</option>' +
        grupos.map(g => `<option value="${g.id}" ${String(g.id) === String(grupoEncargado) ? 'selected' : ''}>${g.label || 'Grupo ' + g.id}</option>`).join('');
    }
  } catch (err) {
    const sel = document.getElementById('roles-grupo-sel');
    if (sel) sel.innerHTML = '<option value="">Error al cargar grupos</option>';
  }
}

window.confirmarRolesModal = async function() {
  const checked   = document.querySelectorAll('#roles-cb-list input[type="checkbox"]:checked');
  const newRoles  = Array.from(checked).map(cb => cb.value);
  if (newRoles.length === 0) { uiToast('Seleccioná al menos un rol', 'error'); return; }

  let grupoEncargado = null;
  if (newRoles.includes('encargado_grupo')) {
    grupoEncargado = document.getElementById('roles-grupo-sel')?.value || null;
    if (!grupoEncargado) { uiToast('Seleccioná el grupo del encargado', 'error'); return; }
  }

  const uid    = _rolesUid;
  const nombre = _rolesNombre;
  cerrarRolesModal();

  try {
    await updateDoc(doc(db, 'usuarios', uid), {
      appRoles:       newRoles,
      appRol:         newRoles[0], // backward compat
      grupoEncargado: grupoEncargado,
    });
    uiToast(`${nombre || 'Usuario'} → ${newRoles.map(r => ROL_LABELS[r] || r).join(', ')}`, 'success');
    openUsuarios(_usuariosCongreId, _usuariosCongreNombre);
  } catch (err) {
    uiToast('Error al guardar: ' + err.message, 'error');
  }
};

// ── Exponer al HTML ──
window.pinPress          = pinPress;
window.pinDelete         = pinDelete;
window.showView          = showView;
window.onNombreInput     = onNombreInput;
window.onIdInput         = onIdInput;
window.startWizard       = startWizard;
window.editCongre        = editCongre;
window.deleteCongre      = deleteCongre;
window.selectCongreColor = selectCongreColor;
window.renderColorSwatches = renderColorSwatches;
window.wizardNext        = wizardNext;
window.wizardPrev        = wizardPrev;
window.addGrupo          = addGrupo;
window.removeGrupo       = removeGrupo;
window.onGrupoColorPick  = onGrupoColorPick;
window.onKmlFile             = onKmlFile;
window.addCiudadExtra        = addCiudadExtra;
window.removeCiudadExtra     = removeCiudadExtra;
window.onCiudadExtraKmlFile  = onCiudadExtraKmlFile;
window.abrirSalonPicker      = abrirSalonPicker;
window.cerrarSalonPicker     = cerrarSalonPicker;
window.buscarDireccionSalon  = buscarDireccionSalon;
window.confirmarSalon        = confirmarSalon;
window.quitarSalon           = quitarSalon;
window.crearCongregacion     = crearCongregacion;
window.openTerritorios   = openTerritorios;
window.setTerrFiltro     = setTerrFiltro;
window.assignGrupo       = assignGrupo;
window.saveTerritorios   = saveTerritorios;
window.openMatches       = openMatches;
window.resolverMatch     = resolverMatch;
window.marcarSinMatch    = marcarSinMatch;
window.openUsuarios      = openUsuarios;
window.aprobarComoPublicador = aprobarComoPublicador;
window.abrirRolesModal   = abrirRolesModal;
window.cerrarRolesModal  = cerrarRolesModal;
window.abrirVincularModal  = abrirVincularModal;
window.cerrarVincularModal = cerrarVincularModal;
window.filtrarVincPubs     = filtrarVincPubs;
window.confirmarVinculo    = confirmarVinculo;

// ─────────────────────────────────────────
//   ACTIVIDAD
// ─────────────────────────────────────────
const ACT_MODULOS = {
  'territorios':     { label: 'Territorios',     icon: '🗺️',  color: '#378ADD' },
  'asignaciones':    { label: 'Asignaciones',    icon: '📋',  color: '#EF9F27' },
  'vida-ministerio': { label: 'Vida y Min.',     icon: '📖',  color: '#7F77DD' },
  'hermanos':        { label: 'Administrador',   icon: '👥',  color: '#1D9E75' },
  'conferencias':    { label: 'Conferencias',    icon: '🎤',  color: '#D85A30' },
  'predicacion':     { label: 'Predicación',     icon: '📣',  color: '#97C459' },
};
const ACT_ACCIONES = {
  apertura: 'Abrió', guardado: 'Guardó', edicion: 'Editó',
  auto_asignar: 'Auto-asignó', generacion: 'Generó',
};

function actEsc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function actCambiosHtml(cambios) {
  if (!Array.isArray(cambios) || !cambios.length) return '';
  const filas = cambios.map(c => `
    <div class="act-cambio">
      <span class="act-cambio-slot">${actEsc(c.label || c.slot)}</span>
      <span class="act-cambio-de">${actEsc(c.deNombre || '—')}</span>
      <span class="act-cambio-flecha">→</span>
      <span class="act-cambio-a">${actEsc(c.aNombre || '—')}</span>
    </div>`).join('');
  return `<div class="act-cambios">${filas}</div>`;
}

async function openActividad(congreId, congreNombre) {
  showView('view-actividad');
  document.getElementById('act-title').textContent = congreNombre || congreId;
  document.getElementById('act-sub').textContent   = 'Últimas 100 acciones registradas';
  document.getElementById('act-stats').innerHTML   = '';
  document.getElementById('act-loading').style.display = 'flex';
  document.getElementById('act-list').style.display    = 'none';
  await loadActividad(congreId);
}

async function loadActividad(congreId) {
  const loading = document.getElementById('act-loading');
  const list    = document.getElementById('act-list');
  try {
    const snap = await getDocs(
      query(
        collection(db, 'congregaciones', congreId, 'actividad'),
        orderBy('timestamp', 'desc'),
        limit(100)
      )
    );
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Stats: personas únicas por deviceId (o uid si está)
    const uniqueIds  = new Set(entries.map(e => e.deviceId || e.uid).filter(Boolean));
    const guardados  = entries.filter(e => e.accion === 'guardado').length;
    document.getElementById('act-stats').innerHTML = `
      <div class="act-stat"><div class="act-stat-n">${entries.length}</div><div class="act-stat-l">acciones</div></div>
      <div class="act-stat"><div class="act-stat-n">${uniqueIds.size}</div><div class="act-stat-l">personas</div></div>
      <div class="act-stat"><div class="act-stat-n">${guardados}</div><div class="act-stat-l">guardados</div></div>
    `;

    if (!entries.length) {
      list.innerHTML = '<p style="color:var(--text-muted, #666);font-size:14px;text-align:center;padding:24px 0;">Sin actividad registrada todavía.</p>';
      loading.style.display = 'none';
      list.style.display = '';
      return;
    }

    let html = '';
    let lastDayKey = '';
    entries.forEach(e => {
      const ts     = e.timestamp?.seconds ? new Date(e.timestamp.seconds * 1000) : null;
      const dayKey = ts ? ts.toDateString() : '?';
      if (dayKey !== lastDayKey) {
        const dayLabel = ts
          ? ts.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
          : 'Sin fecha';
        html += `<div class="act-day-hdr">${dayLabel}</div>`;
        lastDayKey = dayKey;
      }
      const mod     = ACT_MODULOS[e.modulo] || { label: e.modulo, icon: '📱', color: '#666' };
      const accion  = ACT_ACCIONES[e.accion] || e.accion;
      const hora    = ts ? ts.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—';
      const nombre  = e.nombre || (e.anonimo ? 'Invitado' : '—');
      const anonBadge  = e.anonimo ? ' <span style="font-size:10px;color:var(--k-tx-555555, #555);">(invitado)</span>' : '';
      const detalleHtml = e.detalle
        ? `<div class="act-detalle">${e.detalle}</div>${actCambiosHtml(e.cambios)}`
        : actCambiosHtml(e.cambios);
      html += `
        <div class="act-entry">
          <div class="act-icon" style="background:${mod.color}22;">${mod.icon}</div>
          <div class="act-main">
            <div class="act-nombre">${nombre}${anonBadge}</div>
            <div class="act-meta">${accion} · ${mod.label}</div>
            ${detalleHtml}
          </div>
          <div class="act-time">${hora}</div>
        </div>`;
    });

    list.innerHTML = html;
    loading.style.display = 'none';
    list.style.display    = '';
  } catch(err) {
    loading.innerHTML = `<span style="color:var(--k-tx-f09595, #F09595);font-size:14px;">Error: ${err.message}</span>`;
  }
}

window.openActividad = openActividad;
