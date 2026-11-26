/* Acciones del registro y del boletin en pantallas pequenas. */
(function(){
  'use strict';
  let actual=null,pendiente=false,ocupado=false,exportando=false;
  const movil=()=>matchMedia('(max-width:900px)').matches;
  const visible=el=>!!el?.getClientRects().length;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icono='<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
  function contexto(){
    if(!movil()||!document.body.matches('.admin-panel-active,.docente-panel-active'))return null;
    const boletin=[...document.querySelectorAll('.cen-digital-viewer,.revision-notas')].find(visible);
    if(boletin)return {root:boletin,tipo:'boletin'};
    const root=[...document.querySelectorAll('#admin-planilla-container,#docente-planilla-container')].find(visible);
    return root?{root,tipo:'registro'}:null;
  }
  function estado(){const e=window.estadoNotasMovil?.()||{};return {pendiente:actual?.tipo==='boletin'?e.pendienteBoletin:e.pendienteRegistro,guardando:ocupado||(actual?.tipo==='boletin'?e.guardandoBoletin:e.guardandoRegistro)};}
  function marcar(el,clase){if(el&&!el.classList.contains(clase))el.classList.add(clase);}
  function fuentes(ctx){
    const r=ctx.root,boletin=ctx.tipo==='boletin';
    const selectores=[...r.querySelectorAll('select')].filter(s=>!s.closest('[data-notas-movil-ui],.boletin-estado-control'));
    const nivel=boletin?(r.querySelector('#revision-notas-curso')||selectores.find(s=>(s.getAttribute('onchange')||'').includes('cambiarNivelCentralizador'))):r.querySelector('.calif-course-switch select');
    const paralelo=boletin?(r.querySelector('#revision-notas-paralelo')||selectores.find(s=>/^PARALELO/i.test(s.parentElement.querySelector('label')?.textContent.trim()||''))):null;
    const paralelos=boletin?[]:[...r.querySelectorAll('.calif-sheet-paralelos-bar .calif-paralelo-pill')];
    const modulos=[...r.querySelectorAll('button[onclick*="cambiarModuloPlanilla"],button[onclick*="cambiarModuloHumanistica"],.calif-modulo-tab-btn')];
    return {nivel,paralelo,paralelos,modulos,criterios:r.querySelector('[data-control="habilitado"]'),selectores};
  }
  function copiarSelect(origen,titulo,tipo){
    const label=document.createElement('label');label.textContent=titulo;
    const select=origen.cloneNode(true);select.removeAttribute('id');select.removeAttribute('onchange');select.removeAttribute('style');select.removeAttribute('name');select.dataset.movilSelector=tipo||titulo;select.value=origen.value;
    if(tipo==='paralelo')for(const option of select.options)option.textContent=option.textContent.replace(/^Paralelo\s*/i,'').replace(/["']/g,'').trim();
    select._fuenteNotasMovil=origen;
    select.onchange=()=>{origen.value=select.value;origen.dispatchEvent(new Event('change',{bubbles:true}));select.disabled=origen.disabled;requestAnimationFrame(()=>{if(origen.isConnected)select.value=origen.value;programar();});};
    label.append(select);return label;
  }
  function listaBotones(botones,titulo,tipo,valor){
    const label=document.createElement('label');label.textContent=titulo;
    const select=document.createElement('select');select.dataset.movilSelector=tipo;
    botones.forEach((b,i)=>{let texto=b.textContent.replace(/\s+/g,' ').trim();if(tipo==='paralelo')texto=texto.replace(/^Paralelo\s*/i,'').replace(/["']/g,'').trim();if(tipo==='modulo')texto=(i+1)+' · '+(b.querySelector('.calif-modulo-tab-name')?.textContent.trim()||texto);const option=new Option(texto,String(i));option.disabled=b.disabled;option.selected=b.classList.contains('active')||b.classList.contains('calif-modulo-tab-active')||!!(valor&&!botones.some(x=>x.classList.contains('active')||x.classList.contains('calif-modulo-tab-active'))&&b.textContent.trim()===valor);select.add(option);});
    select.onchange=()=>{botones[Number(select.value)]?.click();programar();};
    if(!botones.length){select.add(new Option(valor||'Sin opciones disponibles',''));select.disabled=true;}
    label.append(select);return label;
  }
  function barra(ctx){
    const header=document.getElementById(document.body.classList.contains('docente-panel-active')?'docente-stage-topbar':'admin-stage-topbar');if(!header)return;
    const f=fuentes(ctx);
    if(!actual||actual.root!==ctx.root||actual.tipo!==ctx.tipo||actual.nivel!==f.nivel){
      actual?.ribbon.remove();document.querySelector('.notas-movil-menu')?.close();
      const ribbon=document.createElement('div');ribbon.className='notas-movil-ribbon';ribbon.dataset.notasMovilUi='true';
      ribbon.innerHTML='<div class="notas-movil-titulo"><span>'+(ctx.tipo==='boletin'?'Boletín centralizador':'Registro de evaluación')+'</span><button type="button" data-menu-notas aria-label="Abrir acciones del '+(ctx.tipo==='boletin'?'boletín':'registro')+'" aria-haspopup="dialog">'+icono+'</button></div><div class="notas-movil-selectores"></div><div class="notas-movil-criterios"></div>';
      const selects=ribbon.querySelector('.notas-movil-selectores');
      if(f.nivel)selects.append(copiarSelect(f.nivel,'Nivel','nivel'));
      if(f.paralelo)selects.append(copiarSelect(f.paralelo,'Paralelo','paralelo'));
      else selects.append(listaBotones(f.paralelos,'Paralelo','paralelo',window.estadoNotasMovil?.().registro?.paralelo));
      if(ctx.tipo==='registro'&&f.modulos.length)selects.append(listaBotones(f.modulos,'Módulo','modulo',window.estadoNotasMovil?.().registro?.moduloCodigo));
      header.append(ribbon);actual={...ctx,ribbon,nivel:f.nivel,tabla:null};
      ribbon.querySelector('[data-menu-notas]').onclick=abrirMenu;
    }
    const slot=actual.ribbon.querySelector('.notas-movil-criterios');
    if(f.criterios){
      if(!slot.firstChild)slot.innerHTML='<label><input type="checkbox" role="switch" data-movil-criterios> Evaluar con criterios</label>';
      const input=slot.querySelector('input');input.checked=f.criterios.checked;input.disabled=f.criterios.disabled;
      input.onchange=()=>{f.criterios.checked=input.checked;f.criterios.dispatchEvent(new Event('change',{bubbles:true}));programar();};
    }else slot.replaceChildren();
  }
  async function guardar(){
    if(!actual||estado().guardando)return false;
    const ctx=actual;ocupado=true;actualizarPie();
    try{const ok=await (ctx.tipo==='boletin'?window.guardarNotasBoletin():window.guardarRegistroCalificaciones());if(ok!==true)throw Error('No se pudo guardar. Revisa las calificaciones e intenta nuevamente.');if(ctx===actual)aviso('Datos guardados correctamente.');return true;}
    catch(e){aviso(e.message);return false;}
    finally{ocupado=false;programar();}
  }
  function aviso(texto){const el=document.querySelector('.notas-movil-pie [role=status]');if(el)el.textContent=texto;}
  async function confirmarPDF(){
    if(!estado().pendiente)return true;
    return new Promise(resolve=>{
      const d=document.createElement('dialog');d.className='criterios-dialog notas-movil-pdf-aviso';d.dataset.notasMovilUi='true';
      d.innerHTML='<h3>Hay cambios sin guardar</h3><p>Puedes guardar las notas antes de generar el PDF o descargar la versión que estás viendo.</p><p role="status"></p><div><button type="button" data-cancelar>Cancelar</button><button type="button" data-borrador>Guardar PDF sin guardar notas</button><button type="button" data-guardar>Guardar notas y PDF</button></div>';
      let resuelto=false;const terminar=v=>{if(resuelto)return;resuelto=true;d.close();resolve(v);};
      d.onclose=()=>{d.remove();if(!resuelto){resuelto=true;resolve(false);}};
      d.querySelector('[data-cancelar]').onclick=()=>terminar(false);d.querySelector('[data-borrador]').onclick=()=>terminar(true);
      d.querySelector('[data-guardar]').onclick=async()=>{d.querySelectorAll('button').forEach(b=>b.disabled=true);d.querySelector('[role=status]').textContent='Guardando…';if(await guardar())terminar(true);else{d.querySelectorAll('button').forEach(b=>b.disabled=false);d.querySelector('[role=status]').textContent='No se guardaron las notas. Puedes volver a intentar.';}};
      document.body.append(d);window.mostrarDialogoAcademico?window.mostrarDialogoAcademico(d):d.showModal();
    });
  }
  function estilosPDF(doc){
    const prefijo='.notas-pdf-contenido';
    function selectores(texto){let nivel=0,cita='',inicio=0,lista=[];for(let i=0;i<texto.length;i++){const c=texto[i];if(cita){if(c===cita&&texto[i-1]!=='\\')cita='';continue;}if(c==='"'||c==="'"){cita=c;continue;}if(c==='('||c==='[')nivel++;else if(c===')'||c===']')nivel--;else if(c===','&&!nivel){lista.push(texto.slice(inicio,i));inicio=i+1;}}lista.push(texto.slice(inicio));return lista;}
    function reglas(coleccion){return [...coleccion].map(r=>{
      if(r.selectorText&&r.style){const lista=selectores(r.selectorText).map(s=>{s=s.trim();return /^(html|body|:root)(?=$|[\s.#[:])/.test(s)?s.replace(/^(html|body|:root)/,prefijo):prefijo+' '+s;});return lista.join(',')+'{'+r.style.cssText+'}';}
      if(r.cssRules&&r.type!==6)return reglas(r.cssRules);
      return r.type===5?r.cssText:'';
    }).join('\n');}
    return [...doc.styleSheets].map(s=>{try{return reglas(s.cssRules);}catch(e){return '';}}).join('\n');
  }
  const tiempoPDF=(promesa,ms,mensaje)=>Promise.race([promesa,new Promise((_,rechazar)=>setTimeout(()=>rechazar(Error(mensaje)),ms))]);
  async function prepararImagenesPDF(doc){
    const cache=new Map();
    await Promise.all([...doc.images].map(async img=>{
      const src=img.getAttribute('src')||'';
      img.removeAttribute('srcset');img.removeAttribute('onerror');img.removeAttribute('onload');img.loading='eager';
      // El logo incorporado evita redirecciones y restricciones de origen del alojamiento.
      if(/(?:^|\/)logo\.png(?:[?#]|$)/i.test(src)&&window.KARDEX_LOGO_BASE64){img.src=window.KARDEX_LOGO_BASE64;}
      else if(!/^data:image\/(png|jpeg|webp);base64,/i.test(src)){
        try{
          const url=new URL(src,document.baseURI).href;
          if(!cache.has(url))cache.set(url,(async()=>{const res=await tiempoPDF(fetch(url,{mode:'cors',credentials:'same-origin'}),8000,'No se pudo cargar una imagen.');if(!res.ok||res.type==='opaque')throw Error('Imagen no disponible');const blob=await res.blob();if(!/^image\/(png|jpeg|webp)$/.test(blob.type))throw Error('Formato de imagen no compatible');return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(blob);});})());
          img.src=await cache.get(url);
        }catch(e){if(/logo/i.test(img.alt||'')&&window.KARDEX_LOGO_BASE64)img.src=window.KARDEX_LOGO_BASE64;else img.remove();}
      }
      if(img.isConnected)try{await tiempoPDF(img.decode(),3000,'Imagen no disponible');}catch(e){img.remove();}
    }));
    // No trasladar lienzos que ya puedan estar contaminados al documento de descarga.
    doc.querySelectorAll('canvas,video,iframe,object,embed').forEach(el=>el.remove());
  }
  function progresoPDF(){
    const d=document.createElement('dialog');d.className='criterios-dialog notas-movil-pdf-progreso';d.dataset.notasMovilUi='true';
    d.innerHTML='<h3>Generando PDF</h3><p role="status" aria-live="polite">Preparando el documento. Espera un momento.</p>';
    d.addEventListener('cancel',e=>e.preventDefault());document.body.append(d);window.mostrarDialogoAcademico?window.mostrarDialogoAcademico(d):d.showModal();return d;
  }
  function opcionesPDF(){
    if(actual?.tipo!=='registro')return pdf();
    const d=document.createElement('dialog');d.className='criterios-dialog notas-movil-pdf-alcance';d.dataset.notasMovilUi='true';
    d.innerHTML='<h3>Guardar PDF de módulos</h3><p>Se usará el curso, paralelo, gestión y semestre que estás viendo.</p><div class="notas-pdf-opciones"><button type="button" data-pdf-actual>Guardar PDF de este módulo</button><button type="button" data-pdf-todos>Todos los módulos: automático</button><button type="button" data-pdf-con>Todos con criterios</button><button type="button" data-pdf-sin>Todos sin criterios</button><button type="button" data-cancelar>Cancelar</button></div>';
    d.onclose=()=>d.remove();d.querySelector('[data-cancelar]').onclick=()=>d.close();d.querySelector('[data-pdf-actual]').onclick=()=>{d.close();return pdf();};for(const [selector,modo]of [['[data-pdf-todos]','automatico'],['[data-pdf-con]','con'],['[data-pdf-sin]','sin']])d.querySelector(selector).onclick=()=>{d.close();return pdf({todosModulos:true,modoImpresion:modo});};document.body.append(d);window.mostrarDialogoAcademico?window.mostrarDialogoAcademico(d):d.showModal();
  }
  async function convertirPaginasRegistroPDF(motor,frame,papel,horizontal,progreso){
    const PDF=frame.contentWindow.jspdf?.jsPDF||frame.contentWindow.jsPDF;
    if(!PDF)throw Error('No se pudo preparar el archivo PDF.');
    const paginas=[...papel.querySelectorAll('.calif-print-pagina,.criterios-print-pagina')];
    if(!paginas.length)throw Error('El registro no contiene páginas para descargar.');
    const esHorizontal=p=>p.closest('.calif-lote-modulo')?p.closest('.calif-lote-modulo').dataset.horizontal==='true':horizontal;
    const pdf=new PDF({unit:'mm',format:'letter',orientation:esHorizontal(paginas[0])?'landscape':'portrait'});
    for(let i=0;i<paginas.length;i++){
      if(progreso)progreso.querySelector('[role=status]').textContent='Generando página '+(i+1)+' de '+paginas.length+'…';
      const pagina=paginas[i],horizontalPagina=esHorizontal(pagina),ancho=horizontalPagina?263.4:199.9,alto=horizontalPagina?199.9:263.4;pagina.style.width=ancho+'mm';
      // El motor toma el viewport del iframe para centrar su contenedor temporal.
      // Debe tener la misma anchura que la página, también en lotes mixtos.
      frame.style.width=Math.ceil(ancho*96/25.4)+'px';
      frame.contentDocument.documentElement.style.width=ancho+'mm';
      frame.contentDocument.body.style.width=ancho+'mm';
      const estilo=frame.contentWindow.getComputedStyle(pagina);pagina.style.fontSize=estilo.fontSize;pagina.style.fontFamily=estilo.fontFamily;
      // Capturar una copia aislada evita que el ancho y la posición del lote
      // horizontal recorten las páginas verticales en html2canvas.
      const copia=pagina.cloneNode(true),contenedor=frame.contentDocument.createElement('div');
      contenedor.style.cssText='position:absolute;left:0;top:0;width:'+ancho+'mm;background:#fff;z-index:10';
      copia.style.width=ancho+'mm';contenedor.append(copia);frame.contentDocument.body.append(contenedor);
      let canvas;
      try{canvas=await tiempoPDF(motor().set({margin:8,jsPDF:{unit:'mm',format:'letter',orientation:horizontalPagina?'landscape':'portrait'},html2canvas:{scale:2,foreignObjectRendering:true,allowTaint:false,useCORS:true,imageTimeout:8000,backgroundColor:'#ffffff',scrollX:0,scrollY:0,windowWidth:Math.ceil(ancho*96/25.4)},pagebreak:{mode:[],avoid:[]}}).from(copia).toCanvas().get('canvas'),60000,'No se pudo preparar una página del PDF.');}finally{contenedor.remove();}
      if(!canvas.width||!canvas.height)throw Error('La página generada está vacía.');
      const proporcion=Math.min(ancho/canvas.width,alto/canvas.height);
      if(i)pdf.addPage('letter',horizontalPagina?'landscape':'portrait');
      pdf.addImage(canvas.toDataURL('image/jpeg',.96),'JPEG',8,8,canvas.width*proporcion,canvas.height*proporcion);
      canvas.width=1;canvas.height=1;
    }
    return pdf.output('blob');
  }
  async function pdf(documento){
    if(!documento?.html&&!documento?.todosModulos)documento=null;
    if((!actual&&!documento)||estado().guardando||exportando||!await confirmarPDF())return;
    const ctx=actual;exportando=true;actualizarPie();let frame,progreso;
    try{
      progreso=progresoPDF();
      if(typeof window.html2pdf!=='function'){aviso('Selecciona Guardar como PDF en la ventana de impresión.');ctx.tipo==='boletin'?window.imprimirCentralizadorOficial():window.imprimirRegistroOficial(true);return;}
      if(ctx?.tipo==='registro')await window.ceaCriterios?.awaitReady(window.estadoNotasMovil?.().registro?.id);
      const doc=documento?.todosModulos&&!documento.html?await window.documentosTodosModulosCalif(documento.modoImpresion):documento||window.documentoNotasMovil(ctx.tipo),esRegistro=doc.tipo==='registro'||(!documento&&ctx?.tipo==='registro'),ancho=doc.horizontal?263.4:199.9,anchoPixeles=Math.ceil(ancho*96/25.4);
      aviso('Generando PDF…');let listo;
      if(esRegistro){frame=window.crearDocumentoCalif(doc.html,doc.horizontal);listo=frame.documentoListo;}
      else{
        frame=document.createElement('iframe');frame.className='notas-movil-pdf-frame';frame.title='Documento académico PDF';frame.style.cssText='position:fixed;left:-12000px;top:0;width:'+anchoPixeles+'px;height:1000px;border:0';
        listo=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('No se pudo preparar el documento PDF.'));});
        frame.srcdoc='<!doctype html><html><head><meta charset="UTF-8"><base href="'+esc(document.baseURI)+'"><link rel="stylesheet" href="calificaciones-impresion.css?v=73.99"><style>html,body{margin:0;padding:0;width:'+ancho+'mm;max-width:none;background:white}.cen-doc-page{width:100%!important;max-width:none!important;box-sizing:border-box}</style></head><body>'+doc.html+'</body></html>';
        document.body.append(frame);
      }
      await tiempoPDF(listo,15000,'No se pudo preparar el documento. Intenta nuevamente.');const contenido=frame.contentDocument;
      if(contenido.fonts?.ready)await Promise.race([contenido.fonts.ready,new Promise(r=>setTimeout(r,2000))]);
      await prepararImagenesPDF(contenido);
      const css=esRegistro?'':estilosPDF(contenido),papel=contenido.createElement('div');papel.className='notas-pdf-contenido';papel.style.cssText='width:'+ancho+'mm;max-width:none;margin:0;padding:0;background:white;color:black;font-family:Arial,Helvetica,sans-serif';
      if(!esRegistro)contenido.body.querySelectorAll('style').forEach(s=>s.remove());while(contenido.body.firstChild)papel.append(contenido.body.firstChild);contenido.body.append(papel);
      if(!esRegistro){const tema=contenido.createElement('style');tema.textContent='.notas-pdf-contenido,.notas-pdf-contenido *{all:revert;box-sizing:border-box}\n'+css+'\n.notas-pdf-contenido .criterios-print-pagina:last-child{break-after:auto!important;page-break-after:auto!important}';papel.prepend(tema);}
      window.paginarDocumentoCalif?.(contenido,doc.horizontal);
      if(esRegistro)window.dispatchEvent(new CustomEvent('cea-documento-pdf-preparado',{detail:{documento:contenido,horizontal:doc.horizontal}}));
      if(!esRegistro)papel.querySelectorAll('.criterios-print-vertical,.criterios-print-dimension-vertical,.criterios-print-auto-vertical').forEach(el=>{
        const celda=el.closest('th');if(!celda)return;const alto=celda.getBoundingClientRect().height;
        celda.style.setProperty('position','relative');celda.style.setProperty('height',alto+'px');
        el.style.cssText+=';writing-mode:horizontal-tb!important;position:absolute;left:50%;top:50%;width:'+Math.max(28,alto-6)+'px;height:auto!important;min-height:0;max-height:none;display:block;white-space:normal;margin:0;transform:translate(-50%,-50%) rotate(-90deg);text-align:center';
      });
      let motor=window.html2pdf;
      if(esRegistro){
        const script=contenido.createElement('script');script.src=new URL('html2pdf.bundle.min.js',document.baseURI).href;
        const cargado=new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('No se pudo cargar el generador PDF.'));});contenido.head.append(script);await tiempoPDF(cargado,15000,'No se pudo cargar el generador PDF.');motor=frame.contentWindow.html2pdf;
      }
      const nombre=doc.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,180)+'.pdf';
      const archivo=esRegistro?await convertirPaginasRegistroPDF(motor,frame,papel,doc.horizontal,progreso):await tiempoPDF(motor().set({margin:8,filename:nombre,image:{type:'jpeg',quality:.96},html2canvas:{scale:Math.min(2,Math.max(1,Math.sqrt(12000000/Math.max(1,papel.scrollWidth*papel.scrollHeight)))),allowTaint:false,useCORS:true,foreignObjectRendering:esRegistro,imageTimeout:8000,scrollX:0,scrollY:0,windowWidth:anchoPixeles,onclone:doc=>{doc.querySelectorAll('.notas-pdf-contenido img').forEach(img=>{if(!/^data:image\/(png|jpeg|webp);base64,/i.test(img.src))img.remove();});}},jsPDF:{unit:'mm',format:'letter',orientation:doc.horizontal?'landscape':'portrait'},pagebreak:{mode:['css','legacy'],avoid:['tr','.criterios-print-cierre','.calif-print-signatures']}}).from(papel).outputPdf('blob'),90000,'La generación está tardando demasiado. Intenta nuevamente.');
      if(!archivo||archivo.type!=='application/pdf'||archivo.size<1000)throw Error('El documento generado está vacío.');
      progreso.close();progreso.remove();progreso=null;
      presentarPDF(archivo,nombre);
      aviso('PDF generado correctamente.');
    }catch(e){const mensaje='No se pudo generar el PDF. '+e.message;aviso(mensaje);if(progreso){const dialogo=progreso;dialogo.querySelector('h3').textContent='No se pudo generar el PDF';dialogo.querySelector('p').textContent=e.message;const cerrar=document.createElement('button');cerrar.textContent='Cerrar';cerrar.onclick=()=>{dialogo.close();dialogo.remove();};dialogo.append(cerrar);progreso=null;}}
    finally{if(progreso){progreso.close();progreso.remove();}frame?.remove();exportando=false;programar();}
  }
  window.guardarDocumentoNotasPDF=pdf;
  function presentarPDF(blob,nombre){
    const url=URL.createObjectURL(blob),d=document.createElement('dialog');d.className='criterios-dialog notas-movil-pdf-listo';d.dataset.notasMovilUi='true';
    d.innerHTML='<h3>PDF listo</h3><p>Guarda el documento en tu dispositivo o ábrelo para revisarlo.</p><p data-archivo></p><div><a data-descargar>Descargar PDF</a><a data-abrir>Abrir PDF</a><button type="button" data-compartir hidden>Compartir o guardar</button><button type="button" data-cerrar>Cerrar</button></div><p role="status"></p>';
    d.querySelector('[data-archivo]').textContent=nombre;
    const enlace=d.querySelector('[data-descargar]');enlace.href=url;enlace.download=nombre;
    const abrir=d.querySelector('[data-abrir]');abrir.href=url;abrir.target='_blank';abrir.rel='noopener';
    const archivo=new File([blob],nombre,{type:'application/pdf'}),compartir=d.querySelector('[data-compartir]');
    if(navigator.canShare?.({files:[archivo]})){compartir.hidden=false;compartir.onclick=async()=>{try{await navigator.share({files:[archivo],title:nombre});}catch(e){if(e.name!=='AbortError')d.querySelector('[role=status]').textContent='Puedes usar Descargar PDF o Abrir PDF.';}};}
    d.querySelector('[data-cerrar]').onclick=()=>d.close();d.onclose=()=>{d.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);};
    document.body.append(d);window.mostrarDialogoAcademico?window.mostrarDialogoAcademico(d):d.showModal();enlace.click();
  }
  const selectorNotaMovil = '.movil-nota,.movil-centralizador-nota,.criterio-nota,.criterio-promedio-input,.promedio-boletin-input';
  let focoNotaReciente = 0, alturaSinTeclado = 0, anchoTeclado = 0;
  function tecladoNotasAbierto(viewport) {
    if (!viewport) return false;
    if (anchoTeclado !== innerWidth) {
      anchoTeclado = innerWidth;
      alturaSinTeclado = 0;
    }
    const foco = document.activeElement?.matches(selectorNotaMovil);
    const alturaVisible = viewport.height * viewport.scale;
    if (!foco) alturaSinTeclado = Math.max(alturaSinTeclado, alturaVisible);
    const espacio = Math.max(innerHeight, alturaSinTeclado) - alturaVisible;
    return espacio > 100 && (foco || focoNotaReciente > Date.now());
  }

  function actualizarPie(){
    if(!actual)return;
    let pie=document.querySelector('.notas-movil-pie');
    if(!pie){pie=document.createElement('div');pie.className='notas-movil-pie';pie.dataset.notasMovilUi='true';pie.innerHTML='<p role="status" aria-live="polite"></p><div><button type="button" data-movil-pdf>Guardar PDF</button><button type="button" data-movil-guardar>Guardar</button></div>';if(typeof pie.showPopover==='function')pie.setAttribute('popover','manual');document.body.append(pie);if(pie.hasAttribute('popover'))pie.showPopover();pie.querySelector('[data-movil-pdf]').onclick=opcionesPDF;pie.querySelector('[data-movil-guardar]').onclick=guardar;}
    if(pie._ribbon!==actual.ribbon){pie.querySelector('[role=status]').textContent='';pie._ribbon=actual.ribbon;pie._pendiente=false;}
    const e=estado(),save=pie.querySelector('[data-movil-guardar]');save.hidden=!e.pendiente&&!e.guardando;save.disabled=e.guardando||exportando;save.textContent=e.guardando?'Guardando…':'Guardar';save.setAttribute('aria-busy',String(e.guardando));
    pie.dataset.pendiente=String(!!e.pendiente);
    const botonPDF=pie.querySelector('[data-movil-pdf]');botonPDF.disabled=e.guardando||exportando;botonPDF.textContent=exportando?'Generando PDF…':'Guardar PDF';
    if(e.pendiente&&!pie._pendiente&&!e.guardando&&!exportando)aviso('Cambios sin guardar');
    if(!e.pendiente&&!e.guardando&&pie.querySelector('[role=status]').textContent==='Cambios sin guardar')aviso('');
    pie._pendiente=e.pendiente;
    const viewport=window.visualViewport,desfase=viewport?Math.max(0,innerHeight-viewport.height-viewport.offsetTop):0;
    const teclado = tecladoNotasAbierto(viewport);
    if (pie.hidden !== teclado) pie.hidden = teclado;
    document.body.classList.toggle('notas-movil-teclado', teclado);
    pie.style.bottom=desfase+'px';if(viewport){pie.style.left=viewport.offsetLeft+'px';pie.style.width=viewport.width+'px';pie.style.right='auto';pie.style.boxSizing='border-box';}
    document.documentElement.style.setProperty('--notas-movil-pie',Math.ceil(teclado ? Math.max(0, innerHeight - viewport.height) : pie.getBoundingClientRect().height + 12 + desfase)+'px');
    const header=actual.ribbon.closest('header');document.documentElement.style.setProperty('--notas-movil-header',Math.ceil(header.getBoundingClientRect().height)+'px');
  }
  function abrirMenu(){
    if(!actual)return;document.querySelector('.notas-movil-menu')?.close();
    const ctx=actual,f=fuentes(ctx),d=document.createElement('dialog');d.className='criterios-dialog notas-movil-menu';d.dataset.notasMovilUi='true';
    d.innerHTML='<div class="notas-menu-titulo"><h3>Opciones del '+(ctx.tipo==='boletin'?'boletín':'registro')+'</h3><button type="button" aria-label="Cerrar opciones" data-cerrar>×</button></div><div class="notas-menu-selectores"></div><div class="notas-menu-acciones"></div>';
    const selects=d.querySelector('.notas-menu-selectores'),acciones=d.querySelector('.notas-menu-acciones'),usados=new Set();
    const cerrar=()=>d.close();d.querySelector('[data-cerrar]').onclick=cerrar;d.onclose=()=>d.remove();
    if(f.nivel)selects.append(copiarSelect(f.nivel,'Nivel','nivel-menu'));
    if(f.paralelo)selects.append(copiarSelect(f.paralelo,'Paralelo','paralelo-menu'));else selects.append(listaBotones(f.paralelos,'Paralelo','paralelo-menu',window.estadoNotasMovil?.().registro?.paralelo));
    if(f.modulos.length)selects.append(listaBotones(f.modulos,'Módulo','modulo'));
    const otras=ctx.tipo==='boletin'?f.selectores:[...ctx.ribbon.closest('header').querySelectorAll('select')].filter(s=>!s.closest('[data-notas-movil-ui]'));
    otras.filter(s=>s!==f.nivel&&s!==f.paralelo&&!s.disabled).forEach(s=>{const label=s.parentElement.querySelector('label')?.textContent.trim()||s.closest('label')?.firstChild?.textContent.trim()||'Selección';selects.append(copiarSelect(s,label));});
    const sobre=ctx.root.querySelector('[data-control=sobre100]');if(sobre){const label=document.createElement('label');const input=sobre.cloneNode();input.removeAttribute('id');input.checked=sobre.checked;input.onchange=()=>{sobre.checked=input.checked;sobre.dispatchEvent(new Event('change',{bubbles:true}));};label.append(input,' Evaluar criterios sobre 100');selects.append(label);}
    const nombreModulo=ctx.root.querySelector('[data-nombre-modulo-humanistica]');if(nombreModulo){const label=document.createElement('label');label.textContent='Nombre del módulo';const input=nombreModulo.cloneNode();input.removeAttribute('id');input.value=nombreModulo.value;input.oninput=()=>{nombreModulo.value=input.value;};label.append(input);selects.append(label);}
    ctx.root.querySelectorAll('input[type=checkbox]').forEach(origen=>{if(origen.closest('table,.criterios-panel,[data-notas-movil-ui]'))return;const label=document.createElement('label'),input=origen.cloneNode();input.removeAttribute('id');input.removeAttribute('onchange');input.removeAttribute('onclick');input.checked=origen.checked;input.onchange=()=>{origen.checked=input.checked;origen.dispatchEvent(new Event('change',{bubbles:true}));};label.append(input,' '+(origen.closest('label')?.textContent.replace(/\s+/g,' ').trim()||'Notas subidas'));selects.append(label);});
    const agregar=(texto,fn,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=texto;b.disabled=disabled;b.onclick=()=>{cerrar();fn();};acciones.append(b);};
    agregar('Guardar notas',guardar,!estado().pendiente||estado().guardando||exportando);agregar('Guardar PDF',opcionesPDF,estado().guardando||exportando);
    if(ctx.tipo==='boletin')agregar('Imprimir',()=>window.imprimirCentralizadorOficial());
    else {
      // En teléfono no se oculta la decisión de alcance detrás de una impresión directa:
      // se distingue claramente la planilla visible del lote completo.
      agregar('Imprimir este módulo',()=>window.imprimirRegistroOficial());
      agregar('Imprimir todos los módulos',()=>window.imprimirOpcionesRegistro());
    }
    const publicar=ctx.root.querySelector('[data-publicar-registro],[data-publicar-boletin]');
    const botones=[...(publicar?[publicar]:[]),...ctx.root.querySelectorAll('button')];
    botones.forEach(b=>{
      if(b.closest('[data-notas-movil-ui]')||b.closest('.criterios-movil')||b.closest('.movil-planilla')||b.closest('.calif-mobile-grades')||b.matches('.calif-paralelo-pill,.calif-modulo-tab-btn')||f.modulos.includes(b)||b.disabled)return;
      const action=b.getAttribute('onclick')||'',a=b.dataset.accion||'',texto=b.textContent.replace(/\s+/g,' ').trim();
      if(!texto||/importar|n[oó]mina excel|subir.*excel/i.test(texto)||/importarEstudiantes|SubirNominaExcel|toggleDropdown|imprimir|guardarRegistro|guardarNotasBoletin/i.test(action)||['nuevo','vista-movil','mover','restaurar'].includes(a)||(!action&&!['copiar','recargar'].includes(a)&&!b.matches('[data-publicar-registro],[data-publicar-boletin]')))return;
      const key=/publicar/i.test(action+texto)?'publicar':texto.toLowerCase();if(usados.has(key))return;usados.add(key);agregar(texto,()=>b.click(),b.disabled);
    });
    const afiliacion=[...document.querySelectorAll('.docente-sidebar-item,.admin-sidebar-item,.admin-sidebar-subitem')].find(b=>/afiliaci[oó]n/i.test(b.textContent));
    if(afiliacion)agregar('Afiliación de estudiantes',()=>afiliacion.click());
    const estadisticas=ctx.root.querySelector('.calif-stats-pills');if(estadisticas){const detalle=document.createElement('details');detalle.innerHTML='<summary>Resumen de rendimiento</summary>';detalle.append(estadisticas.cloneNode(true));d.append(detalle);}
    document.body.append(d);window.mostrarDialogoAcademico?window.mostrarDialogoAcademico(d):d.showModal();
  }
  function boletinMovil(ctx){
    const origen=ctx.root.querySelector('table.cen-digital-table,table.calif-revisar-table-clean');if(!origen)return;
    if(actual.tabla!==origen){
      ctx.root.querySelector('.boletin-tabla-movil')?.remove();
      const heads=[...origen.querySelectorAll('thead th')],prom=heads.findIndex(th=>/^PROMEDIO/i.test(th.textContent.trim())),cuantos=Math.max(0,prom-2);
      const cont=document.createElement('div');cont.className='movil-planilla-scroll boletin-tabla-movil';cont.dataset.notasMovilUi='true';
      cont.innerHTML='<table class="movil-planilla" aria-label="Boletín centralizador móvil" style="width:'+(338+cuantos*38+(heads.length>prom+2?76:0))+'px"><thead><tr><th class="movil-numero">N°</th><th class="movil-nombre">Estudiantes</th>'+heads.slice(2,prom).map(th=>'<th class="movil-dimension"><span title="'+esc(th.textContent.trim())+'">'+esc(th.textContent.replace(/\s+/g,' ').trim())+'</span></th>').join('')+'<th class="movil-observacion">Estado</th>'+(heads.length>prom+2?'<th class="movil-subido">Notas subidas</th>':'')+'<th class="movil-final"><span>Promedio final</span></th></tr></thead><tbody></tbody></table>';
      const encabezado = cont.querySelector('thead .movil-final span');
      const activador = heads[prom]?.querySelector('[data-activar-promedios]');
      if (activador) encabezado.replaceChildren(activador.cloneNode(true));
      cont.querySelector('table').classList.toggle('boletin-promedios-editables', origen.classList.contains('boletin-promedios-editables'));
      const cuerpo=cont.querySelector('tbody'),espejos=[];
      [...origen.querySelectorAll('tbody tr')].filter(row=>row.cells.length>prom+1).forEach((row,idx)=>{
        const tr=document.createElement('tr');tr.dataset.filaBoletinMovil=idx;
        tr.innerHTML='<td class="movil-numero">'+esc(row.cells[0].textContent.trim())+'</td><td class="movil-nombre" title="'+esc(row.cells[1].textContent)+'"><span>'+esc(row.cells[1].textContent)+'</span></td>'+Array(cuantos).fill('<td class="movil-dimension"></td>').join('')+'<td class="movil-observacion"></td>'+(heads.length>prom+2?'<td class="movil-subido"></td>':'')+'<td class="movil-final"><span class="movil-nota-final"></span></td>';
        row.querySelectorAll('.cen-digital-nota-input:not([data-promedio-boletin])').forEach((input,i)=>{const copia=input.cloneNode();copia.removeAttribute('id');copia.removeAttribute('style');copia.removeAttribute('oninput');copia.className='movil-centralizador-nota';copia.dataset.columna=i;copia.oninput=()=>{if(copia.value!==''&&Number.isFinite(Number(copia.value))&&Number(copia.value)>=0&&Number(copia.value)<=100)copia.value=Math.round(Number(copia.value));input.value=copia.value;if(input.id.startsWith('cen-input-')&&window.editarNotaBoletinMovil)Promise.resolve(window.editarNotaBoletinMovil(input,copia.value)).then(()=>{if(input.isConnected)copia.value=input.value;programar();}).catch(e=>aviso(e.message));else input.dispatchEvent(new Event(input.hasAttribute('oninput')?'input':'change',{bubbles:true}));copia.value=input.value;programar();};copia.onfocus=()=>copia.select();tr.cells[i+2].append(copia);espejos.push({input,copia});});
        if(!row.querySelector('.cen-digital-nota-input:not([data-promedio-boletin])'))for(let i=0;i<cuantos;i++)tr.cells[i+2].textContent=row.cells[i+2].textContent.trim();
        const celdaPromedio = tr.querySelector('.movil-final');
        celdaPromedio.innerHTML = window.controlPromedioBoletinMovil(idx);
        const celdaEstado = tr.querySelector('.movil-observacion');
        celdaEstado.dataset.estadoBoletinFila = idx;
        celdaEstado.dataset.estadoBoletinVista = row.cells[prom+1].querySelector('.boletin-estado-control select') ? 'movil' : '';
        celdaEstado.innerHTML = window.estadoCentralizadorMovil(idx, celdaEstado.dataset.estadoBoletinVista === 'movil');
        const check=row.cells[prom+2]?.querySelector('input[type=checkbox]');if(check){const label=document.createElement('label'),copia=check.cloneNode();copia.removeAttribute('onchange');copia.onchange=()=>{check.checked=copia.checked;check.dispatchEvent(new Event('change',{bubbles:true}));};label.append(copia,' Subido');tr.querySelector('.movil-subido').append(label);}
        cuerpo.append(tr);
      });
      if(!cuerpo.children.length)cuerpo.innerHTML='<tr><td colspan="'+heads.length+'">No hay estudiantes en este paralelo.</td></tr>';
      cont.addEventListener('focusin',e=>{const fila=e.target.closest('tbody tr');if(fila){cuerpo.querySelectorAll('.row-eval-active').forEach(r=>r.classList.remove('row-eval-active'));fila.classList.add('row-eval-active');window.asegurarNotaMovil?.(e.target);requestAnimationFrame(()=>window.asegurarNotaMovil?.(e.target));}});
      cont.addEventListener('keydown',e=>{if(!e.target.matches('.movil-centralizador-nota')||!['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Enter'].includes(e.key))return;const inputs=[...cont.querySelectorAll('.movil-centralizador-nota')],vertical=['ArrowDown','ArrowUp','Enter'].includes(e.key),grupo=vertical?inputs.filter(i=>i.dataset.columna===e.target.dataset.columna):inputs;const destino=grupo[grupo.indexOf(e.target)+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)];e.preventDefault();if(destino){destino.focus({preventScroll:true});destino.select();window.asegurarNotaMovil?.(destino);}});
      origen.after(cont);actual.tabla=origen;actual.espejos=espejos;actual.prom=prom;actual.cuantos=cuantos;actual.cuerpo=cuerpo;
      marcar(origen,'boletin-tabla-origen-movil');
    }
    actual.espejos.forEach(({input,copia})=>{if(document.activeElement!==copia)copia.value=input.value;copia.readOnly=input.readOnly;copia.disabled=input.disabled;});
    [...origen.querySelectorAll('tbody tr')].filter(row=>row.cells.length>actual.prom+1).forEach((row,i)=>{
      const tr=actual.cuerpo.children[i];if(!tr)return;
      const celda = row.cells[actual.prom], circulo = tr.querySelector('[data-valor-promedio]');
      const valor = celda.querySelector('[data-valor-promedio]')?.textContent ?? celda.textContent.trim();
      if (circulo.textContent !== valor) circulo.textContent = valor;
      circulo.dataset.estado = Number.isFinite(Number(valor)) ? (Number(valor)>=51?'aprobado':'postergado') : 'pendiente';
      const campo = tr.querySelector('[data-promedio-boletin]');
      if (document.activeElement !== campo) campo.value = valor === '-' ? '' : valor;
      if(!row.querySelector('.cen-digital-nota-input:not([data-promedio-boletin])'))for(let c=0;c<actual.cuantos;c++){const texto=row.cells[c+2].textContent.trim();if(tr.cells[c+2].textContent!==texto)tr.cells[c+2].textContent=texto;}
      const check=row.querySelector('input[type=checkbox]'),copia=tr.querySelector('input[type=checkbox]');if(check&&copia){copia.checked=check.checked;copia.disabled=check.disabled;}
    });
  }
  function actualizar(){
    const ctx=contexto();
    if(!ctx){document.body.classList.remove('notas-movil-teclado');actual?.ribbon.remove();actual=null;document.querySelector('.notas-movil-pie')?.remove();document.querySelector('.notas-movil-menu')?.close();if(document.body.classList.contains('movil-grados-activos'))document.body.classList.remove('movil-grados-activos');return;}
    if(!document.body.classList.contains('movil-grados-activos'))document.body.classList.add('movil-grados-activos');
    barra(ctx);if(!actual)return;
    document.querySelectorAll('[data-notas-movil-ui] select').forEach(s=>{const fuente=s._fuenteNotasMovil;if(fuente?.isConnected){s.disabled=fuente.disabled;if(s.value!==fuente.value)s.value=fuente.value;}});
    if(ctx.tipo==='boletin'){
      boletinMovil(ctx);
      [...ctx.root.children].filter(el=>el!==actual.ribbon&&el.tagName!=='TEMPLATE'&&!el.querySelector('table.cen-digital-table,table.calif-revisar-table-clean')).forEach(el=>marcar(el,'notas-movil-origen'));
      const tabla=ctx.root.querySelector('table.cen-digital-table,table.calif-revisar-table-clean');marcar(tabla?.parentElement,'notas-movil-tabla-contenedor');tabla?.parentElement.querySelectorAll(':scope > div:not(.boletin-tabla-movil)').forEach(el=>marcar(el,'notas-movil-origen'));
    }
    window.prepararSelectoresNotasMovil?.();actualizarPie();
    const nota = document.activeElement;
    if (nota?.matches(selectorNotaMovil)) window.asegurarNotaMovil?.(nota);
  }
  function programar(){if(pendiente)return;pendiente=true;requestAnimationFrame(()=>{pendiente=false;actualizar();});}
  function iniciar(){
    new MutationObserver(cambios=>{if(cambios.some(c=>!c.target.closest?.('[data-notas-movil-ui]')&&!c.target.parentElement?.closest('[data-notas-movil-ui]')))programar();}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden','disabled','aria-busy']});
    document.addEventListener('focusin', programar);
    document.addEventListener('focusout', evento => {
      if (evento.target.matches(selectorNotaMovil)) {
        focoNotaReciente = Date.now() + 450;
        setTimeout(programar, 460);
      }
      programar();
    });
    document.addEventListener('input',programar);document.addEventListener('change',programar);window.addEventListener('cea-edicion-academica',programar);window.addEventListener('resize',programar);window.visualViewport?.addEventListener('resize',programar);window.visualViewport?.addEventListener('scroll',programar);programar();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();
