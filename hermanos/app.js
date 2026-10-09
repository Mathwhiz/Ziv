import { db } from '../shared/firebase.js';
import '../shared/auth.js';
import { logActividad } from '../shared/actividad.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc, query, orderBy, limit, Timestamp
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

await window.authGuard('acceso_hermanos');

if (!sessionStorage.getItem('congreId')) window.location.href = '../index.html';

const CONGRE_ID     = sessionStorage.getItem('congreId')     || '';
const CONGRE_NOMBRE = sessionStorage.getItem('congreNombre') || CONGRE_ID;

document.querySelectorAll('.js-congre').forEach(el => el.textContent = CONGRE_NOMBRE);

// ─────────────────────────────────────────
//   ROLES
// ─────────────────────────────────────────
const ROLES_ASIGN_BASE = [
  { id: 'LECTOR',               label: 'Lector' },
  { id: 'SONIDO',               label: 'Sonido' },
  { id: 'PLATAFORMA',           label: 'Plataforma' },
  { id: 'MICROFONISTAS',        label: 'Micrófonos' },
  { id: 'ACOMODADOR_AUDITORIO', label: 'Acod. Auditorio' },
  { id: 'ACOMODADOR_ENTRADA',   label: 'Acod. Entrada' },
  { id: 'PRESIDENTE',           label: 'Pres. Reunión' },
  { id: 'REVISTAS',             label: 'Revistas' },
  { id: 'PUBLICACIONES',        label: 'Publicaciones' },
];
const ROLES_CONDUCTOR_FIJO = [
  { id: 'CONDUCTOR_CONGREGACION',   label: 'Conductor Congregación' },
  { id: 'SUPERINTENDENTE_CIRCUITO', label: 'Sup. de Circuito' },
];

const ROLES_VM = [
  { id: 'VM_PRESIDENTE',               label: 'Presidente' },
  { id: 'VM_ORACION',                  label: 'Oración' },
  { id: 'VM_TESOROS',                  label: 'Discurso Tesoros' },
  { id: 'VM_JOYAS',                    label: 'Perlas escondidas' },
  { id: 'VM_LECTURA',                  label: 'Lectura Bíblica' },
  { id: 'VM_MINISTERIO_CONVERSACION',  label: 'Min. Conversación' },
  { id: 'VM_MINISTERIO_REVISITA',      label: 'Min. Revisita' },
  { id: 'VM_MINISTERIO_ESCENIFICACION',label: 'Min. Escenificación' },
  { id: 'VM_MINISTERIO_DISCURSO',      label: 'Min. Discurso' },
  { id: 'VM_VIDA_CRISTIANA',           label: 'Vida Cristiana' },
  { id: 'VM_ESTUDIO_CONDUCTOR',        label: 'Conductor Estudio' },
  // "¿Qué diría?": solo hace falta marcarlo en siervos ministeriales — los ancianos
  // ya son elegibles sin él (ver pubsQueDiria() en vida-ministerio/app.js).
  { id: 'VM_QUE_DIRIA',                label: '¿Qué diría? (s. min.)' },
];

// Se reconstruye en buildConductorUI() después de cargar grupos
let ROLES_ASIGN = [...ROLES_ASIGN_BASE, ...ROLES_CONDUCTOR_FIJO];
let TODOS_LOS_ROLES = [...ROLES_ASIGN, ...ROLES_VM];

// Roles de congregación — solo para display y para la vista Responsabilidades
// No se agregan al modal de hermano (son exclusivos de esa vista)
const LABELS_CONGRE = {
  SUPERINTENDENTE_SERVICIO: 'Sup. de Servicio',
  ENCARGADO_ASIGNACIONES:   'Enc. Asignaciones',
  ENCARGADO_VM:             'Enc. V y M',
  ENCARGADO_CONFERENCIAS:   'Enc. Conferencias',
  ANCIANO:                  'Anciano',
  SIERVO_MINISTERIAL:       'Siervo ministerial',
  PRECURSOR_REGULAR:        'Precursor regular',
  PRECURSOR_AUXILIAR:       'Precursor auxiliar',
};
const CONGRE_ROLE_IDS = new Set(Object.keys(LABELS_CONGRE));

function rolLabel(id) {
  return TODOS_LOS_ROLES.find(r => r.id === id)?.label
    || LABELS_CONGRE[id]
    || id;
}

// Construye los checkboxes de conductores de grupo en el modal y en el select de filtro
function buildConductorUI(grupos) {
  const numGrupos = grupos.filter(g => String(g.id) !== 'C');
  // Si no hay grupos cargados, defaultear a 4
  const lista = numGrupos.length
    ? numGrupos
    : [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
  gruposGlobales = lista;

  const rolGrupos = lista.map(g => ({
    id:    `CONDUCTOR_GRUPO_${g.id}`,
    label: `Conductor Grupo ${g.id}`,
  }));

  ROLES_ASIGN    = [...ROLES_ASIGN_BASE, ...rolGrupos, ...ROLES_CONDUCTOR_FIJO];
  TODOS_LOS_ROLES = [...ROLES_ASIGN, ...ROLES_VM];

  // Modal: regenerar toda la grilla de asignaciones
  const grid = document.getElementById('modal-roles-asign-grid');
  if (grid) {
    grid.innerHTML = ROLES_ASIGN.map(r => {
      const wide = r.id === 'CONDUCTOR_CONGREGACION' || r.id === 'SUPERINTENDENTE_CIRCUITO'
        ? ' style="grid-column:span 2"' : '';
      return `<label class="rol-checkbox"${wide}><input type="checkbox" id="hcb-${r.id}"><span>${r.label}</span></label>`;
    }).join('');
  }

  // Select de filtro: regenerar optgroup de Asignaciones
  const optgroup = document.getElementById('opt-asign');
  if (optgroup) {
    optgroup.innerHTML = ROLES_ASIGN.map(r =>
      `<option value="${r.id}">${r.label}</option>`
    ).join('');
  }
}

// ─────────────────────────────────────────
//   ESTADO
// ─────────────────────────────────────────
let publicadores    = [];
let gruposGlobales  = [];     // grupos numéricos (no 'C'), cargados en init
let _respPubs       = [];     // cache de publicadores para la vista Responsabilidades
let editandoId      = null;
let sheetsUrl       = null;
let semanasEspeciales = {};
let _especialEditLunes = null;
let _modalSexo      = null; // 'H' | 'M' | null
let listaVisible    = [];   // hermanos actualmente visibles en la lista (respetando filtros)
let _gruposPubs     = [];

function privateModuleConfigRef() {
  return doc(db, 'congregaciones', CONGRE_ID, 'config_privada', 'modulos');
}

// ─────────────────────────────────────────
//   UTILIDADES
// ─────────────────────────────────────────
window.showView = function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  document.getElementById('btn-home').classList.add('visible');
  showChatFab();
}

