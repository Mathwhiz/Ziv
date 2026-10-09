import { db } from '../shared/firebase.js';
import {
  collection, doc, getDoc, getDocs
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ─────────────────────────────────────────
//   ESTADO
// ─────────────────────────────────────────
const params    = new URLSearchParams(location.search);
let congreId    = params.get('congre') || 'sur';
let semanaActual = null;   // fecha YYYY-MM-DD (lunes) actualmente visible
let publicadores = [];
let tieneAuxiliar = false;
let vmEspeciales  = {};    // { 'YYYY-MM-DD' → { tipo, fechaEvento } }

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

// En la semana del superintendente no se abre la sala auxiliar y el Estudio
// Bíblico se reemplaza por su discurso (ver vida-ministerio/app.js).
const VM_TITULO_DISCURSO_SUPER = 'Discurso del superintendente de circuito';

function esSemanaSuper(fecha) {
  return vmEspeciales[fecha]?.tipo === 'superintendente';
}

function auxEnSemana(fecha, semana) {
  if (!tieneAuxiliar || esSemanaSuper(fecha)) return false;
  // Marca por semana (ver vida-ministerio/app.js): casos puntuales sin sala auxiliar.
  return semana?.sinSalaAux !== true;
}

// ─────────────────────────────────────────
//   UTILS
// ─────────────────────────────────────────
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtDisplay(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function lunesDeHoy() {
  const hoy = new Date();
  const dow = hoy.getDay();
  const diff = (dow === 0) ? -6 : 1 - dow;
  hoy.setDate(hoy.getDate() + diff);
  return fmtDate(hoy);
}

function lunesDe(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dow = d.getDay();
  const diff = (dow === 0) ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
}

function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function nombreDePub(pubId) {
  if (!pubId) return null;
  const p = publicadores.find(x => x.id === pubId);
  return p ? p.nombre : null;
}

// ─────────────────────────────────────────
//   CARGA INICIAL
// ─────────────────────────────────────────
async function init() {
  // Determinar semana a mostrar
  const paramSemana = params.get('semana');
  semanaActual = paramSemana ? lunesDe(paramSemana) : lunesDeHoy();

  try {
    // Cargar datos de congregación, publicadores y semanas especiales en paralelo
    const [congreSnap, pubsSnap, espSnap] = await Promise.all([
      getDoc(doc(db, 'congregaciones', congreId, 'vm_config', 'publico')),
      getDocs(collection(db, 'congregaciones', congreId, 'vm_publicadores')),
      getDocs(collection(db, 'congregaciones', congreId, 'vm_especiales')).catch(() => ({ forEach: () => {} })),
    ]);

    if (!congreSnap.exists()) {
      document.getElementById('prog-contenido').innerHTML =
        '<div class="prog-error">Congregación no encontrada.</div>';
      return;
    }

    const congreData = congreSnap.data();
    tieneAuxiliar = congreData.tieneAuxiliar || false;
    document.getElementById('prog-congre').textContent = congreData.nombre || congreId;
    document.title = `Programa VM · ${congreData.nombre || congreId}`;

    publicadores = [];
    pubsSnap.forEach(d => publicadores.push({ id: d.id, ...d.data() }));

    vmEspeciales = {};
    espSnap.forEach(d => { vmEspeciales[d.id] = d.data(); });

  } catch(e) {
    document.getElementById('prog-contenido').innerHTML =
      `<div class="prog-error">Error al cargar: ${esc(e.message)}</div>`;
    return;
  }

  await cargarPrograma();
}

// ─────────────────────────────────────────
//   CARGAR PROGRAMA DE LA SEMANA
// ─────────────────────────────────────────
async function cargarPrograma() {
  const el = document.getElementById('prog-contenido');
  document.getElementById('prog-titulo').textContent = 'Semana del ' + fmtDisplay(semanaActual);
  el.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';

  try {
    const snap = await getDoc(doc(db, 'congregaciones', congreId, 'vm_programa', semanaActual));
    const banner = vmBannerHtml(semanaActual);
    if (!snap.exists()) {
      el.innerHTML = banner + '<div class="empty-state">No hay programa cargado para esta semana.<br><span style="color:#3a3a3a;">El encargado todavía no lo subió.</span></div>';
    } else {
      el.innerHTML = banner + renderPrograma(snap.data());
    }
  } catch(e) {
    el.innerHTML = `<div class="prog-error">Error: ${esc(e.message)}</div>`;
  }
}

// ─────────────────────────────────────────
//   NAVEGACIÓN
// ─────────────────────────────────────────
window.navSemana = async function(dir) {
  const d = new Date(semanaActual + 'T12:00:00');
  d.setDate(d.getDate() + dir * 7);
  semanaActual = fmtDate(d);
  // Actualizar URL sin recargar
  const url = new URL(location.href);
  url.searchParams.set('semana', semanaActual);
  history.replaceState(null, '', url.toString());
  await cargarPrograma();
};

// ─────────────────────────────────────────
//   COMPARTIR
// ─────────────────────────────────────────
window.compartir = function() {
  const url = new URL(location.href);
  url.searchParams.set('congre', congreId);
  url.searchParams.set('semana', semanaActual);
  navigator.clipboard.writeText(url.toString()).then(() => {
    const btn = document.querySelector('.prog-share-btn');
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copiado';
    btn.style.color = '#97C459';
    setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
  }).catch(() => {
    prompt('Copiá este enlace:', url.toString());
  });
};

// ─────────────────────────────────────────
//   RENDER BANNER ESPECIAL
// ─────────────────────────────────────────
function vmBannerHtml(fecha) {
  const esp = vmEspeciales[fecha];
  if (!esp) return '';
  const color = VM_TIPO_COLORS[esp.tipo] || '#eee';
  const label = VM_TIPO_LABELS[esp.tipo] || esp.tipo;
  let msg = label;
  if (esp.tipo === 'asamblea')        msg += ' — no hay reuniones esta semana';
  if (esp.tipo === 'superintendente') msg += ' — reunión el martes · sábado sin lector';
  if (esp.tipo === 'conmemoracion') {
    const dow = new Date(esp.fechaEvento + 'T12:00:00').getDay();
    msg += (dow === 6 || dow === 0) ? ' — sin reunión de fin de semana' : ' — sin reunión de entre semana';
  }
  return `<div class="vm-especial-banner" style="border-left-color:${color};background:${color}18;">
    <span style="color:${color};font-weight:700;">⚠ ${msg}</span>
  </div>`;
}

// ─────────────────────────────────────────
//   RENDER PROGRAMA (solo lectura)
// ─────────────────────────────────────────
function renderPrograma(s) {
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
  const aux  = auxEnSemana(s.fecha, s);
  const lect = s.tesoros?.lecturaBiblica;
  let lectRow;
  if (aux && lect?.ayudante) {
    const lNombre    = nombreDePub(lect.pubId);
    const lAuxNombre = nombreDePub(lect.ayudante);
    lectRow = `<div class="pub-parte-row">
      <div class="pub-parte-titulo">${esc(lect.titulo || 'Lectura Bíblica')}</div>
      <div class="pub-parte-nombre" style="text-align:right;">
        ${lNombre    ? `<div>${esc(lNombre)}</div>`    : '<div><span class="pub-parte-sin">—</span></div>'}
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
      if (aux && p.salaAux?.pubId) {
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
  const estudio   = s.estudioBiblico || {};
  const esSuper   = esSemanaSuper(s.fecha);
  const estTitulo = esSuper ? VM_TITULO_DISCURSO_SUPER : (estudio.titulo || 'Estudio Bíblico');
  const estLector = esSuper ? null : estudio.lector;
  const estudioHtml = (s.estudioBiblico || esSuper) ? `<div class="pub-parte-row">
    <div class="pub-parte-titulo">${esc(estTitulo)}</div>
    <div class="pub-parte-nombre" style="text-align:right;">
      ${estudio.conductor ? `<div>${esc(nombreDePub(estudio.conductor) || '—')}</div>` : '<div class="pub-parte-sin">—</div>'}
      ${estLector ? `<div style="font-size:11px;color:#888;">Lec. ${esc(nombreDePub(estLector) || '')}</div>` : ''}
    </div>
  </div>` : '';
  html += `<div class="pub-seccion">
    <div class="pub-seccion-hdr">3. Nuestra Vida Cristiana</div>
    ${vcPartes}${estudioHtml}
  </div>`;

  return html;
}

// ─────────────────────────────────────────
//   ARRANQUE
// ─────────────────────────────────────────
init();
