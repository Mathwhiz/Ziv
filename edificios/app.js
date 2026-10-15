import { db } from '../shared/firebase.js';
import '../shared/auth.js';
import { logActividad } from '../shared/actividad.js';
import {
  collection, doc, getDoc, getDocs, onSnapshot, runTransaction, updateDoc, setDoc,
  writeBatch, serverTimestamp, deleteField, increment, FieldPath,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

await window.authGuard('acceso_edificios');

if (!sessionStorage.getItem('congreId')) window.location.href = '../index.html';

const CONGRE_ID     = sessionStorage.getItem('congreId')     || '';
const CONGRE_NOMBRE = sessionStorage.getItem('congreNombre') || CONGRE_ID;
const YO            = window.currentUser || {};
const YO_UID        = YO.uid;
const YO_NOMBRE     = YO.displayName || 'Sin nombre';
const YO_PUB        = YO.matchedPublisherId || null;   // el responsable se guarda por publicador
const PUEDE_ADMIN   = !!window.hasPermission?.('administrar_edificios');

document.querySelectorAll('.js-congre').forEach(el => el.textContent = CONGRE_NOMBRE);

const edifCol = collection(db, 'congregaciones', CONGRE_ID, 'edificios');
const edifRef = id => doc(edifCol, id);

// ─────────────────────────────────────────
//   ESTADO
// ─────────────────────────────────────────
let edificios = [];          // docs de edificios/ ({ id, ...data }), vivos por onSnapshot
let territorios = [];        // { id, grupoId, poligonos: [[[lat,lng], …]] } — del espejo mapa_territorios
let grupos = {};             // { id: { label, color } }
let filtro = 'todos';
let selId = null;            // pin seleccionado
let hojaEdifId = null;       // edificio cuya hoja está abierta (se repinta con cada cambio)
let moviendoId = null;       // corrigiendo la ubicación (pin arrastrable)
let ubicandoId = null;       // esperando un toque en el mapa para un edificio sin ubicación
let agregando = false;       // admin: esperando un toque en el mapa para un edificio nuevo
let listaAbierta = false;
let porteroId = null, porteroModo = null, herramienta = null, formaTmp = null;
let ocupado = false;         // una transacción en curso (evita doble toque)
let primeraCarga = true;

const ICONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="1.5"/><path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1M11 21v-3h2v3"/></svg>';
const RES = {
  atendio:    { label: 'Atendió',    corto: 'Atend.', c: 'var(--r-atendio)' },
  no_atendio: { label: 'No atendió', corto: 'No at.', c: 'var(--r-no)' },
  no_quiere:  { label: 'No quiere',  corto: 'No q.',  c: 'var(--r-noquiere)' },
  revisita:   { label: 'Revisita',   corto: 'Rev.',   c: 'var(--r-revisita)' },
};
const PRECISION_OK = ['exacta', 'interpolada', 'esquina', 'manual'];
const PREC_TXT = {
  aproximada: 'La ubicación es aproximada.',
  solo_calle: 'Solo se encontró la calle: el pin está en el medio de la calle.',
  sin_ubicar: 'Este edificio todavía no está en el mapa.',
};
const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ─────────────────────────────────────────
//   HELPERS
// ─────────────────────────────────────────
const hoy = () => fmtDateLocal(new Date());
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const porId = id => edificios.find(e => e.id === id);
const pos = e => e?.punto ? [e.punto.lat, e.punto.lng] : null;
const dudoso = e => !PRECISION_OK.includes(e.precision);
const marca = () => ({ actualizadoEn: serverTimestamp(), actualizadoPor: YO_UID });

function fechaTxt(iso, aprox) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return aprox ? `${MES[+m - 1]}. ${y}` : `${d}/${m}/${y.slice(2)}`;
}
function diasDesde(iso) { return Math.floor((Date.now() - new Date(iso + 'T12:00').getTime()) / 864e5); }
function haceTxt(d) {
  if (d < 1) return 'hoy';
  if (d < 60) return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
  if (d < 730) return `hace ${Math.round(d / 30)} meses`;
  return `hace ${Math.round(d / 365)} años`;
}
function grupoLbl(e) { return e.grupoId ? (grupos[e.grupoId]?.label || 'Grupo ' + e.grupoId) : 'sin grupo'; }

const esMio = e => !!(e.asignado && YO_PUB && e.asignado.pubId === YO_PUB);
// Quien gestiona un edificio (encargados, o su responsable) arma el portero, empieza vuelta, mueve el pin
// y ve el estado y el historial. El publicador común solo marca timbres: no ve cuándo se terminó.
const gestiona = e => PUEDE_ADMIN || esMio(e);
const estadoVisto = e => gestiona(e) ? estado(e) : { k: 'neutro', label: '', c: 'var(--e-neutro)' };

// Estado del edificio, según quién lo tiene y la última entrada del historial.
function estado(e) {
  if (e.asignado) {
    const mio = esMio(e);
    return { k: 'proc', label: mio ? 'A tu cargo' : `A cargo de ${e.asignado.nombre}`, c: 'var(--e-proc)', mio };
  }
  const h = e.historial || [];
  const u = h[h.length - 1];
  if (!u) return { k: 'sin', label: 'Sin predicar', c: 'var(--e-sin)' };
  if (u.fin && !u.soltado) {
    const d = diasDesde(u.fin);
    const c = d <= 180 ? 'var(--e-ok)' : d <= 365 ? 'var(--e-warn)' : 'var(--e-bad)';
    return { k: 'term', label: `Terminado ${haceTxt(d)}`, c };
  }
  const f = u.fin || u.inicio;
  return { k: 'parcial', label: 'Empezado, sin terminar' + (f ? ` · ${fechaTxt(f, u.fin ? u.finAprox : u.inicioAprox)}` : ''), c: 'var(--e-parcial)' };
}

// ─────────────────────────────────────────
//   PORTERO: claves y progreso
// ─────────────────────────────────────────
// Dos formas de portero:
//  - 'numerado' { total, columnas }: botones 1, 2, 3… como en la mayoría de los porteros (clave "n-5")
//  - 'pisos' { pisos, deptos, pb, nom }: "1A", "2B"… (clave "piso-depto": "3-B", "PB-A").
//    Los portero guardados antes de existir `tipo` son de este tipo.
const tipoForma = f => f.tipo === 'numerado' ? 'numerado' : 'pisos';

