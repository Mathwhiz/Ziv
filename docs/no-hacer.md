## Lo que NO hacer

- No eliminar la integración con Apps Script del módulo de asignaciones
- No hardcodear polígonos de territorios en HTML/JS
- No usar `toISOString()` para fechas (bug UTC-3)
- No commitear `tools/serviceAccountKey.json` ni archivos `.xlsx`
- No fetchear el KML de Google My Maps en runtime (CORS)
- No usar `confirm()`, `alert()`, `prompt()` nativos — usar `uiConfirm`, `uiAlert`, `uiToast`
- No setear `.value` en inputs upgradeados sin disparar el evento `change`
- **No usar IDs de párrafo WOL (`#p6`, `#p7`, etc.)** — varían cada semana
- No usar `style.background` para el estado **deseleccionado** de `.grupo-btn` — limpiar el inline style para que CSS del tema lo maneje
- No llamar `showView('view-encargado')` directamente en asignaciones — usar `goToEncargado()` (también recarga especiales)
- No llamar `window.signOutUser()` directamente desde UI — usar `window.sessionSignOut()` (limpia localStorage + sessionStorage + Firebase)
- No modificar permisos inline en el código — editar solo `shared/auth-config.js` (`PERMISOS`)
- No hacer `initializeApp()` más de una vez — `shared/firebase.js` ya lo hace; importar `{ db, auth }` desde ahí
- No usar `_user.appRol` (string) para verificar permisos — usar `hasPermission()` o leer `_user.appRoles` (array). `appRol` es solo backward compat.
- No agregar `pageshow → window.location.reload()` en módulos — rompe bfcache y causa reloads lentos innecesarios
- No guardar el rol en Firestore sin actualizar ambos campos: `appRol` (primer elemento, compat) y `appRoles` (array completo)
- No usar `querySelector('[style*="texto"]')` para buscar elementos por su contenido de texto — el atributo `style` contiene CSS, no texto. Siempre usar `id` o una clase semántica
- No cambiar `appRol: 'pendiente'` al crear un usuario con `sin_match` — `sin_match` debe dar `'publicador'` (acceso base). Solo `matchEstado: 'pendiente'` (ambiguo) justifica bloquear el acceso hasta que el admin confirme
- No usar el evento `authStateChanged` como mecanismo primario de render en páginas que usan `waitForAuth()` — el evento puede perderse si llega antes de que el listener esté registrado; `waitForAuth()` es siempre más fiable
- No usar `calcularIndicesVM()` en VM — fue reemplazado por `calcularColasVM()` que es democrático (ordena por última fecha asignada en historial completo, no solo por índice de ronda)
- No asignar ayudante de sexo distinto al principal en VM — `autoAsignarSemana` lo evita filtrando la cola por `sexoDePub()`; si se edita manualmente, respetar la misma regla
- No omitir `_marcarModificada()` en funciones que muten `semanaData` en VM — el dirty state del botón Guardar depende de que se llame en todos los puntos de mutación
- No usar `daysColor()` en territorios — fue reemplazado por `daysClass()` (clases CSS `days-ok/days-warn/days-bad`) con umbrales <30/≤60/>60
- No usar `.info-btn` / `.info-grid` en `view-info` — reemplazados por `.va-terr` / `.va-grid`; el modal ya no usa `.estado-modal-card` ni `.estado-opt` — es bottom sheet con `.modal-sheet` y `.modal-estado-btn`
- No llamar `closeModal()` esperando que `modalTerr` sea `null` inmediatamente — el reset ocurre 300ms después (animación); capturar `const n = modalTerr` antes si se necesita el valor
- No leer `lecturaBiblica.salaAux.pubId` para el conductor SA de la lectura — ese campo no existe en ese nivel. Cuando `tieneAuxiliar=true`, el pubId del conductor SA de lectura se guarda en `lecturaBiblica.ayudante` (mismo campo que el ayudante normal pero repropósito). Ver `s89SlipsDeSemana` y `renderSemanaPublico`.

### Estilos — NO hacer (ver `docs/UI-STYLE.md` para el sistema completo)
- No usar Inter, Geist ni Google Fonts — el proyecto usa `system-ui`
- No usar el estilo flat shadcn/oklch (explorado en `test-ui.html` y descartado)
- No agregar sombras grandes ni efectos glassmorphism
- No reinventar modales — usar los de `shared/ui-utils.js`
- No hardcodear colores distintos a los tokens definidos en `docs/UI-STYLE.md`
