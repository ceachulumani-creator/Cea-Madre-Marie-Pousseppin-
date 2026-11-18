/* Transporte confirmado y control de versiones de el sistema. */
(function () {
  'use strict';
  const collections = {
    'guardar-carreras': 'Carreras_Tecnicas', 'guardar-materias': 'Materias_Humanistica',
    'guardar-horarios': 'Horarios', 'guardar-calendario': 'Calendario_Academico',
    'guardar-epja-niveles': 'Niveles_EPJA', 'guardar-humanistica-malla': 'Malla_Humanistica',
    'guardar-documentos-dinamicos': 'Documentos', 'guardar-documentos': 'Documentos',
    'guardar-documentos-oficiales': 'Documentos', 'guardar-horarios-matriz': 'Horarios_Matriz',
    'guardar-paralelos': 'ParalelosCEA'
  };
  let queue = Promise.resolve();
  let pending = 0;
  let revisions = {};
  const noteVersions = new Map();
  let ready = false;
  function report(error, prefix = '') {
    if (error.code === 'OCUPADO') return;
    const message = String(error.message || error).replace(/Google\s+Sheets?/gi, 'el sistema');
    window.alert(prefix + message);
  }

  function privateKey(key) {
    return /contrasena|password|credencial|usuarios|session|token|kardex|inscrip|afiliacion|padron|registro_estudiantes|papelera|calif|subidas|auditoria|mensajes_contacto/i.test(key);
  }

  function clearPrivate() {
    Object.keys(localStorage).filter(key => key.startsWith('cea_') && privateKey(key)).forEach(key => localStorage.removeItem(key));
    if (typeof window.cargarRespaldoNominaCEA === 'function') window.cargarRespaldoNominaCEA([]);
    revisions = {};
    noteVersions.clear();
    ready = false;
  }

  async function request(payload, timeout = 90000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const url = obtenerGoogleSheetURL();
      if (!url) throw new Error('Configura la conexión con el sistema.');
      const session = lsGet('cea_session', null);
      const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify({...payload, token: payload.token || session && session.token || ''}),
        signal: controller.signal
      });
      if (!response.ok) throw new Error('El servidor respondió con error ' + response.status + '.');
      const result = await response.json();
      if (result.apiVersion !== 2) throw new Error('Actualiza la implementación de Apps Script con la versión incluida en este proyecto.');
      if (result.status !== 'success' && result.status !== 'not_found') {
        const error = new Error(String(result.message || 'El sistema rechazó la operación.').replace(/Google\s+Sheets?/gi, 'el sistema'));
        error.code = result.code;
        throw error;
      }
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw Object.assign(new Error('La hoja no confirmó el guardado a tiempo. Vuelve a pulsar Guardar.'), {code: 'TIEMPO_AGOTADO'});
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function send(data) {
    const payload = JSON.parse(JSON.stringify(data));
    payload.requestId = payload.requestId || crypto.randomUUID();
    const readOnly = /^(obtener|consultar|verificar)/.test(payload.action);
    const collection = collections[payload.action];
    const id = payload.idRegistro || payload.registro && payload.registro.id;
    const guardadoNotas = ['guardar-calificaciones-registro', 'guardar-boletin'].includes(payload.action);
    const noteAction = ['guardar-calificaciones-registro', 'cambiar-estado-calificaciones', 'cambiar-bloqueo-calificaciones'].includes(payload.action);
    const tokenEnCola = lsGet('cea_session', null)?.token || '';
    if (tokenEnCola && payload.action !== 'login') payload.token = payload.token || tokenEnCola;
    pending++;
    const task = queue.then(async () => {
      if (collection) payload.baseVersion = revisions[collection];
      if (noteAction) payload.baseVersion = noteVersions.has(id) ? noteVersions.get(id) : null;
      try {
        const urgente = noteAction || payload.action === 'actualizar-matriculas';
        let result;
        let reintentoRed = false;
        for (let intento = 0; ; intento++) {
          try {
            result = await request(payload, guardadoNotas ? 35000 : urgente ? 20000 : 90000);
            break;
          } catch (error) {
            if (error.code === 'OCUPADO' && intento < 7) {
              await new Promise(resolve => setTimeout(resolve, Math.min(2000, 200 * (intento + 1)) + Math.random() * 300));
              continue;
            }
            if (guardadoNotas && !reintentoRed && (error.code === 'TIEMPO_AGOTADO' || error.name === 'TypeError')) {
              reintentoRed = true;
              continue;
            }
            throw error;
          }
        }
        if (result.collectionVersion) revisions[collection] = result.collectionVersion;
        if (result.data && payload.action === 'guardar-subida-estudiante') {
          const states = lsGet('cea_calificaciones_subidas_notas', {});
          states[result.data.key] = result.data.estado === 'SUBIDO';
          localStorage.setItem('cea_calificaciones_subidas_notas', JSON.stringify(states));
        }
        if (guardadoNotas && result.status !== 'success') throw new Error('La hoja no confirmó los cambios de esta planilla.');
        if (noteAction && result.version) noteVersions.set(id, result.version);
        if (result.token && /credenciales/.test(payload.action)) {
          const session = lsGet('cea_session', {});
          localStorage.setItem('cea_session', JSON.stringify({...session, user: result.user, token: result.token}));
        }
        return result;
      } catch (error) {
        if (error.code !== 'SESION' && !guardadoNotas && payload.action !== 'registrar-auditoria-calificaciones' && !readOnly && payload.action !== 'visita') {
          report(error, 'No se pudo confirmar el guardado. ');
          error.ceaReported = true;
        }
        if (error.code === 'SESION' && payload.token && lsGet('cea_session', null)?.token === payload.token) {
          if (typeof adminLogout === 'function') adminLogout();
        }
        throw error;
      } finally {
        pending--;
      }
    });
    // La cola continúa después de un error. Cada llamador recibe su rechazo.
    queue = task.catch(() => {});
    return task;
  }

  function loaded(data) {
    if (data._revisions) {
      revisions = data._revisions;
      ready = true;
    }
    (data.calificacionesRegistros || []).forEach(reg => noteVersions.set(reg.id, reg.version || null));
  }

  function period(value) {
    return /2|segundo/i.test(String(value || '')) ? '2' : '1';
  }

  function sameCourse(a, b) {
    return String(a.areaKey) === String(b.areaKey) && String(a.nivel).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === String(b.nivel).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() && String(a.paralelo || 'A').toUpperCase() === String(b.paralelo || 'A').toUpperCase() && String(a.gestion) === String(b.gestion) && period(a.semestre) === period(b.semestre);
  }

  async function saveStudents(list, gestion, semestre, permanent) {
    if (!ready) throw new Error('Espera a que se cargue la nómina oficial antes de editar.');
    const previous = lsGet('cea_afiliacion_estudiantes', []);
    const trash = lsGet('cea_afiliacion_papelera', []);
    const all = previous.concat(trash);
    const normalized = list.map(student => {
      const next = {...student, gestion: student.gestion || String(gestion), semestre: student.semestre || semestre};
      const old = all.find(item => (next.matriculaId && item.matriculaId === next.matriculaId) || (!next.matriculaId && sameCourse(item, next) && String(item.ci || item.rude || item.nombreCompleto) === String(next.ci || next.rude || next.nombreCompleto)));
      next.matriculaId = next.matriculaId || old && old.matriculaId || crypto.randomUUID();
      next.id = next.matriculaId;
      return next;
    });
    const changes = [];
    const ids = new Set(normalized.map(student => student.matriculaId));
    normalized.forEach(student => {
      const old = all.find(item => item.matriculaId === student.matriculaId);
      const compare = value => JSON.stringify(Object.keys(value).sort().filter(key => !['version', 'num', 'id', 'fechaActualizacion'].includes(key)).map(key => [key, value[key]]));
      if (!old || compare(old) !== compare(student)) changes.push({id: student.matriculaId, operacion: 'guardar', version: old && old.version || null, estudiante: student});
    });
    previous.filter(student => !ids.has(student.matriculaId)).forEach(student => changes.push({id: student.matriculaId, operacion: permanent ? 'eliminar' : 'baja', version: student.version}));
    if (!changes.length) return previous;
    return changeStudents(changes);
  }

  async function changeStudents(changes) {
    const result = await send({action: 'actualizar-matriculas', cambios: changes});
    aplicarResultadoMatriculas(result);
    return result.estudiantes;
  }

  async function trasladarCurso(trasladoCurso) {
    const result = await send({action: 'actualizar-matriculas', trasladoCurso});
    if (!result.trasladoCurso) throw new Error('El servidor no confirmó el traslado del curso.');
    aplicarResultadoMatriculas(result);
    return result.trasladoCurso;
  }

  function aplicarResultadoMatriculas(result) {
    if (!Array.isArray(result.estudiantes) || !Array.isArray(result.papelera)) {
      throw new Error('El sistema no confirmó los cambios de la nómina.');
    }
    localStorage.setItem('cea_afiliacion_estudiantes', JSON.stringify(result.estudiantes));
    localStorage.setItem('cea_afiliacion_papelera', JSON.stringify(result.papelera));
    const notasEliminadas = new Set(result.notasEliminadas || []);
    if (notasEliminadas.size) {
      for (const key of ['cea_calificaciones_detalles', 'cea_calif_detalles']) {
        const detalles = lsGet(key, []);
        if (Array.isArray(detalles)) {
          localStorage.setItem(key, JSON.stringify(detalles.filter(detalle => !notasEliminadas.has(String(detalle.id).trim()))));
        }
      }
    }
    const registrosEliminados = new Set(result.registrosEliminados || []);
    if (registrosEliminados.size) {
      for (const key of ['cea_calificaciones_registros', 'cea_calif_registros']) {
        const registros = lsGet(key, []);
        if (Array.isArray(registros)) localStorage.setItem(key, JSON.stringify(registros.filter(registro => !registrosEliminados.has(String(registro.id).trim()))));
      }
    }
  }

  window.ceaPersistencia = {send, request, loaded, clearPrivate, privateKey, sameCourse, period, saveStudents, changeStudents, trasladarCurso, isPending: () => pending > 0, isReady: () => ready, report};
  window.addEventListener('unhandledrejection', event => {
    if (event.reason && event.reason.ceaReported) event.preventDefault();
  });
  window.addEventListener('beforeunload', event => {
    if (pending) { event.preventDefault(); event.returnValue = ''; }
  });
  // Elimina copias antiguas sensibles durante la actualización de la aplicación.
  if (localStorage.getItem('cea_privacidad_version') !== '2') {
    clearPrivate();
    localStorage.setItem('cea_privacidad_version', '2');
  }
})();
