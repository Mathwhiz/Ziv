// actividad.js — registro de actividad por congregación
// Llamar desde cada módulo: logActividad(congreId, modulo, accion, detalle?)
// El admin puede ver el log en admin.html → view-actividad

import { db } from './firebase.js';
import {
  collection, addDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

// ID estable por dispositivo (persiste aunque sea usuario anónimo)
function getDeviceId() {
  let id = localStorage.getItem('ziv_device_id');
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('ziv_device_id', id);
  }
  return id;
}

/**
 * Registra una acción en Firestore.
 * @param {string} congreId
 * @param {'territorios'|'asignaciones'|'vida-ministerio'|'hermanos'|'conferencias'|'predicacion'} modulo
 * @param {'apertura'|'guardado'|'edicion'|'auto_asignar'|'generacion'} accion
 * @param {string|null} detalle  — texto libre, ej: "Semana 2026-04-07"
 * @param {object|null} extra    — campos adicionales del doc
 */
export async function logActividad(congreId, modulo, accion, detalle = null, extra = null) {
  if (!congreId) return;
  try {
    const user = window.currentUser;
    await addDoc(collection(db, 'congregaciones', congreId, 'actividad'), {
      uid:       user?.uid     ?? null,
      deviceId:  getDeviceId(),
      nombre:    user?.displayName || (user?.isAnonymous ? 'Invitado' : '—'),
      modulo,
      accion,
      detalle,
      ...(extra && typeof extra === 'object' ? extra : {}),
      anonimo:   !!(user?.isAnonymous),
      timestamp: serverTimestamp(),
    });
  } catch (_) { /* silencioso — nunca romper la app por esto */ }
}
