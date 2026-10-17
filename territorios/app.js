import { db } from '../shared/firebase.js';
import '../shared/auth.js';
import { logActividad } from '../shared/actividad.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, Timestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

await window.authGuard('acceso_territorios');


// ── congreId viene de sessionStorage (seteado en index.html al elegir congregación) ──
if (!sessionStorage.getItem('congreId')) { window.location.href = '../index.html'; }
const CONGRE_ID     = sessionStorage.getItem('congreId')     || 'sur';
const CONGRE_NOMBRE = sessionStorage.getItem('congreNombre') || CONGRE_ID;

logActividad(CONGRE_ID, 'territorios', 'apertura');

const congreSubEl = document.getElementById('congre-sub');
if (congreSubEl) congreSubEl.textContent = CONGRE_NOMBRE;

function congreRef()  { return doc(db, 'congregaciones', CONGRE_ID); }
function terrCol()    { return collection(db, 'congregaciones', CONGRE_ID, 'territorios'); }
function histCol(id)  { return collection(db, 'congregaciones', CONGRE_ID, 'territorios', String(id), 'historial'); }
function salidaCol()  { return collection(db, 'congregaciones', CONGRE_ID, 'salidas'); }
function pubCol()     { return collection(db, 'congregaciones', CONGRE_ID, 'publicadores'); }
function gruposCol()  { return collection(db, 'congregaciones', CONGRE_ID, 'grupos'); }

// ─────────────────────────────────────────
//  CONDUCTORES
// ─────────────────────────────────────────
const CONDUCTORES_BY_GROUP = {};

let _conductoresListos = false;
let _conductoresResolvers = [];

function conductoresListos() {
  if (_conductoresListos) return Promise.resolve();
  return new Promise(res => _conductoresResolvers.push(res));
}

async function cargarConfigCongre() {
  try {
    const snap = await getDoc(congreRef());
    if (snap.exists()) {
      const d = snap.data();
      ciudadesExtras  = d.ciudadesExtras  || [];
      ciudadPrincipal = d.ciudadPrincipal || '';
    }
  } catch(e) {
    console.warn('No se pudo cargar config congregación:', e);
  }
}

async function cargarConductores() {
  try {
    const snap = await getDocs(pubCol());
    // Inicializar con todos los grupos cargados
    GRUPOS.forEach(g => { CONDUCTORES_BY_GROUP[g.id] = []; });
    if (!CONDUCTORES_BY_GROUP['C']) CONDUCTORES_BY_GROUP['C'] = [];
    // Mapear roles a grupo: CONDUCTOR_GRUPO_1 → '1', CONDUCTOR_CONGREGACION → 'C'
    const MAP = {};
    GRUPOS.forEach(g => {
      if (g.id === 'C') {
        MAP['CONDUCTOR_CONGREGACION'] = 'C';
      } else {
        MAP[`CONDUCTOR_GRUPO_${g.id}`] = g.id;
      }
    });
    snap.forEach(d => {
      const h = d.data();
      (h.roles || []).forEach(rol => {
        const grupo = MAP[rol.trim().toUpperCase()];
        if (grupo !== undefined) {
          if (!CONDUCTORES_BY_GROUP[grupo].includes(h.nombre)) {
            CONDUCTORES_BY_GROUP[grupo].push(h.nombre);
          }
        }
      });
    });
  } catch(e) {
    console.warn('No se pudo cargar conductores:', e);
  } finally {
    _conductoresListos = true;
    _conductoresResolvers.forEach(r => r());
    _conductoresResolvers = [];
  }
}

// ─────────────────────────────────────────
//  HELPERS FECHA
// ─────────────────────────────────────────
function fmtDateLocal(val) {
  if (!val) return '—';
  let d;
  if (val && typeof val.toDate === 'function') {
    d = val.toDate();
  } else if (val instanceof Date) {
    d = val;
  } else if (typeof val === 'string') {
    const [y, m, day] = val.split('-').map(Number);
    d = new Date(y, m - 1, day);
  } else {
    return '—';
  }
  const dd   = String(d.getDate()).padStart(2, '0');
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const SPECIAL_TERR = { '11': true, '131': true };
const DIAS_SEMANA = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_ES    = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

let selectedGrupo = null;
let selected      = [];
let territoriosData = {};
let allTerritoriosData = {};
let ciudadesExtras  = [];   // [{ nombre, offset }]
let ciudadPrincipal = '';   // nombre de la ciudad principal
let configData    = {};
let modalTerr     = null;
let editingRow    = null;   // doc ID en Firestore
let historialRows = [];
let salidas       = [];
let salidaCounter = 0;
let semanaOffset  = 0;
let chatScope     = 'grupo';

// ─────────────────────────────────────────
//   COLORES (dinámico — se construye en cargarGrupos)
// ─────────────────────────────────────────
let GRUPOS       = [];   // [{ id, label, color }] — cargado desde Firestore
let GCOLORS      = {};
let GBGS         = {};
let GROUP_COLORS = {};
let GROUP_BG     = {};

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}


// ─────────────────────────────────────────
//   UTILIDADES DOM
// ─────────────────────────────────────────
function show(id) {
  document.getElementById(id).style.display = '';
  if (!id.startsWith('view-')) return;
  window.scrollTo(0, 0);   // cada pantalla arranca arriba (si no, quedaba a la altura de la anterior)
  // Botón fijo de abajo: Planificar lo tiene siempre; Registrar lo pone cuando terminó de cargar
  if (id === 'view-config') setPie('Revisar y guardar →', generatePreview);
  else setPie(null);
  const homeBtn = document.getElementById('btn-home');
  const mapaBtn = document.getElementById('btn-mapa-float');
  if (homeBtn) {
    const showHome = ['view-config','view-preview','view-registrar','view-info','view-historial'].includes(id);
    if (showHome) homeBtn.classList.add('visible');
    homeBtn.classList.remove('hidden-in-plan');
  }
  if (mapaBtn) {
    if (id === 'view-info') {
      mapaBtn.classList.add('visible');
      mapaBtn.onclick = () => openMapaPopup('info');
    } else if (id === 'view-registrar') {
      mapaBtn.classList.add('visible');
      mapaBtn.onclick = () => openMapaPopup('registrar');
    } else if (id === 'view-config') {
      mapaBtn.classList.add('visible');
      mapaBtn.onclick = () => openMapaPopup('info');
    } else {
      mapaBtn.classList.remove('visible');
    }
  }
}
function hide(id) { document.getElementById(id).style.display = 'none'; }