// Filas tal como se dibujan (de arriba hacia abajo), con la clave y la etiqueta de cada timbre.
function grilla(f) {
  if (tipoForma(f) === 'numerado') {
    const cols = f.columnas || 2, filas = [];
    for (let i = 1; i <= f.total; i += cols) {
      filas.push({ lbl: null, celdas: Array.from({ length: Math.min(cols, f.total - i + 1) }, (_, j) => ({ k: `n-${i + j}`, lbl: String(i + j) })) });
    }
    return { filas, cols };
  }
  const deptos = Array.from({ length: f.deptos }, (_, i) => f.nom === 'numeros' ? String(i + 1) : String.fromCharCode(65 + i));
  const pisos = [];
  for (let p = f.pisos; p >= 1; p--) pisos.push(String(p));
  if (f.pb) pisos.push('PB');
  return { cols: deptos.length, filas: pisos.map(p => ({ lbl: p, celdas: deptos.map(d => ({ k: `${p}-${d}`, lbl: p === 'PB' ? `PB ${d}` : p + d })) })) };
}
const celdasDe = f => grilla(f).filas.flatMap(r => r.celdas);
function nombreTimbre(k) {
  const [p, d] = k.split('-');
  return p === 'n' ? `Timbre ${d}` : `${p === 'PB' ? 'PB' : p + '°'} ${d}`;
}
function descForma(f) {
  if (tipoForma(f) === 'numerado') return `${f.total} timbres numerados`;
  return `${f.pisos} ${f.pisos === 1 ? 'piso' : 'pisos'}${f.pb ? ' + PB' : ''} · ${f.deptos} por piso`;
}
const vueltaDe = e => e.vuelta || 1;

// Un timbre cuenta en la vuelta actual; "No quiere" vale para siempre.
function marcaVigente(e, k) {
  const r = e.timbres?.[k];
  return r && (r.res === 'no_quiere' || r.vuelta === vueltaDe(e)) ? r : null;
}
function progreso(e) {
  if (!e.forma) return null;
  const celdas = celdasDe(e.forma);
  let hechos = 0, noQuiere = 0;
  celdas.forEach(c => {
    const r = marcaVigente(e, c.k);
    if (r?.res === 'no_quiere') noQuiere++;
    else if (r) hechos++;
  });
  return { total: celdas.length, hechos, noQuiere };
}

