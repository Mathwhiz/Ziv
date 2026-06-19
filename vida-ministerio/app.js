import { db } from '../shared/firebase.js';
import '../shared/auth.js';
import { logActividad } from '../shared/actividad.js';
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, addDoc, updateDoc, query, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

await window.authGuard('acceso_vm');

// ─────────────────────────────────────────
//   CONSTANTES
// ─────────────────────────────────────────
const ROLES_VM = [
  { id: 'VM_PRESIDENTE',                label: 'Presidente' },
  { id: 'VM_ORACION',                   label: 'Oración' },
  { id: 'VM_TESOROS',                   label: 'Discurso Tesoros' },
  { id: 'VM_JOYAS',                     label: 'Perlas escondidas' },
  { id: 'VM_LECTURA',                   label: 'Lectura Bíblica' },
  { id: 'VM_MINISTERIO_CONVERSACION',   label: 'Min. Conversación' },
  { id: 'VM_MINISTERIO_REVISITA',       label: 'Min. Revisita' },
  { id: 'VM_MINISTERIO_ESCENIFICACION', label: 'Min. Escenificación' },
  { id: 'VM_MINISTERIO_DISCURSO',       label: 'Min. Discurso' },
  { id: 'VM_VIDA_CRISTIANA',            label: 'Vida Cristiana' },
  { id: 'VM_ESTUDIO_CONDUCTOR',         label: 'Conductor Estudio' },
];

// Roles VM que requieren ser varón (mujeres nunca pueden ocuparlos)
const ROLES_VM_SOLO_VARON = [
  'VM_PRESIDENTE','VM_ORACION','VM_TESOROS','VM_JOYAS','VM_LECTURA',
  'VM_MINISTERIO_DISCURSO','VM_VIDA_CRISTIANA','VM_ESTUDIO_CONDUCTOR',
];

// Tipo de parte ministerio → rol VM requerido
const TIPO_MIN_ROL = {
  'conversacion':   'VM_MINISTERIO_CONVERSACION',
  'revisita':       'VM_MINISTERIO_REVISITA',
  'escenificacion': 'VM_MINISTERIO_ESCENIFICACION',
  'discurso':       'VM_MINISTERIO_DISCURSO',
};

// Qué rol VM se requiere para cada tipo de slot (slots estáticos)
const SLOT_ROL = {
  'presidente':              'VM_PRESIDENTE',
  'oracionApertura':         'VM_ORACION',
  'oracionCierre':           'VM_ORACION',
  'tesoros.discurso':        'VM_TESOROS',
  'tesoros.joyas':           'VM_JOYAS',
  'tesoros.lecturaBiblica':  'VM_LECTURA',
  'tesoros.lecturaBiblica.ayudante': 'VM_LECTURA',
  'vidaCristiana':           'VM_VIDA_CRISTIANA',
  'estudio.conductor':       'VM_ESTUDIO_CONDUCTOR',
  // ministerio: dinámico por tipo (ver getRolParaSlot)
  // estudio.lector: lo gestiona el módulo Asignaciones
};

// ─────────────────────────────────────────
//   ESTADO
// ─────────────────────────────────────────
let congreId    = null;
let congreNombre = null;
let pinVM       = null;
let publicadores = [];
let semanaData  = null;  // programa de la semana actualmente cargada/editada
let _semanaModificada = false;
let modoEncargado = false;
let vmInitReady = false;
let tieneAuxiliar = false;
let presidenteEsOradorFinal = false;
let semanasLista      = [];  // cache para navegación encargado (orden desc)
let pubFecha          = null; // fecha activa en vista pública
let vmEspeciales      = {};   // { 'YYYY-MM-DD' (lunes) → { tipo, fechaEvento } }
let vmScriptUrl       = null; // Apps Script URL para exportar a Sheets
let vmMesesCache      = {};   // { 'YYYY-MM': { encargadoSalaAuxId } }
let vmPublicadoresLoaded = false;
let vmEspecialesLoaded = false;
let vmMirrorSyncStarted = false;

function privateModuleConfigRef() {
  return doc(db, 'congregaciones', congreId, 'config_privada', 'modulos');
}

function vmMesRef(mesISO) {
  return doc(db, 'congregaciones', congreId, 'vmMeses', mesISO);
}

function vmPublicConfigRef() {
  return doc(db, 'congregaciones', congreId, 'vm_config', 'publico');
}

function vmPublicadoresCol() {
  return collection(db, 'congregaciones', congreId, 'vm_publicadores');
}

function vmProgramaCol() {
  return collection(db, 'congregaciones', congreId, 'vm_programa');
}

function vmEspecialesCol() {
  return collection(db, 'congregaciones', congreId, 'vm_especiales');
}

function toPublicVmSemana(semana) {
  return {
    fecha: semana.fecha,
    cancionApertura: semana.cancionApertura || null,
    cancionIntermedia: semana.cancionIntermedia || null,
    cancionCierre: semana.cancionCierre || null,
    presidente: semana.presidente || null,
    oracionApertura: semana.oracionApertura || null,
    oracionCierre: semana.oracionCierre || null,
    tesoros: semana.tesoros || {},
    ministerio: semana.ministerio || [],
    vidaCristiana: semana.vidaCristiana || [],
    estudioBiblico: semana.estudioBiblico || {},
    updatedAt: Date.now(),
  };
}

async function syncVmPublicConfig() {
  await setDoc(vmPublicConfigRef(), {
    nombre: congreNombre || congreId,
    tieneAuxiliar: tieneAuxiliar === true,
    updatedAt: Date.now(),
  });
}

