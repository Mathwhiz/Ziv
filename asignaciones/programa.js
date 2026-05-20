import { db } from '../shared/firebase.js';
import {
  collection, doc, getDoc, getDocs, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const params = new URLSearchParams(location.search);
const CONGRE_ID = params.get('congre') || 'sur';

const ROLES_LABELS = {
  LECTOR:               'Lector',
  SONIDO_1:             'Sonido 1',
  SONIDO_2:             'Sonido 2',
  PLATAFORMA:           'Plataforma',
  MICROFONISTAS_1:      'Micrófonos 1',
  MICROFONISTAS_2:      'Micrófonos 2',
  ACOMODADOR_AUDITORIO: 'Acod. Auditorio',
  ACOMODADOR_ENTRADA:   'Acod. Entrada',
  PRESIDENTE:           'Presidente',
  REVISTAS:             'Revistas',
  PUBLICACIONES:        'Publicaciones',
};
const ROLES = Object.keys(ROLES_LABELS);
const DIA_COLORS = {
  'Lunes':'#5DB1FF','Martes':'#5DB1FF','Miércoles':'#3FD969',
  'Jueves':'#FFA82E','Viernes':'#3FD969','Sábado':'#8E6BFF','Domingo':'#FF5469',
};
const DIA_BG = {
  'Lunes':'#0e2238','Martes':'#0e2238','Miércoles':'#0f2a13',
  'Jueves':'#2a1d05','Viernes':'#0f2a13','Sábado':'#1f1638','Domingo':'#321218',
};
const TIPO_LABELS = {
  conmemoracion: 'Conmemoración',
  superintendente: 'Visita superintendente',
  asamblea: 'Asamblea',
};
const TIPO_COLORS = {
  conmemoracion: { color: '#E8C94A', bg: 'rgba(232,201,74,0.08)' },
  superintendente: { color: '#7F77DD', bg: 'rgba(127,119,221,0.08)' },
  asamblea: { color: '#F09595', bg: 'rgba(240,149,149,0.08)' },
};

let semanaActual = null;
let programacion = [];
let especiales = {};

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function fmtFecha(d) {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(-2)}`;
}

function isoToDate(iso) {
  return new Date(iso + 'T00:00:00');
}

function lunesDe(iso) {
  const d = new Date(iso + 'T12:00:00');
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return fmtDate(d);
}

function lunesDeHoy() {
  const now = new Date();
  const dow = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  return fmtDate(monday);
}

function getNombreDia(date) {
  return ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][date.getDay()];
}

function meetingsCanceladas(especial) {
  if (!especial) return [];
  if (especial.tipo === 'asamblea') return ['Miércoles', 'Sábado'];
  if (especial.tipo === 'superintendente') return [];
  if (especial.tipo === 'conmemoracion') {
    const dow = new Date(especial.fechaEvento + 'T12:00:00').getDay();
    return (dow === 6 || dow === 0) ? ['Sábado'] : ['Miércoles'];
  }
  return [];
}

function getRowsForWeek(weekIso) {
  const lunes = isoToDate(weekIso);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  return programacion
    .filter(r => {
      const d = isoToDate(r.fecha);
      return d >= lunes && d <= domingo;
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function especialBannerHtml(especial) {
  if (!especial) return '';
  const { color, bg } = TIPO_COLORS[especial.tipo] || { color: '#eee', bg: '#1e1e1e' };
  const canceladas = meetingsCanceladas(especial);
  const esSuper = especial.tipo === 'superintendente';
  let msg = TIPO_LABELS[especial.tipo] || especial.tipo;
  if (canceladas.length === 2) msg += ' — no hay reuniones esta semana';
  else if (canceladas[0]) msg += ` — sin reunión de ${canceladas[0].toLowerCase()}`;
  if (esSuper) msg += ' — reunión de entre semana el martes · sábado sin lector';
  return `<div class="especial-banner" style="border-left-color:${color};background:${bg};margin-bottom:12px;"><span style="color:${color};">⚠ ${msg}</span></div>`;
}

function renderSemana(rows, especial) {
  const canceladas = meetingsCanceladas(especial);
  const esSuper = especial?.tipo === 'superintendente';

  if (!rows.length) {
    return (especial ? especialBannerHtml(especial) : '') +
      '<div class="empty-state"><p>No hay programación cargada para esta semana.</p></div>';
  }

  const cards = rows.map(row => {
    const date = isoToDate(row.fecha);
    const dia = row.diaSemana || getNombreDia(date);
    const diaColor = DIA_COLORS[dia] || '#eee';
    const diaBg = DIA_BG[dia] || '#1e1e1e';

    if (canceladas.includes(dia)) {
      const label = TIPO_LABELS[especial.tipo] || 'Evento especial';
      return `
        <div class="reunion-card cancel" style="--dc:${diaColor};--db:${diaBg};">
          <div class="reunion-header" style="background:${diaBg};border-left:3px solid ${diaColor};">
            <span class="reunion-dia" style="color:${diaColor};">${dia}</span>
            <span class="reunion-fecha">${fmtFecha(date)}</span>
          </div>
          <div class="roles-list reunion-cancelada">${label}</div>
        </div>`;
    }

    const displayDia = (esSuper && dia === 'Miércoles') ? 'Martes' : dia;
    const rolesHtml = ROLES.map(r => {
      if (esSuper && r === 'LECTOR' && dia === 'Sábado') return '';
      const val = row.roles?.[r] || '';
      if (!val) return '';
      return `<div class="rol-row"><span class="rol-label">${ROLES_LABELS[r]}</span><span class="rol-valor">${val}</span></div>`;
    }).filter(Boolean).join('');

    return `
      <div class="reunion-card" style="--dc:${diaColor};--db:${diaBg};">
        <div class="reunion-header" style="background:${diaBg};border-left:3px solid ${diaColor};">
          <span class="reunion-dia" style="color:${diaColor};">${displayDia}</span>
          <span class="reunion-fecha">${fmtFecha(date)}</span>
        </div>
        <div class="roles-list">${rolesHtml || '<div style="color:#666;font-size:13px;padding:8px 0;">Sin datos</div>'}</div>
      </div>`;
  }).join('');

  return especialBannerHtml(especial) + cards;
}

async function cargarPrograma() {
  const el = document.getElementById('prog-contenido');
  document.getElementById('prog-titulo').textContent = `Semana del ${fmtFecha(isoToDate(semanaActual))}`;
  el.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><div class="loading-txt">Cargando…</div></div>';
  const rows = getRowsForWeek(semanaActual);
  el.innerHTML = renderSemana(rows, especiales[semanaActual] || null);
}

window.navSemana = async function(dir) {
  const d = isoToDate(semanaActual);
  d.setDate(d.getDate() + dir * 7);
  semanaActual = fmtDate(d);
  const url = new URL(location.href);
  url.searchParams.set('congre', CONGRE_ID);
  url.searchParams.set('semana', semanaActual);
  history.replaceState(null, '', url.toString());
  await cargarPrograma();
};

window.compartir = function() {
  const url = new URL(location.href);
  url.searchParams.set('congre', CONGRE_ID);
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

async function init() {
  semanaActual = params.get('semana') ? lunesDe(params.get('semana')) : lunesDeHoy();

  try {
    const [configSnap, programaSnap, especialesSnap] = await Promise.all([
      getDoc(doc(db, 'congregaciones', CONGRE_ID, 'asig_config', 'publico')),
      getDocs(query(collection(db, 'congregaciones', CONGRE_ID, 'asig_programa'), orderBy('fecha'))),
      getDocs(collection(db, 'congregaciones', CONGRE_ID, 'asig_especiales')).catch(() => ({ forEach: () => {} })),
    ]);

    if (!configSnap.exists()) {
      document.getElementById('prog-contenido').innerHTML = '<div class="prog-error">Congregación no encontrada.</div>';
      return;
    }

    const config = configSnap.data();
    document.getElementById('prog-congre').textContent = config.nombre || CONGRE_ID;
    document.title = `Asignaciones · ${config.nombre || CONGRE_ID}`;

    programacion = programaSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    especiales = {};
    especialesSnap.forEach(d => { especiales[d.id] = d.data(); });
  } catch (e) {
    document.getElementById('prog-contenido').innerHTML = `<div class="prog-error">Error al cargar: ${e.message}</div>`;
    return;
  }

  await cargarPrograma();
}

init();
