## Arquitectura (Firestore)

```
congregaciones/{congreId}/
  ├── (doc: nombre, color, creadoEn, tieneAuxiliar?,
  │         ciudadPrincipal?, ciudadesExtras?)
  ├── config_privada/modulos   → pinEncargado, pinVidaMinisterio, scriptUrl?, sheetsUrl?
  ├── grupos/{grupoId}         → id, label, color, pin
  ├── territorios/{terrId}     → id, nombre, tipo, grupoId, punto, poligonos, ciudad?, notas?
  │   └── historial/{entryId} → conductor, fechaInicio, fechaFin
  ├── salidas/{salidaId}       → grupoId, fechaReg, salidas[]
  ├── publicadores/{pubId}     → nombre, roles, activo
  ├── asignaciones/{docId}     → fecha, diaSemana, roles
  ├── semanasEspeciales/{lunesISO} → tipo, fechaEvento
  ├── chatNotas/grupo_{grupoId}/mensajes → autor, texto, createdAt, canal, grupo
  ├── chatNotas/congregacion/mensajes   → autor, texto, createdAt, canal, grupo
  ├── vidaministerio/{semanaId} → fecha, canciones, presidente, oraciones, tesoros, ministerio[], vidaCristiana[], tipoEspecial?
  ├── vmMeses/{YYYY-MM}        → encargadoSalaAuxId
  ├── mapa_territorios/{terrId} → espejo de territorios/ para el mapa público (modo=public)
  └── actividad/{entryId}      → uid, deviceId, nombre, modulo, accion, detalle, anonimo, timestamp

config/superadmin              → pin  ← PIN del panel de admin

usuarios/{uid}                 → perfil de usuario (ver sección Auth)
```

### Campos opcionales del doc de congregación

| Campo | Descripción |
|-------|-------------|
| `color` | Hex del color de la card en index.html. Si no existe, se deriva por hash del ID. |
| `tieneAuxiliar` | `bool` — activa la sala auxiliar en el módulo VM. |
| `ciudadPrincipal` | Nombre de la ciudad principal (ej: `"Santa Rosa"`). |
| `ciudadesExtras` | Array `[{ nombre, offset }]` — ciudades extra con su offset de IDs (+1000, +2000…). |

### Configuración privada por congregación

| Campo | Descripción |
|-------|-------------|
| `pinEncargado` | PIN del encargado para módulos que todavía dependen de PIN. |
| `pinVidaMinisterio` | PIN del módulo VM. |
| `scriptUrl` | URL del Apps Script de asignaciones (módulo Asignaciones). |
| `vmScriptUrl` | URL del Apps Script de VM (`tools/vm-sheets-script.gs`) — para export a Sheets desde VM. |
| `sheetsUrl` | URL de Google Sheets para accesos rápidos internos. |

### Navegación

1. `index.html` — elige congregación **y** módulo
   - La congregación se persiste en `localStorage` (`ziv_congre_id`, `ziv_congre_nombre`, `ziv_congre_color`)
   - Si hay congregación guardada → muestra menú de módulos de inmediato (optimista), luego valida auth en background
   - Si hay congregación pero sin sesión Firebase → `navegarDespuesDeAuth()` redirige a `view-auth`
   - "← Congregaciones" limpia `sessionStorage` pero **no** `localStorage` (se recuerda en próxima visita)
2. `territorios/index.html`, `asignaciones/index.html`, `vida-ministerio/index.html` o `hermanos/index.html`
3. Al volver ("← Volver al módulo") → `../index.html` → muestra menú de módulos automáticamente

**Lógica de carga en `index.html`:**
- `wantsMenu` (`location.hash === '#menu'`): llama `mostrarMenu()` inmediatamente + `navegarDespuesDeAuth()` en background
- `else if (savedId && savedNombre)`: igual — `mostrarMenu()` inmediato + `navegarDespuesDeAuth()` en background
- Sin congregación guardada: muestra `view-welcome` (slider de bienvenida)

### Transiciones de entrada en `index.html`

- `view-welcome` → `view-congres`: transición custom lenta en capas superpuestas. La welcome sale hacia arriba y el selector de congregación entra desde abajo.
- `view-congres` → `view-auth`: transición lateral custom. El selector sale hacia la izquierda y auth entra desde la derecha.
- `view-auth` → `view-congres`: misma lógica en reversa. Auth sale hacia la derecha y vuelve a entrar el selector desde la izquierda.
- Estas transiciones no usan `showView()` durante el cruce visual. Se montan ambas vistas como overlays temporales (`.view.intro-layer`) para evitar reflow horizontal o “teletransporte” del layout.
- En esos casos se anima el contenido interno (`.wrap`, `.auth-screen`) y no la vista completa, para no pelear con el `fadeIn` genérico de `.view`.