// ─────────────────────────────────────────
//   TERRITORIOS (punto en polígono, para edificios nuevos)
// ─────────────────────────────────────────
function dentro([lat, lng], pol) {
  let adentro = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [yi, xi] = pol[i], [yj, xj] = pol[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) adentro = !adentro;
  }
  return adentro;
}
function distBorde(pt, pol) {
  const k = Math.cos(pt[0] * Math.PI / 180) * 111320;
  const px = pt[1] * k, py = pt[0] * 111320;
  let min = Infinity;
  for (let i = 0; i < pol.length; i++) {
    const a = pol[i], b = pol[(i + 1) % pol.length];
    const ax = a[1] * k, ay = a[0] * 111320, bx = b[1] * k, by = b[0] * 111320;
    const dx = bx - ax, dy = by - ay;
    const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
    min = Math.min(min, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return min;
}
// Las direcciones suelen caer sobre la calle, entre dos manzanas: si no está adentro de ninguno,
// el territorio más cercano a menos de 80 m (mismo criterio que tools/edificios_ubicar.py).
function territorioDe(pt) {
  let cerca = null;
  for (const t of territorios) {
    if (t.poligonos.some(p => dentro(pt, p))) return t;
    const d = Math.min(...t.poligonos.map(p => distBorde(pt, p)));
    if (d <= 80 && (!cerca || d < cerca.d)) cerca = { d, t };
  }
  return cerca?.t || null;
}

// ─────────────────────────────────────────
//   MAPA
// ─────────────────────────────────────────
const map = L.map('map', { zoomControl: false }).setView([-36.635, -64.29], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
const ajustarLejos = () => {
  map.getContainer().classList.toggle('lejos', map.getZoom() < 16);
  document.getElementById('zoom-mas').disabled = map.getZoom() >= map.getMaxZoom();
  document.getElementById('zoom-menos').disabled = map.getZoom() <= map.getMinZoom();
};
map.on('zoomend', ajustarLejos);
ajustarLejos();
document.getElementById('zoom-mas').addEventListener('click', () => map.zoomIn());
document.getElementById('zoom-menos').addEventListener('click', () => map.zoomOut());

// Mismo límite que territorios/mapa.html (applyCityViewport): el área de los territorios con un
// margen del 22 %, y no se puede alejar más de un nivel de lo que hace falta para verla entera.
function limitarMapa() {
  const pts = territorios.flatMap(t => t.poligonos.flat());
  if (!pts.length) return;
  const justo = L.latLngBounds(pts);
  map.setMaxBounds(justo.pad(0.22));
  map.setMinZoom(Math.max(map.getBoundsZoom(justo, false) - 1, 10));
  ajustarLejos();
}

const marcadores = {};

function icono(e) {
  const st = estadoVisto(e);
  const cls = ['ed-pin', gestiona(e) && dudoso(e) && 'dudoso', selId === e.id && 'sel', moviendoId === e.id && 'moviendo'].filter(Boolean).join(' ');
  return L.divIcon({ className: '', iconSize: [30, 37], iconAnchor: [15, 37], html: `<div class="${cls}" style="--c:${st.c}">${ICONO}</div>` });
}

function pintarMarcadores() {
  const vis = new Set(filtrados().map(e => e.id));
  for (const id of Object.keys(marcadores)) {
    const e = porId(id);
    if (!e || !pos(e) || !vis.has(id)) { marcadores[id].remove(); delete marcadores[id]; }
  }
  edificios.forEach(e => {
    const p = pos(e);
    if (!p || !vis.has(e.id)) return;
    let m = marcadores[e.id];
    if (!m) {
      m = marcadores[e.id] = L.marker(p, { icon: icono(e), title: e.direccion }).addTo(map);
      m.on('click', () => { if (moviendoId !== e.id) abrirEdificio(e.id); });
    } else if (moviendoId !== e.id) {
      m.setLatLng(p);
      m.setIcon(icono(e));
    }
    m.setZIndexOffset(selId === e.id ? 1000 : 0);
  });
}

// ─────────────────────────────────────────
//   FILTROS, RESUMEN Y LISTA
// ─────────────────────────────────────────
const FILTROS = [
  { k: 'todos', label: 'Todos' },
  { k: 'sin', label: 'Sin predicar', c: 'var(--e-sin)' },
  { k: 'parcial', label: 'Sin terminar', c: 'var(--e-parcial)' },
  { k: 'proc', label: 'Con responsable', c: 'var(--e-proc)' },
  { k: 'term', label: 'Terminados', c: 'var(--e-ok)' },
  { k: 'mios', label: 'Míos' },
  { k: 'revisar', label: 'A revisar', c: '#EF9F27' },
];
function pasaFiltro(e, k) {
  if (k === 'todos') return true;
  if (k === 'mios') return esMio(e);
  if (k === 'revisar') return dudoso(e);
  return estado(e).k === k;
}
function filtrados() {
  const q = norm(document.getElementById('buscar').value);
  return edificios.filter(e => pasaFiltro(e, filtro) &&
    (!q || norm(`${e.direccion} ${e.calle || ''} ${e.terrId ? 'terr ' + e.terrId : ''}`).includes(q)));
}

function pintarChips() {
  document.getElementById('chips').innerHTML = FILTROS
    .filter(f => PUEDE_ADMIN || f.k === 'todos' || f.k === 'mios')   // los estados son solo para encargados
    .filter(f => f.k !== 'mios' || edificios.some(esMio))
    .map(f => {
      const n = edificios.filter(e => pasaFiltro(e, f.k)).length;
      return `<button class="chip ${filtro === f.k ? 'on' : ''}" data-f="${f.k}">${f.c ? `<span class="dot" style="--c:${f.c}"></span>` : ''}${f.label} <span class="n">${n}</span></button>`;
    }).join('');
}
document.getElementById('chips').addEventListener('click', ev => {
  const b = ev.target.closest('[data-f]'); if (!b) return;
  filtro = b.dataset.f;
  refrescar();
});
document.getElementById('buscar').addEventListener('input', () => refrescar());

function pintarResumen() {
  const vis = filtrados();
  const sinPos = PUEDE_ADMIN ? vis.filter(e => !pos(e)).length : 0;
  document.getElementById('resumen').innerHTML = `<b>${vis.length}</b> ${vis.length === 1 ? 'edificio' : 'edificios'}`
    + (sinPos ? ` · <span style="color:#EF9F27">${sinPos} sin ubicar</span>` : '');
}

document.getElementById('btn-lista').addEventListener('click', () => {
  listaAbierta = !listaAbierta;
  pintarLista();
});
function filaHtml(e) {
  const st = estadoVisto(e);
  const prog = progreso(e);
  return `<button class="fila" data-id="${esc(e.id)}"><span class="sq" style="--c:${st.c}"></span>
    <span><div class="t">${esc(e.direccion)}</div><div class="s">${st.label ? esc(st.label) + ' · ' : ''}${e.terrId ? `Terr. ${e.terrId}` : 'Sin territorio'}</div></span>
    <span class="der">${prog ? `${prog.hechos}/${prog.total - prog.noQuiere}<br>timbres` : ''}${!pos(e) && gestiona(e) ? '<br><span class="falta">sin ubicar</span>' : ''}</span></button>`;
}
function pintarLista() {
  const el = document.getElementById('lista');
  el.classList.toggle('on', listaAbierta);
  document.querySelector('#btn-lista span').textContent = listaAbierta ? 'Mapa' : 'Lista';
  document.getElementById('zoom-btns').hidden = listaAbierta;
  if (!listaAbierta) return;
  const vis = filtrados();
  if (!vis.length) { el.innerHTML = '<div class="vacio">No hay edificios con ese filtro.</div>'; return; }
  const porGrupo = {};
  vis.forEach(e => (porGrupo[e.grupoId || '—'] ||= []).push(e));
  el.innerHTML = '<div class="lista-in">' + Object.keys(porGrupo).sort().map(g => {
    const lbl = g === '—' ? 'Sin territorio / sin ubicar' : (grupos[g]?.label || 'Grupo ' + g);
    const filas = porGrupo[g].sort((a, b) => a.direccion.localeCompare(b.direccion)).map(filaHtml).join('');
    return `<div class="lista-sec">${esc(lbl)} · ${porGrupo[g].length}</div>${filas}`;
  }).join('') + '</div>';
}
document.getElementById('lista').addEventListener('click', ev => {
  const b = ev.target.closest('[data-id]'); if (!b) return;
  const e = porId(b.dataset.id);
  listaAbierta = false; pintarLista();
  if (pos(e)) map.flyTo(pos(e), 17, { duration: .6 });
  abrirEdificio(e.id);
});

function refrescar() {
  pintarChips(); pintarMarcadores(); pintarResumen(); pintarLista();
  if (hojaEdifId) abrirEdificio(hojaEdifId, true);
  if (porteroId && porteroModo === 'grilla') pintarPortero();
}

// ─────────────────────────────────────────
//   HOJAS (bottom sheets)
// ─────────────────────────────────────────
function abrirHoja(html, onClick) {
  hojaEdifId = null;   // solo la hoja de edificio se repinta con los cambios (abrirEdificio lo vuelve a poner)
  const h = document.getElementById('hoja');
  h.innerHTML = '<div class="asa"></div>' + html;
  h.onclick = onClick || null;
  document.getElementById('velo').classList.add('on');
  h.classList.add('on');
}
function cerrarHoja() {
  hojaEdifId = null;
  document.getElementById('velo').classList.remove('on');
  document.getElementById('hoja').classList.remove('on');
  if (selId) {
    const id = selId; selId = null;
    const e = porId(id);
    if (e && marcadores[id]) { marcadores[id].setIcon(icono(e)); marcadores[id].setZIndexOffset(0); }
  }
}
document.getElementById('velo').addEventListener('click', cerrarHoja);
document.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape') return;
  if (document.getElementById('hoja').classList.contains('on')) cerrarHoja();
  else if (porteroId) cerrarPortero();
  else if (moviendoId || ubicandoId || agregando) cancelarBanner();
});

// ─────────────────────────────────────────
//   HOJA DE EDIFICIO
// ─────────────────────────────────────────
function abrirEdificio(id, repintar = false) {
  const e = porId(id);
  if (!e) { if (repintar) cerrarHoja(); return; }
  if (!repintar) {
    const prev = selId; selId = id;
    [prev, id].forEach(i => { const x = porId(i); if (x && marcadores[i]) marcadores[i].setIcon(icono(x)); });
  }
  const g = gestiona(e);
  const st = estadoVisto(e);
  const prog = progreso(e);
  const h = (e.historial || []).slice().reverse();
  const portero = e.forma ? descForma(e.forma)
    : (g && e.pisosOSM ? `Sin cargar (OpenStreetMap: ≈ ${e.pisosOSM} pisos)` : 'Sin cargar');

  // Responsable: lo asigna el encargado de edificios (o un anciano / siervo ministerial), como el
  // encargado de grupo con los territorios. Lo principal es el portero: cualquiera marca timbres.
  let resp;
  if (e.asignado) {
    resp = `<div class="resp"><div class="resp-txt"><b>Responsable: ${st.mio ? 'vos' : esc(e.asignado.nombre)}</b> desde ${fechaTxt(e.asignado.desde)}.
      ${PUEDE_ADMIN ? '' : st.mio ? 'Cuando lo termines, avisale al encargado de edificios.' : 'Igual podés marcar timbres.'}</div>
      ${PUEDE_ADMIN ? `<div class="acciones dos"><button class="btn verde chico" data-a="terminar">✓ Terminado</button><button class="btn chico" data-a="asignar">Cambiar</button></div>
        <div class="acciones"><button class="btn chico" data-a="quitar">Quitar responsable</button></div>` : ''}</div>`;
  } else {
    resp = `<div class="resp"><div class="resp-txt"><b>Sin responsable.</b> ${PUEDE_ADMIN
      ? 'Asigná a quién se lo lleva para terminarlo (como en la planilla S-13).'
      : 'Lo asigna el encargado de edificios.'}</div>
      ${PUEDE_ADMIN ? '<div class="acciones"><button class="btn chico" data-a="asignar">Asignar responsable</button></div>' : ''}</div>`;
  }
  const enMapa = e.calle && norm(e.calle + (e.numero ? ' ' + e.numero : '')) !== norm(e.direccion)
    ? `<dt>En el mapa</dt><dd>${esc(e.calle)}${e.numero ? ' ' + e.numero : ''}</dd>` : '';

  const html = `
    <div class="h-sup">${e.terrId ? `Territorio ${e.terrId} · ${esc(grupoLbl(e))}` : 'Sin territorio'}</div>
    <div class="h-tit">${esc(e.direccion)}</div>
    ${st.label ? `<span class="estado-tag" style="--c:${st.c}">${esc(st.label)}</span>` : ''}
    ${g && dudoso(e) ? `<div class="aviso">${PREC_TXT[e.precision] || 'Ubicación a revisar.'} Si sabés dónde está, corregila.</div>` : ''}
    <dl class="datos">
      ${g ? enMapa : ''}
      <dt>Portero</dt><dd>${portero}</dd>
      ${prog ? `<dt>Vuelta ${vueltaDe(e)}</dt><dd>${prog.hechos} de ${prog.total - prog.noQuiere} timbres${prog.noQuiere ? ` · ${prog.noQuiere} no quieren` : ''}</dd>` : ''}
    </dl>
    ${e.forma || g
      ? `<div class="acciones"><button class="btn primario" data-a="portero">${ICONO} ${e.forma ? 'Abrir portero' : 'Armar el portero'}</button></div>`
      : '<div class="aviso neutro">El portero todavía no está cargado. Lo carga el responsable del edificio o el encargado de edificios.</div>'}
    ${resp}
    ${PUEDE_ADMIN ? '<div class="acciones"><button class="btn chico" data-a="editar">✏️ Editar edificio</button></div>'
      : g ? `<div class="acciones"><button class="btn chico" data-a="${pos(e) ? 'mover' : 'ubicar'}">📍 ${pos(e) ? 'Mover el pin en el mapa' : 'Ubicarlo en el mapa'}</button></div>` : ''}
    ${g ? `<div class="hist"><h4>Historial</h4>
      ${h.length ? h.map(x => `<div class="hist-item"><span>${esc(x.nombre)}${x.soltado ? ' <span class="nota">· sin terminar</span>' : ''}${x.nota ? ` <span class="nota">· ${esc(x.nota)}</span>` : ''}</span>
        <span>${fechaTxt(x.inicio, x.inicioAprox) || '¿?'} → ${x.fin ? fechaTxt(x.fin, x.finAprox) : (e.asignado && x === h[0] ? 'en curso' : '¿?')}</span></div>`).join('')
        : '<div class="hist-item"><span class="nota">Nadie lo trabajó todavía</span></div>'}
    </div>` : ''}`;

  abrirHoja(html, ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'asignar') asignar(e.id);
    if (a === 'terminar') terminar(e.id);
    if (a === 'quitar') quitar(e.id);
    if (a === 'portero') { cerrarHoja(); abrirPortero(e.id); }
    if (a === 'editar') hojaEditar(e.id);
    if (a === 'mover') { cerrarHoja(); empezarMover(e.id); }
    if (a === 'ubicar') { cerrarHoja(); empezarUbicar(e.id); }
  });
  hojaEdifId = id;
}

