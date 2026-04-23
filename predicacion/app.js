import { db } from '../shared/firebase.js';
import '../shared/auth.js';
import { logActividad } from '../shared/actividad.js';
import {
  doc, getDoc, setDoc, addDoc, updateDoc, deleteDoc,
  collection, getDocs, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

// ─────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function mesHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function fechaHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function navearMes(iso, delta) {
  const [y, m] = iso.split('-').map(Number);
  let nm = m + delta, ny = y;
  if (nm > 12) { nm = 1;  ny++; }
  if (nm < 1)  { nm = 12; ny--; }
  return `${ny}-${String(nm).padStart(2,'0')}`;
}

function fmtMes(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${MESES[m - 1]} ${y}`;
}

function fmtFecha(iso) {
  // '2026-04-06' → '6 de abr'
  const [, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES_CORTOS[m - 1]}`;
}

function compareMes(a, b) {
  return a.localeCompare(b);
}

function fmtTiempo(mins) {
  if (!mins || mins <= 0) return '0 min';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function fmtTiempoSoloHoras(mins) {
  if (!mins || mins <= 0) return '0 h';
  const horas = mins / 60;
  const rounded = Number.isInteger(horas) ? String(horas) : horas.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  return `${rounded} h`;
}

function fmtHorasInformadas(mins) {
  return `${Math.floor((mins || 0) / 60)} h`;
}

function listMesesEntre(desde, hasta) {
  const meses = [];
  let actual = desde;
  while (compareMes(actual, hasta) <= 0) {
    meses.push(actual);
    actual = navearMes(actual, 1);
  }
  return meses;
}

function esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function toast(msg, type = 'success') {
  if (window.uiToast) window.uiToast(msg, type);
}

function getRawMesData(iso) {
  if (iso === _mesMostrado) {
    return {
      minutos: _dataMes.rawMinutos || 0,
      ldcMinutos: _dataMes.rawLdcMinutos || 0,
      revisitas: _dataMes.revisitas || 0,
      estudios: _dataMes.estudios || 0,
    };
  }
  const mes = _historialMeses.find(item => item.id === iso);
  return {
    minutos: mes?.minutos || 0,
    ldcMinutos: mes?.ldcMinutos || 0,
    revisitas: mes?.revisitas || 0,
    estudios: mes?.estudios || 0,
  };
}

function calcularMesesConArrastre() {
  const ids = _historialMeses.map(m => m.id);
  const maxMes = ids.length ? ids.reduce((max, id) => compareMes(id, max) > 0 ? id : max, _mesMostrado) : _mesMostrado;
  const minMes = ids.length ? ids.reduce((min, id) => compareMes(id, min) < 0 ? id : min, _mesMostrado) : _mesMostrado;
  const meses = listMesesEntre(minMes, compareMes(maxMes, _mesMostrado) > 0 ? maxMes : _mesMostrado);
  const calculados = new Map();

  let arrastrePred = 0;
  let arrastreLdc = 0;

  meses.forEach(mes => {
    const raw = getRawMesData(mes);
    const totalPred = (raw.minutos || 0) + arrastrePred;
    const totalLdc = (raw.ldcMinutos || 0) + arrastreLdc;
    const cerrado = compareMes(mes, mesHoy()) < 0;
    const minutosMostrados = cerrado ? totalPred - (totalPred % 60) : totalPred;
    const ldcMostrados = cerrado ? totalLdc - (totalLdc % 60) : totalLdc;

    calculados.set(mes, {
      id: mes,
      minutos: minutosMostrados,
      ldcMinutos: ldcMostrados,
      rawMinutos: raw.minutos || 0,
      rawLdcMinutos: raw.ldcMinutos || 0,
      revisitas: raw.revisitas || 0,
      estudios: raw.estudios || 0,
      arrastreEntradaMinutos: arrastrePred,
      arrastreEntradaLdcMinutos: arrastreLdc,
      cerrado,
    });

    arrastrePred = totalPred % 60;
    arrastreLdc = totalLdc % 60;
  });

  return calculados;
}

function getMesCalculado(iso) {
  return calcularMesesConArrastre().get(iso) || {
    id: iso,
    minutos: 0,
    ldcMinutos: 0,
    rawMinutos: 0,
    rawLdcMinutos: 0,
    revisitas: 0,
    estudios: 0,
    arrastreEntradaMinutos: 0,
    arrastreEntradaLdcMinutos: 0,
    cerrado: compareMes(iso, mesHoy()) < 0,
  };
}

// ─────────────────────────────────────────
//   ESTADO — declarado antes del await
// ─────────────────────────────────────────
let _uid         = '';
let _mesMostrado = mesHoy();
let _diasMes     = [];   // [{ id, fecha, minutos }] del mes actual, ordenado por fecha desc
let _dataMes     = { minutos: 0, ldcMinutos: 0, rawMinutos: 0, rawLdcMinutos: 0, revisitas: 0, estudios: 0 };
let _mesExiste   = false;
let _historialMeses = [];

// Timer
let _timerInterval = null;
let _timerStart    = 0;
let _timerAccum    = 0;
let _timerRunning  = false;
let _timerInicioTs = null; // timestamp real del inicio de la sesión activa

let _grupoId    = null; // grupoId del publicador vinculado
let _grupoColor = null; // color hex del grupo

// Debounce para contadores
let _saveTimeout = null;
function scheduleGuardarContadores() {
  clearTimeout(_saveTimeout);
  _saveTimeout = setTimeout(guardarContadores, 600);
}

// Estado modal contacto
let _contactoTipo = 'revisita';
let _contactoId   = null;
let _predicacionInitDone = false;
let _esPrecursorRegular  = false;
let _esPrecursorAuxiliar = false;
let _metaMensualPersonal = null; // horas (number) | null
let _editandoMeta        = false;

// ─────────────────────────────────────────
//   AUTH CHECK
// ─────────────────────────────────────────
try {
  await window.authGuard('acceso_predicacion');
} catch {}

const _user = await window.waitForAuth();
const _rolesUsuario = Array.isArray(_user?.appRoles)
  ? _user.appRoles
  : (_user?.appRol ? [_user.appRol] : []);
_esPrecursorRegular  = _rolesUsuario.includes('precursor_regular');
_esPrecursorAuxiliar = _rolesUsuario.includes('precursor_auxiliar');

if (!_user || _user.isAnonymous) {
  showView('view-noauth');
} else {
  init(_user.uid);
}

window.predicacionLoginRequired = async () => {
  try {
    const current = window.currentUser;
    if (current?.isAnonymous && typeof window.linkWithGoogle === 'function') {
      await window.linkWithGoogle();
    } else if (typeof window.signInWithGoogle === 'function') {
      await window.signInWithGoogle();
    }
    window.location.replace('/predicacion/index.html');
  } catch (err) {
    console.error('[predicacion] No se pudo completar el login requerido:', err);
  }
};

window.addEventListener('authStateChanged', ({ detail: { user } }) => {
  if (!user || user.isAnonymous) {
    if (!_predicacionInitDone) showView('view-noauth');
    return;
  }
  if (_predicacionInitDone) return;
  init(user.uid);
});

// ─────────────────────────────────────────
//   INIT
// ─────────────────────────────────────────
async function init(uid) {
  _predicacionInitDone = true;
  _uid = uid;
  showView('view-app');
  renderMonthLabel();

  // Sincronizar roles y grupoId del publicador vinculado
  if (_user?.matchedPublisherId && _user?.congregacionId) {
    try {
      const pubSnap = await getDoc(doc(db, 'congregaciones', _user.congregacionId, 'publicadores', _user.matchedPublisherId));
      if (pubSnap.exists()) {
        const pubData = pubSnap.data();
        const pubRoles = pubData.roles || [];
        if (pubRoles.includes('PRECURSOR_REGULAR'))  _esPrecursorRegular  = true;
        if (pubRoles.includes('PRECURSOR_AUXILIAR'))  _esPrecursorAuxiliar = true;
        _grupoId = pubData.grupoId || null;
      }
    } catch {}
    // Cargar color del grupo
    if (_grupoId && _user?.congregacionId) {
      try {
        const grupoSnap = await getDoc(doc(db, 'congregaciones', _user.congregacionId, 'grupos', String(_grupoId)));
        if (grupoSnap.exists()) _grupoColor = grupoSnap.data().color || null;
      } catch {}
    }
  }
  cargarSalidasSemana();

  // Meta mensual personal (guardada en el doc del usuario)
  _metaMensualPersonal = typeof _user?.metaMensualHoras === 'number' ? _user.metaMensualHoras : null;

  if (_user?.congregacionId) logActividad(_user.congregacionId, 'predicacion', 'apertura');

  await cargarHistorial(false);
  await cargarMes();
  renderHistorial();
  renderMetas();
  cargarContactos('revisita');
  cargarContactos('estudio');
}

// ─────────────────────────────────────────
//   TABS
// ─────────────────────────────────────────
window.switchTab = function(tab) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`tab-btn-${tab}`).classList.add('active');
};

