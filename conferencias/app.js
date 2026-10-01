import { db } from '../shared/firebase.js';
import '../shared/auth.js';
import { logActividad } from '../shared/actividad.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

await window.authGuard('acceso_conferencias');

if (!sessionStorage.getItem('congreId')) window.location.href = '../index.html';

const CONGRE_ID     = sessionStorage.getItem('congreId')     || '';
const CONGRE_NOMBRE = sessionStorage.getItem('congreNombre') || CONGRE_ID;

document.querySelectorAll('.js-congre').forEach(el => el.textContent = CONGRE_NOMBRE);

// ─────────────────────────────────────────
//   ESTADO
// ─────────────────────────────────────────
let _mes          = mesHoy();
let _conferencias = {};   // { id: { id, fecha, tipo, ... } }
let _semanasEsp   = {};   // { lunesISO: data }
let _publicadores = [];
let _congregaciones = [];
let _puedeEditar  = false;
let _soloMesActual = false;  // true para hermanas registradas: sin nav de mes, sin tabs extra
let _editandoId   = null;
let _editandoFecha = null;
let _editandoTipo = 'entrada';

// ─────────────────────────────────────────
//   HELPERS DE FECHA
// ─────────────────────────────────────────
function mesHoy() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

function fmtLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function navMesIso(iso, delta) {
  const [y, m] = iso.split('-').map(Number);
  let nm = m + delta, ny = y;
  if (nm > 12) { nm = 1; ny++; }
  if (nm < 1)  { nm = 12; ny--; }
  return `${ny}-${String(nm).padStart(2,'0')}`;
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_C = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtMesLargo(iso) {
  const [y, m] = iso.split('-').map(Number);
  return `${MESES[m-1]} ${y}`;
}

function fmtDia(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} de ${MESES_C[m-1]}`;
}

function getSabadosDelMes(iso) {
  const [y, m] = iso.split('-').map(Number);
  const sabados = [];
  const d = new Date(y, m - 1, 1);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  while (d.getMonth() === m - 1) {
    sabados.push(fmtLocal(d));
    d.setDate(d.getDate() + 7);
  }
  return sabados;
}

function lunesDeISO(iso) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return fmtLocal(d);
}

function hoyISO() { return fmtLocal(new Date()); }

// ─────────────────────────────────────────
//   FIRESTORE
// ─────────────────────────────────────────
const confCol  = () => collection(db, 'congregaciones', CONGRE_ID, 'conferencias');
const espCol   = () => collection(db, 'congregaciones', CONGRE_ID, 'semanasEspeciales');
const pubCol   = () => collection(db, 'congregaciones', CONGRE_ID, 'publicadores');
const circCol  = () => collection(db, 'congregaciones', CONGRE_ID, 'congregacionesCircuito');

async function cargarDatos() {
  const [confSnap, espSnap, pubSnap, circSnap] = await Promise.all([
    getDocs(query(confCol(), orderBy('fecha'))),
    getDocs(espCol()),
    getDocs(pubCol()),
    getDocs(circCol()),
  ]);

  _conferencias = {};
  confSnap.forEach(d => { _conferencias[d.id] = { id: d.id, ...d.data() }; });

  _semanasEsp = {};
  espSnap.forEach(d => { _semanasEsp[d.id] = d.data(); });

  _publicadores = [];
  pubSnap.forEach(d => { _publicadores.push({ id: d.id, ...d.data() }); });
  _publicadores.sort((a, b) => a.nombre.localeCompare(b.nombre));

  _congregaciones = [];
  circSnap.forEach(d => { _congregaciones.push({ id: d.id, ...d.data() }); });
  _congregaciones.sort((a, b) => a.nombre.localeCompare(b.nombre));
}

// ─────────────────────────────────────────
//   TABS
// ─────────────────────────────────────────
window.switchTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-btn-${tab}`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  if (tab === 'oradores') renderOradores();
  if (tab === 'circuito') renderCircuito();
};

