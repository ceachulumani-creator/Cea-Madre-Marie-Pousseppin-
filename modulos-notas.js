/* Selección móvil y traslado explícito de registros de evaluación. */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const abrir=d=>{document.body.append(d);window.mostrarDialogoAcademico?window.mostrarDialogoAcademico(d):d.showModal();};
  function aviso(mensaje){const d=document.createElement('dialog');d.className='criterios-dialog modulos-notas-dialogo';d.innerHTML='<h3>Registro de evaluación</h3><p></p><div><button type="button">Cerrar</button></div>';d.querySelector('p').textContent=mensaje;d.querySelector('button').onclick=()=>d.close();d.onclose=()=>d.remove();abrir(d);}
  window.abrirTrasladoNotasModulo=async function(numero){
    let ctx;try{ctx=window.contextoModulosNotas(numero);}catch(e){aviso(e.message);return;}
    const token=window.getSessionToken?.();
    let origen=ctx.origen;const d=document.createElement('dialog');d.className='criterios-dialog modulos-notas-dialogo';
    d.innerHTML='<h3>Intercambiar notas de módulo</h3><p class="traslado-origen"></p><div class="traslado-campos"><label>Nivel de destino<select data-nivel>'+ctx.niveles.map(n=>'<option '+(n===origen.nivel?'selected':'')+'>'+esc(n)+'</option>').join('')+'</select></label><label>Paralelo<select data-paralelo></select></label><label>Módulo de destino<select data-modulo></select></label></div><p class="traslado-aclaracion">Si el destino tiene notas, se intercambiarán ambos registros. Si está vacío, las notas se trasladarán a ese módulo. Entre niveles o paralelos, los estudiantes deben estar afiliados en ambos cursos.</p><p role="status" aria-live="polite"></p><div class="traslado-acciones"><button type="button" data-cancelar>Cancelar</button><button type="button" data-confirmar disabled>Confirmar</button></div>';
    const nivel=d.querySelector('[data-nivel]'),paralelo=d.querySelector('[data-paralelo]'),modulo=d.querySelector('[data-modulo]'),estado=d.querySelector('[role=status]'),confirmar=d.querySelector('[data-confirmar]');let solicitud=null, ocupado=false, confirmado=false;
    d.querySelector('.traslado-origen').textContent='Origen: '+origen.nivel+' · Paralelo '+(origen.paralelo||'A')+' · '+origen.modulo;
    function destinos(){const catalogo=window.catalogoDestinoNotas(nivel.value);const opciones=[...new Set([origen.paralelo||'A',...catalogo.paralelos])];paralelo.innerHTML=opciones.map(p=>'<option>'+esc(p)+'</option>').join('');paralelo.value=origen.paralelo||'A';modulo.innerHTML=catalogo.modulos.map((m,i)=>'<option value="'+(i+1)+'">'+(i+1)+' · '+esc(m.nombre)+'</option>').join('');modulo.value=String(ctx.numeroOrigen%catalogo.modulos.length+1);}
    function actualizarDestino(){
      solicitud=null;
      estado.textContent='';
      const mismo=nivel.value===origen.nivel && paralelo.value===(origen.paralelo||'A') && Number(modulo.value)===ctx.numeroOrigen;
      confirmar.disabled=mismo || !modulo.value;
      confirmar.textContent='Intercambiar notas';
    }
    destinos();
    nivel.onchange=()=>{destinos();actualizarDestino();};
    paralelo.onchange=modulo.onchange=actualizarDestino;
    actualizarDestino();
    d.querySelector('[data-cancelar]').onclick=()=>d.close();
    d.onclose=()=>d.remove();
    d.addEventListener('cancel',e=>{if(ocupado)e.preventDefault();});
    function comprobarSesion(){
      if(token!==window.getSessionToken?.())throw Error('La sesión cambió. Vuelve a abrir el registro.');
    }
    confirmar.onclick=async()=>{
      if(ocupado||confirmar.disabled)return;
      ocupado=true;
      d.querySelectorAll('button,select').forEach(e=>e.disabled=true);
      try{
        comprobarSesion();
        if(!solicitud){
          if(ctx.pendiente){
            estado.textContent='Guardando las notas que acabas de editar…';
            if(!await window.guardarRegistroCalificaciones())throw Error('No se pudieron guardar las últimas notas. Puedes volver a intentarlo.');
            ctx.pendiente=false;
          }
          const destino={nivel:nivel.value,paralelo:paralelo.value,moduloNumero:Number(modulo.value)};
          estado.textContent='Intercambiando notas…';
          comprobarSesion();
          const vista=await window.enviarGoogleSheet({action:'obtener-traslado-notas',idRegistro:origen.id,destino});
          if(!vista.version)throw Error(vista.message||'No se pudo leer el módulo de destino.');
          solicitud={action:'trasladar-notas-modulo',requestId:crypto.randomUUID(),idRegistro:origen.id,destino,
            baseVersion:vista.version,modo:vista.destino?.id?'intercambiar':'mover'};
        }
        comprobarSesion();
        const r=await window.enviarGoogleSheet(solicitud);
        if(!r.trasladoConfirmado)throw Error(r.message||'Google Sheets no confirmó el intercambio.');
        confirmado=true;
        comprobarSesion();
        window.ceaCriterios?.invalidate(r.registros);
        estado.textContent='Actualizando la planilla…';
        await window.cargarDatosGoogleSheets(true,{silencioso:true,acceso:true});
        comprobarSesion();
        const m=window.catalogoDestinoNotas(nivel.value).modulos[Number(modulo.value)-1];
        const rol=window.lsGet('cea_session',{}).role==='docente'?'docente':'director';
        await window.cambiarModuloPlanilla(origen.areaKey,nivel.value,m.codigo,m.nombre,paralelo.value,rol);
        d.close();
        aviso('Intercambio guardado. Revisa las notas en el módulo de destino.');
      }catch(e){
        if(e.code==='CONFLICTO')solicitud=null;
        estado.textContent=confirmado?'Intercambio guardado. Recarga la página para ver las notas.':e.message;
      }finally{
        ocupado=false;
        d.querySelectorAll('button,select').forEach(e=>e.disabled=false);
        confirmar.disabled=confirmado;
        if(confirmado)d.querySelectorAll('select').forEach(e=>e.disabled=true);
      }
    };
    abrir(d);
  };
  function mantener(elemento,fn){let timer,origen,hecho=false;const cancelar=()=>{clearTimeout(timer);timer=null;};elemento.addEventListener('pointerdown',e=>{if(e.button>0)return;hecho=false;origen={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{hecho=true;fn();},550);});elemento.addEventListener('pointermove',e=>{if(origen&&Math.hypot(e.clientX-origen.x,e.clientY-origen.y)>10)cancelar();});elemento.addEventListener('pointerup',cancelar);elemento.addEventListener('pointercancel',cancelar);elemento.addEventListener('contextmenu',e=>e.preventDefault());elemento.addEventListener('click',e=>{if(hecho){hecho=false;e.preventDefault();e.stopImmediatePropagation();}},true);}
  function seleccionar(select){
    if(select.disabled)return;const d=document.createElement('dialog');d.className='criterios-dialog selector-notas-dialogo';const titulo=select.parentElement.firstChild?.textContent.trim()||'Seleccionar';d.innerHTML='<div class="selector-notas-cabecera"><h3></h3><button type="button" data-cerrar aria-label="Cerrar">×</button></div><input type="search" placeholder="Buscar opción" aria-label="Buscar opción"><div role="listbox" class="selector-notas-lista"></div>';
    d.querySelector('h3').textContent=titulo;const lista=d.querySelector('[role=listbox]');for(const opt of select.options){const b=document.createElement('button');b.type='button';b.setAttribute('role','option');b.setAttribute('aria-selected',String(opt.selected));b.disabled=opt.disabled;b.textContent=opt.textContent;b.dataset.valor=opt.value;b.onclick=()=>{select.value=opt.value;select.dispatchEvent(new Event('change',{bubbles:true}));d.close();};if(select.dataset.movilSelector==='modulo')mantener(b,()=>{d.close();window.abrirTrasladoNotasModulo(Number(opt.value)+1);});lista.append(b);}
    const buscar=d.querySelector('input');buscar.hidden=select.options.length<=6;buscar.oninput=()=>{for(const b of lista.children)b.hidden=!b.textContent.toLocaleLowerCase().includes(buscar.value.toLocaleLowerCase());};d.querySelector('[data-cerrar]').onclick=()=>d.close();d.onclose=()=>d.remove();abrir(d);
  }
  window.prepararSelectoresNotasMovil=function(){
    if(!matchMedia('(max-width:900px)').matches)return;
    document.querySelectorAll('.notas-movil-ribbon select,.notas-movil-menu select').forEach(select=>{
      let boton=select._botonModulos;if(!boton){boton=document.createElement('button');boton.type='button';boton.className='selector-notas-boton';boton.setAttribute('aria-haspopup','dialog');boton.innerHTML='<span></span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>';select.classList.add('selector-notas-original');select.tabIndex=-1;select.setAttribute('aria-hidden','true');select.after(boton);select._botonModulos=boton;boton.onclick=()=>seleccionar(select);if(select.dataset.movilSelector==='modulo'){boton.title='Mantén pulsado para cambiar notas de módulo';mantener(boton,()=>window.abrirTrasladoNotasModulo(Number(select.value)+1));}}
      const texto=select.selectedOptions[0]?.textContent||'Seleccionar';if(boton.querySelector('span').textContent!==texto)boton.querySelector('span').textContent=texto;boton.disabled=select.disabled;boton.setAttribute('aria-label',(select.parentElement.firstChild?.textContent.trim()||'Selección')+': '+texto);
    });
  };
  let clicPendiente,mantenerTimer,mantenerOrigen,mantenerHecho=false;
  const cancelarMantener=()=>{clearTimeout(mantenerTimer);mantenerTimer=null;mantenerOrigen=null;};
  const numeroBotonModulo=boton=>[...boton.parentElement.querySelectorAll('.calif-modulo-tab-btn')].indexOf(boton)+1;
  document.addEventListener('pointerdown',e=>{
    const boton=e.target.closest?.('.calif-modulo-tab-btn');
    if(!boton||!boton.closest('#admin-planilla-container,#docente-planilla-container')||e.button>0||matchMedia('(max-width:900px)').matches)return;
    cancelarMantener();mantenerHecho=false;mantenerOrigen={boton,x:e.clientX,y:e.clientY};
    mantenerTimer=setTimeout(()=>{mantenerHecho=true;clearTimeout(clicPendiente);window.abrirTrasladoNotasModulo(numeroBotonModulo(boton));},500);
  },true);
  document.addEventListener('pointermove',e=>{if(mantenerOrigen&&Math.hypot(e.clientX-mantenerOrigen.x,e.clientY-mantenerOrigen.y)>10)cancelarMantener();},true);
  document.addEventListener('pointerup',cancelarMantener,true);
  document.addEventListener('pointercancel',cancelarMantener,true);
  document.addEventListener('click',e=>{
    const boton=e.target.closest?.('.calif-modulo-tab-btn');
    if(!boton||!boton.closest('#admin-planilla-container,#docente-planilla-container')||e.detail===0||matchMedia('(max-width:900px)').matches)return;
    if(mantenerHecho){mantenerHecho=false;e.preventDefault();e.stopImmediatePropagation();return;}
    e.preventDefault();e.stopImmediatePropagation();clearTimeout(clicPendiente);
    if(e.detail===1)clicPendiente=setTimeout(()=>{if(boton.isConnected&&!boton.disabled)boton.onclick?.call(boton,e);},240);
  },true);
  document.addEventListener('dblclick',e=>{
    const boton=e.target.closest?.('.calif-modulo-tab-btn');
    if(!boton||!boton.closest('#admin-planilla-container,#docente-planilla-container')||boton.disabled)return;
    cancelarMantener();clearTimeout(clicPendiente);mantenerHecho=false;
    e.preventDefault();e.stopImmediatePropagation();
    window.abrirTrasladoNotasModulo(numeroBotonModulo(boton));
  },true);
})();
