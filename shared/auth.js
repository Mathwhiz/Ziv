// auth.js — Autenticación y perfiles de usuario
// Importar en cada página con: import './shared/auth.js' (raíz) o '../shared/auth.js' (módulos)
// Expone en window: waitForAuth, currentUser, hasPermission, authGuard,
//                   signInWithGoogle, signInAnonymousUser, linkWithGoogle,
//                   signOutUser, updateUserProfile

import { db, auth } from './firebase.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  signInAnonymously,
  linkWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc,
  collection, getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { PERMISOS } from './auth-config.js';

// Roles del publicador que se sincronizan a appRoles del usuario
const _ROL_PUB_A_APP = {
  PRECURSOR_REGULAR:  'precursor_regular',
  PRECURSOR_AUXILIAR: 'precursor_auxiliar',
  ANCIANO:            'anciano',
  SIERVO_MINISTERIAL: 'siervo_ministerial',
};
async function _rolesDesdePublicador(congreId, pubId) {
  try {
    const snap = await getDoc(doc(db, 'congregaciones', congreId, 'publicadores', pubId));
    if (!snap.exists()) return [];
    return (snap.data().roles || []).filter(r => _ROL_PUB_A_APP[r]).map(r => _ROL_PUB_A_APP[r]);
  } catch { return []; }
}

// ── Detección de plataforma (Capacitor APK vs browser) ───────────
const _isNative = () => window.Capacitor?.isNativePlatform() === true;

// ── Estado interno ────────────────────────────────────────────────
let _user      = null;   // { ...campos Firestore, _firebaseUser }
let _authReady = false;
const _waiters = [];     // resolvers en espera de que auth esté listo

function normalizeAppRoles(data) {
  if (Array.isArray(data?.appRoles)) return data.appRoles;
  if (typeof data?.appRoles === 'string' && data.appRoles.trim()) return [data.appRoles.trim()];
  if (data?.appRol) return [data.appRol];
  return ['publicador'];
}

const SELF_PROFILE_FIELDS = ['displayName', 'photoURL', 'birthDate', 'sexo', 'primerLogin'];

// ── Caché de sesión (sessionStorage) ─────────────────────────────
// Permite que authGuard resuelva inmediatamente en cada cambio de página
// sin esperar el getDoc de Firestore. Se invalida al cerrar la pestaña.
function _getCachedUser(uid) {
  try {
    const raw = sessionStorage.getItem('_zivUserCache');
    if (!raw) return null;
    const cached = JSON.parse(raw);
    return cached.uid === uid ? cached : null;
  } catch { return null; }
}
function _setCachedUser(user) {
  try {
    const { _firebaseUser, ...data } = user; // no serializar el objeto Firebase
    sessionStorage.setItem('_zivUserCache', JSON.stringify(data));
  } catch {}
}
function _clearUserCache() {
  sessionStorage.removeItem('_zivUserCache');
}