// ─────────────────────────────────────────
//   FIRESTORE — REFS
// ─────────────────────────────────────────
function mesRef(mes) {
  return doc(db, 'usuarios', _uid, 'predicacion', mes);
}

function diasRef(mes) {
  return collection(db, 'usuarios', _uid, 'predicacion', mes, 'dias');
}

function diaRef(mes, id) {
  return doc(db, 'usuarios', _uid, 'predicacion', mes, 'dias', id);
}

// ─────────────────────────────────────────
//   CARGAR MES
// ─────────────────────────────────────────
async function cargarMes() {
  try {
    // Carga el doc padre (revisitas/estudios) y la subcolección de días en paralelo
    const [parentSnap, diasSnap] = await Promise.all([
      getDoc(mesRef(_mesMostrado)),
      getDocs(diasRef(_mesMostrado)),
    ]);

    const parentData = parentSnap.exists() ? parentSnap.data() : {};
    _dataMes.revisitas = parentData.revisitas || 0;
    _dataMes.estudios  = parentData.estudios  || 0;

    _diasMes = [];
    diasSnap.forEach(d => _diasMes.push({ id: d.id, ...d.data() }));
    _diasMes.sort((a, b) => b.fecha.localeCompare(a.fecha)); // más reciente primero

    const totalDias = _diasMes.reduce((s, d) => s + (d.minutos || 0), 0);
    const totalLdcDias = _diasMes.reduce((s, d) => s + (d.ldcMinutos || 0), 0);
    // Si hay días individuales usamos su suma; si no, usamos el total cacheado del doc padre (datos legacy)
    _dataMes.rawMinutos = _diasMes.length > 0 ? totalDias : (parentData.minutos || 0);
    _dataMes.rawLdcMinutos = _diasMes.length > 0 ? totalLdcDias : (parentData.ldcMinutos || 0);
    const mesCalculado = getMesCalculado(_mesMostrado);
    _dataMes.minutos = mesCalculado.minutos;
    _dataMes.ldcMinutos = mesCalculado.ldcMinutos;
    _mesExiste = parentSnap.exists() || _diasMes.length > 0;
  } catch (err) {
    console.error('[predicacion] Error al cargar mes:', err);
  }
  renderStats();
}

// ─────────────────────────────────────────
//   GUARDAR
// ─────────────────────────────────────────

