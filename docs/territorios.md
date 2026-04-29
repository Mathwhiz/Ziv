## Módulo de Territorios

### Chat / Notas compartidas (✅ implementado)

Canal interno de comunicación dentro de **Territorios**, implementado como **FAB flotante** (botón abajo-derecha, visible en todas las vistas post-login):

- **No es una vista separada** — es un overlay panel que se abre sobre cualquier vista
- Dos canales con tabs verticales a la izquierda del panel:
  - **Grupo** (notas del grupo logueado)
  - **Congregación** (notas visibles por todos)
- El autor del mensaje es siempre el nombre del **grupo logueado** (`"Grupo 1"`, `"Grupo 2"`, etc.) — independientemente del canal. Si se postea desde el canal Congregación, el autor sigue siendo el grupo. `"Congregación"` solo se usa si el `grupoId` es `'C'`.
- Mensajes **eliminables** (con popup de confirmación `uiConfirm`)
- Mensajes **editables solo por el autor** — autoría rastreada por `sessionStorage chatMisIds` (array de IDs de docs creados en la sesión)
- `showChatFab()` se llama desde `goToModo()` (post-login); `hideChatFab()` desde `goToCover()` / `cerrarSesion()`

**HTML:** `#chat-fab` (fixed bottom-right) + `#chat-overlay` con `#chat-panel` (`.chat-vtabs` + `.chat-panel-body`) + `#chat-edit-modal`

**Funciones globales:** `openChatPanel`, `closeChatPanel`, `switchChatScope`, `refreshChatNotas`, `sendChatNota`, `abrirEditNota`, `closeChatEdit`, `confirmarEditNota`, `eliminarNota`

**Estructura Firestore:**
- `congregaciones/{congreId}/chatNotas/grupo_{grupoId}/mensajes`
- `congregaciones/{congreId}/chatNotas/congregacion/mensajes`

Cada mensaje guarda: `autor` (nombre del grupo), `texto`, `createdAt`, `canal`, `grupo`.

### Grupos (vienen de Firestore en runtime)

| Grupo | Color | PIN |
|-------|-------|-----|
| 1 | `#378ADD` | configurado por admin |
| 2 | `#EF9F27` | configurado por admin |
| 3 | `#97C459` | configurado por admin |
| 4 | `#D85A30` | configurado por admin |
| Congregación | `#7F77DD` | configurado por admin |

### Territorios especiales
- Tipo `no_predica`: territorio 131
- Tipo `peligroso`: territorio 11

### Multi-ciudad (✅ implementado)

Algunas congregaciones predican en más de una ciudad. Soporte completo:
- Campo `ciudad` (string | null) en cada territorio: `null` = ciudad principal, `"Ataliva Roca"` = ciudad extra
- Territorios de ciudades extra siempre pertenecen al grupo `'C'` (Congregación)
- IDs con offset: ciudad extra 1 → +1000, ciudad extra 2 → +2000 (evita colisiones)
- `nombre` almacena el display (`"Territorio 1"`) independientemente del ID offset
- En `mapa.html` modo full: botones ciudad como filtro toggle con viewport dinámico (`maxBounds` + `minZoom` calculados desde polígonos reales de esa ciudad)
- En info grid ("ver mi grupo"): headers de ciudad cuando hay territorios de múltiples ciudades
- En picker de salidas: territorios de Congregación agrupados por ciudad

### Mapa público vs mapa interno

`index.html` abre el mapa con `modo=public` → `mapa.html` lee de `mapa_territorios` (espejo de solo lectura).
Los módulos internos (territorios/app.js) abren el mapa sin ese parámetro → lee de `territorios`.

**Al actualizar polígonos hay que escribir en ambas colecciones.** `tools/update_poligonos.py` ya lo hace automáticamente (actualiza `territorios` y, si existe el doc, también `mapa_territorios`).

### Mapa (`mapa.html`)

Modos via URL params:
- `?modo=full` — mapa completo con filtros por grupo + botones de ciudad extra
- `?modo=info` — coloreado por días desde último uso
- `?modo=registrar&enprogreso=92,113,...` — solo territorios en progreso
- `?modo=picker&grupo=3&salidaid=2` — selector; devuelve resultado al padre via `postMessage`

Sub-polígonos usan sufijos letra (92a, 92b) que mapean al mismo territorio base.

### Tema claro / oscuro (estado actual)

- **Modo oscuro** sigue siendo el default.
- **Modo claro**: fondo orgánico con gradientes radiales + textura de ruido (en `shared/ui-utils.js`).
- `.grupo-btn` en modo claro: regla CSS `body.light-mode .grupo-btn` con fondo violeta suave. **No usar `style.background` para el estado deseleccionado** — limpiar inline style (`b.style.background = ''`) y dejar que CSS lo maneje. El estado seleccionado sí usa inline style con el color del grupo (`GBGS` value).
- Se unificó el hover de cards de módulos para que respete el estilo de la selección de congregación.
- Botones flotantes de **Instalar** y **Admin** tienen variante de modo claro.