// Una sola entrada para todo lo que corrige datos del edificio: el pin (cualquiera) y,
// para encargados, la dirección y borrarlo.
function hojaEditar(id) {
  const e = porId(id);
  const pin = pos(e)
    ? `<button class="btn chico" data-a="mover">📍 Mover el pin en el mapa</button>`
    : `<button class="btn chico" data-a="ubicar">📍 Ubicarlo en el mapa</button>`;
  abrirHoja(`<div class="h-sup">${esc(e.direccion)}</div><div class="h-tit">Editar</div>
    <p class="ayuda">${pos(e) ? 'Si el pin no está en la puerta del edificio, movelo.' : 'Este edificio todavía no tiene lugar en el mapa.'}
      ${PUEDE_ADMIN ? ' La dirección es el nombre con el que aparece en la lista.' : ''}</p>
    <div class="acciones">${pin}
      ${PUEDE_ADMIN ? `<button class="btn chico" data-a="renombrar">Cambiar la dirección</button>
        <button class="btn chico peligro" data-a="borrar">Borrar el edificio</button>` : ''}
      <button class="btn chico" data-a="volver">Volver</button></div>`, ev => {
    const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return;
    if (a === 'mover') { cerrarHoja(); empezarMover(id); }
    if (a === 'ubicar') { cerrarHoja(); empezarUbicar(id); }
    if (a === 'renombrar') renombrar(id);
    if (a === 'borrar') borrar(id);
    if (a === 'volver') abrirEdificio(id, true);
  });
}

// ─────────────────────────────────────────
//   RESPONSABLE: asignar / terminar / quitar (solo PUEDE_ADMIN; transacciones: dos personas pueden tocar a la vez)
// ─────────────────────────────────────────
async function conTransaccion(id, fn, okMsg, accion) {
  if (ocupado) return false;
  ocupado = true;
  try {
    await runTransaction(db, async tx => {
      const snap = await tx.get(edifRef(id));
      if (!snap.exists()) throw new Error('Ese edificio ya no existe.');
      tx.update(edifRef(id), { ...fn(snap.data()), ...marca() });
    });
    if (okMsg) uiToast(okMsg, 'success');
    if (accion) logActividad(CONGRE_ID, 'edificios', 'guardado', `${accion}: ${porId(id)?.direccion || id}`);
    return true;
  } catch (err) {
    console.error('[edificios]', err);
    uiToast(err.code === 'permission-denied' ? 'No tenés permiso para eso.' : (err.message || 'No se pudo guardar.'), 'error', 3500);
    return false;
  } finally {
    ocupado = false;
  }
}

// Cierra la entrada abierta del responsable actual (la última sin fin que sea de él).
function cerrarEntrada(hist, asignado, cambios) {
  const h = (hist || []).map(x => ({ ...x }));
  const esSuya = x => asignado.pubId ? x.pubId === asignado.pubId : x.nombre === asignado.nombre;
  for (let i = h.length - 1; i >= 0; i--) {
    if (!h[i].fin && esSuya(h[i])) { Object.assign(h[i], cambios); return h; }
  }
  return h;
}