// ── Normalización de strings para matching ────────────────────────
function normalize(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// ── Matching con publicadores de Firestore ────────────────────────
function matchPublicador(displayName, pubs) {
  const normName   = normalize(displayName);
  const normTokens = normName.split(' ').filter(Boolean);

  // 1. Coincidencia exacta
  const exact = pubs.filter(p => normalize(p.nombre) === normName);
  if (exact.length === 1) return { pub: exact[0], confidence: 'exact' };

  // 2. Todos los tokens del nombre de Google están en el nombre del pub
  const tokens = pubs.filter(p => {
    const n = normalize(p.nombre);
    return normTokens.every(t => n.includes(t));
  });
  if (tokens.length === 1) return { pub: tokens[0], confidence: 'token' };
  if (tokens.length  > 1) return { pub: null, confidence: 'ambiguous', candidates: tokens };

  return { pub: null, confidence: 'none' };
}

async function tryMatch(displayName, congreId) {
  const snap = await getDocs(collection(db, 'congregaciones', congreId, 'publicadores'));
  const pubs  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return matchPublicador(displayName, pubs);
}

// ── Cargar o crear usuario en Firestore ───────────────────────────
async function loadOrCreateUser(fbUser) {
  const ref  = doc(db, 'usuarios', fbUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    // Normalizar a array (backward compat con appRol string legacy)
    const appRoles = normalizeAppRoles(data);
    console.log('[auth] usuario cargado:', { uid: fbUser.uid, appRoles, matchEstado: data.matchEstado, primerLogin: data.primerLogin });
    return { ...data, appRoles, _firebaseUser: fbUser };
  }

  // Sesión anónima — doc mínimo, sin matching, sin perfil obligatorio
  if (fbUser.isAnonymous) {
    const data = {
      uid:               fbUser.uid,
      email:             null,
      displayName:       null,
      photoURL:          null,
      birthDate:         null,
      sexo:              null,
      matchedPublisherId: null,
      congregacionId:    sessionStorage.getItem('congreId') || null,
      appRol:            'anonimo',
      appRoles:          ['anonimo'],
      matchEstado:       'anonimo',
      isAnonymous:       true,
      primerLogin:       false,
      createdAt:         null,
    };
    // No persistir invitados en Firestore: la sesión anónima de Firebase alcanza
    // para mantener el flujo actual sin llenar `usuarios/` de docs descartables.
    return { ...data, _firebaseUser: fbUser };
  }

  // Usuario Google — intentar match automático con publicadores
  const congreId = sessionStorage.getItem('congreId');
  let matchedPublisherId = null;
  let matchEstado        = 'sin_match';

  if (congreId && fbUser.displayName) {
    const m = await tryMatch(fbUser.displayName, congreId);
    if (m.pub) {
      matchedPublisherId = m.pub.id;
      matchEstado        = 'ok';
    } else if (m.confidence === 'ambiguous') {
      matchEstado = 'pendiente';
    }
  }

  // sin_match → publicador (acceso base; admin puede elevar el rol)
  // pendiente (ambiguo) → pendiente (admin debe confirmar cuál publicador es)
  const appRol = matchEstado === 'pendiente' ? 'pendiente' : 'publicador';
  const extraRoles = (matchEstado === 'ok' && matchedPublisherId && congreId)
    ? await _rolesDesdePublicador(congreId, matchedPublisherId)
    : [];
  const appRoles = [...new Set([appRol, ...extraRoles])];

  const data = {
    uid:               fbUser.uid,
    email:             fbUser.email,
    displayName:       fbUser.displayName || '',
    photoURL:          fbUser.photoURL    || null,
    birthDate:         null,
    sexo:              null,
    matchedPublisherId,
    congregacionId:    congreId || null,
    appRol,
    appRoles,
    matchEstado,
    isAnonymous:       false,
    primerLogin:       true,
    createdAt:         serverTimestamp(),
  };

  console.log('[auth] nuevo usuario creado:', { uid: fbUser.uid, appRol, matchEstado, congreId });
  await setDoc(ref, data);
  return { ...data, _firebaseUser: fbUser };
}

// ── Listener principal de Auth ────────────────────────────────────
onAuthStateChanged(auth, async (fbUser) => {
  // Fast path: si hay caché válido, resolver waiters sin esperar Firestore
  // Esto elimina el delay visible al navegar entre páginas dentro de la sesión.
  if (fbUser && !_authReady) {
    const cached = _getCachedUser(fbUser.uid);
    if (cached) {
      _user = { ...cached, _firebaseUser: fbUser };
      _authReady = true;
      _waiters.forEach(r => r(_user));
      _waiters.length = 0;
      if (typeof window.updateSessionHeader === 'function') window.updateSessionHeader(_user);
    }
  }

  try {
    if (fbUser) {
      _user = await loadOrCreateUser(fbUser);
      _setCachedUser(_user);
    } else {
      _user = null;
      _clearUserCache();
    }
  } catch (err) {
    console.error('[auth] Error al cargar usuario — authGuard bloqueará el acceso:', err);
    // Si se resolvió desde caché, no nullear _user (datos stale > sin acceso)
    if (!_authReady) _user = null;
  } finally {
    _authReady = true;
    _waiters.forEach(resolve => resolve(_user)); // no-op si ya se resolvió desde caché
    _waiters.length = 0;
    if (typeof window.updateSessionHeader === 'function') window.updateSessionHeader(_user);
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: _user } }));
  }
});

// ── API pública (window) ──────────────────────────────────────────

/** Devuelve una Promise que resuelve cuando onAuthStateChanged disparó por primera vez. */
window.waitForAuth = () =>
  _authReady ? Promise.resolve(_user) : new Promise(r => _waiters.push(r));

/** Usuario actual (null si no está logueado). */
Object.defineProperty(window, 'currentUser', { get: () => _user });

/**
 * Verifica si el usuario actual tiene un permiso.
 * @param {string} feature — key de PERMISOS (ej: 'acceso_territorios')
 */
window.hasPermission = (feature) => {
  if (!_user) return false;
  const roles = normalizeAppRoles(_user);
  return roles.some(r => (PERMISOS[r] || []).includes(feature));
};

/**
 * Guard: si el usuario no tiene el permiso, redirige a index.html.
 * Usar con await al inicio de cada módulo que requiere auth.
 * @param {string} feature
 */
window.authGuard = async (feature) => {
  await window.waitForAuth();
  const allowed = window.hasPermission(feature);
  console.log('[authGuard]', feature, {
    uid:        _user?.uid        ?? null,
    appRol:     _user?.appRol     ?? null,
    matchEstado: _user?.matchEstado ?? null,
    isAnonymous: _user?.isAnonymous ?? null,
    allowed,
  });
  if (!allowed) {
    window.location.replace('/?sin_acceso=1');
    throw new Error(`Sin acceso: ${feature}`);
  }
};