function showSinPermiso() {
  document.getElementById('view-sin-permiso').style.display = 'flex';
  document.getElementById('btn-home').classList.remove('visible');
  hideChatFab();
}

function hideSinPermiso() {
  document.getElementById('view-sin-permiso').style.display = 'none';
  document.getElementById('btn-home').classList.add('visible');
  showChatFab();
}

function norm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function pubCol() {
  return collection(db, 'congregaciones', CONGRE_ID, 'publicadores');
}

// ─────────────────────────────────────────
//   INIT — cargar config + grupos
// ─────────────────────────────────────────
function puedeVerComoEncargado() {
  const u = window.currentUser;
  if (!u) return false;
  const roles = u.appRoles || (u.appRol ? [u.appRol] : []);
  return roles.some(r => ['admin_general', 'admin_congre', 'encargado_asignaciones', 'encargado_vm'].includes(r));
}

(async function init() {
  try {
    const [congreSnap, gruposSnap, privateSnap] = await Promise.all([
      getDoc(doc(db, 'congregaciones', CONGRE_ID)),
      getDocs(collection(db, 'congregaciones', CONGRE_ID, 'grupos')),
      getDoc(privateModuleConfigRef()).catch(() => null),
    ]);
    if (congreSnap.exists()) {
      const d = congreSnap.data();
      const privateData = privateSnap?.exists?.() ? privateSnap.data() : {};
      const mergedConfig = { ...d, ...privateData };
      if (mergedConfig.sheetsUrl) {
        sheetsUrl = mergedConfig.sheetsUrl;
        const btn = document.getElementById('btn-ver-planilla');
        if (btn) btn.style.display = '';
      }
    }
    const grupos = [];
    gruposSnap.forEach(d => { if (d.data().id) grupos.push(d.data()); });
    grupos.sort((a, b) => {
      const an = parseInt(a.id), bn = parseInt(b.id);
      if (!isNaN(an) && !isNaN(bn)) return an - bn;
      return 0;
    });
    buildConductorUI(grupos);
  } catch(e) {
    console.error('Error cargando config:', e);
    buildConductorUI([]); // fallback: muestra grupos 1-4
  } finally {
    logActividad(CONGRE_ID, 'hermanos', 'apertura');
    document.getElementById('view-cargando').style.display = 'none';
    if (puedeVerComoEncargado()) {
      hideSinPermiso();
      showView('view-menu');
    } else {
      showSinPermiso();
    }
  }
})();

window.goToCover = function() {
  window.location.href = '../index.html#menu';
};

window.goToMenu = function() {
  showView('view-menu');
};

window.goToHermanos = function() {
  cargarYMostrar();
};

window.goToResponsabilidades = async function() {
  showView('view-responsabilidades');
  await cargarResponsabilidades();
};

window.goToGrupos = async function() {
  showView('view-grupos');
  await cargarVistaGrupos();
};

// ─────────────────────────────────────────
//   RESPONSABILIDADES
// ─────────────────────────────────────────

// Roles encargados fijos (1 persona por rol)
const RESP_ENCARGADOS_FIJOS = [
  { id: 'SUPERINTENDENTE_SERVICIO', label: 'Sup. de Servicio' },
  { id: 'ENCARGADO_ASIGNACIONES',   label: 'Enc. Asignaciones' },
  { id: 'ENCARGADO_VM',             label: 'Enc. V y M' },
  { id: 'ENCARGADO_CONFERENCIAS',   label: 'Enc. Conferencias' },
];

// Roles categoría (varias personas por rol)
const RESP_CATEGORIAS = [
  { id: 'ANCIANO',           label: 'Ancianos' },
  { id: 'SIERVO_MINISTERIAL',label: 'Siervos ministeriales' },
];
const RESP_PRECURSORES = [
  { id: 'PRECURSOR_REGULAR',  label: 'Precursores regulares' },
  { id: 'PRECURSOR_AUXILIAR', label: 'Precursores auxiliares' },
];

async function cargarResponsabilidades() {
  const loading = document.getElementById('resp-loading');
  const content = document.getElementById('resp-content');
  if (loading) loading.style.display = '';
  if (content) content.style.display = 'none';
  try {
    const snap = await getDocs(pubCol());
    _respPubs = snap.docs
      .map(d => ({ id: d.id, ...d.data(), roles: d.data().roles || [] }))
      .sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    renderResponsabilidades();
  } catch(e) {
    uiToast('Error al cargar: ' + e.message, 'error');
  } finally {
    if (loading) loading.style.display = 'none';
    if (content) content.style.display = '';
  }
}

function renderResponsabilidades() {
  // Encargados: roles fijos + conductores de grupo (dinámicos)
  const grupos = gruposGlobales.length
    ? gruposGlobales
    : [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];
  const encargados = [
    ...RESP_ENCARGADOS_FIJOS,
    ...grupos.map(g => ({ id: `CONDUCTOR_GRUPO_${g.id}`, label: `Encargado Grupo ${g.id}` })),
  ];

  const encEl = document.getElementById('resp-encargados-list');
  if (encEl) {
    encEl.innerHTML = encargados.map(rol => {
      const holder = _respPubs.find(p => (p.roles||[]).includes(rol.id));
      return `<div class="resp-row" onclick="cambiarEncargado('${rol.id}','${esc(rol.label)}')">
        <div class="resp-row-label">${esc(rol.label)}</div>
        <div class="resp-row-value">
          <span class="${holder ? 'resp-assigned-name' : 'resp-unassigned'}">${holder ? esc(holder.nombre) : 'Sin asignar'}</span>
          <svg class="resp-row-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </div>
      </div>`;
    }).join('');
  }

  const catEl = document.getElementById('resp-categorias-list');
  if (catEl) catEl.innerHTML = RESP_CATEGORIAS.map(renderCategoriaBlock).join('');

  const precEl = document.getElementById('resp-precursores-list');
  if (precEl) precEl.innerHTML = RESP_PRECURSORES.map(renderCategoriaBlock).join('');
}

function renderCategoriaBlock(cat) {
  const holders = _respPubs.filter(p => (p.roles||[]).includes(cat.id));
  const chips = holders.map(p =>
    `<span class="resp-chip" onclick="quitarCategoriaRol('${cat.id}','${p.id}','${(p.nombre||'').replace(/'/g,"\\'")}')">
      ${esc(p.nombre)}<span class="resp-chip-x"> ×</span>
    </span>`
  ).join('');
  return `<div class="resp-categoria-block">
    <div class="resp-categoria-header">
      <span class="resp-categoria-title">${esc(cat.label)}</span>
      <button class="resp-agregar-btn" onclick="agregarCategoriaRol('${cat.id}','${esc(cat.label)}')">+ Agregar</button>
    </div>
    <div class="resp-chips-row">
      ${chips || '<span class="resp-empty">Ninguno asignado</span>'}
    </div>
  </div>`;
}