// Hermanos para elegir responsable (solo se cargan si PUEDE_ADMIN: las reglas no dejan leer
// publicadores a cualquiera). { id, nombre }, activos, ordenados.
let _hermanos = null;
async function hermanos() {
  if (_hermanos) return _hermanos;
  const snap = await getDocs(collection(db, 'congregaciones', CONGRE_ID, 'publicadores'));
  _hermanos = snap.docs.map(d => ({ id: d.id, nombre: d.data().nombre, activo: d.data().activo }))
    .filter(p => p.nombre && p.activo !== false)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
  return _hermanos;
}

async function asignar(id) {
  let lista;
  try { lista = await hermanos(); }
  catch (err) { console.error(err); uiToast('No se pudo cargar la lista de hermanos', 'error'); return; }
  const e = porId(id);
  const nombre = await uiConductorPicker({ conductores: lista.map(p => p.nombre), value: e.asignado?.nombre || '', label: 'Responsable del edificio' });
  if (nombre == null || nombre === (e.asignado?.nombre || '')) return;
  if (nombre === '') return quitar(id);
  const pub = lista.find(p => p.nombre === nombre);
  conTransaccion(id, d => {
    let hist = d.historial || [];
    if (d.asignado) hist = cerrarEntrada(hist, d.asignado, { fin: hoy(), soltado: true, nota: `cambio de responsable` });
    return {
      asignado: { pubId: pub.id, nombre: pub.nombre, desde: hoy(), asignadoPor: YO_NOMBRE },
      historial: [...hist, { nombre: pub.nombre, pubId: pub.id, inicio: hoy(), fin: null, asignadoPor: YO_NOMBRE }],
    };
  }, `Responsable: ${pub.nombre}`, `Asignó a ${pub.nombre}`);
}

async function terminar(id) {
  const e = porId(id);
  const p = progreso(e);
  const falta = p ? p.total - p.hechos - p.noQuiere : 0;
  if (falta > 0 && !await uiConfirm({ title: '¿Terminarlo igual?', msg: `Faltan ${falta} ${falta === 1 ? 'timbre' : 'timbres'} por tocar en esta vuelta.`, confirmText: 'Terminar', type: 'warn' })) return;
  conTransaccion(id, d => {
    if (!d.asignado) throw new Error('Este edificio no tiene responsable.');
    return { asignado: null, historial: cerrarEntrada(d.historial, d.asignado, { fin: hoy() }) };
  }, 'Marcado como terminado', 'Terminó edificio');
}

async function quitar(id) {
  const e = porId(id);
  if (!e.asignado) return;
  if (!await uiConfirm({ title: 'Quitar responsable', msg: `${e.asignado.nombre} deja de ser el responsable sin terminarlo. Lo marcado en el portero se conserva.`, confirmText: 'Quitar', type: 'warn' })) return;
  conTransaccion(id, d => {
    if (!d.asignado) return {};
    return { asignado: null, historial: cerrarEntrada(d.historial, d.asignado, { fin: hoy(), soltado: true }) };
  }, 'Edificio sin responsable', 'Quitó responsable');
}

// ─────────────────────────────────────────
//   ADMIN: agregar, editar dirección, borrar
// ─────────────────────────────────────────
function pedirDireccion(titulo, valor, cb) {
  abrirHoja(`<div class="h-tit">${titulo}</div>
    <div class="forma"><div><label for="ed-dir">Dirección</label>
      <input id="ed-dir" class="buscar" value="${esc(valor || '')}" placeholder="Ej: Congreso 332" autocomplete="off"></div>
      <button class="btn primario" data-a="ok">Guardar</button></div>`, ev => {
    if (ev.target.closest('[data-a="ok"]')) {
      const v = document.getElementById('ed-dir').value.trim();
      if (!v) { uiToast('Escribí la dirección', 'error'); return; }
      cb(v);
    }
  });
  setTimeout(() => document.getElementById('ed-dir')?.focus(), 300);
}

async function crearEdificio(latlng, direccion) {
  const pt = [+latlng.lat.toFixed(6), +latlng.lng.toFixed(6)];
  const t = territorioDe(pt);
  const base = norm(direccion).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'edificio';
  const id = edificios.some(e => e.id === base) ? `${base}-${Date.now().toString(36)}` : base;
  try {
    await setDoc(edifRef(id), {
      direccion, calle: null, numero: null, punto: { lat: pt[0], lng: pt[1] }, precision: 'manual',
      terrId: t?.id ?? null, grupoId: t?.grupoId ?? null, pisosOSM: null,
      forma: null, vuelta: 1, timbres: {}, asignado: null, historial: [],
      creadoEn: serverTimestamp(), creadoPor: YO_UID, ...marca(),
    });
    cerrarHoja();
    uiToast('Edificio agregado', 'success');
    logActividad(CONGRE_ID, 'edificios', 'guardado', `Agregó edificio: ${direccion}`);
    abrirEdificio(id);
  } catch (err) {
    console.error('[edificios]', err);
    uiToast('No se pudo agregar el edificio', 'error');
  }
}

function renombrar(id) {
  const e = porId(id);
  pedirDireccion('Editar dirección', e.direccion, async v => {
    try {
      await updateDoc(edifRef(id), { direccion: v, ...marca() });
      uiToast('Dirección guardada', 'success');
      abrirEdificio(id, true);
    } catch (err) { console.error(err); uiToast('No se pudo guardar', 'error'); }
  });
}

async function borrar(id) {
  const e = porId(id);
  if (!await uiConfirm({ title: 'Borrar edificio', msg: `${e.direccion} se borra con su portero y su historial. No se puede deshacer.`, confirmText: 'Borrar', type: 'danger' })) return;
  try {
    const visitas = await getDocs(collection(edifRef(id), 'visitas'));
    const docs = [...visitas.docs.map(d => d.ref), edifRef(id)];
    for (let i = 0; i < docs.length; i += 450) {
      const b = writeBatch(db);
      docs.slice(i, i + 450).forEach(r => b.delete(r));
      await b.commit();
    }
    cerrarHoja();
    uiToast('Edificio borrado', 'success');
    logActividad(CONGRE_ID, 'edificios', 'guardado', `Borró edificio: ${e.direccion}`);
  } catch (err) { console.error(err); uiToast('No se pudo borrar', 'error'); }
}

// ─────────────────────────────────────────
//   UBICACIÓN: corregir (arrastrar) / ubicar / agregar (tocar el mapa)
// ─────────────────────────────────────────
function banner(txt) {
  document.getElementById('banner-txt').textContent = txt;
  document.getElementById('banner-mover').classList.toggle('on', !!txt);
  document.getElementById('banner-ok').hidden = !moviendoId;
}
function empezarMover(id) {
  moviendoId = id;
  const m = marcadores[id];
  if (!m) { moviendoId = null; return; }
  m.setIcon(icono(porId(id)));
  m.dragging.enable();
  map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 17), { duration: .5 });
  banner('Arrastrá el pin hasta la puerta del edificio');
}
function empezarUbicar(id) { ubicandoId = id; banner(`Tocá el mapa donde está ${porId(id).direccion}`); }