### Planificar salidas — cards compactas

Las cards de salida (`renderSalidaCard`) usan diseño compacto:
- Padding: `10px 14px` (antes `1rem 1.25rem`)
- Nombre del día: `14px font-weight:600` inline junto al tipo (`· Campo`), **no** el 22px anterior
- Labels de campo: `font-size:11px` (override local)
- `form-row` con `margin-bottom:6px`

### View-info ("Ver mi grupo") — diseño actual

Header: botón back (`.info-back`) + label uppercase `.va-header-sup` ("Territorios · Cong") + título grande con número de grupo coloreado + pill con conteo de territorios (`.info-count-pill`).

Leyenda: `.va-legend` con `.va-dot` para cada estado. El punto "Normal" usa `.va-dot-gc` → `var(--grupo-color)`.

Grid: `.va-grid` con `grid-template-columns: repeat(auto-fill, minmax(160px, 1fr))`. Funciona sin breakpoints manuales.

**Cards de territorio** (`.va-terr[data-estado]`):
- `data-estado`: `"normal"` | `"peligroso"` | `"nopredica"` | `"sinreg"` (sinreg = sin historial)
- Número grande, label de estado en uppercase, chip de días, conductor del último historial
- Color del número y gradiente de fondo determinados por `data-estado` + `--grupo-color` para normal
- `fetchGrupo()` ya incluye `lastConductor` del último historial para mostrarlo en la card

**`daysClass(d)`** — umbrales exactos para el chip de días:
- `d < 30` → `days-ok` (verde)
- `d ≤ 60` → `days-warn` (amarillo)
- `d > 60` → `days-bad` (rojo)

**Modal de territorio** — bottom sheet animado:
- Overlay: `display:flex; align-items:flex-end`. Sheet: `transform:translateY(100%)` → `translateY(0)` con `cubic-bezier(0.22,1,0.36,1)`.
- Apertura: `modal.style.display='flex'` + doble `requestAnimationFrame` → `modal.classList.add('open')`.
- Cierre: `modal.classList.remove('open')` → `setTimeout 300ms` → `display:none` + reset de `modalTerr`.
- Estructura: handle → número grande + sub-label → **estado arriba** (3 botones `.me-normal/.me-peligroso/.me-nopredica`) → historial → notas.
- `--grupo-color` se setea en el modal element al abrirlo; `modal-terr-num` lo hereda para su color.

### Informe para el Super (✅ implementado)

Exportación en PDF del historial de todos los territorios del grupo para presentar al
superintendente de circuito en cada visita semestral.

**Entrada:** botón "Informe para el Superintendente" (`.va-informe-full`) en `view-info`, visible tras cargar los territorios.

**Período automático** — lee `semanasEspeciales` filtrando `tipo === 'superintendente'` y toma las
dos fechas más recientes:
- 2 visitas registradas → `desde` = penúltima, `hasta` = última
- 1 visita → `desde` = esa fecha, `hasta` = hoy
- Sin visitas → fallback a 6 meses atrás

**Datos por territorio** (ordenados por número):
- Todas las entradas de `historial/` donde `fechaInicio >= desdeISO`
- Por entrada: fecha inicio → fecha fin · conductor
- Sin actividad en el período: resaltado en amarillo

**Exportación:** botón "📄 Descargar PDF" llama `window.print()`. CSS `@media print` en
`territorios/styles.css` oculta todo excepto `#view-informe` y formatea en A4 con
paleta blanca/negra apta para impresión o guardado como PDF.

**Carga de datos:** N queries individuales a `histCol(id)` (una por territorio del grupo).
Aceptable para grupos típicos de 15–25 territorios en un reporte puntual semestral.

### Formato de territorio en Firestore

```js
{
  id:        1,                        // número con offset para ciudades extra
  nombre:    "Territorio 1",           // display siempre sin offset
  tipo:      "normal" | "peligroso" | "no_predica",
  grupoId:   "3",                      // null si no asignado; siempre "C" para ciudades extra
  punto:     { lat, lng },
  poligonos: [{ coords: [{ lat, lng }, ...] }],
  ciudad:    null | "Ataliva Roca",    // null = ciudad principal
  notas:     null | "Edificio de dptos, timbre en entrada",  // opcional
}
```

### Manzanas por territorio (pendiente — no implementado)

Sub-polígonos numerados dentro de cada territorio.

```
congregaciones/{congreId}/territorios/{terrId}/manzanas/{manzanaId}
  ├── numero: 1
  └── coords: [{lat, lng}, ...]
```

**Plan de implementación:**
1. **Importar de OSM** (Overpass API + `turf.polygonize()`) en `admin.html` — query por polígono del territorio, revisión visual antes de guardar.
2. **Editor manual** con Leaflet.Draw para corregir/dibujar desde cero.
3. **Visualización** en `mapa.html` al zoom ≥ 15, label con número, color diferenciado.

`territorios/app.js` y la estructura del doc de territorio no necesitan cambios — subcolección independiente.
