// Salas de Zoom de la congregación (congregaciones/{id}/zoom/{salaId}, ver docs/zoom.md).
// Doc: { nombre, uso: 'reunion'|'predicacion', link, meetingId, clave, dias: [0-6, 0 = domingo], horas: ['HH:MM'], orden }
// Las lee cualquier miembro aprobado; las edita Administrador. Nunca escribir IDs ni claves en el código.
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

export const ZOOM_ANTES_MIN = 15;     // el botón aparece 15 min antes
export const ZOOM_DURA_MIN  = 120;    // y se va 2 h después de empezar

export async function leerSalasZoom(db, cid) {
  const snap = await getDocs(collection(db, 'congregaciones', cid, 'zoom'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99) || String(a.nombre).localeCompare(String(b.nombre)));
}

export const soloDigitos = s => String(s || '').replace(/\D/g, '');
export const fmtIdZoom = id => soloDigitos(id).replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1 $2 $3');

// ID y clave cifrada de un link de invitación (https://xx.zoom.us/j/ID?pwd=...)
export function leerLinkZoom(url) {
  try {
    const u = new URL(String(url).trim());
    const m = /\/(?:j|wc|s)\/(\d{9,11})/.exec(u.pathname);
    return /zoom\.us$/i.test(u.hostname) && m ? { id: m[1], pwd: u.searchParams.get('pwd') || '' } : null;
  } catch { return null; }
}

// ID y clave escritos a mano en un texto («ID: 844 0225 6636 · Clave: 479104»)
export function leerIdClave(texto) {
  const t = String(texto || '');
  const id = /(\d[\d\s]{8,13}\d)/.exec(t);
  const clave = /(?:clave|c[oó]digo|pass\w*|pwd)\s*:?\s*(\S+)/i.exec(t);
  const dig = id ? soloDigitos(id[1]) : '';
  return dig.length >= 9 && dig.length <= 11 ? { meetingId: dig, clave: clave ? clave[1] : '' } : null;
}

// Link que abre la reunión: el de invitación si está (trae la clave cifrada y entra sin pedirla);
// si no, el genérico con el ID (la clave se copia al tocar «Unirse»). En el celular abre la app de Zoom.
export function linkZoom(sala) {
  if (sala.link && leerLinkZoom(sala.link)) return sala.link;
  const id = soloDigitos(sala.meetingId);
  return id ? `https://zoom.us/j/${id}` : '';
}

const aMin = h => { const m = /^(\d{1,2})[:.](\d{2})/.exec(String(h || '')); return m ? +m[1] * 60 + +m[2] : null; };

// Ventanas de hoy de cada sala: [{ sala, hora, ini, fin }] (ini/fin en ms), incluidas las que ya pasaron
export function ventanasDeHoy(salas, ahora = new Date()) {
  const out = [];
  const base = new Date(ahora); base.setHours(0, 0, 0, 0);
  for (const sala of salas) {
    if (!(sala.dias || []).includes(ahora.getDay())) continue;
    for (const hora of sala.horas || []) {
      const m = aMin(hora);
      if (m == null) continue;
      const empieza = base.getTime() + m * 60000;
      out.push({ sala, hora, empieza, ini: empieza - ZOOM_ANTES_MIN * 60000, fin: empieza + ZOOM_DURA_MIN * 60000 });
    }
  }
  return out.sort((a, b) => a.empieza - b.empieza);
}