function formatShort(ds) {
  if (!ds) return '—';
  const d = new Date(ds + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function formatShortFull(ds) {
  if (!ds) return '—';
  const d = new Date(ds + 'T00:00:00');
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}
function daysSince(ds) {
  if (!ds) return 9999;
  return Math.floor((new Date() - new Date(ds + 'T00:00:00')) / 86400000);
}
function dayClass(d) { return d > 90 ? 'days-old' : d > 45 ? 'days-mid' : 'days-new'; }

function getWeekDates(offset = 0) {
  const now = new Date(); const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  monday.setHours(0,0,0,0);
  function d(o) {
    const x = new Date(monday);
    x.setDate(monday.getDate() + o);
    // devolver yyyy-mm-dd local (sin bug UTC)
    const yyyy = x.getFullYear();
    const mm   = String(x.getMonth() + 1).padStart(2, '0');
    const dd   = String(x.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return { mon:d(0), tue:d(1), wed:d(2), thu:d(3), fri:d(4), sat:d(5), sun:d(6) };
}


function fmtDate(ds) {
  if (!ds) return '';
  const m = ds.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(-2)}`;
  return ds;
}

function fmtHistDate(val) {
  if (!val) return '—';
  if (typeof val === 'string' && val.includes('T')) {
    const d = new Date(val);
    return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
  }
  return String(val);
}

function getDiaFromFecha(fecha) {
  if (!fecha) return '';
  const m = fecha.toString().match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    const d = new Date(`${y}-${m[2]}-${m[1]}T00:00:00`);
    return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  }
  return '';
}

// ─────────────────────────────────────────
//   FETCH DATOS DESDE FIRESTORE
// ─────────────────────────────────────────

/**
 * Último historial de un territorio, leído de la subcolección: { ini, fin, conductor } | null.
 */
async function ultimoHistDe(id) {
  const snap = await getDocs(query(histCol(id), orderBy('fechaInicio', 'desc'), limit(1)));
  if (snap.empty) return null;
  const h = snap.docs[0].data();
  return { ini: h.fechaInicio || null, fin: h.fechaFin || null, conductor: h.conductor || null };
}

/**
 * Recalcula el último historial y lo guarda en territorios/{id}.ultimoHist.
 * Llamar después de CUALQUIER escritura o borrado en historial/ (fetchGrupo y mapa.html
 * lo leen de acá en vez de consultar el historial de cada territorio).
 * Si la escritura falla, igual devuelve el valor calculado.
 */
async function sincronizarUltimoHist(id) {
  invalidarGrupos();
  const ult = await ultimoHistDe(id);
  try { await updateDoc(doc(terrCol(), String(id)), { ultimoHist: ult }); } catch (e) { console.warn('ultimoHist no guardado', id, e); }
  return ult;
}

/**
 * Carga todos los territorios de un grupo y su último historial.
 * Retorna objeto: { [terrId]: { lastFin, lastIni, enProgreso, tipo } }
 */
// Caché corta por grupo: entrar a Planificar, Registrar o Ver mi grupo leía de nuevo todos los
// territorios del grupo (docs pesados: traen los polígonos) y fetchConfig repetía la misma consulta.
// Se invalida con cada escritura de este módulo (historial, notas, estado) y vence al minuto por
// si otro encargado cambió algo. Cada llamada devuelve copias: nadie le cambia los datos a la caché.
const _grupoCache = new Map();   // grupo → { t, promesa: { result, cfg } }
function invalidarGrupos() { _grupoCache.clear(); }

function lecturaGrupo(grupo) {
  const k = String(grupo);
  const c = _grupoCache.get(k);
  if (c && Date.now() - c.t < 60000) return c.promesa;
  const promesa = leerGrupo(k);
  _grupoCache.set(k, { t: Date.now(), promesa });
  promesa.catch(() => _grupoCache.delete(k));
  return promesa;
}

async function fetchGrupo(grupo) {
  const { result } = await lecturaGrupo(grupo);
  return Object.fromEntries(Object.entries(result).map(([id, t]) => [id, { ...t }]));
}

async function leerGrupo(grupoStr) {
  const q = query(terrCol(), where('grupoId', '==', grupoStr));
  const snap = await getDocs(q);

  const result = {};
  const cfg = {};
  await Promise.all(snap.docs.map(async terrDoc => {
    const terr = terrDoc.data();
    const id   = String(terr.id);

    // El último historial vive en el doc del territorio (ultimoHist). Si falta
    // (territorio anterior al campo), se consulta y se guarda para la próxima.
    const ult = terr.ultimoHist !== undefined ? terr.ultimoHist : await sincronizarUltimoHist(id);

    let lastFin = null, lastIni = null, enProgreso = false, lastConductor = null;
    if (ult) {
      lastIni       = ult.ini       || null;
      lastFin       = ult.fin       || null;
      enProgreso    = !ult.fin;
      lastConductor = ult.conductor || null;
    }

    result[id] = { lastFin, lastIni, enProgreso, lastConductor, tipo: terr.tipo || 'normal', ciudad: terr.ciudad || null, nombre: terr.nombre || null, notas: terr.notas || null };
    if (terr.tipo && terr.tipo !== 'normal') cfg[id] = terr.tipo;
  }));

  return { result, cfg };
}

/**
 * Carga config de territorios especiales del grupo (no_predica, peligroso).
 * Retorna objeto: { [terrId]: 'no_predica' | 'peligroso' | 'normal' }
 */
async function fetchConfig(grupo) {
  const { cfg } = await lecturaGrupo(grupo);   // misma lectura que fetchGrupo
  return { ...cfg };
}

// ─────────────────────────────────────────
//   COVER / NAVEGACIÓN
// ─────────────────────────────────────────

const WEEK = getWeekDates();


function selectGrupo(el, n, autoEnter = true) {
  document.querySelectorAll('.grupo-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  selectedGrupo = n;
  document.getElementById('btn-start').classList.add('enabled');
  if (autoEnter && selectedGrupo) entrarGrupoSeleccionado();
}

function goToCover() {
  selected = [];
  hide('view-config'); hide('view-preview');
  hide('view-modo');   hide('view-registrar'); hide('view-info');
  hide('view-informe');
  hideChatFab();
  show('view-cover');
}

function goToModo() {
  selected = [];
  document.getElementById('btn-home').classList.remove('visible');
  document.getElementById('btn-mapa-float')?.classList.remove('visible');
  hide('view-cover'); hide('view-config'); hide('view-preview');
  hide('view-registrar'); hide('view-info'); hide('view-historial');
  hide('view-informe');
  showChatFab();

  const grupoObj = GRUPOS.find(g => String(g.id) === String(selectedGrupo));
  const grupoLabel = grupoObj ? grupoObj.label : selectedGrupo;
  const grupoColor = GROUP_COLORS[selectedGrupo] || '#97C459';

  // el título ya dice "Grupo ": si la etiqueta viene como "Grupo 3" quedaba "Grupo Grupo 3"
  document.getElementById('modo-grupo-label').textContent = String(grupoLabel).replace(/^Grupo\s+/i, '');
  document.querySelector('.modo-wrap').style.setProperty('--grupo-color', grupoColor);

  const supEl = document.getElementById('modo-sup-label');
  if (supEl) supEl.style.color = grupoColor;

  const w = getWeekDates(0);
  const planWeekEl = document.getElementById('plan-hero-week');
  if (planWeekEl) planWeekEl.textContent = `Semana del ${formatShort(w.mon)} al ${formatShort(w.sun)}`;

  // Resetear badge mientras carga
  const statusEl = document.getElementById('plan-hero-status');
  if (statusEl) { statusEl.textContent = 'Sin planificar'; statusEl.className = 'plan-status-dot sin-plan'; }

  show('view-modo');

  actualizarBadgePlanificada(w);
}

async function actualizarBadgePlanificada(w) {
  const statusEl = document.getElementById('plan-hero-status');
  if (!statusEl) return;
  try {
    const q = query(
      salidaCol(),
      where('grupoId', '==', String(selectedGrupo)),
      where('fechaReg', '>=', w.mon),
      where('fechaReg', '<=', w.sun)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      statusEl.textContent = 'Planificada';
      statusEl.className = 'plan-status-dot planificada';
    }
  } catch(e) {
    // badge queda en "Sin planificar"
  }
}

function goToMapa() {
  sessionStorage.setItem('selectedGrupo', selectedGrupo);
  window.location.href = '/territorios/mapa.html';
}

async function cerrarSesion() {
  const ok = await uiConfirm({
    title: '¿Cerrar sesión?',
    msg: 'Vas a volver a la pantalla de grupos.',
    confirmText: 'Cerrar sesión',
    cancelText: 'Cancelar',
    type: 'purple'
  });
  if (!ok) return;
  selectedGrupo = null;
  _conductoresListos = false;
  _conductoresResolvers = [];
  document.querySelectorAll('.grupo-btn').forEach(b => {
    b.classList.remove('selected');
    b.style.background = '';
  });
  document.getElementById('btn-start').classList.remove('enabled');
  document.getElementById('btn-home').classList.remove('visible');
  document.getElementById('btn-mapa-float')?.classList.remove('visible');
  goToCover();
}

// ─────────────────────────────────────────
//   GRUPOS
// ─────────────────────────────────────────
async function cargarGrupos() {
  try {
    const snap = await getDocs(gruposCol());
    GRUPOS = [];
    snap.forEach(d => {
      const data = d.data();
      const { id, label, color } = data;
      if (id) GRUPOS.push({ id: String(id), label: label || (id === 'C' ? 'Congregación' : `Grupo ${id}`), color: color || '#888' });
    });
    if (GRUPOS.length === 0) {
      await uiAlert('No se encontraron grupos configurados en la base de datos.', 'Error de configuración');
      return;
    }
    // Ordenar: numéricos primero (por número), luego C
    GRUPOS.sort((a, b) => {
      const aNum = parseInt(a.id), bNum = parseInt(b.id);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (!isNaN(aNum)) return -1;
      if (!isNaN(bNum)) return 1;
      return 0;
    });
    // Construir mapas de color
    GRUPOS.forEach(g => {
      GCOLORS[g.id]      = g.color;
      GBGS[g.id]         = hexToRgba(g.color, 0.18);
      GROUP_COLORS[g.id] = g.color;
      GROUP_BG[g.id]     = hexToRgba(g.color, 0.15);
    });
    const teniaGrupoGuardado = !!sessionStorage.getItem('selectedGrupo');
    renderGrupoButtons();
    if (!teniaGrupoGuardado) await resolverGrupoPropio();
  } catch(e) {
    window.zivBootListo();
    await uiAlert('Error al cargar la configuración de grupos: ' + e.message, 'Error');
  } finally {
    // La portada aparece con los botones de grupo ya armados (antes se veía vacía y se completaba)
    window.zivBootListo();
  }
}

function renderGrupoButtons() {
  const wrap = document.getElementById('grupos-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  const numericos = GRUPOS.filter(g => !isNaN(parseInt(g.id)));
  const congre    = GRUPOS.filter(g => isNaN(parseInt(g.id)));

  // Numéricos: 3 por fila
  for (let i = 0; i < numericos.length; i += 3) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;';
    [numericos[i], numericos[i+1], numericos[i+2]].forEach(g => {
      if (!g) return;
      const btn = document.createElement('button');
      btn.className = 'grupo-btn';
      btn.dataset.grupo = g.id;
      btn.style.flex = '0 1 calc(33.33% - 7px)';
      btn.innerHTML = `<div class="gbcard-badge">${g.id}</div><div class="gbcard-check">✓</div>`;
      btn.onclick = () => selectGrupo(btn, g.id, true);
      _applyGrupoColorToBtn(btn, g.id);
      row.appendChild(btn);
    });
    wrap.appendChild(row);
  }

  // Congregación: ancho completo, horizontal
  congre.forEach(g => {
    const btn = document.createElement('button');
    btn.className = 'grupo-btn grupo-btn-congre';
    btn.dataset.grupo = g.id;
    btn.innerHTML = `<div class="gbcard-badge gbcard-badge-sm">${g.id}</div><span class="gbcard-label">${esc(g.label)}</span>`;
    btn.onclick = () => selectGrupo(btn, g.id, true);
    _applyGrupoColorToBtn(btn, g.id);
    wrap.appendChild(btn);
  });

  // Restaurar selección guardada en sessionStorage
  const grupoGuardado = sessionStorage.getItem('selectedGrupo');
  if (grupoGuardado) {
    sessionStorage.removeItem('selectedGrupo');
    const btn = wrap.querySelector(`[data-grupo="${grupoGuardado}"]`);
    if (btn) {
      selectGrupo(btn, grupoGuardado, false);
      goToModo();
      cargarConductores();
      cargarConfigCongre();
    }
  }
}

function _applyGrupoColorToBtn(btn, id) {
  const c = GCOLORS[id] || '#888';
  btn.style.setProperty('--gc',             c);
  btn.style.setProperty('--gc-bg',          hexToRgba(c, 0.08));
  btn.style.setProperty('--gc-bg-sel',      hexToRgba(c, 0.16));
  btn.style.setProperty('--gc-badge',       hexToRgba(c, 0.2));
  btn.style.setProperty('--grupo-hover-bg', hexToRgba(c, 0.13));
  btn.style.setProperty('--gc-on', colorSobre(c));   // número sobre la insignia sólida
}

cargarGrupos();

function puedeElegirGrupo(grupoId) {
  const u = window.currentUser;
  if (!u) return false;
  const roles = u.appRoles || (u.appRol ? [u.appRol] : []);
  return roles.some(r => ['admin_general', 'admin_congre', 'encargado_grupo'].includes(r));
}

function entrarGrupoSeleccionado() {
  if (!puedeElegirGrupo(selectedGrupo)) return;
  goToModo();
  cargarConductores();
  cargarConfigCongre();
}

async function resolverGrupoPropio() {
  const u = window.currentUser;
  const roles = u?.appRoles || (u?.appRol ? [u.appRol] : []);
  if (roles.some(r => ['admin_general', 'admin_congre', 'encargado_grupo'].includes(r))) {
    return; // se queda en view-cover con el selector completo de grupos
  }
  if (u?.matchedPublisherId) {
    try {
      const pubSnap = await getDoc(doc(db, 'congregaciones', CONGRE_ID, 'publicadores', u.matchedPublisherId));
      const grupoId = pubSnap.exists() ? pubSnap.data().grupoId : null;
      if (grupoId && GRUPOS.some(g => String(g.id) === String(grupoId))) {
        const btn = document.querySelector(`.grupo-btn[data-grupo="${grupoId}"]`);
        if (btn) selectGrupo(btn, String(grupoId), false);
        else selectedGrupo = String(grupoId);
        goToModo();
        cargarConductores();
        cargarConfigCongre();
        return;
      }
    } catch (e) {
      console.warn('No se pudo resolver el grupo propio:', e);
    }
  }
  mostrarAvisoSinGrupo();
}

function mostrarAvisoSinGrupo() {
  const subEl = document.getElementById('congre-sub-sg');
  if (subEl) subEl.textContent = CONGRE_NOMBRE;
  hide('view-cover');
  show('view-sin-grupo');
}

// ─────────────────────────────────────────
//   PLANIFICADOR
// ─────────────────────────────────────────
// Cada salida vive en `salidas` (no en el DOM): { id, tipo, fecha, hora, conductor, encuentro, encAuto, terrs[] }.
// La lista se vuelve a pintar entera desde ahí (son 4–7 renglones); solo el campo Encuentro se actualiza
// sin repintar, para no perder el foco mientras se escribe.
const DIAS_CORTO = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES_C    = ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'];
let salidaAbierta = null;   // id de la salida que está abierta para editar

function getPlantilla(grupo) {
  const week = getWeekDates(semanaOffset);
  if (grupo === 'C') {
    return [
      { tipo:'campo', fecha: week.mon, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.tue, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.wed, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.thu, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.fri, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.sat, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
      { tipo:'campo', fecha: week.sun, hora:'09:30', conductor:'', encuentro:'', territorio:'' },
    ];
  }
  return [
    { tipo:'tel',   fecha: week.tue, hora:'17:30', conductor:'', encuentro:'', territorio:'' },
    { tipo:'campo', fecha: week.tue, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
    { tipo:'campo', fecha: week.thu, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
    { tipo:'campo', fecha: week.fri, hora:'18:30', conductor:'', encuentro:'', territorio:'' },
  ];
}

function nombreGrupo() {
  const g = GRUPOS.find(x => String(x.id) === String(selectedGrupo));
  return g ? g.label : (selectedGrupo === 'C' ? 'Congregación' : 'Grupo ' + selectedGrupo);
}

// Texto sobre el color del grupo: oscuro si el color es claro, blanco si es oscuro (igual que la insignia de los botones de grupo)
function colorSobre(c) {
  const n = parseInt(String(c).replace('#', ''), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.62 ? '#1d1e22' : '#ffffff';
}

// Color del grupo en las pantallas de Planificar / Revisar / Registrar / Historial y en el botón fijo de abajo
function colorGrupoEnPantallas() {
  const c = GROUP_COLORS[selectedGrupo] || '#97C459';
  document.querySelectorAll('.tf, #tf-pie').forEach(el => {
    el.style.setProperty('--gc', c);
    el.style.setProperty('--gc-on', colorSobre(c));
    el.style.setProperty('--grupo-color', c);
  });
}

// Botón fijo de abajo: texto + acción, o null para ocultarlo
function setPie(texto, fn) {
  const pie = document.getElementById('tf-pie');
  const btn = document.getElementById('tf-pie-btn');
  if (!pie || !btn) return;
  if (!texto) { pie.style.display = 'none'; document.body.classList.remove('tf-con-pie'); return; }
  btn.textContent = texto;
  btn.disabled = false;
  btn.onclick = fn;
  pie.style.display = '';
  document.body.classList.add('tf-con-pie');
}

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fechaCorta(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T12:00:00');
  return `${DIAS_CORTO[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
}

function bloqueFecha(iso, chica = false) {
  if (!iso) return `<span class="tf-fecha${chica ? ' chica' : ''}"><span class="d">—</span><span class="n">·</span></span>`;
  const d = new Date(iso + 'T12:00:00');
  return `<span class="tf-fecha${chica ? ' chica' : ''}"><span class="d">${DIAS_CORTO[d.getDay()]}</span><span class="n">${d.getDate()}</span></span>`;
}

// «Semana del 13 al 19 de oct.» (o «del 27 de sep. al 3 de oct.») para cualquier día de esa semana
function tituloSemana(iso) {
  const lun = masDias(iso, -((new Date(iso + 'T12:00:00').getDay() + 6) % 7));
  const a = new Date(lun + 'T12:00:00'), b = new Date(masDias(lun, 6) + 'T12:00:00');
  return a.getMonth() === b.getMonth()
    ? `Semana del ${a.getDate()} al ${b.getDate()} de ${MESES_C[b.getMonth()]}`
    : `Semana del ${a.getDate()} de ${MESES_C[a.getMonth()]} al ${b.getDate()} de ${MESES_C[b.getMonth()]}`;
}

// «Territorio 22» / «Territorios 22 y 24» / «Territorios 20, 22 y 24»
function nombreTerrs(t) {
  if (!t.length) return '';
  if (t.length === 1) return 'Territorio ' + t[0];
  return 'Territorios ' + t.slice(0, -1).join(', ') + ' y ' + t[t.length - 1];
}

// Días sin trabajar de un territorio (también de otros grupos, para Congregación)
function datosTerr(n) {
  if (territoriosData[n]) return territoriosData[n];
  for (const g of Object.values(allTerritoriosData)) if (g && g[n]) return g[n];
  return null;
}
function diasSinTrabajar(n) {
  const d = datosTerr(n);
  return d ? daysSince(d.lastFin || d.lastIni) : 9999;
}

async function goToStep1() {
  cargarEncuentrosPrevios();   // en segundo plano: cuando elijan territorio ya está listo
  hide('view-cover'); hide('view-preview');
  hide('view-modo');  hide('view-registrar'); hide('view-info');
  show('view-config');
  colorGrupoEnPantallas();
  document.getElementById('plan-grupo-label').textContent = nombreGrupo();
  semanaOffset = 0;
  updateWeekInfo();
  hide('terr-error');

  // Cargador dentro de la pantalla (como Registrar / Ver mi grupo), no overlay de pantalla completa
  document.getElementById('salidas-container').innerHTML = '';
  document.getElementById('tel-fija').innerHTML = '';
  document.getElementById('plan-listas').textContent = '';
  hide('plan-agregar');
  show('terr-loading');

  try {
    territoriosData = {};
    allTerritoriosData = {};
    const fetchPromises = [fetchGrupo(selectedGrupo), conductoresListos()];
    const extraGrupos = selectedGrupo === 'C' ? [1, 2, 3, 4] : [];
    const extraPromises = extraGrupos.map(g => fetchGrupo(g));

    const [raw] = await Promise.all([
      ...fetchPromises,
      ...extraPromises.map((p, i) =>
        p.then(data => { allTerritoriosData[extraGrupos[i]] = data; })
      )
    ]);

    territoriosData = raw;
    configData = await fetchConfig(selectedGrupo);

    hide('terr-loading');
    show('plan-agregar');
    renderSalidas();
  } catch(err) {
    hide('terr-loading');
    const errEl = document.getElementById('terr-error');
    errEl.innerHTML = `<div class="error-wrap">Error al cargar: ${esc(err.message)}. <button class="btn-secondary" style="font-size:12px;padding:4px 10px;margin-left:8px;" onclick="goToStep1()">Reintentar</button></div>`;
    show('terr-error');
  }
}

function updateWeekInfo() {
  const w = getWeekDates(semanaOffset);
  document.getElementById('week-info').textContent = tituloSemana(w.mon);
  const prevBtn = document.getElementById('btn-semana-prev');
  if (prevBtn) prevBtn.disabled = semanaOffset <= 0;   // no se planifica para atrás
}

function cambiarSemana(dir) {
  if (dir < 0 && semanaOffset <= 0) return;
  semanaOffset += dir;
  updateWeekInfo();
  renderSalidas();
}

function renderSalidas() {
  colorGrupoEnPantallas();
  pintarTelFija();
  salidas = [];
  salidaCounter = 0;
  salidaAbierta = null;
  getPlantilla(selectedGrupo).forEach(p => nuevaSalida(p.tipo, p));
  pintarSalidas();
}

// Congregación: telefónica fija de lunes a sábado (sale en la imagen; no se guarda como salida)
function pintarTelFija() {
  const c = document.getElementById('tel-fija');
  if (selectedGrupo !== 'C') { c.innerHTML = ''; return; }
  c.innerHTML = `
    <div class="tf-sal tf-sal-fija">
      <div class="tf-fija-in">
        <div class="tf-sal-t"><span class="tf-tel">📞 Telefónica fija</span> · Lunes a Sábado</div>
        <div class="tf-sal-s">ID 844 0225 6636 · Clave 479104</div>
        <div class="tf-dos tf-campo">
          <div><label>Hora mañana</label><input type="time" id="tel-fija-manana" value="10:00"></div>
          <div><label>Hora tarde</label><input type="time" id="tel-fija-tarde" value="17:00"></div>
        </div>
      </div>
    </div>`;
  if (window.upgradeInputs) upgradeInputs(c);
}

// fechaReg se guarda como DD/MM/AAAA (fmtDateLocal de este módulo): pasarla a AAAA-MM-DD para ordenar
function claveFechaReg(f) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || ''));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(f || '');
}

function masDias(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── Copiar semana anterior ──
// Toma las salidas que se registraron para la semana anterior a la que se está viendo (el registro más
// reciente que tenga salidas en esas fechas) y las arma acá con la fecha +7 días. Todo queda editable.
async function copiarSemanaAnterior() {
  const prev = getWeekDates(semanaOffset - 1);
  const btn  = document.getElementById('btn-copiar-semana');
  if (salidas.some(s => s.conductor || s.terrs.length)) {
    const ok = await uiConfirm({
      title: 'Copiar semana anterior',
      msg: 'Se reemplazan las salidas que ya cargaste en esta semana.',
      confirmText: 'Copiar', type: 'warn',
    });
    if (!ok) return;
  }
  if (btn) btn.disabled = true;
  try {
    const snap = await getDocs(query(salidaCol(), where('grupoId', '==', String(selectedGrupo))));
    const enPrev = s => s.fecha && s.fecha >= prev.mon && s.fecha <= prev.sun;
    const doc_ = snap.docs.map(d => d.data())
      .filter(d => (d.salidas || []).some(enPrev))
      .sort((a, b) => claveFechaReg(b.fechaReg).localeCompare(claveFechaReg(a.fechaReg)))[0];
    const lista = (doc_?.salidas || []).filter(enPrev);
    if (!lista.length) {
      uiToast(`No hay salidas registradas del ${formatShort(prev.mon)} al ${formatShort(prev.sun)}`, 'error');
      return;
    }
    const limpio = v => (v && v !== '—' ? String(v) : '');
    salidas = [];
    salidaAbierta = null;
    lista.forEach(s => {
      const tipo = s.tipo === 'tel' ? 'tel' : 'campo';
      // El conductor se copia aunque ya no esté en la lista del grupo
      nuevaSalida(tipo, {
        fecha: masDias(s.fecha, 7),
        hora: (s.hora || '').replace('.', ':'),
        conductor: limpio(s.cond),
        encuentro: limpio(s.enc),
        terrs: tipo === 'campo' ? terrsGuardados(s) : [],
      });
    });
    pintarSalidas();
    uiToast(`Se copiaron ${lista.length} salida${lista.length === 1 ? '' : 's'}: revisá y cambiá lo que haga falta`, 'success');
  } catch (err) {
    uiToast('No se pudo copiar: ' + err.message, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

const salidaPorId = id => salidas.find(s => s.id === Number(id));
const salidaLista = s => !!s.conductor && (s.tipo === 'tel' || s.terrs.length > 0);

function nuevaSalida(tipo, data = {}) {
  const week = getWeekDates(semanaOffset);
  const s = {
    id: ++salidaCounter, tipo,
    fecha: data.fecha || week.tue,
    hora:  data.hora  || (tipo === 'tel' ? '17:30' : '18:30'),
    conductor: data.conductor || '',
    encuentro: data.encuentro || '',
    encAuto: false,
    terrs: [...new Set((data.terrs || (data.territorio ? [data.territorio] : [])).map(String))],
  };
  salidas.push(s);
  return s;
}

function addSalida(tipo) {
  if (salidas.length >= 20) return;
  const s = nuevaSalida(tipo);
  salidaAbierta = s.id;
  pintarSalidas();
  document.getElementById('salida-card-' + s.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function removeSalida(id) {
  salidas = salidas.filter(s => s.id !== Number(id));
  if (salidaAbierta === Number(id)) salidaAbierta = null;
  pintarSalidas();
}

// Toca un renglón: se abre para editar y se cierra el que estaba abierto
function abrirSalida(id) {
  salidaAbierta = salidaAbierta === Number(id) ? null : Number(id);
  pintarSalidas();
}

function subSalida(s) {
  return [s.conductor ? esc(s.conductor) : '<span class="tf-falta">falta conductor</span>', s.encuentro && esc(s.encuentro)]
    .filter(Boolean).join(' · ');
}

function htmlSalida(s) {
  const esTel = s.tipo === 'tel';
  const lista = salidaLista(s);
  const titulo = esTel
    ? `${esc(s.hora)} · <span class="tf-tel">Telefónica</span>`
    : `${esc(s.hora)} · ${s.terrs.length ? esc(nombreTerrs(s.terrs)) : '<span class="tf-falta">sin territorio</span>'}`;
  const terrs = esTel ? '' : `
      <div class="tf-campo"><label>${s.terrs.length > 1 ? 'Territorios' : 'Territorio'}</label>
        <div class="tf-terrs">
          ${s.terrs.map((t, k) => {
            const d = diasSinTrabajar(t);
            return `<div class="tf-terr">🗺 Territorio ${esc(t)}
              <span class="tf-dias ${daysClass(d)}">${d >= 9999 ? 'sin registro' : d + (d === 1 ? ' día' : ' días')}</span>
              <button type="button" class="tf-x" aria-label="Quitar territorio ${esc(t)}" onclick="quitarTerrSalida(${s.id}, ${k})">✕</button></div>`;
          }).join('')}
          <div class="tf-con-icono">
            <button type="button" class="tf-entrada tf-mas" onclick="openTerritorioPicker(${s.id})">+ ${s.terrs.length ? 'Otro territorio' : 'Elegir territorio'}</button>
            <button type="button" class="tf-icono" onclick="openMapaPicker(${s.id})" aria-label="Elegir en el mapa" title="Elegir en el mapa">📍</button>
          </div>
        </div>
      </div>`;
  const enc = esTel
    ? `<input type="text" class="tf-entrada" id="sal-enc-${s.id}" value="${esc(s.encuentro)}" placeholder="Familia o ID de la reunión" oninput="setEncuentroSalida(${s.id}, this.value)">`
    : `<div class="tf-con-icono">
         <input type="text" class="tf-entrada" id="sal-enc-${s.id}" value="${esc(s.encuentro)}" placeholder="Familia o esquina" oninput="setEncuentroSalida(${s.id}, this.value)">
         <button type="button" class="tf-icono" onclick="openEncuentroPicker(${s.id})" aria-label="Elegir el punto de encuentro en el mapa" title="Elegir el punto de encuentro en el mapa">📍</button>
       </div>
       <div class="tf-sugs" id="enc-sugs-${s.id}"></div>`;
  return `
    <div class="tf-sal${s.id === salidaAbierta ? ' abierta' : ''}" id="salida-card-${s.id}">
      <button type="button" class="tf-sal-fila" onclick="abrirSalida(${s.id})" aria-expanded="${s.id === salidaAbierta}">
        ${bloqueFecha(s.fecha)}
        <span class="tf-sal-tx"><span class="tf-sal-t">${titulo}</span><span class="tf-sal-s" id="sal-sub-${s.id}">${subSalida(s)}</span></span>
        <span class="tf-estado ${lista ? 'ok' : 'no'}" aria-label="${lista ? 'Lista' : 'Incompleta'}">${lista ? '✓' : '!'}</span>
      </button>
      ${s.id !== salidaAbierta ? '' : `
      <div class="tf-sal-edit">
        <div class="tf-dos tf-campo">
          <div><label>Día</label><button type="button" class="tf-entrada" onclick="elegirDiaSalida(${s.id})">📅 ${fechaCorta(s.fecha)}</button></div>
          <div><label>Hora</label><button type="button" class="tf-entrada" onclick="elegirHoraSalida(${s.id})">🕐 ${esc(s.hora || '—')}</button></div>
        </div>
        <div class="tf-campo"><label>Conductor</label>
          <button type="button" class="tf-entrada${s.conductor ? '' : ' vacia'}" onclick="elegirConductorSalida(${s.id})">👤 ${s.conductor ? esc(s.conductor) : 'Elegir conductor'}</button>
        </div>
        ${terrs}
        <div class="tf-campo"><label>Encuentro / Familia</label>${enc}</div>
        <button type="button" class="tf-quitar" onclick="removeSalida(${s.id})">Quitar esta salida</button>
      </div>`}
    </div>`;
}

function pintarSalidas() {
  salidas.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  document.getElementById('salidas-container').innerHTML = salidas.map(htmlSalida).join('');
  const listas = salidas.filter(salidaLista).length;
  document.getElementById('plan-listas').innerHTML = salidas.length
    ? `<b>${listas}</b> de ${salidas.length} ${salidas.length === 1 ? 'lista' : 'listas'}` : '';
  document.querySelectorAll('#plan-agregar button').forEach(b => { b.disabled = salidas.length >= 20; });
  if (salidaAbierta) pintarSugerencias(salidaAbierta);
}

async function elegirDiaSalida(id) {
  const s = salidaPorId(id);
  if (!s) return;
  const r = await uiDatePicker({ value: s.fecha, label: 'Día de la salida' });
  if (r) { s.fecha = r; pintarSalidas(); }
}

async function elegirHoraSalida(id) {
  const s = salidaPorId(id);
  if (!s) return;
  const r = await uiTimePicker({ value: s.hora, label: 'Hora de la salida' });
  if (r) { s.hora = r; pintarSalidas(); }
}

async function elegirConductorSalida(id) {
  const s = salidaPorId(id);
  if (!s) return;
  const conductores = [...(CONDUCTORES_BY_GROUP[selectedGrupo] || [])];
  if (s.conductor && !conductores.includes(s.conductor)) conductores.unshift(s.conductor);
  if (!conductores.length) { uiToast('No hay conductores cargados para este grupo', 'error'); return; }
  const r = await uiConductorPicker({ conductores, value: s.conductor, label: 'Elegí el conductor' });
  if (r !== null && r !== undefined) { s.conductor = r; pintarSalidas(); }
}

function quitarTerrSalida(id, k) {
  const s = salidaPorId(id);
  if (!s) return;
  s.terrs.splice(k, 1);
  pintarSalidas();
}

function sumarTerrs(id, nuevos) {
  const s = salidaPorId(id);
  if (!s) return;
  nuevos.map(String).filter(t => t && t !== '—').forEach(t => { if (!s.terrs.includes(t)) s.terrs.push(t); });
  pintarSalidas();
  actualizarSugerenciasEncuentro(id);
}

// Escribir en Encuentro no repinta la lista (perdería el foco): solo el resumen del renglón
function setEncuentroSalida(id, valor) {
  const s = salidaPorId(id);
  if (!s) return;
  s.encuentro = valor;
  s.encAuto = false;
  const sub = document.getElementById('sal-sub-' + id);
  if (sub) sub.innerHTML = subSalida(s);
  marcarSugerencias(id);
}

// ─────────────────────────────────────────
//   TERRITORIO PICKER
// ─────────────────────────────────────────
function openTerritorioPicker(salidaId) {
  if (!window.uiTerritorioPicker) return;
  uiTerritorioPicker({
    territoriosData,
    allData: allTerritoriosData,
    grupo: selectedGrupo,
    configData,
    label: 'Elegir territorio',
    color: GCOLORS[selectedGrupo] || '#97C459',
  }).then(resultado => {
    if (resultado) sumarTerrs(salidaId, [resultado]);
  });
}


// ─────────────────────────────────────────
//   PICKER DE MAPA
// ─────────────────────────────────────────
function openMapaPicker(salidaId) {
  const popup  = document.getElementById('mapa-popup');
  const iframe = document.getElementById('mapa-iframe');
  const title  = document.getElementById('mapa-popup-title');
  const grupoLabel = selectedGrupo === 'C' ? 'Congregación' : 'Grupo ' + selectedGrupo;
  title.textContent = `Elegir territorio — ${grupoLabel}`;
  iframe.src = `/territorios/mapa.html?grupo=${selectedGrupo}&modo=picker&salidaid=${salidaId}&picker=1`;
  popup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// ─────────────────────────────────────────
//   MEMORIA DE LUGARES DE ENCUENTRO POR TERRITORIO
//   Sale del historial de salidas/ (cada registro guarda terr + enc): no hay colección nueva ni
//   nada que mantener a mano. Se lee una vez por sesión de planificación y se rearma tras registrar.
// ─────────────────────────────────────────
let encuentrosPorTerr = null;   // { terrId: [{ texto, veces, ultima }] } ordenado: el más usado primero
let _encuentrosPromesa = null;

function cargarEncuentrosPrevios() {
  if (_encuentrosPromesa) return _encuentrosPromesa;
  _encuentrosPromesa = (async () => {
    const porTerr = {};
    try {
      // Todos los registros: ordenar por fechaReg (texto DD/MM/AAAA) no daba los más nuevos y dejaba
      // afuera los que no tienen ese campo. Son pocos docs por semana; la recencia sale de cada fecha.
      const snap = await getDocs(salidaCol());
      snap.forEach(d => {
        const data = d.data();
        (data.salidas || []).forEach(sal => {
          if (sal.tipo === 'tel') return;
          const enc  = String(sal.enc  || '').trim();
          if (!enc || enc === '—') return;
          terrsGuardados(sal).forEach(terr => {
            const lista = (porTerr[terr] = porTerr[terr] || {});
            const clave = enc.toLowerCase();
            const e = (lista[clave] = lista[clave] || { texto: enc, veces: 0, ultima: '' });
            e.veces++;
            const f = sal.fecha || '';
            if (f >= e.ultima) { e.ultima = f; e.texto = enc; }   // se queda con la escritura más reciente
          });
        });
      });
    } catch (e) {
      console.warn('No se pudieron leer los encuentros previos', e);
    }
    encuentrosPorTerr = {};
    Object.keys(porTerr).forEach(t => {
      encuentrosPorTerr[t] = Object.values(porTerr[t])
        .sort((a, b) => b.veces - a.veces || b.ultima.localeCompare(a.ultima));
    });
    return encuentrosPorTerr;
  })();
  return _encuentrosPromesa;
}

// Lugares usados antes para el primer territorio de la salida (hasta 4, el más usado primero)
function opcionesEncuentro(s) {
  const terr = s?.terrs?.[0];
  return terr && encuentrosPorTerr ? (encuentrosPorTerr[String(terr)] || []).slice(0, 4) : [];
}

// Al elegir territorio: si Encuentro está vacío (o tiene un valor que puso esta misma función), lo
// completa con el lugar más usado antes en ese territorio.
async function actualizarSugerenciasEncuentro(salidaId) {
  const s = salidaPorId(salidaId);
  if (!s || s.tipo === 'tel' || !s.terrs.length) return;
  const terr = s.terrs[0];
  await cargarEncuentrosPrevios();
  if (salidaPorId(salidaId)?.terrs[0] !== terr) return;   // cambió mientras cargaba
  const opciones = opcionesEncuentro(s);
  if (opciones.length && (!s.encuentro.trim() || s.encAuto)) {
    s.encuentro = opciones[0].texto;
    s.encAuto = true;
  }
  pintarSalidas();
}

// Botones «Plumerillo y King ×4» debajo de Encuentro (salida abierta)
function pintarSugerencias(salidaId) {
  const cont = document.getElementById('enc-sugs-' + salidaId);
  const s = salidaPorId(salidaId);
  if (!cont || !s) return;
  if (!encuentrosPorTerr) {
    if (s.terrs.length) cargarEncuentrosPrevios().then(() => pintarSugerencias(salidaId));
    return;
  }
  const opciones = opcionesEncuentro(s);
  cont.innerHTML = opciones.map((o, i) =>
    `<button type="button" class="tf-sug" data-i="${i}" title="${esc(o.texto)}">${esc(o.texto)}${o.veces > 1 ? ` <small>×${o.veces}</small>` : ''}</button>`
  ).join('');
  cont.querySelectorAll('.tf-sug').forEach(b => {
    b.onclick = () => {
      const o = opciones[Number(b.dataset.i)];
      s.encuentro = o.texto;
      s.encAuto = true;
      const input = document.getElementById('sal-enc-' + salidaId);
      if (input) input.value = o.texto;
      const sub = document.getElementById('sal-sub-' + salidaId);
      if (sub) sub.innerHTML = subSalida(s);
      marcarSugerencias(salidaId);
    };
  });
  marcarSugerencias(salidaId);
}

function marcarSugerencias(salidaId) {
  const s = salidaPorId(salidaId);
  const opciones = opcionesEncuentro(s);
  document.querySelectorAll(`#enc-sugs-${salidaId} .tf-sug`).forEach((b, i) =>
    b.classList.toggle('activo', (s?.encuentro || '').trim().toLowerCase() === (opciones[i]?.texto || '').toLowerCase()));
}

function openEncuentroPicker(salidaId) {
  const terrVal = salidaPorId(salidaId)?.terrs[0] || '';
  const popup   = document.getElementById('mapa-popup');
  const iframe  = document.getElementById('mapa-iframe');
  const title   = document.getElementById('mapa-popup-title');
  title.textContent = 'Elegir lugar de encuentro';
  iframe.src = `/territorios/mapa.html?modo=encuentro&salidaid=${salidaId}&grupo=${selectedGrupo}${terrVal ? '&terrid=' + encodeURIComponent(terrVal) : ''}`;
  popup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

window.addEventListener('message', function(event) {
  const data = event.data;
  if (!data || !data.type) return;

  if (data.type === 'encuentro-result') {
    closeMapaPopup();
    const s = salidaPorId(data.salidaId);
    if (s && data.texto) {
      s.encuentro = String(data.texto);
      s.encAuto = false;
      pintarSalidas();
    }
    return;
  }

  if (data.type === 'picker-result') {
    closeMapaPopup();
    if (data.territorios?.length) sumarTerrs(data.salidaId, data.territorios);
  }

  if (data.type === 'picker-cancel') {
    closeMapaPopup();
  }
});

// ─────────────────────────────────────────
//   VISTA PREVIA
// ─────────────────────────────────────────
function getDiaBadge(fecha) {
  if (!fecha) return '';
  const d = new Date(fecha + 'T00:00:00');
  const nombre = DIAS_SEMANA[d.getDay()];
  const colores = {
    'Lunes':    'background:#1a1a2e;color:#85B7EB;',
    'Martes':   'background:#0c2a45;color:#85B7EB;',
    'Miércoles':'background:#1a2000;color:#C0DD97;',
    'Jueves':   'background:#2e1e00;color:#FAC775;',
    'Viernes':  'background:#1a2e0a;color:#C0DD97;',
    'Sábado':   'background:#2e1a2e;color:#CDB4FF;',
    'Domingo':  'background:#2e1a1a;color:#F09595;',
  };
  return `<div class="dia-badge" style="${colores[nombre] || ''}">${nombre}</div>`;
}

function generatePreview() {
  const grupoLabel = selectedGrupo === 'C' ? 'Congregación' : 'Grupo ' + selectedGrupo;
  const color = GROUP_COLORS[selectedGrupo] || '#eee';
  document.getElementById('preview-grupo-title').textContent = `${grupoLabel} — Salidas de la semana`;
  document.getElementById('preview-sub').textContent = `${nombreGrupo()} · semana del ${formatShort(getWeekDates(semanaOffset).mon)}`;
  const topEl = document.querySelector('.card-preview-top');
  if (topEl) topEl.textContent = /^congregaci[oó]n\b/i.test(CONGRE_NOMBRE) ? CONGRE_NOMBRE : 'Congregación ' + CONGRE_NOMBRE;
  document.querySelector('.card-preview').style.borderColor = color;
  document.querySelector('.card-preview-header').style.borderBottomColor = color;
  const colorOscuro = { '1':'#0c2a45', '2':'#2e1e00', '3':'#1a2e0a', '4':'#2e1000', 'C':'#1e1a3a' };
  document.querySelectorAll('table.preview th').forEach(th => {
    th.style.background = colorOscuro[selectedGrupo] || '#111';
    th.style.color = color;
  });
  const rows = [];
  if (selectedGrupo === 'C') {
    const horaMan = document.getElementById('tel-fija-manana')?.value || '10:00';
    const horaTar = document.getElementById('tel-fija-tarde')?.value  || '17:00';
    rows.push({ enc:'ID: 844 0225 6636 · Clave: 479104', terr:'TELEFÓNICA', tel:true, badge:'<div class="dia-badge" style="background:var(--k-bg-0a2e24, #0a2e24);color:var(--k-tx-5dcaa5, #5DCAA5);">Lun a Sáb</div>', fecha:'', cond:'—', hora:horaMan.replace(':','.') });
    rows.push({ enc:'ID: 844 0225 6636 · Clave: 479104', terr:'TELEFÓNICA', tel:true, badge:'<div class="dia-badge" style="background:var(--k-bg-0a2e24, #0a2e24);color:var(--k-tx-5dcaa5, #5DCAA5);">Lun a Sáb</div>', fecha:'', cond:'—', hora:horaTar.replace(':','.') });
  }
  salidas.forEach(s => {
    const fecha = s.fecha || '';
    const hora  = s.hora || '';
    const cond  = esc(s.conductor || '—');
    const enc   = esc(s.encuentro.trim() || '—');
    if (s.tipo === 'tel') {
      rows.push({ enc, terr:'TELEFÓNICA', tel:true, badge:getDiaBadge(fecha), fechaISO:fecha, fecha:formatShortFull(fecha).replace(/\//g,'-'), cond, hora:hora.replace(':','.') });
    } else {
      rows.push({ enc, terr: esc(terrsDeSalida(s.id).join(', ')) || '—', tel:false, badge:getDiaBadge(fecha), fechaISO:fecha, fecha:formatShortFull(fecha).replace(/\//g,'-'), cond, hora:hora.replace(':','.') });
    }
  });

  rows.sort((a, b) => {
    if (a.tel && !a.fechaISO) return -1;
    if (b.tel && !b.fechaISO) return 1;
    const fechaA = a.fechaISO || '';
    const fechaB = b.fechaISO || '';
    if (fechaA !== fechaB) return fechaA.localeCompare(fechaB);
    return (a.hora||'').replace('.', ':').localeCompare((b.hora||'').replace('.', ':'));
  });

  document.getElementById('preview-body').innerHTML = rows.map(r => `
    <tr${r.tel ? ' class="tel-row"' : ''}>
      <td>${esc(r.enc)}</td>
      <td>${r.tel ? '<div class="tel-terr">Telefónica</div>' : `<div class="terr-num-big">${esc(r.terr)}</div>`}</td>
      <td>${r.badge}<div class="fecha-num">${r.fecha}</div></td>
      <td><div class="cond-txt">${esc(r.cond)}</div></td>
      <td><div class="hora-txt">${r.hora}</div></td>
    </tr>`).join('');
  hide('view-config'); show('view-preview');
  colorGrupoEnPantallas();
  document.getElementById('preview-wrap').classList.remove('grande');
  ajustarImagen();
}

// La imagen se arma siempre a 900px (es lo que se manda). En el celular se ve entera, achicada;
// al tocarla queda a tamaño real con scroll horizontal.
function ajustarImagen() {
  const wrap = document.getElementById('preview-wrap');
  const card = wrap?.querySelector('.card-preview');
  if (!wrap || !card || wrap.offsetParent === null) return;
  card.style.width = '900px';
  if (wrap.classList.contains('grande')) {
    card.style.transform = '';
    wrap.style.height = '';
    return;
  }
  const esc_ = Math.min(1, wrap.clientWidth / 900);
  card.style.transform = esc_ < 1 ? `scale(${esc_})` : '';
  wrap.style.height = esc_ < 1 ? Math.ceil(card.offsetHeight * esc_) + 'px' : '';
}
function toggleImagenGrande() {
  const wrap = document.getElementById('preview-wrap');
  wrap.classList.toggle('grande');
  ajustarImagen();
}
window.addEventListener('resize', ajustarImagen);

function goBackToConfig() {
  hide('view-preview'); show('view-config');
  const btn    = document.getElementById('btn-reg-prog');
  const status = document.getElementById('reg-prog-status');
  if (btn)    { btn.disabled = false; btn.textContent = '✓ Guardar semana'; }
  if (status) { status.className = 'tf-nota'; status.textContent = 'Guarda las salidas y deja los territorios en progreso.'; }
}

async function canvasSalidas() {
  const el = document.querySelector('.card-preview');
  const originalTransform = el.style.transform;
  el.style.width = '900px';
  el.style.transform = '';   // la vista achicada no va a la imagen
  try {
    return await html2canvas(el, { backgroundColor: '#1e1e1e', scale: 1, width: 900 });
  } finally {
    el.style.transform = originalTransform;
  }
}

function descargarCanvas(canvas) {
  const link = document.createElement('a');
  link.download = `salidas-grupo-${selectedGrupo}.jpg`;
  link.href = canvas.toDataURL('image/jpeg', 0.92);
  link.click();
}

async function guardarImagen() {
  descargarCanvas(await canvasSalidas());
}

// Abre el menú de compartir del celular con la imagen (WhatsApp, etc.). Donde no se pueden compartir
// archivos (la mayoría de las PC) baja la imagen para adjuntarla a mano.
async function enviarWhatsapp() {
  const btn = document.getElementById('btn-enviar-wa');
  const txt = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Preparando…'; }
  try {
    const canvas = await canvasSalidas();
    const blob   = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
    const file   = new File([blob], `salidas-grupo-${selectedGrupo}.jpg`, { type: 'image/jpeg' });
    const titulo = document.getElementById('preview-grupo-title')?.textContent || 'Salidas de la semana';
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: titulo });
      } catch (err) {
        if (err?.name !== 'AbortError') throw err;   // cerrar el menú no es un error
      }
    } else {
      descargarCanvas(canvas);
      uiToast('Imagen descargada: adjuntala en el grupo de WhatsApp', 'success');
    }
  } catch (err) {
    console.error(err);
    uiToast('No se pudo compartir: ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = txt; }
  }
}

// ─────────────────────────────────────────
//   REGISTRAR EN PROGRESO
// ─────────────────────────────────────────
// Todos los territorios de una salida en Planificar: el principal y los «+» extra
function terrsDeSalida(id) {
  return [...new Set((salidaPorId(id)?.terrs || []).map(String).filter(v => v && v !== '—'))];
}

// Territorios de una salida ya guardada (salidas/): terrs si está, si no el terr viejo
function terrsGuardados(s) {
  if (Array.isArray(s?.terrs) && s.terrs.length) return s.terrs.map(String);
  const t = String(s?.terr || '').trim();
  return t && t !== '—' && !/^tel/i.test(t) ? [t] : [];
}

function estadoGuardado(texto, tipo = '') {
  const status = document.getElementById('reg-prog-status');
  if (!status) return;
  status.className = 'tf-nota' + (tipo ? ' ' + tipo : '');
  status.textContent = texto;
}

// «✓ Guardar semana»: guarda las salidas en salidas/ y deja sus territorios en progreso
async function registrarEnProgreso() {
  const btn = document.getElementById('btn-reg-prog');
  const territoriosARegistrar = [];
  salidas.forEach(s => {
    if (s.tipo !== 'campo') return;
    terrsDeSalida(s.id).forEach(terr => territoriosARegistrar.push({ terr, cond: s.conductor || '—', fecha: s.fecha }));
  });
  if (territoriosARegistrar.length === 0) {
    estadoGuardado('No hay territorios de campo asignados.', 'mal');
    return;
  }
  btn.disabled = true;
  if (window.uiLoading) uiLoading.show(`Guardando la semana (${territoriosARegistrar.length} territorio${territoriosARegistrar.length === 1 ? '' : 's'})...`);

  try {
    for (const t of territoriosARegistrar) {
      await addDoc(histCol(t.terr), {
        conductor:   t.cond,
        fechaInicio: t.fecha,
        fechaFin:    null,
      });
    }
    await Promise.all(territoriosARegistrar.map(t => sincronizarUltimoHist(t.terr)));

    // Guardar salida en historial. terr = el primero (lo que leían las versiones viejas), terrs = todos:
    // antes los territorios extra de una salida se marcaban en progreso pero no quedaban en el registro.
    const salidasParaHistorial = salidas.map(s => ({
      enc:   s.encuentro.trim() || '—',
      terr:  s.tipo === 'tel' ? 'TELEFÓNICA' : (terrsDeSalida(s.id)[0] || '—'),
      terrs: s.tipo === 'tel' ? [] : terrsDeSalida(s.id),
      fecha: s.fecha || '',
      cond:  s.conductor || '—',
      hora:  (s.hora || '').replace(':','.'),
      tipo:  s.tipo,
    }));
    await addDoc(salidaCol(), {
      grupoId:   String(selectedGrupo),
      fechaReg:  fmtDateLocal(new Date()),
      salidas:   salidasParaHistorial,
    });

    territoriosData = {};
    encuentrosPorTerr = null; _encuentrosPromesa = null;   // que la próxima planificación vea lo recién guardado
    if (window.uiLoading) uiLoading.hide();
    estadoGuardado(`✓ Semana guardada: ${territoriosARegistrar.length} territorio${territoriosARegistrar.length === 1 ? '' : 's'} en progreso`, 'ok');
    btn.disabled = true;
    btn.textContent = 'Semana guardada ✓';
    window.lanzarPelotaFestejo?.('⚽');
  } catch(err) {
    if (window.uiLoading) uiLoading.hide();
    estadoGuardado('Error: ' + err.message, 'mal');
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────
//   REGISTRAR TERRITORIOS (completar)
// ─────────────────────────────────────────
// Lo que se va a guardar de cada territorio en progreso: { cond, ini, fin, estado: 'completado' | 'progreso' }
let regDatos = {};

async function goToRegistrar() {
  hide('view-modo');
  show('view-registrar');
  colorGrupoEnPantallas();
  document.getElementById('reg-grupo-label').textContent = nombreGrupo();
  show('reg-loading'); hide('reg-container'); hide('reg-error');
  try {
    territoriosData = await fetchGrupo(selectedGrupo);
    await conductoresListos();
    hide('reg-loading');
    renderRegistrar();
  } catch(err) {
    hide('reg-loading');
    const errEl = document.getElementById('reg-error');
    errEl.innerHTML = `<div class="error-wrap">Error: ${esc(err.message)}. <button class="btn-secondary" style="font-size:12px;padding:4px 10px;margin-left:8px;" onclick="goToRegistrar()">Reintentar</button></div>`;
    show('reg-error');
  }
}

function renderRegistrar() {
  const enProgreso = Object.keys(territoriosData).filter(n => territoriosData[n].enProgreso);
  const c = document.getElementById('reg-container');
  const sub = document.getElementById('reg-grupo-label');
  sub.textContent = `${nombreGrupo()} · ${enProgreso.length} en progreso`;
  regDatos = {};
  if (enProgreso.length === 0) {
    c.innerHTML = '<div class="reg-empty">No hay territorios en progreso para este grupo.</div>';
    show('reg-container');
    setPie(null);
    return;
  }
  const hoy = hoyISO();
  enProgreso.forEach(n => {
    const t = territoriosData[n];
    const ini = t.lastIni || hoy;
    regDatos[n] = {
      // El conductor viene de cuando se registró «en progreso»: ya queda elegido (se puede cambiar)
      cond: t.lastConductor && t.lastConductor !== '—' ? t.lastConductor : '',
      ini,
      fin: ini > hoy ? ini : hoy,   // terminó hoy (o el día que empezó, si empezó después de hoy)
      estado: 'completado',
    };
  });
  c.innerHTML = (enProgreso.length > 1
      ? `<button type="button" class="tf-chip tf-chip-ancho" onclick="marcarTodosTerminados()">✓ Marcar todos terminados hoy</button>`
      : '')
    + enProgreso.map(n => `<div id="reg-card-${esc(n)}"></div>`).join('');
  enProgreso.forEach(pintarReg);
  show('reg-container');
  setPie('Guardar cambios', guardarRegistros);
}

function pintarReg(n) {
  const card = document.getElementById('reg-card-' + n);
  const r = regDatos[n];
  if (!card || !r) return;
  const term = r.estado === 'completado';
  const hoy = hoyISO();
  const nArg = `'${esc(n)}'`;
  card.className = 'tf-reg' + (term ? '' : ' sigue');
  card.innerHTML = `
    <div class="tf-reg-cab"><b>Territorio ${esc(n)}</b>
      <span>empezó ${fechaCorta(r.ini)} · <button type="button" class="tf-link" onclick="cambiarIniReg(${nArg})">cambiar</button></span></div>
    <div class="tf-reg-quien">👤 ${r.cond ? esc(r.cond) : '<span class="tf-falta">sin conductor</span>'} · <button type="button" class="tf-link" onclick="cambiarCondReg(${nArg})">cambiar</button></div>
    <div class="tf-seg" role="group" aria-label="Estado del territorio ${esc(n)}">
      <button type="button" class="${term ? 'on t' : ''}" aria-pressed="${term}" onclick="setEstado(${nArg}, 'completado')">✓ Terminado</button>
      <button type="button" class="${term ? '' : 'on s'}" aria-pressed="${!term}" onclick="setEstado(${nArg}, 'progreso')">Sigue</button>
    </div>
    ${term ? `<div class="tf-reg-fin">Terminó el <button type="button" class="tf-entrada" onclick="cambiarFinReg(${nArg})">📅 ${r.fin === hoy ? 'Hoy, ' + fechaCorta(r.fin).toLowerCase() : fechaCorta(r.fin)}</button></div>` : ''}`;
}

function setEstado(n, estado) {
  if (!regDatos[n]) return;
  regDatos[n].estado = estado;
  pintarReg(n);
}

// Todos «Terminado» con fin hoy; el conductor queda el que ya tenía. Hay que tocar Guardar igual.
function marcarTodosTerminados() {
  const hoy = hoyISO();
  const ns = Object.keys(regDatos);
  ns.forEach(n => {
    regDatos[n].estado = 'completado';
    regDatos[n].fin = regDatos[n].ini > hoy ? regDatos[n].ini : hoy;
    pintarReg(n);
  });
  uiToast(`${ns.length} marcados como terminados hoy. Revisá y tocá «Guardar cambios».`, 'success');
}

async function cambiarIniReg(n) {
  const r = regDatos[n];
  if (!r) return;
  const v = await uiDatePicker({ value: r.ini, label: `Territorio ${n}: ¿cuándo empezó?` });
  if (!v) return;
  r.ini = v;
  if (r.fin < v) r.fin = v;
  pintarReg(n);
}

async function cambiarFinReg(n) {
  const r = regDatos[n];
  if (!r) return;
  const v = await uiDatePicker({ value: r.fin, min: r.ini, label: `Territorio ${n}: ¿cuándo terminó?` });
  if (v) { r.fin = v; pintarReg(n); }
}

async function cambiarCondReg(n) {
  const r = regDatos[n];
  if (!r) return;
  const conductores = [...(CONDUCTORES_BY_GROUP[selectedGrupo] || [])];
  if (r.cond && !conductores.includes(r.cond)) conductores.unshift(r.cond);
  if (!conductores.length) { uiToast('No hay conductores cargados para este grupo', 'error'); return; }
  const v = await uiConductorPicker({ conductores, value: r.cond, label: `Territorio ${n}: ¿quién lo trabajó?` });
  if (v !== null && v !== undefined) { r.cond = v; pintarReg(n); }
}

async function guardarRegistros() {
  const btn = document.getElementById('tf-pie-btn');
  const saves = Object.entries(regDatos).map(([n, r]) => ({
    territorio: n,
    conductor: r.cond,
    fechaInicio: r.ini,
    fechaFin: r.estado === 'completado' ? r.fin : null,
    estado: r.estado,
  }));

  if (saves.some(s => s.estado === 'completado' && !s.conductor)) {
    uiToast('Elegí el conductor de cada territorio terminado antes de guardar.', 'error');
    return;
  }
  if (saves.some(s => s.fechaFin && s.fechaFin < s.fechaInicio)) {
    uiToast('Hay un territorio que termina antes de empezar: revisá las fechas.', 'error');
    return;
  }

  btn.disabled = true;
  if (window.uiLoading) uiLoading.show('Guardando registros...');

  try {
    for (const s of saves) {
      // Buscar la entrada en progreso más reciente para este territorio
      const histSnap = await getDocs(
        query(histCol(s.territorio), orderBy('fechaInicio', 'desc'), limit(1))
      );
      if (!histSnap.empty) {
        const histDocRef = histSnap.docs[0].ref;
        await updateDoc(histDocRef, {
          conductor:   s.conductor,
          fechaInicio: s.fechaInicio,
          fechaFin:    s.fechaFin,
        });
      } else {
        // No existía — crear nueva entrada
        await addDoc(histCol(s.territorio), {
          conductor:   s.conductor,
          fechaInicio: s.fechaInicio,
          fechaFin:    s.fechaFin,
        });
      }
    }
    await Promise.all(saves.map(s => sincronizarUltimoHist(s.territorio)));
    territoriosData = {};
    if (window.uiLoading) uiLoading.hide();
    const term = saves.filter(s => s.estado === 'completado').length;
    uiToast(term ? `Guardado: ${term} territorio${term === 1 ? '' : 's'} terminado${term === 1 ? '' : 's'}` : 'Guardado', 'success');
    logActividad(CONGRE_ID, 'territorios', 'guardado', 'Registros de salidas');
    goToRegistrar();   // quedan a la vista solo los que siguen en progreso
  } catch(err) {
    if (window.uiLoading) uiLoading.hide();
    uiToast('Error al guardar: ' + err.message, 'error');
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────
//   INFO GRUPO / MODAL
// ─────────────────────────────────────────
async function goToInfoGrupo() {
  hide('view-modo'); hide('view-informe'); show('view-info');

  const gc = GCOLORS[selectedGrupo] || '#97C459';
  document.getElementById('view-info').style.setProperty('--grupo-color', gc);

  const numEl    = document.getElementById('info-titulo-num');
  const prefixEl = document.getElementById('info-titulo-prefix');
  const supEl    = document.getElementById('info-header-sup');
  if (selectedGrupo === 'C') {
    if (prefixEl) prefixEl.style.display = 'none';
    if (numEl) numEl.textContent = 'Congregación';
  } else {
    if (prefixEl) prefixEl.style.display = '';
    if (numEl) numEl.textContent = selectedGrupo;
  }
  if (supEl) supEl.textContent = 'Territorios · ' + (CONGRE_NOMBRE || '');

  const countPill = document.getElementById('info-count-pill');
  if (countPill) countPill.style.display = 'none';

  show('info-loading'); hide('info-content'); hide('info-error');
  try {
    territoriosData = await fetchGrupo(selectedGrupo);
    configData      = await fetchConfig(selectedGrupo);
    hide('info-loading'); show('info-content');
    renderInfoGrid();
    const btnInf = document.getElementById('btn-informe-super');
    if (btnInf) btnInf.style.display = 'flex';
  } catch(err) {
    hide('info-loading');
    document.getElementById('info-error').innerHTML = `<div class="error-wrap">Error: ${err.message}.</div>`;
    show('info-error');
  }
}

async function goToInforme() {
  hide('view-info'); show('view-informe');
  // Los flotantes se superponen al informe (y al PDF) — se ocultan mientras está abierto
  document.getElementById('btn-home')?.classList.remove('visible');
  document.getElementById('btn-mapa-float')?.classList.remove('visible');
  hideChatFab();
  show('informe-loading'); hide('informe-content');

  // Determinar período: de la última visita del super ya ocurrida a la próxima
  const especSnap = await getDocs(collection(db, 'congregaciones', CONGRE_ID, 'semanasEspeciales'));
  const superFechas = [];
  especSnap.forEach(d => { if (d.data().tipo === 'superintendente') superFechas.push(d.id); });
  superFechas.sort();

  const hoy = window.fmtDateLocal(new Date());

  // Una visita cuenta como "ya ocurrida" solo si su semana terminó (domingo < hoy).
  // La semana en curso y las futuras son la visita que se está preparando.
  const semanaTerminada = (lunes) => {
    const d = new Date(lunes + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return window.fmtDateLocal(d) < hoy;
  };
  const pasadas = superFechas.filter(semanaTerminada);
  const proximas = superFechas.filter(f => !semanaTerminada(f));

  // desde = última visita ya ocurrida; sin ninguna, 6 meses atrás
  let desdeISO;
  if (pasadas.length) {
    desdeISO = pasadas[pasadas.length - 1];
  } else {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    desdeISO = window.fmtDateLocal(d);
  }
  // hasta = próxima visita si ya está agendada a futuro; si no, hoy
  let hastaISO = (proximas.length && proximas[0] > hoy) ? proximas[0] : hoy;
  if (hastaISO < desdeISO) hastaISO = hoy;   // red de seguridad: nunca invertido

  // Territorios del grupo ordenados por número
  const terrIds = Object.keys(territoriosData).sort((a, b) => {
    const na = parseInt(a), nb = parseInt(b);
    return na !== nb ? na - nb : a.localeCompare(b);
  });

  // Cargar historial completo de cada territorio y filtrar por período
  const informeData = [];
  for (const id of terrIds) {
    const snap = await getDocs(query(histCol(id), orderBy('fechaInicio', 'desc')));
    const entries = [];
    snap.forEach(d => {
      const e = d.data();
      let fi = e.fechaInicio?.toDate ? window.fmtDateLocal(e.fechaInicio.toDate()) : (e.fechaInicio || '');
      let ff = e.fechaFin?.toDate   ? window.fmtDateLocal(e.fechaFin.toDate())     : (e.fechaFin   || null);
      if (fi && fi >= desdeISO) entries.push({ fechaInicio: fi, fechaFin: ff, conductor: e.conductor || '—' });
    });
    const t = territoriosData[id];
    informeData.push({ id, nombre: t?.nombre || `Territorio ${id}`, tipo: configData[id] || 'normal', entries });
  }

  // Render cabecera
  const grupoLabel   = selectedGrupo === 'C' ? 'Congregación' : `Grupo ${selectedGrupo}`;
  const totalTerr    = informeData.length;
  const trabajados   = informeData.filter(t => t.entries.length > 0).length;
  const sinActividad = totalTerr - trabajados;
  document.getElementById('informe-meta').innerHTML = `
    <div class="informe-titulo-print">${CONGRE_NOMBRE} · ${grupoLabel}</div>
    <div class="informe-periodo">Del ${formatShortFull(desdeISO)} al ${formatShortFull(hastaISO)}</div>
    <div class="informe-resumen">
      <span>${totalTerr} territorios</span><span class="informe-sep">·</span>
      <span class="informe-ok">${trabajados} trabajados</span><span class="informe-sep">·</span>
      <span class="${sinActividad > 0 ? 'informe-warn' : ''}">${sinActividad} sin actividad</span>
    </div>`;

  // Render territorios
  const lista = document.getElementById('informe-lista');
  lista.innerHTML = '';
  informeData.forEach(t => {
    const card = document.createElement('div');
    card.className = 'informe-terr-card' + (t.entries.length === 0 ? ' sin-act' : '');
    const displayNum = t.nombre.replace(/^Territorio\s+/, '');
    const countTxt   = t.entries.length === 0 ? '—' : `${t.entries.length}× en el período`;
    let entriesHTML  = t.entries.length === 0
      ? `<div class="informe-sin-act-txt">Sin actividad en el período</div>`
      : t.entries.map((e, i) => {
          const bullet = i === t.entries.length - 1 ? '└' : '├';
          const fin    = e.fechaFin ? formatShortFull(e.fechaFin) : 'En curso';
          return `<div class="informe-entry">
            <span class="informe-bullet">${bullet}</span>
            <span class="informe-entry-fecha">${formatShortFull(e.fechaInicio)} → ${fin}</span>
            <span class="informe-entry-sep">·</span>
            <span class="informe-entry-cond">${esc(e.conductor)}</span>
          </div>`;
        }).join('');
    card.innerHTML = `
      <div class="informe-terr-header">
        <span class="informe-terr-num">Territorio ${displayNum}</span>
        <span class="informe-terr-count">${countTxt}</span>
      </div>
      ${entriesHTML}`;
    lista.appendChild(card);
  });

  hide('informe-loading'); show('informe-content');
}

window.goToInforme = goToInforme;
window.descargarInformePDF = function() { window.print(); };

// Volver del informe a "ver mi grupo" sin recargar territorios (los datos ya están en memoria)
window.salirDelInforme = function() {
  hide('view-informe');
  show('view-info');          // show() reactiva btn-home y btn-mapa-float
  showChatFab();
};

function daysClass(d) {
  if (d === null || d === undefined) return '';
  if (d < 30)  return 'days-ok';
  if (d <= 60) return 'days-warn';
  return 'days-bad';
}

function renderInfoBtn(container, n) {
  const t = territoriosData[n];
  const estado = configData[n] || t.tipo || 'normal';
  const lastDate = t.lastFin || t.lastIni;
  const dias = lastDate ? daysSince(lastDate) : null;
  const diasTxt = dias !== null ? `${dias}d` : '—';
  const displayNum = t.nombre ? t.nombre.replace(/^Territorio\s+/, '') : n;
  const estadoLabels = { normal: 'Normal', peligroso: 'Peligroso', no_predica: 'No predica' };
  const estadoLabel = estadoLabels[estado] || 'Normal';
  const dataEstado = estado === 'no_predica' ? 'nopredica' : (lastDate ? estado : 'sinreg');
  const conductor = t.lastConductor || '';

  const card = document.createElement('div');
  card.className = 'va-terr';
  card.dataset.estado = dataEstado;
  card.innerHTML = `
    <div class="va-terr-num">${displayNum}</div>
    <div class="va-terr-label">${estadoLabel}</div>
    <div class="va-terr-dias">
      <span class="va-terr-days-val ${daysClass(dias)}">${diasTxt}</span>
    </div>
    <div class="va-terr-conductor">${conductor ? esc(conductor) : 'Sin conductor'}</div>
  `;
  card.onclick = () => openModal(n);
  container.appendChild(card);
}

// «Más atrasados»: los que hace más de 60 días que no se trabajan (o nunca), del más viejo al más nuevo.
// No entran los «No predica».
let filtroInfo = 'todos';
const DIAS_ATRASADO = 60;

function diasDesdeUso(n) {
  const t = territoriosData[n];
  const last = t.lastFin || t.lastIni;
  return last ? daysSince(last) : Infinity;
}
function esAtrasado(n) {
  const estado = configData[n] || territoriosData[n].tipo || 'normal';
  return estado !== 'no_predica' && !territoriosData[n].enProgreso && diasDesdeUso(n) > DIAS_ATRASADO;
}

function setFiltroInfo(f) {
  filtroInfo = f;
  document.querySelectorAll('#info-filtros .va-filtro').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  renderInfoGrid();
}

function renderInfoGrid() {
  const g = document.getElementById('info-grid');
  g.innerHTML = '';
  const nums = Object.keys(territoriosData).sort((a,b) => {
    const na = parseInt(a), nb = parseInt(b);
    return na !== nb ? na - nb : a.localeCompare(b);
  });

  const countPill = document.getElementById('info-count-pill');
  if (countPill) {
    countPill.textContent = `${nums.length} territorio${nums.length !== 1 ? 's' : ''}`;
    countPill.style.display = '';
  }

  const atrasados = nums.filter(esAtrasado).sort((a, b) => diasDesdeUso(b) - diasDesdeUso(a));
  const nAtras = document.getElementById('info-atras-n');
  if (nAtras) nAtras.textContent = atrasados.length ? String(atrasados.length) : '';
  if (filtroInfo === 'atrasados') {
    g.style.display = '';
    if (!atrasados.length) {
      g.innerHTML = `<div class="va-vacio">Ningún territorio con más de ${DIAS_ATRASADO} días sin trabajar 🎉</div>`;
      return;
    }
    atrasados.forEach(n => renderInfoBtn(g, n));
    return;
  }

  const hasCiudades = nums.some(n => territoriosData[n].ciudad);
  if (hasCiudades) {
    // Modo ciudad: contenedor actúa como bloque, sub-grids por ciudad
    g.style.display = 'block';
    const grupos = new Map();
    grupos.set(null, []);
    nums.forEach(n => {
      const c = territoriosData[n].ciudad || null;
      if (!grupos.has(c)) grupos.set(c, []);
      grupos.get(c).push(n);
    });

    grupos.forEach((lista, ciudad) => {
      if (lista.length === 0) return;
      const hdr = document.createElement('div');
      hdr.className = 'info-ciudad-hdr';
      hdr.textContent = ciudad
        ? `Territorios de ${ciudad}`
        : `Territorios de ${ciudadPrincipal || CONGRE_NOMBRE}`;
      g.appendChild(hdr);
      const grid = document.createElement('div');
      grid.className = 'va-grid';
      lista.forEach(n => renderInfoBtn(grid, n));
      g.appendChild(grid);
    });
  } else {
    g.style.display = '';
    nums.forEach(n => renderInfoBtn(g, n));
  }
}

function handleModalBg(e) {
  if (e.target.id === 'estado-modal') closeModal();
}

async function openModal(n) {
  modalTerr = n;
  editingRow = null;

  const modal = document.getElementById('estado-modal');
  const gc = GCOLORS[selectedGrupo] || '#97C459';
  modal.style.setProperty('--grupo-color', gc);

  const t = territoriosData[n];
  const displayNum = t?.nombre ? t.nombre.replace(/^Territorio\s+/, '') : n;
  document.getElementById('modal-terr-title').textContent = displayNum;
  const subEl = document.getElementById('modal-terr-sub');
  if (subEl) {
    const grupoLabel = selectedGrupo === 'C' ? 'Congregación' : `Grupo ${selectedGrupo}`;
    subEl.textContent = `Territorio · ${grupoLabel}`;
  }

  // Activar botón de estado actual
  const estado = configData[n] || t?.tipo || 'normal';
  modal.querySelectorAll('.modal-estado-btn').forEach(b => b.classList.remove('active'));
  const btnClass = estado === 'no_predica' ? '.me-nopredica' : (estado === 'peligroso' ? '.me-peligroso' : '.me-normal');
  const activeBtn = modal.querySelector(btnClass);
  if (activeBtn) activeBtn.classList.add('active');

  document.getElementById('modal-hist-loading').style.display = '';
  document.getElementById('modal-hist-content').style.display = 'none';
  document.getElementById('modal-edit-form').style.display = 'none';
  _modalPunto = null;
  actualizarComoLlegar();

  modal.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('open')));

  try {
    const [histSnap, terrSnap] = await Promise.all([
      getDocs(query(histCol(n), orderBy('fechaInicio', 'desc'))),
      getDoc(doc(terrCol(), String(n)))
    ]);
    document.getElementById('modal-hist-loading').style.display = 'none';
    const rows = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderHistorial(rows);
    document.getElementById('modal-hist-content').style.display = '';
    document.getElementById('modal-notas').value = terrSnap.exists() ? (terrSnap.data().notas || '') : '';
    if (modalTerr === n && terrSnap.exists()) {
      _modalPunto = puntoDeTerritorio(terrSnap.data());
      actualizarComoLlegar();
    }
  } catch(err) {
    document.getElementById('modal-hist-loading').textContent = 'Error al cargar historial';
  }
}

// ── Cómo llegar / Compartir (detalle del territorio) ──
// Destino: el punto del territorio (o, si no tiene, el centro de sus polígonos).
let _modalPunto = null;

function puntoDeTerritorio(t) {
  if (t?.punto && Number.isFinite(t.punto.lat) && Number.isFinite(t.punto.lng)) return t.punto;
  const coords = (t?.poligonos || []).flatMap(p => p.coords || []).filter(c => Number.isFinite(c?.lat));
  if (!coords.length) return null;
  const lats = coords.map(c => c.lat), lngs = coords.map(c => c.lng);
  return { lat: (Math.min(...lats) + Math.max(...lats)) / 2, lng: (Math.min(...lngs) + Math.max(...lngs)) / 2 };
}

const urlComoLlegar = p => `https://www.google.com/maps/dir/?api=1&destination=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

function actualizarComoLlegar() {
  const a = document.getElementById('modal-como-llegar');
  if (!a) return;
  if (_modalPunto) { a.href = urlComoLlegar(_modalPunto); a.setAttribute('aria-disabled', 'false'); }
  else { a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); }
}

// Manda el número y el link de Google Maps (lo abre cualquiera, con o sin cuenta) por WhatsApp u otra app
async function compartirTerritorio() {
  const n = modalTerr;
  if (!n) return;
  const t = territoriosData[n];
  const num = t?.nombre ? t.nombre.replace(/^Territorio\s+/, '') : n;
  const grupo = selectedGrupo === 'C' ? 'Congregación' : `Grupo ${selectedGrupo}`;
  const texto = `Territorio ${num} · ${grupo}` + (_modalPunto ? `\nCómo llegar: ${urlComoLlegar(_modalPunto)}` : '');
  if (navigator.share) {
    try { await navigator.share({ text: texto }); } catch (err) { if (err?.name !== 'AbortError') console.warn(err); }
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank', 'noopener');
  }
}

function renderHistorial(rows) {
  historialRows = rows;
  const tbody = document.getElementById('modal-hist-body');
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--k-tx-888888, #888);text-align:center;">Sin registros</td></tr>';
  } else {
    tbody.innerHTML = rows.map((r, i) => `
      <tr>
        <td>${r.conductor ? esc(r.conductor) : '—'}</td>
        <td>${r.fechaInicio ? formatShortFull(r.fechaInicio) : '—'}</td>
        <td>${r.fechaFin ? formatShortFull(r.fechaFin) : '<span class="hist-en-prog">en prog.</span>'}</td>
        <td style="white-space:nowrap;text-align:right;">
          <button class="hist-edit-btn" onclick="startEdit('${r.id}')">Editar</button>
          <button class="hist-del-btn" onclick="deleteEntry('${r.id}')">✕</button>
        </td>
      </tr>`).join('');
  }
  const histContent = document.getElementById('modal-hist-content');
  let addBtn = document.getElementById('btn-add-entry');
  if (!addBtn) {
    addBtn = document.createElement('button');
    addBtn.id = 'btn-add-entry';
    addBtn.className = 'btn-add-entry';
    addBtn.textContent = '+ Agregar entrada';
    addBtn.onclick = startAddEntry;
    histContent.appendChild(addBtn);
  }
}

async function deleteEntry(docId) {
  const ok = await uiConfirm({
    title: '¿Eliminar entrada?',
    msg: 'Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!ok) return;
  const n = modalTerr;
  await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'territorios', String(n), 'historial', docId));
  await sincronizarUltimoHist(n);
  await openModal(n);
  await refreshTerrEntrada(n);
}

function startAddEntry() {
  editingRow = null;
  document.getElementById('modal-edit-form').style.display = '';
  const conductores = CONDUCTORES_BY_GROUP[selectedGrupo] || [];
  const dl = document.getElementById('conductores-list');
  if (dl) dl.innerHTML = conductores.map(c => `<option value="${esc(c)}">`).join('');
  document.getElementById('edit-cond').value = '';
  document.getElementById('edit-ini').value = '';
  document.getElementById('edit-fin').value = '';
  if (window.upgradeInputs) upgradeInputs(document.getElementById('modal-edit-form'));
}

// Los datos salen de historialRows: el nombre del conductor dentro del onclick rompía el botón con un apóstrofo
function startEdit(docId) {
  const row = historialRows.find(r => r.id === docId) || {};
  const conductor = row.conductor || '', ini = row.fechaInicio || '', fin = row.fechaFin || '';
  editingRow = docId;
  document.getElementById('modal-edit-form').style.display = '';
  const conductores = CONDUCTORES_BY_GROUP[selectedGrupo] || [];
  const sel = document.getElementById('edit-cond');
  sel.innerHTML = '<option value="">— Elegir —</option>' +
    conductores.map(c => `<option value="${esc(c)}" ${c===conductor?'selected':''}>${esc(c)}</option>`).join('');
  if (conductor && !conductores.includes(conductor))
    sel.innerHTML += `<option value="${esc(conductor)}" selected>${esc(conductor)}</option>`;
  document.getElementById('edit-ini').value = ini;
  document.getElementById('edit-fin').value = fin;
  if (window.upgradeInputs) upgradeInputs(document.getElementById('modal-edit-form'));
}

function cancelEdit() {
  editingRow = null;
  document.getElementById('modal-edit-form').style.display = 'none';
}

async function saveEdit() {
  const conductor = document.getElementById('edit-cond').value.trim();
  const ini = document.getElementById('edit-ini').value;
  const fin = document.getElementById('edit-fin').value || null;
  if (!conductor) {
    await uiAlert('Elegí un conductor antes de guardar.', 'Falta el conductor');
    return;
  }
  const data = { conductor, fechaInicio: ini, fechaFin: fin };
  if (editingRow) {
    await updateDoc(
      doc(db, 'congregaciones', CONGRE_ID, 'territorios', String(modalTerr), 'historial', editingRow),
      data
    );
  } else {
    await addDoc(histCol(modalTerr), data);
  }
  cancelEdit();
  const n = modalTerr;
  await sincronizarUltimoHist(n);
  await openModal(n);
  await refreshTerrEntrada(n);
}

function closeModal() {
  const modal = document.getElementById('estado-modal');
  modal.classList.remove('open');
  setTimeout(() => {
    modal.style.display = 'none';
    modalTerr  = null;
    editingRow = null;
  }, 300);
}

async function refreshTerrEntrada(n) {
  if (!territoriosData[n]) return;
  const ult = await ultimoHistDe(n);
  const lastIni = ult?.ini || null, lastFin = ult?.fin || null;
  const enProgreso = !!ult && !ult.fin, lastConductor = ult?.conductor || null;
  territoriosData[n] = { ...territoriosData[n], lastFin, lastIni, enProgreso, lastConductor };
  renderInfoGrid();
}

async function saveNota() {
  if (!modalTerr) return;
  const notas = document.getElementById('modal-notas').value.trim();
  await updateDoc(doc(terrCol(), String(modalTerr)), { notas: notas || null });
  invalidarGrupos();
  uiToast('Nota guardada', 'success');
}

async function setTerritoryEstado(estado) {
  if (!modalTerr) return;
  closeModal();
  const n = modalTerr;
  if (estado === 'normal') delete configData[n]; else configData[n] = estado;
  renderInfoGrid();
  // Actualizar el campo `tipo` en el documento del territorio en Firestore
  await updateDoc(doc(terrCol(), String(n)), { tipo: estado });
  invalidarGrupos();
}

// ─────────────────────────────────────────
//   HISTORIAL DE SALIDAS
// ─────────────────────────────────────────
async function goToHistorial() {
  hide('view-modo'); show('view-historial');
  colorGrupoEnPantallas();
  document.getElementById('hist-titulo').textContent = nombreGrupo();
  show('hist-loading'); hide('hist-content'); hide('hist-error');
  try {
    const q = query(salidaCol(), where('grupoId', '==', String(selectedGrupo)));
    const snap = await getDocs(q);
    hide('hist-loading');
    // Cada registro se ordena por la primera fecha de sus salidas (fechaReg es DD/MM/AAAA: como texto
    // «17/05» quedaba antes que «08/10»), el más nuevo arriba; adentro, por día y hora.
    const primeraFecha = d => (d.data().salidas || []).map(s => s.fecha).filter(Boolean).sort()[0]
      || claveFechaReg(d.data().fechaReg);
    const sortedDocs = snap.docs.slice().sort((a, b) => primeraFecha(b).localeCompare(primeraFecha(a)));
    const rows = [];
    sortedDocs.forEach(d => {
      const data = d.data();
      const semana = primeraFecha(d);
      (data.salidas || []).slice()
        .sort((a, b) => ((a.fecha || '') + String(a.hora || '').padStart(5, '0'))
          .localeCompare((b.fecha || '') + String(b.hora || '').padStart(5, '0')))
        .forEach(s => rows.push({ ...s, fechaReg: data.fechaReg, semana, salidaDocId: d.id }));
    });
    renderHistorialSalidas(rows, sortedDocs);
    show('hist-content');
  } catch(err) {
    hide('hist-loading');
    document.getElementById('hist-error').innerHTML = `<div class="error-wrap">Error: ${esc(err.message)}</div>`;
    show('hist-error');
  }
}

function renderHistorialSalidas(rows, docs) {
  const c = document.getElementById('hist-content');
  c.innerHTML = '';
  if (rows.length === 0) {
    c.innerHTML = '<div class="reg-empty">No hay salidas registradas todavía.</div>';
    return;
  }
  // Agrupar por salidaDocId (cada documento = una semana registrada)
  const grupos = {}, orden = [];
  rows.forEach(r => {
    if (!grupos[r.salidaDocId]) { grupos[r.salidaDocId] = { rows:[], fechaReg: r.semana || r.fechaReg }; orden.push(r.salidaDocId); }
    grupos[r.salidaDocId].rows.push(r);
  });
  const hoy = hoyISO();
  c.innerHTML = orden.map((docId, i) => {
    const g = grupos[docId];
    const titulo = /^\d{4}-\d{2}-\d{2}$/.test(g.fechaReg || '')
      ? tituloSemana(g.fechaReg)
      : 'Registrado el ' + esc(fmtHistDate(g.fechaReg));
    const filas = g.rows.map(r => {
      const esTel = r.tipo === 'tel' || String(r.terr).toUpperCase().includes('TEL');
      const terrs = terrsGuardados(r);
      const enc = r.enc && r.enc !== '—' ? ' · ' + esc(r.enc) : '';
      return `<div class="tf-h-fila${r.fecha && r.fecha < hoy ? ' pasada' : ''}">${bloqueFecha(r.fecha, true)}
        <span class="tf-sal-tx"><span class="tf-sal-t">${esTel ? '<span class="tf-tel">Telefónica</span>' : esc(nombreTerrs(terrs) || 'Sin territorio')}</span>
          <span class="tf-sal-s">${esc(r.cond || '—')}${enc}</span></span>
        <span class="tf-h-hora">${esc(String(r.hora || '').replace('.', ':'))}</span></div>`;
    }).join('');
    return `<div class="tf-sem" id="hist-sem-${i}">
      <div class="tf-sem-cab"><b>${titulo}<span>${g.rows.length} salida${g.rows.length === 1 ? '' : 's'}</span></b>
        <button type="button" class="tf-mas-btn" aria-label="Más opciones" aria-expanded="false" onclick="toggleMenuSemana(${i}, this)">⋯</button></div>
      <div class="tf-sem-menu"><button type="button" class="tf-chip tf-chip-mal" data-doc="${esc(docId)}" onclick="deleteHistorialDoc(this.dataset.doc, this)">🗑 Eliminar semana</button></div>
      ${filas}
    </div>`;
  }).join('');
}

function toggleMenuSemana(i, btn) {
  const sem = document.getElementById('hist-sem-' + i);
  const abierto = sem.classList.toggle('menu');
  btn.setAttribute('aria-expanded', String(abierto));
}

async function deleteHistorialDoc(docId, btn) {
  const ok = await uiConfirm({
    title: '¿Eliminar semana?',
    msg: 'Se eliminará el registro de esta semana. Esta acción no se puede deshacer.',
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger'
  });
  if (!ok) return;
  btn.disabled = true;
  await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'salidas', docId));
  await goToHistorial();
}

// ─────────────────────────────────────────
//   CHAT / NOTAS COMPARTIDAS
// ─────────────────────────────────────────
function notasColByScope(scope) {
  const channelId = scope === 'congregacion' ? 'congregacion' : `grupo_${selectedGrupo}`;
  return collection(db, 'congregaciones', CONGRE_ID, 'chatNotas', channelId, 'mensajes');
}

// ─────────────────────────────────────────
//   CHAT / NOTAS — PANEL FLOTANTE
// ─────────────────────────────────────────
let _chatEditDocId = null;

function getScopeLabel(scope) {
  if (scope === 'congregacion') return 'Congregación';
  const g = GRUPOS.find(x => String(x.id) === String(selectedGrupo));
  return g?.label || `Grupo ${selectedGrupo}`;
}

function getAutorLabel() {
  // Always the group name, regardless of which channel we're posting to
  const g = GRUPOS.find(x => String(x.id) === String(selectedGrupo));
  return g?.label || `Grupo ${selectedGrupo}`;
}

function getMisIds() {
  try { return JSON.parse(sessionStorage.getItem('chatMisIds') || '[]'); }
  catch { return []; }
}
function addMiId(id) {
  const arr = getMisIds();
  arr.push(id);
  sessionStorage.setItem('chatMisIds', JSON.stringify(arr));
}

function showChatFab() {
  const fab = document.getElementById('chat-fab');
  if (fab) fab.style.display = 'flex';
}
function hideChatFab() {
  const fab = document.getElementById('chat-fab');
  if (fab) fab.style.display = 'none';
}

window.openChatPanel = function() {
  const overlay = document.getElementById('chat-overlay');
  if (overlay) overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  switchChatScope(chatScope || 'grupo');
};

window.closeChatPanel = function() {
  const overlay = document.getElementById('chat-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
};

function switchChatScope(scope) {
  chatScope = scope === 'congregacion' ? 'congregacion' : 'grupo';
  const cvtGrupo = document.getElementById('cvt-grupo');
  const cvtCong  = document.getElementById('cvt-congregacion');
  if (cvtGrupo) cvtGrupo.classList.toggle('active', chatScope === 'grupo');
  if (cvtCong)  cvtCong.classList.toggle('active', chatScope === 'congregacion');
  const titulo = document.getElementById('chat-panel-titulo');
  if (titulo) titulo.textContent = 'Notas — ' + getScopeLabel(chatScope);
  refreshChatNotas();
}

async function refreshChatNotas() {
  show('chat-loading'); hide('chat-list'); hide('chat-error'); hide('chat-empty');
  try {
    const snap = await getDocs(query(notasColByScope(chatScope), orderBy('createdAt', 'desc'), limit(80)));
    hide('chat-loading');
    const misIds = getMisIds();
    const currentUid = window.currentUser?.uid || null;
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _chatTextos = new Map(items.map(n => [n.id, n.texto || '']));
    const list = document.getElementById('chat-list');
    if (!items.length) { show('chat-empty'); list.innerHTML = ''; return; }
    list.innerHTML = items.map(n => {
      const esMio = (currentUid && n.ownerUid === currentUid) || misIds.includes(n.id);
      const fecha = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
      const fechaStr = `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')} ${String(fecha.getHours()).padStart(2,'0')}:${String(fecha.getMinutes()).padStart(2,'0')}`;
      const acciones = esMio ? `
        <div class="chat-item-actions">
          <button class="chat-btn-edit" onclick="abrirEditNota('${n.id}')">Editar</button>
          <button class="chat-btn-del"  onclick="eliminarNota('${n.id}')">Eliminar</button>
        </div>` : '';
      return `<div class="chat-item">
        <div class="chat-item-head">
          <span class="chat-item-author">${esc(n.autor || getScopeLabel(n.canal === 'congregacion' ? 'congregacion' : 'grupo'))}</span>
          <span class="chat-item-date">${fechaStr}</span>
        </div>
        <div class="chat-item-text">${esc(n.texto || '')}</div>
        ${acciones}
      </div>`;
    }).join('');
    show('chat-list');
  } catch(err) {
    hide('chat-loading');
    document.getElementById('chat-error').innerHTML =
      `<div class="error-wrap" style="margin:8px 12px;font-size:12px;">Error: ${err.message}</div>`;
    show('chat-error');
  }
}

async function sendChatNota(btnEl) {
  const texto = document.getElementById('chat-mensaje').value.trim();
  if (!texto) { await uiAlert('Escribí una nota antes de publicar.', 'Mensaje vacío'); return; }
  if (btnEl) btnEl.disabled = true;
  try {
    const ref = await addDoc(notasColByScope(chatScope), {
      autor: getAutorLabel(),
      texto,
      createdAt: Timestamp.now(),
      canal: chatScope,
      grupo: chatScope === 'grupo' ? String(selectedGrupo) : 'C',
      ownerUid: window.currentUser?.uid || null,
    });
    addMiId(ref.id);
    document.getElementById('chat-mensaje').value = '';
    await refreshChatNotas();
    uiToast('Nota publicada', 'success');
  } catch(err) {
    await uiAlert(`No se pudo publicar: ${err.message}`, 'Error');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}

// Texto de cada nota por id: el botón Editar pasa solo el id (el texto adentro de un onclick cortaba el atributo)
let _chatTextos = new Map();

window.abrirEditNota = function(docId) {
  _chatEditDocId = docId;
  const ta = document.getElementById('chat-edit-texto');
  if (ta) ta.value = _chatTextos.get(docId) || '';
  document.getElementById('chat-edit-modal').style.display = 'flex';
};

window.closeChatEdit = function() {
  document.getElementById('chat-edit-modal').style.display = 'none';
  _chatEditDocId = null;
};

window.confirmarEditNota = async function() {
  const texto = document.getElementById('chat-edit-texto').value.trim();
  if (!texto || !_chatEditDocId) return;
  try {
    await updateDoc(doc(notasColByScope(chatScope), _chatEditDocId), { texto });
    closeChatEdit();
    await refreshChatNotas();
    uiToast('Nota actualizada', 'success');
  } catch(err) {
    await uiAlert('Error al editar: ' + err.message);
  }
};

window.eliminarNota = async function(docId) {
  const ok = await uiConfirm({ title: 'Eliminar nota', msg: '¿Eliminar este mensaje?', confirmText: 'Eliminar', type: 'danger' });
  if (!ok) return;
  try {
    const colRef = notasColByScope(chatScope);
    await deleteDoc(doc(db, colRef.path, docId));
    const misIds = getMisIds().filter(id => id !== docId);
    sessionStorage.setItem('chatMisIds', JSON.stringify(misIds));
    await refreshChatNotas();
    uiToast('Nota eliminada', 'success');
  } catch(err) {
    await uiAlert('Error: ' + err.message);
  }
};

// ─────────────────────────────────────────
//   MAPA POPUP
// ─────────────────────────────────────────
function openMapaPopup(modo) {
  const popup  = document.getElementById('mapa-popup');
  const iframe = document.getElementById('mapa-iframe');
  const title  = document.getElementById('mapa-popup-title');
  const g      = selectedGrupo;
  const grupoLabel = g === 'C' ? 'Congregación' : 'Grupo ' + g;
  title.textContent = modo === 'registrar'
    ? `Mapa — ${grupoLabel} · En progreso`
    : `Mapa — ${grupoLabel}`;

  let enProgresoParam = '';
  if (modo === 'registrar') {
    const enProg = Object.keys(territoriosData).filter(n => territoriosData[n].enProgreso);
    enProgresoParam = '&enprogreso=' + encodeURIComponent(enProg.join(','));
  }

  iframe.src = `/territorios/mapa.html?grupo=${g}&modo=${modo}${enProgresoParam}`;
  popup.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeMapaPopup() {
  document.getElementById('mapa-popup').style.display = 'none';
  document.getElementById('mapa-iframe').src = '';
  document.body.style.overflow = '';
}

window.selectGrupo = selectGrupo;
window.goToModo = goToModo;
window.goToStep1 = goToStep1;
window.goToRegistrar = goToRegistrar;
window.goToInfoGrupo = goToInfoGrupo;
window.goToHistorial = goToHistorial;
window.goToMapa = goToMapa;
window.cerrarSesion = cerrarSesion;
window.guardarRegistros = guardarRegistros;
window.setTerritoryEstado = setTerritoryEstado;
window.closeModal = closeModal;
window.handleModalBg = handleModalBg;
window.entrarGrupoSeleccionado = entrarGrupoSeleccionado;
window.generatePreview = generatePreview;
window.guardarImagen = guardarImagen;
window.setFiltroInfo = setFiltroInfo;
window.compartirTerritorio = compartirTerritorio;
window.copiarSemanaAnterior = copiarSemanaAnterior;
window.marcarTodosTerminados = marcarTodosTerminados;
window.enviarWhatsapp = enviarWhatsapp;
window.registrarEnProgreso = registrarEnProgreso;
window.goBackToConfig = goBackToConfig;
window.addSalida = addSalida;
window.cambiarSemana = cambiarSemana;
window.closeMapaPopup = closeMapaPopup;
window.openTerritorioPicker = openTerritorioPicker;
window.startEdit = startEdit;
window.startAddEntry = startAddEntry;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.deleteEntry = deleteEntry; 
window.deleteHistorialDoc = deleteHistorialDoc;
window.switchChatScope = switchChatScope;
window.refreshChatNotas = refreshChatNotas;
window.sendChatNota = sendChatNota;
window.openMapaPicker      = openMapaPicker;
window.openEncuentroPicker = openEncuentroPicker;
window.saveNota            = saveNota;
window.removeSalida        = removeSalida;
window.abrirSalida          = abrirSalida;
window.elegirDiaSalida      = elegirDiaSalida;
window.elegirHoraSalida     = elegirHoraSalida;
window.elegirConductorSalida = elegirConductorSalida;
window.quitarTerrSalida     = quitarTerrSalida;
window.setEncuentroSalida   = setEncuentroSalida;
window.toggleImagenGrande   = toggleImagenGrande;
window.setEstado            = setEstado;
window.cambiarIniReg        = cambiarIniReg;
window.cambiarFinReg        = cambiarFinReg;
window.cambiarCondReg       = cambiarCondReg;
window.toggleMenuSemana     = toggleMenuSemana;
