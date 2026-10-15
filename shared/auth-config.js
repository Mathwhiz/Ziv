// auth-config.js — Roles y permisos de la app
// Para cambiar qué puede hacer un rol: editar PERMISOS.
// Para agregar una feature nueva: agregar la key aquí y llamar
// hasPermission('nueva_feature') donde se necesite.

// Versión vigente de Términos y Condiciones / Política de Privacidad.
// Subir este valor fuerza a todos los usuarios a re-aceptar en su próximo login.
export const TERMINOS_VERSION = 'v1';

export const APP_ROLES = {
  ADMIN_GENERAL:            'admin_general',
  ADMIN_CONGRE:             'admin_congre',
  ENCARGADO_ASIGNACIONES:   'encargado_asignaciones',
  ENCARGADO_VM:             'encargado_vm',
  ENCARGADO_GRUPO:          'encargado_grupo',
  ENCARGADO_CONFERENCIAS:   'encargado_conferencias',
  ENCARGADO_EDIFICIOS:      'encargado_edificios',  // asigna responsables de edificios (como encargado de grupo)
  ANCIANO:                  'anciano',
  SIERVO_MINISTERIAL:       'siervo_ministerial',
  PRECURSOR_REGULAR:        'precursor_regular',
  PRECURSOR_AUXILIAR:       'precursor_auxiliar',
  PUBLICADOR:               'publicador',
  PENDIENTE:                'pendiente',  // sin match confirmado — acceso bloqueado
  ANONIMO:                 'anonimo',    // sesión anónima — acceso igual que antes del sistema de perfiles
};

// ─────────────────────────────────────────────────────────────────
// PERMISOS
// Cada key es una feature que se puede verificar con hasPermission().
// Agregar un rol nuevo: copiarlo con el array de features que le corresponda.
// ─────────────────────────────────────────────────────────────────
export const PERMISOS = {

  admin_general: [
    'acceso_admin',
    'acceso_territorios',
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_hermanos',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
    'administrar_edificios',
    'acceso_conferencias',
    'editar_conferencias',
    'editar_publicadores',
    'editar_congregacion',
    'ver_todas_congregaciones',
    'gestionar_usuarios',
  ],

  admin_congre: [
    'acceso_territorios',
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_hermanos',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
    'administrar_edificios',
    'acceso_conferencias',
    'editar_conferencias',
    'editar_publicadores',
    'gestionar_usuarios',
  ],

  encargado_asignaciones: [
    'acceso_asignaciones',
    'acceso_hermanos',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
  ],

  encargado_vm: [
    'acceso_vm',
    'acceso_hermanos',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
  ],

  encargado_grupo: [
    'acceso_territorios',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
  ],

  // Edificios: asigna el responsable de cada edificio y lo da por terminado (igual que un encargado de grupo
  // con los territorios). Ancianos y siervos ministeriales también pueden.
  encargado_edificios: [
    'acceso_edificios',
    'administrar_edificios',
    'acceso_predicacion',
    'acceso_telefonica',
  ],

  encargado_conferencias: [
    'acceso_conferencias',
    'editar_conferencias',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
  ],

  // acceso_conferencias: solo anciano/siervo_ministerial entre los roles de
  // publicador — el resto de roles "base" no lo tiene (decisión de acceso,
  // no relacionada con los PINs).
  anciano: [
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_conferencias',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
    'administrar_edificios',
  ],

  siervo_ministerial: [
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_conferencias',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
    'administrar_edificios',
  ],

  precursor_regular: [
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
  ],

  precursor_auxiliar: [
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
  ],

  publicador: [
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_predicacion',
    'acceso_telefonica',
    'acceso_edificios',
  ],

  pendiente: [
    // Sin acceso hasta que el admin confirme el match
  ],

  // Acceso anónimo: Asignaciones/VM tienen vista pública propia (sin datos de
  // encargado). Territorios (interno) y Hermanos quedan afuera — Territorios
  // solo lo ven encargado_grupo/admin; el mapa público (mapa.html?modo=public)
  // es una vista aparte que no pasa por authGuard.
  anonimo: [
    'acceso_asignaciones',
    'acceso_vm',
    'acceso_predicacion',
  ],

};
