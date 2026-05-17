## Módulo de Vida y Ministerio

Módulo para el **presidente de la reunión VM**: importar programa de WOL, asignar partes,
gestionar publicadores por rol VM, sala auxiliar.

**Estado al 2026-05-16:** Fases 1, 2, sala auxiliar, historial Excel, semanas especiales (UI+generador),
PIN VM, navegación, vista mensual, editar títulos, duración visible, export/compartir, visor público,
menú Encargado centrado, filtros en vista Hermanos, Lista de Hermanos en encargado VM, dirty state con aviso de guardado,
**export a Google Sheets + export imagen por mes + papelitos S-89** — todos ✅.
**Fase 4 auto-asignación:** ✅ implementada (colas democráticas por historial completo + restricción de género en ayudantes).

### Visor público (`programa.html`)
Página standalone sin PIN. URL: `vida-ministerio/programa.html?congre=sur&semana=2026-04-07`.
Sin `semana` muestra la semana actual. Navegación ← →, botón compartir copia URL al portapapeles.

Estilo: card con `border: 0.5px solid #2e2e2e; border-radius: 16px; background: #1e2023`.
Secciones dentro de la card separadas por `border-bottom: 0.5px solid #2a2a2a` con radios en primera/última.

`pubFecha` se normaliza siempre a `YYYY-MM-DD` via `parseFechaIso()` antes de cualquier operación
de fecha — evita el bug donde fechas en formato legacy `DD/MM/YYYY` rompían la navegación.

### `parseFechaIso(f)` — utilidad interna en `app.js`

Normaliza cualquier formato de fecha a `YYYY-MM-DD`. Si no puede parsear, retorna `lunesDeHoy()`.

```js
function parseFechaIso(f) {
  if (!f) return lunesDeHoy();
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(f)) {
    const [dd, mm, yyyy] = f.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return lunesDeHoy();
}
```

Usar siempre antes de aritmética de fechas o antes de guardar `pubFecha`.
`fmtDisplay(iso)` también llama `parseFechaIso` internamente como defensa.

### Encargado VM — menú post-PIN

Layout centrado full-height (igual a Asignaciones): título + subtítulo congregación, luego columna
de botones con **`min-width:320px` inline** (no en clase CSS — evita problemas de caché).

- Botón "Programa" → `goToTabsSemanas()` (tabs: Semanas / Generar Semanas)
- Botón "Hermanos" → `goToHermanos()` (lista con filtros de rol y búsqueda)
- Botón "Lista de Hermanos" → `goToListaHermanos()` (CRUD completo, igual al módulo Administrador — ver sección abajo)
- Botón "Cerrar sesión" → `cerrarSesionVM()` (resetea `modoEncargado`, vuelve a cover)

**Importante:** el layout del enc-menu usa `style` inline en el HTML, **no clases CSS**,
porque los cambios de clase no siempre se reflejan si el CSS está cacheado en el browser.

### Vista Hermanos VM

Filtros en la parte superior:
1. **Select de rol** (`#vm-hermanos-rol`) — dropdown con los 11 roles VM
2. **Input de búsqueda** (`#vm-hermanos-search`) — filtra por nombre

Ambos llaman `filtrarHermanosVM()`. `goToHermanos()` los resetea al entrar (vacía el texto, select a "Todos").
La lista renderizada por `renderHermanosVM()` muestra chips de rol por publicador.

### Encargado Sala Auxiliar del mes (`vmMeses`)

Cada mes se designa un anciano como encargado de la sala auxiliar. Se guarda en una subcolección separada:

```
congregaciones/{congreId}/vmMeses/{YYYY-MM}
  └── encargadoSalaAuxId: "pubId"   ← anciano designado ese mes
```

- **Cache en memoria:** `vmMesesCache = {}` — `{ 'YYYY-MM': { encargadoSalaAuxId } }` — se precarga en `cargarSemanas()` para todos los meses visibles.
- **UI:** botón inline en el header de cada mes (solo visible si `tieneAuxiliar`). Muestra el nombre del anciano actual. Abre `uiConductorPicker` con la lista de ancianos activos que no sean presidente en ninguna semana del mes.
- **Restricción:** solo publicadores con rol `ANCIANO` (sin fallback a otros roles). El rol se edita en Administrador → Responsabilidades.
- **Helper:** `vmMesRef(mesISO)` — devuelve la referencia Firestore al doc del mes.

### Export a Google Sheets

