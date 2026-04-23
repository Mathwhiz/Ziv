## Ideas pendientes (futuro)

### Módulo Conferencias (PRÓXIMO — alta prioridad)
Gestión de arreglos de discursos del fin de semana (sábados).

**Contexto:**
- Cada sábado (excepto semanas especiales) viene un orador de otra congregación
- Ancianos y SM tienen discursos preparados con número de esquema
- Los arreglos se coordinan entre congregaciones del circuito (hoy por WhatsApp/planillas)

**Vistas necesarias:**
- `view-salidas` — oradores de nuestra congregación que salen a otras (fecha, destino, discurso)
- `view-entradas` — oradores que vienen a nuestra congregación (fecha, nombre, congregación origen, discurso)
- `view-discursos` — lista de discursos preparados por publicador (anciano/SM con sus esquemas)
- `view-congregaciones` — congregaciones del circuito (nombre, contacto)

**Schema Firestore propuesto:**
```
congregaciones/{congreId}/
  conferencias/{docId}
    fecha: "YYYY-MM-DD" (sábado)
    tipo: "entrada" | "salida"
    pubId: null | "id"              ← si es de nuestra congregación
    nombreExterno: null | "string"  ← si es de otra congregación (entrada)
    congregacionId: null | "id"     ← ref a congregacionesCircuito
    congregacionNombre: "string"    ← desnormalizado para display
    discursoNumero: 123
    discursoTitulo: "string"
    notas: null | "string"
  congregacionesCircuito/{circId}
    nombre: "string"
    contacto: null | "string"       ← nombre del encargado de conferencias
  discursosPublicador/{pubId}
    discursos: [{numero, titulo}]   ← subcolección o array
```

---

### Geolocalización activa en predicación (ANOTAR — interesante)
Ver en tiempo real dónde están los hermanos del grupo mientras predican.

**Idea:**
- Al salir a predicar, el hermano activa "Compartir ubicación" (opt-in explícito)
- Su posición se escribe en Firestore en tiempo real
- Los demás del grupo la ven como puntitos en `mapa.html`

**Técnico:**
- `navigator.geolocation.watchPosition()` → escribe en `congregaciones/{id}/sesiones/{salidaId}/ubicaciones/{uid}` con TTL
- `mapa.html` escucha con `onSnapshot` y pinta markers dinámicos
- Solo visible para tu grupo, solo mientras la sesión está activa
- Se limpia automáticamente al cerrar (TTL en Firestore o cleanup en `beforeunload`)
- Privacidad: completamente opt-in, desactivable en cualquier momento

---

### Asistencia a reuniones (ANOTAR — simple)
Registrar asistencia por reunión en Administrador.

- Un botón extra en Administrador → vista simple con lista de hermanos + checkbox por reunión
- Firestore: `asistencias/{fechaISO}` con array de pubIds presentes
- Útil internamente para detectar irregularidad (no se reporta a la sede)
- Vista mensual con porcentajes por hermano

---

### Notificaciones push (ANOTAR — Firebase Messaging)
Notificaciones automáticas para recordar responsabilidades próximas.

**Casos de uso:**
- Tenés una asignación en los próximos 7 días (lector, sonido, etc.)
- Falta menos de 2 semanas para una semana especial (asamblea, conmemoración, etc.)
- (Futuro) Te toca limpieza del Salón

**Técnico:**
- Firebase Cloud Messaging (FCM) — pide permiso de notificaciones al usuario
- Service worker ya existe (`sw.js`) — agregar handler de mensajes push
- Requiere backend ligero (Cloud Function) que corra periódicamente y detecte próximos eventos
- Alternativa sin backend: recordatorio local con `Notification API` + `setTimeout` al abrir la app

---

### Limpieza del Salón del Reino (ANOTAR)
- Registrar el esquema rotativo de limpieza por grupos
- Ver quién le toca esta semana y la próxima
- Notificación push días antes del turno (se integra con el sistema de notificaciones)
- No requiere swapping, solo visibilidad del calendario

---

