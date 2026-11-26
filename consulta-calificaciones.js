/* Boletin individual: consulta publica por CI, sin almacenar notas en el navegador. */
(function () {
  'use strict';
  const institucion = 'Centro de Educación Alternativa Madre Marie Poussepin';
  const escapar = valor => String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalizar = valor => String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valorNota = valor => valor !== '' && valor != null && Number.isFinite(Number(valor)) ? Number(valor) : null;
  const mostrar = valor => valor == null ? '—' : String(valor);
  let consulta = null;
  let generacion = 0;
  let descargando = false;

  function numeroModulo(valor) {
    const texto = String(valor || '').split(':')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/^MOD(?:ULO)?[ ._-]*/, '').trim();
    return /^\d+$/.test(texto) ? Number(texto) : ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'].indexOf(texto) + 1;
  }

  function catalogo(registro) {
    const tecnica = registro.tipo !== 'humanistica';
    if (Array.isArray(registro.catalogoModulos)) return registro.catalogoModulos;
    const funcion = tecnica ? window.obtenerMallaOficialTecnica : window.obtenerMallaOficialHumanistica;
    return typeof funcion === 'function' ? funcion(registro.areaKey, registro.nivel) : [];
  }

  function posicion(registro, modulos) {
    const cantidad = registro.tipo === 'humanistica' ? 2 : 5;
    if (Number.isInteger(registro.numeroModulo) && registro.numeroModulo >= 1 && registro.numeroModulo <= cantidad) return registro.numeroModulo - 1;
    if (cantidad === 2 && (/-HUM[A-Z0-9]*M2-\d{4}-S[12]-P/i.test(registro.id || '') || /MODULO2/.test(normalizar(registro.modulo)))) return 1;
    const clave = String(registro.id || '').match(/-(?:m[oó]?dulo|mod)([ivx]+|\d+)-\d{4}-s[12]-p/i)?.[1];
    const numero = numeroModulo(clave) || numeroModulo(registro.moduloCodigo) || numeroModulo(registro.modulo);
    if (numero) return (numero - 1) % cantidad;
    const nombre = normalizar(String(registro.modulo || '').replace(/^[^:]+:\s*/, ''));
    const indice = modulos.findIndex(m => normalizar(m.nombre) === nombre || normalizar(m.codigo) === normalizar(registro.modulo));
    return indice >= 0 ? indice : (cantidad === 2 ? 0 : -1);
  }

  function periodos(resultados) {
    const mapa = new Map();
    for (const {registro:r} of resultados) {
      const gestion = String(r.gestion || '').trim();
      const semestre = /segundo|2/i.test(r.semestre || '') ? 'Segundo Semestre' : 'Primer Semestre';
      const clave = JSON.stringify([gestion, semestre]);
      if (!mapa.has(clave)) mapa.set(clave, {clave, gestion, semestre, resultados:[]});
    }
    for (const item of resultados) {
      const semestre = /segundo|2/i.test(item.registro.semestre || '') ? 'Segundo Semestre' : 'Primer Semestre';
      mapa.get(JSON.stringify([String(item.registro.gestion || '').trim(), semestre])).resultados.push(item);
    }
    return [...mapa.values()].sort((a,b) => Number(b.gestion) - Number(a.gestion) || b.semestre.localeCompare(a.semestre));
  }

  function cursos(periodo) {
    const mapa = new Map();
    for (const item of periodo.resultados) {
      const r = item.registro;
      const clave = JSON.stringify([r.areaKey, normalizar(r.nivel), r.paralelo || 'A', r.sede || '']);
      if (!mapa.has(clave)) {
        const malla = catalogo(r);
        mapa.set(clave, {registro:r, detalle:item.detalle, modulos:Array.from({length:r.tipo === 'humanistica' ? 2 : 5}, (_,i) => ({numero:i+1, nombre:malla[i]?.nombre || 'Módulo '+(i+1), codigo:malla[i]?.codigo || '', item:null})), sinUbicar:[]});
      }
      const curso = mapa.get(clave);
      const indice = posicion(r, curso.modulos);
      if (indice < 0 || !curso.modulos[indice]) { curso.sinUbicar.push(item); continue; }
      const anterior = curso.modulos[indice].item;
      if (!anterior || String(r.fechaModificacion || r.fecha || '') >= String(anterior.registro.fechaModificacion || anterior.registro.fecha || '')) {
        curso.modulos[indice].item = item;
        // El registro conserva el nombre que el docente asigno a cada modulo humanistico.
        if (r.tipo === 'humanistica' || /^MODULO\d+$/.test(normalizar(curso.modulos[indice].nombre))) {
          curso.modulos[indice].nombre = String(r.modulo || '').replace(/^(?:M[oó]dulo\s+)?[IVX\d]+:\s*/i, '') || curso.modulos[indice].nombre;
        }
      }
    }
    return [...mapa.values()];
  }

  function nota(item) {
    if (!item || item.detalle.notasRegistradas === false) return null;
    return valorNota(item.detalle.notaFinal);
  }

  function observacion(item) {
    if (nota(item) == null) return item ? 'Sin evaluar' : 'Pendiente de publicación';
    const manual = item.detalle.observacionManual;
    if (/^(PROMOVIDO EXCELENTE|PROMOVIDO|POSTERGADO|RETIRADO)$/i.test(manual || '')) return manual;
    if (/^RETIRADO$/i.test(item.detalle.observacion || '')) return 'Retirado';
    return nota(item) >= 85 ? 'Promovido excelente' : nota(item) >= 51 ? 'Promovido' : 'Postergado';
  }

  function nombreEstudiante(detalle) {
    return [detalle.paterno, detalle.materno, detalle.nombres].filter(Boolean).join(' ').trim() || detalle.nombreCompleto || 'Estudiante';
  }

  function encabezado(curso, periodo) {
    const r = curso.registro, d = curso.detalle;
    const nombre = nombreEstudiante(d);
    return `<header class="boletin-individual-encabezado"><p>${escapar(institucion)}</p><h3>Boletín individual de calificaciones</h3><h4>${escapar(nombre)}</h4><dl><div><dt>Cédula de identidad</dt><dd>${escapar(d.ci || consulta.ci)}</dd></div><div><dt>Área / carrera</dt><dd>${escapar(r.carrera || r.areaKey)}</dd></div><div><dt>Curso / nivel</dt><dd>${escapar(r.nivel)}</dd></div><div><dt>Paralelo</dt><dd>${escapar(r.paralelo || 'A')}</dd></div><div><dt>Gestión</dt><dd>${escapar(periodo.gestion)}</dd></div><div><dt>Semestre</dt><dd>${escapar(periodo.semestre)}</dd></div>${r.sede ? `<div><dt>Centro / sede</dt><dd>${escapar(r.sede)}</dd></div>` : ''}</dl></header>`;
  }

  function contenidoCurso(curso, periodo) {
    const notas = curso.modulos.map(m => nota(m.item)).filter(n => n != null);
    const promedio = notas.length ? Math.round(notas.reduce((a,b) => a+b,0)/notas.length) : null;
    const docente = item => item?.registro.docente || curso.registro.docente || 'Por registrar';
    const cuerpo = `<ol class="boletin-individual-modulos">${curso.modulos.map(m => `<li class="boletin-nota-resumen"><div class="boletin-modulo-titulo"><div><span>Módulo ${m.numero}</span><h4>${escapar(m.nombre)}</h4><p>Docente: ${escapar(docente(m.item))}</p></div><div class="boletin-resultado-final"><span>Nota final</span><strong class="boletin-modulo-nota ${nota(m.item) != null && nota(m.item) < 51 ? 'boletin-nota-baja' : ''}">${mostrar(nota(m.item))}<small> / 100</small></strong><p class="boletin-observacion">${escapar(observacion(m.item))}</p></div></div></li>`).join('')}</ol>`;
    const pendientes = curso.sinUbicar.length ? `<aside><p>Registros pendientes de identificar en la malla curricular. Consulta con tu docente:</p>${curso.sinUbicar.map(item => `<p>${escapar(item.registro.modulo)} · Nota final: ${mostrar(nota(item))} / 100 · Docente: ${escapar(docente(item))}</p>`).join('')}</aside>` : '';
    return `<article class="boletin-individual-curso">${encabezado(curso, periodo)}${cuerpo}${pendientes}<p class="boletin-promedio"><span>${notas.length === curso.modulos.length ? 'Promedio final del curso' : 'Promedio de módulos publicados'}</span><strong>${mostrar(promedio)}<small> / 100</small></strong><span>${notas.length} de ${curso.modulos.length} módulos con nota</span></p><footer>Calificaciones publicadas · Boletín institucional de consulta · ${new Date().toLocaleDateString('es-BO')}.</footer></article>`;
  }

  function modeloPDF(actual) {
    return {
      institucion, ci:actual.ci, nombre:nombreEstudiante(actual.cursos[0].detalle),
      gestion:actual.periodo.gestion, semestre:actual.periodo.semestre, fecha:new Date().toLocaleDateString('es-BO'),
      cursos:actual.cursos.map(curso => {
        const r=curso.registro;
        const notas=curso.modulos.map(m=>nota(m.item)).filter(n=>n!=null);
        return {
          ci:curso.detalle.ci, carrera:r.carrera||r.areaKey, nivel:r.nivel, paralelo:r.paralelo, sede:r.sede,
          promedio:notas.length?Math.round(notas.reduce((a,b)=>a+b,0)/notas.length):null,
          completo:notas.length===curso.modulos.length, evaluados:notas.length,
          modulos:curso.modulos.map(m=>({numero:m.numero,nombre:m.nombre,docente:m.item?.registro.docente||r.docente||'Por registrar',nota:nota(m.item),observacion:observacion(m.item)})),
          sinUbicar:curso.sinUbicar.map(item=>({nombre:item.registro.modulo,nota:nota(item)}))
        };
      })
    };
  }

  function renderPeriodo(clave) {
    const destino = document.getElementById('consulta-notas-boletines');
    consulta.periodo = consulta.periodos.find(p => p.clave === clave) || null;
    if (!consulta.periodo) { destino.innerHTML = '<p>Elige la gestión y el semestre que deseas consultar.</p>'; return; }
    consulta.cursos = cursos(consulta.periodo);
    destino.innerHTML = `<div class="boletin-individual-acciones"><button type="button" id="consulta-notas-descargar" class="btn-calif btn-calif-primary">Descargar boletín PDF</button><span id="consulta-notas-descarga-estado" role="status" aria-live="polite"></span></div>${consulta.cursos.map(c => contenidoCurso(c, consulta.periodo)).join('')}`;
    destino.querySelector('button').addEventListener('click', descargar);
  }

  async function consultar(evento) {
    evento?.preventDefault();
    const entrada = document.getElementById('lookup-est-ci');
    const destino = document.getElementById('lookup-est-resultados');
    const boton = document.getElementById('btn-submit-lookup-est');
    const ci = entrada?.value.trim();
    if (!ci || !destino) { entrada?.focus(); return; }
    const version = ++generacion;
    consulta = null;
    destino.style.display = 'block';
    destino.innerHTML = '<p role="status">Consultando calificaciones…</p>';
    if (boton) { boton.disabled = true; boton.setAttribute('aria-busy','true'); }
    entrada.disabled = true;
    try {
      const respuesta = await ceaPersistencia.request({action:'consultar-calificaciones-estudiante', ci},25000);
      if (version !== generacion) return;
      if (respuesta.status !== 'success' || !Array.isArray(respuesta.calificaciones)) throw new Error('No se pudo consultar. Intenta nuevamente.');
      const resultados = respuesta.calificaciones.filter(item => item?.registro?.estado === 'PUBLICADO' && item.detalle);
      if (!resultados.length) { destino.innerHTML = '<p role="status">No se encontraron calificaciones publicadas para esta cédula de identidad.</p>'; return; }
      consulta = {ci, periodos:periodos(resultados), periodo:null, cursos:[]};
      destino.innerHTML = `${consulta.periodos.length > 1 ? `<label class="consulta-notas-periodo" for="consulta-notas-periodo">Gestión y semestre<select id="consulta-notas-periodo"><option value="">Selecciona el período que deseas consultar</option>${consulta.periodos.map(p => `<option value="${escapar(p.clave)}">Gestión ${escapar(p.gestion)} · ${escapar(p.semestre)}</option>`).join('')}</select></label>` : ''}<div id="consulta-notas-boletines"></div>`;
      destino.querySelector('select')?.addEventListener('change', e => renderPeriodo(e.target.value));
      renderPeriodo(consulta.periodos.length === 1 ? consulta.periodos[0].clave : '');
    } catch (error) {
      if (version === generacion) destino.innerHTML = '<p role="alert">No se pudo consultar las calificaciones. Revisa tu conexión y vuelve a intentar.</p>';
    } finally {
      if (version === generacion) {
        entrada.disabled = false;
        if (boton) { boton.disabled = false; boton.setAttribute('aria-busy','false'); }
      }
    }
  }

  async function descargar() {
    if (!consulta?.periodo || descargando) return;
    const version = generacion, referencia = consulta, actual = {...consulta};
    const boton = document.getElementById('consulta-notas-descargar');
    const estado = document.getElementById('consulta-notas-descarga-estado');
    descargando = true; boton.disabled = true; estado.textContent = 'Generando boletín…';
    try {
      if (typeof window.crearPDFBoletinIndividual !== 'function') throw new Error('Motor PDF no disponible');
      const blob = window.crearPDFBoletinIndividual(modeloPDF(actual));
      if (version !== generacion || consulta !== referencia || consulta.periodo !== actual.periodo) return;
      if (!(blob instanceof Blob) || blob.size < 100) throw new Error('Archivo incompleto');
      const url = URL.createObjectURL(blob), enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'Boletin_'+nombreEstudiante(actual.cursos[0].detalle).normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim().replace(/\s+/g,'_').slice(0,160)+'_'+actual.periodo.gestion+'_'+(/Segundo/.test(actual.periodo.semestre) ? 'S2' : 'S1')+'.pdf';
      document.body.append(enlace); enlace.click(); enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url),30000);
      estado.textContent = 'Boletín descargado con éxito.';
    } catch (error) {
      if (version === generacion) estado.textContent = 'No se pudo descargar el boletín. Vuelve a intentar.';
    } finally { descargando = false; if (boton.isConnected) boton.disabled = false; }
  }

  document.addEventListener('input', evento => {
    if (evento.target.id !== 'lookup-est-ci' || evento.target.disabled) return;
    consulta = null;
    const destino = document.getElementById('lookup-est-resultados');
    if (destino) { destino.innerHTML = ''; destino.style.display = 'none'; }
  });
  window.consultarBoletinEstudiante = consultar;
})();