function cancelarBanner() {
  if (moviendoId) {
    const m = marcadores[moviendoId], e = porId(moviendoId);
    if (m) { m.dragging.disable(); if (pos(e)) m.setLatLng(pos(e)); }
  }
  moviendoId = ubicandoId = null; agregando = false;
  banner('');
  refrescar();
}
document.getElementById('banner-cancelar').addEventListener('click', cancelarBanner);
document.getElementById('banner-ok').addEventListener('click', async () => {
  const id = moviendoId, m = marcadores[id];
  if (!id || !m) return cancelarBanner();
  m.dragging.disable();
  const ll = m.getLatLng();
  moviendoId = null; banner('');
  try {
    await updateDoc(edifRef(id), { punto: { lat: +ll.lat.toFixed(6), lng: +ll.lng.toFixed(6) }, precision: 'manual', ...marca() });
    uiToast('Ubicación guardada', 'success');
  } catch (err) { console.error(err); uiToast('No se pudo guardar la ubicación', 'error'); refrescar(); }
});

map.on('click', async ev => {
  if (agregando) {
    agregando = false; banner('');
    pedirDireccion('Edificio nuevo', '', v => crearEdificio(ev.latlng, v));
    return;
  }
  if (!ubicandoId) return;
  const id = ubicandoId; ubicandoId = null; banner('');
  try {
    await updateDoc(edifRef(id), { punto: { lat: +ev.latlng.lat.toFixed(6), lng: +ev.latlng.lng.toFixed(6) }, precision: 'manual', ...marca() });
    uiToast('Ubicación guardada · podés ajustarla arrastrando el pin', 'success', 3000);
  } catch (err) { console.error(err); uiToast('No se pudo guardar la ubicación', 'error'); }
});

// ─────────────────────────────────────────
//   PORTERO
// ─────────────────────────────────────────
function abrirPortero(id) {
  if (!porId(id).forma && !gestiona(porId(id))) { uiToast('El portero todavía no está cargado', 'error'); return; }
  porteroId = id; herramienta = null; formaTmp = null;
  document.getElementById('portero').classList.add('on');
  porId(id).forma ? pintarPortero() : pintarForma();
}
function cerrarPortero() {
  porteroId = porteroModo = herramienta = formaTmp = null;
  document.getElementById('portero').classList.remove('on');
  document.getElementById('herramientas').hidden = true;
}
function cabecera(e, sub) {
  return `<div class="por-head">
    <button class="icon-btn" data-p="cerrar" aria-label="Volver al mapa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <div><div class="h-sup">${sub}</div><div class="h-tit">${esc(e.direccion)}</div></div></div>`;
}

// Una fila del panel: etiqueta del piso (si hay) + los timbres. En los numerados no hay etiqueta.
function filaPanel(fila, cols, celda) {
  return `<div class="piso${fila.lbl == null ? ' sin-lbl' : ''}" style="--cols:${cols}">${fila.lbl != null ? `<span class="piso-lbl">${fila.lbl}</span>` : ''}${fila.celdas.map(celda).join('')}</div>`;
}

// Primera visita: el que va arma la forma del portero y queda para los siguientes.
function pintarForma() {
  const e = porId(porteroId);
  if (!e) return cerrarPortero();
  if (!gestiona(e)) return e.forma ? pintarPortero() : cerrarPortero();   // solo encargados y el responsable
  porteroModo = 'forma';
  // formaTmp guarda los campos de los dos tipos: cambiar de tipo y volver no pierde lo elegido.
  formaTmp ||= { tipo: 'numerado', total: 12, columnas: 2, pisos: e.pisosOSM || 4, deptos: 4, pb: true, nom: 'letras',
    ...(e.forma || {}), ...(e.forma ? { tipo: tipoForma(e.forma) } : {}) };
  const f = formaTmp;
  const num = f.tipo === 'numerado';
  const { filas, cols } = grilla(f);
  const resto = filas.length - 4;
  const stepper = (campo, valor, txt) => `<div class="stepper"><button data-f="${campo}" data-d="-1" aria-label="Menos ${txt}">−</button><output>${valor}</output><button data-f="${campo}" data-d="1" aria-label="Más ${txt}">+</button></div>`;
  const campos = num
    ? `<div><label>Cantidad de timbres</label>${stepper('total', f.total, 'timbres')}</div>
       <div><label>¿En cuántas columnas?</label><div class="seg tres">${[1, 2, 3].map(c => `<button data-cols="${c}" class="${f.columnas === c ? 'on' : ''}">${c}</button>`).join('')}</div></div>`
    : `<div><label>Pisos (sin contar planta baja)</label>${stepper('pisos', f.pisos, 'pisos')}</div>
       <div><label>Departamentos por piso</label>${stepper('deptos', f.deptos, 'departamentos')}</div>
       <div><label>¿Hay departamentos en planta baja?</label><div class="seg"><button data-pb="1" class="${f.pb ? 'on' : ''}">Sí</button><button data-pb="0" class="${f.pb ? '' : 'on'}">No</button></div></div>
       <div><label>Los departamentos van con</label><div class="seg"><button data-nom="letras" class="${f.nom === 'letras' ? 'on' : ''}">Letras (A, B…)</button><button data-nom="numeros" class="${f.nom === 'numeros' ? 'on' : ''}">Números (1, 2…)</button></div></div>`;
  document.getElementById('herramientas').hidden = true;
  document.getElementById('portero').innerHTML = `<div class="por-wrap">${cabecera(e, e.forma ? 'Editar portero' : 'Primera vez · armá el portero')}
    <p class="ayuda">Copiá cómo es el portero de la puerta. Se carga una sola vez y queda para todos.${e.pisosOSM && !e.forma ? ` Según OpenStreetMap tiene unos ${e.pisosOSM} pisos.` : ''}</p>
    <div class="forma">
      <div><label>¿Cómo están marcados los timbres?</label><div class="seg"><button data-tipo="numerado" class="${num ? 'on' : ''}">Números (1, 2, 3…)</button><button data-tipo="pisos" class="${num ? '' : 'on'}">Piso y depto (1A, 2B…)</button></div></div>
      ${campos}
      <div><label>Así va a quedar · ${celdasDe(f).length} timbres</label>
        <div class="panel" style="padding:12px"><div class="pisos">${filas.slice(0, 4).map(r => filaPanel(r, cols, c => `<span class="timbre chico">${c.lbl}</span>`)).join('')}
          ${resto > 0 ? `<div class="piso-lbl">… ${resto} ${resto === 1 ? 'fila' : 'filas'} más</div>` : ''}</div></div></div>
      ${e.forma && Object.keys(e.timbres || {}).length ? '<div class="aviso">Si cambiás el portero, las marcas de los timbres que ya no existan quedan guardadas pero no se ven.</div>' : ''}
      <button class="btn primario" data-p="guardar-forma">Guardar portero</button>
      ${e.forma ? '<button class="btn chico" data-p="cancelar-forma">Cancelar</button>' : ''}
    </div></div>`;
}