// ─────────────────────────────────────────
//   RENDER MES
// ─────────────────────────────────────────
function renderMes() {
  document.getElementById('mes-label').textContent = fmtMesLargo(_mes);
  const sabados = getSabadosDelMes(_mes);
  const el = document.getElementById('sabados-list');
  const hoy = hoyISO();

  el.innerHTML = sabados.map(sab => {
    const especial = _semanasEsp[lunesDeISO(sab)];
    const confs    = Object.values(_conferencias).filter(c => c.fecha === sab);
    const [, , d]  = sab.split('-').map(Number);
    const esPasado = sab < hoy;
    const esHoy    = sab === hoy;

    let cuerpo = '';

    if (especial) {
      const labels = {
        conmemoracion:   'Conmemoración',
        superintendente: 'Semana del Superintendente',
        asamblea: especial.subtipo === 'regional' ? 'Asamblea Regional' : 'Asamblea de Circuito',
      };
      cuerpo = `<div class="sab-especial">⭐ ${labels[especial.tipo] || 'Semana especial'}</div>`;

    } else if (confs.length) {
      cuerpo = confs.map(c => renderConfItem(c)).join('');
      if (_puedeEditar) {
        cuerpo += `<button class="sab-add-btn" onclick="abrirNuevaConf('${sab}')">+ Agregar</button>`;
      }

    } else {
      if (_puedeEditar) {
        cuerpo = `
          <button class="sab-agregar-btn" onclick="abrirNuevaConf('${sab}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            </svg>
            Agregar arreglo
          </button>`;
      } else {
        cuerpo = `<div class="sab-sin-conf">Sin confirmar</div>`;
      }
    }

    return `
      <div class="sab-card${esPasado ? ' is-pasado' : ''}${esHoy ? ' is-hoy' : ''}">
        <div class="sab-fecha-col">
          <div class="sab-dia">${d}</div>
          <div class="sab-dow">sáb</div>
        </div>
        <div class="sab-cuerpo">${cuerpo}</div>
      </div>`;
  }).join('');
}

function renderConfItem(c) {
  const actions = _puedeEditar
    ? `<div class="conf-item-actions">
         <button class="conf-item-edit" onclick="abrirEditarConf('${c.id}')" title="Editar">✎</button>
         <button class="conf-item-del"  onclick="eliminarConf('${c.id}')"    title="Eliminar">×</button>
       </div>`
    : '';

  if (c.tipo === 'entrada') {
    return `
      <div class="conf-item">
        <span class="conf-badge entrada">🏠 Entrada</span>
        <div class="conf-orador">${esc(c.nombreOrador || '—')}</div>
        ${c.congregacionNombre ? `<div class="conf-detalle">${esc(c.congregacionNombre)}</div>` : ''}
        ${c.discursoNumero || c.discursoTitulo ? `<div class="conf-disc">N°${c.discursoNumero || '?'}${c.discursoTitulo ? ` — ${esc(c.discursoTitulo)}` : ''}</div>` : ''}
        ${c.notas ? `<div class="conf-notas-txt">${esc(c.notas)}</div>` : ''}
        ${actions}
      </div>`;
  } else {
    const nombre = c.pubId
      ? (_publicadores.find(p => p.id === c.pubId)?.nombre || c.pubId)
      : (c.nombreOrador || '—');
    return `
      <div class="conf-item">
        <span class="conf-badge salida">✈️ Salida</span>
        <div class="conf-orador">${esc(nombre)}</div>
        ${c.congregacionNombre ? `<div class="conf-detalle">→ ${esc(c.congregacionNombre)}</div>` : ''}
        ${c.discursoNumero || c.discursoTitulo ? `<div class="conf-disc">N°${c.discursoNumero || '?'}${c.discursoTitulo ? ` — ${esc(c.discursoTitulo)}` : ''}</div>` : ''}
        ${c.notas ? `<div class="conf-notas-txt">${esc(c.notas)}</div>` : ''}
        ${actions}
      </div>`;
  }
}

window.navMes = function(delta) {
  if (_soloMesActual) return;
  _mes = navMesIso(_mes, delta);
  renderMes();
};