async function replaceVmPublicadores() {
  const existing = await getDocs(vmPublicadoresCol());
  if (!existing.empty) {
    for (let i = 0; i < existing.docs.length; i += 400) {
      const batch = writeBatch(db);
      existing.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  for (let i = 0; i < publicadores.length; i += 400) {
    const batch = writeBatch(db);
    publicadores.slice(i, i + 400).forEach(p => {
      batch.set(doc(db, 'congregaciones', congreId, 'vm_publicadores', String(p.id)), {
        id: String(p.id),
        nombre: p.nombre || '',
      });
    });
    await batch.commit();
  }
}

async function replaceVmEspecialesPublicos() {
  const existing = await getDocs(vmEspecialesCol());
  if (!existing.empty) {
    for (let i = 0; i < existing.docs.length; i += 400) {
      const batch = writeBatch(db);
      existing.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  const entries = Object.entries(vmEspeciales);
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([fecha, esp]) => {
      batch.set(doc(db, 'congregaciones', congreId, 'vm_especiales', fecha), {
        tipo: esp?.tipo || null,
        fechaEvento: esp?.fechaEvento || null,
      });
    });
    await batch.commit();
  }
}

async function syncVmProgramaCompleto() {
  const snap = await getDocs(collection(db, 'congregaciones', congreId, 'vidaministerio'));
  const semanas = snap.docs
    .map(d => d.data())
    .filter(s => s?.fecha && /^\d{4}-\d{2}-\d{2}$/.test(s.fecha));

  const existing = await getDocs(vmProgramaCol());
  if (!existing.empty) {
    for (let i = 0; i < existing.docs.length; i += 400) {
      const batch = writeBatch(db);
      existing.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  for (let i = 0; i < semanas.length; i += 400) {
    const batch = writeBatch(db);
    semanas.slice(i, i + 400).forEach(s => {
      batch.set(doc(db, 'congregaciones', congreId, 'vm_programa', s.fecha), toPublicVmSemana(s));
    });
    await batch.commit();
  }
}

const VM_TIPO_LABELS = {
  conmemoracion:   'Conmemoración',
  superintendente: 'Visita superintendente',
  asamblea:        'Asamblea',
};
const VM_TIPO_COLORS = {
  conmemoracion:   '#E8C94A',
  superintendente: '#7F77DD',
  asamblea:        '#F09595',
};

// ─────────────────────────────────────────
//   UTILS
// ─────────────────────────────────────────
// fmtDateLocal disponible como global desde ui-utils.js
const fmtDate = fmtDateLocal;

// Normaliza cualquier formato de fecha a YYYY-MM-DD
function parseFechaIso(f) {
  if (!f) return lunesDeHoy();
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  // Formato DD/MM/YYYY (legacy)
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) {
    const [dd, mm, yyyy] = f.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return lunesDeHoy();
}

function fmtDisplay(iso) {
  iso = parseFechaIso(iso);
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDisplaySemana(iso) {
  const dias = ['dom','lun','mar','mié','jue','vie','sáb'];
  const d = new Date(iso + 'T12:00:00');
  return `${dias[d.getDay()]} ${fmtDisplay(iso)}`;
}

// Muestra el día de la reunión (miércoles +2 días desde el lunes, martes +1 para superintendente)
function fmtDisplayReunion(iso, esSuper) {
  const DIAS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + (esSuper ? 1 : 2));
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}

function lunesDeDate(input) {
  const d = input instanceof Date ? new Date(input) : new Date(input + 'T12:00:00');
  const day = d.getDay(); // 0=dom, 1=lun, ..., 6=sáb
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
}

function lunesDeHoy() {
  return lunesDeDate(new Date());
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────
//   PUBLICADORES
// ─────────────────────────────────────────
function pubsConRol(rol) {
  let base = publicadores.filter(p => p.activo !== false && (p.roles || []).includes(rol));
  // Fallback a todos los activos si nadie tiene ese rol VM todavía
  if (base.length === 0) base = publicadores.filter(p => p.activo !== false);
  // Roles de solo varón: nunca incluir mujeres explícitas (sexo === 'M'),
  // ni siquiera vía fallback. Evita asignar una hermana a Lectura/Tesoros/etc.
  if (ROLES_VM_SOLO_VARON.includes(rol)) base = base.filter(p => p.sexo !== 'M');
  return base;
}

function pubNombresConRol(rol) {
  return pubsConRol(rol).map(p => p.nombre);
}

function nombreDePub(pubId) {
  if (!pubId) return null;
  const p = publicadores.find(x => x.id === pubId);
  return p ? p.nombre : null;
}

function pubIdDeNombre(nombre) {
  if (!nombre) return null;
  const p = publicadores.find(x => x.nombre === nombre);
  return p ? p.id : null;
}

// ─────────────────────────────────────────
//   DATOS DEL SLOT (getters/setters)
// ─────────────────────────────────────────
function getSlotPubId(key) {
  if (!semanaData) return null;
  const parts = key.split('.');
  switch (parts[0]) {
    case 'presidente':      return semanaData.presidente;
    case 'oracionApertura': return semanaData.oracionApertura;
    case 'oracionCierre':   return semanaData.oracionCierre;
    case 'tesoros':
      if (parts[2] === 'ayudante') return semanaData.tesoros?.[parts[1]]?.ayudante;
      return semanaData.tesoros?.[parts[1]]?.pubId;
    case 'ministerio': {
      const idx = parseInt(parts[1]);
      if (parts[2] === 'salaAux') {
        return parts[3] === 'ayudante'
          ? semanaData.ministerio?.[idx]?.salaAux?.ayudante
          : semanaData.ministerio?.[idx]?.salaAux?.pubId;
      }
      if (parts[2] === 'ayudante') return semanaData.ministerio?.[idx]?.ayudante;
      return semanaData.ministerio?.[idx]?.pubId;
    }
    case 'vidaCristiana': {
      const idx = parseInt(parts[1]);
      return semanaData.vidaCristiana?.[idx]?.pubId;
    }
    case 'estudio':
      return parts[1] === 'conductor'
        ? semanaData.estudioBiblico?.conductor
        : semanaData.estudioBiblico?.lector;
    default: return null;
  }
}

function setSlotPubId(key, pubId) {
  if (!semanaData) return;
  _marcarModificada();
  const parts = key.split('.');
  switch (parts[0]) {
    case 'presidente':      semanaData.presidente = pubId; break;
    case 'oracionApertura': semanaData.oracionApertura = pubId; break;
    case 'oracionCierre':   semanaData.oracionCierre   = pubId; break;
    case 'tesoros':
      if (!semanaData.tesoros[parts[1]]) break;
      if (parts[2] === 'ayudante') semanaData.tesoros[parts[1]].ayudante = pubId;
      else semanaData.tesoros[parts[1]].pubId = pubId;
      break;
    case 'ministerio': {
      const idx = parseInt(parts[1]);
      if (!semanaData.ministerio[idx]) break;
      if (parts[2] === 'salaAux') {
        if (!semanaData.ministerio[idx].salaAux) semanaData.ministerio[idx].salaAux = {};
        if (parts[3] === 'ayudante') semanaData.ministerio[idx].salaAux.ayudante = pubId;
        else semanaData.ministerio[idx].salaAux.pubId = pubId;
      } else if (parts[2] === 'ayudante') {
        semanaData.ministerio[idx].ayudante = pubId;
      } else {
        semanaData.ministerio[idx].pubId = pubId;
      }
      break;
    }
    case 'vidaCristiana': {
      const idx = parseInt(parts[1]);
      if (!semanaData.vidaCristiana[idx]) break;
      semanaData.vidaCristiana[idx].pubId = pubId;
      break;
    }
    case 'estudio':
      if (!semanaData.estudioBiblico) semanaData.estudioBiblico = {};
      if (parts[1] === 'conductor') semanaData.estudioBiblico.conductor = pubId;
      else semanaData.estudioBiblico.lector = pubId;
      break;
  }
}

function getRolParaSlot(key) {
  const parts = key.split('.');
  if (parts[0] === 'ministerio') {
    const idx = parseInt(parts[1]);
    const tipo = semanaData?.ministerio?.[idx]?.tipo || 'conversacion';
    return TIPO_MIN_ROL[tipo] || 'VM_MINISTERIO_CONVERSACION';
  }
  if (parts[0] === 'vidaCristiana') return SLOT_ROL['vidaCristiana'];
  return SLOT_ROL[key] || null;
}

function keyToId(key) {
  return key.replace(/\./g, '-');
}

// ─────────────────────────────────────────
//   NAVEGACIÓN
// ─────────────────────────────────────────
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.getElementById('btn-home').classList.toggle('visible', id !== 'view-cover');
}

window.goToCover = function() {
  showView('view-cover');
};

function _canBypassVMPin() {
  const u = window.currentUser;
  if (!u) return false;
  const roles = u.appRoles || (u.appRol ? [u.appRol] : []);
  return roles.some(r => ['admin_general', 'admin_congre', 'encargado_vm'].includes(r));
}

window.goToPin = function() {
  if (!vmInitReady) return;
  if (_canBypassVMPin()) {
    modoEncargado = true;
    document.getElementById('pin-modal-vm').style.display = 'none';
    goToMenuEnc();
    return;
  }
  pinBuffer = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-modal-vm').style.display = 'flex';
};

window.pinCancel = function() {
  document.getElementById('pin-modal-vm').style.display = 'none';
  pinBuffer = '';
  updatePinDots();
};

window.goToVerPrograma = async function() {
  if (!vmInitReady) return;
  uiLoading.show('Cargando…');
  await ensureVmLookupsLoaded();
  uiLoading.hide();
  pubFecha = lunesDeHoy();
  showView('view-programa-pub');
  scheduleVmMirrorSync();
  await cargarProgramaPublico();
};

window.navSemanaPublico = async function(dir) {
  const base = parseFechaIso(pubFecha);
  pubFecha = base; // normalizar antes de navegar
  const d = new Date(base + 'T12:00:00');
  d.setDate(d.getDate() + dir * 7);
  pubFecha = isNaN(d.getTime()) ? lunesDeHoy() : fmtDate(d);
  await cargarProgramaPublico();
};

window.navSemana = async function(dir) {
  if (!semanasLista.length || !semanaData) return;
  await _confirmarSiModificada();
  // semanasLista está en orden desc: dir=+1 (siguiente/más nueva) → índice menor
  const idx = semanasLista.findIndex(s => s.fecha === semanaData.fecha);
  if (idx === -1) return;
  const nextIdx = idx + (-dir);
  if (nextIdx >= 0 && nextIdx < semanasLista.length) {
    await goToSemana(semanasLista[nextIdx].fecha);
  }
};

function updateNavBtnsSemana() {
  const idx = semanasLista.findIndex(s => s.fecha === semanaData?.fecha);
  const btnPrev = document.getElementById('btn-sem-prev');
  const btnNext = document.getElementById('btn-sem-next');
  if (btnPrev) btnPrev.disabled = idx === -1 || idx >= semanasLista.length - 1;
  if (btnNext) btnNext.disabled = idx === -1 || idx <= 0;
}

window.goToMenuEnc = async function() {
  await _confirmarSiModificada();
  const sub = document.getElementById('menu-enc-congre-sub');
  if (sub) sub.textContent = congreNombre || '—';
  showView('view-menu-enc');
};

window.cerrarSesionVM = function() {
  modoEncargado = false;
  goToCover();
};

window.goToSemanas = async function() {
  await _confirmarSiModificada();
  uiLoading.show('Cargando…');
  await ensureVmLookupsLoaded();
  document.getElementById('semanas-congre-sub').textContent = congreNombre || '—';
  const btnCfg = document.getElementById('btn-config-vm');
  if (btnCfg) btnCfg.style.display = modoEncargado ? '' : 'none';
  // Ocultar sección vieja (reemplazada por botones en headers de mes)
  const exportSec = document.getElementById('vm-export-section');
  if (exportSec) exportSec.style.display = 'none';
  const btnSheetSem = document.getElementById('btn-sheet-semana');
  if (btnSheetSem) btnSheetSem.style.display = (modoEncargado && vmScriptUrl) ? '' : 'none';
  showView('view-semanas');
  uiLoading.hide();
  scheduleVmMirrorSync();
  await cargarSemanas();
};

window.goToConfig = function() {
  document.getElementById('config-aux').checked = tieneAuxiliar;
  document.getElementById('config-presidente-orador').checked = presidenteEsOradorFinal;
  showView('view-config');
};

window.guardarConfig = async function() {
  const nuevoAux      = document.getElementById('config-aux').checked;
  const nuevoPresOrad = document.getElementById('config-presidente-orador').checked;
  uiLoading.show('Guardando…');
  try {
    await setDoc(doc(db, 'congregaciones', congreId), {
      tieneAuxiliar: nuevoAux,
      presidenteEsOradorFinal: nuevoPresOrad,
    }, { merge: true });
    tieneAuxiliar           = nuevoAux;
    presidenteEsOradorFinal = nuevoPresOrad;
    await syncVmPublicConfig();
    uiLoading.hide();
    uiToast('Configuración guardada', 'success');
    goToSemanas();
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al guardar: ' + e.message);
  }
};

window.goToSemana = async function(fecha) {
  // Si ya está cargada esa semana, no recargamos
  if (!semanaData || semanaData.fecha !== fecha) {
    uiLoading.show('Cargando…');
    try {
      const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
      if (snap.exists()) {
        semanaData = snap.data();
      } else if (!semanaData) {
        uiLoading.hide();
        uiToast('No se encontró el programa para esta semana', 'error');
        return;
      }
      uiLoading.hide();
    } catch(e) {
      uiLoading.hide();
      await uiAlert('Error al cargar: ' + e.message);
      return;
    }
  }
  _semanaModificada = false;
  document.getElementById('semana-titulo-display').textContent = 'Semana del ' + fmtDisplay(semanaData.fecha);
  renderSemanaEdit();
  showView('view-semana');
  updateNavBtnsSemana();
};

window.switchVmTab = function(tabName) {
  document.querySelectorAll('.vm-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
  document.querySelectorAll('.vm-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.tab === tabName));
};

function norm(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

window.goToNueva = function() {
  // Fecha sugerida: semana siguiente a la última cargada, o semana actual si no hay ninguna
  let fecha;
  if (semanasLista.length > 0) {
    const ultima = semanasLista[0].fecha; // orden desc → [0] es la más reciente
    const d = new Date(ultima + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    fecha = fmtDate(d);
  } else {
    fecha = lunesDeHoy();
  }
  const fechaEl = document.getElementById('nueva-fecha');
  fechaEl.value = fecha;
  fechaEl.dispatchEvent(new Event('change', { bubbles: true }));
  switchVmTab('generar');
};

// ─────────────────────────────────────────
//   PIN
// ─────────────────────────────────────────
let pinBuffer = '';

window.pinPress = function(d) {
  if (pinBuffer.length >= 4) return;
  pinBuffer += d;
  updatePinDots();
  if (pinBuffer.length === 4) setTimeout(checkPin, 150);
};

window.pinDelete = function() {
  pinBuffer = pinBuffer.slice(0, -1);
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
};

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    document.getElementById('vp' + i).classList.toggle('filled', i < pinBuffer.length);
  }
}

function checkPin() {
  if (pinBuffer === pinVM) {
    modoEncargado = true;
    pinBuffer = '';
    updatePinDots();
    document.getElementById('pin-modal-vm').style.display = 'none';
    goToMenuEnc();
  } else {
    document.getElementById('pin-error').textContent = 'PIN incorrecto';
    pinBuffer = '';
    updatePinDots();
  }
}

// ─────────────────────────────────────────
//   CARGA DE DATOS
// ─────────────────────────────────────────
async function cargarPublicadores(syncMirror = true) {
  try {
    const snap = await getDocs(collection(db, 'congregaciones', congreId, 'publicadores'));
    publicadores = [];
    snap.forEach(d => publicadores.push({ id: d.id, ...d.data() }));
    publicadores.sort((a, b) =>
      (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' })
    );
    vmPublicadoresLoaded = true;
    if (syncMirror) await replaceVmPublicadores();
  } catch(e) {
    console.error('Error al cargar publicadores:', e);
  }
}

async function cargarSemanas() {
  const list = document.getElementById('semanas-list');
  list.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';
  try {
    const q = query(
      collection(db, 'congregaciones', congreId, 'vidaministerio'),
      orderBy('fecha', 'desc')
    );
    const snap = await getDocs(q);
    const semanas = [];
    snap.forEach(d => {
      const data = d.data();
      // Filtrar docs con fecha inválida (formato esperado: YYYY-MM-DD)
      if (data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) {
        semanas.push(data);
      }
    });
    semanasLista = semanas;

    // Precargar encargados de sala aux de todos los meses visibles
    if (modoEncargado && tieneAuxiliar && semanas.length) {
      const meses = [...new Set(semanas.map(s => s.fecha.slice(0, 7)))];
      await Promise.all(meses.map(async mes => {
        if (vmMesesCache[mes]) return;
        try {
          const sn = await getDoc(vmMesRef(mes));
          vmMesesCache[mes] = sn.exists() ? sn.data() : {};
        } catch { vmMesesCache[mes] = {}; }
      }));
    }

    renderSemanas(semanas);
  } catch(e) {
    list.innerHTML = `<div class="error-wrap">Error al cargar: ${e.message}</div>`;
  }
}

async function cargarProgramaPublico() {
  let fecha = parseFechaIso(pubFecha);
  pubFecha = fecha; // siempre normalizar
  const el = document.getElementById('pub-contenido');
  document.getElementById('pub-semana-titulo').textContent = 'Semana del ' + fmtDisplay(fecha);
  el.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';
  try {
    const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
    const banner = vmBannerHtml(fecha);
    if (!snap.exists()) {
      el.innerHTML = banner + '<div class="empty-state">No hay programa cargado para esta semana.<br><span style="color:#3a3a3a;">El encargado todavía no lo subió.</span></div>';
      return;
    }
    el.innerHTML = banner + renderSemanaPublico(snap.data());
  } catch(e) {
    el.innerHTML = `<div class="error-wrap">Error: ${e.message}</div>`;
  }
}

// ─────────────────────────────────────────
//   RENDER — LISTA DE SEMANAS
// ─────────────────────────────────────────
function calcCompletitud(s) {
  // Usa los mismos slots que el auto-assign → siempre en sintonía con la realidad
  // (incluye ayudantes, sala auxiliar, y respeta tipo discurso vs otros)
  const slots = construirSlotsOrdenados(s);
  let filled = 0;
  for (const slot of slots) {
    if (getSlotPubIdFromSemana(s, slot.key)) filled++;
  }
  const total = slots.length;
  if (filled === 0) return { clase: 'vacia', texto: 'Sin asignaciones' };
  if (filled === total) return { clase: 'completa', texto: 'Completa ✓' };
  return { clase: 'parcial', texto: `${filled}/${total} asignados` };
}

async function cargarVmEspeciales(syncMirror = true) {
  try {
    const snap = await getDocs(collection(db, 'congregaciones', congreId, 'semanasEspeciales'));
    vmEspeciales = {};
    snap.forEach(d => { vmEspeciales[d.id] = d.data(); });
    vmEspecialesLoaded = true;
    if (syncMirror) await replaceVmEspecialesPublicos();
  } catch(e) {
    console.error('Error cargando especiales VM:', e);
  }
}

async function ensureVmLookupsLoaded() {
  const tasks = [];
  if (!vmPublicadoresLoaded) tasks.push(cargarPublicadores(false));
  if (!vmEspecialesLoaded) tasks.push(cargarVmEspeciales(false));
  if (tasks.length) await Promise.all(tasks);
}

function scheduleVmMirrorSync() {
  if (vmMirrorSyncStarted || !vmInitReady) return;
  vmMirrorSyncStarted = true;
  window.setTimeout(async () => {
    try {
      await syncVmPublicConfig();
      await Promise.all([
        replaceVmPublicadores(),
        replaceVmEspecialesPublicos(),
        syncVmProgramaCompleto(),
      ]);
    } catch (e) {
      console.error('Error sincronizando espejo público VM:', e);
    }
  }, 0);
}

function vmBannerHtml(fecha) {
  const esp = vmEspeciales[fecha];
  if (!esp) return '';
  const color = VM_TIPO_COLORS[esp.tipo] || '#eee';
  const label = VM_TIPO_LABELS[esp.tipo] || esp.tipo;
  let msg = label;
  if (esp.tipo === 'asamblea')         msg += ' — no hay reuniones esta semana';
  if (esp.tipo === 'superintendente')  msg += ' — reunión el martes · sábado sin lector';
  if (esp.tipo === 'conmemoracion') {
    const dow = new Date(esp.fechaEvento + 'T12:00:00').getDay();
    msg += (dow === 6 || dow === 0) ? ' — sin reunión de fin de semana' : ' — sin reunión de entre semana';
  }
  return `<div class="vm-especial-banner" style="border-left-color:${color};background:${color}18;">
    <span style="color:${color};font-weight:700;">⚠ ${msg}</span>
  </div>`;
}

function renderSemanaCard(s, lunes) {
  const c        = calcCompletitud(s);
  const esp      = vmEspeciales[s.fecha];
  const esActual = s.fecha === lunes;
  const esSuper  = esp?.tipo === 'superintendente';

  // Conmemoración / Asamblea: card simplificada
  if (esp?.tipo === 'conmemoracion' || esp?.tipo === 'asamblea') {
    const labelEsp = esp.tipo === 'asamblea' ? 'Asamblea' : 'Conmemoración';
    const cardColor = VM_TIPO_COLORS[esp.tipo] || '#eee';
    return `
    <div class="semana-card semana-card-conmem${esActual ? ' semana-actual' : ''}" style="border-color:${cardColor}44;background:${cardColor}0a;" onclick="goToSemana('${s.fecha}')">
      <div class="semana-card-top">
        <div class="semana-fecha">${fmtDisplayReunion(s.fecha, false)}</div>
        <button class="btn-del-semana" onclick="event.stopPropagation(); eliminarSemana('${s.fecha}')" title="Eliminar semana">×</button>
      </div>
      <div class="semana-conmem-label" style="color:${cardColor};">${labelEsp}</div>
    </div>`;
  }

  const espColor = esp ? (VM_TIPO_COLORS[esp.tipo] || '#eee') : null;
  const espBadge = esp
    ? `<span class="badge-especial" style="background:${espColor}22;color:${espColor};">${VM_TIPO_LABELS[esp.tipo] || esp.tipo}</span>`
    : '';
  const actualBadge = esActual ? '<span class="badge-actual">esta semana</span>' : '';
  const pNombre = nombreDePub(s.presidente);
  const pRow = pNombre
    ? `<div class="semana-mini-row has-data">👤 ${esc(pNombre)}</div>`
    : `<div class="semana-mini-row">👤 Sin presidente</div>`;

  const estadoHtml = c.clase === 'completa'
    ? `<span class="estado-asignado">✓ Asignado</span>`
    : `<div class="estado-${c.clase}">${c.texto}</div>`;

  return `
    <div class="semana-card${esActual ? ' semana-actual' : ''}" onclick="goToSemana('${s.fecha}')">
      <div class="semana-card-top">
        <div class="semana-fecha">${fmtDisplayReunion(s.fecha, esSuper)}</div>
        <button class="btn-del-semana" onclick="event.stopPropagation(); eliminarSemana('${s.fecha}')" title="Eliminar semana">×</button>
      </div>
      <div class="semana-card-badges">${actualBadge}${espBadge}</div>
      <div class="semana-card-meta">${pRow}</div>
      ${estadoHtml}
    </div>`;
}

function renderSemanas(semanas) {
  const list = document.getElementById('semanas-list');
  if (!semanas.length) {
    list.innerHTML = '<div class="empty-state">No hay semanas todavía.<br>Tocá <strong>+ Nueva semana</strong> para empezar.</div>';
    return;
  }
  const hoy = lunesDeHoy();

  // Agrupar por mes (desc)
  const grupos = {};
  semanas.forEach(s => {
    const key = s.fecha.substring(0, 7);
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(s);
  });
  const mesesDesc = Object.keys(grupos).sort().reverse();

  list.innerHTML = mesesDesc.map(key => {
    const [y, m] = key.split('-');
    const label  = `${MESES_ES[parseInt(m) - 1]} ${y}`;
    const cards  = grupos[key].map(s => renderSemanaCard(s, hoy)).join('');

    let acciones = '';
    if (modoEncargado) {
      if (tieneAuxiliar) {
        const auxId  = vmMesesCache[key]?.encargadoSalaAuxId;
        const auxNom = auxId ? (nombreDePub(auxId) || '…') : 'Sala aux';
        acciones += `<button class="vm-mes-aux-btn" onclick="abrirPickerAuxMes('${key}')" title="Encargado Sala Auxiliar del mes">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0112 0v1"/></svg>
          <span id="aux-mes-${key}">${esc(auxNom)}</span>
        </button>`;
      }
      if (vmScriptUrl) {
        acciones += `<button class="vm-mes-action-btn vm-mes-sheets-btn" onclick="exportarMesASheets('${key}')" title="Exportar a Sheets">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Sheets
        </button>`;
      }
      acciones += `<button class="vm-mes-action-btn vm-mes-img-btn" onclick="exportarMesImagen('${key}')" title="Exportar como imagen">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        Img
      </button>`;
      acciones += `<button class="vm-mes-action-btn vm-mes-s89-btn" onclick="generarS89('${key}')" title="Formulario S-89">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        S-89
      </button>`;
    }

    return `<div class="semanas-mes-hdr-row">
      <span class="semanas-mes-hdr-txt">${label}</span>
      ${acciones ? `<div class="semanas-mes-acciones">${acciones}</div>` : ''}
    </div>
    <div class="semanas-mes-grid">${cards}</div>`;
  }).join('');
}

window.eliminarSemanaActual = function() {
  if (semanaData?.fecha) eliminarSemana(semanaData.fecha);
};

window.eliminarSemana = async function(fecha) {
  const ok = await uiConfirm({
    title: 'Eliminar semana',
    msg: `¿Eliminar el programa de la semana del ${fmtDisplay(fecha)}? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar',
    cancelText: 'Cancelar',
    type: 'danger',
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
    await deleteDoc(doc(db, 'congregaciones', congreId, 'vm_programa', fecha));
    semanasLista = semanasLista.filter(s => s.fecha !== fecha);
    _invalidarVmStats();
    renderSemanas(semanasLista);
    uiToast('Semana eliminada', 'success');
  } catch(e) {
    uiToast('Error al eliminar: ' + e.message, 'error');
  }
};

// ─────────────────────────────────────────
//   RENDER — PROGRAMA PÚBLICO (solo lectura)
// ─────────────────────────────────────────
function renderSemanaPublico(s) {
  const row = (titulo, pubId, extra) => {
    const nombre = nombreDePub(pubId);
    return `<div class="pub-parte-row">
      <div class="pub-parte-titulo">${esc(titulo)}</div>
      <div class="pub-parte-nombre">${nombre ? esc(nombre) : '<span class="pub-parte-sin">—</span>'}${extra || ''}</div>
    </div>`;
  };

  let html = '';

  // Presidencia
  html += `<div class="pub-seccion">
    <div class="pub-seccion-hdr">Presidencia</div>
    ${row('Presidente', s.presidente)}
    ${row('Oración apertura', s.oracionApertura)}
    ${row('Oración cierre', s.oracionCierre)}
  </div>`;

  // Canciones
  const cancionStr = [s.cancionApertura, s.cancionIntermedia, s.cancionCierre]
    .map((c, i) => c ? `${['Ap.','Int.','Cie.'][i]} ${c}` : null).filter(Boolean).join(' · ');
  if (cancionStr) {
    html += `<div style="font-size:12px;color:#555;margin-bottom:14px;padding-left:1px;">${cancionStr}</div>`;
  }

  // Tesoros
  const lect = s.tesoros?.lecturaBiblica;
  let lectRow;
  if (tieneAuxiliar && lect?.ayudante) {
    const lNombre    = nombreDePub(lect.pubId);
    const lAuxNombre = nombreDePub(lect.ayudante);
    lectRow = `<div class="pub-parte-row">
      <div class="pub-parte-titulo">${esc(lect.titulo || 'Lectura Bíblica')}</div>
      <div class="pub-parte-nombre" style="text-align:right;">
        ${lNombre   ? `<div>${esc(lNombre)}</div>`   : '<div><span class="pub-parte-sin">—</span></div>'}
        ${lAuxNombre ? `<div style="font-size:11px;color:#888;">${esc(lAuxNombre)}</div>` : ''}
      </div>
    </div>`;
  } else {
    lectRow = row(lect?.titulo || 'Lectura Bíblica', lect?.pubId);
  }
  html += `<div class="pub-seccion">
    <div class="pub-seccion-hdr">1. Tesoros de la Palabra de Dios</div>
    ${row(s.tesoros?.discurso?.titulo || 'Discurso', s.tesoros?.discurso?.pubId)}
    ${row(s.tesoros?.joyas?.titulo || 'Perlas escondidas', s.tesoros?.joyas?.pubId)}
    ${lectRow}
  </div>`;

  // Ministerio
  if (s.ministerio?.length) {
    const minRows = s.ministerio.map(p => {
      const nombre   = nombreDePub(p.pubId);
      const ayNombre = nombreDePub(p.ayudante);
      const mainStr  = nombre
        ? esc(nombre) + (ayNombre ? ` / ${esc(ayNombre)}` : '')
        : (ayNombre ? esc(ayNombre) : null);
      let auxStr = null;
      if (tieneAuxiliar && p.salaAux?.pubId) {
        const auxN   = nombreDePub(p.salaAux.pubId);
        const auxAyN = nombreDePub(p.salaAux.ayudante);
        if (auxN) auxStr = esc(auxN) + (auxAyN ? ` / ${esc(auxAyN)}` : '');
      }
      return `<div class="pub-parte-row">
        <div class="pub-parte-titulo">${esc(p.titulo || 'Parte')}</div>
        <div class="pub-parte-nombre" style="text-align:right;">
          ${mainStr ? `<div>${mainStr}</div>` : '<div><span class="pub-parte-sin">—</span></div>'}
          ${auxStr  ? `<div style="font-size:11px;color:#888;">${auxStr}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    html += `<div class="pub-seccion">
      <div class="pub-seccion-hdr">2. Seamos Mejores Maestros</div>
      ${minRows}
    </div>`;
  }

  // Vida Cristiana
  const vcPartes = (s.vidaCristiana || []).map(p => row(p.titulo || 'Parte', p.pubId)).join('');
  const estudio = s.estudioBiblico;
  const estudioHtml = estudio ? `<div class="pub-parte-row">
    <div class="pub-parte-titulo">${esc(estudio.titulo || 'Estudio Bíblico')}</div>
    <div class="pub-parte-nombre" style="text-align:right;">
      ${estudio.conductor ? `<div>${esc(nombreDePub(estudio.conductor) || '—')}</div>` : '<div class="pub-parte-sin">—</div>'}
      ${estudio.lector ? `<div style="font-size:11px;color:#888;">Lec. ${esc(nombreDePub(estudio.lector) || '')}</div>` : ''}
    </div>
  </div>` : '';
  html += `<div class="pub-seccion">
    <div class="pub-seccion-hdr">3. Nuestra Vida Cristiana</div>
    ${vcPartes}${estudioHtml}
  </div>`;

  return html;
}

// ─────────────────────────────────────────
//   RENDER — PROGRAMA EDITABLE
// ─────────────────────────────────────────
function renderAsigRow(label, key, pubId) {
  const nombre = nombreDePub(pubId);
  return `<div class="asig-row">
    <span class="asig-label">${label}</span>
    <button class="asignar-btn${nombre ? '' : ' empty'}" onclick="asignarSlot('${key}')">
      <span class="asig-icon">👤</span>
      <span id="asig-${keyToId(key)}">${nombre ? esc(nombre) : 'Asignar'}</span>
    </button>
  </div>`;
}

function renderAsigBtn(key, pubId, defaultLabel) {
  const nombre = nombreDePub(pubId);
  return `<button class="asignar-btn${nombre ? '' : ' empty'}" onclick="asignarSlot('${key}')">
    <span class="asig-icon">👤</span>
    <span id="asig-${keyToId(key)}">${nombre ? esc(nombre) : defaultLabel}</span>
  </button>`;
}

function renderParteItem(key, label, parte, opts = {}) {
  const quitar = opts.onRemove
    ? `<button class="btn-quitar-parte" onclick="${opts.onRemove}" title="Quitar">×</button>`
    : '';
  const dur = parte?.duracion ? `<span class="parte-dur-badge">${parte.duracion} min</span>` : '';

  // Discurso de ministerio con sala auxiliar: una persona por sala, sin ayudante
  const esMinisterio = key.startsWith('ministerio.');
  const spLabel = (tieneAuxiliar && esMinisterio)
    ? `<div class="sala-divider"><span>Sala Principal</span></div>` : '';
  const auxHtml = (tieneAuxiliar && esMinisterio)
    ? `<div class="sala-divider"><span>Sala Auxiliar</span></div>
       ${renderAsigBtn(key + '.salaAux', parte?.salaAux?.pubId, 'Asignar hermano')}`
    : '';

  // Para ministerio: input editable muestra la instrucción (referencia de WOL).
  // Para tesoros/vidaCristiana: muestra el título.
  const inputValue   = esMinisterio ? (parte?.instruccion || '') : (parte?.titulo || '');
  const inputHandler = esMinisterio ? `onInstruccionChange('${key}', this.value)` : `onTituloChange('${key}', this.value)`;
  const inputPlaceholder = esMinisterio ? 'Instrucciones…' : 'Título de la parte…';

  return `<div class="parte-item">
    <div class="parte-meta-row">
      <span class="parte-label-text">${label}</span>${dur}${quitar}
    </div>
    ${renderTipoInstruccionHtml(key, parte)}
    <input class="parte-titulo-input" type="text"
           placeholder="${inputPlaceholder}"
           value="${esc(inputValue)}"
           oninput="${inputHandler}">
    ${spLabel}
    ${renderAsigBtn(key, parte?.pubId, 'Asignar hermano')}
    ${auxHtml}
  </div>`;
}

function renderParteItemConAyudante(key, label, parte, opts = {}) {
  const ayKey       = key + '.ayudante';
  const quitar      = opts.onRemove
    ? `<button class="btn-quitar-parte" onclick="${opts.onRemove}" title="Quitar">×</button>`
    : '';
  const dur         = parte?.duracion ? `<span class="parte-dur-badge">${parte.duracion} min</span>` : '';
  const isMinisterio = key.startsWith('ministerio.');

  // Cuando hay sala auxiliar, etiquetar la sala principal explícitamente
  const spLabel  = tieneAuxiliar ? `<div class="sala-divider"><span>Sala Principal</span></div>` : '';
  // Para lectura bíblica: el botón "ayudante" se convierte en "Sala Auxiliar"
  const ayLabel  = (tieneAuxiliar && !isMinisterio) ? 'Sala Auxiliar' : '+ Ayudante';

  // Para ministerio: bloque extra con dos pickers para la sala auxiliar
  let auxHtml = '';
  if (tieneAuxiliar && isMinisterio) {
    const auxKey   = key + '.salaAux';
    const auxAyKey = auxKey + '.ayudante';
    auxHtml = `
      <div class="sala-divider"><span>Sala Auxiliar</span></div>
      <div class="asig-double-row">
        ${renderAsigBtn(auxKey, parte?.salaAux?.pubId, 'Asignar hermano')}
        ${renderAsigBtn(auxAyKey, parte?.salaAux?.ayudante, '+ Ayudante')}
      </div>`;
  }

  return `<div class="parte-item">
    <div class="parte-meta-row">
      <span class="parte-label-text">${label}</span>${dur}${quitar}
    </div>
    ${renderTipoInstruccionHtml(key, parte)}
    <input class="parte-titulo-input" type="text"
           placeholder="${isMinisterio ? 'Instrucciones…' : 'Título de la parte…'}"
           value="${esc(isMinisterio ? (parte?.instruccion || '') : (parte?.titulo || ''))}"
           oninput="${isMinisterio ? `onInstruccionChange('${key}', this.value)` : `onTituloChange('${key}', this.value)`}">
    ${spLabel}
    <div class="asig-double-row">
      ${renderAsigBtn(key, parte?.pubId, 'Asignar hermano')}
      ${renderAsigBtn(ayKey, parte?.ayudante, ayLabel)}
    </div>
    ${auxHtml}
  </div>`;
}

function renderSemanaEdit() {
  if (!semanaData) return;
  const s = semanaData;
  let html = vmBannerHtml(s.fecha);

  // ── Canciones y Presidencia
  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-general">
      <span class="seccion-hdr-icon">♪</span> Canciones y Presidencia
    </div>
    <div class="canciones-row">
      <div class="cancion-item">
        <label>Apertura</label>
        <input type="number" min="1" max="150" class="cancion-input"
               value="${s.cancionApertura || ''}"
               placeholder="Nro"
               oninput="onTituloChange('cancion.apertura', this.value)">
      </div>
      <div class="cancion-item">
        <label>Intermedia</label>
        <input type="number" min="1" max="150" class="cancion-input"
               value="${s.cancionIntermedia || ''}"
               placeholder="Nro"
               oninput="onTituloChange('cancion.intermedia', this.value)">
      </div>
      <div class="cancion-item">
        <label>Cierre</label>
        <input type="number" min="1" max="150" class="cancion-input"
               value="${s.cancionCierre || ''}"
               placeholder="Nro"
               oninput="onTituloChange('cancion.cierre', this.value)">
      </div>
    </div>
    ${renderAsigRow('Presidente', 'presidente', s.presidente)}
    ${renderAsigRow('Oración apertura', 'oracionApertura', s.oracionApertura)}
    ${renderAsigRow('Oración cierre', 'oracionCierre', s.oracionCierre)}
  </div>`;

  // ── Tesoros
  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-tesoros">
      <span class="seccion-hdr-num">1</span> Tesoros de la Palabra de Dios
    </div>
    ${renderParteItem('tesoros.discurso', 'Discurso', s.tesoros?.discurso)}
    ${renderParteItem('tesoros.joyas', 'Perlas escondidas', s.tesoros?.joyas)}
    ${renderParteItemConAyudante('tesoros.lecturaBiblica', 'Lectura Bíblica', s.tesoros?.lecturaBiblica)}
  </div>`;

  // ── Ministerio
  // tipo === 'discurso' → 1 participante (sin ayudante)
  const minPartes = (s.ministerio || []).map((p, i) => {
    const key  = `ministerio.${i}`;
    const opts = { onRemove: `quitarParte('ministerio',${i})` };
    return p.tipo === 'discurso'
      ? renderParteItem(key, `Parte ${i + 1}`, p, opts)
      : renderParteItemConAyudante(key, `Parte ${i + 1}`, p, opts);
  }).join('');
  const btnAddMin = s.ministerio?.length < 4
    ? `<button class="btn-agregar-parte" onclick="agregarParte('ministerio')">+ Agregar parte</button>` : '';
  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-ministerio">
      <span class="seccion-hdr-num">2</span> Seamos Mejores Maestros
    </div>
    ${minPartes}${btnAddMin}
  </div>`;

  // ── Vida Cristiana
  const vcPartes = (s.vidaCristiana || []).map((p, i) =>
    renderParteItem(
      `vidaCristiana.${i}`, `Parte ${i + 1}`, p,
      { onRemove: `quitarParte('vidaCristiana',${i})` }
    )
  ).join('');
  const btnAddVC = (s.vidaCristiana?.length || 0) < 3
    ? `<button class="btn-agregar-parte" onclick="agregarParte('vidaCristiana')">+ Agregar parte</button>` : '';

  const est = s.estudioBiblico || {};
  const estudioHtml = `<div class="parte-item estudio-item">
    <div class="parte-meta-row">
      <span class="parte-label-text">Estudio Bíblico Congregacional</span>
      <span class="parte-dur-badge">30 min</span>
    </div>
    <input class="parte-titulo-input" type="text"
           placeholder="Libro/capítulo o tema…"
           value="${esc(est.titulo || '')}"
           oninput="onTituloChange('estudio', this.value)">
    <div class="asig-double-row">
      ${renderAsigBtn('estudio.conductor', est.conductor, 'Conductor')}
      ${renderAsigBtn('estudio.lector', est.lector, 'Lector')}
    </div>
  </div>`;

  html += `<div class="seccion-bloque">
    <div class="seccion-hdr hdr-vida">
      <span class="seccion-hdr-num">3</span> Nuestra Vida Cristiana
    </div>
    ${vcPartes}${btnAddVC}${estudioHtml}
  </div>`;

  html += `<div style="height:2rem;"></div>`;

  document.getElementById('semana-content').innerHTML = html;
}

// ─────────────────────────────────────────
//   EDICIÓN — HANDLERS
// ─────────────────────────────────────────
window.onTituloChange = function(key, value) {
  if (!semanaData) return;
  _marcarModificada();
  const parts = key.split('.');
  if (parts[0] === 'cancion') {
    const campo = { apertura: 'cancionApertura', intermedia: 'cancionIntermedia', cierre: 'cancionCierre' }[parts[1]];
    if (campo) semanaData[campo] = parseInt(value) || null;
  } else if (parts[0] === 'tesoros') {
    if (semanaData.tesoros?.[parts[1]]) semanaData.tesoros[parts[1]].titulo = value;
  } else if (parts[0] === 'ministerio') {
    const idx = parseInt(parts[1]);
    if (semanaData.ministerio?.[idx]) semanaData.ministerio[idx].titulo = value;
  } else if (parts[0] === 'vidaCristiana') {
    const idx = parseInt(parts[1]);
    if (semanaData.vidaCristiana?.[idx]) semanaData.vidaCristiana[idx].titulo = value;
  } else if (parts[0] === 'estudio') {
    if (!semanaData.estudioBiblico) semanaData.estudioBiblico = {};
    semanaData.estudioBiblico.titulo = value;
  }
};

window.onInstruccionChange = function(key, value) {
  if (!semanaData) return;
  _marcarModificada();
  const parts = key.split('.');
  if (parts[0] === 'ministerio') {
    const idx = parseInt(parts[1]);
    if (semanaData.ministerio?.[idx]) semanaData.ministerio[idx].instruccion = value;
  }
};

window.asignarSlot = async function(key) {
  const rol = getRolParaSlot(key);
  const conductores = rol ? pubNombresConRol(rol) : publicadores.filter(p => p.activo !== false).map(p => p.nombre);
  const currentId = getSlotPubId(key);
  const currentNombre = nombreDePub(currentId) || '';

  const result = await uiConductorPicker({ conductores, value: currentNombre, label: 'Asignar hermano' });
  if (result === null) return;

  const pubId = result ? pubIdDeNombre(result) : null;
  setSlotPubId(key, pubId);

  // Actualizar solo el texto del botón (sin re-render completo)
  const el = document.getElementById('asig-' + keyToId(key));
  if (el) {
    el.textContent = result || (key.includes('ayudante') ? '+ Ayudante' : (key === 'estudio.lector' ? 'Lector' : key === 'estudio.conductor' ? 'Conductor' : 'Asignar hermano'));
    el.closest('.asignar-btn')?.classList.toggle('empty', !result);
  }
};

window.agregarParte = function(seccion) {
  if (!semanaData) return;
  _marcarModificada();
  if (seccion === 'ministerio') {
    if ((semanaData.ministerio?.length || 0) >= 4) { uiToast('Máximo 4 partes en esta sección', 'error'); return; }
    semanaData.ministerio = semanaData.ministerio || [];
    semanaData.ministerio.push({ titulo: '', tipo: 'conversacion', duracion: null, pubId: null, ayudante: null });
  } else if (seccion === 'vidaCristiana') {
    if ((semanaData.vidaCristiana?.length || 0) >= 3) { uiToast('Máximo 3 partes en esta sección', 'error'); return; }
    semanaData.vidaCristiana = semanaData.vidaCristiana || [];
    semanaData.vidaCristiana.push({ titulo: '', tipo: 'parte', duracion: null, pubId: null });
  }
  renderSemanaEdit();
};

window.quitarParte = function(seccion, idx) {
  if (!semanaData) return;
  _marcarModificada();
  if (seccion === 'ministerio') {
    if ((semanaData.ministerio?.length || 0) <= 1) { uiToast('Debe haber al menos una parte', 'error'); return; }
    semanaData.ministerio.splice(idx, 1);
  } else if (seccion === 'vidaCristiana') {
    semanaData.vidaCristiana = semanaData.vidaCristiana || [];
    semanaData.vidaCristiana.splice(idx, 1);
  }
  renderSemanaEdit();
};

function _marcarModificada() {
  _semanaModificada = true;
  const btn = document.querySelector('#vm-action-bar .btn-primary');
  if (btn) btn.textContent = 'Guardar *';
}

function _resetModificada() {
  _semanaModificada = false;
  const btn = document.querySelector('#vm-action-bar .btn-primary');
  if (btn) btn.textContent = 'Guardar';
}

async function _confirmarSiModificada() {
  if (!_semanaModificada) return true;
  const resp = await uiConfirm({
    title: '¿Guardar cambios?',
    msg: 'Hay cambios sin guardar en esta semana.',
    confirmText: 'Guardar',
    cancelText: 'Descartar',
    type: 'warn',
  });
  if (resp) await window.guardarSemana();
  _semanaModificada = false;
  return true;
}

// ─────────────────────────────────────────
//   VALIDACIÓN PRE-GUARDADO — Mejora A
// ─────────────────────────────────────────
function _slotLabel(semana, key) {
  const parts = key.split('.');
  switch (parts[0]) {
    case 'presidente':      return 'Presidente';
    case 'oracionApertura': return 'Oración apertura';
    case 'oracionCierre':   return 'Oración cierre';
    case 'tesoros':
      if (parts[1] === 'discurso') return 'Tesoros · Discurso';
      if (parts[1] === 'joyas')    return 'Perlas escondidas';
      if (parts[1] === 'lecturaBiblica')
        return parts[2] === 'ayudante' ? 'Lectura Bíblica (sala aux.)' : 'Lectura Bíblica';
      return key;
    case 'ministerio': {
      const idx = parseInt(parts[1]);
      let base = `Ministerio ${idx + 1}`;
      if (parts[2] === 'salaAux') base += parts[3] === 'ayudante' ? ' (sala aux. ayud.)' : ' (sala aux.)';
      else if (parts[2] === 'ayudante') base += ' (ayudante)';
      return base;
    }
    case 'vidaCristiana': return `Vida Cristiana ${parseInt(parts[1]) + 1}`;
    case 'estudio':       return 'Conductor del estudio';
    default: return key;
  }
}

// Devuelve { vacios:[], repetidos:[], sexo:[], noDisp:[] } con labels de slots problemáticos.
function _validarSemana(semana) {
  const slots = construirSlotsOrdenados(semana);
  const vacios = [], sexo = [], noDisp = [];
  const porPub = {}; // pubId → [labels]

  for (const slot of slots) {
    const pubId = getSlotPubIdFromSemana(semana, slot.key);
    const label = _slotLabel(semana, slot.key);

    if (!pubId) { vacios.push(label); continue; }

    // Repetidos — excepto presidente = oración de cierre cuando está la opción activa
    const esCierrePresidente = presidenteEsOradorFinal && slot.key === 'oracionCierre'
      && pubId === getSlotPubIdFromSemana(semana, 'presidente');
    if (!esCierrePresidente) {
      (porPub[pubId] = porPub[pubId] || []).push(label);
    }

    // Sexo inválido: mujer en rol de solo varón
    if (LH_ROLES_SOLO_VARON.includes(slot.rolRequerido) && sexoDePub(pubId) === 'M') {
      sexo.push(`${esc(nombreDePub(pubId) || '?')} → ${label}`);
    }

    // Asignado pero marcado no disponible esa semana
    if (noDispEnSemana(pubId, semana.fecha)) {
      noDisp.push(`${esc(nombreDePub(pubId) || '?')} → ${label}`);
    }
  }

  const repetidos = Object.entries(porPub)
    .filter(([, labels]) => labels.length > 1)
    .map(([pubId, labels]) => `${esc(nombreDePub(pubId) || '?')}: ${labels.join(', ')}`);

  return { vacios, repetidos, sexo, noDisp };
}

function _hayProblemas(v) {
  return v.vacios.length || v.repetidos.length || v.sexo.length || v.noDisp.length;
}

function _validacionHtml(v) {
  const bloque = (titulo, items, color) => items.length
    ? `<div style="margin-top:10px;"><div style="font-weight:700;color:${color};font-size:13px;margin-bottom:4px;">${titulo}</div>`
      + `<div style="font-size:12px;color:var(--text-secondary);line-height:1.5;">${items.map(esc).join('<br>')}</div></div>`
    : '';
  return `<div style="text-align:left;">`
    + bloque(`⚠ Sexo inválido (${v.sexo.length})`, v.sexo, '#F09595')
    + bloque(`↻ Repetidos en la semana (${v.repetidos.length})`, v.repetidos, '#EF9F27')
    + bloque(`🚫 No disponibles asignados (${v.noDisp.length})`, v.noDisp, '#EF9F27')
    + bloque(`○ Sin asignar (${v.vacios.length})`, v.vacios, 'var(--text-muted)')
    + `</div>`;
}

window.guardarSemana = async function() {
  if (!semanaData) return;

  // Mejora A — validar antes de guardar
  const v = _validarSemana(semanaData);
  // Si la semana no tiene nada asignado todavía (ej. recién importada de WOL),
  // no molestar con "sin asignar" — solo importan los problemas reales.
  const algoAsignado = construirSlotsOrdenados(semanaData)
    .some(s => getSlotPubIdFromSemana(semanaData, s.key));
  if (!algoAsignado) v.vacios = [];
  if (_hayProblemas(v)) {
    const ok = await uiConfirm({
      title: 'Revisá antes de guardar',
      msg: _validacionHtml(v),
      confirmText: 'Guardar igual',
      cancelText: 'Revisar',
      type: 'warn',
    });
    if (!ok) return;
  }

  uiLoading.show('Guardando…');
  try {
    const ref = doc(db, 'congregaciones', congreId, 'vidaministerio', semanaData.fecha);
    await setDoc(ref, semanaData);
    await setDoc(doc(db, 'congregaciones', congreId, 'vm_programa', semanaData.fecha), toPublicVmSemana(semanaData));
    // Reflejar el guardado en semanasLista para que las stats (carga/colas) queden frescas
    const _idxSL = semanasLista.findIndex(s => s.fecha === semanaData.fecha);
    if (_idxSL >= 0) semanasLista[_idxSL] = semanaData;
    else { semanasLista.push(semanaData); semanasLista.sort((a, b) => b.fecha.localeCompare(a.fecha)); }
    _invalidarVmStats();
    _resetModificada();
    uiLoading.hide();
    uiToast('Programa guardado', 'success');
    logActividad(congreId, 'vida-ministerio', 'guardado', 'Semana ' + semanaData.fecha);
  } catch(e) {
    uiLoading.hide();
    await uiAlert('Error al guardar: ' + e.message);
  }
};

// ─────────────────────────────────────────
//   IMPORTACIÓN WOL
// ─────────────────────────────────────────
// Proxies en orden de preferencia — si uno falla se prueba el siguiente
const WOL_PROXIES = [
  { build: url => `https://super-math-a40f.mnsmys12.workers.dev/?url=${encodeURIComponent(url)}`, text: r => r.text() },
  { build: url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,           text: r => r.text() },
  { build: url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,                text: async r => { const j = await r.json(); return j.contents; } },
];

function wolUrl(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return `https://wol.jw.org/es/wol/dt/r4/lp-s/${y}/${m}/${d}`;
}


const TIPO_MIN_LABELS = { conversacion: 'De casa en casa', revisita: 'Revisita', escenificacion: 'Escenificación', discurso: 'Discurso' };
const TIPO_MIN_COLORS = { conversacion: '#5BA3D9', revisita: '#EF9F27', escenificacion: '#97C459', discurso: '#7F77DD' };

function renderTipoInstruccionHtml(key, parte) {
  if (!key.startsWith('ministerio.')) return '';
  const tipo  = parte?.tipo;
  const color = TIPO_MIN_COLORS[tipo] || '#888';
  // Chip muestra el nombre específico del WOL (h3), no el label genérico del tipo.
  // El color sigue indicando el tipo (azul=conversacion, etc.)
  const displayText = parte?.titulo || TIPO_MIN_LABELS[tipo] || tipo;
  const chip = tipo
    ? `<span class="tipo-chip" style="background:${color}22;color:${color};border:1px solid ${color}44;">${esc(displayText)}</span>`
    : '';
  return chip ? `<div class="parte-tipo-row">${chip}</div>` : '';
}

function parseDur(text) {
  const m = text?.match(/\((\d+)\s*min/);
  return m ? parseInt(m[1]) : null;
}

function limpiaTitulo(text) {
  if (!text) return '';
  // Quita el número de párrafo tipo "1. " al inicio si lo hay
  return text.replace(/^\d+\.\s*/, '').trim();
}

// Detecta el tipo de parte de "Seamos mejores maestros" desde el título e instrucción.
// tipo === 'discurso' → solo 1 participante (sin ayudante)
// los demás → estudiante principal + ayudante
function tipoMinisterioDesdeWOL(titulo, instruccion) {
  const t = (titulo + ' ' + (instruccion || '')).toLowerCase();
  if (t.includes('conversación') || t.includes('conversacion')) return 'conversacion';
  if (t.includes('revisita'))                                    return 'revisita';
  if (t.includes('escenificación') || t.includes('escenificacion')) return 'escenificacion';
  if (t.includes('discurso'))                                    return 'discurso';
  return 'conversacion'; // fallback — la mayoría son conversaciones
}

function parseWOL(html) {
  const doc     = new DOMParser().parseFromString(html, 'text/html');
  const root    = doc.querySelector('article#article') || doc;
  const allH3   = Array.from(root.querySelectorAll('h3, h4'));
  const allFlat = Array.from(root.querySelectorAll('*'));

  // Partes numeradas: h3/h4 cuyo texto empieza con "N. "
  const numbered = allH3
    .filter(h => /^\d+\.\s/.test(h.textContent.trim()))
    .map(h => {
      const m = h.textContent.trim().match(/^(\d+)\.\s+(.+)/);
      return { num: parseInt(m[1]), titulo: m[2].trim(), el: h, duracion: null };
    });

  if (numbered.length < 3) return null;

  // Duración: primer elemento con "(X mins.)" entre este h3 y el siguiente
  // No filtramos solo hojas porque párrafos de ministerio tienen links adentro
  numbered.forEach((part, i) => {
    const startIdx = allFlat.indexOf(part.el) + 1;
    const endIdx   = numbered[i + 1] ? allFlat.indexOf(numbered[i + 1].el) : allFlat.length;
    for (let j = startIdx; j < endIdx; j++) {
      const d = parseDur(allFlat[j].textContent);
      if (d) {
        part.duracion = d;
        // Capturar instruccion: texto del mismo elemento, sin el prefijo "(X mins.) "
        const raw = allFlat[j].textContent.trim();
        const stripped = raw.replace(/^\(\d+\s*mins?\.\)\s*/i, '').trim();
        part.instruccion = stripped || null;
        break;
      }
    }
  });

  // Canciones: WOL puede usar "Cántico" o "Canción" según la versión
  const songRe  = /[CcÁá](?:á|a)ntico|Canci[oó]n/i;
  const songNum = h => h.textContent.match(/\d+/)?.[0] || '';
  // Apertura: h3 con canción Y oración juntas (antes de las partes numeradas)
  const openH3     = allH3.find(h => songRe.test(h.textContent) && /oraci[oó]n/i.test(h.textContent));
  // Intermedia: h3 con solo número de canción (sin "oración"), entre Tesoros y Vida Cristiana
  const midSongH3  = allH3.find(h => songRe.test(h.textContent) && !/oraci[oó]n/i.test(h.textContent));
  // Cierre: último h3 con canción (con o sin oración)
  const closeH3    = [...allH3].reverse().find(h => songRe.test(h.textContent));
  const midSongPos = midSongH3 ? allH3.indexOf(midSongH3) : -1;

  // Tesoros: siempre las primeras 3 partes numeradas
  const tesorosParts = numbered.slice(0, 3);
  const restParts    = numbered.slice(3);

  let ministrioParts, vidaParts;
  if (midSongPos !== -1) {
    ministrioParts = restParts.filter(p => allH3.indexOf(p.el) < midSongPos);
    vidaParts      = restParts.filter(p => allH3.indexOf(p.el) > midSongPos);
  } else {
    // Fallback sin canción intermedia: última parte = estudio, las demás van a ministerio
    ministrioParts = restParts.slice(0, -1);
    vidaParts      = restParts.slice(-1);
  }

  // Última parte de vida cristiana = estudio bíblico
  const estudioH3      = vidaParts.length ? vidaParts[vidaParts.length - 1] : null;
  const vidaSinEstudio = vidaParts.slice(0, -1);

  const ministerio = ministrioParts.length
    ? ministrioParts.map(p => {
        const tipo = tipoMinisterioDesdeWOL(p.titulo, p.instruccion);
        const base = { titulo: p.titulo, tipo, duracion: p.duracion, instruccion: p.instruccion ?? null, pubId: null };
        return tipo === 'discurso' ? base : { ...base, ayudante: null };
      })
    : [
        { titulo: '', tipo: 'conversacion', duracion: null, instruccion: null, pubId: null, ayudante: null },
        { titulo: '', tipo: 'conversacion', duracion: null, instruccion: null, pubId: null, ayudante: null },
        { titulo: '', tipo: 'conversacion', duracion: null, instruccion: null, pubId: null, ayudante: null },
      ];

  const vidaCristiana = vidaSinEstudio.length
    ? vidaSinEstudio.map(p => ({ titulo: p.titulo, tipo: 'parte', duracion: p.duracion, pubId: null }))
    : [{ titulo: '', tipo: 'parte', duracion: null, pubId: null }];

  return {
    canciones: {
      apertura:    songNum(openH3  || {}),
      intermedia:  songNum(midSongH3 || {}),
      cierre:      songNum(closeH3 || {}),
    },
    tesoros: {
      discurso:       { titulo: tesorosParts[0]?.titulo || '',                  duracion: tesorosParts[0]?.duracion || 10, pubId: null },
      joyas:          { titulo: tesorosParts[1]?.titulo || 'Perlas escondidas', duracion: tesorosParts[1]?.duracion || 10, pubId: null },
      lecturaBiblica: { titulo: tesorosParts[2]?.titulo || '',                  duracion: tesorosParts[2]?.duracion || 4,  pubId: null, ayudante: null },
    },
    ministerio,
    vidaCristiana,
    estudioBiblico: { titulo: estudioH3?.titulo || '', duracion: estudioH3?.duracion || 30, conductor: null, lector: null },
  };
}

async function fetchWOL(fecha) {
  const target = wolUrl(fecha);
  let lastErr;
  for (const proxy of WOL_PROXIES) {
    const ctrl = new AbortController();
    const id   = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(proxy.build(target), { signal: ctrl.signal });
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await proxy.text(res);
    } catch(e) {
      clearTimeout(id);
      console.warn(`WOL proxy falló (${e.message}), probando siguiente…`);
      lastErr = e;
    }
  }
  throw lastErr || new Error('Todos los proxies fallaron');
}

// Aplica títulos/duraciones importados sin pisar las asignaciones ya hechas
function aplicarWOLaSemana(importado) {
  if (!importado || !semanaData) return;

  const merge = (destParte, srcParte) => {
    if (!destParte || !srcParte) return;
    if (srcParte.titulo) destParte.titulo = srcParte.titulo;
    if (srcParte.duracion) destParte.duracion = srcParte.duracion;
  };

  // Canciones
  if (importado.canciones) {
    if (importado.canciones.apertura)   semanaData.cancionApertura   = parseInt(importado.canciones.apertura);
    if (importado.canciones.intermedia) semanaData.cancionIntermedia = parseInt(importado.canciones.intermedia);
    if (importado.canciones.cierre)     semanaData.cancionCierre     = parseInt(importado.canciones.cierre);
  }

  merge(semanaData.tesoros.discurso,       importado.tesoros.discurso);
  merge(semanaData.tesoros.joyas,          importado.tesoros.joyas);
  merge(semanaData.tesoros.lecturaBiblica, importado.tesoros.lecturaBiblica);

  // Ministerio: reemplaza la lista completa de títulos/duraciones, conserva pubIds
  const minOld = semanaData.ministerio || [];
  semanaData.ministerio = importado.ministerio.map((p, i) => ({
    ...p,
    instruccion: p.instruccion ?? null,
    pubId:    minOld[i]?.pubId    ?? null,
    ayudante: minOld[i]?.ayudante ?? null,
    ...(tieneAuxiliar ? { salaAux: minOld[i]?.salaAux ?? { pubId: null, ayudante: null } } : {}),
  }));

  // Vida Cristiana: ídem
  const vcOld = semanaData.vidaCristiana || [];
  semanaData.vidaCristiana = importado.vidaCristiana.map((p, i) => ({
    ...p,
    pubId: vcOld[i]?.pubId ?? null,
  }));

  // Estudio Bíblico: solo título
  if (importado.estudioBiblico.titulo) {
    semanaData.estudioBiblico = semanaData.estudioBiblico || {};
    semanaData.estudioBiblico.titulo = importado.estudioBiblico.titulo;
  }
}

// ─────────────────────────────────────────
//   AUTO-ASIGNACIÓN VM (Fase 4)
// ─────────────────────────────────────────

// Retorna array ordenado de slots para una semana:
// [{ key, rolRequerido, esAyudante, esSalaAux }, ...]
function construirSlotsOrdenados(semana) {
  const slots = [];

  slots.push({ key: 'presidente',      rolRequerido: 'VM_PRESIDENTE' });
  slots.push({ key: 'oracionApertura', rolRequerido: 'VM_ORACION' });
  slots.push({ key: 'oracionCierre',   rolRequerido: 'VM_ORACION' });
  slots.push({ key: 'tesoros.discurso',       rolRequerido: 'VM_TESOROS' });
  slots.push({ key: 'tesoros.joyas',          rolRequerido: 'VM_JOYAS' });
  slots.push({ key: 'tesoros.lecturaBiblica', rolRequerido: 'VM_LECTURA' });
  if (tieneAuxiliar) {
    slots.push({ key: 'tesoros.lecturaBiblica.ayudante', rolRequerido: 'VM_LECTURA', esAyudante: true });
  }

  const ministerio = semana.ministerio || [];
  ministerio.forEach((parte, i) => {
    const rol = TIPO_MIN_ROL[parte.tipo] || 'VM_MINISTERIO_CONVERSACION';
    slots.push({ key: `ministerio.${i}`, rolRequerido: rol });
    if (parte.tipo === 'discurso') {
      // Discurso: sin ayudante, pero sala auxiliar sí tiene su propia persona
      if (tieneAuxiliar) {
        slots.push({ key: `ministerio.${i}.salaAux`, rolRequerido: rol, esSalaAux: true });
      }
    } else {
      slots.push({ key: `ministerio.${i}.ayudante`, rolRequerido: rol, esAyudante: true });
      if (tieneAuxiliar) {
        slots.push({ key: `ministerio.${i}.salaAux`,          rolRequerido: rol, esSalaAux: true });
        slots.push({ key: `ministerio.${i}.salaAux.ayudante`, rolRequerido: rol, esSalaAux: true, esAyudante: true });
      }
    }
  });

  const vc = semana.vidaCristiana || [];
  vc.forEach((_, i) => {
    slots.push({ key: `vidaCristiana.${i}`, rolRequerido: 'VM_VIDA_CRISTIANA' });
  });

  // Fix #2: en la semana del superintendente el estudio se reemplaza por su
  // discurso → no hay conductor de estudio que asignar/validar/contar.
  if (vmEspeciales[semana.fecha]?.tipo !== 'superintendente') {
    slots.push({ key: 'estudio.conductor', rolRequerido: 'VM_ESTUDIO_CONDUCTOR' });
  }

  return slots;
}

// Lee/escribe pubId directamente sobre un objeto semana arbitrario (no el global semanaData)
function getSlotPubIdFromSemana(semana, key) {
  const parts = key.split('.');
  switch (parts[0]) {
    case 'presidente':      return semana.presidente;
    case 'oracionApertura': return semana.oracionApertura;
    case 'oracionCierre':   return semana.oracionCierre;
    case 'tesoros':
      if (parts[2] === 'ayudante') return semana.tesoros?.[parts[1]]?.ayudante;
      return semana.tesoros?.[parts[1]]?.pubId;
    case 'ministerio': {
      const idx = parseInt(parts[1]);
      if (parts[2] === 'salaAux') {
        return parts[3] === 'ayudante'
          ? semana.ministerio?.[idx]?.salaAux?.ayudante
          : semana.ministerio?.[idx]?.salaAux?.pubId;
      }
      if (parts[2] === 'ayudante') return semana.ministerio?.[idx]?.ayudante;
      return semana.ministerio?.[idx]?.pubId;
    }
    case 'vidaCristiana':
      return semana.vidaCristiana?.[parseInt(parts[1])]?.pubId;
    case 'estudio':
      return parts[1] === 'conductor'
        ? semana.estudioBiblico?.conductor
        : semana.estudioBiblico?.lector;
    default: return null;
  }
}

function setSlotPubIdOnSemana(semana, key, pubId) {
  const parts = key.split('.');
  switch (parts[0]) {
    case 'presidente':      semana.presidente = pubId; break;
    case 'oracionApertura': semana.oracionApertura = pubId; break;
    case 'oracionCierre':   semana.oracionCierre   = pubId; break;
    case 'tesoros':
      if (!semana.tesoros?.[parts[1]]) break;
      if (parts[2] === 'ayudante') semana.tesoros[parts[1]].ayudante = pubId;
      else semana.tesoros[parts[1]].pubId = pubId;
      break;
    case 'ministerio': {
      const idx = parseInt(parts[1]);
      if (!semana.ministerio?.[idx]) break;
      if (parts[2] === 'salaAux') {
        if (!semana.ministerio[idx].salaAux) semana.ministerio[idx].salaAux = {};
        if (parts[3] === 'ayudante') semana.ministerio[idx].salaAux.ayudante = pubId;
        else semana.ministerio[idx].salaAux.pubId = pubId;
      } else if (parts[2] === 'ayudante') {
        semana.ministerio[idx].ayudante = pubId;
      } else {
        semana.ministerio[idx].pubId = pubId;
      }
      break;
    }
    case 'vidaCristiana': {
      const idx = parseInt(parts[1]);
      if (!semana.vidaCristiana?.[idx]) break;
      semana.vidaCristiana[idx].pubId = pubId;
      break;
    }
    case 'estudio':
      if (!semana.estudioBiblico) semana.estudioBiblico = {};
      if (parts[1] === 'conductor') semana.estudioBiblico.conductor = pubId;
      else semana.estudioBiblico.lector = pubId;
      break;
  }
}

// ─────────────────────────────────────────
//   STATS DEL HISTORIAL (memoizadas) — Mejora D
// ─────────────────────────────────────────
// Se recalculan desde semanasLista (más robusto que persistir un denormalizado),
// pero se cachean por "versión" para no recorrer todo el historial en cada llamada.
// La versión es una firma barata; además se invalida explícitamente al guardar/eliminar.
let _vmStatsCache = null;
const VM_CARGA_DIAS = 90; // ventana de "carga reciente" (≈ 3 meses)

function _vmStatsVersion() {
  const n = semanasLista.length;
  return `${n}:${semanasLista[0]?.fecha || ''}:${semanasLista[n - 1]?.fecha || ''}`;
}

function _invalidarVmStats() { _vmStatsCache = null; }

// Fisher-Yates: shuffle uniforme (reemplaza el sort(()=>Math.random()-0.5) sesgado)
function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Recorre TODO el historial una sola vez y devuelve:
//   ultimaPorRol  { rolId → { pubId → 'YYYY-MM-DD' } }
//   ultimaGlobal  { pubId → 'YYYY-MM-DD' }      (cualquier rol)
//   cargaReciente { pubId → nº de partes en los últimos VM_CARGA_DIAS }
function calcularVmStats() {
  const ver = _vmStatsVersion();
  if (_vmStatsCache && _vmStatsCache.version === ver) return _vmStatsCache;

  const ultimaPorRol  = {};
  ROLES_VM.forEach(r => { ultimaPorRol[r.id] = {}; });
  const ultimaGlobal  = {};
  const cargaReciente = {};

  const corte = new Date();
  corte.setDate(corte.getDate() - VM_CARGA_DIAS);
  const corteISO = fmtDate(corte);

  const ordenadas = [...semanasLista].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const semana of ordenadas) {
    const slots = construirSlotsOrdenados(semana);
    for (const slot of slots) {
      const pubId = getSlotPubIdFromSemana(semana, slot.key);
      if (!pubId) continue;
      if (!ultimaPorRol[slot.rolRequerido]) ultimaPorRol[slot.rolRequerido] = {};
      ultimaPorRol[slot.rolRequerido][pubId] = semana.fecha;
      if (!ultimaGlobal[pubId] || semana.fecha > ultimaGlobal[pubId]) ultimaGlobal[pubId] = semana.fecha;
      if (semana.fecha >= corteISO) cargaReciente[pubId] = (cargaReciente[pubId] || 0) + 1;
    }
  }

  _vmStatsCache = { version: ver, ultimaPorRol, ultimaGlobal, cargaReciente };
  return _vmStatsCache;
}

// Construye una cola de asignación por rol usando TODO el historial.
// Ordena cada lista por fecha de última asignación (más antigua primero, nunca asignado primero).
// Retorna { rolId → [pubId, ...] } — las colas se mutan in-place durante la asignación.
function calcularColasVM() {
  const { ultimaPorRol } = calcularVmStats();

  // Para cada rol: ordenar por fecha de última asignación (más antigua → va primero).
  // Shuffle previo (Fisher-Yates) para romper empates de forma uniforme.
  const colas = {};
  ROLES_VM.forEach(r => {
    const lista  = pubsConRol(r.id);
    const fechas = ultimaPorRol[r.id] || {};
    const ordenada = _shuffle(lista).sort((a, b) => {
      const fa = fechas[a.id] || '0000-00-00'; // nunca asignado → máxima prioridad
      const fb = fechas[b.id] || '0000-00-00';
      return fa.localeCompare(fb);
    });
    colas[r.id] = ordenada.map(p => p.id);
  });

  return colas;
}

function sexoDePub(pubId) {
  if (!pubId) return null;
  const p = publicadores.find(x => x.id === pubId);
  return p ? (p.sexo || null) : null;
}

// Mejora C — ¿el hermano está marcado como no disponible esa semana (lunes ISO)?
function noDispEnSemana(pubId, fechaLunes) {
  if (!pubId || !fechaLunes) return false;
  const p = publicadores.find(x => x.id === pubId);
  return !!(p && Array.isArray(p.noDisponible) && p.noDisponible.includes(fechaLunes));
}

// Asigna publicadores en slots de una semana usando las colas de round-robin.
// colas: { rolId → [pubId, ...] } — se mutan in-place (el asignado pasa al final).
// soloVacios: si true, respeta los slots ya asignados y solo rellena los null.
function autoAsignarSemana(semana, colas, { soloVacios = false } = {}) {
  const slots = construirSlotsOrdenados(semana);
  const enEstaSemana = new Set();

  // Pre-cargar en el Set los ya asignados para no repetirlos en slots libres
  if (soloVacios) {
    for (const slot of slots) {
      const actual = getSlotPubIdFromSemana(semana, slot.key);
      if (actual) enEstaSemana.add(actual);
    }
  }

  for (const slot of slots) {
    if (soloVacios && getSlotPubIdFromSemana(semana, slot.key)) continue;

    // Oración de cierre = presidente cuando la opción está activa
    if (presidenteEsOradorFinal && slot.key === 'oracionCierre') {
      const presId = getSlotPubIdFromSemana(semana, 'presidente');
      if (presId) setSlotPubIdOnSemana(semana, 'oracionCierre', presId);
      // No agregamos al Set para no bloquear al presidente en otros slots
      continue;
    }

    const rolId = slot.rolRequerido;
    const cola = colas[rolId];
    if (!cola || cola.length === 0) continue;

    // Para ayudantes: el principal ya fue asignado en esta misma iteración,
    // así que lo leemos desde semana y exigimos mismo sexo.
    let sexoRequerido = null;
    if (slot.esAyudante) {
      const principalKey = slot.key.replace(/\.ayudante$/, '');
      const principalId = getSlotPubIdFromSemana(semana, principalKey);
      sexoRequerido = sexoDePub(principalId); // null si el principal no tiene sexo definido
    }

    // Buscar el primero de la cola que cumpla todas las restricciones
    let asignado = null;
    let posUsada = -1;
    for (let i = 0; i < cola.length; i++) {
      const candidato = cola[i];
      if (enEstaSemana.has(candidato)) continue;
      // Mejora C: saltear hermanos marcados no disponibles esta semana
      if (noDispEnSemana(candidato, semana.fecha)) continue;
      // Fix #1: roles de solo varón nunca pueden ser ocupados por una mujer explícita
      // (red de seguridad — aplica tanto al titular como al ayudante del rol)
      if (ROLES_VM_SOLO_VARON.includes(rolId) && sexoDePub(candidato) === 'M') continue;
      // Restricción de género: si el principal tiene sexo definido y el candidato también,
      // deben coincidir. Si alguno no tiene sexo definido, se permite.
      if (sexoRequerido) {
        const sexoCandidato = sexoDePub(candidato);
        if (sexoCandidato && sexoCandidato !== sexoRequerido) continue;
      }
      asignado = candidato;
      posUsada = i;
      break;
    }

    if (asignado) {
      setSlotPubIdOnSemana(semana, slot.key, asignado);
      enEstaSemana.add(asignado);
      // Mover al final → el siguiente en recibir ese rol será el próximo de la cola
      cola.splice(posUsada, 1);
      cola.push(asignado);
    }
  }
}

// Devuelve true si la semana debe saltarse al auto-asignar según tipoEspecial
function debeSkipAutoAsignar(fecha) {
  const esp = vmEspeciales[fecha];
  if (!esp) return false;
  if (esp.tipo === 'asamblea') return true;
  if (esp.tipo === 'conmemoracion') {
    // Solo saltear si el evento es entre semana (no hay reunión VM)
    if (!esp.fechaEvento) return true;
    const d = new Date(esp.fechaEvento + 'T12:00:00');
    const dow = d.getDay(); // 0=dom, 6=sab
    return dow !== 0 && dow !== 6; // entre semana → saltear
  }
  return false; // superintendente → asignar normalmente
}

window.autocompletarHermanos = async function() {
  if (!semanaData) return;
  const ok = await uiConfirm({
    title: 'Auto-asignar hermanos',
    msg: 'Se van a completar los slots vacíos de esta semana. Los hermanos ya asignados no se tocan.',
    confirmText: 'Auto-asignar',
    cancelText: 'Cancelar',
    type: 'purple',
  });
  if (!ok) return;

  const colas = calcularColasVM();
  autoAsignarSemana(semanaData, colas, { soloVacios: true });
  _marcarModificada();
  renderSemanaEdit();
  uiToast('Hermanos auto-asignados', 'success');
};

window.reimportarDeWOL = async function() {
  if (!semanaData) return;
  const ok = await uiConfirm({
    title: 'Reimportar de WOL',
    msg: 'Se van a actualizar los títulos y duraciones desde wol.jw.org. Las asignaciones de hermanos no se tocan.',
    confirmText: 'Importar',
    cancelText: 'Cancelar',
    type: 'info',
  });
  if (!ok) return;
  uiLoading.show('Importando de WOL…');
  try {
    const html = await fetchWOL(semanaData.fecha);
    const importado = parseWOL(html);
    if (!importado) throw new Error('No se reconoció el formato de la página.');
    aplicarWOLaSemana(importado);
    _marcarModificada();
    uiLoading.hide();
    renderSemanaEdit();
    uiToast('Programa importado de WOL', 'success');
  } catch(e) {
    uiLoading.hide();
    await uiAlert(`No se pudo importar: ${e.message}\n\nPodés cargar los títulos manualmente.`);
  }
};

// ─────────────────────────────────────────
//   CREAR SEMANA NUEVA
// ─────────────────────────────────────────
window.crearSemana = async function() {
  const fechaInput = document.getElementById('nueva-fecha').value;
  if (!fechaInput) { uiToast('Seleccioná una fecha', 'error'); return; }

  const fechaBase     = lunesDeDate(fechaInput);
  const nSemanas      = parseInt(document.getElementById('nueva-n-semanas').value) || 1;
  const reemplazar    = document.getElementById('nueva-reemplazar').checked;
  const autoAsignar   = document.getElementById('nueva-auto-asignar').checked;
  const colasAA       = autoAsignar ? calcularColasVM() : null;

  let primeraFecha = null;

  for (let i = 0; i < nSemanas; i++) {
    const d = new Date(fechaBase + 'T12:00:00');
    d.setDate(d.getDate() + i * 7);
    const fecha = fmtDate(d);

    uiLoading.show(nSemanas > 1 ? `Generando semana ${i + 1} de ${nSemanas}…` : 'Verificando…');

    // Verificar si ya existe
    let yaExiste = false;
    try {
      const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha));
      yaExiste = snap.exists();
    } catch(e) {
      uiLoading.hide();
      uiToast(`Error verificando ${fmtDisplay(fecha)}: ${e.message}`, 'error');
      continue;
    }

    if (yaExiste && !reemplazar) continue; // saltar sin preguntar

    // Estructura base — fallback nMin=3, nVC=1 si WOL falla
    semanaData = {
      fecha,
      cancionApertura:   null,
      cancionIntermedia: null,
      cancionCierre:     null,
      presidente:        null,
      oracionApertura:   null,
      oracionCierre:     null,
      tesoros: {
        discurso:       { titulo: '', duracion: 10, pubId: null },
        joyas:          { titulo: 'Perlas escondidas', duracion: 10, pubId: null },
        lecturaBiblica: { titulo: '', duracion: 4, pubId: null, ayudante: null },
      },
      ministerio:    Array.from({ length: 3 }, () => ({
        titulo: '', tipo: 'conversacion', duracion: null, pubId: null, ayudante: null,
        ...(tieneAuxiliar ? { salaAux: { pubId: null, ayudante: null } } : {}),
      })),
      vidaCristiana: [{ titulo: '', tipo: 'parte', duracion: null, pubId: null }],
      estudioBiblico: { titulo: '', duracion: 30, conductor: null, lector: null },
    };

    // Siempre intentar importar de WOL
    uiLoading.show(nSemanas > 1 ? `Importando WOL semana ${i + 1}…` : 'Importando programa de WOL…');
    try {
      const html = await fetchWOL(fecha);
      const importado = parseWOL(html);
      if (importado) {
        aplicarWOLaSemana(importado);
      } else {
        uiToast(`${fmtDisplay(fecha)}: no se pudo parsear WOL — se creó con estructura base`, 'error');
      }
    } catch(e) {
      uiToast(`${fmtDisplay(fecha)}: WOL no disponible — se creó con estructura base`, 'error');
    }

    // Auto-asignar hermanos si está activo
    if (autoAsignar && colasAA && !debeSkipAutoAsignar(fecha)) {
      autoAsignarSemana(semanaData, colasAA);
    }

    // Guardar en Firestore
    try {
      await setDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', fecha), semanaData);
      await setDoc(doc(db, 'congregaciones', congreId, 'vm_programa', fecha), toPublicVmSemana(semanaData));
    } catch(e) {
      uiLoading.hide();
      uiToast(`Error guardando ${fmtDisplay(fecha)}: ${e.message}`, 'error');
      continue;
    }

    // Actualizar semanasLista
    const idxExistente = semanasLista.findIndex(s => s.fecha === fecha);
    if (idxExistente >= 0) semanasLista[idxExistente] = semanaData;
    else semanasLista.push(semanaData);

    if (!primeraFecha) primeraFecha = fecha;
  }

  semanasLista.sort((a, b) => b.fecha.localeCompare(a.fecha));
  _invalidarVmStats();
  uiLoading.hide();

  if (!primeraFecha) {
    uiToast('No se generó ninguna semana (todas ya existían)', 'error');
    return;
  }

  uiToast(nSemanas === 1 ? 'Semana creada' : `${nSemanas} semanas generadas`, 'success');

  if (nSemanas > 1) {
    renderSemanas(semanasLista);
    switchVmTab('semanas');
    showView('view-semanas');
  } else {
    semanaData = semanasLista.find(s => s.fecha === primeraFecha);
    document.getElementById('semana-titulo-display').textContent = 'Semana del ' + fmtDisplay(primeraFecha);
    renderSemanaEdit();
    showView('view-semana');
    updateNavBtnsSemana();
  }
};

// ─────────────────────────────────────────
//   COMPARTIR FOTO (html2canvas)
// ─────────────────────────────────────────
window.compartirSemanaFoto = function() {
  const el = document.getElementById('pub-contenido');
  if (!el) return;
  uiLoading.show('Generando imagen…');
  const prevBg  = el.style.background;
  const prevPad = el.style.padding;
  el.style.background = '#1e1e1e';
  el.style.padding    = '16px';
  html2canvas(el, {
    backgroundColor: '#1e1e1e',
    scale: 2,
    useCORS: true,
    logging: false,
  }).then(canvas => {
    el.style.background = prevBg;
    el.style.padding    = prevPad;
    uiLoading.hide();
    const link = document.createElement('a');
    const semStr = (pubFecha || lunesDeHoy()).replace(/-/g, '');
    link.download = `vm-semana-${semStr}.jpg`;
    link.href = canvas.toDataURL('image/jpeg', 0.92);
    link.click();
  }).catch(e => {
    el.style.background = prevBg;
    el.style.padding    = prevPad;
    uiLoading.hide();
    uiToast('Error al generar imagen: ' + e.message, 'error');
  });
};

// ─────────────────────────────────────────
//   ENCARGADO SALA AUXILIAR DEL MES
// ─────────────────────────────────────────
window.abrirPickerAuxMes = async function(mesISO) {
  if (!modoEncargado || !tieneAuxiliar) return;

  // Presidentes del mes (excluir)
  const presidentesDelMes = new Set(
    semanasLista
      .filter(s => s.fecha.startsWith(mesISO))
      .map(s => s.presidente)
      .filter(Boolean)
  );

  // Solo ancianos que no sean presidentes en alguna semana del mes
  const candidatos = publicadores.filter(p =>
    p.activo !== false &&
    (p.roles || []).includes('ANCIANO') &&
    !presidentesDelMes.has(p.id)
  );

  if (!candidatos.length) {
    await uiAlert('No hay ancianos disponibles para este mes (todos están asignados como presidente en alguna semana).', 'Sin candidatos');
    return;
  }

  const auxActualId  = vmMesesCache[mesISO]?.encargadoSalaAuxId || null;
  const auxActualNom = auxActualId ? (nombreDePub(auxActualId) || '') : '';

  // uiConductorPicker espera array de strings (nombres)
  const nombres = candidatos.map(p => p.nombre);
  const result  = await uiConductorPicker({
    conductores: nombres,
    value: auxActualNom,
    label: 'Encargado Sala Auxiliar',
  });

  if (result === undefined || result === null) return; // cancelado

  // Mapear nombre elegido de vuelta a pubId
  const elegido  = candidatos.find(p => p.nombre === result) || null;
  const nuevoId  = elegido?.id || null;
  try {
    await setDoc(vmMesRef(mesISO), { encargadoSalaAuxId: nuevoId }, { merge: true });
    if (!vmMesesCache[mesISO]) vmMesesCache[mesISO] = {};
    vmMesesCache[mesISO].encargadoSalaAuxId = nuevoId;
    const el = document.getElementById(`aux-mes-${mesISO}`);
    if (el) el.textContent = nuevoId ? (nombreDePub(nuevoId) || '…') : 'Sala aux';
    uiToast('Guardado', 'success');
  } catch(e) {
    uiToast('Error al guardar: ' + e.message, 'error');
  }
};

// ─────────────────────────────────────────
//   EXPORTAR A SHEETS
// ─────────────────────────────────────────
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function apiFetchVM(payload) {
  // Fire-and-forget: no-cors no permite leer la respuesta de igual modo
  console.log('[VM export] fetch enviando (fire & forget)…', payload.action);
  fetch(vmScriptUrl, {
    method:    'POST',
    mode:      'no-cors',
    keepalive: true,
    headers:   { 'Content-Type': 'text/plain' },
    body:      JSON.stringify(payload),
  }).then(() => console.log('[VM export] fetch completó'))
    .catch(err => console.warn('[VM export] fetch error (ignorado):', err));
}

function _semanaHeaderText(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end   = new Date(y, m - 1, d + 6);
  const ds = String(start.getDate()).padStart(2, '0');
  const de = String(end.getDate()).padStart(2, '0');
  return `Semana del ${ds} al ${de} de ${MESES_ES[start.getMonth()]} de ${y}`;
}

function formatSemanaParaSheets(s) {
  const rows = [];
  const n   = id => (id && nombreDePub(id)) || '';
  const par = (pid, aid) => { const sp = n(pid); const ay = n(aid); return sp ? (ay ? `${sp} - ${ay}` : sp) : ''; };

  rows.push([_semanaHeaderText(s.fecha), '', '']);
  rows.push(['Oración: ',                  n(s.oracionApertura), '']);
  rows.push(['Palabras de Introducción',   n(s.presidente),      '']);

  rows.push(['Tesoros de la Biblia', '', '']);
  const disc  = s.tesoros?.discurso        || {};
  const joyas = s.tesoros?.joyas           || {};
  const lb    = s.tesoros?.lecturaBiblica  || {};
  rows.push([`1. ${disc.duracion  ?? 10} mins. ${disc.titulo  || 'Discurso'}`, n(disc.pubId),  '']);
  rows.push([`2. ${joyas.duracion ?? 10} mins. Busquemos perlas escondidas`,   n(joyas.pubId), '']);
  if (tieneAuxiliar) rows.push(['', 'Sala Principal', 'Sala Auxiliar']);
  rows.push([`3. ${lb.duracion ?? 4} mins. Lectura de la Biblia`,
    n(lb.pubId), tieneAuxiliar ? n(lb.ayudante) : '']);

  rows.push(['Seamos Mejores Maestros', '', '']);
  let num = 4;
  (s.ministerio || []).forEach(p => {
    const t  = `${num}. ${p.duracion ?? 3} mins. ${p.titulo || 'Parte'}`;
    const sp = par(p.pubId, p.ayudante);
    const sa = tieneAuxiliar ? (p.tipo === 'discurso' ? n(p.salaAux?.pubId) : par(p.salaAux?.pubId, p.salaAux?.ayudante)) : '';
    rows.push([t, sp, sa]);
    num++;
  });

  rows.push(['Nuestra Vida Cristiana', '', '']);
  (s.vidaCristiana || []).forEach(p => {
    rows.push([`${num}. ${p.duracion ?? 10} mins. ${p.titulo || 'Parte'}`, n(p.pubId), '']);
    num++;
  });
  const est = s.estudioBiblico || {};
  rows.push([`${num}. ${est.duracion ?? 30} mins. Estudio bíblico de la congregación`, n(est.conductor), '']);

  rows.push(['3 mins. Palabras de conclusión', n(s.presidente),    '']);
  rows.push(['Oración',                        n(s.oracionCierre), '']);
  return rows;
}

window.exportarMesASheets = async function(mesISO) {
  if (!vmScriptUrl || !mesISO) return;
  const [anio, mes] = mesISO.split('-').map(Number);
  const hojaName     = `${MESES_ES[mes-1]} ${String(anio).slice(2)}`;
  const semanasDelMes = semanasLista.filter(s => s.fecha.startsWith(mesISO)).slice().reverse();

  if (!semanasDelMes.length) {
    await uiAlert(`No hay semanas cargadas para ${hojaName}.`, 'Sin datos');
    return;
  }

  const semanasData = semanasDelMes.map(s => ({
    fecha: s.fecha,
    filas: formatSemanaParaSheets(s),
  }));
  const auxId = vmMesesCache[mesISO]?.encargadoSalaAuxId;
  const encargadoNombre = (tieneAuxiliar && auxId) ? (nombreDePub(auxId) || '') : '';

  apiFetchVM({
    action: 'saveVMMes',
    hoja: hojaName,
    encargadoAux: encargadoNombre,
    semanas: semanasData,
  });

  uiToast(`Enviando "${hojaName}" a Sheets… revisá la planilla en unos segundos`, 'success');
};

window.exportarMesImagen = async function(mesISO) {
  const [y, m] = mesISO.split('-').map(Number);
  const label  = `${MESES_ES[m-1]} ${y}`;

  // Semanas del mes en orden ascendente
  const semanasDelMes = semanasLista.filter(s => s.fecha.startsWith(mesISO)).slice().reverse();
  if (!semanasDelMes.length) {
    uiToast('No hay semanas para este mes', 'error');
    return;
  }

  await ensureVmLookupsLoaded();

  const auxId      = vmMesesCache[mesISO]?.encargadoSalaAuxId;
  const auxNombre  = (tieneAuxiliar && auxId) ? (nombreDePub(auxId) || '') : '';
  const auxLine    = auxNombre
    ? `<div style="font-size:12px;color:#888;margin-bottom:10px;">Sala Auxiliar: ${esc(auxNombre)}</div>`
    : '';

  // Cargar datos completos de Firestore (semanasLista tiene todo pero por si acaso)
  const semanasData = await Promise.all(semanasDelMes.map(async s => {
    let data = s;
    if (!s.tesoros) {
      try {
        const sn = await getDoc(doc(db, 'congregaciones', congreId, 'vidaministerio', s.fecha));
        if (sn.exists()) data = sn.data();
      } catch { /* usar lo que hay */ }
    }
    return data;
  }));

  // Render de cada semana con su encabezado de fecha — grilla 2 columnas
  const dd = n => String(n).padStart(2, '0');
  const cellsHtml = semanasData.map(s => {
    const inicio = new Date(s.fecha + 'T12:00:00');
    const fin    = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    const rango = `${dd(inicio.getDate())}/${dd(inicio.getMonth()+1)} al ${dd(fin.getDate())}/${dd(fin.getMonth()+1)}`;
    return `<div style="background:#1e1e1e;border-radius:12px;padding:12px;overflow:hidden;">
      <div style="font-size:10px;font-weight:700;color:#EF9F27;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #2e3033;letter-spacing:0.06em;text-transform:uppercase;">Semana ${rango}</div>
      ${renderSemanaPublico(s)}
    </div>`;
  }).join('');

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:-9999px;top:0;background:#1a1c1f;padding:20px;width:820px;box-sizing:border-box;';
  wrap.innerHTML = `
    <div style="font-size:17px;font-weight:800;color:#EF9F27;margin-bottom:4px;">${esc(label)}</div>
    ${auxLine}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">${cellsHtml}</div>
  `;
  document.body.appendChild(wrap);

  uiLoading.show('Generando imagen…');
  html2canvas(wrap, { backgroundColor: '#1a1c1f', scale: 2, useCORS: true, logging: false })
    .then(canvas => {
      document.body.removeChild(wrap);
      uiLoading.hide();
      const link = document.createElement('a');
      link.download = `vm-${mesISO}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.92);
      link.click();
    })
    .catch(e => {
      if (wrap.parentNode) document.body.removeChild(wrap);
      uiLoading.hide();
      uiToast('Error al generar imagen: ' + e.message, 'error');
    });
};

// ─────────────────────────────────────────
//   S-89
// ─────────────────────────────────────────

function s89FechaReunion(semana) {
  // Reunión VM: miércoles (+2); semana de superintendente → martes (+1)
  const offset = semana.tipoEspecial === 'superintendente' ? 1 : 2;
  const d = new Date(semana.fecha + 'T12:00:00');
  d.setDate(d.getDate() + offset);
  const p = n => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function s89SlipsDeSemana(semana) {
  const slips = [];
  const fecha = s89FechaReunion(semana);

  const add = (pubId, ayudanteId, intervencion, sala) => {
    const nombre = nombreDePub(pubId);
    if (!nombre) return;
    slips.push({ nombre, ayudante: nombreDePub(ayudanteId) || '', fecha, intervencion, sala });
  };

  // Lectura Bíblica → intervención 3
  // SP: pubId; SA: ayudante (así lo almacena el app cuando tieneAuxiliar)
  add(semana.tesoros?.lecturaBiblica?.pubId, null, 3, 'principal');
  if (tieneAuxiliar) {
    add(semana.tesoros?.lecturaBiblica?.ayudante, null, 3, 'auxiliar');
  }

  // Seamos Mejores Maestros → intervenciones 4, 5, 6 …
  (semana.ministerio || []).forEach((parte, i) => {
    const num = 4 + i;
    const conAyudante = parte.tipo !== 'discurso';
    add(parte.pubId, conAyudante ? parte.ayudante : null, num, 'principal');
    if (tieneAuxiliar && parte.salaAux?.pubId) {
      add(parte.salaAux.pubId, conAyudante ? parte.salaAux.ayudante : null, num, 'auxiliar');
    }
  });

  return slips;
}

function s89SlipHtml(s, idx) {
  const e  = t => (t || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const chk = sel => sel
    ? '<div class="s89-caja" style="background:#000;color:#fff;font-weight:900;">✓</div>'
    : '<div class="s89-caja"></div>';

  return `
<div class="s89-wrap">
  <div class="s89-persona-label">${e(s.nombre)}${s.sala === 'auxiliar' ? ' · Sala auxiliar' : ''}</div>
  <div class="s89-slip" id="s89-slip-${idx}">
    <div class="s89-slip-titulo">Asignación para la reunión<br>Vida y Ministerio Cristianos</div>
    <div class="s89-campo">
      <span class="s89-etiqueta">Nombre:</span>
      <span class="s89-linea">${e(s.nombre)}</span>
    </div>
    <div class="s89-campo">
      <span class="s89-etiqueta">Ayudante:</span>
      <span class="s89-linea">${e(s.ayudante)}</span>
    </div>
    <div class="s89-campo">
      <span class="s89-etiqueta">Fecha:</span>
      <span class="s89-linea">${e(s.fecha)}</span>
    </div>
    <div class="s89-campo">
      <span class="s89-etiqueta">Intervención núm.:</span>
      <span class="s89-linea">${s.intervencion}</span>
    </div>
    <div class="s89-se-en">Se presentará en:</div>
    <div class="s89-opciones">
      <div class="s89-opcion">${chk(s.sala==='principal')} Sala principal</div>
      <div class="s89-opcion">${chk(s.sala==='auxiliar')} Sala auxiliar núm. 1</div>
      <div class="s89-opcion">${chk(false)} Sala auxiliar núm. 2</div>
    </div>
    <div class="s89-nota">
      <b>Nota al estudiante:</b> En la <i>Guía de actividades</i>
      encontrará la información que necesita para su intervención.
      Repase también las indicaciones que se describen en las
      <i>Instrucciones para la reunión Vida y Ministerio Cristianos</i> (S-38).
    </div>
    <div class="s89-codigo">S-89-S 11/23</div>
  </div>
  <button class="s89-btn-wa" onclick="window.s89Whatsapp(${idx})">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.533 5.856L.054 23.447a.5.5 0 00.603.61l5.7-1.493A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.814 9.814 0 01-5.032-1.387l-.36-.214-3.733.979.996-3.638-.235-.374A9.818 9.818 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
    Enviar por WhatsApp
  </button>
  <button class="s89-btn-img" onclick="window.s89Compartir(${idx})">
    📷 Compartir imagen
  </button>
</div>`;
}

function s89MostrarOverlay(slips, titulo) {
  if (!slips.length) {
    uiToast('No hay hermanos asignados en Lectura ni Ministerio', 'error');
    return;
  }
  document.getElementById('s89-titulo').textContent = titulo;
  document.getElementById('s89-lista').innerHTML = slips.map((s, i) => s89SlipHtml(s, i)).join('');
  // Guardar slips en variable accesible para los botones
  window._s89Slips = slips;
  document.getElementById('s89-overlay').style.display = 'block';
  document.getElementById('s89-overlay').scrollTop = 0;
}

window.cerrarS89 = function() {
  document.getElementById('s89-overlay').style.display = 'none';
};

window.s89Whatsapp = function(idx) {
  const s = window._s89Slips?.[idx];
  if (!s) return;
  const sala = s.sala === 'auxiliar' ? 'Sala auxiliar núm. 1' : 'Sala principal';
  const ayLine = s.ayudante ? `\n👤 Ayudante: ${s.ayudante}` : '';
  const texto = [
    `Hola *${s.nombre}*! 👋`,
    ``,
    `Tenés asignación en la reunión *Vida y Ministerio Cristianos* del *${s.fecha}*:`,
    ``,
    `📌 Intervención núm. ${s.intervencion}${ayLine}`,
    `📍 Se presentará en: *${sala}*`,
    ``,
    `Repasá tu *Guía de actividades* para prepararte. 📖`,
  ].join('\n');
  window.open('https://wa.me/?text=' + encodeURIComponent(texto), '_blank');
};

window.s89Compartir = async function(idx) {
  const el = document.getElementById(`s89-slip-${idx}`);
  if (!el || typeof html2canvas === 'undefined') {
    uiToast('html2canvas no disponible', 'error');
    return;
  }
  uiLoading.show('Generando imagen…');
  try {
    const canvas = await html2canvas(el, {
      scale: 3,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    });
    canvas.toBlob(async blob => {
      uiLoading.hide();
      const s = window._s89Slips?.[idx];
      const nombre = s?.nombre?.split(' ')[0] || 'S89';
      const file = new File([blob], `s89-${nombre}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: `S-89 – ${s?.nombre}` }); return; }
        catch { /* cancelado por el usuario */ return; }
      }
      // Fallback: descargar
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.name;
      a.click();
    }, 'image/jpeg', 0.96);
  } catch(err) {
    uiLoading.hide();
    uiToast('Error al generar imagen', 'error');
    console.error(err);
  }
};

function s89GenerarHtml(slips, { autoPrint = false } = {}) {
  const e = t => (t||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const caja = sel => `<span style="display:inline-block;width:16px;height:16px;border:1.5px solid #000;text-align:center;line-height:14px;font-size:13px;font-weight:900;vertical-align:middle;font-family:sans-serif;">${sel ? '✓' : ''}</span>`;

  const slipHtml = s => `
<div class="s89-print-slip">
  <div style="font-size:15pt;font-weight:700;text-align:center;text-transform:uppercase;line-height:1.35;margin-bottom:9mm;letter-spacing:0.01em;">
    Asignación para la reunión<br>Vida y Ministerio Cristianos
  </div>
  <div style="display:flex;align-items:flex-end;gap:4px;margin-bottom:7mm;">
    <b style="white-space:nowrap;font-size:13pt;">Nombre:</b>
    <span style="flex:1;border-bottom:1.5px solid #000;font-size:13pt;padding-left:4px;">${e(s.nombre)}</span>
  </div>
  <div style="display:flex;align-items:flex-end;gap:4px;margin-bottom:7mm;">
    <b style="white-space:nowrap;font-size:13pt;">Ayudante:</b>
    <span style="flex:1;border-bottom:1.5px solid #000;font-size:13pt;padding-left:4px;">${e(s.ayudante)}</span>
  </div>
  <div style="display:flex;align-items:flex-end;gap:4px;margin-bottom:7mm;">
    <b style="white-space:nowrap;font-size:13pt;">Fecha:</b>
    <span style="flex:1;border-bottom:1.5px solid #000;font-size:13pt;padding-left:4px;">${e(s.fecha)}</span>
  </div>
  <div style="display:flex;align-items:flex-end;gap:4px;margin-bottom:7mm;">
    <b style="white-space:nowrap;font-size:13pt;">Intervención núm.:</b>
    <span style="flex:1;border-bottom:1.5px solid #000;font-size:13pt;padding-left:4px;">${s.intervencion}</span>
  </div>
  <div style="font-size:13pt;font-weight:700;margin-bottom:5mm;">Se presentará en:</div>
  <div style="margin-left:8mm;font-size:13pt;">
    <div style="margin-bottom:4mm;">${caja(s.sala==='principal')}&nbsp;&nbsp;Sala principal</div>
    <div style="margin-bottom:4mm;">${caja(s.sala==='auxiliar')}&nbsp;&nbsp;Sala auxiliar núm. 1</div>
    <div>${caja(false)}&nbsp;&nbsp;Sala auxiliar núm. 2</div>
  </div>
  <div style="padding-top:5mm;border-top:0.5px solid #bbb;font-size:9.5pt;line-height:1.45;margin-top:auto;">
    <b>Nota al estudiante:</b> En la <i>Guía de actividades</i> encontrará la información
    que necesita para su intervención. Repase también las indicaciones que se describen en las
    <i>Instrucciones para la reunión Vida y Ministerio Cristianos</i> (S-38).
  </div>
  <div style="font-size:8pt;color:#555;margin-top:4mm;">S-89-S 11/23</div>
</div>`;

  // 2 por página (en vez de 4) → tamaño mucho más cercano al original
  const paginas = [];
  for (let i = 0; i < slips.length; i += 2) paginas.push(slips.slice(i, i + 2));
  const printScript = autoPrint ? `<script>window.onload=()=>setTimeout(()=>window.print(),300);<\/script>` : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>S-89</title>
<style>
* { box-sizing:border-box; margin:0; padding:0; }
body { font-family:'Times New Roman',Times,serif; background:#fff; color:#000; }
.pagina { width:210mm; margin:0 auto; page-break-after:always; }
.s89-print-slip {
  padding:14mm 16mm 10mm;
  border-bottom:1px dashed #aaa;
  display:flex; flex-direction:column;
  min-height:148mm;
}
.s89-print-slip:last-child { border-bottom:none; }
@media print { @page { size:A4; margin:0; } body { margin:0; } }
</style></head><body>
${paginas.map(p => `<div class="pagina">${p.map(slipHtml).join('')}</div>`).join('')}
${printScript}
</body></html>`;
}

window.s89Imprimir = function() {
  const slips = window._s89Slips;
  if (!slips?.length) return;
  const html = s89GenerarHtml(slips, { autoPrint: true });
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
};

window.s89Descargar = async function() {
  const slips = window._s89Slips;
  if (!slips?.length) return;

  uiLoading.show('Generando PDF…');
  const tempStyle = document.createElement('style');
  const container = document.createElement('div');

  try {
    // Cargar jsPDF si todavía no está
    if (!window.jspdf) {
      await new Promise((res, rej) => {
        const sc = document.createElement('script');
        sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        sc.onload = res; sc.onerror = rej;
        document.head.appendChild(sc);
      });
    }

    // Parsear el HTML del print e inyectarlo en el documento vivo
    // (html2canvas no funciona dentro de iframes)
    const parsed = new DOMParser().parseFromString(s89GenerarHtml(slips), 'text/html');
    tempStyle.textContent = Array.from(parsed.querySelectorAll('style')).map(s => s.textContent).join('\n');
    document.head.appendChild(tempStyle);

    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;background:#fff;';
    Array.from(parsed.querySelectorAll('.pagina')).forEach(p => container.appendChild(document.adoptNode(p)));
    document.body.appendChild(container);

    await new Promise(r => setTimeout(r, 300)); // esperar layout

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageEls = container.querySelectorAll('.pagina');

    for (let i = 0; i < pageEls.length; i++) {
      if (i > 0) pdf.addPage();
      const canvas = await html2canvas(pageEls[i], {
        scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false,
      });
      // Mantener proporción real del canvas sobre la página A4
      const pxToMm = 210 / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, canvas.height * pxToMm);
    }

    const fecha = slips[0]?.fecha?.replace(/\//g, '-') || 'vm';
    pdf.save(`s89-${fecha}.pdf`);
    uiToast('PDF descargado ✓', 'success');

  } catch(err) {
    console.error('s89Descargar:', err);
    uiToast('Error al generar PDF', 'error');
  } finally {
    if (tempStyle.parentNode) document.head.removeChild(tempStyle);
    if (container.parentNode) document.body.removeChild(container);
    uiLoading.hide();
  }
};

window.generarS89Semana = function() {
  if (!semanaData) return;
  const slips = s89SlipsDeSemana(semanaData);
  const d = new Date(semanaData.fecha + 'T12:00:00');
  const titulo = `S-89 — ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
  s89MostrarOverlay(slips, titulo);
};

window.generarS89 = function(mesISO) {
  const semanas = semanasLista
    .filter(s => s.fecha?.startsWith(mesISO))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (!semanas.length) { uiToast('No hay semanas cargadas para ese mes', 'error'); return; }
  const slips = semanas.flatMap(s89SlipsDeSemana);
  const [anio, mes] = mesISO.split('-');
  s89MostrarOverlay(slips, `S-89 — ${MESES_ES[Number(mes)-1]} ${anio}`);
};

window.exportarSemanaActualASheets = function() {
  if (!vmScriptUrl || !semanaData) return;
  const mes  = semanaData.fecha.slice(0, 7);
  const anio = Number(mes.slice(0, 4));
  const mesN = Number(mes.slice(5, 7));
  const hojaName = `${MESES_ES[mesN-1]} ${String(anio).slice(2)}`;
  const encargadoNombre = (tieneAuxiliar && vmMesesCache[mes]?.encargadoSalaAuxId)
    ? (nombreDePub(vmMesesCache[mes].encargadoSalaAuxId) || '') : '';

  apiFetchVM({
    action: 'saveVMSemana',
    hoja: hojaName,
    encargadoAux: encargadoNombre,
    semanas: [{ fecha: semanaData.fecha, filas: formatSemanaParaSheets(semanaData) }],
  });
  uiToast(`Enviando semana a "${hojaName}"… revisá en unos segundos`, 'success');
};

// ─────────────────────────────────────────
//   INIT
// ─────────────────────────────────────────
(async function init() {
  const savedId     = sessionStorage.getItem('congreId');
  const savedNombre = sessionStorage.getItem('congreNombre');

  if (!savedId) {
    window.location.href = '../index.html';
    return;
  }

  congreId     = savedId;
  congreNombre = savedNombre;
  logActividad(congreId, 'vida-ministerio', 'apertura');
  document.getElementById('cover-congre').textContent = congreNombre || '—';
  showView('view-cover');

  try {
    const [snap, privateSnap] = await Promise.all([
      getDoc(doc(db, 'congregaciones', congreId)),
      getDoc(privateModuleConfigRef()).catch(() => null),
    ]);
    if (!snap.exists()) { window.location.href = '../index.html'; return; }
    const data = snap.data();
    const privateData = privateSnap?.exists?.() ? privateSnap.data() : {};
    const mergedConfig = { ...data, ...privateData };
    pinVM = mergedConfig.pinVidaMinisterio || data.pinVidaMinisterio || '1234';
    tieneAuxiliar           = data.tieneAuxiliar === true;
    presidenteEsOradorFinal = data.presidenteEsOradorFinal === true;
    vmScriptUrl = mergedConfig.vmScriptUrl || null;
    vmInitReady = true;
  } catch(e) {
    console.error('Error al inicializar:', e);
  }
})();

// ─────────────────────────────────────────
//   LISTA DE HERMANOS (VM)
// ─────────────────────────────────────────

const LH_ROLES_ASIGN = [
  { id: 'LECTOR', label: 'Lector' }, { id: 'SONIDO', label: 'Sonido' },
  { id: 'PLATAFORMA', label: 'Plataforma' }, { id: 'MICROFONISTAS', label: 'Micrófonos' },
  { id: 'ACOMODADOR_AUDITORIO', label: 'Acod. Auditorio' }, { id: 'ACOMODADOR_ENTRADA', label: 'Acod. Entrada' },
  { id: 'PRESIDENTE', label: 'Pres. Reunión' }, { id: 'REVISTAS', label: 'Revistas' },
  { id: 'PUBLICACIONES', label: 'Publicaciones' },
];
const LH_ROLES_VM = [
  { id: 'VM_PRESIDENTE', label: 'Presidente' }, { id: 'VM_ORACION', label: 'Oración' },
  { id: 'VM_TESOROS', label: 'Disc. Tesoros' }, { id: 'VM_JOYAS', label: 'Perlas escondidas' },
  { id: 'VM_LECTURA', label: 'Lectura Bíblica' },
  { id: 'VM_MINISTERIO_CONVERSACION', label: 'Min. Conversación' },
  { id: 'VM_MINISTERIO_REVISITA', label: 'Min. Revisita' },
  { id: 'VM_MINISTERIO_ESCENIFICACION', label: 'Min. Escenificación' },
  { id: 'VM_MINISTERIO_DISCURSO', label: 'Min. Discurso' },
  { id: 'VM_VIDA_CRISTIANA', label: 'Vida Cristiana' },
  { id: 'VM_ESTUDIO_CONDUCTOR', label: 'Conductor Estudio' },
];
const LH_TODOS_ROLES = [...LH_ROLES_ASIGN, ...LH_ROLES_VM];

let _lhListaVisible      = [];
let _lhEditandoId        = null;
let _lhModalSexo         = null;
let _lhModalPrivilegiado = false; // true si el pub tiene ANCIANO o SIERVO_MINISTERIAL
let _lhModalNoDisp       = []; // Mejora C — fechas (lunes ISO) en que el hermano no está disponible

function _lhRolLabel(id) {
  return LH_TODOS_ROLES.find(r => r.id === id)?.label || id;
}

function _lhPubCol() {
  return collection(db, 'congregaciones', congreId, 'publicadores');
}

window.goToListaHermanos = async function() {
  uiLoading.show('Cargando…');
  await ensureVmLookupsLoaded();
  uiLoading.hide();
  document.getElementById('lista-hermanos-sub').textContent = congreNombre || '—';
  document.getElementById('lh-search').value = '';
  document.getElementById('lh-rol').value = '';
  // Construir checkboxes de asignaciones (sin grupos, simplificado)
  const grid = document.getElementById('lh-modal-roles-asign-grid');
  if (grid && !grid.children.length) {
    grid.innerHTML = LH_ROLES_ASIGN.map(r =>
      `<label class="rol-checkbox"><input type="checkbox" id="lhcb-${r.id}"><span>${r.label}</span></label>`
    ).join('');
  }
  _lhFiltrar();
  showView('view-lista-hermanos');
};

// ─────────────────────────────────────────
//   CARGA DE HERMANOS — Mejora B
// ─────────────────────────────────────────
window.goToCarga = async function() {
  uiLoading.show('Cargando…');
  await ensureVmLookupsLoaded();
  if (!semanasLista.length) await cargarSemanas();
  uiLoading.hide();
  document.getElementById('carga-congre-sub').textContent = congreNombre || '—';
  renderCarga();
  showView('view-carga');
};

function renderCarga() {
  const cont = document.getElementById('carga-list');
  if (!cont) return;
  const activos = publicadores.filter(p => p.activo !== false);
  if (!activos.length) {
    cont.innerHTML = '<div class="empty-state">No hay hermanos cargados.</div>';
    return;
  }
  const stats     = calcularVmStats();
  const lunesHoy  = lunesDeHoy();

  const filas = activos.map(p => {
    const futuras = (Array.isArray(p.noDisponible) ? p.noDisponible : [])
      .filter(f => f >= lunesHoy);
    return {
      p,
      carga:  stats.cargaReciente[p.id] || 0,
      ultima: stats.ultimaGlobal[p.id] || null,
      futuras: futuras.length,
    };
  });

  // Más cargados primero; a igualdad, los que hace más no participan; luego alfabético
  filas.sort((a, b) =>
    b.carga - a.carga ||
    (a.ultima || '').localeCompare(b.ultima || '') ||
    norm(a.p.nombre).localeCompare(norm(b.p.nombre))
  );

  cont.innerHTML = filas.map(({ p, carga, ultima, futuras }) => {
    const cls = carga === 0 ? 'vm-carga-c0' : carga >= 4 ? 'vm-carga-chi' : 'vm-carga-clow';
    const ultimaTxt = ultima ? `Última: ${esc(fmtDisplay(ultima))}` : 'Nunca asignado';
    const ndTxt = futuras ? ` · <span class="nd">${futuras} sem. no disp.</span>` : '';
    return `<div class="vm-carga-row">
      <div class="vm-carga-info">
        <div class="vm-carga-nombre">${esc(p.nombre)}</div>
        <div class="vm-carga-sub">${ultimaTxt}${ndTxt}</div>
      </div>
      <div class="vm-carga-count ${cls}">${carga}<small>3 MESES</small></div>
    </div>`;
  }).join('');
}

function _lhRenderLista(lista) {
  _lhListaVisible = lista;
  const el = document.getElementById('lh-list');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state">No hay hermanos cargados.</div>';
    return;
  }
  el.innerHTML = lista.map(h => {
    const asignChips = (h.roles || []).filter(r => !r.startsWith('VM_'))
      .map(r => `<span class="vm-rol-chip" style="background:rgba(90,163,217,0.12);color:#5BA3D9;border-color:rgba(90,163,217,0.3);">${esc(_lhRolLabel(r))}</span>`).join('');
    const vmChips = (h.roles || []).filter(r => r.startsWith('VM_'))
      .map(r => `<span class="vm-rol-chip">${esc(_lhRolLabel(r))}</span>`).join('');
    const chips = (asignChips + vmChips) || '<span style="font-size:11px;color:var(--text-muted);">Sin roles</span>';
    const sexoChip = h.sexo === 'H'
      ? `<span class="chip-sexo chip-sexo-h" onclick="event.stopPropagation();toggleSexoVM('${h.id}','H')" title="Hombre — clic para cambiar">♂</span>`
      : h.sexo === 'M'
        ? `<span class="chip-sexo chip-sexo-m" onclick="event.stopPropagation();toggleSexoVM('${h.id}','M')" title="Mujer — clic para cambiar">♀</span>`
        : `<span class="chip-sexo chip-sexo-none" onclick="event.stopPropagation();toggleSexoVM('${h.id}',null)" title="Sin género — clic para asignar">·</span>`;
    return `<div class="vm-hermano-row" onclick="abrirEditarVM('${h.id}')">
      <div class="vm-hermano-info">
        <div class="hermano-nombre-row" style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
          ${sexoChip}
          <div class="vm-hermano-nombre">${esc(h.nombre)}</div>
        </div>
        <div class="vm-hermano-roles">${chips}</div>
      </div>
      <div class="vm-hermano-actions">
        <button class="btn-del-hermano-vm" onclick="event.stopPropagation();confirmarEliminarVM('${h.id}','${(h.nombre || '').replace(/'/g, "\\'")}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

function _lhFiltrar() {
  const q   = norm(document.getElementById('lh-search')?.value || '');
  const rol = document.getElementById('lh-rol')?.value || '';
  _lhRenderLista(publicadores.filter(h =>
    h.activo !== false &&
    (!q   || norm(h.nombre).includes(q)) &&
    (!rol || (rol === '__sin_roles__'
      ? (h.roles || []).length === 0
      : (h.roles || []).includes(rol)))
  ));
}

window.filtrarListaHermanosVM = _lhFiltrar;

function _lhActualizarNavModal(id) {
  const idx   = _lhListaVisible.findIndex(p => p.id === id);
  const total = _lhListaVisible.length;
  const visible = idx !== -1 && total > 1;
  document.getElementById('lh-modal-nav-row').style.display  = visible ? 'flex' : 'none';
  document.getElementById('lh-modal-nav-counter').textContent = visible ? `${idx + 1} de ${total}` : '';
  document.getElementById('lh-modal-nav-prev').disabled = idx <= 0;
  document.getElementById('lh-modal-nav-next').disabled = idx >= total - 1;
}

function _lhRenderSexoBtns() {
  ['H', 'M'].forEach(s => {
    document.getElementById('lh-btn-sexo-' + s)
      ?.classList.toggle('btn-sexo-active', _lhModalSexo === s);
  });
}

// Roles VM que requieren ser varón (alias de la constante canónica de arriba)
const LH_ROLES_SOLO_VARON = ROLES_VM_SOLO_VARON;
// Roles VM que además requieren ser anciano o siervo ministerial
const LH_ROLES_SOLO_PRIVILEGIADO = [
  'VM_PRESIDENTE','VM_ORACION','VM_TESOROS','VM_JOYAS',
  'VM_MINISTERIO_DISCURSO','VM_VIDA_CRISTIANA','VM_ESTUDIO_CONDUCTOR'
];

function _lhActualizarRolesSegunSexo() {
  const esMujer = _lhModalSexo === 'M';
  const esVaronNoPriv = _lhModalSexo === 'H' && !_lhModalPrivilegiado;

  // Sección entera de Asignaciones (solo mujeres no pueden)
  const seccionAsign = document.getElementById('lh-seccion-asign');
  if (seccionAsign) seccionAsign.style.display = esMujer ? 'none' : '';
  if (esMujer) {
    LH_ROLES_ASIGN.forEach(r => {
      const cb = document.getElementById('lhcb-' + r.id);
      if (cb) cb.checked = false;
    });
  }

  // Roles VM solo para varón
  LH_ROLES_SOLO_VARON.forEach(rolId => {
    const ocultar = esMujer;
    const cb = document.getElementById('lhcb-' + rolId);
    if (!cb) return;
    const label = cb.closest('label');
    if (ocultar) {
      cb.checked = false;
      if (label) label.style.display = 'none';
    } else {
      if (label) label.style.display = '';
    }
  });

  // Roles VM solo para varón privilegiado (anciano o siervo ministerial)
  LH_ROLES_SOLO_PRIVILEGIADO.forEach(rolId => {
    if (esMujer) return; // ya oculto por el bloque anterior
    const cb = document.getElementById('lhcb-' + rolId);
    if (!cb) return;
    const label = cb.closest('label');
    if (esVaronNoPriv) {
      cb.checked = false;
      if (label) label.style.display = 'none';
    } else {
      if (label) label.style.display = '';
    }
  });
}

window.selectSexoVM = function(s) {
  _lhModalSexo = (_lhModalSexo === s) ? null : s;
  _lhRenderSexoBtns();
  _lhActualizarRolesSegunSexo();
};

// ── Mejora C — disponibilidad en el modal de hermano ──
function _lhRenderNoDisp() {
  const cont = document.getElementById('lh-nodisp-chips');
  if (!cont) return;
  if (!_lhModalNoDisp.length) {
    cont.innerHTML = '<span class="lh-nodisp-empty">Disponible todas las semanas</span>';
    return;
  }
  const ordenadas = [..._lhModalNoDisp].sort();
  cont.innerHTML = ordenadas.map(f =>
    `<span class="lh-nodisp-chip">Sem. ${esc(fmtDisplay(f))}
      <button type="button" onclick="lhQuitarNoDisp('${f}')" title="Quitar">✕</button></span>`
  ).join('');
}

window.lhAgregarNoDisp = async function() {
  const sel = await uiDatePicker({ label: 'Semana no disponible' });
  if (!sel) return;
  const lunes = lunesDeDate(sel); // ya devuelve YYYY-MM-DD (lunes de esa semana)
  if (!_lhModalNoDisp.includes(lunes)) _lhModalNoDisp.push(lunes);
  _lhRenderNoDisp();
};

window.lhQuitarNoDisp = function(fecha) {
  _lhModalNoDisp = _lhModalNoDisp.filter(f => f !== fecha);
  _lhRenderNoDisp();
};

window.abrirNuevoVM = function() {
  _lhEditandoId        = null;
  _lhModalSexo         = null;
  _lhModalPrivilegiado = false;
  _lhModalNoDisp       = [];
  document.getElementById('lh-modal-titulo').textContent = 'Nuevo hermano';
  document.getElementById('lh-modal-nombre').value = '';
  document.getElementById('lh-modal-status').textContent = '';
  LH_TODOS_ROLES.forEach(r => {
    const cb = document.getElementById('lhcb-' + r.id);
    if (cb) cb.checked = false;
  });
  _lhRenderSexoBtns();
  _lhActualizarRolesSegunSexo();
  _lhRenderNoDisp();
  document.getElementById('lh-modal-nav-row').style.display = 'none';
  document.getElementById('modal-hermano-vm').style.display = 'flex';
  document.getElementById('lh-modal-nombre').focus();
};

window.abrirEditarVM = function(id) {
  const h = publicadores.find(p => p.id === id);
  if (!h) return;
  _lhEditandoId        = id;
  _lhModalSexo         = h.sexo || null;
  _lhModalPrivilegiado = (h.roles || []).some(r => r === 'ANCIANO' || r === 'SIERVO_MINISTERIAL');
  _lhModalNoDisp       = Array.isArray(h.noDisponible) ? [...h.noDisponible] : [];
  document.getElementById('lh-modal-titulo').textContent = esc(h.nombre);
  document.getElementById('lh-modal-nombre').value = h.nombre;
  document.getElementById('lh-modal-status').textContent = '';
  LH_TODOS_ROLES.forEach(r => {
    const cb = document.getElementById('lhcb-' + r.id);
    if (cb) cb.checked = (h.roles || []).includes(r.id);
  });
  _lhRenderSexoBtns();
  _lhActualizarRolesSegunSexo();
  _lhRenderNoDisp();
  _lhActualizarNavModal(id);
  document.getElementById('modal-hermano-vm').style.display = 'flex';
};

window.cerrarModalHermanoVM = function() {
  document.getElementById('modal-hermano-vm').style.display = 'none';
  _lhEditandoId = null;
};

async function _lhGuardarSilencioso() {
  if (!_lhEditandoId) return true;
  const nombre = document.getElementById('lh-modal-nombre').value.trim();
  if (!nombre) return false;
  const roles = LH_TODOS_ROLES
    .filter(r => document.getElementById('lhcb-' + r.id)?.checked)
    .map(r => r.id);
  const data = { nombre, roles, noDisponible: _lhModalNoDisp };
  if (_lhModalSexo) data.sexo = _lhModalSexo;
  else {
    const existing = publicadores.find(p => p.id === _lhEditandoId);
    if (existing?.sexo) data.sexo = null;
  }
  try {
    await updateDoc(doc(db, 'congregaciones', congreId, 'publicadores', _lhEditandoId), data);
    const idx = publicadores.findIndex(p => p.id === _lhEditandoId);
    if (idx >= 0) publicadores[idx] = { ...publicadores[idx], ...data };
    publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    return true;
  } catch(e) { return false; }
}

window.navHermanoVM = async function(dir) {
  const idx = _lhListaVisible.findIndex(p => p.id === _lhEditandoId);
  if (idx === -1) return;
  const next = _lhListaVisible[idx + dir];
  if (!next) return;
  if (_lhEditandoId) {
    const ok = await _lhGuardarSilencioso();
    if (ok) { _lhFiltrar(); uiToast('Guardado', 'success'); }
    else       uiToast('No se pudo guardar', 'error');
  }
  abrirEditarVM(next.id);
};

window.guardarHermanoVM = async function() {
  const nombre = document.getElementById('lh-modal-nombre').value.trim();
  if (!nombre) { uiToast('Ingresá un nombre', 'error'); return; }
  const status = document.getElementById('lh-modal-status');
  status.style.color = '#888'; status.textContent = 'Guardando…';
  if (!_lhEditandoId) {
    const roles = LH_TODOS_ROLES
      .filter(r => document.getElementById('lhcb-' + r.id)?.checked)
      .map(r => r.id);
    const data = { nombre, roles, activo: true, noDisponible: _lhModalNoDisp };
    if (_lhModalSexo) data.sexo = _lhModalSexo;
    try {
      const ref = await addDoc(_lhPubCol(), data);
      publicadores.push({ id: ref.id, ...data });
      publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
      cerrarModalHermanoVM();
      _lhFiltrar();
      uiToast('Hermano agregado', 'success');
    } catch(e) {
      status.style.color = '#F09595'; status.textContent = 'Error: ' + e.message;
    }
    return;
  }
  const ok = await _lhGuardarSilencioso();
  if (ok) { cerrarModalHermanoVM(); _lhFiltrar(); uiToast('Guardado', 'success'); }
  else     { status.style.color = '#F09595'; status.textContent = 'Error al guardar'; }
};

window.confirmarEliminarVM = async function(id, nombre) {
  const ok = await uiConfirm({
    title: 'Eliminar hermano',
    msg: `¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar', cancelText: 'Cancelar', type: 'danger',
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'congregaciones', congreId, 'publicadores', id));
    publicadores = publicadores.filter(p => p.id !== id);
    _lhFiltrar();
    uiToast('Eliminado', 'success');
  } catch(e) { uiToast('Error: ' + e.message, 'error'); }
};

window.toggleSexoVM = async function(id, currentSexo) {
  const nextSexo = currentSexo === 'H' ? 'M' : currentSexo === 'M' ? null : 'H';
  try {
    await updateDoc(doc(db, 'congregaciones', congreId, 'publicadores', id), { sexo: nextSexo });
    const idx = publicadores.findIndex(p => p.id === id);
    if (idx >= 0) publicadores[idx] = { ...publicadores[idx], sexo: nextSexo };
    _lhFiltrar();
  } catch(e) { uiToast('Error: ' + e.message, 'error'); }
};