### Auditoría — log de cambios (✅ implementado básico)
- Colección `congregaciones/{congreId}/actividad/{entryId}` con `uid`, `deviceId`, `nombre`, `modulo`, `accion`, `detalle`, `anonimo`, `timestamp`
- Vista en `admin.html` → botón 📊 por congregación (`view-actividad`): stats de acciones / personas / guardados + lista cronológica
- `shared/actividad.js` exporta `logActividad(congreId, modulo, accion, detalle?)` — llamado en apertura y guardado de cada módulo
- Regla Firestore: `allow create: if true` (sin auth requerida) para capturar también usuarios sin sesión
- **Pendiente:** registrar acciones más granulares (crear/editar/eliminar hermano, cambiar rol, etc.)

### Dashboard de estadísticas (más adelante)
- Territorios trabajados por mes/gráfico
- Publicadores más activos
- Tiempo promedio entre usos de territorio
- Asistencias y participaciones en reuniones

### Reportes PDF (más adelante)
- Informe mensual de territorios
- Historial completo de un territorio
- Resumen de asignaciones del mes

### Exportar historial a Excel/CSV (más adelante)
- Exportar todo el historial a Excel/CSV
- Backup completo de la congregación

### Widgets en pantalla principal (ANOTAR)
- Mostrar resumen rápido (próximas salidas, esta semana en reunión)
- Requiere que cada publicador pueda elegir ver su congregación

### Responsive mejorado (ANOTAR)
- Optimizar para tablets (actualmente mobile-first)

### Seguridad — en progreso
- ✅ Firebase Auth con Google + Anónimo
- ✅ Roles de usuario + mapa de permisos (`shared/auth-config.js`)
- ✅ Matching automático con publicadores existentes
- ✅ Session header global
- ✅ Persistencia de congregación en localStorage
- ✅ Guards activos en módulos — `authGuard()` llamado al inicio de cada `app.js`
- ✅ Resolución de matches ambiguos en `admin.html` (vista `view-matches`)
- ⬜ Reemplazar PINs internos por auth real (decisión pendiente)
- ✅ PIN Administrador endurecido: `view-menu` ya no tiene `active` al inicio. El PIN modal cubre una página vacía; solo tras validación correcta se navega a `view-menu`. Pendiente migrar a auth/backend real.
- ⬜ Auditoría: log de cambios importantes (quién modificó qué y cuándo)

### Mejorar integración Google Sheets (Asignaciones)
- Fetch actual usa `no-cors` + `keepalive:true` → respuesta opaca, no se puede confirmar éxito
- Pendiente: agregar confirmación real o mecanismo de retry/estado

### Investigar demora al volver de módulo a selección de módulo (ANOTAR)
- Al navegar `../index.html` o `../index.html#menu` desde un módulo, hay ~500ms de delay visible
- Causa probable: Firebase Auth tarda en restaurar la sesión (`onAuthStateChanged` no es síncrono)
- Mitigación aplicada: `mostrarMenu()` optimista antes de `waitForAuth()`, pero el re-render puede producir flash
- Pendiente: investigar si se puede cachear el estado de auth en sessionStorage para evitar el round-trip

### Privilegios por registro — usar `appRol` en la app (ANOTAR)
- Actualmente el sistema de roles existe (`shared/auth-config.js`, `authGuard`, `hasPermission`) pero no se usa en la UI para personalizar la experiencia del usuario
- Pendiente: mostrar/ocultar funcionalidades según el rol del usuario registrado (ej: botón "Encargado" solo visible para roles habilitados, info de territorios personalizada para el grupo del publicador)
- Requiere vincular `matchedPublisherId` con los datos del publicador para saber su grupo, sus asignaciones, etc.

### Mejorar perfil de la web al registrarse (ANOTAR)
- El flujo actual de registro (`perfil.html`) es funcional pero básico
- Pendiente: mejorar la experiencia visual y de onboarding al registrarse con Google
  - Mostrar la foto de perfil de Google y permitir cambiarla
  - Indicar al usuario qué puede hacer con su perfil (acceso a módulos según rol)
  - Mostrar el estado del match con publicadores de forma más clara
  - Posiblemente un wizard de bienvenida de 2-3 pasos para nuevos usuarios