// ─────────────────────────────────────────
//   COMPARTIR MES — IMAGEN
// ─────────────────────────────────────────
window.compartirMes = async function() {
  if (typeof html2canvas === 'undefined') {
    window.uiToast('Generando imagen…', 'success');
    return;
  }

  const sabados = getSabadosDelMes(_mes);
  const [, mesNum] = _mes.split('-').map(Number);

  // ── Construir HTML del afiche ──
  const filas = sabados.map(sab => {
    const [, , d]  = sab.split('-').map(Number);
    const especial = _semanasEsp[lunesDeISO(sab)];
    const confs    = Object.values(_conferencias).filter(c => c.fecha === sab);

    let contenido = '';

    if (especial) {
      const labels = {
        conmemoracion:   'Conmemoración',
        superintendente: 'Semana del Superintendente',
        asamblea: especial.subtipo === 'regional' ? 'Asamblea Regional' : 'Asamblea de Circuito',
      };
      contenido = `<div style="font-size:13px;color:var(--k-tx-e8c94a, #E8C94A);font-weight:600;">★ ${labels[especial.tipo] || 'Semana especial'}</div>`;

    } else if (confs.length) {
      contenido = confs.map(c => {
        if (c.tipo === 'entrada') {
          const nombre = esc(c.nombreOrador || '—');
          const congre = c.congregacionNombre ? `<div style="font-size:11px;color:var(--k-tx-888888, #888);margin-top:1px;">${esc(c.congregacionNombre)}</div>` : '';
          const disc   = (c.discursoNumero || c.discursoTitulo)
            ? `<div style="font-size:11px;color:var(--k-tx-0db6cc, #0DB6CC);margin-top:2px;">N°${c.discursoNumero || '?'}${c.discursoTitulo ? ' — ' + esc(c.discursoTitulo) : ''}</div>` : '';
          return `<div style="margin-bottom:4px;">
            <div style="font-size:10px;font-weight:700;color:var(--k-tx-1d9e75, #1D9E75);letter-spacing:0.05em;margin-bottom:2px;">ENTRADA</div>
            <div style="font-size:13px;font-weight:700;color:var(--k-tx-f0f0f0, #f0f0f0);">${nombre}</div>
            ${congre}${disc}
          </div>`;
        } else {
          const nombre = c.pubId
            ? esc(_publicadores.find(p => p.id === c.pubId)?.nombre || '—')
            : esc(c.nombreOrador || '—');
          const destino = c.congregacionNombre ? `<div style="font-size:11px;color:var(--k-tx-888888, #888);margin-top:1px;">→ ${esc(c.congregacionNombre)}</div>` : '';
          const disc    = (c.discursoNumero || c.discursoTitulo)
            ? `<div style="font-size:11px;color:var(--k-tx-378add, #378ADD);margin-top:2px;">N°${c.discursoNumero || '?'}${c.discursoTitulo ? ' — ' + esc(c.discursoTitulo) : ''}</div>` : '';
          return `<div style="margin-bottom:4px;">
            <div style="font-size:10px;font-weight:700;color:var(--k-tx-378add, #378ADD);letter-spacing:0.05em;margin-bottom:2px;">SALIDA</div>
            <div style="font-size:13px;font-weight:700;color:var(--k-tx-f0f0f0, #f0f0f0);">${nombre}</div>
            ${destino}${disc}
          </div>`;
        }
      }).join('');

    } else {
      contenido = `<div style="font-size:12px;color:var(--k-tx-555555, #555);font-style:italic;">Sin confirmar</div>`;
    }

    return `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:0.5px solid var(--k-bd-272a2e, #272a2e);">
        <div style="flex-shrink:0;width:38px;text-align:center;padding-top:2px;">
          <div style="font-size:20px;font-weight:800;color:var(--text-primary, #e8e8e8);line-height:1;">${d}</div>
          <div style="font-size:9px;color:var(--k-tx-555555, #555);font-weight:700;text-transform:uppercase;letter-spacing:0.06em;">sáb</div>
        </div>
        <div style="flex:1;min-width:0;">${contenido}</div>
      </div>`;
  }).join('');

  const html = `
    <div style="background:var(--bg-primary, #1a1c1f);border-radius:18px;padding:22px 18px 16px;width:320px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;box-sizing:border-box;">
      <div style="margin-bottom:16px;">
        <div style="font-size:10px;font-weight:800;color:var(--k-tx-0db6cc, #0DB6CC);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:5px;">Conferencias</div>
        <div style="font-size:26px;font-weight:800;color:var(--k-tx-f2f2f2, #f2f2f2);line-height:1.1;">${fmtMesLargo(_mes)}</div>
        <div style="font-size:12px;color:var(--k-tx-555555, #555);margin-top:3px;">${esc(CONGRE_NOMBRE)}</div>
      </div>
      <div style="height:1px;background:var(--bg-hover, #272a2e);margin-bottom:4px;"></div>
      ${filas}
      <div style="margin-top:12px;text-align:center;font-size:10px;color:#3a3d42;font-weight:600;letter-spacing:0.06em;">ZIV</div>
    </div>`;

  // Render off-screen
  const printEl = document.getElementById('conf-print-view');
  printEl.innerHTML = html;

  try {
    window.uiLoading && window.uiLoading.show('Generando imagen…');
    const canvas = await html2canvas(printEl.firstElementChild, {
      backgroundColor: '#1a1c1f',
      scale: 2.5,
      logging: false,
      useCORS: true,
    });
    window.uiLoading && window.uiLoading.hide();

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conferencias-${_mes}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/png');
  } catch(e) {
    window.uiLoading && window.uiLoading.hide();
    await window.uiAlert('No se pudo generar la imagen: ' + e.message);
  } finally {
    printEl.innerHTML = '';
  }
};