window.cambiarEncargado = async function(rolId, rolLabelText) {
  const conductores = _respPubs.map(p => p.nombre);
  const current = _respPubs.find(p => (p.roles||[]).includes(rolId));
  const result = await uiConductorPicker({
    conductores: ['— Sin asignar —', ...conductores],
    value: current?.nombre || '— Sin asignar —',
    label: rolLabelText,
    color: '#D85A30',
  });
  if (result === null) return; // cancelado

  const isClear = !result || result === '— Sin asignar —';
  const newPub = isClear ? null : _respPubs.find(p => p.nombre === result);

  try {
    // Quitar el rol del que lo tenía antes
    for (const p of _respPubs.filter(p => (p.roles||[]).includes(rolId))) {
      if (!newPub || p.id !== newPub.id) {
        const newRoles = p.roles.filter(r => r !== rolId);
        await updateDoc(doc(pubCol(), p.id), { roles: newRoles });
        p.roles = newRoles;
      }
    }
    // Asignar al nuevo
    if (newPub && !(newPub.roles||[]).includes(rolId)) {
      const newRoles = [...(newPub.roles||[]), rolId];
      await updateDoc(doc(pubCol(), newPub.id), { roles: newRoles });
      newPub.roles = newRoles;
    }
    uiToast('Guardado', 'success');
    renderResponsabilidades();
  } catch(e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

window.agregarCategoriaRol = async function(rolId, rolLabelText) {
  const disponibles = _respPubs.filter(p => !(p.roles||[]).includes(rolId));
  if (!disponibles.length) {
    await uiAlert('Todos los hermanos ya tienen este rol asignado.');
    return;
  }
  const result = await uiConductorPicker({
    conductores: disponibles.map(p => p.nombre),
    value: '',
    label: `Agregar — ${rolLabelText}`,
    color: '#D85A30',
  });
  if (!result) return;
  const pub = _respPubs.find(p => p.nombre === result);
  if (!pub) return;
  try {
    const newRoles = [...(pub.roles||[]), rolId];
    await updateDoc(doc(pubCol(), pub.id), { roles: newRoles });
    pub.roles = newRoles;
    uiToast('Agregado', 'success');
    renderResponsabilidades();
  } catch(e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

window.quitarCategoriaRol = async function(rolId, pubId, nombre) {
  const ok = await uiConfirm({
    title: 'Quitar rol',
    msg: `¿Quitar a ${nombre} de esta categoría?`,
    confirmText: 'Quitar', cancelText: 'Cancelar', type: 'warn',
  });
  if (!ok) return;
  const pub = _respPubs.find(p => p.id === pubId);
  if (!pub) return;
  try {
    const newRoles = (pub.roles||[]).filter(r => r !== rolId);
    await updateDoc(doc(pubCol(), pubId), { roles: newRoles });
    pub.roles = newRoles;
    uiToast('Quitado', 'success');
    renderResponsabilidades();
  } catch(e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

// ─────────────────────────────────────────
//   CARGAR PUBLICADORES
// ─────────────────────────────────────────
async function cargarYMostrar() {
  showView('view-main');
  document.getElementById('hermanos-list').innerHTML =
    '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';
  try {
    const snap = await getDocs(pubCol());
    publicadores = snap.docs.map(d => ({ id: d.id, ...d.data(), roles: d.data().roles || [] }));
    publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    renderLista(publicadores);
  } catch(e) {
    document.getElementById('hermanos-list').innerHTML =
      `<div class="error-wrap">Error al cargar: ${e.message}</div>`;
  }
}

window.goToEspeciales = function() {
  showView('view-especiales');
  cargarEspeciales();
};

async function cargarVistaGrupos() {
  const loading = document.getElementById('grupos-loading');
  const board = document.getElementById('grupos-board');
  if (!loading || !board) return;

  loading.style.display = '';
  board.innerHTML = '';

  try {
    const snap = await getDocs(pubCol());
    _gruposPubs = snap.docs.map(d => ({ id: d.id, ...d.data(), roles: d.data().roles || [] }));
    _gruposPubs.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    renderVistaGrupos();
  } catch (e) {
    board.innerHTML = `<div class="empty-state">Error al cargar grupos: ${esc(e.message)}</div>`;
  } finally {
    loading.style.display = 'none';
  }
}

function labelGrupo(grupoId) {
  const found = gruposGlobales.find(g => String(g.id) === String(grupoId));
  return found?.label || `Grupo ${grupoId}`;
}

function renderVistaGrupos() {
  const board = document.getElementById('grupos-board');
  if (!board) return;

  const grouped = new Map();
  _gruposPubs.forEach(pub => {
    const gid = pub.grupoId ? String(pub.grupoId) : '__sin_grupo__';
    if (!grouped.has(gid)) grouped.set(gid, []);
    grouped.get(gid).push(pub);
  });

  const orderedIds = [
    ...new Set([
      ...gruposGlobales.map(g => String(g.id)).filter(id => id && id !== 'C'),
      ...[...grouped.keys()].filter(id => id !== '__sin_grupo__').sort((a, b) => Number(a) - Number(b)),
    ]),
    '__sin_grupo__',
  ];

  board.className = 'grupos-board';
  board.innerHTML = orderedIds
    .filter(id => grouped.has(id) || id === '__sin_grupo__')
    .map(id => {
      const items = grouped.get(id) || [];
      const title = id === '__sin_grupo__' ? 'Sin grupo' : labelGrupo(id);
      const cardClass = id === '__sin_grupo__' ? 'grupo-card grupo-card-empty' : 'grupo-card';
      const addButton = id === '__sin_grupo__'
        ? ''
        : `<button class="grupo-add-btn" onclick="event.stopPropagation();agregarAGrupo('${id}')">+ Agregar</button>`;
      const listHtml = items.length
        ? `<div class="grupo-list">${items.map(pub => {
            const meta = [];
            if (pub.roles?.length) meta.push(`${pub.roles.length} rol${pub.roles.length === 1 ? '' : 'es'}`);
            if (pub.direccion) meta.push(pub.direccion);
            return `
              <div class="grupo-item">
                <div class="grupo-item-main">
                  <div class="grupo-item-name">${esc(pub.nombre)}</div>
                  <div class="grupo-item-meta">${esc(meta.join(' · ') || 'Sin datos extra')}</div>
                </div>
                <div class="grupo-item-actions">
                  <button class="grupo-item-btn" onclick="event.stopPropagation();moverDeGrupo('${pub.id}')">Mover</button>
                  ${id === '__sin_grupo__'
                    ? ''
                    : `<button class="grupo-item-btn grupo-item-btn-danger" onclick="event.stopPropagation();quitarDeGrupo('${pub.id}')">Quitar</button>`}
                </div>
              </div>`;
          }).join('')}</div>`
        : '<div class="grupo-empty">Sin publicadores asignados.</div>';

      return `
        <section class="${cardClass}">
          <div class="grupo-head">
            <div class="grupo-head-main">
              <div class="grupo-title">${esc(title)}</div>
              <div class="grupo-count">${items.length} publicador${items.length === 1 ? '' : 'es'}</div>
            </div>
            ${addButton}
          </div>
          ${listHtml}
        </section>`;
    }).join('');
}

function opcionesGrupoPicker(currentGroupId = null, includeSinGrupo = true) {
  const groups = gruposGlobales.length
    ? gruposGlobales.map(g => ({ id: String(g.id), label: labelGrupo(g.id) }))
    : ['1', '2', '3', '4', '5', '6', '7'].map(id => ({ id, label: `Grupo ${id}` }));
  const options = groups.filter(g => g.id !== String(currentGroupId)).map(g => g.label);
  if (includeSinGrupo && currentGroupId !== '__sin_grupo__') options.unshift('— Sin grupo —');
  return options;
}

function findGrupoIdByLabel(label) {
  if (!label || label === '— Sin grupo —') return null;
  const found = gruposGlobales.find(g => labelGrupo(g.id) === label);
  if (found) return String(found.id);
  const match = label.match(/(\d+)/);
  return match ? match[1] : null;
}

async function actualizarGrupoPublicador(pubId, grupoId) {
  await updateDoc(doc(pubCol(), pubId), { grupoId: grupoId || null });
  const idx = _gruposPubs.findIndex(p => p.id === pubId);
  if (idx >= 0) _gruposPubs[idx] = { ..._gruposPubs[idx], grupoId: grupoId || null };
  renderVistaGrupos();
}

window.quitarDeGrupo = async function(pubId) {
  const pub = _gruposPubs.find(p => p.id === pubId);
  if (!pub) return;
  const ok = await uiConfirm({
    title: 'Quitar de grupo',
    msg: `¿Quitar a ${pub.nombre} de su grupo actual?`,
    confirmText: 'Quitar',
    cancelText: 'Cancelar',
    type: 'warn',
  });
  if (!ok) return;
  try {
    await actualizarGrupoPublicador(pubId, null);
    uiToast('Grupo actualizado', 'success');
  } catch (e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

window.moverDeGrupo = async function(pubId) {
  const pub = _gruposPubs.find(p => p.id === pubId);
  if (!pub) return;
  const current = pub.grupoId ? String(pub.grupoId) : '__sin_grupo__';
  const result = await uiConductorPicker({
    conductores: opcionesGrupoPicker(current),
    value: '',
    label: `Mover — ${pub.nombre}`,
    color: '#4691FF',
  });
  if (result === null) return;
  try {
    await actualizarGrupoPublicador(pubId, findGrupoIdByLabel(result));
    uiToast('Grupo actualizado', 'success');
  } catch (e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

window.agregarAGrupo = async function(grupoId) {
  const disponibles = _gruposPubs
    .filter(p => String(p.grupoId || '') !== String(grupoId))
    .map(p => p.nombre);
  if (!disponibles.length) {
    await uiAlert('No hay publicadores disponibles para mover a este grupo.');
    return;
  }
  const result = await uiConductorPicker({
    conductores: disponibles,
    value: '',
    label: `Agregar a ${labelGrupo(grupoId)}`,
    color: '#4691FF',
  });
  if (!result) return;
  const pub = _gruposPubs.find(p => p.nombre === result);
  if (!pub) return;
  try {
    await actualizarGrupoPublicador(pub.id, String(grupoId));
    uiToast('Grupo actualizado', 'success');
  } catch (e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

// ─────────────────────────────────────────
//   RENDER LISTA
// ─────────────────────────────────────────
function renderLista(lista) {
  listaVisible = lista;
  const el = document.getElementById('hermanos-list');
  if (!lista.length) {
    el.innerHTML = '<div class="empty-state">No hay hermanos cargados.</div>';
    return;
  }
  el.innerHTML = lista.map(h => {
    const congreRoles = (h.roles || []).filter(r => CONGRE_ROLE_IDS.has(r));
    const asignRoles  = (h.roles || []).filter(r => !r.startsWith('VM_') && !CONGRE_ROLE_IDS.has(r));
    const vmRoles     = (h.roles || []).filter(r => r.startsWith('VM_'));
    const chips = [
      ...congreRoles.map(r => `<span class="chip chip-congre">${esc(rolLabel(r))}</span>`),
      ...asignRoles.map(r  => `<span class="chip chip-asign">${esc(rolLabel(r))}</span>`),
      ...vmRoles.map(r     => `<span class="chip chip-vm">${esc(rolLabel(r))}</span>`),
    ].join('');
    const sexoChip = h.sexo === 'H'
      ? `<span class="chip-sexo chip-sexo-h" onclick="event.stopPropagation();toggleSexo('${h.id}','H')" title="Hombre — clic para cambiar">♂</span>`
      : h.sexo === 'M'
        ? `<span class="chip-sexo chip-sexo-m" onclick="event.stopPropagation();toggleSexo('${h.id}','M')" title="Mujer — clic para cambiar">♀</span>`
        : `<span class="chip-sexo chip-sexo-none" onclick="event.stopPropagation();toggleSexo('${h.id}',null)" title="Sin género — clic para asignar">·</span>`;
    return `<div class="hermano-row" onclick="abrirEditar('${h.id}')">
      <div class="hermano-info">
        <div class="hermano-nombre-row">
          ${sexoChip}
          <div class="hermano-nombre">${esc(h.nombre)}</div>
        </div>
        <div class="hermano-chips">${chips || '<span class="sin-roles">Sin roles</span>'}</div>
      </div>
      <div class="hermano-actions">
        <button class="btn-del" onclick="event.stopPropagation();confirmarEliminar('${h.id}','${(h.nombre || '').replace(/'/g, "\\'")}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

window.filtrarLista = function() {
  const q   = norm(document.getElementById('h-search')?.value || '');
  const rol = document.getElementById('h-rol')?.value || '';
  renderLista(publicadores.filter(h =>
    (!q   || norm(h.nombre).includes(q)) &&
    (!rol || (rol === '__sin_roles__'
      ? (h.roles || []).length === 0
      : (h.roles || []).includes(rol)))
  ));
};

// ─────────────────────────────────────────
//   MODAL — ADD / EDIT
// ─────────────────────────────────────────
function _actualizarNavModal(id) {
  const idx   = listaVisible.findIndex(p => p.id === id);
  const total = listaVisible.length;
  const navRow = document.getElementById('modal-nav-row');
  const counter = document.getElementById('modal-nav-counter');
  const btnPrev = document.getElementById('modal-nav-prev');
  const btnNext = document.getElementById('modal-nav-next');
  const visible = idx !== -1 && total > 1;
  if (navRow)   navRow.style.display  = visible ? 'flex' : 'none';
  if (counter)  counter.textContent   = visible ? `${idx + 1} de ${total}` : '';
  if (btnPrev)  btnPrev.disabled      = idx <= 0;
  if (btnNext)  btnNext.disabled      = idx >= total - 1;
}

window.navHermano = async function(dir) {
  const idx = listaVisible.findIndex(p => p.id === editandoId);
  if (idx === -1) return;
  const nextHermano = listaVisible[idx + dir];
  if (!nextHermano) return;

  if (editandoId) {
    const ok = await _guardarSilencioso();
    if (ok) { filtrarLista(); uiToast('Guardado', 'success'); }
    else       uiToast('No se pudo guardar', 'error');
  }
  abrirEditar(nextHermano.id);
};

window.abrirNuevo = function() {
  editandoId = null;
  _modalSexo = null;
  document.getElementById('modal-titulo').textContent = 'Nuevo hermano';
  document.getElementById('modal-nombre').value = '';
  document.getElementById('modal-status').textContent = '';
  TODOS_LOS_ROLES.forEach(r => {
    const cb = document.getElementById('hcb-' + r.id);
    if (cb) cb.checked = false;
  });
  renderSexoBtns();
  const navRow = document.getElementById('modal-nav-row');
  if (navRow) navRow.style.display = 'none';
  document.getElementById('modal-hermano').style.display = 'flex';
  document.getElementById('modal-nombre').focus();
};

window.abrirEditar = function(id) {
  const h = publicadores.find(p => p.id === id);
  if (!h) return;
  editandoId = id;
  _modalSexo = h.sexo || null;
  document.getElementById('modal-titulo').textContent = esc(h.nombre);
  document.getElementById('modal-nombre').value = h.nombre;
  document.getElementById('modal-status').textContent = '';
  TODOS_LOS_ROLES.forEach(r => {
    const cb = document.getElementById('hcb-' + r.id);
    if (cb) cb.checked = (h.roles || []).includes(r.id);
  });
  renderSexoBtns();
  _actualizarNavModal(id);
  document.getElementById('modal-hermano').style.display = 'flex';
};

window.cerrarModal = function() {
  document.getElementById('modal-hermano').style.display = 'none';
  editandoId = null;
};

// Roles a guardar desde el modal de hermano.
// El modal solo tiene checkbox para TODOS_LOS_ROLES (asignaciones + VM). ANCIANO,
// SIERVO_MINISTERIAL, los precursores y los roles de congregación se editan en la
// vista Responsabilidades y NO tienen checkbox acá, así que hay que conservarlos:
// reconstruir el array solo desde los checkboxes los borraba en silencio (bastaba
// con abrir a un anciano y tocar Guardar para dejarlo sin el rol, y con eso sin
// privilegio para Tesoros/Perlas/Presidente/"¿Qué diría?" en Vida y Ministerio).
function _rolesParaGuardar(pubId) {
  const conCheckbox = new Set(TODOS_LOS_ROLES.map(r => r.id));
  const marcados    = TODOS_LOS_ROLES
    .filter(r => document.getElementById('hcb-' + r.id)?.checked)
    .map(r => r.id);
  const existentes  = publicadores.find(p => p.id === pubId)?.roles || [];
  const preservados = existentes.filter(rid => !conCheckbox.has(rid));
  return [...new Set([...preservados, ...marcados])];
}

// Guarda el hermano actual en Firestore sin cerrar el modal ni mostrar toast.
// Retorna true si éxito, false si error. Solo funciona si editandoId está seteado.
async function _guardarSilencioso() {
  if (!editandoId) return true;
  const nombre = document.getElementById('modal-nombre').value.trim();
  if (!nombre) return false;
  const roles = _rolesParaGuardar(editandoId);
  const data = { nombre, roles };
  if (_modalSexo) data.sexo = _modalSexo;
  if (!_modalSexo) {
    const existing = publicadores.find(p => p.id === editandoId);
    if (existing?.sexo) data.sexo = null;
  }
  try {
    await updateDoc(doc(pubCol(), editandoId), data);
    const idx = publicadores.findIndex(p => p.id === editandoId);
    if (idx >= 0) publicadores[idx] = { ...publicadores[idx], ...data };
    publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    return true;
  } catch(e) {
    return false;
  }
}

function renderSexoBtns() {
  ['H', 'M'].forEach(s => {
    const btn = document.getElementById('btn-sexo-' + s);
    if (!btn) return;
    btn.classList.toggle('btn-sexo-active', _modalSexo === s);
  });
}

window.selectSexo = function(s) {
  _modalSexo = (_modalSexo === s) ? null : s; // toggle off si ya estaba activo
  renderSexoBtns();
};

window.toggleSexo = async function(id, currentSexo) {
  const nextSexo = currentSexo === 'H' ? 'M' : currentSexo === 'M' ? null : 'H';
  try {
    await updateDoc(doc(pubCol(), id), { sexo: nextSexo });
    const idx = publicadores.findIndex(p => p.id === id);
    if (idx >= 0) publicadores[idx] = { ...publicadores[idx], sexo: nextSexo };
    filtrarLista();
  } catch(e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

window.guardarHermano = async function() {
  const nombre = document.getElementById('modal-nombre').value.trim();
  if (!nombre) { uiToast('Ingresá un nombre', 'error'); return; }

  const status = document.getElementById('modal-status');
  status.style.color = 'var(--k-tx-888888, #888)'; status.textContent = 'Guardando…';

  // Nuevo hermano
  if (!editandoId) {
    const roles = TODOS_LOS_ROLES
      .filter(r => document.getElementById('hcb-' + r.id)?.checked)
      .map(r => r.id);
    const data = { nombre, roles };
    if (_modalSexo) data.sexo = _modalSexo;
    try {
      const ref = await addDoc(pubCol(), { ...data, activo: true });
      publicadores.push({ id: ref.id, ...data, activo: true });
      publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
      cerrarModal();
      filtrarLista();
      uiToast('Hermano agregado', 'success');
      logActividad(CONGRE_ID, 'hermanos', 'guardado', 'Hermano agregado: ' + nombre);
    } catch(e) {
      status.style.color = 'var(--k-tx-f09595, #F09595)'; status.textContent = 'Error: ' + e.message;
    }
    return;
  }

  // Editar existente
  const ok = await _guardarSilencioso();
  if (ok) {
    cerrarModal();
    filtrarLista();
    uiToast('Guardado', 'success');
    logActividad(CONGRE_ID, 'hermanos', 'guardado', 'Hermano editado: ' + nombre);
  } else {
    status.style.color = 'var(--k-tx-f09595, #F09595)'; status.textContent = 'Error al guardar';
  }
};

window.confirmarEliminar = async function(id, nombre) {
  const ok = await uiConfirm({
    title: 'Eliminar hermano',
    msg: `¿Eliminar a ${nombre}? Esta acción no se puede deshacer.`,
    confirmText: 'Eliminar', cancelText: 'Cancelar', type: 'danger',
  });
  if (!ok) return;
  try {
    await deleteDoc(doc(pubCol(), id));
    publicadores = publicadores.filter(p => p.id !== id);
    filtrarLista();
    uiToast('Eliminado', 'success');
  } catch(e) {
    uiToast('Error: ' + e.message, 'error');
  }
};

window.abrirPlanilla = function() {
  if (sheetsUrl) window.open(sheetsUrl, '_blank');
};

// ─────────────────────────────────────────
//   SEMANAS ESPECIALES
// ─────────────────────────────────────────
function especCol() {
  return collection(db, 'congregaciones', CONGRE_ID, 'semanasEspeciales');
}

const TIPO_LABELS = {
  conmemoracion:   'Conmemoración',
  superintendente: 'Visita superintendente',
  asamblea:        'Asamblea',
};
const TIPO_COLORS = {
  conmemoracion:   { color: '#E8C94A', bg: 'rgba(232,201,74,0.08)' },
  superintendente: { color: '#7F77DD', bg: 'rgba(127,119,221,0.08)' },
  asamblea:        { color: '#F09595', bg: 'rgba(240,149,149,0.08)' },
};

function especialLabel(e) {
  if (!e) return '';
  if (e.tipo === 'asamblea') {
    if (e.subtipo === 'regional') return 'Asamblea Regional';
    if (e.subtipo === 'circuito') return 'Asamblea de Circuito';
  }
  return TIPO_LABELS[e.tipo] || e.tipo;
}

function hoyISO() {
  return fmtDateLocal(new Date());
}

function addDaysIso(iso, days) {
  const d = isoToDate(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return fmtDateLocal(d);
}

function fmtFechaCorta(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${String(y).slice(-2)}`;
}
function lunesISO(date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function isoToDate(iso) { return iso ? new Date(iso + 'T00:00:00') : null; }

async function cargarEspeciales() {
  try {
    const snap = await getDocs(query(especCol(), orderBy('__name__')));
    semanasEspeciales = {};
    snap.forEach(d => { semanasEspeciales[d.id] = d.data(); });
    renderEspecialesList();
  } catch(e) { console.error('Error cargando especiales:', e); }
}

function renderEspecialesList() {
  const el = document.getElementById('especiales-lista');
  const resumenEl = document.getElementById('especiales-resumen');
  if (!el) return;
  const entries = Object.entries(semanasEspeciales).sort(([a],[b]) => b.localeCompare(a));
  const hoy = hoyISO();
  const lunesActual = lunesISO(new Date(hoy + 'T12:00:00'));
  const actual = entries.find(([lunes]) => lunes === lunesActual) || null;
  const proximo = entries.find(([lunes]) => lunes > lunesActual) || (!actual ? entries.find(([lunes]) => lunes >= lunesActual) : null) || null;

  if (resumenEl) {
    const bloques = [];
    if (actual) {
      const [lunes, e] = actual;
      bloques.push(`
        <div class="especiales-summary-card">
          <div class="especiales-summary-kicker">Esta semana</div>
          <div class="especiales-summary-title">${especialLabel(e)}</div>
          <div class="especiales-summary-sub">Semana del ${fmtFechaCorta(lunes)} al ${fmtFechaCorta(addDaysIso(lunes, 6))}</div>
        </div>
      `);
    }
    if (proximo) {
      const [lunes, e] = proximo;
      bloques.push(`
        <div class="especiales-summary-card">
          <div class="especiales-summary-kicker">Próximo evento</div>
          <div class="especiales-summary-title">${especialLabel(e)}</div>
          <div class="especiales-summary-sub">Semana del ${fmtFechaCorta(lunes)} al ${fmtFechaCorta(addDaysIso(lunes, 6))}</div>
        </div>
      `);
    }
    resumenEl.className = 'especiales-resumen';
    resumenEl.innerHTML = bloques.join('');
  }

  if (!entries.length) {
    el.innerHTML = '<div class="especiales-empty">Sin semanas especiales configuradas.</div>';
    return;
  }
  const makeCard = ([lunes, e]) => {
    const { color } = TIPO_COLORS[e.tipo] || { color: '#eee' };
    const lunesDate   = isoToDate(lunes);
    const domingoDate = new Date(lunesDate); domingoDate.setDate(lunesDate.getDate() + 6);
    const rango = `${fmtFechaCorta(lunes)} – ${fmtFechaCorta(fmtDateLocal(domingoDate))}`;
    const label = especialLabel(e);
    const extra = (e.tipo === 'conmemoracion' && e.fechaEvento !== lunes)
      ? `Evento: ${fmtFechaCorta(e.fechaEvento)}`
      : (e.fechaEvento ? `Fecha cargada: ${fmtFechaCorta(e.fechaEvento)}` : '');
    const isCurrent = lunes === lunesActual;
    const isNext = proximo && proximo[0] === lunes;
    return `<div class="especial-item${isCurrent ? ' is-current' : ''}${isNext ? ' is-next' : ''}">
      <div class="especial-dot" style="background:${color};"></div>
      <div class="especial-info">
        <div class="especial-meta">
          ${isCurrent ? '<span class="especial-chip current">Esta semana</span>' : ''}
          ${isNext ? '<span class="especial-chip next">Próximo</span>' : ''}
          <span class="especial-range">${rango}</span>
        </div>
        <div class="especial-label">${label}</div>
        <div class="especial-fecha">${extra || 'Semana marcada como especial para el resto de la app.'}</div>
      </div>
      <div class="especial-actions">
        <button class="especial-edit-btn" onclick="editarEspecial('${lunes}')" title="Editar">✎</button>
        <button class="especial-del-btn" onclick="eliminarEspecial('${lunes}')" title="Eliminar">×</button>
      </div>
    </div>`;
  };

  const futuras = entries.filter(([lunes]) => lunes > lunesActual);
  const actuales = entries.filter(([lunes]) => lunes === lunesActual);
  const pasadas = entries.filter(([lunes]) => lunes < lunesActual);

  const bloques = [];
  if (actuales.length) {
    bloques.push(`<div class="especiales-section-label">Esta semana</div>`);
    bloques.push(actuales.map(makeCard).join(''));
  }
  if (futuras.length) {
    bloques.push(`<div class="especiales-section-label">Próximas</div>`);
    bloques.push(futuras.reverse().map(makeCard).join(''));
  }
  if (pasadas.length) {
    bloques.push(`<div class="especiales-section-label">Pasadas</div>`);
    bloques.push(pasadas.map(([lunes, e]) => makeCard([lunes, e]).replace('especial-item', 'especial-item is-past')).join(''));
  }

  el.innerHTML = bloques.join('');
}

window.toggleFormEspecial = function() {
  const overlay = document.getElementById('especiales-modal-overlay');
  if (!overlay) return;
  if (overlay.style.display !== 'none') {
    window.cerrarFormEspecial();
  } else {
    _especialEditLunes = null;
    document.getElementById('esp-tipo').value = 'conmemoracion';
    document.getElementById('esp-subtipo').value = 'circuito';
    document.getElementById('esp-fecha').value = '';
    const title = document.getElementById('esp-form-title');
    const saveBtn = document.getElementById('btn-guardar-especial');
    if (title) title.textContent = 'Nuevo evento especial';
    if (saveBtn) saveBtn.textContent = 'Guardar';
    window.actualizarLabelFechaEsp();
    overlay.style.display = 'flex';
  }
};

window.cerrarFormEspecial = function() {
  const overlay = document.getElementById('especiales-modal-overlay');
  if (overlay) overlay.style.display = 'none';
  _especialEditLunes = null;
  const title = document.getElementById('esp-form-title');
  const saveBtn = document.getElementById('btn-guardar-especial');
  if (title) title.textContent = 'Nuevo evento especial';
  if (saveBtn) saveBtn.textContent = 'Guardar';
};

window.editarEspecial = function(lunes) {
  const item = semanasEspeciales[lunes];
  if (!item) return;
  _especialEditLunes = lunes;
  document.getElementById('esp-tipo').value = item.tipo || 'conmemoracion';
  document.getElementById('esp-subtipo').value = item.subtipo || 'circuito';
  document.getElementById('esp-fecha').value = item.fechaEvento || lunes;
  const title = document.getElementById('esp-form-title');
  const saveBtn = document.getElementById('btn-guardar-especial');
  if (title) title.textContent = 'Editar evento especial';
  if (saveBtn) saveBtn.textContent = 'Guardar cambios';
  window.actualizarLabelFechaEsp();
  const overlay = document.getElementById('especiales-modal-overlay');
  if (overlay) overlay.style.display = 'flex';
};

window.actualizarLabelFechaEsp = function() {
  const tipo = document.getElementById('esp-tipo')?.value;
  const lbl  = document.getElementById('esp-fecha-label');
  const subtipoWrap = document.getElementById('esp-subtipo-wrap');
  if (subtipoWrap) subtipoWrap.style.display = tipo === 'asamblea' ? '' : 'none';
  if (lbl) lbl.textContent = tipo === 'conmemoracion'
    ? 'Fecha exacta del evento'
    : 'Fecha de la semana (cualquier día)';
};

window.guardarEspecial = async function() {
  const tipo  = document.getElementById('esp-tipo')?.value;
  const fecha = document.getElementById('esp-fecha')?.value;
  const subtipo = document.getElementById('esp-subtipo')?.value || 'circuito';
  if (!tipo || !fecha) { await uiAlert('Completá todos los campos.'); return; }
  const lunes = lunesISO(new Date(fecha + 'T12:00:00'));
  const data  = { tipo, fechaEvento: fecha, ...(tipo === 'asamblea' ? { subtipo } : {}) };
  try {
    if (_especialEditLunes && _especialEditLunes !== lunes) {
      await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'semanasEspeciales', _especialEditLunes));
      delete semanasEspeciales[_especialEditLunes];
    }
    await setDoc(doc(db, 'congregaciones', CONGRE_ID, 'semanasEspeciales', lunes), data);
    semanasEspeciales[lunes] = data;
    _especialEditLunes = null;
    renderEspecialesList();
    window.cerrarFormEspecial();
    uiToast(`${especialLabel(data)} guardada`, 'success');
    logActividad(CONGRE_ID, 'hermanos', 'guardado', 'Semana especial: ' + especialLabel(data));
  } catch(e) { await uiAlert('Error al guardar: ' + e.message); }
};

window.eliminarEspecial = async function(lunes) {
  const ok = await uiConfirm({ title: 'Eliminar semana especial', msg: '¿Seguro que querés eliminarla?', confirmText: 'Eliminar', type: 'danger' });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'congregaciones', CONGRE_ID, 'semanasEspeciales', lunes));
    delete semanasEspeciales[lunes];
    renderEspecialesList();
    uiToast('Eliminada', 'success');
  } catch(e) { await uiAlert('Error: ' + e.message); }
};

// ─────────────────────────────────────────
//   CHAT / NOTAS — solo canal Congregación, autor "Administrador"
// ─────────────────────────────────────────
const CHAT_AUTOR = 'Administrador';

function chatNotasCol() {
  return collection(db, 'congregaciones', CONGRE_ID, 'chatNotas', 'congregacion', 'mensajes');
}

function getMisIdsAdmin() {
  try { return JSON.parse(sessionStorage.getItem('chatMisIdsAdmin') || '[]'); }
  catch { return []; }
}
function addMiIdAdmin(id) {
  const arr = getMisIdsAdmin(); arr.push(id);
  sessionStorage.setItem('chatMisIdsAdmin', JSON.stringify(arr));
}

// ─────────────────────────────────────────
//   DUPLICADOS — detección fuzzy
// ─────────────────────────────────────────
function normSorted(s) {
  return norm(s).split(/\s+/).filter(Boolean).sort().join(' ');
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => j ? j : i)
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

function sonSimilares(a, b) {
  const na = norm(a), nb = norm(b);
  if (na === nb) return true;
  const sa = normSorted(a), sb = normSorted(b);
  if (sa === sb) return true; // orden de palabras invertido (Juan Pérez = Pérez Juan)
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return true;
  // Levenshtein tanto en orden original como en ordenado (cubre: invertido + typo)
  const dist       = levenshtein(na, nb);
  const distSorted = levenshtein(sa, sb);
  return Math.min(dist, distSorted) <= 2;
}

window.abrirDuplicados = async function() {
  showView('view-duplicados');
  const el = document.getElementById('dupes-list');
  const loading = document.getElementById('dupes-loading');
  el.innerHTML = '';
  loading.style.display = '';
  try {
    const snap = await getDocs(pubCol());
    publicadores = snap.docs.map(d => ({ id: d.id, ...d.data(), roles: d.data().roles || [] }));
    publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
  } catch(e) {
    loading.style.display = 'none';
    el.innerHTML = `<div class="error-wrap">Error: ${e.message}</div>`;
    return;
  }
  loading.style.display = 'none';
  renderDuplicados();
};

function renderDuplicados() {
  const el = document.getElementById('dupes-list');

  // Agrupamiento fuzzy: orden de palabras invertido + typos de hasta 2 caracteres
  const used = new Array(publicadores.length).fill(false);
  const dupes = [];
  for (let i = 0; i < publicadores.length; i++) {
    if (used[i]) continue;
    const cluster = [publicadores[i]];
    used[i] = true;
    for (let j = i + 1; j < publicadores.length; j++) {
      if (used[j]) continue;
      if (sonSimilares(publicadores[i].nombre, publicadores[j].nombre)) {
        cluster.push(publicadores[j]);
        used[j] = true;
      }
    }
    if (cluster.length > 1) dupes.push(cluster);
  }
  if (!dupes.length) {
    el.innerHTML = '<div class="empty-state">No se encontraron duplicados.</div>';
    return;
  }
  el.innerHTML = dupes.map(group => {
    const ids = group.map(p => p.id).join(',');
    const entries = group.map(p => {
      const asign = (p.roles||[]).filter(r => !r.startsWith('VM_'));
      const vm    = (p.roles||[]).filter(r =>  r.startsWith('VM_'));
      const chips = [
        ...asign.map(r => `<span class="chip chip-asign">${esc(rolLabel(r))}</span>`),
        ...vm.map(r    => `<span class="chip chip-vm">${esc(rolLabel(r))}</span>`),
      ].join('') || '<span class="sin-roles">Sin roles</span>';
      return `<div class="dup-entry">
        <div class="dup-entry-nombre">${esc(p.nombre)}</div>
        <div class="hermano-chips">${chips}</div>
      </div>`;
    }).join('');

    const allRoles = [...new Set(group.flatMap(p => p.roles || []))];
    const previewChips = allRoles.map(r => {
      const cls = r.startsWith('VM_') ? 'chip-vm' : 'chip-asign';
      return `<span class="chip ${cls}">${esc(rolLabel(r))}</span>`;
    }).join('') || '<span class="sin-roles">Sin roles</span>';

    return `<div class="dup-group">
      <div class="dup-header">
        <span class="dup-nombre">${esc(group[0].nombre)}</span>
        <span class="dup-count">${group.length} entradas</span>
      </div>
      <div class="dup-entries">${entries}</div>
      <div class="dup-preview">
        <div class="dup-preview-label">Resultado tras fusionar:</div>
        <div class="hermano-chips">${previewChips}</div>
      </div>
      <button class="btn-fusionar" onclick="fusionarGrupo('${ids}')">Fusionar</button>
    </div>`;
  }).join('');
}

window.fusionarGrupo = async function(idsStr) {
  const ids   = idsStr.split(',');
  const group = ids.map(id => publicadores.find(p => p.id === id)).filter(Boolean);
  if (group.length < 2) return;

  const ok = await uiConfirm({
    title: 'Fusionar duplicados',
    msg: `Se conservará "${group[0].nombre}" con todos los roles combinados y se eliminarán ${group.length - 1} entrada${group.length > 2 ? 's' : ''}.`,
    confirmText: 'Fusionar', cancelText: 'Cancelar', type: 'warn',
  });
  if (!ok) return;

  const winner   = group.reduce((a, b) => (b.roles||[]).length > (a.roles||[]).length ? b : a);
  const allRoles = [...new Set(group.flatMap(p => p.roles || []))];
  const toDelete = group.filter(p => p.id !== winner.id);

  try {
    await updateDoc(doc(pubCol(), winner.id), { roles: allRoles });
    for (const p of toDelete) await deleteDoc(doc(pubCol(), p.id));
    const winnerIdx = publicadores.findIndex(p => p.id === winner.id);
    if (winnerIdx >= 0) publicadores[winnerIdx] = { ...publicadores[winnerIdx], roles: allRoles };
    publicadores = publicadores.filter(p => !toDelete.some(d => d.id === p.id));
    publicadores.sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)));
    uiToast('Fusionado correctamente', 'success');
    renderDuplicados();
  } catch(e) {
    await uiAlert('Error: ' + e.message);
  }
};

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
  refreshChatNotas();
};

window.closeChatPanel = function() {
  const overlay = document.getElementById('chat-overlay');
  if (overlay) overlay.style.display = 'none';
  document.body.style.overflow = '';
};

async function refreshChatNotas() {
  const loadEl = document.getElementById('chat-loading');
  const listEl = document.getElementById('chat-list');
  const emptyEl = document.getElementById('chat-empty');
  const errEl = document.getElementById('chat-error');
  if (loadEl) { loadEl.style.display = ''; listEl.style.display = 'none'; if(emptyEl) emptyEl.style.display='none'; if(errEl) errEl.style.display='none'; }
  try {
    const snap = await getDocs(query(chatNotasCol(), orderBy('createdAt', 'desc'), limit(80)));
    if (loadEl) loadEl.style.display = 'none';
    const misIds = getMisIdsAdmin();
    const currentUid = window.currentUser?.uid || null;
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (!items.length) { if(emptyEl) emptyEl.style.display=''; return; }
    listEl.innerHTML = items.map(n => {
      const esMio = (currentUid && n.ownerUid === currentUid) || misIds.includes(n.id);
      const fecha = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
      const fechaStr = `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')} ${String(fecha.getHours()).padStart(2,'0')}:${String(fecha.getMinutes()).padStart(2,'0')}`;
      const acciones = esMio ? `<div class="chat-item-actions"><button class="chat-btn-edit" onclick="abrirEditNota('${n.id}',${JSON.stringify(n.texto||'').replace(/</g,'\\u003c')})">Editar</button><button class="chat-btn-del" onclick="eliminarNota('${n.id}')">Eliminar</button></div>` : '';
      return `<div class="chat-item"><div class="chat-item-head"><span class="chat-item-author">${esc(n.autor||'?')}</span><span class="chat-item-date">${fechaStr}</span></div><div class="chat-item-text">${esc(n.texto||'')}</div>${acciones}</div>`;
    }).join('');
    listEl.style.display = '';
  } catch(err) {
    if (loadEl) loadEl.style.display = 'none';
    if (errEl) { errEl.innerHTML = `<div class="error-wrap" style="margin:8px 12px;font-size:12px;">Error: ${err.message}</div>`; errEl.style.display = ''; }
  }
}

window.sendChatNota = async function(btnEl) {
  const texto = document.getElementById('chat-mensaje').value.trim();
  if (!texto) { await uiAlert('Escribí una nota antes de publicar.', 'Mensaje vacío'); return; }
  if (btnEl) btnEl.disabled = true;
  try {
    const ref = await addDoc(chatNotasCol(), {
      autor: CHAT_AUTOR, texto,
      createdAt: Timestamp.now(),
      canal: 'congregacion', grupo: 'C',
      ownerUid: window.currentUser?.uid || null,
    });
    addMiIdAdmin(ref.id);
    document.getElementById('chat-mensaje').value = '';
    await refreshChatNotas();
    uiToast('Nota publicada', 'success');
  } catch(err) {
    await uiAlert(`No se pudo publicar: ${err.message}`, 'Error');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
};

let _chatEditDocId = null;

window.abrirEditNota = function(docId, textoActual) {
  _chatEditDocId = docId;
  const ta = document.getElementById('chat-edit-texto');
  if (ta) ta.value = textoActual;
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
    await updateDoc(doc(chatNotasCol(), _chatEditDocId), { texto });
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
    await deleteDoc(doc(chatNotasCol(), docId));
    const misIds = getMisIdsAdmin().filter(id => id !== docId);
    sessionStorage.setItem('chatMisIdsAdmin', JSON.stringify(misIds));
    await refreshChatNotas();
    uiToast('Nota eliminada', 'success');
  } catch(err) {
    await uiAlert('Error: ' + err.message);
  }
};
