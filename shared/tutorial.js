// ════════════════════════════════════════════════════════════════════
// Tutorial de Ziv (lo usa index.html, en el menú de módulos)
//
// Dos momentos:
//   1) Cuenta pendiente  → tarjetas a pantalla completa (ZivTutorial.pendiente)
//   2) Cuenta aprobada   → recorrido sobre las tarjetas del menú que esa
//      persona ve, según sus responsabilidades (ZivTutorial.recorrido)
//
// Qué ya se mostró se guarda como lista de claves ('pendiente', ids de tarjetas):
// en localStorage y en usuarios/{uid}.tutorialVisto. Si después le suman una
// responsabilidad, el recorrido muestra solo las tarjetas nuevas.
// ════════════════════════════════════════════════════════════════════
(function () {
  const DESTELLO = 'M0-1Q.16-.16 1 0Q.16 .16 0 1Q-.16 .16-1 0Q-.16-.16 0-1Z';

  const CSS = `
  .zt-capa { position: fixed; inset: 0; z-index: 2147483000; font-family: system-ui, sans-serif; }
  /* ── Tarjetas (pendiente) ── */
  .zt-cards { background: var(--bg-primary, #1a1c1f); color: var(--text-primary, #e8e8e8); display: flex; flex-direction: column;
    padding: max(18px, env(safe-area-inset-top)) 22px max(22px, env(safe-area-inset-bottom)); animation: zt-in .35s ease both; }
  .zt-cards-in { width: 100%; max-width: 420px; margin: 0 auto; flex: 1; display: flex; flex-direction: column; }
  .zt-skip { align-self: flex-end; background: none; border: 0; color: inherit; opacity: .6; font: inherit; font-size: 14px; padding: 8px; cursor: pointer; }
  .zt-track { flex: 1; position: relative; }
  .zt-step { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    opacity: 0; transform: translateX(30px); transition: opacity .35s, transform .45s cubic-bezier(.22,1,.36,1); pointer-events: none; }
  .zt-step.on { opacity: 1; transform: none; pointer-events: auto; }
  .zt-step.out { transform: translateX(-30px); }
  .zt-ill { min-height: 190px; margin-bottom: 26px; display: grid; place-items: center; }
  .zt-step h2 { font-size: 23px; margin: 0 0 10px; letter-spacing: -.01em; }
  .zt-step p { font-size: 15px; line-height: 1.5; color: var(--text-secondary, #aaa); margin: 0; max-width: 300px; }
  .zt-dots { display: flex; justify-content: center; gap: 6px; margin: 14px 0 18px; }
  .zt-dots i { width: 7px; height: 7px; border-radius: 99px; background: currentColor; opacity: .25; transition: width .3s, opacity .3s; }
  .zt-dots i.on { width: 22px; opacity: 1; background: var(--accent, #7F77DD); }
  .zt-nav { display: flex; gap: 10px; }
  .zt-nav button { flex: 1; border-radius: 14px; padding: 15px; font: inherit; font-weight: 700; font-size: 15px; border: 0; cursor: pointer; }
  .zt-nav .zt-prev { flex: 0 0 auto; padding: 15px 20px; background: var(--bg-card, #232628); color: inherit; }
  .zt-nav .zt-next { background: var(--accent, #7F77DD); color: #fff; }
  .zt-logo { width: 110px; height: 110px; }
  .zt-mini { background: var(--bg-card, #232628); border: 1px solid var(--border-primary, #2e3033); border-radius: 16px; padding: 12px; width: 210px; text-align: left; }
  .zt-mini-row { display: flex; align-items: center; gap: 8px; padding: 7px 6px; font-size: 13px; opacity: .4; }
  .zt-mini-sq { width: 22px; height: 22px; border-radius: 7px; flex: none; }
  .zt-mini-row span:last-child { margin-left: auto; font-size: 11px; }
  .zt-espera { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(242,184,75,.16);
    color: #e3a634; font-size: 13px; font-weight: 650; margin-top: 12px; }
  body.light-mode .zt-espera { color: #9a6a0c; }
  .zt-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px 6px 6px; border-radius: 999px; background: var(--bg-card, #232628);
    border: 1px solid var(--border-primary, #2e3033); font-size: 13px; }
  .zt-chip i { width: 26px; height: 26px; border-radius: 50%; background: #5B8DDE; color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700; font-style: normal; }
  .zt-chipmenu { margin-top: 10px; background: var(--bg-card, #232628); border: 1px solid var(--border-primary, #2e3033); border-radius: 14px; padding: 8px; width: 200px; text-align: left; font-size: 13px; }
  .zt-chipmenu div { padding: 7px 8px; border-radius: 8px; display: flex; justify-content: space-between; }
  .zt-chipmenu .hl { background: rgba(127,119,221,.18); }
  .zt-cel { width: 120px; height: 180px; border-radius: 22px; border: 3px solid var(--border-primary, #2e3033); display: grid; grid-template-columns: repeat(3, 1fr);
    gap: 10px; padding: 18px 12px; align-content: start; }
  .zt-cel span { aspect-ratio: 1; border-radius: 8px; background: var(--border-primary, #2e3033); }
  .zt-cel img { width: 100%; aspect-ratio: 1; border-radius: 8px; box-shadow: 0 0 0 3px #F2B84B; }
  /* ── Recorrido sobre el menú ── */
  .zt-tour { pointer-events: auto; }
  .zt-spot { position: fixed; border-radius: 18px; box-shadow: 0 0 0 9999px rgba(8,9,11,.74); transition: all .45s cubic-bezier(.22,1,.36,1); pointer-events: none; }
  .zt-spot.centro { left: 50% !important; top: 42% !important; width: 0 !important; height: 0 !important; }
  .zt-tip { position: fixed; z-index: 1; width: min(360px, calc(100vw - 32px)); background: #fff; color: #1d1e22; border-radius: 16px; padding: 14px 16px;
    font-size: 14px; line-height: 1.45; box-shadow: 0 10px 30px rgba(0,0,0,.25); transition: top .45s cubic-bezier(.22,1,.36,1), left .45s cubic-bezier(.22,1,.36,1), opacity .3s; }
  .zt-tip b { display: block; font-size: 15px; margin-bottom: 4px; }
  .zt-tip-row { display: flex; align-items: center; justify-content: space-between; margin-top: 12px; gap: 8px; }
  .zt-tip-row span { font-size: 12px; color: #777; }
  .zt-tip button { border: 0; background: #6a61d6; color: #fff; border-radius: 10px; padding: 9px 15px; font: inherit; font-weight: 700; font-size: 13px; cursor: pointer; }
  .zt-tip .zt-sec { background: none; color: #777; font-weight: 500; padding: 9px 6px; }
  .zt-tip.grande { text-align: center; padding: 22px 18px 16px; }
  .zt-tip.grande b { font-size: 19px; margin-bottom: 6px; }
  .zt-tip.grande .zt-tip-row { justify-content: center; }
  .zt-fiesta { font-size: 34px; display: block; margin-bottom: 6px; }
  @keyframes zt-in { from { opacity: 0; } to { opacity: 1; } }
  @media (prefers-reduced-motion: reduce) { .zt-step, .zt-spot, .zt-tip { transition: none; } }
  `;

  function css() {
    if (document.getElementById('zt-css')) return;
    const st = document.createElement('style');
    st.id = 'zt-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // La capa va en <html> y no en <body>: el body tiene zoom (--ziv-z) y correría las posiciones
  function capa(clase) {
    css();
    const el = document.createElement('div');
    el.className = 'zt-capa ' + clase;
    document.documentElement.appendChild(el);
    return el;
  }

  const txt = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // sim = perfil simulado del modo de prueba (solo localhost, ver más abajo)
  let sim = null;
  const roles = () => { if (sim) return sim.roles; const u = window.currentUser; return u ? (u.appRoles || (u.appRol ? [u.appRol] : [])) : []; };
  const tieneRol = (...rs) => roles().some(r => rs.includes(r));
  const puede = p => sim ? sim.permisos.has(p) : !!window.hasPermission?.(p);
  const primerNombre = () => (window.currentUser?.displayName || (sim ? 'Juan' : '')).trim().split(/\s+/)[0] || '';
  const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  // ── Qué ya se vio ────────────────────────────────────────────────
  const claveLS = () => 'ziv_tutorial_' + (window.currentUser?.uid || 'x');
  // let (no function): el modo de prueba lo reemplaza un momento para simular «ya vio todo menos X»
  let visto = function () {
    if (sim) return new Set();   // en prueba siempre arranca de cero
    const s = new Set(window.currentUser?.tutorialVisto || []);
    try { JSON.parse(localStorage.getItem(claveLS()) || '[]').forEach(k => s.add(k)); } catch {}
    return s;
  }
  function marcar(claves) {
    if (sim) return;             // en prueba no se guarda nada
    const s = visto();
    claves.forEach(k => s.add(k));
    const lista = [...s];
    try { localStorage.setItem(claveLS(), JSON.stringify(lista)); } catch {}
    // En Firestore es para que no se repita en otro dispositivo; si falla, alcanza con localStorage
    window.updateUserProfile?.({ tutorialVisto: lista }).catch(err => console.warn('[tutorial] no se guardó en el perfil:', err?.code || err));
  }

  // ══════════════ 1) Pendiente: tarjetas ══════════════
  function pendiente() {
    return new Promise(resolve => {
      const pasos = [
        { t: `¡Bienvenido${primerNombre() ? ', ' + txt(primerNombre()) : ''}!`,
          p: 'Veamos qué podés hacer con la aplicación.',
          ill: '<img class="zt-logo" src="/assets/favicon.svg" alt="">' },
        { t: 'Tu cuenta está en revisión',
          p: 'Un encargado de la congregación tiene que aprobarla. Cuando lo haga, vas a ver acá todo lo que te corresponde.',
          ill: `<div style="text-align:center"><div class="zt-mini">
            <div class="zt-mini-row"><span class="zt-mini-sq" style="background:#5B8DDE"></span>Asignaciones<span>🔒</span></div>
            <div class="zt-mini-row"><span class="zt-mini-sq" style="background:#EF9F27"></span>Vida y Ministerio<span>🔒</span></div>
            <div class="zt-mini-row"><span class="zt-mini-sq" style="background:#E05277"></span>Predicación<span>🔒</span></div></div>
            <span class="zt-espera">⏳ Esperando aprobación</span></div>` },
        { t: 'Tu menú personal',
          p: 'Arriba a la derecha está tu nombre: ahí cambiás el tamaño de la letra, el tema claro u oscuro y tu perfil.',
          ill: `<div style="display:flex;flex-direction:column;align-items:flex-end;width:210px">
            <span class="zt-chip"><i>${txt((primerNombre()[0] || '?').toUpperCase())}</i>${txt(primerNombre() || 'Vos')}</span>
            <div class="zt-chipmenu"><div class="hl"><span>Tamaño</span><span>A− 100% A+</span></div><div class="hl"><span>Tema</span><span>☾</span></div><div><span>Ver perfil</span></div></div></div>` },
      ];
      if (!instalada()) {
        const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
        pasos.push({ t: 'Tenela a mano',
          p: ios ? 'Instalala como app: tocá el botón compartir y después «Agregar a inicio».'
                 : 'Instalala como app: en el menú ⋮ del navegador, tocá «Instalar app» o «Agregar a la pantalla principal».',
          ill: `<div class="zt-cel">${'<span></span>'.repeat(5)}<img src="/assets/favicon.svg" alt=""></div>` });
      }

      const el = capa('zt-cards');
      el.setAttribute('role', 'dialog');
      el.setAttribute('aria-modal', 'true');
      let i = 0;
      const cerrar = () => { marcar(['pendiente']); el.remove(); document.removeEventListener('keydown', teclas); resolve(); };
      const teclas = e => { if (e.key === 'Escape') cerrar(); if (e.key === 'ArrowRight') ir(i + 1); if (e.key === 'ArrowLeft') ir(i - 1); };
      function ir(n) {
        if (n >= pasos.length) return cerrar();
        i = Math.max(0, n);
        const ult = i === pasos.length - 1;
        el.innerHTML = `<div class="zt-cards-in">
          <button class="zt-skip" style="visibility:${ult ? 'hidden' : 'visible'}">Saltear</button>
          <div class="zt-track">${pasos.map((s, k) => `
            <div class="zt-step ${k === i ? 'on' : k < i ? 'out' : ''}" ${k === i ? '' : 'aria-hidden="true"'}>
              <div class="zt-ill">${s.ill}</div><h2>${s.t}</h2><p>${s.p}</p></div>`).join('')}</div>
          <div class="zt-dots">${pasos.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
          <div class="zt-nav">
            ${i > 0 ? '<button class="zt-prev" aria-label="Anterior">←</button>' : ''}
            <button class="zt-next">${ult ? 'Entendido' : 'Siguiente'}</button>
          </div></div>`;
        el.querySelector('.zt-skip').onclick = cerrar;
        el.querySelector('.zt-next').onclick = () => ir(i + 1);
        const prev = el.querySelector('.zt-prev');
        if (prev) prev.onclick = () => ir(i - 1);
        el.querySelector('.zt-next').focus({ preventScroll: true });
      }
      document.addEventListener('keydown', teclas);
      ir(0);
    });
  }

  // ══════════════ 2) Aprobado: recorrido sobre el menú ══════════════
  // Tarjetas de index.html en el orden en que aparecen. txt() decide el texto según las responsabilidades.
  const TARJETAS = [
    { sel: '#menu-card-terr', n: 'Territorios',
      txt: () => 'Planificás las salidas del grupo, registrás qué territorios se trabajaron y ves cuánto hace que no se predica cada uno.' },
    { sel: '.cs-nav-card-map', id: 'mapa', n: 'Ver mapa',
      txt: () => 'El mapa con todos los territorios de la congregación. Lo podés compartir: no muestra ningún dato.' },
    { sel: '#menu-card-asign', n: 'Asignaciones',
      txt: () => tieneRol('admin_general', 'admin_congre', 'encargado_asignaciones', 'encargado_vm')
        ? 'Armás el programa de lector, sonido, micrófonos y acomodadores. También lo podés generar automático.'
        : 'Buscás tu nombre y ves qué te toca en las próximas reuniones.' },
    { sel: '#menu-card-herm', n: 'Administrador',
      txt: () => 'La lista de hermanos con sus responsabilidades, los grupos y las semanas especiales.' },
    { sel: '#menu-card-vm', n: 'Vida y Ministerio',
      txt: () => tieneRol('admin_general', 'admin_congre', 'encargado_vm')
        ? 'Importás el programa de la semana, asignás las partes y sacás los papelitos S-89.'
        : 'El programa de la reunión de entre semana, con quién tiene cada parte.' },
    { sel: '.cs-nav-card-pred', id: 'pred', n: 'Predicación',
      txt: () => tieneRol('precursor_regular', 'precursor_auxiliar')
        ? 'Tu cronómetro y tus horas. Como precursor, ves cuánto te falta para la meta del mes y del año.'
        : 'Tu cronómetro, horas del mes, revisitas y estudios. Lo ves solo vos.' },
    { sel: '#menu-card-tel', n: 'Telefónica',
      txt: () => 'Los territorios de predicación telefónica de cada grupo.' },
    { sel: '#menu-card-edif', n: 'Edificios',
      txt: () => puede('administrar_edificios')
        ? 'Abrís el portero y marcás qué timbres tocaste. Además, asignás quién es responsable de cada edificio.'
        : 'Abrís el portero de un edificio y marcás qué timbres tocaste.' },
    { sel: '#menu-card-conf', n: 'Conferencias',
      txt: () => puede('editar_conferencias')
        ? 'Los discursos de cada sábado: quién viene y a qué congregación salen los oradores de acá. Los podés cargar y editar.'
        : 'Los discursos de cada sábado: quién viene y a qué congregación salen los oradores de acá.' },
    { sel: '#menu-card-admin', n: 'Super Admin',
      txt: () => 'El panel de todas las congregaciones y de los usuarios.' },
  ];
  const claveDe = t => t.id || t.sel.replace('#menu-card-', '');
  const visible = el => !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none';

  function tarjetasVisibles() {
    return TARJETAS.map(t => ({ ...t, clave: claveDe(t), el: document.querySelector(t.sel) })).filter(t => visible(t.el));
  }

  function recorrido({ todo = false } = {}) {
    const vistas = visto();
    const tarjetas = tarjetasVisibles();
    const primeraVez = todo || !tarjetas.some(t => vistas.has(t.clave));
    const mostrar = primeraVez ? tarjetas : tarjetas.filter(t => !vistas.has(t.clave));
    if (!mostrar.length) return Promise.resolve();

    const pasos = [
      primeraVez
        ? { centro: true, fiesta: '🎉', t: '¡Ya tenés acceso!', p: 'Veamos qué podés hacer con la aplicación.' }
        : { centro: true, fiesta: '✨', t: 'Tenés algo nuevo', p: mostrar.length === 1 ? 'Ahora también podés usar una parte más.' : `Ahora también podés usar ${mostrar.length} partes más.` },
      ...mostrar.map(t => ({ el: t.el, t: t.n, p: t.txt() })),
    ];
    const chip = document.getElementById('ziv-sBtn') || document.getElementById('ziv-session');
    if (primeraVez && visible(chip)) pasos.push({ el: chip, t: 'Tu menú', p: 'Tamaño de letra, tema claro u oscuro, tu perfil… y este recorrido, si lo querés ver de nuevo.' });

    return new Promise(resolve => {
      const el = capa('zt-tour');
      el.innerHTML = '<div class="zt-spot"></div><div class="zt-tip" role="dialog" aria-live="polite"></div>';
      const spot = el.querySelector('.zt-spot'), tip = el.querySelector('.zt-tip');
      const total = pasos.length - 1;
      let i = 0;
      const cerrar = () => {
        marcar(['pendiente', ...tarjetas.map(t => t.clave)]);
        el.remove();
        document.removeEventListener('keydown', teclas);
        window.removeEventListener('resize', reubicar);
        resolve();
      };
      const teclas = e => { if (e.key === 'Escape') cerrar(); if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); ir(i + 1); } };
      const reubicar = () => ir(i, true);

      function ir(n, sinScroll) {
        if (n >= pasos.length) return cerrar();
        i = n;
        const paso = pasos[i];
        tip.classList.toggle('grande', !!paso.centro);
        if (paso.centro) {
          spot.classList.add('centro');
          tip.innerHTML = `<span class="zt-fiesta">${paso.fiesta}</span><b>${paso.t}</b>${paso.p}
            <div class="zt-tip-row"><button class="zt-sec" data-a="cerrar">Ahora no</button><button data-a="sig">Empezar</button></div>`;
          tip.style.left = `calc(50vw - ${tip.offsetWidth / 2}px)`;
          tip.style.top = `calc(42vh - ${tip.offsetHeight / 2}px)`;
        } else {
          spot.classList.remove('centro');
          if (!sinScroll) paso.el.scrollIntoView({ block: 'center', behavior: 'instant' });
          tip.innerHTML = `<b>${txt(paso.t)}</b>${txt(paso.p)}
            <div class="zt-tip-row"><span>${i} de ${total}</span><div>
              ${i < total ? '<button class="zt-sec" data-a="cerrar">Saltear</button>' : ''}
              <button data-a="sig">${i === total ? 'Listo' : 'Siguiente'}</button></div></div>`;
          const r = paso.el.getBoundingClientRect(), pad = 6;
          Object.assign(spot.style, { left: (r.left - pad) + 'px', top: (r.top - pad) + 'px', width: (r.width + pad * 2) + 'px', height: (r.height + pad * 2) + 'px' });
          const w = tip.offsetWidth, h = tip.offsetHeight;
          const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), innerWidth - w - 16);
          const abajo = r.bottom + pad + 12;
          tip.style.left = left + 'px';
          tip.style.top = (abajo + h < innerHeight - 12 ? abajo : Math.max(12, r.top - pad - 12 - h)) + 'px';
        }
        tip.querySelector('[data-a="sig"]').onclick = () => ir(i + 1);
        const c = tip.querySelector('[data-a="cerrar"]');
        if (c) c.onclick = cerrar;
        tip.querySelector('[data-a="sig"]').focus({ preventScroll: true });
      }
      document.addEventListener('keydown', teclas);
      window.addEventListener('resize', reubicar);
      ir(0);
    });
  }

  // ══════════════ Modo de prueba (solo en la PC: localhost / 127.0.0.1) ══════════════
  // Abrir /?probar#menu → barra abajo para elegir una responsabilidad: arma el menú como lo vería
  // esa persona y corre su tutorial. No escribe nada (ni localStorage ni Firestore).
  const PERFILES_PRUEBA = [
    { id: 'pendiente', label: 'Pendiente', roles: ['pendiente'] },
    { id: 'publicador', label: 'Publicador', roles: ['publicador'] },
    { id: 'hermana', label: 'Hermana', roles: ['publicador'], hermana: true },
    { id: 'precursor', label: 'Precursor', roles: ['precursor_regular'] },
    { id: 'anciano', label: 'Anciano / SM', roles: ['anciano'] },
    { id: 'grupo', label: 'Enc. de grupo', roles: ['publicador', 'encargado_grupo'] },
    { id: 'asig', label: 'Enc. asignaciones', roles: ['publicador', 'encargado_asignaciones'] },
    { id: 'vm', label: 'Enc. VM', roles: ['anciano', 'encargado_vm'] },
    { id: 'conf', label: 'Enc. conferencias', roles: ['anciano', 'encargado_conferencias'] },
    { id: 'edif', label: 'Enc. edificios', roles: ['publicador', 'encargado_edificios'] },
    { id: 'admin', label: 'Admin congregación', roles: ['admin_congre'] },
  ];
  const TARJETA_PERMISO = { terr: 'acceso_territorios', asign: 'acceso_asignaciones', herm: 'acceso_hermanos', vm: 'acceso_vm',
    conf: 'acceso_conferencias', tel: 'acceso_telefonica', edif: 'acceso_edificios', admin: 'acceso_admin' };
  // Responsabilidad que agrega cada tarjeta en «Tenés algo nuevo»
  const ROL_DE_TARJETA = { terr: 'encargado_grupo', herm: 'encargado_asignaciones', conf: 'encargado_conferencias' };

  async function probar(pf, { nuevo } = {}) {
    const { PERMISOS } = await import('/shared/auth-config.js');
    sim = { roles: pf.roles, permisos: new Set(pf.roles.flatMap(r => PERMISOS[r] || [])) };
    // Mostrar el menú aunque no haya sesión
    document.querySelectorAll('.view').forEach(v => { if (v.id !== 'view-menu') v.style.display = 'none'; });
    const menu = document.getElementById('view-menu');
    if (menu) menu.style.display = 'flex';
    document.body.dataset.view = 'view-menu';
    // Tarjetas como las dejaría syncMenuCards() para esos roles (las hermanas no ven Territorios/Asignaciones/Administrador)
    Object.entries(TARJETA_PERMISO).forEach(([k, perm]) => {
      const el = document.getElementById('menu-card-' + k);
      if (el) el.style.display = sim.permisos.has(perm) && !(pf.hermana && ['terr', 'asign', 'herm'].includes(k)) ? '' : 'none';
    });
    const pend = pf.roles.includes('pendiente');
    const aviso = document.getElementById('menu-pendiente');
    if (aviso) aviso.style.display = pend ? '' : 'none';
    document.querySelectorAll('.zt-capa.zt-cards, .zt-capa.zt-tour').forEach(e => e.remove());
    scrollTo(0, 0);
    await new Promise(r => setTimeout(r, 150));
    if (pend) return pendiente();
    if (!nuevo) return recorrido({ todo: true });
    // «Tenés algo nuevo»: hace de cuenta que ya había visto todo menos esa tarjeta
    const original = visto;
    const antes = tarjetasVisibles().map(t => t.clave).filter(k => k !== nuevo);
    visto = () => new Set(antes);
    try { await recorrido(); } finally { visto = original; }
  }

  function barraPrueba() {
    css();
    const st = document.createElement('style');
    st.textContent = `.zt-prueba { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483001; display: flex; gap: 6px; align-items: center;
        overflow-x: auto; padding: 8px 10px max(8px, env(safe-area-inset-bottom)); background: #111214ee; border-top: 1px solid #333; font: 12px system-ui, sans-serif; }
      .zt-prueba b { color: #F2B84B; white-space: nowrap; margin-right: 4px; }
      .zt-prueba button { flex: none; border: 1px solid #444; background: #232628; color: #e8e8e8; border-radius: 999px; padding: 6px 11px; font: inherit; cursor: pointer; }
      .zt-prueba button.on { border-color: #7F77DD; background: #2c2950; }
      .zt-prueba select { flex: none; background: #232628; color: #e8e8e8; border: 1px solid #444; border-radius: 8px; padding: 5px; font: inherit; }`;
    document.head.appendChild(st);
    const bar = document.createElement('div');
    bar.className = 'zt-prueba';
    bar.innerHTML = '<b>Probar tutorial como:</b>' +
      PERFILES_PRUEBA.map(p => `<button data-id="${p.id}">${p.label}</button>`).join('') +
      `<select title="Simula que a la persona elegida le dieron una responsabilidad nueva">
        <option value="">Tenés algo nuevo…</option>
        <option value="terr">+ Encargado de grupo</option><option value="herm">+ Encargado de asignaciones</option><option value="conf">+ Encargado de conferencias</option></select>`;
    let actual = PERFILES_PRUEBA[1];
    bar.addEventListener('click', e => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      actual = PERFILES_PRUEBA.find(p => p.id === b.dataset.id);
      bar.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      probar(actual);
    });
    bar.querySelector('select').addEventListener('change', e => {
      const k = e.target.value;
      e.target.value = '';
      if (!k) return;
      const roles = [...actual.roles.filter(r => r !== 'pendiente'), ROL_DE_TARJETA[k]];
      probar({ roles: roles.length > 1 ? roles : ['publicador', ...roles], hermana: actual.hermana && k !== 'terr' }, { nuevo: k });
    });
    document.documentElement.appendChild(bar);
  }

  const esLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (esLocal && new URLSearchParams(location.search).has('probar')) {
    if (document.readyState === 'complete') setTimeout(barraPrueba, 300);
    else window.addEventListener('load', () => setTimeout(barraPrueba, 300));
  }

  window.ZivTutorial = { pendiente, recorrido, visto: () => visto(), marcar };
})();