function pintarPortero() {
  const e = porId(porteroId);
  if (!e) { cerrarPortero(); uiToast('Ese edificio ya no existe', 'error'); return; }
  if (!e.forma) return pintarForma();
  porteroModo = 'grilla';
  const { filas, cols } = grilla(e.forma);
  const p = progreso(e);
  const posibles = p.total - p.noQuiere;
  const pct = p.total ? Math.round(100 * (p.hechos + p.noQuiere) / p.total) : 0;
  const scroll = document.getElementById('portero').scrollTop;
  document.getElementById('portero').innerHTML = `<div class="por-wrap">${cabecera(e, `Portero · ${e.terrId ? 'Terr. ' + e.terrId : 'sin territorio'}`)}
    <div class="progreso"><div class="barra"><i style="width:${pct}%"></i></div>
      <div class="txt"><span>Vuelta ${vueltaDe(e)} · <b>${p.hechos}</b> de ${posibles} tocados</span>${p.noQuiere ? `<span>${p.noQuiere} no ${p.noQuiere === 1 ? 'quiere' : 'quieren'}</span>` : ''}</div></div>
    <div class="panel">
      <div class="rejilla">${'<i></i>'.repeat(9)}</div>
      <div class="pisos">${filas.map(fila => filaPanel(fila, cols, c => {
        const r = marcaVigente(e, c.k);
        return `<button class="timbre" data-k="${c.k}" ${r ? `data-res="${r.res}"` : ''} aria-label="${nombreTimbre(c.k)}${r ? ', ' + RES[r.res].label : ''}">${c.lbl}${r ? `<small>${RES[r.res].corto}</small>` : ''}</button>`;
      })).join('')}</div>
      <div class="altavoz">${'<i></i>'.repeat(21)}</div>
    </div>
    ${gestiona(e) ? `<div class="acciones dos" style="margin-top:16px">
      <button class="btn chico" data-p="editar-forma">Editar portero</button>
      <button class="btn chico" data-p="nueva-vuelta">Nueva vuelta</button>
    </div>` : ''}</div>`;
  document.getElementById('portero').scrollTop = scroll;

  const hb = document.getElementById('herramientas');
  hb.hidden = false;
  hb.innerHTML = `<div class="herr-txt">${herramienta ? `Tocá los timbres para marcarlos como <b>${RES[herramienta].label}</b> · tocá de nuevo para borrar` : 'Elegí un resultado y tocá los timbres · o tocá un timbre solo'}</div>
    <div class="herr-row">${Object.entries(RES).map(([k, r]) => `<button class="herr ${herramienta === k ? 'on' : ''}" data-h="${k}" style="--c:${r.c}"><i></i>${r.label}</button>`).join('')}</div>`;
}

// Escribe un timbre en el doc (para que todos lo vean al instante) y deja registro en visitas/.
function escribirTimbre(e, k, res) {
  const ref = edifRef(e.id);
  const vuelta = vueltaDe(e);
  const valor = res ? { res, fecha: hoy(), uid: YO_UID, nombre: YO_NOMBRE, vuelta } : deleteField();
  const b = writeBatch(db);
  b.update(ref, new FieldPath('timbres', k), valor, 'actualizadoEn', serverTimestamp(), 'actualizadoPor', YO_UID);
  b.set(doc(collection(ref, 'visitas')), {
    k, res: res || 'borrado', vuelta, fecha: hoy(), uid: YO_UID, nombre: YO_NOMBRE, creadoEn: serverTimestamp(),
  });
  b.commit().catch(err => {
    console.error('[edificios] timbre', err);
    uiToast('No se pudo guardar el timbre', 'error');
  });
}
// Con una herramienta elegida: tocar marca; tocar de nuevo con la misma, borra.
function alternarTimbre(e, k, res) {
  const r = marcaVigente(e, k);
  escribirTimbre(e, k, r && r.res === res ? null : res);
}

function hojaTimbre(e, k) {
  const r = e.timbres?.[k];
  const vigente = marcaVigente(e, k);
  abrirHoja(`<div class="h-sup">${esc(e.direccion)}</div><div class="h-tit">${nombreTimbre(k)}</div>
    ${r ? `<div class="ayuda" style="margin-bottom:6px">Última vez: ${RES[r.res]?.label || r.res} · ${fechaTxt(r.fecha)} · ${esc(r.nombre || '')}${!vigente ? ` (vuelta ${r.vuelta})` : ''}</div>` : ''}
    <div class="acciones dos">${Object.entries(RES).map(([key, x]) => `<button class="btn" data-r="${key}" style="background:${x.c};border-color:transparent;color:#fff">${x.label}</button>`).join('')}</div>
    ${vigente ? '<div class="acciones"><button class="btn chico" data-r="borrar">Borrar marca</button></div>' : ''}`, ev => {
    const res = ev.target.closest('[data-r]')?.dataset.r; if (!res) return;
    escribirTimbre(porId(e.id) || e, k, res === 'borrar' ? null : res);
    cerrarHoja();
  });
}