// ─────────────────────────────────────────
//   MODAL ARREGLO
// ─────────────────────────────────────────
window.setTipo = function(tipo) {
  _editandoTipo = tipo;
  document.getElementById('btn-tipo-entrada').classList.toggle('btn-tipo-active', tipo === 'entrada');
  document.getElementById('btn-tipo-salida').classList.toggle('btn-tipo-active', tipo === 'salida');
  document.getElementById('wrap-nombre-orador').style.display = tipo === 'entrada' ? '' : 'none';
  document.getElementById('wrap-pub-select').style.display    = tipo === 'salida'  ? '' : 'none';
  document.getElementById('conf-congre-label').textContent =
    tipo === 'entrada' ? 'Congregación de origen' : 'Congregación de destino';
};

window.abrirNuevaConf = function(fecha) {
  if (!_puedeEditar) return;
  _editandoId    = null;
  _editandoFecha = fecha;
  document.getElementById('modal-conf-title').textContent = `Sáb ${fmtDia(fecha)}`;
  document.getElementById('conf-nombre-orador').value = '';
  document.getElementById('conf-pub-select').value    = '';
  document.getElementById('conf-congre-nombre').value = '';
  document.getElementById('conf-disc-num').value      = '';
  document.getElementById('conf-disc-titulo').value   = '';
  document.getElementById('conf-notas').value         = '';
  window.setTipo('entrada');
  document.getElementById('modal-conf').style.display = 'flex';
};

window.abrirEditarConf = function(id) {
  if (!_puedeEditar) return;
  const c = _conferencias[id];
  if (!c) return;
  _editandoId    = id;
  _editandoFecha = c.fecha;
  document.getElementById('modal-conf-title').textContent = `Editar · Sáb ${fmtDia(c.fecha)}`;
  document.getElementById('conf-nombre-orador').value = c.nombreOrador || '';
  document.getElementById('conf-pub-select').value    = c.pubId        || '';
  document.getElementById('conf-congre-nombre').value = c.congregacionNombre || '';
  document.getElementById('conf-disc-num').value      = c.discursoNumero  || '';
  document.getElementById('conf-disc-titulo').value   = c.discursoTitulo  || '';
  document.getElementById('conf-notas').value         = c.notas || '';
  window.setTipo(c.tipo || 'entrada');
  document.getElementById('modal-conf').style.display = 'flex';
};

window.cerrarModalConf = function() {
  document.getElementById('modal-conf').style.display = 'none';
  _editandoId = null; _editandoFecha = null;
};

window.guardarConf = async function() {
  const tipo              = _editandoTipo;
  const congregacionNombre = document.getElementById('conf-congre-nombre').value.trim();
  const discursoNumero    = parseInt(document.getElementById('conf-disc-num').value)   || null;
  const discursoTitulo    = document.getElementById('conf-disc-titulo').value.trim()   || null;
  const notas             = document.getElementById('conf-notas').value.trim()         || null;

  const data = {
    fecha: _editandoFecha,
    tipo,
    congregacionNombre,
    discursoNumero,
    discursoTitulo,
    notas,
    pubId:        tipo === 'salida'  ? (document.getElementById('conf-pub-select').value || null) : null,
    nombreOrador: tipo === 'entrada' ? (document.getElementById('conf-nombre-orador').value.trim() || null) : null,
  };

  try {
    if (_editandoId) {
      await setDoc(doc(db, 'congregaciones', CONGRE_ID, 'conferencias', _editandoId), data);
      _conferencias[_editandoId] = { id: _editandoId, ...data };
    } else {
      const ref = await addDoc(confCol(), data);
      _conferencias[ref.id] = { id: ref.id, ...data };
    }
    window.cerrarModalConf();
    renderMes();
    window.uiToast('Guardado', 'success');
    logActividad(CONGRE_ID, 'conferencias', 'guardado', tipo === 'entrada' ? 'Entrada guardada' : 'Salida guardada');
  } catch(e) { await window.uiAlert('Error: ' + e.message); }
};