El ID de congregación es un slug legible (ej: `"sur"`, `"norte"`), elegido al crear.

---

## Estructura de archivos

```
/
├── index.html              # SPA: elegir congregación → auth → módulo
├── perfil.html             # Perfil de usuario: primer login y edición posterior
├── admin.html              # Panel de superadmin (URL + PIN)
├── admin.js                # Lógica del panel de admin
├── sw.js                   # Service worker (cache shell)
├── manifest.json           # PWA manifest
├── CNAME                   # GitHub Pages dominio
├── shared/                 # JS compartido entre todos los módulos
│   ├── firebase.js         # Inicialización compartida de Firebase (exporta `db` y `auth`)
│   ├── auth.js             # Auth: Google sign-in, anónimo, perfiles, session header
│   ├── auth-config.js      # Roles de app + mapa de permisos (único lugar a editar)
│   └── ui-utils.js         # Componentes UI: modales, pickers, loading, toast, session header
├── assets/                 # Íconos y favicons
│   ├── favicon.svg
│   ├── favicon.ico
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
├── docs/                   # Documentación del proyecto
│   ├── UI-STYLE.md         # Sistema visual completo
│   └── *.md                # Docs por módulo (importados en CLAUDE.md)
├── territorios/
│   ├── index.html          # App de territorios
│   ├── app.js              # Lógica principal (100% Firestore)
│   ├── styles.css
│   └── mapa.html           # Mapa Leaflet — polígonos desde Firestore
├── asignaciones/
│   ├── index.html          # App de asignaciones
│   ├── app.js              # Lógica de asignaciones (100% Firestore)
│   └── styles.css
├── vida-ministerio/
│   ├── index.html          # App de VM
│   ├── app.js              # Lógica principal
│   ├── programa.html       # Visor público solo lectura (sin PIN)
│   ├── programa.js         # Lógica del visor público
│   └── styles.css
├── hermanos/
│   ├── index.html          # Módulo Administrador (publicadores + semanas especiales)
│   ├── app.js
│   └── styles.css
├── predicacion/
│   └── index.html          # Placeholder "En desarrollo" — módulo de tiempos, revisitas, estudios
├── conferencias/
│   └── index.html          # Placeholder "En desarrollo" — arreglos de discursos del fin de semana
└── tools/                  # Scripts de migración y sync (conservar como referencia)
    ├── kml_to_json.py
    ├── migrate_sheets.py
    ├── upload_territorios.py
    ├── sync_historial.py
    ├── import_vm_historial.py   # Importa historial VM desde Excel → Firestore
    ├── codigodeappscript        # Apps Script de asignaciones (Congregación Sur)
    ├── territorios_sur.json
    └── congregacionsur.kml
    # *.xlsx y serviceAccountKey.json → en .gitignore, nunca commitear
```

---

## Stack

- **Frontend:** HTML + CSS + JS vanilla (sin frameworks, sin bundler)
- **Hosting:** GitHub Pages (repo AppJWCongSur), dominio `congsur.lat`
- **Base de datos:** Firebase Firestore (`appjw-3697e`)
- **Auth:** Firebase Authentication — Google + Anónimo (coexiste con PINs)
- **Mapa:** Leaflet.js + OpenStreetMap
- **Imagen para compartir:** html2canvas (CDN)
- **Analytics:** PostHog

---

## Firebase

```js
import { db }         from '../shared/firebase.js';   // Firestore
import { db, auth }   from '../shared/firebase.js';   // Firestore + Auth
import '../shared/auth.js';                            // activa session header y globals de auth
```

- Firebase SDK 11.6.0 (ES modules via gstatic CDN)
- Scripts con firebase.js necesitan `type="module"` en el HTML
- `auth.js` está importado en todos los `app.js` de módulos — activa el session header automáticamente

---

## Convenciones de fechas

Siempre hora local — **nunca `toISOString()`** (bug UTC-3).

```js
// Global en ui-utils.js:
window.fmtDateLocal = function(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
// En módulos: usar fmtDateLocal() directamente (global) o: const fmtDate = fmtDateLocal;
```

Almacenamiento: `YYYY-MM-DD`. Display: `DD/MM/YY`.
