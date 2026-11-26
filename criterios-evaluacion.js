/* Evaluacion opcional por criterios, privada de la cuenta docente. */
(function () {
  'use strict';
  const estados = new Map();
  const precargados = new Map(), consultas = new Map(), cargas = new Map();
  let epocaCache = 0;
  const claveCache = (token,id) => JSON.stringify([token,String(id)]);
  async function consultarCriterios(registro,token){
    const clave=claveCache(token,registro.id);
    if(precargados.has(clave))return structuredClone(precargados.get(clave));
    if(!consultas.has(clave)){
      const epoca=epocaCache;
      const promesa=(async()=>{
        const payload={action:'obtener-criterios-evaluacion',registro,token};
        const respuesta=window.ceaPersistencia?.request?await window.ceaPersistencia.request(payload):await enviarGoogleSheet(payload);
        if(respuesta.status!=='success'||!respuesta.criteriosEvaluacion)throw Error('No se pudieron cargar los criterios. Actualiza la implementación del servidor.');
        if(sesion().token===token&&epoca===epocaCache)precargados.set(clave,structuredClone(respuesta.criteriosEvaluacion));
        return respuesta.criteriosEvaluacion;
      })();
      consultas.set(clave,promesa);promesa.finally(()=>{if(consultas.get(clave)===promesa)consultas.delete(clave);}).catch(()=>{});
    }
    const pendiente=consultas.get(clave),epoca=epocaCache;
    const datos=await pendiente;
    if(epoca!==epocaCache&&sesion().token===token){if(consultas.get(clave)===pendiente)consultas.delete(clave);return consultarCriterios(registro,token);}
    return structuredClone(datos);
  }
  const key = (detalle, criterio) => JSON.stringify([String(detalle), String(criterio)]);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sesion = () => lsGet('cea_session', {}) || {};
  const limites = tipo => tipo === 'tecnica' ? {ser:10,saber:30,decidir:10,proceso:20,producto:20,autoevaluacion:10} : {ser:10,saber:40,hacer:30,decidir:10,autoevaluacion:10};
  const titulo = d => ({ser:'Ser',saber:'Saber',decidir:'Decidir',hacer:'Hacer',proceso:'Hacer · Proceso',producto:'Hacer · Producto',autoevaluacion:'Autoevaluación'}[d]);
  const nombre = d => [d.paterno,d.materno,d.nombres].filter(Boolean).join(' ') || d.nombreCompleto || d.ci || 'Estudiante';
  const valor = v => v == null || v === '' ? '' : Number(v);
  const dimensionesConversion=s=>Object.keys(limites(s.registro.tipo));
  function grupo(s, dimension) { return s.data.criterios.filter(c => c.activo && c.dimension === dimension); }
  function media(s, detalleId, dimension) {
    const criterios=grupo(s,dimension), ns=criterios.map(c=>s.notas.get(key(detalleId,c.id))).filter(v=>v!==''&&v!=null);
    if(!ns.length)return {valor:null,completo:false,cuenta:0,total:criterios.length};
    const promedio=ns.reduce((a,b)=>a+Number(b),0)/ns.length;
    return {valor:Math.round(s.data.sobre100 ? promedio*limites(s.registro.tipo)[dimension]/100 : promedio),completo:ns.length===criterios.length,cuenta:ns.length,total:criterios.length};
  }
  function ajuste(s, detalle, dimension) {
    const anterior=s.data.resultados.find(r=>r.detalleId===String(detalle.id)&&r.dimension===dimension);
    return anterior && String(valor(detalle[dimension]))!==String(valor(anterior.valor));
  }
  function marcar(s, dimension) {
    s.version++; if(dimension)s.tocadas.add(dimension);
    window.registrarCambioCriteriosCalif?.();
    s.host.querySelector('[data-estado-criterios]').textContent='Cambios pendientes. Pulsa Guardar en la cabecera para confirmarlos.';
  }
function distribuirCriteriosCEA(nota, maximo, escala, cantidad, semilla) {
  if(!cantidad)return [];
  const unidad=1, tope=Math.round(escala);
  const suma=Math.round(Math.max(0,Math.min(maximo,Math.round(Number(nota))))*escala/maximo*unidad*cantidad);
  const base=Math.floor(suma/cantidad), resto=suma-base*cantidad;
  const valores=Array.from({length:cantidad},(_,i)=>base+(i<resto?1:0));
  let hash=0;for(const c of String(semilla || ''))hash=(hash*31+c.charCodeAt(0))>>>0;
  for(let i=0;i<Math.floor(cantidad/2);i++){
    const j=cantidad-1-i, margen=Math.min(valores[j],tope-valores[i]);
    const amplitud=Math.min(margen,Math.round(tope*0.15));
    const cambio=Math.round(amplitud*(i+1)/(Math.floor(cantidad/2)+1)*(0.5+(hash%6)/10));
    valores[i]+=cambio;valores[j]-=cambio;
  }
  return valores.map(v=>v/unidad);
}

  function bloquearPromedios(s){
    const container=s.host.closest('#docente-planilla-container');
    container?.querySelectorAll('.calif-input-nota').forEach(input=>{
      if(input.disabled)return;
      const dim=input.dataset.col;
      input.readOnly=!!(s.data.habilitado&&Object.prototype.hasOwnProperty.call(limites(s.registro.tipo),dim)&&!s.editables.has(dim));
    });
    container?.querySelectorAll('.calif-mobile-grades input[data-campo]').forEach(input=>{
      const dim=input.dataset.campo;input.readOnly=!!(s.data.habilitado&&Object.prototype.hasOwnProperty.call(limites(s.registro.tipo),dim)&&!s.editables.has(dim));
    });
  }
  function oficial(s,d,dim,v){
    if(window._registroActivo?.id!==s.registro.id)return;
    const idx=window._detallesActivos?.findIndex(f=>String(f.id)===String(d.id));
    if(idx==null||idx<0)return;
    const input=s.host.closest('#docente-planilla-container')?.querySelector('.calif-input-nota[data-idx="'+idx+'"][data-col="'+dim+'"]');
    if(input){input.value=v==null?'':v;s.aplicando=true;try{window.alCambiarNota(input,idx,dim);Object.assign(d,window._detallesActivos[idx]);}finally{s.aplicando=false;}}
  }
  function numeral(s,d){
    return Object.keys(limites(s.registro.tipo)).some(dim=>d[dim]!==''&&d[dim]!=null)?d.notaFinal??'-':'-';
  }
  function observacion(s,d,movil=false){
    const idx=s.detalles.findIndex(f=>String(f.id)===String(d.id));
    const html=window.controlObservacionCriteriosCalif?.(d,idx) || esc(d.observacion||'-');
    return movil?html.replaceAll('criterios-opciones-obs-','criterios-movil-opciones-obs-'):html;
  }
  function refrescarFinales(s){
    s.host.querySelectorAll('[data-numeral-detalle]').forEach(el=>{const d=s.detalles.find(f=>String(f.id)===el.dataset.numeralDetalle);if(d){el.textContent=numeral(s,d);if(el.classList.contains('movil-nota-final'))el.dataset.estado=numeral(s,d)==='-'?'pendiente':Number(numeral(s,d))>=51?'aprobado':'postergado';}});
    s.host.querySelectorAll('[data-observacion-detalle]').forEach(el=>{const d=s.detalles.find(f=>String(f.id)===el.dataset.observacionDetalle);if(!d)return;const html=observacion(s,d,!!el.closest('.criterios-final-movil'));if(el.dataset.resultado!==html){el.innerHTML=html;el.dataset.resultado=html;}});
  }
  function ajustar(s,d,dim,v){
    const cs=grupo(s,dim);if(!s.data.habilitado||!cs.length)return;
    const ns=v===''||v==null?cs.map(()=> ''):distribuirCriteriosCEA(v,limites(s.registro.tipo)[dim],s.data.sobre100?100:limites(s.registro.tipo)[dim],cs.length,String(d.id)+dim);
    cs.forEach((c,i)=>{const k=key(d.id,c.id);s.notas.set(k,ns[i]);s.origenes.set(k,'automatico');});
    s.forzadas.delete(key(d.id,dim));marcar(s,dim);
  }
  function menuPromedio(s,dim,x,y){
    if(!Object.prototype.hasOwnProperty.call(limites(s.registro.tipo),dim))return;
    document.querySelector('.criterios-menu')?.remove();
    const menu=document.createElement('div');menu.className='criterios-menu';menu.setAttribute('role','menu');
    const btn=document.createElement('button');btn.type='button';btn.textContent=s.editables.has(dim)?'Bloquear promedio':'Editar promedio';btn.setAttribute('role','menuitem');
    btn.onclick=()=>{if(s.editables.has(dim))s.editables.delete(dim);else s.editables.add(dim);menu.remove();refrescar(s);bloquearPromedios(s);s.host.querySelector('[data-estado-criterios]').textContent='Edición de promedios de '+titulo(dim)+(s.editables.has(dim)?' habilitada hasta guardar o salir del registro.':' bloqueada.');};
    menu.append(btn);document.body.append(menu);menu.style.left=Math.max(8,Math.min(x,innerWidth-160))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-60))+'px';btn.focus();
    const cerrar=e=>{if(!menu.contains(e.target)){menu.remove();document.removeEventListener('pointerdown',cerrar,true);}};
    document.addEventListener('pointerdown',cerrar,true);menu.addEventListener('keydown',e=>{if(e.key==='Escape')menu.remove();});
  }
  function resultado(s, detalle, dimension) {
    const m=media(s,detalle.id,dimension),max=limites(s.registro.tipo)[dimension],editable=s.editables.has(dimension);
    return `<input class="criterio-promedio-input" type="number" inputmode="numeric" min="0" max="${max}" step="1" value="${esc(m.valor??detalle[dimension]??'')}" ${editable?'':'readonly'} data-detalle="${esc(detalle.id)}" data-dimension="${dimension}" title="${esc('Doble clic o doble toque para editar. '+(m.completo?'Promedio completo':'Promedio provisional: faltan criterios')+' · '+m.cuenta+'/'+m.total+' criterios')}" aria-label="Promedio de ${titulo(dimension)}: ${esc(nombre(detalle))}"><small>${grupo(s,dimension).some(c=>s.origenes.get(key(detalle.id,c.id))==='automatico')?'Ajustado automáticamente · ':''}${m.cuenta} de ${m.total} criterios${m.completo?'':' · Provisional'}</small>`;
  }

  function inputNota(s,d,c) {
    const v=s.notas.get(key(d.id,c.id)) ?? '';
    const max=s.data.sobre100?100:limites(s.registro.tipo)[c.dimension];
    return `<input type="number" class="criterio-nota" min="0" max="${max}" step="1" inputmode="numeric" enterkeyhint="next" aria-label="${esc(nombre(d))}: ${esc(c.titulo)}, sobre ${max}" placeholder="—" value="${esc(v)}" title="${s.origenes.get(key(d.id,c.id))==='automatico'?'Ajustado automáticamente desde la nota oficial':'Evaluación manual'}" data-origen="${s.origenes.get(key(d.id,c.id)) || 'manual'}" data-detalle="${esc(d.id)}" data-criterio="${esc(c.id)}">`;
  }
  function ajustarTituloCriterio(texto,medidor,ancho,maxLineas){
    let resto=String(texto||'').replace(/\s+/g,' ').trim();const lineas=[];
    while(resto&&lineas.length<maxLineas){
      if(medidor.measureText(resto).width<=ancho){lineas.push(resto);resto='';break;}
      const letras=Array.from(resto);let bajo=1,alto=letras.length;
      while(bajo<alto){const medio=Math.ceil((bajo+alto)/2);if(medidor.measureText(letras.slice(0,medio).join('')).width<=ancho)bajo=medio;else alto=medio-1;}
      let corte=bajo;const espacio=letras.slice(0,corte).lastIndexOf(' ');if(espacio>0)corte=espacio;
      lineas.push(letras.slice(0,corte).join('').trim());resto=letras.slice(corte).join('').trim();
    }
    if(resto){let ultima=lineas.pop()||'';while(ultima&&medidor.measureText(ultima+'...').width>ancho)ultima=Array.from(ultima).slice(0,-1).join('');lineas.push(ultima.trimEnd()+'...');}
    return lineas.length?lineas:[''];
  }
  function anchoNotasCriterio(s,c,ctx){
    const valores=new Set(['0']);
    for(const d of s.detalles){const v=s.notas.get(key(d.id,c.id));if(v!==''&&v!=null)valores.add(String(v));}
    return Math.max(28,Math.ceil(Math.max(...[...valores].map(v=>ctx.measureText(v).width)))+12);
  }
  function anchoPromedioCriterio(s,dim,ctx){
    const cantidad=grupo(s,dim).length;
    const minimo=cantidad===0?112:cantidad===1?76:cantidad===2?48:28;
    return Math.max(minimo,Math.ceil(Math.max(0,...s.detalles.map(d=>ctx.measureText(String(media(s,d.id,dim).valor??d[dim]??'0')).width)))+12);
  }
  function actualizarAnchosCriterios(s){
    const tabla=s.host.querySelector('.criterios-registro');if(!tabla||!s.medidasColumnas)return;
    const ctx=s.medidorColumnas||(s.medidorColumnas=document.createElement('canvas').getContext('2d'));
    ctx.font='700 '+(parseFloat(getComputedStyle(document.documentElement).fontSize)*.9)+'px '+getComputedStyle(tabla).fontFamily;
    let diferencia=0;
    for(const c of s.data.criterios.filter(c=>c.activo)){
      const info=s.medidasColumnas.get(c.id),col=tabla.querySelector('col[data-criterio-col="'+CSS.escape(c.id)+'"]');if(!info||!col)continue;
      const ancho=Math.max(anchoNotasCriterio(s,c,ctx),info.lineas.length*14+8);
      diferencia+=ancho-info.ancho;info.ancho=ancho;col.style.width=ancho+'px';
    }
    ctx.font='800 '+(parseFloat(getComputedStyle(document.documentElement).fontSize)*.9)+'px '+getComputedStyle(tabla).fontFamily;
    for(const dim of Object.keys(limites(s.registro.tipo))){
      const col=tabla.querySelector('col[data-promedio-col="'+dim+'"]');if(!col)continue;
      const ancho=anchoPromedioCriterio(s,dim,ctx);diferencia+=ancho-parseFloat(col.style.width);col.style.width=ancho+'px';
    }
    if(diferencia)tabla.style.width=(parseFloat(tabla.style.width)+diferencia)+'px';
  }
  function tablaCriterios(s,dimensiones){
    const campos=['paterno','materno','nombres'],etiquetas=['APELLIDO PATERNO','APELLIDO MATERNO','NOMBRES'];
    const base=s.host.closest('#docente-planilla-container')?.querySelector('.calif-eval-table');
    const fuente=getComputedStyle(base||s.host),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
    ctx.font='600 '+fuente.fontSize+' '+fuente.fontFamily;
    const anchos=campos.map((campo,i)=>Math.ceil(Math.max(i===2?78:86,...s.detalles.map(d=>ctx.measureText(String(d[campo]||'')).width+20))));
    ctx.font='700 12px '+fuente.fontFamily;
    const titulos=new Map(s.data.criterios.filter(c=>c.activo).map(c=>[c.id,{lineas:ajustarTituloCriterio(c.titulo,ctx,160,4)}]));
    ctx.font='700 '+(parseFloat(getComputedStyle(document.documentElement).fontSize)*.9)+'px '+fuente.fontFamily;
    for(const c of s.data.criterios.filter(c=>c.activo)){const info=titulos.get(c.id);info.ancho=Math.max(anchoNotasCriterio(s,c,ctx),info.lineas.length*14+8);}
    s.medidasColumnas=titulos;
    ctx.font='800 '+(parseFloat(getComputedStyle(document.documentElement).fontSize)*.9)+'px '+fuente.fontFamily;
    const promedios=new Map(dimensiones.map(dim=>[dim,anchoPromedioCriterio(s,dim,ctx)]));
    const columnasNotas=dimensiones.map(dim=>grupo(s,dim).map(c=>'<col data-criterio-col="'+esc(c.id)+'" style="width:'+titulos.get(c.id).ancho+'px">').join('')+'<col data-promedio-col="'+dim+'" style="width:'+promedios.get(dim)+'px">').join('');
    const anchoNotas=dimensiones.reduce((n,dim)=>n+promedios.get(dim)+grupo(s,dim).reduce((n,c)=>n+titulos.get(c.id).ancho,0),0);
    const hetero=dimensiones.filter(dim=>dim!=='autoevaluacion'),columnasHetero=hetero.reduce((total,dim)=>total+grupo(s,dim).length+1,0),columnasAuto=grupo(s,'autoevaluacion').length+1,columnas=columnasHetero+columnasAuto,ancho=44+anchos.reduce((a,b)=>a+b,0)+anchoNotas+240;
    const estilo='font-size:'+fuente.fontSize+';font-family:'+fuente.fontFamily+';width:'+ancho+'px;--criterios-paterno:'+anchos[0]+'px;--criterios-materno:'+anchos[1]+'px;--criterios-nombres:'+anchos[2]+'px';
    const cabecera=dim=>grupo(s,dim).map(c=>`<th class="criterio-cabecera-vertical" data-criterio-cabecera="${esc(c.id)}" tabindex="0" scope="col" title="Doble clic para editar. Mantén pulsado para mover: ${esc(c.titulo)}"><span class="criterio-titulo-ajustado" aria-label="${esc(c.titulo)}">${titulos.get(c.id).lineas.map(linea=>'<span>'+esc(linea)+'</span>').join(' ')}</span></th>`).join('')+`<th class="criterio-cabecera-vertical criterio-cabecera-promedio" scope="col" data-promedio-dimension="${dim}" tabindex="0" title="Doble clic para editar el promedio"><span class="criterio-titulo-vertical">PROMEDIO (${limites(s.registro.tipo)[dim]})</span></th>`;
    return `<div class="criterios-tabla-wrap calif-table-responsive"><table class="criterios-tabla criterios-registro" style="${esc(estilo)}" aria-label="Registro de evaluación con criterios"><colgroup><col style="width:44px">${anchos.map(a=>'<col style="width:'+a+'px">').join('')}${columnasNotas}<col style="width:80px"><col style="width:160px"></colgroup><thead><tr><th rowspan="3" class="criterios-identidad criterios-numero th-main-cat" scope="col">N°</th><th colspan="3" class="th-main-cat">NÓMINA DE PARTICIPANTES</th><th colspan="${columnasHetero}" class="th-main-cat">HETEROEVALUACIÓN (90 PUNTOS)</th><th colspan="${columnasAuto}" rowspan="2" class="th-main-cat criterios-autoevaluacion">AUTOEVALUACIÓN (10 PUNTOS)<button type="button" data-accion="nuevo" data-dimension="autoevaluacion" aria-label="Añadir criterio de Autoevaluación">+</button></th><th colspan="2" class="th-main-cat">CALIFICACIÓN FINAL</th></tr><tr>${campos.map((campo,i)=>`<th rowspan="2" class="criterios-identidad criterios-${campo} th-sub-cat" scope="col">${etiquetas[i]}</th>`).join('')}${hetero.map(dim=>`<th class="th-dimension" scope="colgroup" colspan="${grupo(s,dim).length+1}">${titulo(dim).toUpperCase()}<span class="calif-th-max">(${limites(s.registro.tipo)[dim]})</span><button type="button" data-accion="nuevo" data-dimension="${dim}" aria-label="Añadir criterio de ${titulo(dim)}">+</button></th>`).join('')}<th rowspan="2" class="th-sub-cat" scope="col">NUMERAL<br>(100)</th><th rowspan="2" class="th-sub-cat" scope="col">OBSERVACIÓN</th></tr><tr>${dimensiones.map(cabecera).join('')}</tr></thead><tbody>${s.detalles.map((d,i)=>`<tr data-fila-criterios="${esc(d.id)}" class="${s.filaActiva===String(d.id)?'criterio-fila-activa':''}"><td class="criterios-identidad criterios-numero">${i+1}</td>${campos.map(campo=>`<td class="criterios-identidad criterios-${campo}" title="${esc(d[campo]||'')}">${esc(d[campo]||'')}</td>`).join('')}${dimensiones.map(dim=>grupo(s,dim).map(c=>`<td class="criterio-nota-celda">${inputNota(s,d,c)}</td>`).join('')+`<td class="criterio-promedio" data-preview="${esc(key(d.id,dim))}">${resultado(s,d,dim)}</td>`).join('')}<td class="criterios-numeral" data-numeral-detalle="${esc(d.id)}">${esc(numeral(s,d))}</td><td class="criterios-observacion" data-observacion-detalle="${esc(d.id)}">${observacion(s,d)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function tablaCriteriosMovil(s,dimensiones){
    const cs=dim=>grupo(s,dim);
    const cantidad=dimensiones.reduce((n,dim)=>n+cs(dim).length+1,0),ancho=154+cantidad*38+144+40;
    return '<div class="movil-planilla-tools"><span>Desliza las notas</span></div><div class="criterios-tabla-wrap movil-planilla-scroll" tabindex="0" aria-label="Notas de estudiantes; desliza horizontalmente"><table class="criterios-tabla criterios-registro movil-planilla" style="width:'+ancho+'px" aria-label="Registro móvil con criterios"><colgroup><col style="width:26px"><col style="width:128px">'+Array(cantidad).fill('<col style="width:38px">').join('')+'<col style="width:144px"><col style="width:40px"></colgroup><thead><tr><th rowspan="2" class="criterios-identidad movil-numero">N°</th><th rowspan="2" class="criterios-identidad movil-nombre">Estudiantes</th>'+dimensiones.map(dim=>'<th class="movil-grupo" colspan="'+(cs(dim).length+1)+'">'+titulo(dim)+' ('+limites(s.registro.tipo)[dim]+')<button type="button" data-accion="nuevo" data-dimension="'+dim+'" aria-label="Añadir criterio de '+titulo(dim)+'">+</button></th>').join('')+'<th rowspan="2" class="movil-observacion">Observación</th><th rowspan="2" class="movil-final"><span>Nota final</span></th></tr><tr>'+dimensiones.map(dim=>cs(dim).map(c=>'<th class="movil-criterio" data-criterio-cabecera="'+esc(c.id)+'" tabindex="0" title="'+esc(c.titulo)+'"><span>'+esc(c.titulo)+'</span></th>').join('')+'<th class="movil-promedio" data-promedio-dimension="'+dim+'" tabindex="0"><span>'+titulo(dim)+' ('+limites(s.registro.tipo)[dim]+')</span></th>').join('')+'</tr></thead><tbody>'+s.detalles.map((d,i)=>'<tr data-fila-criterios="'+esc(d.id)+'" class="'+(s.filaActiva===String(d.id)?'criterio-fila-activa':'')+'"><td class="criterios-identidad movil-numero">'+(i+1)+'</td><td class="criterios-identidad movil-nombre" title="'+esc(nombre(d))+'"><span>'+esc(nombre(d))+'</span></td>'+dimensiones.map(dim=>cs(dim).map(c=>'<td class="criterio-nota-celda">'+inputNota(s,d,c)+'</td>').join('')+'<td class="criterio-promedio movil-promedio" data-preview="'+esc(key(d.id,dim))+'">'+resultado(s,d,dim)+'</td>').join('')+'<td class="criterios-observacion movil-observacion" data-observacion-detalle="'+esc(d.id)+'">'+observacion(s,d)+'</td><td class="movil-final"><span class="movil-nota-final" data-numeral-detalle="'+esc(d.id)+'" data-estado="'+(numeral(s,d)==='-'?'pendiente':Number(numeral(s,d))>=51?'aprobado':'postergado')+'">'+esc(numeral(s,d))+'</span></td></tr>').join('')+'</tbody></table></div>';
  }
  function actualizarDesplazamiento(s){
    const wrap=s.host.querySelector('.criterios-tabla-wrap'),barra=s.host.querySelector('.criterios-desplazamiento');if(!wrap||!barra)return;
    const tabla=wrap.querySelector('table'),css=getComputedStyle(tabla);
    const fijos=44+['paterno','materno','nombres'].reduce((n,c)=>n+(parseFloat(css.getPropertyValue('--criterios-'+c))||0),0);
    wrap.classList.toggle('criterios-identidad-libre',wrap.clientWidth-fijos<100);
    const max=Math.max(0,wrap.scrollWidth-wrap.clientWidth),rango=barra.querySelector('input');
    barra.hidden=max<2;rango.max=max;rango.value=wrap.scrollLeft;
    barra.querySelector('[data-desplazar="-1"]').disabled=wrap.scrollLeft<1;
    barra.querySelector('[data-desplazar="1"]').disabled=wrap.scrollLeft>=max-1;
  }
  function asegurarCeldaVisible(s,input){
    if(input.closest('.movil-planilla')){window.asegurarNotaMovil?.(input);return;}
    const wrap=input.closest('.criterios-tabla-wrap');if(!wrap)return;
    actualizarDesplazamiento(s);
    const r=wrap.getBoundingClientRect(),celda=input.getBoundingClientRect();
    const fila=input.closest('tr'),fijos=wrap.classList.contains('criterios-identidad-libre')?[]:[...fila.querySelectorAll('.criterios-identidad')];
    const izquierda=Math.max(r.left,0,...fijos.map(el=>el.getBoundingClientRect().right))+5,derecha=Math.min(r.right,innerWidth)-6;
    if(celda.left<izquierda)wrap.scrollLeft-=izquierda-celda.left;
    else if(celda.right>derecha)wrap.scrollLeft+=celda.right-derecha;
    actualizarDesplazamiento(s);
  }
  function prepararDesplazamiento(s){
    s.observadorAncho?.disconnect();
    const wrap=s.host.querySelector('.criterios-tabla-wrap');if(!wrap)return;
    const barra=document.createElement('div');barra.className='criterios-desplazamiento';
    barra.innerHTML='<span>Mover criterios</span><button type="button" data-desplazar="-1" aria-label="Desplazar criterios a la izquierda"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 6-6 6 6 6"/></svg></button><input type="range" min="0" step="1" value="0" aria-label="Desplazamiento horizontal de los criterios"><button type="button" data-desplazar="1" aria-label="Desplazar criterios a la derecha"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="m10 6 6 6-6 6"/></svg></button>';
    wrap.before(barra);
    barra.querySelector('input').oninput=e=>{wrap.scrollLeft=Number(e.target.value);};
    barra.querySelectorAll('button').forEach(b=>b.onclick=()=>{wrap.scrollLeft+=Number(b.dataset.desplazar)*Math.max(100,wrap.clientWidth*.4);actualizarDesplazamiento(s);});
    wrap.addEventListener('scroll',()=>actualizarDesplazamiento(s),{passive:true});
    wrap.addEventListener('wheel',e=>{if(e.shiftKey&&e.deltaY){e.preventDefault();wrap.scrollLeft+=e.deltaY;}},{passive:false});
    s.observadorAncho?.disconnect();s.observadorAncho=new ResizeObserver(()=>actualizarDesplazamiento(s));s.observadorAncho.observe(wrap);
    actualizarDesplazamiento(s);
  }
  function capturarVista(s){
    const tabla=s.host.querySelector('.criterios-tabla-wrap'),padres=[];
    for(let el=s.host.parentElement;el;el=el.parentElement)padres.push({el,x:el.scrollLeft,y:el.scrollTop});
    return {x:tabla?.scrollLeft||0,y:tabla?.scrollTop||0,padres};
  }
  function restaurarVista(s,vista){
    if(!s.host.isConnected)return;
    const tabla=s.host.querySelector('.criterios-tabla-wrap');
    if(tabla){tabla.scrollLeft=vista.x;tabla.scrollTop=vista.y;}
    for(const {el,x,y} of vista.padres)if(el.isConnected){el.scrollLeft=x;el.scrollTop=y;}
  }
  function dibujar(s) {
    if(!s.host.isConnected)return;
    const vista=capturarVista(s),redibujo=s.redibujo=(s.redibujo||0)+1;
    s.host.closest('#docente-planilla-container')?.classList.toggle('calif-con-criterios',!!s.data.habilitado);
    const movil=window.matchMedia('(max-width:900px)').matches;
    const dimensiones=Object.keys(limites(s.registro.tipo));
    if(!dimensiones.includes(s.dimension))s.dimension=dimensiones[0];
    const d=s.detalles.find(d=>String(d.id)===s.alumno) || s.detalles[0];
    if(d)s.alumno=String(d.id);
    bloquearPromedios(s);
    s.host.innerHTML=`<div class="criterios-interruptores">
      <label><input type="checkbox" role="switch" data-control="habilitado" ${s.data.habilitado?'checked':''}> Evaluar con criterios</label>
      ${s.data.habilitado?`<label><input type="checkbox" role="switch" data-control="sobre100" ${s.data.sobre100?'checked':''}> Evaluar criterios sobre 100</label>`:''}
      <span>${s.data.habilitado?(s.data.sobre100?'Cada criterio sobre 100; el promedio se convierte a la dimensión.':'Cada criterio sobre el máximo de su dimensión.'):'Sin criterios: continúa llenando las dimensiones como hasta ahora.'}</span>
      <button type="button" data-accion="recargar">Recargar criterios guardados</button>
    </div><p data-estado-criterios role="status" aria-live="polite">${s.version!==s.confirmada?'Cambios pendientes de guardar.':'Preferencias cargadas. Activar esta opción no cambia las notas existentes.'}</p>
    ${s.data.habilitado?`<p class="criterios-ayuda">Añade criterios con +. Las notas oficiales se mantienen hasta completar los criterios y pulsar Guardar. La autoevaluación admite sus propios criterios y suma hasta 10 puntos a la calificación final.</p><button type="button" data-accion="copiar">Copiar criterios de otro módulo</button>
    ${movil ? tablaCriteriosMovil(s,dimensiones) : tablaCriterios(s,dimensiones)}<div class="criterios-movil"><label>Estudiante<select data-control="alumno">${s.detalles.map(d=>`<option value="${esc(d.id)}" ${String(d.id)===s.alumno?'selected':''}>${esc(nombre(d))}</option>`).join('')}</select></label><label>Dimensión<select data-control="dimension">${dimensiones.map(dim=>`<option value="${dim}" ${dim===s.dimension?'selected':''}>${titulo(dim)} (${limites(s.registro.tipo)[dim]})</option>`).join('')}</select></label><button type="button" data-accion="nuevo" data-dimension="${s.dimension}">+ Añadir criterio</button>${d?grupo(s,s.dimension).map(c=>`<div class="criterio-movil-fila"><label><span data-criterio-cabecera="${esc(c.id)}" tabindex="0" title="Doble toque para editar; mantén pulsado para mover">${esc(c.titulo)}</span> ${inputNota(s,d,c)}</label></div>`).join('')+`<div class="criterio-promedio" data-preview="${esc(key(d.id,s.dimension))}">${resultado(s,d,s.dimension)}</div><div class="criterios-final-movil"><strong>Calificación final · Numeral (100): <span data-numeral-detalle="${esc(d.id)}">${esc(numeral(s,d))}</span></strong><div class="criterios-observacion" data-observacion-detalle="${esc(d.id)}">${observacion(s,d,true)}</div></div>`:''}</div>
    ${s.data.criterios.some(c=>!c.activo)?`<details><summary>Criterios archivados</summary>${s.data.criterios.filter(c=>!c.activo).map(c=>`<p>${esc(c.titulo)} · ${titulo(c.dimension)} <button type="button" data-accion="restaurar" data-id="${esc(c.id)}">Recuperar</button></p>`).join('')}</details>`:''}
    <p class="criterios-ayuda">Las dimensiones sin criterios se pueden completar en su casilla de promedio. Los promedios incompletos no reemplazan las notas oficiales. Heteroevaluación: 90 puntos; autoevaluación: 10 puntos; calificación final: 100 puntos.</p>`:''}`;
    prepararDesplazamiento(s);restaurarVista(s,vista);
    requestAnimationFrame(()=>{if(s.redibujo===redibujo)restaurarVista(s,vista);});
  }
  function refrescar(s) {
    actualizarAnchosCriterios(s);
    refrescarFinales(s);
    s.host.querySelectorAll('[data-preview]').forEach(el=>{const [id,dim]=JSON.parse(el.dataset.preview);const d=s.detalles.find(d=>String(d.id)===id);if(d)el.innerHTML=resultado(s,d,dim);});
    s.host.querySelectorAll('.criterio-nota').forEach(input=>{const k=key(input.dataset.detalle,input.dataset.criterio);input.value=s.notas.get(k)??'';input.dataset.origen=s.origenes.get(k)||'manual';input.title=input.dataset.origen==='automatico'?'Ajustado automáticamente desde la nota oficial':'Evaluación manual';});
  }
  function abrirDialogoCriterios(dialog){if(window.mostrarDialogoAcademico)window.mostrarDialogoAcademico(dialog);else dialog.showModal();}
  function solicitarEliminarCriterio(s,criterio,editor){
    if(s.confirmacionEliminar?.open)return;
    const dialog=document.createElement('dialog');dialog.className='criterios-dialog criterios-confirmar-quitar';s.confirmacionEliminar=dialog;
    dialog.setAttribute('aria-labelledby','titulo-quitar-criterio');
    dialog.innerHTML='<h3 id="titulo-quitar-criterio">¿Quitar este criterio?</h3><p class="criterio-eliminacion-nombre">'+esc(criterio.titulo)+'</p><p>Sus calificaciones se eliminarán para todos los estudiantes de este módulo.</p><p>El cambio se confirma al pulsar <strong>Guardar</strong>. Las calificaciones de los demás criterios se mantienen.</p><div><button type="button" data-cancelar-quitar>Cancelar</button><button type="button" data-confirmar-quitar>Quitar criterio</button></div>';
    document.body.append(dialog);dialog.querySelector('[data-cancelar-quitar]').onclick=()=>dialog.close();
    if(s.data.eliminacionDefinitiva!==true){const aviso=document.createElement('p');aviso.setAttribute('role','alert');aviso.textContent='Actualiza Apps Script y publica una nueva versión para habilitar la eliminación definitiva.';dialog.querySelector('div').before(aviso);dialog.querySelector('[data-confirmar-quitar]').disabled=true;}
    dialog.addEventListener('close',()=>{dialog.remove();if(s.confirmacionEliminar===dialog)s.confirmacionEliminar=null;});
    dialog.querySelector('[data-confirmar-quitar]').onclick=()=>{
      if(s.original.criterios.some(c=>c.id===criterio.id))s.eliminados.add(criterio.id);
      s.data.criterios=s.data.criterios.filter(c=>c.id!==criterio.id);
      for(const k of [...s.notas.keys()])if(JSON.parse(k)[1]===criterio.id){s.notas.delete(k);s.origenes.delete(k);}
      marcar(s,criterio.dimension);
      for(const d of s.detalles){const m=media(s,d.id,criterio.dimension);if(m.completo){s.forzadas.add(key(d.id,criterio.dimension));oficial(s,d,criterio.dimension,m.valor);}else s.forzadas.delete(key(d.id,criterio.dimension));}
      dibujar(s);dialog.close();if(editor?.open)editor.close();
    };
    abrirDialogoCriterios(dialog);
  }
  function editar(s, dimension, criterio) {
    const vista=capturarVista(s),turno=s.dialogoVista=(s.dialogoVista||0)+1;s.dimension=dimension;
    const dialog=document.createElement('dialog');dialog.className='criterios-dialog';
    dialog.innerHTML=`<form><h3>${criterio?'Editar':'Añadir'} criterio de ${titulo(dimension)}</h3><label>Descripción del criterio<input name="titulo" required maxlength="180" value="${esc(criterio?.titulo || '')}" autocomplete="off"></label><p>Todos los criterios de la dimensión tienen el mismo valor en el promedio.</p><div>${criterio?'<button type="button" data-quitar-criterio>Quitar criterio</button>':''}<button type="button" data-cancelar>Cancelar</button><button type="submit">Aceptar</button></div></form>`;
    document.body.append(dialog);dialog.querySelector('[data-cancelar]').onclick=()=>dialog.close();
    const quitar=dialog.querySelector('[data-quitar-criterio]');if(quitar)quitar.onclick=()=>solicitarEliminarCriterio(s,criterio,dialog);
    dialog.addEventListener('close',()=>{dialog.remove();if(s.dialogoVista!==turno)return;restaurarVista(s,vista);requestAnimationFrame(()=>{if(s.dialogoVista===turno)restaurarVista(s,vista);});});
    dialog.querySelector('form').onsubmit=e=>{e.preventDefault();const titulo=dialog.querySelector('input').value.trim();if(!titulo)return;
      if(criterio)criterio.titulo=titulo;else s.data.criterios.push({id:crypto.randomUUID(),dimension,titulo,orden:s.data.criterios.length,activo:true});
      marcar(s,dimension);dibujar(s);dialog.close();dialog.remove();};abrirDialogoCriterios(dialog);
  }
  async function copiar(s) {
    const estado=s.host.querySelector('[data-estado-criterios]');
    estado.textContent='Consultando plantillas de tus módulos…';
    try {
      const respuesta=await enviarGoogleSheet({action:'obtener-plantillas-criterios'});
      if(sesion().token!==s.token||!s.host.isConnected)return;
      const plantillas=(respuesta.plantillas || []).filter(p=>p.id!==s.registro.id);
      if(!plantillas.length){estado.textContent='Todavía no tienes otro módulo con criterios guardados.';return;}
      const dialog=document.createElement('dialog');dialog.className='criterios-dialog';
      dialog.innerHTML=`<form><h3>Copiar criterios</h3><label>Módulo de origen<select name="origen">${plantillas.map(p=>`<option value="${esc(p.id)}">${esc([p.modulo,p.nivel,'Par. '+p.paralelo,p.gestion,p.semestre].join(' · '))}</option>`).join('')}</select></label><p>Solo se copiarán los criterios activos. Las notas de los estudiantes y los promedios anteriores no se copian.</p><p role="status"></p><div><button type="button" data-cancelar>Cancelar</button><button type="submit">Copiar</button></div></form>`;
      document.body.append(dialog);dialog.querySelector('[data-cancelar]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
      dialog.querySelector('form').onsubmit=async e=>{
        e.preventDefault();const boton=dialog.querySelector('[type="submit"]');boton.disabled=true;
        try {
          const origen=plantillas.find(p=>p.id===dialog.querySelector('select').value);
          const datos=await enviarGoogleSheet({action:'obtener-criterios-evaluacion',registro:{id:origen.id,areaKey:origen.areaKey}});
          if(sesion().token!==s.token||!s.host.isConnected){dialog.close();return;}
          let cantidad=0;
          for(const criterio of datos.criteriosEvaluacion.criterios){
            if(!criterio.activo||!Object.prototype.hasOwnProperty.call(limites(s.registro.tipo),criterio.dimension)||s.data.criterios.some(c=>c.activo&&c.dimension===criterio.dimension&&c.titulo===criterio.titulo))continue;
            s.data.criterios.push({...criterio,id:crypto.randomUUID(),orden:s.data.criterios.length});s.tocadas.add(criterio.dimension);cantidad++;
          }
          marcar(s);dibujar(s);s.host.querySelector('[data-estado-criterios]').textContent=`${cantidad} criterios copiados sin notas. Pulsa Guardar para confirmarlos.`;dialog.close();
        } catch(error){dialog.querySelector('[role="status"]').textContent=error.message;boton.disabled=false;}
      };dialog.showModal();
    } catch(error){estado.textContent=error.message;}
  }
  function moverCriterio(s,id,destino){
    const c=s.data.criterios.find(c=>c.id===id),otro=s.data.criterios.find(c=>c.id===destino);
    if(!c||!otro||c.id===otro.id||c.dimension!==otro.dimension||!c.activo||!otro.activo)return;
    const origen=s.data.criterios.indexOf(c),posicion=s.data.criterios.indexOf(otro);
    s.data.criterios.splice(origen,1);s.data.criterios.splice(posicion,0,c);marcar(s,c.dimension);dibujar(s);
  }
  function arrastreCriterios(s){
    let gesto=null;
    const limpiar=()=>{if(gesto)clearTimeout(gesto.timer);s.host.querySelectorAll('.criterio-arrastrando,.criterio-destino').forEach(el=>el.classList.remove('criterio-arrastrando','criterio-destino'));gesto=null;};
    s.host.addEventListener('pointerdown',e=>{
      const cab=e.target.closest('[data-criterio-cabecera]');if(!cab||e.button>0)return;
      limpiar();gesto={id:cab.dataset.criterioCabecera,x:e.clientX,y:e.clientY,activo:false,cab};
      gesto.timer=setTimeout(()=>{if(!gesto||!cab.isConnected)return;gesto.activo=true;cab.classList.add('criterio-arrastrando');try{cab.setPointerCapture(e.pointerId);}catch(error){}s.host.querySelector('[data-estado-criterios]').textContent='Mueve el criterio dentro de su dimensión y suelta para colocarlo.';},450);
    });
    s.host.addEventListener('pointermove',e=>{
      if(!gesto)return;if(!gesto.activo){if(Math.hypot(e.clientX-gesto.x,e.clientY-gesto.y)>10)limpiar();return;}
      e.preventDefault();const destino=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-criterio-cabecera]');
      const c=s.data.criterios.find(c=>c.id===gesto.id),otro=s.data.criterios.find(c=>c.id===destino?.dataset.criterioCabecera);
      s.host.querySelectorAll('.criterio-destino').forEach(el=>el.classList.remove('criterio-destino'));gesto.destino=null;
      if(otro&&otro.dimension===c.dimension&&otro.id!==c.id){gesto.destino=otro.id;destino.classList.add('criterio-destino');}
      const wrap=s.host.querySelector('.criterios-tabla-wrap');if(wrap){const r=wrap.getBoundingClientRect();if(e.clientX>r.right-30)wrap.scrollLeft+=14;else if(e.clientX<r.left+30)wrap.scrollLeft-=14;}
    });
    s.host.addEventListener('pointerup',e=>{
      if(!gesto)return;const g=gesto;limpiar();
      if(g.activo){s.ultimoCriterioToque=null;s.ignorarDobleCriterio=Date.now()+500;if(g.destino)moverCriterio(s,g.id,g.destino);return;}
      if(e.pointerType==='touch'){const ahora=Date.now();if(s.ultimoCriterioToque?.id===g.id&&ahora-s.ultimoCriterioToque.fecha<450){const c=s.data.criterios.find(c=>c.id===g.id);s.ultimoCriterioToque=null;s.ignorarDobleCriterio=ahora+500;editar(s,c.dimension,c);}else s.ultimoCriterioToque={id:g.id,fecha:ahora};}
    });
    s.host.addEventListener('pointercancel',limpiar);
  }
  function vincular(s) {
    arrastreCriterios(s);
    const seleccionarFila=e=>{const fila=e.target.closest('.criterios-registro tbody tr');if(!fila)return;s.filaActiva=fila.dataset.filaCriterios;s.host.querySelectorAll('.criterio-fila-activa').forEach(el=>el.classList.remove('criterio-fila-activa'));fila.classList.add('criterio-fila-activa');};
    s.host.addEventListener('click',seleccionarFila);s.host.addEventListener('focusin',seleccionarFila);
    s.host.addEventListener('focusin',e=>{if(e.target.matches('.criterio-nota,.criterio-promedio-input')){asegurarCeldaVisible(s,e.target);requestAnimationFrame(()=>{if(document.activeElement===e.target)asegurarCeldaVisible(s,e.target);});}});
    s.host.addEventListener('dblclick',e=>{
      const cab=e.target.closest('[data-criterio-cabecera]');if(cab){if(Date.now()<(s.ignorarDobleCriterio||0))return;const c=s.data.criterios.find(c=>c.id===cab.dataset.criterioCabecera);if(c)editar(s,c.dimension,c);return;}
      const celda=e.target.closest('[data-preview],[data-promedio-dimension]');if(!celda)return;
      e.preventDefault();menuPromedio(s,celda.dataset.promedioDimension||JSON.parse(celda.dataset.preview)[1],e.clientX,e.clientY);
    });
    s.host.addEventListener('pointerup',e=>{
      if(e.pointerType!=='touch')return;const celda=e.target.closest('[data-preview],[data-promedio-dimension]');if(!celda)return;
      const dim=celda.dataset.promedioDimension||JSON.parse(celda.dataset.preview)[1],ahora=Date.now();
      if(s.ultimoToque?.dim===dim&&ahora-s.ultimoToque.fecha<450){menuPromedio(s,dim,e.clientX,e.clientY);s.ultimoToque=null;}else s.ultimoToque={dim,fecha:ahora};
    });
    s.host.addEventListener('input', e=>{
      const input=e.target;
      if(input.matches('.criterio-promedio-input')){
        const dim=input.dataset.dimension,d=s.detalles.find(d=>String(d.id)===input.dataset.detalle);
        if(!s.editables.has(dim))return;
        if(input.value!==''&&Number.isFinite(Number(input.value))&&Number(input.value)>=0&&Number(input.value)<=Number(input.max))input.value=Math.round(Number(input.value));
        if(!input.checkValidity())return;
        if(String(valor(d[dim]))===String(valor(input.value)))return;
        oficial(s,d,dim,input.value===''?'':Number(input.value));ajustar(s,d,dim,input.value); 
        const m=media(s,d.id,dim),celda=input.closest('[data-preview]');
        const estado=celda?.querySelector('small');if(estado)estado.textContent='Ajustado automáticamente · '+m.cuenta+' de '+m.total+' criterios'+(m.completo?'':' · Provisional');
        s.host.querySelectorAll('[data-preview]').forEach(el=>{if(el===celda)return;const [id,dimension]=JSON.parse(el.dataset.preview),detalle=s.detalles.find(d=>String(d.id)===id);if(detalle)el.innerHTML=resultado(s,detalle,dimension);});
        // Preserve focus and entered text while synchronizing all criteria.
        s.host.querySelectorAll('.criterio-nota').forEach(i=>{const k=key(i.dataset.detalle,i.dataset.criterio);i.value=s.notas.get(k)??'';i.dataset.origen=s.origenes.get(k)||'manual';});refrescarFinales(s);actualizarAnchosCriterios(s);return;
      }
      if(!input.matches('.criterio-nota'))return;
      const c=s.data.criterios.find(c=>c.id===input.dataset.criterio), max=s.data.sobre100?100:limites(s.registro.tipo)[c.dimension];
      if(input.value!==''&&Number.isFinite(Number(input.value))&&Number(input.value)>=0&&Number(input.value)<=max)input.value=Math.round(Number(input.value));
      input.setCustomValidity(input.value!==''&&(!Number.isFinite(Number(input.value))||Number(input.value)<0||Number(input.value)>max)?`Escribe una nota entre 0 y ${max}.`:'');
      if(String(valor(s.notas.get(key(input.dataset.detalle,c.id))))===String(valor(input.value)))return;
      s.notas.set(key(input.dataset.detalle,c.id),input.value===''?'':Number(input.value));
      s.host.querySelectorAll('.criterio-nota').forEach(other=>{if(other!==input&&other.dataset.detalle===input.dataset.detalle&&other.dataset.criterio===c.id)other.value=input.value;});
      s.origenes.set(key(input.dataset.detalle,c.id),'manual');
      const d=s.detalles.find(d=>String(d.id)===input.dataset.detalle),m=media(s,d.id,c.dimension);
      if(m.completo){s.forzadas.add(key(d.id,c.dimension));oficial(s,d,c.dimension,m.valor);}
      marcar(s,c.dimension);refrescar(s);
    });
    s.host.addEventListener('change',e=>{
      const control=e.target.dataset.control;if(!control)return;
      if(control==='alumno'){s.alumno=e.target.value;dibujar(s);return;}
      if(control==='dimension'){s.dimension=e.target.value;dibujar(s);return;}
      if(control==='habilitado'){s.data.habilitado=e.target.checked;dibujar(s);window.dispatchEvent(new Event('cea-edicion-academica'));return;}
      if(control==='sobre100'){
        const sobre=e.target.checked;
        const anteriores=s.detalles.flatMap(d=>dimensionesConversion(s).map(dim=>({d,dim,m:media(s,d.id,dim)})));
        for(const c of s.data.criterios)for(const d of s.detalles){const k=key(d.id,c.id),v=s.notas.get(k);if(v!==''&&v!=null)s.notas.set(k,Math.round(sobre?v*100/limites(s.registro.tipo)[c.dimension]:v*limites(s.registro.tipo)[c.dimension]/100));}
        s.data.sobre100=sobre;
        // La conversión de escala conserva el promedio entero de cada grupo completo.
        for(const {d,dim,m} of anteriores){if(!m.completo)continue;const cs=grupo(s,dim),max=sobre?100:limites(s.registro.tipo)[dim];for(let intento=0;intento<cs.length*max;intento++){const actual=media(s,d.id,dim).valor;if(actual===m.valor)break;const paso=actual<m.valor?1:-1;const c=cs.find(c=>{const v=s.notas.get(key(d.id,c.id));return paso>0?v<max:v>0;});if(!c)break;const k=key(d.id,c.id);s.notas.set(k,s.notas.get(k)+paso);}}
      }else s.data.habilitado=e.target.checked;
      marcar(s);dibujar(s);
    });
    s.host.addEventListener('click',e=>{
      const btn=e.target.closest('[data-accion]');if(!btn)return;
      const accion=btn.dataset.accion,c=s.data.criterios.find(c=>c.id===btn.dataset.id);
      if(accion==='vista-movil'){s.vistaMovil=btn.dataset.vista;dibujar(s);return;}
      if(accion==='recargar'){
        if(s.version!==s.confirmada&&!confirm('Se descartarán los cambios de criterios sin guardar para consultar la versión del servidor. ¿Continuar?'))return;
        api.invalidate([s.registro.id]);estados.delete(s.registro.id);void api.mount(s.host.closest('#docente-planilla-container'),s.registro,s.detalles,'docente');return;
      }
      if(accion==='copiar')return void copiar(s);
      if(accion==='nuevo')return editar(s,btn.dataset.dimension);
      if(accion==='editar')return editar(s,c.dimension,c);
      if(accion==='aplicar'){s.forzadas.add(key(btn.dataset.detalle,btn.dataset.dimension));marcar(s,btn.dataset.dimension);refrescar(s);return;}
      if(accion==='archivar')return solicitarEliminarCriterio(s,c);
      if(accion==='restaurar')c.activo=true;
      if(accion==='mover'){const idx=s.data.criterios.indexOf(c),prev=s.data.criterios.slice(0,idx).findLastIndex(p=>p.activo&&p.dimension===c.dimension);if(prev>=0)[s.data.criterios[prev],s.data.criterios[idx]]=[s.data.criterios[idx],s.data.criterios[prev]];}
      marcar(s,c.dimension);dibujar(s);
    });
    s.host.addEventListener('keydown',e=>{
      const cab=e.target.closest('[data-criterio-cabecera]');if(cab){const c=s.data.criterios.find(c=>c.id===cab.dataset.criterioCabecera);if(e.key==='Enter'||e.key==='Delete'){e.preventDefault();editar(s,c.dimension,c);return;}if(e.altKey&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const cs=grupo(s,c.dimension),destino=cs[cs.indexOf(c)+(e.key==='ArrowLeft'?-1:1)];if(destino)moverCriterio(s,c.id,destino.id);return;}}
      if(e.target.dataset.promedioDimension&&['Enter',' '].includes(e.key)){e.preventDefault();const r=e.target.getBoundingClientRect();menuPromedio(s,e.target.dataset.promedioDimension,r.left,r.bottom);return;}
      if(e.target.matches('.criterio-promedio-input')&&['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Enter'].includes(e.key)){
        const inputs=[...s.host.querySelectorAll('.criterio-promedio-input:not([readonly])')].filter(i=>i.getClientRects().length);
        const vertical=['ArrowUp','ArrowDown','Enter'].includes(e.key),grupo=vertical?inputs.filter(i=>i.dataset.dimension===e.target.dataset.dimension):inputs;
        const destino=grupo[grupo.indexOf(e.target)+(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1)];e.preventDefault();if(destino){destino.focus({preventScroll:true});asegurarCeldaVisible(s,destino);destino.select();}return;
      }
      if(!e.target.matches('.criterio-nota')||!['ArrowRight','ArrowLeft','ArrowUp','ArrowDown','Enter'].includes(e.key))return;
      const inputs=[...s.host.querySelectorAll('.criterio-nota')].filter(i=>i.getClientRects().length);
      let destino;
      if(e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='Enter'){
        const mismos=inputs.filter(i=>i.dataset.criterio===e.target.dataset.criterio),idx=mismos.indexOf(e.target);
        destino=mismos[idx+(e.key==='ArrowUp'?-1:1)];
        if(!destino&&e.key==='Enter')destino=inputs[inputs.indexOf(e.target)+1];
      }else destino=inputs[inputs.indexOf(e.target)+(e.key==='ArrowLeft'?-1:1)];
      e.preventDefault();
      if(destino){destino.focus({preventScroll:true});asegurarCeldaVisible(s,destino);destino.select();}
    });
  }
  const api = window.ceaCriterios = {
    initialHTML(registro){
      if(sesion().role!=='docente')return '';
      const estado=estados.get(registro.id),dato=precargados.get(claveCache(sesion().token,registro.id));
      const habilitado=estado?.token===sesion().token?estado.data.habilitado:dato?.habilitado;
      return '<section class="criterios-panel" data-criterios-inicial aria-label="Evaluación por criterios"><div class="criterios-interruptores"><label><input type="checkbox" role="switch" data-control="habilitado" '+(habilitado?'checked':'')+'> Evaluar con criterios</label></div><div data-estado-carga role="status" aria-live="polite"></div></section>';
    },
    async awaitReady(id){const carga=cargas.get(id);if(!carga||carga.token!==sesion().token)return;const resultado=await carga.lista;if(resultado.error)throw resultado.error;},
    epoch:()=>epocaCache,
    preload(datos,token,epoca=epocaCache){
      if(epoca!==epocaCache||token!==sesion().token||sesion().role!=='docente'||!Array.isArray(datos))return;
      for(const dato of datos)if(dato?.registroId)precargados.set(claveCache(token,dato.registroId),structuredClone(dato));
    },
    invalidate(ids){
      epocaCache++;
      for(const id of ids){precargados.delete(claveCache(sesion().token,id));const s=estados.get(id);if(s)s.obsoleto=true;}
    },
    async mount(container,registro,detalles,modo,opciones={}) {
      if(modo!=='docente'||sesion().role!=='docente')return;
      container.classList.remove('calif-con-criterios');
      container.querySelector('.calif-eval-table')?.closest('.calif-table-responsive')?.classList.add('calif-registro-base');
      const inicial=container.querySelector('.criterios-panel[data-criterios-inicial]');
      if(!inicial)container.querySelector('.criterios-panel')?.remove();
      const host=inicial||document.createElement('section');host.removeAttribute('data-criterios-inicial');host.className='criterios-panel';host.setAttribute('aria-label','Evaluación por criterios');
      const referencia=container.querySelector('.boletin-publicacion');
      if(referencia)referencia.before(host);else container.prepend(host);
      const token=sesion().token;
      const existente=estados.get(registro.id);
      if(existente&&existente.token===token&&!cargas.has(registro.id)&&(existente.version!==existente.confirmada||(!existente.obsoleto&&precargados.get(claveCache(token,registro.id))?.revision===existente.data.revision&&precargados.get(claveCache(token,registro.id))?.eliminacionDefinitiva===existente.data.eliminacionDefinitiva))){existente.host=host;existente.registro=registro;existente.detalles=detalles;if(!opciones.preservarEdicion)existente.editables.clear();vincular(existente);dibujar(existente);return;}
      const anteriorCarga=cargas.get(registro.id);
      const carga={host,token,intencion:typeof opciones.habilitadoPendiente==='boolean'?opciones.habilitadoPendiente:anteriorCarga?.token===token?anteriorCarga.intencion:null};
      carga.lista=new Promise(resolve=>{carga.resolver=resolve;});cargas.set(registro.id,carga);
      host.innerHTML='<div class="criterios-interruptores"><label><input type="checkbox" role="switch" data-control="habilitado" '+((carga.intencion??existente?.data.habilitado)?'checked':'')+'> Evaluar con criterios</label><span class="criterios-consulta-indicador" role="status" aria-label="Consultando opciones guardadas"></span></div><div data-estado-carga role="status" aria-live="polite"></div>';
      const elegir=e=>{if(e.target.dataset.control==='habilitado')carga.intencion=e.target.checked;};
      host.addEventListener('change',elegir);
      try{
        const clave=claveCache(token,registro.id);
        if(!precargados.has(clave)&&existente?.token===token&&!existente.obsoleto)precargados.set(clave,structuredClone(existente.original));
        const enMemoria=precargados.get(clave);
        const data=enMemoria?structuredClone(enMemoria):await consultarCriterios(registro,token);
        if(sesion().token!==token||!host.isConnected){carga.error=Error('El registro cambió antes de recuperar los criterios.');return;}
        for(const n of [...data.notas,...data.resultados])if(n.valor!==''&&n.valor!=null&&Number.isFinite(Number(n.valor)))n.valor=Math.round(Number(n.valor));
        const s={token,registro,detalles,host,data,original:structuredClone(data),notas:new Map(data.notas.map(n=>[key(n.detalleId,n.criterioId),n.valor])),origenes:new Map(data.notas.map(n=>[key(n.detalleId,n.criterioId),n.origen||'manual'])),editables:new Set(opciones.preservarEdicion&&existente?.token===token?existente.editables:[]),version:0,confirmada:0,tocadas:new Set(),forzadas:new Set(),eliminados:new Set()};

        host.removeEventListener('change',elegir);
        const cambio=carga.intencion!=null&&data.habilitado!==carga.intencion;
        if(carga.intencion!=null)data.habilitado=carga.intencion;
        estados.set(registro.id,s);vincular(s);dibujar(s);
      }catch(error){carga.error=error;if(host.isConnected){host.querySelector('.criterios-consulta-indicador')?.remove();const estado=host.querySelector('[data-estado-carga]');if(estado){estado.textContent='No se pudieron recuperar los criterios. '+error.message;const b=document.createElement('button');b.type='button';b.textContent='Reintentar';b.onclick=()=>api.mount(container,registro,detalles,modo,{...opciones,habilitadoPendiente:carga.intencion});estado.append(b);}}}
      finally{carga.resolver({error:carga.error});if(!carga.error&&cargas.get(registro.id)===carga)cargas.delete(registro.id);}

    },
    payload(registro,detalles,cambios) {
      const s=estados.get(registro.id);if(!s||(s.version===s.confirmada&&s.data.habilitado===s.original.habilitado)||sesion().role!=='docente'||sesion().token!==s.token)return null;
      const ids=new Set(detalles.map(d=>String(d.id)));
      const notas=[...s.notas].map(([k,valor])=>{const [detalleId,criterioId]=JSON.parse(k);return {detalleId,criterioId,valor,origen:s.origenes.get(k)||'manual'};}).filter(n=>ids.has(n.detalleId));
      for(const n of notas){const c=s.data.criterios.find(c=>c.id===n.criterioId),max=s.data.sobre100?100:limites(registro.tipo)[c.dimension];if(n.valor!==''&&(!Number.isFinite(n.valor)||n.valor<0||n.valor>max))throw Error(`Hay notas de criterios fuera del rango 0–${max}.`);}
      const aplicar=[];let reemplazos=0;
      if(s.data.habilitado)for(const d of detalles)for(const dim of Object.keys(limites(registro.tipo))){
        const k=key(d.id,dim),m=media(s,d.id,dim),manual=ajuste(s,d,dim),directa=cambios?.some(c=>String(c.id)===String(d.id)&&c.campo===dim);
        if(!m.completo||(!s.tocadas.has(dim)&&!s.forzadas.has(k))||((manual||directa)&&!s.forzadas.has(k)))continue;
        if(String(valor(d[dim]))!==String(m.valor)&&valor(d[dim])!=='')reemplazos++;
        aplicar.push({detalleId:String(d.id),dimension:dim,baseValor:valor(d[dim])});
      }
      if(reemplazos&&!confirm(`Se reemplazarán ${reemplazos} notas de dimensiones por sus promedios completos de criterios. Las demás notas se conservarán. ¿Guardar?`))throw Error('No se aplicaron los promedios. Los cambios continúan pendientes.');
      return {eliminados:[...s.eliminados],localVersion:s.version,baseRevision:s.data.revision,habilitado:s.data.habilitado,sobre100:s.data.sobre100,criterios:s.data.criterios,notas,aplicar};
    },
    confirm(registroId,snapshot,respuesta) {
      const s=estados.get(registroId);if(!s||!snapshot)return;
      s.editables.clear();bloquearPromedios(s);
      const data=respuesta.criteriosEvaluacion;if(!data?.revision)throw Error('El servidor no confirmó el detalle de criterios. Actualiza Apps Script y vuelve a guardar.');
      if((snapshot.eliminados||[]).some(id=>data.criterios.some(c=>c.id===id)||data.notas.some(n=>n.criterioId===id)))throw Error('El servidor no confirmó la eliminación. Actualiza Apps Script y vuelve a guardar.');
      for(const id of snapshot.eliminados||[])s.eliminados.delete(id);
      if(s.version!==snapshot.localVersion)for(const c of snapshot.criterios)if(!s.data.criterios.some(actual=>actual.id===c.id)&&data.criterios.some(guardado=>guardado.id===c.id))s.eliminados.add(c.id);
      epocaCache++;s.obsoleto=false;precargados.set(claveCache(s.token,registroId),structuredClone(data));
      s.original=structuredClone(data);s.data.revision=data.revision;s.data.resultados=data.resultados;
      if(s.version===snapshot.localVersion){s.data=data;s.notas=new Map(data.notas.map(n=>[key(n.detalleId,n.criterioId),n.valor]));s.origenes=new Map(data.notas.map(n=>[key(n.detalleId,n.criterioId),n.origen||'manual']));s.confirmada=s.version;s.tocadas.clear();s.forzadas.clear();s.eliminados.clear();}
      setTimeout(()=>{dibujar(s);if(s.version===s.confirmada)s.host.querySelector('[data-estado-criterios]').textContent='Criterios y resultados guardados y confirmados.';},0);
    },
    discard(id){const carga=cargas.get(id);if(carga){carga.intencion=null;const control=carga.host.querySelector('[data-control="habilitado"]');if(control)control.checked=false;}const s=estados.get(id);if(!s)return;s.data=structuredClone(s.original);s.notas=new Map(s.data.notas.map(n=>[key(n.detalleId,n.criterioId),n.valor]));s.origenes=new Map(s.data.notas.map(n=>[key(n.detalleId,n.criterioId),n.origen||'manual']));s.editables.clear();s.version=s.confirmada=0;s.tocadas.clear();s.forzadas.clear();s.eliminados.clear();dibujar(s);},
    async printSnapshot(registro,detalles,habilitado='automatico',consultar=true){
      if(sesion().role!=='docente'||!habilitado)return '';
      const existente=estados.get(registro.id),token=sesion().token;
      const data=existente?.token===token?structuredClone(existente.data):consultar?await consultarCriterios(registro,token):{criterios:[],notas:[],resultados:[],sobre100:false};
      if(token!==sesion().token)throw Error('La sesión cambió.');
      if(habilitado==='automatico'&&!data.habilitado)return '';
      const s={token,registro,detalles,data:{...data,habilitado:true},notas:existente?.token===token?new Map(existente.notas):new Map(data.notas.map(n=>[key(n.detalleId,n.criterioId),n.valor]))};
      return api.print(registro,detalles,s);
    },
    enabled(id){const s=estados.get(id);return Boolean(s&&s.token===sesion().token&&s.data.habilitado);},
    print(registro,detalles,instantanea){
      const s=instantanea||estados.get(registro.id);if(!s||!s.data.habilitado||s.token!==sesion().token||sesion().role!=='docente')return '';
      const plantilla=document.createElement('template');plantilla.innerHTML=window.generarHTMLImpresionCalif(registro,detalles);
      const extra=clase=>plantilla.content.querySelector('.'+clase)?.outerHTML||'';
      const cabecera=extra('calif-print-header')+extra('calif-print-meta-grid'),estadisticas=extra('calif-print-stats-box'),firmas=extra('calif-print-signatures');
      const dims=Object.keys(limites(registro.tipo)),hetero=dims.filter(d=>d!=='autoevaluacion'),criterios=dims.flatMap(dim=>s.data.criterios.filter(c=>c.activo&&c.dimension===dim)),paginas=[];
      const medidor=document.createElement('canvas').getContext('2d');medidor.font='400 7.5pt Arial';
      const medidorTitulo=document.createElement('canvas').getContext('2d');medidorTitulo.font='400 7.5pt "Arial Narrow", "Liberation Sans Narrow", "Roboto Condensed", "DejaVu Sans Condensed", Arial, sans-serif';
      const obsTexto=d=>{const div=document.createElement('div');div.innerHTML=observacion(s,d);return div.querySelector('.calif-badge-obs')?.textContent||d.observacion||'-';};
      const etiquetaDim=dim=>dim==='proceso'?'PROC.':dim==='producto'?'PROD.':titulo(dim);
      // Carta horizontal con márgenes de 8 mm. Las cifras mantienen 7.5 pt.
      const milimetros=t=>medidor.measureText(t).width*25.4/96;
      const anchoNumero=Math.max(5.5,milimetros(String(Math.max(1,detalles.length)))+2);
      const anchoNombre=Math.min(44,Math.max(40,...detalles.map(d=>milimetros(nombre(d))+2)));
      const anchoFinal=8,anchoObs=24,anchoUtil=263.4,espacio=25.4/96,minCriterio=6.4,minPromedio=6.6;
      const fijo=anchoNumero+anchoNombre+anchoFinal+anchoObs;
      const capacidad=Math.min(20,Math.max(1,Math.floor((anchoUtil-fijo-dims.length*minPromedio-espacio*(dims.length+5))/(minCriterio+espacio))));
      const bloques=Math.max(1,Math.ceil(criterios.length/capacidad)),filas=Math.max(1,detalles.length);
      const v=n=>n===''||n==null?'-':esc(n);
      for(let bloque=0;bloque<bloques;bloque++){
        const cs=criterios.slice(bloque*capacidad,(bloque+1)*capacidad),grupoDim=dim=>cs.filter(c=>c.dimension===dim),nHetero=hetero.reduce((n,dim)=>n+grupoDim(dim).length+1,0),nAuto=grupoDim('autoevaluacion').length+1;
        const sobrante=Math.max(0,anchoUtil-fijo-espacio*(cs.length+dims.length+5)-cs.length*minCriterio-dims.length*minPromedio);
        const reparto=sobrante/(cs.length+dims.length*.9);
        const anchoCriterio=minCriterio+reparto,anchoPromedio=minPromedio+reparto*.9;
        const col=ancho=>'<col style="width:'+ancho.toFixed(4)+'mm">';
        const columnas=col(anchoNumero)+col(anchoNombre)+dims.map(dim=>grupoDim(dim).map(()=>col(anchoCriterio)).join('')+col(anchoPromedio)).join('')+col(anchoFinal)+col(anchoObs);
        const cabDimension=dim=>{const texto=esc(etiquetaDim(dim))+' ('+limites(registro.tipo)[dim]+')';return '<th colspan="'+(grupoDim(dim).length+1)+'">'+(grupoDim(dim).length?texto:'<span class="criterios-print-dimension-vertical">'+texto+'</span>')+'</th>';};
        const maxLineas=Math.max(2,Math.floor((anchoCriterio*72/25.4-2.6)/8));
        const limiteLineas=cs.length===20?2:maxLineas;
        const sinEspacios=texto=>String(texto).replace(/\s/g,'');
        const normalCabe=cs.every(c=>sinEspacios(ajustarTituloCriterio(c.titulo,medidor,120,limiteLineas).join(''))===sinEspacios(c.titulo));
        const fuenteTitulo=normalCabe?medidor:medidorTitulo,anchoTitulo=normalCabe?120:120/.9;
        const tipografia=normalCabe?'normal':'condensada';
        const cabDim=dim=>grupoDim(dim).map(c=>{const lineas=ajustarTituloCriterio(c.titulo,fuenteTitulo,anchoTitulo,limiteLineas);return '<th class="criterios-print-criterio" data-dimension="'+dim+'" title="'+esc(c.titulo)+'"><span class="criterios-print-nombre" data-lineas="'+lineas.length+'">'+lineas.map(linea=>'<span>'+esc(linea)+'</span>').join(' ')+'</span></th>';}).join('')+'<th class="criterios-print-promedio"><span class="criterios-print-vertical">PROMEDIO ('+limites(registro.tipo)[dim]+')</span></th>';
        for(let inicio=0;inicio<Math.max(1,detalles.length);inicio+=filas){
          const cabTabla='<thead><tr><th rowspan="3">N°</th><th rowspan="3">APELLIDOS Y NOMBRES</th><th colspan="'+nHetero+'">HETEROEVALUACIÓN (90 PUNTOS)</th><th colspan="'+nAuto+'" rowspan="2">'+(nAuto===1?'<span class="criterios-print-auto-vertical">AUTOEVAL. (10)</span>':'AUTOEVAL.<br>(10 PUNTOS)')+'</th><th colspan="2">CALIFICACIÓN FINAL</th></tr><tr>'+hetero.map(cabDimension).join('')+'<th rowspan="2"><span class="criterios-print-vertical">NUMERAL (100)</span></th><th rowspan="2">OBSERVACIÓN</th></tr><tr>'+dims.map(cabDim).join('')+'</tr></thead>';
          const cuerpo=detalles.slice(inicio,inicio+filas).map((d,i)=>'<tr class="'+((inicio+i+1)%2===0?'criterios-print-par':'')+'"><td>'+(inicio+i+1)+'</td><td class="nombre">'+esc(nombre(d))+'</td>'+dims.map(dim=>grupoDim(dim).map(c=>'<td>'+v(s.notas.get(key(d.id,c.id)))+'</td>').join('')+'<td class="criterios-print-promedio">'+v(d[dim])+'</td>').join('')+'<td class="criterios-print-total">'+v(numeral(s,d))+'</td><td>'+esc(obsTexto(d))+'</td></tr>').join('');
          paginas.push(cabecera+'<table class="criterios-print-registro" data-tipografia="'+tipografia+'" data-capacidad-criterios="'+capacidad+'"><colgroup>'+columnas+'</colgroup>'+cabTabla+'<tbody>'+cuerpo+'</tbody></table>');
        }
      }
      paginas.push(cabecera+'<div class="criterios-print-cierre">'+estadisticas+firmas+'</div>');
      return '<div class="criterios-impresion">'+paginas.map((pagina,i)=>'<section class="criterios-print-pagina">'+pagina+'<footer>Página <strong>'+(i+1)+'</strong> de <strong>'+paginas.length+'</strong></footer></section>').join('')+'</div>';
    },
    dimensionEdit(id,detalle,dimension,v){const s=estados.get(id);if(!s||s.aplicando||s.token!==sesion().token)return;const actual=s.detalles.find(d=>String(d.id)===String(detalle.id));if(actual)Object.assign(actual,detalle);ajustar(s,detalle,dimension,v);refrescar(s);},
    lock(id){const s=estados.get(id);if(s){s.editables.clear();bloquearPromedios(s);refrescar(s);}},
    pending(){return [...estados.values()].some(s=>s.token===sesion().token&&sesion().role==='docente'&&(s.version!==s.confirmada||(s.data.habilitado&&window.hayNotasRegistroPendientesCalif?.(s.registro.id)))&&s.host.isConnected&&s.host.getClientRects().length);},
    refresh(id,detalles){const s=estados.get(id);if(s){if(detalles)s.detalles=detalles;else if(window._registroActivo?.id===id&&window._detallesActivos)s.detalles=window._detallesActivos;refrescar(s);}},
    clear(){for(const s of estados.values())s.observadorAncho?.disconnect();for(const c of cargas.values())c.resolver({error:Error("La sesión cambió.")});cargas.clear();epocaCache++;precargados.clear();consultas.clear();document.querySelectorAll('.calif-con-criterios').forEach(el=>el.classList.remove('calif-con-criterios'));estados.clear();document.querySelectorAll('.criterios-dialog, .criterios-panel, .criterios-menu').forEach(d=>d.remove());}
  };
  document.addEventListener('dblclick',e=>{const input=e.target.closest('.calif-input-nota');if(!input)return;const s=estados.get(window._registroActivo?.id);if(!s?.data.habilitado||!Object.prototype.hasOwnProperty.call(limites(s.registro.tipo),input.dataset.col))return;e.preventDefault();menuPromedio(s,input.dataset.col,e.clientX,e.clientY);});
  document.addEventListener('input',e=>{if(e.target.matches('.calif-input-nota'))setTimeout(()=>api.refresh(window._registroActivo?.id),0);});
  window.matchMedia('(max-width:700px)').addEventListener('change',()=>estados.forEach(s=>{if(s.host.isConnected)dibujar(s);}));
  window.addEventListener('beforeunload',event=>{if(api.pending()){event.preventDefault();event.returnValue='';}});
  window.matchMedia?.('(max-width:900px)').addEventListener?.('change',()=>{for(const s of estados.values())if(s.host.isConnected)dibujar(s);});
})();