Botones inline en el header de cada mes en la vista "Semanas". También hay botón "→ Sheets" en `view-semana` para exportar una semana individual.

**Función `apiFetchVM(payload)`** — fire-and-forget con `mode: 'no-cors'` + `keepalive: true`. No espera respuesta (igual que asignaciones). Muestra toast inmediato; el script corre en background (~5-10s).

**Función `formatSemanaParaSheets(s)`** — convierte un doc semana a filas `[colA, colB, colC]`:
- Headers de semana: `"Semana del DD al DD de Mes de AAAA"`
- Headers de sección: `"Tesoros de la Biblia"`, `"Seamos Mejores Maestros"`, `"Nuestra Vida Cristiana"`
- Sub-header sala: `['', 'Sala Principal', 'Sala Auxiliar']`
- Partes: `["N. X mins. Título", "SP - Ayudante", "SA - Ayudante"]`

**`tools/vm-sheets-script.gs`** — Apps Script que recibe el payload y escribe en Google Sheets con formato:

| Elemento | Color fondo | Texto |
|----------|-------------|-------|
| Título hoja (fila 1) | Verde `#38761D` | Blanco, bold, 14pt |
| Header semana | Verde `#38761D` | Blanco, bold, 12pt, merge A:C |
| Tesoros de la Biblia | Gris `#999999` | Blanco, bold, merge A:C |
| Seamos Mejores Maestros | Dorado `#BF9000` | Blanco, bold, merge A:C |
| Nuestra Vida Cristiana | Rojo `#990000` | Blanco, bold, merge A:C |
| Sub-header sala | Dorado `#BF9000` | Blanco, bold (B y C separados) |

Acciones soportadas: `saveVMMes` (borra y reescribe el mes completo) y `saveVMSemana` (reemplaza una semana buscando por día de inicio, hace `breakApart` antes de manipular filas para no romper con merges previos).

**Reutilización de hojas entre años:** si existe una hoja `"Julio 25"` y se exporta `"Julio 26"`, el script la renombra y la limpia (`sheet.clear()`) en vez de crear una nueva. Mismo mes, distinto año de 2 dígitos.

**Config:** `vmScriptUrl` en `congregaciones/{congreId}/config_privada/modulos`. Se configura en Admin → Congregación. La hoja destino se infiere del mes: `"Mayo 26"`, `"Junio 26"`, etc.

**Importante — re-deploy:** al actualizar el código del Apps Script hay que ir a Implementar → Gestionar implementaciones → lápiz → Nueva versión → Implementar. La URL no cambia.

### S-89 — Papelitos de asignación (✅ implementado)

Genera los formularios S-89 en PDF para distribuir a los hermanos que tienen partes en **Lectura Bíblica** y **Seamos Mejores Maestros** (solo el dueño de casa — no el ayudante).

**Entrada:**
- Botón "S-89" en `view-semana` → `generarS89Semana()` — papelitos de la semana abierta
- Botón "S-89" en el header de mes → `generarS89(mesISO)` — papelitos de todas las semanas del mes

**Qué genera por semana:**
- Lectura Bíblica SP → intervención 3, sala `'principal'`, pubId: `lecturaBiblica.pubId`
- Lectura Bíblica SA (si `tieneAuxiliar`) → intervención 3, sala `'auxiliar'`, pubId: `lecturaBiblica.ayudante` ⚠️ **no** `salaAux.pubId` — ese campo no existe en `lecturaBiblica`
- Ministerio[i] SP → intervención 4+i, sala `'principal'`
- Ministerio[i] SA → intervención 4+i, sala `'auxiliar'` (solo si `salaAux?.pubId` existe)

**Objeto slip:**
```js
{ nombre, ayudante, fecha, intervencion, sala }
// fecha: s89FechaReunion() → lunes+2 (miércoles) o lunes+1 (semana superintendente)
// sala: 'principal' | 'auxiliar'
// intervencion: 3 para Lectura, 4+ para Ministerio
```

**Overlay `#s89-overlay`:**
- Header sticky: título + botón "Imprimir" + botón "✕"
- Botón grande "↓ Descargar todos los S-89" → `s89Descargar()`
- Lista de cards: label (nombre + sala), preview HTML del slip, botones WA e imagen

**Acciones por slip:**
- `s89Whatsapp(idx)` → abre `wa.me` con texto español pre-armado (nombre, ayudante, fecha, intervención, sala)
- `s89Compartir(idx)` → html2canvas sobre `#s89-slip-{idx}` → `navigator.share()` con archivo imagen, o descarga fallback