/** Abre Google sign-in (popup en browser, nativo en APK Capacitor). */
window.signInWithGoogle = async () => {
  if (_isNative()) {
    // Plugin nativo: Google Sign-In legacy (compatible con todos los Android)
    const { GoogleAuth } = window.Capacitor.Plugins;
    await GoogleAuth.initialize({
      clientId: '161788232097-fek8psb65gkanmo2vijh2mjd877hhbps.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
    });
    const googleUser = await GoogleAuth.signIn();
    const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
    const fbResult = await signInWithCredential(auth, credential);
    return fbResult.user;
  }
  const provider = new GoogleAuthProvider();
  const result   = await signInWithPopup(auth, provider);
  return result.user;
};

/** Inicia sesión anónima (flujo "Omitir por ahora"). */
window.signInAnonymousUser = async () => {
  await signInAnonymously(auth);
  // onAuthStateChanged dispara y crea el doc automáticamente
};

/**
 * Vincula una sesión anónima existente con una cuenta de Google.
 * Después del link, el usuario tiene `primerLogin: true` y se redirige a perfil.html.
 */
window.linkWithGoogle = async () => {
  if (!_user?.isAnonymous) throw new Error('No hay sesión anónima activa');

  if (_isNative()) {
    const { GoogleAuth } = window.Capacitor.Plugins;
    await GoogleAuth.initialize({
      clientId: '161788232097-fek8psb65gkanmo2vijh2mjd877hhbps.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
    });
    const googleUser = await GoogleAuth.signIn();
    const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
    const fbResult = await signInWithCredential(auth, credential);
    return fbResult.user;
  }
  const provider = new GoogleAuthProvider();
  let result;
  try {
    result = await linkWithPopup(auth.currentUser, provider);
  } catch (err) {
    if (err?.code === 'auth/credential-already-in-use') {
      // La cuenta Google ya existe en Firebase: reutilizar la credencial del
      // popup fallido evita pedirle al usuario que elija la cuenta dos veces.
      const credential = GoogleAuthProvider.credentialFromError(err);
      if (credential) {
        const signInResult = await signInWithCredential(auth, credential);
        return signInResult.user;
      }
      const fbUser = await window.signInWithGoogle();
      return fbUser;
    }
    throw err;
  }
  const fbUser   = result.user;

  const congreId = sessionStorage.getItem('congreId') || _user.congregacionId;
  let matchedPublisherId = null;
  let matchEstado        = 'sin_match';

  if (congreId && fbUser.displayName) {
    const m = await tryMatch(fbUser.displayName, congreId);
    if (m.pub) {
      matchedPublisherId = m.pub.id;
      matchEstado        = 'ok';
    } else if (m.confidence === 'ambiguous') {
      matchEstado = 'pendiente';
    }
  }

  const appRol = matchEstado === 'pendiente' ? 'pendiente' : 'publicador';
  const extraRoles = (matchEstado === 'ok' && matchedPublisherId && congreId)
    ? await _rolesDesdePublicador(congreId, matchedPublisherId)
    : [];
  const appRoles = [...new Set([appRol, ...extraRoles])];

  const updates = {
    email:             fbUser.email,
    displayName:       fbUser.displayName || '',
    photoURL:          fbUser.photoURL    || null,
    matchedPublisherId,
    congregacionId:    congreId || null,
    appRol,
    appRoles,
    matchEstado,
    isAnonymous:       false,
    primerLogin:       true,
  };

  console.log('[auth] linkWithGoogle:', { uid: fbUser.uid, appRol, matchEstado, congreId });
  const ref = doc(db, 'usuarios', fbUser.uid);
  await setDoc(ref, { uid: fbUser.uid, createdAt: serverTimestamp(), ...updates }, { merge: true });
  Object.assign(_user, updates, { _firebaseUser: fbUser });
  _setCachedUser(_user);

  if (typeof window.updateSessionHeader === 'function') window.updateSessionHeader(_user);
  window.dispatchEvent(new CustomEvent('authStateChanged', { detail: { user: _user } }));
  return _user;
};

/** Cierra sesión. */
window.signOutUser = async () => {
  _user = null;
  _clearUserCache();
  await signOut(auth);
};

/**
 * Actualiza el perfil del usuario en Firestore y en memoria.
 * @param {Object} data — campos a actualizar en usuarios/{uid}
 */

window.updateUserProfile = async (data) => {
  if (!_user) throw new Error('No hay usuario logueado');
  const safeData = Object.fromEntries(
    Object.entries(data || {}).filter(([key]) => SELF_PROFILE_FIELDS.includes(key))
  );
  if (Object.keys(safeData).length === 0) {
    throw new Error('No hay campos válidos para actualizar');
  }
  const ref = doc(db, 'usuarios', _user.uid);
  await updateDoc(ref, safeData);
  Object.assign(_user, safeData);
  _setCachedUser(_user);
};