// Guarda un día individual y actualiza el total en el doc padre
async function guardarDia(fecha, minutos, extras = {}) {
  const ldcMinutos = Math.max(0, extras.ldcMinutos || 0);
  const newRef = await addDoc(diasRef(_mesMostrado), {
    fecha,
    minutos,
    ldcMinutos,
    creadoEn: serverTimestamp(),
  });

  // Actualiza estado local sin refetch
  _diasMes.push({ id: newRef.id, fecha, minutos, ldcMinutos });
  _diasMes.sort((a, b) => b.fecha.localeCompare(a.fecha));
  _dataMes.rawMinutos = _diasMes.reduce((s, d) => s + (d.minutos || 0), 0);
  _dataMes.rawLdcMinutos = _diasMes.reduce((s, d) => s + (d.ldcMinutos || 0), 0);
  const mesCalculado = getMesCalculado(_mesMostrado);
  _dataMes.minutos = mesCalculado.minutos;
  _dataMes.ldcMinutos = mesCalculado.ldcMinutos;
  _mesExiste = true;

  // Actualiza el total en el doc padre (para que el historial lo lea rápido)
  await setDoc(mesRef(_mesMostrado), {
    minutos:   _dataMes.rawMinutos,
    ldcMinutos: _dataMes.rawLdcMinutos,
    revisitas: _dataMes.revisitas || 0,
    estudios:  _dataMes.estudios  || 0,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  if (_user?.congregacionId) logActividad(_user.congregacionId, 'predicacion', 'guardado', 'Tiempo registrado');
}

// Solo guarda revisitas/estudios (contadores)
async function guardarContadores() {
  _mesExiste = true;
  await setDoc(mesRef(_mesMostrado), {
    minutos:   _dataMes.rawMinutos || 0,
    ldcMinutos: _dataMes.rawLdcMinutos || 0,
    revisitas: _dataMes.revisitas || 0,
    estudios:  _dataMes.estudios  || 0,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Elimina un día y recalcula el total
window.eliminarDia = async function(id) {
  const ok = await window.uiConfirm({
    title: 'Eliminar día',
    msg: '¿Eliminar este registro?',
    confirmText: 'Eliminar',
    type: 'danger',
  });
  if (!ok) return;

  await deleteDoc(diaRef(_mesMostrado, id));
  _diasMes = _diasMes.filter(d => d.id !== id);
  _dataMes.rawMinutos = _diasMes.reduce((s, d) => s + (d.minutos || 0), 0);
  _dataMes.rawLdcMinutos = _diasMes.reduce((s, d) => s + (d.ldcMinutos || 0), 0);
  const mesCalculado = getMesCalculado(_mesMostrado);
  _dataMes.minutos = mesCalculado.minutos;
  _dataMes.ldcMinutos = mesCalculado.ldcMinutos;
  renderStats();

  // Actualiza total en padre
  await setDoc(mesRef(_mesMostrado), {
    minutos:   _dataMes.rawMinutos || 0,
    ldcMinutos: _dataMes.rawLdcMinutos || 0,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Refresca historial para que el total se vea actualizado
  cargarHistorial();
};

// ─────────────────────────────────────────
//   HISTORIAL
// ─────────────────────────────────────────
async function cargarHistorial(render = true) {
  const cont = document.getElementById('hist-container');
  try {
    const snap = await getDocs(collection(db, 'usuarios', _uid, 'predicacion'));
    _historialMeses = [];
    snap.forEach(d => _historialMeses.push({ id: d.id, ...d.data() }));
    _historialMeses.sort((a, b) => b.id.localeCompare(a.id));
    if (render) {
      const mesCalculado = getMesCalculado(_mesMostrado);
      _dataMes.minutos = mesCalculado.minutos;
      _dataMes.ldcMinutos = mesCalculado.ldcMinutos;
      renderHistorial();
      renderMetas();
      renderStats();
    }
  } catch {
    cont.innerHTML = '<div class="hist-empty">Error al cargar el historial</div>';
  }
}

// ─────────────────────────────────────────
//   FIRESTORE — CONTACTOS
// ─────────────────────────────────────────
function contactosRef(tipo) {
  return collection(db, 'usuarios', _uid, tipo === 'revisita' ? 'revisitas' : 'estudios');
}

function contactoDocRef(tipo, id) {
  return doc(db, 'usuarios', _uid, tipo === 'revisita' ? 'revisitas' : 'estudios', id);
}

async function cargarContactos(tipo) {
  const listEl = document.getElementById(tipo === 'revisita' ? 'revisitas-list' : 'estudios-list');
  try {
    const snap = await getDocs(contactosRef(tipo));
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    items.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'));
    renderContactos(tipo, items);
  } catch {
    listEl.innerHTML = '<div class="hist-empty">Error al cargar</div>';
  }
}

// ─────────────────────────────────────────
//   RENDER
// ─────────────────────────────────────────
function renderMonthLabel() {
  document.getElementById('month-label').textContent = fmtMes(_mesMostrado);
  document.getElementById('month-next-btn').disabled = (_mesMostrado >= mesHoy());
  const histSub = document.getElementById('hist-section-sub');
  if (histSub) histSub.textContent = `Movimientos de ${fmtMes(_mesMostrado)}`;
}

function renderStats() {
  const mesCalculado = getMesCalculado(_mesMostrado);
  _dataMes.minutos = mesCalculado.minutos;
  _dataMes.ldcMinutos = mesCalculado.ldcMinutos;

  const sinActividad =
    (_dataMes.minutos || 0) === 0 &&
    (_dataMes.ldcMinutos || 0) === 0 &&
    (_dataMes.revisitas || 0) === 0 &&
    (_dataMes.estudios || 0) === 0;

  document.getElementById('mes-vacio').style.display = sinActividad ? ''     : 'none';
  document.getElementById('mes-stats').style.display = sinActividad ? 'none' : '';

  if (!sinActividad) {
    document.getElementById('stat-tiempo').textContent    = fmtTiempo(_dataMes.minutos);
    document.getElementById('stat-ldc').textContent       = fmtTiempo(_dataMes.ldcMinutos || 0);
    document.getElementById('stat-revisitas').textContent = _dataMes.revisitas || 0;
    document.getElementById('stat-estudios').textContent  = _dataMes.estudios  || 0;
  }
  renderMetas();
}

function renderDiasMes() {
  const mesCalculado = getMesCalculado(_mesMostrado);
  const filas = [];

  if (mesCalculado.arrastreEntradaMinutos > 0) {
    filas.push(`
      <div class="hist-day-row hist-day-row-carry">
        <div class="hist-day-main">
          <span class="hist-day-date">Arrastre del mes anterior</span>
        </div>
        <span class="hist-day-time">${fmtTiempo(mesCalculado.arrastreEntradaMinutos)}</span>
      </div>
    `);
  }

  filas.push(..._diasMes.map(d => `
    <div class="hist-day-row">
      <div class="hist-day-main">
        <span class="hist-day-date">${fmtFecha(d.fecha)}</span>
        ${d.ldcMinutos ? '<span class="hist-day-badge">LDC</span>' : ''}
      </div>
      <span class="hist-day-time">${fmtTiempo(d.minutos)}</span>
      <button class="hist-day-del" onclick="eliminarDia('${d.id}')" title="Eliminar">×</button>
    </div>
  `));

  return filas.join('');
}

function renderHistorial() {
  const cont = document.getElementById('hist-container');
  if (!renderDiasMes()) {
    cont.innerHTML = '<div class="hist-empty">Todavía no agregaste movimientos en este mes</div>';
    return;
  }
  cont.innerHTML = `
    <div class="hist-card">
      <div class="hist-day-list">
        ${renderDiasMes()}
      </div>
    </div>`;
}

function getServicioDesdeMes(iso) {
  const [year, month] = iso.split('-').map(Number);
  return month >= 9 ? year : year - 1;
}

function listMesesServicio(servicioDesde) {
  const meses = [];
  for (let i = 0; i < 12; i++) {
    const year = i < 4 ? servicioDesde : servicioDesde + 1;
    const month = i < 4 ? 9 + i : i - 3;
    meses.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return meses;
}

function metaPct(actual, target) {
  if (!target || target <= 0) return 0;
  return Math.max(0, Math.min(100, (actual / target) * 100));
}

function renderAnimacionRitmo(servicioDesde, mesesServicio, actualAnual, metaAnual) {
  const mesIdx = mesesServicio.indexOf(_mesMostrado);
  const mesesElapsados = mesIdx >= 0 ? mesIdx + 1 : mesesServicio.length;
  const mesesRestantes = mesIdx >= 0 ? mesesServicio.length - mesIdx : 1;

  const expectedMinutos = (mesesElapsados / 12) * metaAnual;
  const faltanteAnual = Math.max(0, metaAnual - actualAnual);

  const actualPct = Math.min(100, Math.round((actualAnual / metaAnual) * 100));
  const expectedPct = Math.min(100, Math.round((expectedMinutos / metaAnual) * 100));

  const horasXMesNum = faltanteAnual > 0 && mesesRestantes > 0
    ? faltanteAnual / (mesesRestantes * 60)
    : 0;
  const horasXMes = Math.ceil(horasXMesNum * 2) / 2; // redondea hacia arriba al 0.5 más cercano

  let estado, badge, badgeClass, msg;
  if (actualAnual >= metaAnual) {
    estado = 'cumplida';
    badge = '¡Meta cumplida!';
    badgeClass = 'ritmo-badge-cumplida';
    msg = 'Completaste las 600 horas anuales.';
  } else if (expectedMinutos <= 0) {
    estado = 'normal';
    badge = 'Inicio del año';
    badgeClass = 'ritmo-badge-normal';
    msg = 'Comenzó el año de servicio.';
  } else {
    const ratio = actualAnual / expectedMinutos;
    if (ratio >= 1.1) {
      estado = 'liebre';
      badge = 'Adelantada';
      badgeClass = 'ritmo-badge-liebre';
      const extra = Math.round((actualAnual - expectedMinutos) / 60 * 10) / 10;
      msg = `Llevás ${extra > 0 ? extra + '\u00a0h' : 'algo'} más que el ritmo esperado.`;
    } else if (ratio >= 0.85) {
      estado = 'normal';
      badge = 'Al ritmo';
      badgeClass = 'ritmo-badge-normal';
      msg = 'Vas siguiendo el ritmo esperado.';
    } else {
      estado = 'tortuga';
      badge = 'Atrasada';
      badgeClass = 'ritmo-badge-tortuga';
      const faltan = Math.round((expectedMinutos - actualAnual) / 60 * 10) / 10;
      msg = `Llevás ${faltan > 0 ? faltan + '\u00a0h' : 'algo'} menos que el ritmo esperado.`;
    }
  }

  const emoji = estado === 'liebre' ? '🐇' : estado === 'tortuga' ? '🐢' : estado === 'cumplida' ? '🏆' : '🐇';
  const animClass = estado === 'liebre' ? 'anim-liebre' : estado === 'tortuga' ? 'anim-tortuga' : '';
  const animalLeft = Math.max(4, Math.min(94, actualPct));

  const needMsg = faltanteAnual > 0 && mesesRestantes > 0
    ? `<div class="ritmo-need-msg">Para alcanzar las 600\u00a0h necesitás <strong>${horasXMes}\u00a0h/mes</strong> en los próximos <strong>${mesesRestantes}\u00a0mes${mesesRestantes > 1 ? 'es' : ''}</strong>.</div>`
    : '';

  return `
    <div class="meta-card meta-ritmo-card estado-${estado}">
      <div class="meta-head">
        <div class="meta-title">Ritmo de servicio</div>
        <div class="meta-sub">${fmtServicioRango(servicioDesde)}</div>
      </div>
      <div class="ritmo-track-wrap">
        <div class="ritmo-track">
          <div class="ritmo-fill" style="width:${actualPct}%;"></div>
          ${expectedPct > 2 && expectedPct < 98 ? `<div class="ritmo-pace-marker" style="left:${expectedPct}%;"></div>` : ''}
          <div class="ritmo-animal ${animClass}" style="left:${animalLeft}%;">
            <span>${emoji}</span>
          </div>
        </div>
        <div class="ritmo-labels">
          <span>0 h</span>
          ${expectedPct > 8 && expectedPct < 92 ? `<span class="ritmo-pace-label" style="left:${expectedPct}%;">ritmo</span>` : ''}
          <span>600 h</span>
        </div>
      </div>
      <div class="ritmo-status-row">
        <span class="ritmo-badge ${badgeClass}">${badge}</span>
        <span class="ritmo-msg">${msg}</span>
      </div>
      ${needMsg}
    </div>`;
}

function findHistMes(iso) {
  return _historialMeses.find(m => m.id === iso) || null;
}

function fmtServicioRango(servicioDesde) {
  return `Sep ${servicioDesde} → Ago ${servicioDesde + 1}`;
}

function renderHistorialMesesAnteriores(meses) {
  if (!meses.length) {
    return `
      <div class="meta-history-empty">
        Sin meses anteriores registrados en este año de servicio.
      </div>`;
  }

  return `
    <div class="hist-card meta-history-card">
      <div class="hist-header">
        <span class="hist-header-cell">Mes</span>
        <span class="hist-header-cell">Tiempo</span>
        <span class="hist-header-cell">LDC</span>
        <span class="hist-header-cell">Rev</span>
        <span class="hist-header-cell">Est</span>
      </div>
      ${meses.map(m => `
        <div class="hist-row" data-mes="${m.id}" onclick="irAMes('${m.id}')">
          <span class="hist-mes">${fmtMes(m.id)}</span>
          <span class="hist-val">${fmtTiempo(m.minutos || 0)}</span>
          <span class="hist-val">${fmtTiempo(m.ldcMinutos || 0)} <span class="hist-val-dim">ldc</span></span>
          <span class="hist-val">${m.revisitas || 0} <span class="hist-val-dim">rev</span></span>
          <span class="hist-val">${m.estudios || 0} <span class="hist-val-dim">est</span></span>
        </div>
      `).join('')}
    </div>`;
}

function _metaMensualCard(actualMes, metaMensual, labelMes, extraHead = '') {
  const faltante = Math.max(0, metaMensual - actualMes);
  return `
    <div class="meta-card">
      <div class="meta-head">
        <div class="meta-title">Meta mensual</div>
        <div class="meta-sub" style="display:flex;gap:8px;align-items:center;">${labelMes}${extraHead}</div>
      </div>
      <div class="meta-main">
        <div class="meta-current">${fmtTiempo(actualMes)}</div>
        <div class="meta-target">de ${fmtTiempo(metaMensual)}</div>
      </div>
      <div class="meta-bar">
        <div class="meta-bar-fill" style="width:${metaPct(actualMes, metaMensual)}%;"></div>
      </div>
      <div class="meta-foot">
        ${faltante > 0 ? `Te faltan ${fmtTiempo(faltante)} para llegar a la meta.` : 'Meta mensual cumplida.'}
      </div>
    </div>`;
}

function renderMetas() {
  const cont = document.getElementById('metas-container');
  if (!cont) return;

  const servicioDesde   = getServicioDesdeMes(_mesMostrado);
  const mesesServicio   = listMesesServicio(servicioDesde);
  const mesesCalculados = calcularMesesConArrastre();
  const mesesAnteriores = mesesServicio
    .filter(mes => compareMes(mes, _mesMostrado) < 0)
    .map(mes => mesesCalculados.get(mes))
    .filter(Boolean)
    .filter(m => (m.minutos || 0) > 0 || (m.ldcMinutos || 0) > 0 || (m.revisitas || 0) > 0 || (m.estudios || 0) > 0)
    .sort((a, b) => b.id.localeCompare(a.id));

  const actualMes = _dataMes.minutos || 0;

  const historialCard = `
    <div class="meta-card">
      <div class="meta-head">
        <div class="meta-title">Historial anterior</div>
        <div class="meta-sub">${fmtServicioRango(servicioDesde)}</div>
      </div>
      ${renderHistorialMesesAnteriores(mesesAnteriores)}
    </div>`;

  // ── Precursor regular: 50 h/mes + 600 h/año + ritmo ────────────
  if (_esPrecursorRegular) {
    const metaMensual  = 50 * 60;
    const metaAnual    = 600 * 60;
    const actualAnual  = mesesServicio.reduce((s, mes) => s + (mesesCalculados.get(mes)?.minutos || 0), 0);
    const faltanteAnual = Math.max(0, metaAnual - actualAnual);

    cont.innerHTML = `
      <div class="metas-grid">
        ${_metaMensualCard(actualMes, metaMensual, fmtMes(_mesMostrado))}
        <div class="meta-card">
          <div class="meta-head">
            <div class="meta-title">Meta anual</div>
            <div class="meta-sub">${fmtServicioRango(servicioDesde)}</div>
          </div>
          <div class="meta-main">
            <div class="meta-current">${fmtTiempo(actualAnual)}</div>
            <div class="meta-target">de ${fmtTiempo(metaAnual)}</div>
          </div>
          <div class="meta-bar">
            <div class="meta-bar-fill" style="width:${metaPct(actualAnual, metaAnual)}%;"></div>
          </div>
          <div class="meta-foot">
            ${faltanteAnual > 0 ? `Te faltan ${fmtTiempo(faltanteAnual)} para completar el año de servicio.` : 'Meta anual cumplida.'}
          </div>
        </div>
        ${renderAnimacionRitmo(servicioDesde, mesesServicio, actualAnual, metaAnual)}
        ${historialCard}
      </div>`;
    return;
  }

  // ── Precursor auxiliar: 30 h/mes, sin anual ────────────────────
  if (_esPrecursorAuxiliar) {
    cont.innerHTML = `
      <div class="metas-grid">
        ${_metaMensualCard(actualMes, 30 * 60, `${fmtMes(_mesMostrado)} · Auxiliar`)}
        ${historialCard}
      </div>`;
    return;
  }

  // ── Meta personal (publicador con meta propia) ──────────────────
  if (_metaMensualPersonal) {
    const extraHead = `
      <button onclick="iniciarFijarMeta()" class="meta-action-btn">Editar</button>
      <button onclick="quitarMetaPersonal()" class="meta-action-btn">Quitar</button>`;
    cont.innerHTML = `
      <div class="metas-grid">
        ${_metaMensualCard(actualMes, _metaMensualPersonal * 60, fmtMes(_mesMostrado), extraHead)}
        ${historialCard}
      </div>`;
    return;
  }

  // ── Sin meta: form inline o mensaje vacío ──────────────────────
  const contenido = _editandoMeta ? `
    <div class="meta-card">
      <div class="meta-head"><div class="meta-title">Fijar meta mensual</div></div>
      <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="number" id="meta-personal-input" min="1" max="200"
            class="modal-input" style="width:80px;text-align:center;box-sizing:border-box;"
            placeholder="hs" inputmode="numeric">
          <span style="color:var(--text-secondary);font-size:14px;">horas / mes</span>
        </div>
        <div style="display:flex;gap:8px;">
          <button class="pred-btn pred-btn-primary" onclick="guardarMetaPersonal()" style="flex:1;">Guardar</button>
          <button class="pred-btn pred-btn-ghost"   onclick="cancelarFijarMeta()"   style="flex:1;">Cancelar</button>
        </div>
      </div>
    </div>` : `
    <div class="meta-empty" style="display:flex;flex-direction:column;align-items:center;gap:12px;">
      <span>Sin metas configuradas.</span>
      <button onclick="iniciarFijarMeta()" class="pred-btn pred-btn-ghost" style="font-size:13px;">+ Fijar meta mensual</button>
    </div>`;

  cont.innerHTML = `
    <div class="metas-grid">
      ${contenido}
      ${historialCard}
    </div>`;
}

function renderContactos(tipo, items) {
  const listEl = document.getElementById(tipo === 'revisita' ? 'revisitas-list' : 'estudios-list');
  if (!items.length) {
    const txt = tipo === 'revisita' ? 'Sin revisitas registradas' : 'Sin estudios registrados';
    listEl.innerHTML = `<div class="contact-card"><div class="contact-empty">${txt}</div></div>`;
    return;
  }
  const filas = items.map(item => `
    <div class="contact-item" onclick="abrirContacto('${tipo}', '${item.id}')">
      <div class="contact-item-info">
        <div class="contact-item-nombre">${esc(item.nombre)}</div>
        ${item.notas ? `<div class="contact-item-notas">${esc(item.notas)}</div>` : ''}
      </div>
      <button class="contact-item-del"
        onclick="event.stopPropagation(); eliminarContacto('${tipo}', '${item.id}', '${esc(item.nombre)}')"
        title="Eliminar">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="1.7"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  `).join('');
  listEl.innerHTML = `<div class="contact-card">${filas}</div>`;
}

// ─────────────────────────────────────────
//   META PERSONAL
// ─────────────────────────────────────────
window.iniciarFijarMeta = function() {
  _editandoMeta = true;
  renderMetas();
  setTimeout(() => document.getElementById('meta-personal-input')?.focus(), 50);
};

window.cancelarFijarMeta = function() {
  _editandoMeta = false;
  renderMetas();
};

window.guardarMetaPersonal = async function() {
  const val = parseInt(document.getElementById('meta-personal-input')?.value, 10);
  if (!val || val < 1 || val > 200) {
    uiToast('Ingresá un valor entre 1 y 200 horas', 'error');
    return;
  }
  try {
    await updateDoc(doc(db, 'usuarios', _uid), { metaMensualHoras: val });
    _metaMensualPersonal = val;
    _editandoMeta = false;
    renderMetas();
    uiToast('Meta guardada', 'success');
  } catch {
    uiToast('Error al guardar', 'error');
  }
};

window.quitarMetaPersonal = async function() {
  const ok = await uiConfirm({
    title: 'Quitar meta', confirmText: 'Quitar', cancelText: 'Cancelar', type: 'warn',
    msg: '¿Querés quitar tu meta mensual personal?',
  });
  if (!ok) return;
  try {
    await updateDoc(doc(db, 'usuarios', _uid), { metaMensualHoras: null });
    _metaMensualPersonal = null;
    renderMetas();
    uiToast('Meta eliminada', 'success');
  } catch {
    uiToast('Error al guardar', 'error');
  }
};

// ─────────────────────────────────────────
//   NAVEGACIÓN DE MES
// ─────────────────────────────────────────
window.navMes = async function(delta) {
  _mesMostrado = navearMes(_mesMostrado, delta);
  renderMonthLabel();
  await cargarMes();
  renderHistorial();
  renderMetas();
};

window.irAMes = async function(mes) {
  _mesMostrado = mes;
  renderMonthLabel();
  await cargarMes();
  renderHistorial();
  renderMetas();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function actualizarHistActividad() {
  document.querySelectorAll('#hist-container .hist-row').forEach(row => {
    row.classList.toggle('hist-row-active', row.dataset.mes === _mesMostrado);
  });
}

// ─────────────────────────────────────────
//   CONTADORES +/−
// ─────────────────────────────────────────
window.cambiarContador = function(campo, delta) {
  _dataMes[campo] = Math.max(0, (_dataMes[campo] || 0) + delta);
  _mesExiste = true;
  renderStats();
  scheduleGuardarContadores();
};

window.exportarResumenWhatsApp = function() {
  const texto = [
    `Resumen de predicación — ${fmtMes(_mesMostrado)}`,
    `Horas: ${fmtHorasInformadas(_dataMes.minutos || 0)}`,
    `LDC: ${fmtHorasInformadas(_dataMes.ldcMinutos || 0)}`,
    `Estudios: ${_dataMes.estudios || 0}`,
  ].join('\n');
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank', 'noopener');
};

// ─────────────────────────────────────────
//   AGREGAR TIEMPO (cronómetro o manual)
// ─────────────────────────────────────────
window.abrirAgregarTiempo = function() {
  document.getElementById('add-fecha').value = fechaHoy();
  document.getElementById('add-tipo').value  = 'predicacion';
  document.getElementById('add-horas').value = '';
  document.getElementById('add-mins').value  = '';
  document.getElementById('modal-add-tiempo').style.display = 'flex';
  setTimeout(() => document.getElementById('add-horas').focus(), 60);
};

window.cerrarAgregarTiempo = function() {
  document.getElementById('modal-add-tiempo').style.display = 'none';
};

window.sumarTiempoRapido = function(horas, mins) {
  const horasEl = document.getElementById('add-horas');
  const minsEl = document.getElementById('add-mins');
  const totalActual = (Math.max(0, parseInt(horasEl.value) || 0) * 60) + (Math.max(0, parseInt(minsEl.value) || 0));
  const totalNuevo = totalActual + (horas * 60) + mins;
  horasEl.value = String(Math.floor(totalNuevo / 60));
  minsEl.value = String(totalNuevo % 60).padStart(2, '0');
};

window.guardarAgregarTiempo = async function() {
  const fecha = document.getElementById('add-fecha').value;
  const tipo  = document.getElementById('add-tipo').value;
  const h     = Math.max(0, parseInt(document.getElementById('add-horas').value) || 0);
  const m     = Math.max(0, Math.min(59, parseInt(document.getElementById('add-mins').value) || 0));
  const mins  = h * 60 + m;

  if (!fecha) { toast('Seleccioná una fecha', 'error'); return; }
  if (mins < 1) { toast('Ingresá al menos 1 minuto', 'error'); return; }

  // Si la fecha es de otro mes, navegar a ese mes
  const mesDeFecha = fecha.slice(0, 7);
  if (mesDeFecha !== _mesMostrado) {
    _mesMostrado = mesDeFecha;
    renderMonthLabel();
    await cargarMes();
    renderHistorial();
    renderMetas();
  }

  cerrarAgregarTiempo();
  await guardarDia(fecha, mins, { ldcMinutos: tipo === 'ldc' ? mins : 0 });
  renderStats();
  await cargarHistorial();
  toast(`${fmtTiempo(mins)} agregados — ${fmtFecha(fecha)}`);
};

// ─────────────────────────────────────────
//   CONTACTOS — CRUD
// ─────────────────────────────────────────
window.abrirContacto = async function(tipo, id) {
  _contactoTipo = tipo;
  _contactoId   = id;

  const titulo = id
    ? (tipo === 'revisita' ? 'Editar revisita' : 'Editar estudio')
    : (tipo === 'revisita' ? 'Nueva revisita'  : 'Nuevo estudio');
  document.getElementById('modal-contacto-title').textContent = titulo;

  if (id) {
    const snap = await getDoc(contactoDocRef(tipo, id));
    const data = snap.exists() ? snap.data() : {};
    document.getElementById('contacto-nombre').value = data.nombre || '';
    document.getElementById('contacto-notas').value  = data.notas  || '';
  } else {
    document.getElementById('contacto-nombre').value = '';
    document.getElementById('contacto-notas').value  = '';
  }

  document.getElementById('modal-contacto').style.display = 'flex';
  setTimeout(() => document.getElementById('contacto-nombre').focus(), 60);
};

window.cerrarContacto = function() {
  document.getElementById('modal-contacto').style.display = 'none';
};

window.guardarContacto = async function() {
  const nombre = document.getElementById('contacto-nombre').value.trim();
  const notas  = document.getElementById('contacto-notas').value.trim();
  if (!nombre) { toast('Ingresá un nombre', 'error'); return; }

  const data = { nombre, notas, updatedAt: serverTimestamp() };

  if (_contactoId) {
    await updateDoc(contactoDocRef(_contactoTipo, _contactoId), data);
  } else {
    data.creadoEn = serverTimestamp();
    await addDoc(contactosRef(_contactoTipo), data);
  }

  cerrarContacto();
  toast(_contactoId ? 'Guardado' : 'Agregado');
  cargarContactos(_contactoTipo);
};

window.eliminarContacto = async function(tipo, id, nombre) {
  const ok = await window.uiConfirm({
    title: 'Eliminar',
    msg: `¿Eliminar a ${nombre}?`,
    confirmText: 'Eliminar',
    type: 'danger',
  });
  if (!ok) return;
  await deleteDoc(contactoDocRef(tipo, id));
  toast('Eliminado');
  cargarContactos(tipo);
};

// ─────────────────────────────────────────
//   CRONÓMETRO
// ─────────────────────────────────────────
function timerElapsedMs() {
  return _timerAccum + (_timerRunning ? Date.now() - _timerStart : 0);
}

function fmtTimer(ms) {
  const s = Math.floor(ms / 1000);
  return [
    String(Math.floor(s / 3600)).padStart(2, '0'),
    String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    String(s % 60).padStart(2, '0'),
  ].join(':');
}

function tickTimer() {
  const ms   = timerElapsedMs();
  const mins = Math.floor(ms / 60000);
  document.getElementById('timer-display').textContent = fmtTimer(ms);
  const wrap = document.getElementById('timer-add-wrap');
  const btn  = document.getElementById('timer-add-btn');
  if (ms > 0) {
    wrap.style.display = '';
    btn.textContent = mins >= 1 ? `+ Agregar ${mins} min al mes` : '+ Agregar al mes';
  } else {
    wrap.style.display = 'none';
  }
}

function _timerUpdateQuickBtns() {
  const qb = document.getElementById('timer-quick-btns');
  if (qb) qb.style.display = _timerRunning ? '' : 'none';
}

function _timerUpdateLabel() {
  const lbl = document.getElementById('timer-label');
  if (!lbl) return;
  if (_timerInicioTs) {
    const h = _timerInicioTs.getHours();
    const m = String(_timerInicioTs.getMinutes()).padStart(2, '0');
    lbl.textContent = `Iniciado a las ${h}:${m}`;
  } else {
    lbl.textContent = '';
  }
}

window.timerToggle = function() {
  const toggleBtn = document.getElementById('timer-toggle-btn');
  const display   = document.getElementById('timer-display');
  if (!_timerRunning) {
    if (!_timerInicioTs) _timerInicioTs = new Date();
    _timerRunning  = true;
    _timerStart    = Date.now();
    _timerInterval = setInterval(tickTimer, 1000);
    toggleBtn.textContent = 'Pausar';
    display.classList.add('running');
  } else {
    _timerAccum  += Date.now() - _timerStart;
    _timerRunning = false;
    clearInterval(_timerInterval);
    _timerInterval = null;
    toggleBtn.textContent = 'Continuar';
    display.classList.remove('running');
    tickTimer();
  }
  _timerUpdateQuickBtns();
  _timerUpdateLabel();
};

window.timerReset = function() {
  _timerRunning  = false;
  _timerInicioTs = null;
  clearInterval(_timerInterval);
  _timerInterval = null;
  _timerAccum    = 0;
  _timerStart    = 0;
  document.getElementById('timer-display').textContent = '00:00:00';
  document.getElementById('timer-display').classList.remove('running');
  document.getElementById('timer-toggle-btn').textContent = 'Iniciar';
  document.getElementById('timer-add-wrap').style.display = 'none';
  _timerUpdateQuickBtns();
  _timerUpdateLabel();
};

window.timerAgregarAlMes = async function() {
  const ms   = timerElapsedMs();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) { toast('Menos de 1 minuto registrado', 'error'); return; }

  timerReset();
  await guardarDia(fechaHoy(), mins);
  renderStats();
  await cargarHistorial();
  toast(`${fmtTiempo(mins)} agregados — ${fmtFecha(fechaHoy())}`);
};

// ─────────────────────────────────────────
//   SALIDAS DEL GRUPO (esta semana)
// ─────────────────────────────────────────
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DIAS_LARGO  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

function _lunesDeHoy() {
  const d = new Date();
  const day = d.getDay(); // 0=Dom
  const diff = (day === 0) ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function _domingoDeHoy() {
  const lunes = _lunesDeHoy();
  const dom = new Date(lunes);
  dom.setDate(dom.getDate() + 6);
  return dom;
}

function _isoFecha(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

async function cargarSalidasSemana() {
  const wrap = document.getElementById('salidas-semana-wrap');
  if (!wrap) return;

  // Sin grupo vinculado → mensaje
  if (!_grupoId) {
    wrap.innerHTML = `<div class="salidas-semana-empty">
      Tu perfil no tiene un grupo asignado.<br>El encargado puede vincularte desde el panel de administración.
    </div>`;
    return;
  }

  const lunes  = _isoFecha(_lunesDeHoy());
  const domingo = _isoFecha(_domingoDeHoy());

  try {
    const congreId = _user?.congregacionId;
    if (!congreId) throw new Error('Sin congregación');

    const snap = await getDocs(
      collection(db, 'congregaciones', congreId, 'salidas')
    );

    // Filtrar por grupoId y fechas de esta semana
    const salidaItems = []; // { fecha, hora, terr, enc, tipo }
    snap.forEach(d => {
      const data = d.data();
      if (String(data.grupoId) !== String(_grupoId)) return;
      (data.salidas || []).forEach(s => {
        if (!s.fecha) return;
        if (s.fecha >= lunes && s.fecha <= domingo) {
          salidaItems.push(s);
        }
      });
    });

    if (salidaItems.length === 0) {
      wrap.innerHTML = `<div class="salidas-semana-empty">
        No hay salidas registradas para tu grupo esta semana.
      </div>`;
      return;
    }

    // Ordenar por fecha y hora
    salidaItems.sort((a, b) => {
      const fa = a.fecha + (a.hora || '');
      const fb = b.fecha + (b.hora || '');
      return fa.localeCompare(fb);
    });

    // Agrupar por fecha
    const porFecha = {};
    salidaItems.forEach(s => {
      if (!porFecha[s.fecha]) porFecha[s.fecha] = [];
      porFecha[s.fecha].push(s);
    });

    let html = '';
    Object.keys(porFecha).sort().forEach(fecha => {
      const d = new Date(fecha + 'T12:00:00');
      const diaNum  = d.getDate();
      const diaNom  = DIAS_LARGO[d.getDay()];
      const esHoy   = fecha === fechaHoy();
      html += `<div class="salidas-dia-label">${diaNom} ${diaNum}${esHoy ? ' · <span style="color:#E05277">Hoy</span>' : ''}</div>`;
      porFecha[fecha].forEach(s => {
        const horaFmt     = s.hora ? s.hora.replace('.', ':') : '—';
        const esTel       = s.tipo === 'tel';
        const terrTxt     = esTel ? 'Telefónica' : (s.terr && s.terr !== '—' ? `Territorio ${s.terr}` : 'Sin territorio');
        const encTxt      = (!esTel && s.enc && s.enc !== '—') ? `<div class="sc-pred-enc">${s.enc}</div>` : '';
        const borderColor = esTel ? '#1D9E75' : (_grupoColor || '#E05277');
        const hasTerr     = !esTel && s.terr && s.terr !== '—';
        const congreId    = _user?.congregacionId || sessionStorage.getItem('congreId') || '';
        const terrParam   = encodeURIComponent(String(s.terr || ''));
        const mapaUrl     = `../territorios/mapa.html?modo=registrar&enprogreso=${terrParam}&terrid=${terrParam}&congre=${congreId}`;
        const terrLabel   = `Territorio ${s.terr}`;
        const mapBtn      = hasTerr
          ? `<button type="button" class="sc-pred-map-btn" title="Ver en mapa"
               onclick="abrirMapaOverlay('${mapaUrl.replace(/'/g, "\\'")}','${terrLabel.replace(/'/g, "\\'")}')">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                 <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
                 <line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
               </svg>
             </button>`
          : '';
        html += `
          <div class="salida-card-pred" style="border-left-color:${borderColor}">
            <div class="sc-pred-row">
              <div class="sc-pred-content">
                <div class="sc-pred-hora">${horaFmt} <span class="sc-pred-tipobadge">${esTel ? 'Telefónica' : 'Campo'}</span></div>
                <div class="sc-pred-meta">${terrTxt}${s.cond && s.cond !== '—' ? ` · ${s.cond}` : ''}</div>
                ${encTxt}
              </div>
              ${mapBtn}
            </div>
          </div>`;
      });
    });

    wrap.innerHTML = html;
  } catch (err) {
    wrap.innerHTML = `<div class="salidas-semana-empty">Error al cargar salidas.</div>`;
    console.error('[predicacion] cargarSalidasSemana:', err);
  }
}

// ─────────────────────────────────────────
//   MAPA OVERLAY
// ─────────────────────────────────────────
window.abrirMapaOverlay = function(url, titulo) {
  const ov = document.getElementById('mapa-overlay');
  const fr = document.getElementById('mapa-frame');
  const tl = document.getElementById('mapa-ov-title');
  if (tl) tl.textContent = titulo || 'Mapa';
  fr.src = url;
  ov.style.display = 'flex';
};

window.cerrarMapaOverlay = function() {
  const ov = document.getElementById('mapa-overlay');
  const fr = document.getElementById('mapa-frame');
  ov.style.display = 'none';
  fr.src = '';
};