document.getElementById('portero').addEventListener('click', async ev => {
  const e = porId(porteroId); if (!e) return;
  const t = ev.target.closest('[data-k]');
  if (t) {
    if (herramienta) alternarTimbre(e, t.dataset.k, herramienta);
    else hojaTimbre(e, t.dataset.k);
    return;
  }
  const st = ev.target.closest('[data-f]');
  if (st) {
    const campo = st.dataset.f;
    const max = { pisos: 40, deptos: 16, total: 120 }[campo];
    formaTmp[campo] = Math.max(1, Math.min(max, formaTmp[campo] + Number(st.dataset.d)));
    return pintarForma();
  }
  const tipo = ev.target.closest('[data-tipo]'); if (tipo) { formaTmp.tipo = tipo.dataset.tipo; return pintarForma(); }
  const colsB = ev.target.closest('[data-cols]'); if (colsB) { formaTmp.columnas = Number(colsB.dataset.cols); return pintarForma(); }
  const pb = ev.target.closest('[data-pb]'); if (pb) { formaTmp.pb = pb.dataset.pb === '1'; return pintarForma(); }
  const nom = ev.target.closest('[data-nom]'); if (nom) { formaTmp.nom = nom.dataset.nom; return pintarForma(); }

  const a = ev.target.closest('[data-p]')?.dataset.p;
  if (a === 'cerrar') cerrarPortero();
  if (a === 'editar-forma') { formaTmp = null; pintarForma(); }
  if (a === 'cancelar-forma') { formaTmp = null; pintarPortero(); }
  if (a === 'guardar-forma') {
    const t = formaTmp;
    const forma = t.tipo === 'numerado'
      ? { tipo: 'numerado', total: t.total, columnas: t.columnas }
      : { tipo: 'pisos', pisos: t.pisos, deptos: t.deptos, pb: t.pb, nom: t.nom };
    try {
      await updateDoc(edifRef(e.id), { forma, ...marca() });
      formaTmp = null;
      e.forma = forma;   // el snapshot llega enseguida; esto evita un parpadeo del formulario
      pintarPortero();
      uiToast('Portero guardado', 'success');
    } catch (err) { console.error(err); uiToast('No se pudo guardar el portero', 'error'); }
  }
  if (a === 'nueva-vuelta') {
    const p = progreso(e);
    const falta = p.total - p.hechos - p.noQuiere;
    const msg = (falta > 0 ? `Todavía ${falta === 1 ? 'falta 1 timbre' : `faltan ${falta} timbres`}. ` : '')
      + 'El portero arranca limpio; los "No quiere" se mantienen y lo marcado queda en el registro.';
    if (!await uiConfirm({ title: `Empezar vuelta ${vueltaDe(e) + 1}`, msg, confirmText: 'Empezar', type: 'purple' })) return;
    try {
      await updateDoc(edifRef(e.id), { vuelta: increment(1), ...marca() });
      logActividad(CONGRE_ID, 'edificios', 'guardado', `Nueva vuelta: ${e.direccion}`);
    } catch (err) { console.error(err); uiToast('No se pudo empezar la vuelta', 'error'); }
  }
});
document.getElementById('herramientas').addEventListener('click', ev => {
  const h = ev.target.closest('[data-h]'); if (!h) return;
  herramienta = herramienta === h.dataset.h ? null : h.dataset.h;
  pintarPortero();
});

// ─────────────────────────────────────────
//   MENÚ ⋯ (leyenda + opciones de encargado)
// ─────────────────────────────────────────
document.getElementById('btn-menu').addEventListener('click', () => {
  const ley = [
    ['var(--e-sin)', 'Sin predicar'], ['var(--e-parcial)', 'Empezado, sin terminar'], ['var(--e-proc)', 'Tiene responsable'],
    ['var(--e-ok)', 'Terminado hace menos de 6 meses'], ['var(--e-warn)', 'Terminado hace 6 a 12 meses'], ['var(--e-bad)', 'Terminado hace más de un año'],
  ];
  const leyComun = [['var(--e-neutro)', 'Edificio'], ['var(--e-proc)', 'A tu cargo (sos el responsable)']];
  abrirHoja(`<div class="h-tit">Edificios</div>
    <div class="hist"><h4>Colores</h4>${(PUEDE_ADMIN ? ley : leyComun).map(([c, t]) => `<div class="hist-item"><span><span class="estado-tag" style="--c:${c};padding:0;background:none"></span> ${t}</span><span></span></div>`).join('')}
      ${PUEDE_ADMIN ? '<div class="hist-item"><span><b style="color:#EF9F27">?</b> Ubicación a revisar: tocalo y corregila</span><span></span></div>' : ''}</div>
    <p class="ayuda" style="margin-top:14px">Abrí el portero de un edificio y marcá cada timbre que tocás. Lo que marcás lo ven todos al instante. El responsable de cada edificio lo asigna el encargado de edificios.</p>
    ${PUEDE_ADMIN ? '<div class="acciones"><button class="btn chico" data-m="agregar">+ Agregar edificio</button></div>' : ''}`, ev => {
    if (ev.target.closest('[data-m="agregar"]')) {
      cerrarHoja();
      agregando = true;
      banner('Tocá el mapa donde está el edificio nuevo');
    }
  });
});

// ─────────────────────────────────────────
//   CARGA
// ─────────────────────────────────────────
function errorCarga(msg) {
  const c = document.getElementById('cargando');
  c.style.display = 'flex';
  c.querySelector('.spin').style.display = 'none';
  document.getElementById('cargando-txt').textContent = msg;
}

async function cargarFondo() {
  // Espejos públicos del mapa: territorios para dibujar de fondo, colores de grupo y Salón del Reino.
  const base = ['congregaciones', CONGRE_ID];
  const [terrs, grps, conf] = await Promise.all([
    getDocs(collection(db, ...base, 'mapa_territorios')),
    getDocs(collection(db, ...base, 'mapa_grupos')),
    getDoc(doc(db, ...base, 'mapa_config', 'publico')),
  ]);
  grps.forEach(d => { grupos[d.id] = { label: d.data().label, color: d.data().color }; });
  terrs.forEach(d => {
    const t = d.data();
    if (t.ciudad) return;
    const polis = (t.poligonos || []).map(p => (p.coords || []).map(c => [c.lat, c.lng])).filter(p => p.length > 2);
    territorios.push({ id: t.id, grupoId: t.grupoId, poligonos: polis });
    const col = grupos[t.grupoId]?.color || '#888';
    polis.forEach(p => L.polygon(p, { color: col, weight: 1, opacity: .45, fillColor: col, fillOpacity: .07, interactive: false }).addTo(map));
  });
  limitarMapa();
  const salon = conf.exists() ? conf.data().salonDelReino : null;
  if (salon?.lat != null) {
    const sc = grupos.C?.color || '#9c4dcc';
    L.marker([salon.lat, salon.lng], { interactive: false, icon: L.divIcon({ className: '', iconSize: [26, 26],
      html: `<div class="salon-pin" style="--sc:${sc}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 3l9 7"/><path d="M5 10v10h14V10"/></svg></div>` }) }).addTo(map);
  }
}

cargarFondo().catch(err => console.warn('[edificios] fondo del mapa', err));

onSnapshot(edifCol, snap => {
  edificios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (primeraCarga) {
    primeraCarga = false;
    document.getElementById('cargando').style.display = 'none';
    const pts = edificios.map(pos).filter(Boolean);
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], paddingTopLeft: [20, 110] });
    if (!edificios.length) {
      document.getElementById('resumen').textContent = 'Todavía no hay edificios cargados';
    }
  }
  refrescar();
}, err => {
  console.error('[edificios]', err);
  errorCarga(err.code === 'permission-denied'
    ? 'No tenés acceso a los edificios de esta congregación. Si recién te aprobaron, cerrá sesión y volvé a entrar.'
    : 'No se pudieron cargar los edificios. Revisá la conexión y volvé a intentar.');
});

logActividad(CONGRE_ID, 'edificios', 'apertura');
