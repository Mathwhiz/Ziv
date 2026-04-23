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
