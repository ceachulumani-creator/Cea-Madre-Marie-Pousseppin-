/* Controles de ventana y adaptacion de los paneles academicos. */
(function () {
  'use strict';
  const sesion = () => typeof lsGet === 'function' ? lsGet('cea_session', null) : null;
  let vistaMinimizada;
  const icono = tipo => tipo === 'cerrar'
    ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg>'
    : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 18h14"/></svg>';

  function actualizarRetorno() {
    let boton = document.getElementById('panel-academico-retomar');
    if (!sesion()?.token || !document.body.classList.contains('panel-academico-minimizado')) {
      boton?.remove(); return;
    }
    if (!boton) {
      boton = document.createElement('button'); boton.type = 'button';
      boton.id = 'panel-academico-retomar'; boton.onclick = restaurar;
      document.body.append(boton);
    }
    boton.textContent = sesion().role === 'docente' ? 'Volver al panel docente' : 'Volver al panel de Dirección';
  }
  function minimizar() {
    if (!sesion()?.token) return;
    vistaMinimizada={x:window.scrollX,y:window.scrollY,foco:document.activeElement,paneles:[...document.querySelectorAll('#admin-panel,#docente-panel')].map(el=>({el,display:el.style.getPropertyValue('display'),prioridad:el.style.getPropertyPriority('display')}))};
    window.cerrarAcademicMobileDrawer?.(); window.cerrarMenuMovil?.();
    document.body.classList.remove('admin-panel-active', 'docente-panel-active');
    document.body.classList.add('public-view-active', 'panel-academico-minimizado', 'panel-academico-inicio');
    vistaMinimizada.paneles.forEach(({el})=>el.style.setProperty('display','none','important'));
    document.body.style.overflow = ''; document.documentElement.style.overflow = '';
    document.querySelector('header.header')?.style.setProperty('display', '', 'important');
    try { history.replaceState(null, '', '#inicio'); } catch (e) {}
    actualizarRetorno(); window.scrollTo({top: 0, behavior: 'auto'});
  }
  function restaurar() {
    const s = sesion(); if (!s?.token) { actualizarRetorno(); return; }
    document.body.classList.remove('public-view-active', 'panel-academico-minimizado', 'panel-academico-inicio');
    document.body.classList.add(s.role === 'docente' ? 'docente-panel-active' : 'admin-panel-active');
    if (s.role === 'docente') document.querySelector('header.header')?.style.setProperty('display', 'none', 'important');
    try { history.replaceState(null, '', '#admin'); } catch (e) {}
    actualizarRetorno();
    const vista=vistaMinimizada;vistaMinimizada=null;
    vista?.paneles.forEach(({el,display,prioridad})=>el.style.setProperty('display',display,prioridad));
    if(vista)requestAnimationFrame(()=>{window.scrollTo(vista.x,vista.y);if(vista.foco?.isConnected)vista.foco.focus({preventScroll:true});});
  }
  window.minimizarPanelAcademico = minimizar;
  window.restaurarPanelAcademico = restaurar;
  window.asegurarNotaMovil = input => {
    const wrap=input.closest('.movil-planilla-scroll');if(!wrap)return;
    const fila=input.closest('tr'),r=wrap.getBoundingClientRect(),c=input.getBoundingClientRect();
    const izquierda=Math.max(r.left,fila.querySelector('.movil-nombre')?.getBoundingClientRect().right||r.left)+3;
    const derecha=Math.min(r.right,innerWidth,fila.querySelector('.movil-final')?.getBoundingClientRect().left||r.right)-3;
    if(c.left<izquierda)wrap.scrollLeft-=izquierda-c.left;else if(c.right>derecha)wrap.scrollLeft+=c.right-derecha;
    const cabecera=wrap.querySelector('thead')?.getBoundingClientRect().height||0;
    const pie=document.querySelector('.notas-movil-pie')?.getBoundingClientRect().top||innerHeight;
    const abajo=Math.min(r.bottom,pie)-5,arriba=r.top+cabecera+3;
    if(c.bottom>abajo)wrap.scrollTop+=c.bottom-abajo;
    else if(c.top<arriba&&wrap.clientHeight-cabecera>=c.height)wrap.scrollTop-=arriba-c.top;
  };

  function instalar() {
    if (document.body.classList.contains('panel-academico-minimizado')) {
      if (document.body.matches('.admin-panel-active,.docente-panel-active')) document.body.classList.remove('admin-panel-active','docente-panel-active');
      if (!document.body.classList.contains('public-view-active')) document.body.classList.add('public-view-active');
    }
    for (const barra of document.querySelectorAll('#admin-stage-topbar, #docente-stage-topbar')) {
      if (barra.querySelector('.panel-ventana-controles')) continue;
      // El boton de salida de la cabecera se sustituye por controles explicitos.
      barra.querySelectorAll('button[onclick*="adminLogout"]').forEach(b => b.remove());
      const controles = document.createElement('div'); controles.className = 'panel-ventana-controles';
      controles.innerHTML = '<button type="button" class="panel-ventana-cerrar" aria-label="Cerrar sesión" title="Cerrar sesión">'+icono('cerrar')+'<span>Cerrar sesión</span></button><button type="button" class="panel-ventana-minimizar" title="Minimizar panel sin cerrar sesión">'+icono('minimizar')+'<span>Minimizar panel</span></button>';
      controles.querySelector('.panel-ventana-cerrar').onclick = () => window.adminLogout?.();
      controles.querySelector('.panel-ventana-minimizar').onclick = minimizar;
      barra.append(controles);
    }
    for (const boton of document.querySelectorAll('.docente-sidebar-header .sidebar-close-btn, .admin-sidebar-header .sidebar-close-btn')) {
      if (boton.dataset.minimizarPanel) continue;
      boton.dataset.minimizarPanel = 'true'; boton.removeAttribute('onclick');
      boton.onclick = minimizar; boton.innerHTML = icono('minimizar');
      boton.title = 'Minimizar panel'; boton.setAttribute('aria-label', 'Minimizar panel');
    }
    actualizarRetorno();
  }
  let pendiente = false;
  function programar() {
    if (pendiente) return; pendiente = true;
    requestAnimationFrame(() => { pendiente = false; instalar(); });
  }
  function iniciar() {
    instalar();
    const observador = new MutationObserver(cambios => {
      if (cambios.some(c => c.type === 'attributes' ? c.target === document.body : [...c.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('#admin-stage-topbar, #docente-stage-topbar, .sidebar-close-btn') || n.querySelector?.('#admin-stage-topbar, #docente-stage-topbar, .sidebar-close-btn'))))) programar();
    });
    observador.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
  }
  // El historial del navegador tampoco debe restaurar una sesion anterior.
  window.addEventListener('pageshow', e => { if (e.persisted) window.adminLogout?.(); });
  window.addEventListener('hashchange',()=>{if(location.hash!=='#inicio')document.body.classList.remove('panel-academico-inicio');});
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