window.eliminarConf = async function(id) {
  if (!_puedeEditar) return;
  const ok = await window.uiConfirm({ title: 'Eliminar arreglo', msg: '¿Eliminás este arreglo?', confirmText: 'Eliminar', type: 'danger' });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'conferencias', id));
    delete _conferencias[id];
    renderMes();
    window.uiToast('Eliminado', 'success');
  } catch(e) { await window.uiAlert('Error: ' + e.message); }
};

// ─────────────────────────────────────────
//   ORADORES
// ─────────────────────────────────────────
function getOradores() {
  return _publicadores.filter(p => {
    const r = p.roles || [];
    return r.includes('ANCIANO') || r.includes('SIERVO_MINISTERIAL');
  });
}

function renderOradores() {
  const el = document.getElementById('oradores-list');
  if (!el) return;
  const oradores = getOradores();

  if (!oradores.length) {
    el.innerHTML = '<div class="orador-empty">No hay ancianos ni siervos ministeriales cargados.</div>';
    return;
  }

  el.innerHTML = oradores.map(p => {
    const discursos = p.discursos || [];
    const rolLabel  = (p.roles||[]).includes('ANCIANO') ? 'Anciano' : 'Siervo ministerial';
    const discsHtml = discursos.length
      ? discursos.sort((a,b)=>a.numero-b.numero).map(d =>
          `<span class="disc-chip" title="${esc(d.titulo||'')}">${d.numero}</span>`
        ).join('')
      : '<span class="disc-none">Sin discursos</span>';

    const editBtn = _puedeEditar
      ? `<button class="orador-edit-btn" onclick="abrirEditarDiscursos('${p.id}')">Editar discursos</button>`
      : '';

    return `
      <div class="orador-card">
        <div class="orador-header">
          <div>
            <div class="orador-nombre">${esc(p.nombre)}</div>
            <div class="orador-rol">${rolLabel}</div>
          </div>
          ${editBtn}
        </div>
        <div class="orador-discs">${discsHtml}</div>
      </div>`;
  }).join('');
}

window.abrirEditarDiscursos = function(pubId) {
  if (!_puedeEditar) return;
  const p = _publicadores.find(x => x.id === pubId);
  if (!p) return;
  _editandoId = pubId;
  document.getElementById('modal-disc-nombre').textContent = p.nombre;
  const lineas = (p.discursos || []).sort((a,b)=>a.numero-b.numero).map(d => `${d.numero}${d.titulo ? ', ' + d.titulo : ''}`).join('\n');
  document.getElementById('disc-input').value = lineas;
  document.getElementById('modal-disc').style.display = 'flex';
};

window.cerrarModalDisc = function() {
  document.getElementById('modal-disc').style.display = 'none';
  _editandoId = null;
};

window.guardarDiscursos = async function() {
  const lines = document.getElementById('disc-input').value.trim().split('\n').filter(Boolean);
  const discursos = lines.map(line => {
    const [numStr, ...rest] = line.split(',');
    const numero = parseInt(numStr.trim());
    const titulo = rest.join(',').trim() || null;
    return numero ? { numero, ...(titulo ? { titulo } : {}) } : null;
  }).filter(Boolean).sort((a,b)=>a.numero-b.numero);

  try {
    await updateDoc(doc(db, 'congregaciones', CONGRE_ID, 'publicadores', _editandoId), { discursos });
    const p = _publicadores.find(x => x.id === _editandoId);
    if (p) p.discursos = discursos;
    window.cerrarModalDisc();
    renderOradores();
    window.uiToast('Discursos guardados', 'success');
    logActividad(CONGRE_ID, 'conferencias', 'guardado', 'Discursos de orador actualizados');
  } catch(e) { await window.uiAlert('Error: ' + e.message); }
};

// ─────────────────────────────────────────
//   CIRCUITO
// ─────────────────────────────────────────
function renderCircuito() {
  const el = document.getElementById('circuito-list');
  if (!el) return;
  const btn = document.getElementById('btn-nueva-circ');
  if (btn) btn.style.display = _puedeEditar ? '' : 'none';

  if (!_congregaciones.length) {
    el.innerHTML = _puedeEditar
      ? '<div class="circ-empty">Sin congregaciones cargadas. Agregá las del circuito.</div>'
      : '<div class="circ-empty">Sin congregaciones del circuito cargadas.</div>';
    return;
  }

  el.innerHTML = _congregaciones.map(c => `
    <div class="circ-card">
      <div class="circ-info">
        <div class="circ-nombre">${esc(c.nombre)}</div>
        ${c.contacto ? `<div class="circ-contacto">${esc(c.contacto)}</div>` : ''}
      </div>
      ${_puedeEditar ? `
        <div class="circ-actions">
          <button class="circ-edit-btn" onclick="abrirEditarCirc('${c.id}')" title="Editar">✎</button>
          <button class="circ-del-btn"  onclick="eliminarCirc('${c.id}')"    title="Eliminar">×</button>
        </div>` : ''}
    </div>`).join('');
}