**Generación PDF (`s89Descargar`):**
- jsPDF 2.5.1 + html2canvas (cargados lazy desde CDN)
- `s89GenerarHtml(slips)` — genera 2 slips por página A4, fuente Times New Roman, checkboxes como `<span>` con borde
- La función inyecta el HTML parseado en el DOM vivo (DOMParser + `adoptNode`) porque html2canvas no captura iframes
- Guarda como `s89-DD-MM-YYYY.pdf`

**Impresión (`s89Imprimir`):**
- Abre nueva pestaña con el mismo HTML + `window.print()` autoejecutado al cargar

**Nota sobre re-uso del S-89 original:**
El PDF `vida-ministerio/S-89_S.pdf` (240.9 × 320.3 pts) está en el repo para referencia.
Se intentó usar como plantilla con `pdf-lib` (resultado pixel-perfect) pero se revirtió.
Si se retoma, las coordenadas exactas de cada campo (extraídas con pdfminer) son:

| Campo | x | y (bottom-left) |
|-------|---|-----------------|
| Nombre | 65 | 265 |
| Ayudante | 73 | 242 |
| Fecha | 53 | 219 |
| Intervención núm. | 138 | 196 |
| Checkbox Sala principal | 30 | 153 |
| Checkbox Sala auxiliar 1 | 30 | 137 |

Ver commit `eef8e84` (luego revertido en `9524adf`) para la implementación completa con pdf-lib 1.17.1.

### Export como imagen del mes

Botón "Img" en el header de cada mes. Usa `html2canvas` para renderizar todas las semanas del mes apiladas en un div off-screen (usando `renderSemanaPublico()`), y descarga como `.jpg`.

### Firestore — doc semana

```js
// vidaministerio/{semanaId}   semanaId = "YYYY-MM-DD" (lunes)
{
  fecha: "2026-03-23",
  cancionApertura: 123, cancionIntermedia: 456, cancionCierre: 789,
  presidente: "pubId", oracionApertura: "pubId", oracionCierre: "pubId",

  tesoros: {
    discurso:       { titulo: "...", duracion: 10, pubId: null },
    joyas:          { titulo: "Perlas escondidas", duracion: 10, pubId: null },
    lecturaBiblica: { titulo: "Lea Hechos 7:1-16 (N min.)", duracion: 4, pubId: null, ayudante: null,
                      salaAux: { pubId: null, ayudante: null } }  // si tieneAuxiliar
  },

  ministerio: [
    { titulo: "...", tipo: "video"|"discurso"|"demostracion", duracion: N,
      pubId: null, ayudante: null,
      salaAux: { pubId: null, ayudante: null } },  // si tieneAuxiliar y tipo != discurso
  ],

  vidaCristiana: [
    { titulo: "...", tipo: "parte"|"estudio_biblico", duracion: N, pubId: null, ayudante: null },
  ],

  tipoEspecial: null | "conmemoracion" | "superintendente" | "asamblea",
  importadoDeWOL: true,
  creadoEn: timestamp
}
```

### Roles VM en publicadores
`VM_PRESIDENTE`, `VM_ORACION`, `VM_TESOROS`, `VM_JOYAS`, `VM_LECTURA`,
`VM_MINISTERIO_CONVERSACION`, `VM_MINISTERIO_REVISITA`, `VM_MINISTERIO_ESCENIFICACION`,
`VM_MINISTERIO_DISCURSO`, `VM_VIDA_CRISTIANA`, `VM_ESTUDIO_CONDUCTOR`

**Restricciones de género y privilegio** (aplicadas en la UI de Lista de Hermanos):

| Condición | Roles disponibles |
|-----------|-------------------|
| Mujer | Solo `VM_MINISTERIO_CONVERSACION`, `VM_MINISTERIO_REVISITA`, `VM_MINISTERIO_ESCENIFICACION`. Sin roles de Asignaciones. |
| Varón sin privilegio (sin `ANCIANO` ni `SIERVO_MINISTERIAL`) | `VM_LECTURA` + los tres ministerio de mujer. |
| Varón anciano o siervo ministerial | Todos los roles VM + todos los de Asignaciones. |