window.abrirNuevaCirc = function() {
  if (!_puedeEditar) return;
  _editandoId = null;
  document.getElementById('modal-circ-title').textContent = 'Nueva congregación';
  document.getElementById('circ-nombre').value   = '';
  document.getElementById('circ-contacto').value = '';
  document.getElementById('modal-circ').style.display = 'flex';
};

window.abrirEditarCirc = function(id) {
  const c = _congregaciones.find(x => x.id === id);
  if (!c) return;
  _editandoId = id;
  document.getElementById('modal-circ-title').textContent = 'Editar congregación';
  document.getElementById('circ-nombre').value   = c.nombre;
  document.getElementById('circ-contacto').value = c.contacto || '';
  document.getElementById('modal-circ').style.display = 'flex';
};

window.cerrarModalCirc = function() {
  document.getElementById('modal-circ').style.display = 'none';
  _editandoId = null;
};

window.guardarCirc = async function() {
  const nombre   = document.getElementById('circ-nombre').value.trim();
  const contacto = document.getElementById('circ-contacto').value.trim() || null;
  if (!nombre) { await window.uiAlert('Ingresá el nombre de la congregación.'); return; }

  const data = { nombre, contacto };
  try {
    if (_editandoId) {
      await updateDoc(doc(db, 'congregaciones', CONGRE_ID, 'congregacionesCircuito', _editandoId), data);
      const c = _congregaciones.find(x => x.id === _editandoId);
      if (c) Object.assign(c, data);
    } else {
      const ref = await addDoc(circCol(), data);
      _congregaciones.push({ id: ref.id, ...data });
      _congregaciones.sort((a,b) => a.nombre.localeCompare(b.nombre));
    }
    window.cerrarModalCirc();
    renderCircuito();
    // actualizar datalist del modal de conf
    poblarDatalistCirc();
    window.uiToast('Guardado', 'success');
    logActividad(CONGRE_ID, 'conferencias', 'guardado', 'Congregación del circuito');
  } catch(e) { await window.uiAlert('Error: ' + e.message); }
};

window.eliminarCirc = async function(id) {
  const ok = await window.uiConfirm({ title: 'Eliminar congregación', msg: '¿Eliminás esta congregación del circuito?', confirmText: 'Eliminar', type: 'danger' });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'congregacionesCircuito', id));
    _congregaciones = _congregaciones.filter(c => c.id !== id);
    renderCircuito();
    poblarDatalistCirc();
    window.uiToast('Eliminada', 'success');
  } catch(e) { await window.uiAlert('Error: ' + e.message); }
};

function poblarDatalistCirc() {
  const dl = document.getElementById('circ-datalist');
  if (!dl) return;
  dl.innerHTML = _congregaciones.map(c => `<option value="${esc(c.nombre)}">`).join('');
}

// ─────────────────────────────────────────
//   INIT
// ─────────────────────────────────────────
async function init() {
  await window.waitForAuth();
  _puedeEditar = window.hasPermission('editar_conferencias');

  const user = window.currentUser;
  _soloMesActual = !!(user && !user.isAnonymous && user.sexo === 'M');

  if (_soloMesActual) {
    // Hermana: solo mes actual, sin navegación, sin tabs de oradores/circuito
    _mes = mesHoy();
    document.querySelector('.mes-nav')?.style.setProperty('display', 'none');
    document.getElementById('tab-btn-oradores')?.style.setProperty('display', 'none');
    document.getElementById('tab-btn-circuito')?.style.setProperty('display', 'none');
  }

  // Render con loading mientras carga
  renderMes();

  await cargarDatos();
  logActividad(CONGRE_ID, 'conferencias', 'apertura');

  // Poblar select de oradores propios
  const sel = document.getElementById('conf-pub-select');
  if (sel) {
    const oradores = getOradores();
    sel.innerHTML = '<option value="">— Seleccionar hermano —</option>' +
      oradores.map(p => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('');
  }

  poblarDatalistCirc();
  renderMes();
}

init();