La visibilidad de checkboxes se actualiza en `_lhActualizarRolesSegunSexo()` llamada al abrir el modal y al cambiar el botón de sexo. El estado de privilegio (`_lhModalPrivilegiado`) se lee de `h.roles` al abrir; no cambia dentro del modal (se gestiona desde Administrador).

### Lista de Hermanos en VM (`#view-lista-hermanos`)

CRUD completo de publicadores accesible desde el menú del encargado VM, con la misma funcionalidad que el módulo Administrador. Usa el mismo array `publicadores` ya cargado en memoria.

**Funciones globales:** `goToListaHermanos`, `filtrarListaHermanosVM`, `abrirEditarVM`, `abrirNuevoVM`, `cerrarModalHermanoVM`, `guardarHermanoVM`, `confirmarEliminarVM`, `toggleSexoVM`, `selectSexoVM`, `navHermanoVM`

**Estado interno:** `_lhListaVisible`, `_lhEditandoId`, `_lhModalSexo`, `_lhModalPrivilegiado`

**Modal `#modal-hermano-vm`:** nombre, sexo (H/M), roles VM en grid 2 col, sección `#lh-seccion-asign` con roles de Asignaciones (oculta para mujeres), navegación prev/next entre hermanos, botón eliminar.

### Aviso de cambios sin guardar (dirty state)

`_semanaModificada` (boolean) se activa con cualquier cambio en la semana abierta.

| Evento que activa | Función |
|-------------------|---------|
| Asignar/quitar hermano | `setSlotPubId` |
| Editar título, canción, instrucción | `onTituloChange`, `onInstruccionChange` |
| Agregar/quitar parte | `agregarParte`, `quitarParte` |
| Auto-asignar | `autocompletarHermanos` |
| Importar WOL | `reimportarDeWOL` → `aplicarWOLaSemana` |

Al navegar (`navSemana`, `goToSemanas`, `goToMenuEnc`) se llama `_confirmarSiModificada()`: muestra `uiConfirm` con opciones "Guardar" y "Descartar". El botón Guardar muestra un asterisco (`"Guardar *"`) como indicador visual mientras hay cambios pendientes. Al guardar o cargar una semana nueva, el flag se resetea.

### Importación WOL (✅)
URL: `https://wol.jw.org/es/wol/dt/r4/lp-s/{año}/{mes}/{día}` via Cloudflare Worker propio.
Parser usa `h3/h4` numerados — **no usar IDs `#pN`** (varían cada semana).
- Títulos en `h3/h4` con texto `"N. Título..."`. Tesoros: siempre los primeros 3 `h3` numerados.
- Frontera Ministerio/VC: `h3` con texto exactamente `"Canción N"`.
- Duración: primer `"(X mins.)"` después del `h3` correspondiente.

### Detección de tipo de parte ministerio

```js
function tipoMinisterioDesdeWOL(titulo, instruccion) {
  const t = (titulo + ' ' + (instruccion || '')).toLowerCase();
  if (t.includes('conversación') || t.includes('conversacion')) return 'conversacion';
  if (t.includes('revisita'))      return 'revisita';
  if (t.includes('escenificación') || t.includes('escenificacion')) return 'escenificacion';
  if (t.includes('discurso'))      return 'discurso'; // varón anciano/SM, sin ayudante
  return 'conversacion';
}
// tipo === 'discurso' → sin ayudante. Los demás → tienen ayudante.
// Se pasa también `instruccion` (texto de instrucción de WOL) porque la palabra "Discurso"
// puede aparecer ahí y no en el h3 del título.
```

### Semanas especiales (`tipoEspecial`)

| Valor | Efecto |
|-------|--------|
| `"conmemoracion"` | Entre semana: no hay reunión VM. No generar roles VM/entre semana. |
| `"superintendente"` | Reunión pasa de miércoles a martes. Estudio reemplazado por discurso del sup. Finde sin lector. |
| `"asamblea"` | No hay ninguna reunión esa semana. No generar nada. |

### Fase 4 — Auto-asignación VM (✅ implementada)

**Dónde está el código:** bloque `// AUTO-ASIGNACIÓN VM (Fase 4)` en `vida-ministerio/app.js`,
justo antes de `window.autocompletarHermanos`.

#### Funciones (todas en `app.js`)

| Función | Qué hace |
|---------|----------|
| `construirSlotsOrdenados(semana)` | Retorna `[{key, rolRequerido, esAyudante?, esSalaAux?}]` en orden canónico para una semana dada |
| `getSlotPubIdFromSemana(semana, key)` | Lee un pubId de un objeto semana arbitrario (mismo switch que `getSlotPubId` pero sin usar el global) |
| `setSlotPubIdOnSemana(semana, key, pubId)` | Escribe un pubId en un objeto semana arbitrario (mismo switch que `setSlotPubId` pero sin usar el global) |
| `calcularColasVM()` | Lee todo `semanasLista` (historial completo, orden asc) y retorna `{rolId: [pubId, ...]}` ordenado por "menos usado recientemente" — democrático real |
| `autoAsignarSemana(semana, colas, {soloVacios})` | Loop principal. Modifica `semana` in-place, `colas` se actualiza in-place para generación masiva. Opción `soloVacios` respeta slots ya asignados. |
| `debeSkipAutoAsignar(fecha)` | Retorna `true` si la semana debe saltarse: `asamblea` siempre, `conmemoracion` solo si es entre semana |
| `sexoDePub(pubId)` | Retorna `'H'`, `'M'` o `null` leyendo `publicadores` en memoria |

#### Orden de slots en `construirSlotsOrdenados`

1. `presidente` → `VM_PRESIDENTE`
2. `oracionApertura` → `VM_ORACION`
3. `oracionCierre` → `VM_ORACION`
4. `tesoros.discurso` → `VM_TESOROS`
5. `tesoros.joyas` → `VM_JOYAS`
6. `tesoros.lecturaBiblica` → `VM_LECTURA`
7. (si `tieneAuxiliar`) `tesoros.lecturaBiblica.ayudante`
8. Por cada `ministerio[i]`: pubId + ayudante (si tipo ≠ discurso) + salaAux pair (si `tieneAuxiliar`)
9. Por cada `vidaCristiana[i]`: pubId → `VM_VIDA_CRISTIANA`
10. `estudio.conductor` → `VM_ESTUDIO_CONDUCTOR`

#### Reglas manejadas por `enEstaSemana Set`

- `VM_ORACION` apertura ≠ cierre (mismo rol, el segundo saltea al primero automáticamente)
- Presidente ≠ oración (presidente se asigna primero; ya está en el Set cuando llegan las oraciones)
- Sala auxiliar ≠ sala principal (el pubId de salaAux va después del principal)
- **Ayudante mismo sexo que principal**: antes de asignar un slot `esAyudante`, se lee el sexo del principal con `sexoDePub()` y se filtra la cola para que coincida. Si no hay nadie del mismo sexo disponible, el slot queda en `null`.

#### Invariante anti-loop

El `while` del diseño original se reemplazó por `for (intentos < lista.length + 1)` — si todos
están en `enEstaSemana`, deja el slot en `null` y avanza el índice. Evita loop infinito con listas de 1 persona.

#### Colas: sin persistencia separada

Las colas **no se guardan en Firestore**. Se recalculan siempre desde `semanasLista` (historial completo en memoria).
En generación masiva, `colasAA` se calcula una vez antes del loop y se pasa mutable a cada llamada de `autoAsignarSemana`, acumulando el avance semana a semana.

#### Entrada al usuario

- **Botón "✦ Auto"** en `view-semana` → `autocompletarHermanos()` → pide confirmación (`uiConfirm purple`), luego `calcularColasVM()` + `autoAsignarSemana(semanaData, colas, { soloVacios: true })` + `renderSemanaEdit()`. **No guarda automáticamente** — el encargado revisa y presiona "Guardar".
- **Checkbox `#nueva-auto-asignar`** en tab "Generar Semanas" → al generar N semanas, si está activo y la semana no debe saltarse, llama `autoAsignarSemana(semanaData, colasAA)` antes del `setDoc`.

#### Para modificar en el futuro

- **Cambiar orden de prioridad de slots:** editar el orden en `construirSlotsOrdenados`.
- **Agregar regla de exclusión** (ej: una persona no puede ser presidente Y conductor en la misma semana): sumar la restricción dentro del `for (intentos...)` en `autoAsignarSemana` — el `enEstaSemana` Set ya maneja el caso más común.
- **Opción "no sobreescribir slots ya asignados":** en `autoAsignarSemana`, antes de asignar, chequear `getSlotPubIdFromSemana(semana, slot.key)` y saltear si no es null.
- **Persistir índices entre sesiones:** guardar `indicesAA` en `congregaciones/{id}` campo `vmIndicesRondas` y leerlo al init. Actualmente se recalcula desde historial (más robusto).
