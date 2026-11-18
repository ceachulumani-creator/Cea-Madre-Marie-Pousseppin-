
  function esEstudianteDeArea(estudiante, areaKeyOrNombre) {
    if (!estudiante || !areaKeyOrNombre) return false;
    const normalizarCadena = (str) => String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const kNorm = normalizarCadena(areaKeyOrNombre).replace(/^tec-?/, '');
    const estKeyNorm = normalizarCadena(estudiante.areaKey || '').replace(/^tec-?/, '');
    const estNomNorm = normalizarCadena(estudiante.carreraNombre || '');

    if (estKeyNorm === kNorm || estNomNorm === kNorm) return true;
    if (kNorm.includes('sec') && (estKeyNorm.includes('sec') || estNomNorm.includes('secreta'))) return true;
    if (kNorm.includes('sis') && (estKeyNorm.includes('sis') || estNomNorm.includes('informa'))) return true;
    if (kNorm.includes('agro') && (estKeyNorm.includes('agro') || estNomNorm.includes('agro'))) return true;
    if (kNorm.includes('gas') && (estKeyNorm.includes('gas') || estNomNorm.includes('gastro') || estNomNorm.includes('alim'))) return true;
    if (kNorm.includes('bel') && (estKeyNorm.includes('bel') || estNomNorm.includes('belleza'))) return true;
    if (kNorm.includes('tex') && (estKeyNorm.includes('tex') || estNomNorm.includes('textil') || estNomNorm.includes('confecc'))) return true;
    if (kNorm.startsWith('hum') && (estKeyNorm.startsWith('hum') || estNomNorm.includes('human'))) return true;
    return false;
  }
  window.esEstudianteDeArea = esEstudianteDeArea;


  window._kardexModoEdicionInline = false;
  function alternarModoEdicionKardexInline(forzarEdicion) {
    const form = document.getElementById('form-kardex-docente');
    if (!form) return;
    
    if (typeof forzarEdicion === 'boolean') {
      window._kardexModoEdicionInline = forzarEdicion;
    } else {
      window._kardexModoEdicionInline = !window._kardexModoEdicionInline;
    }

    const enEdicion = Boolean(window._kardexModoEdicionInline);
    
    form.querySelectorAll('input:not([type="hidden"]), select, textarea').forEach(el => {
      if (el.id === 'kardex-codigo' || el.id === 'kardex-edad') {
        el.readOnly = true;
      } else {
        if (enEdicion) {
          el.removeAttribute('readonly');
          el.removeAttribute('disabled');
          el.style.backgroundColor = '#ffffff';
          el.style.cursor = 'text';
        } else {
          el.setAttribute('readonly', 'true');
          if (el.tagName === 'SELECT') el.setAttribute('disabled', 'true');
          el.style.backgroundColor = '#f8fafc';
          el.style.cursor = 'default';
        }
      }
    });

    form.querySelectorAll('.btn-del-fila-kardex, .btn-add-fila-kardex, #btn-subir-foto-kardex, #btn-quitar-foto-kardex').forEach(btn => {
      btn.style.display = enEdicion ? '' : 'none';
    });

    const btnToggle = document.getElementById('btn-toggle-edicion-kardex');
    if (btnToggle) {
      if (enEdicion) {
        btnToggle.className = 'btn-calif btn-calif-publish';
        btnToggle.style.background = '#15803d';
        btnToggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><polyline points="20 6 9 17 4 12"/></svg><span>Guardar Mi Kárdex</span>';
        btnToggle.onclick = async function() {
          if (typeof guardarKardexActual === 'function') {
            await guardarKardexActual();
            alternarModoEdicionKardexInline(false);
          }
        };
      } else {
        btnToggle.className = 'btn-calif btn-calif-primary';
        btnToggle.style.background = '#063b17';
        btnToggle.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Editar Mi Kárdex</span>';
        btnToggle.onclick = function() {
          alternarModoEdicionKardexInline(true);
        };
      }
    }

    const badgeModo = document.getElementById('badge-modo-kardex-inline');
    if (badgeModo) {
      badgeModo.textContent = enEdicion ? 'MODO EDICIÓN ACTIVO' : 'MODO LECTURA OFICIAL';
      badgeModo.style.background = enEdicion ? '#fef3c7' : '#dcfce7';
      badgeModo.style.color = enEdicion ? '#b45309' : '#15803d';
      badgeModo.style.borderColor = enEdicion ? '#fcd34d' : '#86efac';
    }
  }
  window.alternarModoEdicionKardexInline = alternarModoEdicionKardexInline;

  window.eliminarAvisoDocente = function(avisoId) {
    if (!confirm('¿Desea eliminar este aviso publicado?')) return;
    let avisos = (typeof lsGet === 'function') ? lsGet('cea_actividades', []) : [];
    avisos = avisos.filter(a => String(a.id) !== String(avisoId));
    if (typeof lsSet === 'function') lsSet('cea_actividades', avisos);
    else localStorage.setItem('cea_actividades', JSON.stringify(avisos));
    if (typeof renderContenidoDocenteStage === 'function') {
      renderContenidoDocenteStage('avisos');
    }
  };


  window._editandoDocumentoId = null;
  function editarDocumentoNivelDocente(areaKey, docId) {
    window._docEditandoId = String(docId);
    if (typeof window.renderContenidoDocenteStage === 'function') {
      window.renderContenidoDocenteStage('documentos');
    } else if (typeof window.conmutarVistaDocenteSidebar === 'function') {
      window.conmutarVistaDocenteSidebar('documentos');
    }
  }
  window.editarDocumentoNivelDocente = editarDocumentoNivelDocente;


  function descomponerFechaYEdad(fechaRaw) {
    if (!fechaRaw) return { fecha: '-', edad: '-' };
    let d, m, y;
    const rawStr = String(fechaRaw).trim();
    if (rawStr.includes('GMT') || (/[a-zA-Z]/.test(rawStr) && !isNaN(Date.parse(rawStr)))) {
      const dt = new Date(rawStr);
      if (!isNaN(dt.getTime())) {
        d = dt.getDate();
        m = dt.getMonth() + 1;
        y = dt.getFullYear();
      }
    }
    if (!d || !m || !y) {
      const cleanStr = rawStr.split('T')[0].split(' ')[0].trim();
      if (cleanStr.includes('/')) {
        const parts = cleanStr.split('/');
        if (parts.length >= 3) {
          d = parseInt(parts[0], 10);
          m = parseInt(parts[1], 10);
          y = parseInt(parts[2], 10);
          if (y < 100) y = y > 40 ? 1900 + y : 2000 + y;
        }
      } else if (cleanStr.includes('-')) {
        const parts = cleanStr.split('-');
        if (parts.length >= 3) {
          if (parts[0].length === 4) {
            y = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
            d = parseInt(parts[2], 10);
          } else {
            d = parseInt(parts[0], 10);
            m = parseInt(parts[1], 10);
            y = parseInt(parts[2], 10);
          }
        }
      }
    }
    if (d && m && y && !isNaN(d) && !isNaN(m) && !isNaN(y)) {
      const dStr = String(d).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      const fechaFmt = dStr + '-' + mStr + '-' + y;
      const hoy = new Date();
      let edad = hoy.getFullYear() - y;
      if ((hoy.getMonth() + 1) < m || ((hoy.getMonth() + 1) === m && hoy.getDate() < d)) {
        edad--;
      }
      return {
        fecha: fechaFmt,
        edad: (edad >= 0 && edad <= 120) ? (edad + ' años') : '-'
      };
    }
    const safeDate = rawStr.split(' ')[0].replace(/[^0-9/-]/g, '') || '-';
    return { fecha: safeDate, edad: '-' };
  }
  window.descomponerFechaYEdad = descomponerFechaYEdad;

  function formatearFechaNacimientoConEdad(fechaRaw) {
    const res = descomponerFechaYEdad(fechaRaw);
    if (res.fecha === '-') return '-';
    if (res.edad !== '-') return res.fecha + ' (' + res.edad + ')';
    return res.fecha;
  }
  window.formatearFechaNacimientoConEdad = formatearFechaNacimientoConEdad;

/* ==========================================================================
   SISTEMA INSTITUCIONAL DE GESTIÓN DE CALIFICACIONES ACADÉMICAS
   CENTRO DE EDUCACIÓN ALTERNATIVA «MADRE MARIE POUSSEPIN»
   Chulumani, Sud Yungas, La Paz, Bolivia
   Módulo Oficial y Modular de Calificaciones (Versión Perfeccionada v2)
   ========================================================================== */

(function (window, document) {
  'use strict';

  // ─── 1. CONSTANTES Y CONFIGURACIONES INSTITUCIONALES ───
  const CALIF_STORAGE_KEYS = {
    REGISTROS: 'cea_calificaciones_registros',
    DETALLES: 'cea_calificaciones_detalles',
    AUDITORIA: 'cea_calificaciones_auditoria',
    CONFIG: 'cea_calificaciones_config',
    PARALELOS: 'cea_paralelos_config',
    GESTIONES: 'cea_gestiones_lista',
    SUBIDA_NOTAS: 'cea_calificaciones_subida_notas',
    SUBIDA_ESTUDIANTES: 'cea_calificaciones_subida_estudiantes'
  };

  // Helper de persistencia de subida de notas por estudiante individual
  function _buildSubidaEstudianteKey(carreraKey, nivelNombre, gestion, semestre, paralelo, estId) {
    const c = String(carreraKey || 'sistemas').trim().toLowerCase();
    const n = String(nivelNombre || '').trim().replace(/\s+/g, '_').toLowerCase();
    const g = String(gestion || '2026').trim();
    const s = String(semestre || 'Segundo Semestre').trim().replace(/\s+/g, '_').toLowerCase();
    const p = String(paralelo || 'A').trim().toUpperCase();
    const id = String(estId || '').trim();
    return `${c}_${n}_${g}_${s}_${p}_${id}`;
  }

  function _getStorageItem(key, defaultVal) {
    if (typeof lsGet === 'function') return lsGet(key, defaultVal);
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        return val ? JSON.parse(val) : defaultVal;
      }
    } catch (e) {}
    return defaultVal;
  }

  function _setStorageItem(key, val) {
    if (typeof lsSet === 'function') return lsSet(key, val);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(val));
      }
    } catch (e) {}
  }

  function obtenerEstadoSubidaEstudiante(carreraKey, nivelNombre, gestion, semestre, paralelo, estId) {
    const key = _buildSubidaEstudianteKey(carreraKey, nivelNombre, gestion, semestre, paralelo, estId);
    const store = _getStorageItem('cea_calificaciones_subida_estudiantes', {});
    return Boolean(store[key]);
  }

  function setEstadoSubidaEstudiante(carreraKey, nivelNombre, gestion, semestre, paralelo, estId, valor) {
    const key = _buildSubidaEstudianteKey(carreraKey, nivelNombre, gestion, semestre, paralelo, estId);
    const store = _getStorageItem('cea_calificaciones_subida_estudiantes', {});
    store[key] = Boolean(valor);
    _setStorageItem('cea_calificaciones_subida_estudiantes', store);
    return store[key];
  }

  function setLoteEstadosSubidaEstudiantes(carreraKey, nivelNombre, gestion, semestre, paralelo, estIds, valor) {
    const store = _getStorageItem('cea_calificaciones_subida_estudiantes', {});
    (estIds || []).forEach(estId => {
      const key = _buildSubidaEstudianteKey(carreraKey, nivelNombre, gestion, semestre, paralelo, estId);
      store[key] = Boolean(valor);
    });
    _setStorageItem('cea_calificaciones_subida_estudiantes', store);
  }

  const SVG_ICONS = {
    LOCK: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    CLIPBOARD: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>',
    PRINT: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>',
    CHECK: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:3px"><polyline points="20 6 9 17 4 12"></polyline></svg>',
    WARN: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    EYE: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
    EDIT: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
    DOC: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
    USER: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    CAMERA: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>',
    FOLDER: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
    BOOK: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
    BELL: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    HOME: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
    CLOCK: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>'
  };

  window.SVG_ICONS = SVG_ICONS;
  function getSvgIcon(key) {
    if (SVG_ICONS && SVG_ICONS[key]) return SVG_ICONS[key];
    if (typeof window !== 'undefined' && window.SVG_ICONS && window.SVG_ICONS[key]) return window.SVG_ICONS[key];
    return '';
  }
  window.getSvgIcon = getSvgIcon;

  function escapeHTML(str) {
    if (typeof window.escapeHTML === 'function') return window.escapeHTML(str);
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const NIVELES_TECNICOS_OFICIALES = [
    'Técnico Básico',
    'Técnico Auxiliar',
    'Técnico Medio I',
    'Técnico Medio II'
  ];

  const NIVELES_HUMANISTICA_OFICIALES = [
    { nivel: 'Aprendizajes Elementales', ciclo: 'EPA - Primaria', curso: '1ro, 2do y 3ro' },
    { nivel: 'Aprendizajes Avanzados', ciclo: 'EPA - Primaria', curso: '4to, 5to y 6to' },
    { nivel: 'Aprendizajes Aplicados', ciclo: 'ESA - Secundaria', curso: '1ro y 2do de Secundaria' },
    { nivel: 'Aprendizajes Complementarios', ciclo: 'ESA - Secundaria', curso: '3ro y 4to de Secundaria' },
    { nivel: 'Aprendizajes Especializados', ciclo: 'ESA - Secundaria', curso: '5to y 6to de Secundaria' }
  ];

  const CRITERIOS_TECNICA_DEFAULT = [
    { id: 'ser', nombre: 'SER', max: 10, categoria: 'Heteroevaluación' },
    { id: 'saber', nombre: 'SABER', max: 30, categoria: 'Heteroevaluación' },
    { id: 'decidir', nombre: 'DECIDIR', max: 10, categoria: 'Heteroevaluación' },
    { id: 'proceso', nombre: 'PROCESO', max: 20, categoria: 'Hacer (Hetero)' },
    { id: 'producto', nombre: 'PRODUCTO', max: 20, categoria: 'Hacer (Hetero)' },
    { id: 'autoevaluacion', nombre: 'AUTOEVALUACIÓN', max: 10, categoria: 'Autoevaluación' }
  ];

  const CRITERIOS_HUMANISTICA_DEFAULT = [
    { id: 'ser', nombre: 'SER (Valores y actitudes)', max: 10, categoria: 'Desarrollo Integral' },
    { id: 'saber', nombre: 'SABER (Teoría y conceptos)', max: 35, categoria: 'Desarrollo Integral' },
    { id: 'hacer', nombre: 'HACER (Prácticas y tareas)', max: 35, categoria: 'Desarrollo Integral' },
    { id: 'decidir', nombre: 'DECIDIR (Impacto y comunidad)', max: 10, categoria: 'Desarrollo Integral' },
    { id: 'autoevaluacion', nombre: 'AUTOEVALUACIÓN', max: 10, categoria: 'Autoevaluación' }
  ];

  // Estado en memoria
  let _registroActivo = null;
  let _detallesActivos = [];
  let _subtabAdminCalif = 'tecnica'; // 'tecnica', 'humanistica', 'seguimiento', 'auditoria', 'centralizador'
  let _gestionActiva = '2026';
  let _semestreActivo = ((new Date().getMonth() + 1) >= 7) ? 'Segundo Semestre' : 'Primer Semestre';
  let _paraleloActivo = 'A';
  let _nivelActivoDocente = null;
  let _moduloActivoDocente = null;
  let _centralizadorActivoDatos = null;

  // Estado de navegación jerárquica para la Matriz de Seguimiento del Director
  let _matrizDirectorNav = {
    area: 'tecnica', // 'tecnica' | 'humanistica'
    especialidadKey: null,
    docenteNombre: null,
    nivel: null,
    modulo: null,
    paralelo: 'A'
  };

  let _filtroDirector = {
    subsistema: 'todos',
    carrera: 'todas',
    docente: 'todos',
    nivel: 'todos',
    semestre: 'todos',
    gestion: '2026',
    estado: 'todos'
  };

  // Estados de navegación interactiva por tarjetas para Área Técnica, Humanística y Afiliación
  let _areaTecnicaSelCarrera = null;
  let _areaHumanisticaSelMateria = null;
  let _afiliacionCarreraSeleccionada = null;
  let _afiliacionMateriaSeleccionada = null;
  let _afiliacionNivelSeleccionado = null;
  let _modoEdicionMallaDocente = false;

  function normalizarNivelTecnicoClasificacion(nivelRaw, extraInfo) {
    const s = String(nivelRaw || '').trim().toLowerCase();
    const ext = String(extraInfo || '').trim().toLowerCase();
    if (s.includes('medio 2') || s.includes('medio ii') || s.includes('medio-2') || s.includes('segundo') || ext.includes('medio_b') || ext.includes('hoja 4') || (ext.includes('paralelo b') && ext.includes('medio'))) return 'Técnico Medio II';
    if (s.includes('medio 1') || s.includes('medio i') || s.includes('medio-1') || s.includes('medio') || s.includes('primer')) {
      if (ext.includes('medio_b') || ext.includes('hoja 4') || (ext.includes('paralelo b') && !ext.includes('paralelo a'))) return 'Técnico Medio II';
      return 'Técnico Medio I';
    }
    if (s.includes('auxiliar') || s.includes('aux') || ext.includes('auxiliar')) return 'Técnico Auxiliar';
    if (s.includes('básico') || s.includes('basico') || s.includes('bas') || ext.includes('basico')) return 'Técnico Básico';
    return 'Técnico Básico';
  }
  window.normalizarNivelTecnicoClasificacion = normalizarNivelTecnicoClasificacion;

  function seleccionarNivelAfiliacion(nivel) {
    _afiliacionNivelSeleccionado = nivel;
    if (typeof filtrarTablaAfiliacion === 'function') filtrarTablaAfiliacion();
  }
  window.seleccionarNivelAfiliacion = seleccionarNivelAfiliacion;

  function volverNivelesAfiliacion() {
    _afiliacionNivelSeleccionado = null;
    if (typeof filtrarTablaAfiliacion === 'function') filtrarTablaAfiliacion();
  }
  window.volverNivelesAfiliacion = volverNivelesAfiliacion;

  function toggleEdicionMallaDocente() {
    window._modoEdicionMallaDocente = !window._modoEdicionMallaDocente;
    _modoEdicionMallaDocente = window._modoEdicionMallaDocente;
    if (typeof renderContenidoDocenteStage === 'function') {
      renderContenidoDocenteStage('malla');
    } else if (typeof conmutarVistaDocenteSidebar === 'function') {
      conmutarVistaDocenteSidebar('malla');
    }
  }
  window.toggleEdicionMallaDocente = toggleEdicionMallaDocente;

  function abrirOpcionesAfiliarEstudiante(areaKey, carreraNombre) {
    const modalId = 'modal-opciones-afiliar';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-edit-live';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-edit-live-content" style="max-width:440px;padding:24px;border-radius:14px;background:#ffffff;box-shadow:0 8px 30px rgba(0,0,0,0.25)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
          <h3 style="margin:0;color:#063b17;font-size:1.15rem;font-weight:900;display:flex;align-items:center;gap:8px">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Afiliar / Añadir Estudiantes
          </h3>
          <button type="button" onclick="document.getElementById('${modalId}').style.display='none'" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#64748b">&times;</button>
        </div>
        <p style="font-size:0.84rem;color:#475569;margin-bottom:18px">
          Seleccione el método de afiliación para registrar estudiantes en el padrón oficial de <strong>${escapeHTML(carreraNombre || 'la Especialidad')}</strong>:
        </p>

        <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px">
          <button type="button" class="btn-calif btn-calif-subir-excel" onclick="document.getElementById('${modalId}').style.display='none'; window.abrirModalSubirNominaExcel('afiliacion', '${escapeHTML(areaKey || 'todos')}');" style="padding:14px;justify-content:flex-start;font-size:0.90rem;font-weight:800;border-radius:10px">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <div style="text-align:left">
              <span style="display:block">Afiliar desde Excel / CSV (subir archivo)</span>
              <span style="display:block;font-size:0.75rem;font-weight:500;opacity:0.9">Suba el archivo y seleccione solo la hoja de su curso</span>
            </div>
          </button>

          <button type="button" class="btn-calif btn-calif-primary" onclick="document.getElementById('${modalId}').style.display='none'; window.abrirModalAgregarEstudianteAfiliacion('${escapeHTML(areaKey || '')}', '${escapeHTML(carreraNombre || '')}');" style="padding:14px;justify-content:flex-start;font-size:0.90rem;font-weight:800;border-radius:10px;background:#063b17;color:#fff;border:none">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="8" x2="6" y2="8"/><line x1="10" y1="8" x2="10" y2="8"/><line x1="14" y1="8" x2="14" y2="8"/><line x1="18" y1="8" x2="18" y2="8"/><line x1="6" y1="12" x2="6" y2="12"/><line x1="10" y1="12" x2="10" y2="12"/><line x1="14" y1="12" x2="14" y2="12"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="7" y1="16" x2="17" y2="16"/></svg>
            <div style="text-align:left">
              <span style="display:block">Añadir estudiante manualmente</span>
              <span style="display:block;font-size:0.75rem;font-weight:500;opacity:0.9">Escribir C.I., RUA, apellidos, nombres y nivel uno a uno</span>
            </div>
          </button>
        </div>

        <div style="text-align:right">
          <button type="button" class="btn-calif btn-calif-secondary" onclick="document.getElementById('${modalId}').style.display='none'">Cerrar</button>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  }
  window.abrirOpcionesAfiliarEstudiante = abrirOpcionesAfiliarEstudiante;

  function abrirModalAgregarEstudianteAfiliacion(areaKeyDefault, carNombreDefault, nivelDefault) {
    const modalId = 'modal-agregar-estudiante-afiliacion';
    let modal = document.getElementById(modalId);
    if (!modal) {
      modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'modal-edit-live';
      modal.style.display = 'none';
      document.body.appendChild(modal);
    }

    const nivelesOptions = ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio I', 'Técnico Medio II'];
    const aKey = areaKeyDefault || (window._afiliacionCarreraSeleccionada || 'tec-sec');
    const nomCar = carNombreDefault || 'Secretariado Ejecutivo';
    const nivSel = nivelDefault || _afiliacionNivelSeleccionado || 'Técnico Básico';

    modal.innerHTML = `
      <div class="modal-edit-live-content" style="max-width:540px;padding:24px;border-radius:14px;background:#ffffff;box-shadow:0 8px 30px rgba(0,0,0,0.25)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:2px solid #e2e8f0;padding-bottom:10px">
          <h3 style="margin:0;color:#063b17;font-size:1.15rem;font-weight:900;display:flex;align-items:center;gap:8px">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            Registrar Estudiante en Afiliación
          </h3>
          <button type="button" onclick="document.getElementById('${modalId}').style.display='none'" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#64748b">&times;</button>
        </div>

        <form onsubmit="window.ejecutarAgregarEstudianteAfiliacion(event, '${escapeHTML(aKey)}', '${escapeHTML(nomCar)}')">
          <div style="background:#f8fafc;padding:8px 12px;border-radius:8px;margin-bottom:14px;font-size:0.80rem;color:#475569;font-weight:700">
            Especialidad: <span style="color:#063b17">${escapeHTML(nomCar)}</span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Cédula de Identidad (C.I.) *</label>
              <input type="text" id="add-afi-ci" class="calif-filter-input" required placeholder="Ej: 8427847" />
            </div>
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Código RUDE / RUA</label>
              <input type="text" id="add-afi-rude" class="calif-filter-input" placeholder="Ej: 806300282007217A" />
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Apellido Paterno</label>
              <input type="text" id="add-afi-pat" class="calif-filter-input" placeholder="Ej: MAMANI" />
            </div>
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Apellido Materno</label>
              <input type="text" id="add-afi-mat" class="calif-filter-input" placeholder="Ej: QUISPE" />
            </div>
          </div>

          <div class="form-group" style="margin-bottom:12px">
            <label style="font-size:0.80rem;font-weight:700">Nombres *</label>
            <input type="text" id="add-afi-nom" class="calif-filter-input" required placeholder="Ej: JUAN CARLOS" />
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Fecha de Nacimiento</label>
              <input type="text" id="add-afi-fnac" class="calif-filter-input" placeholder="DD/MM/AA ó DD/MM/AAAA" />
            </div>
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Género *</label>
              <select id="add-afi-gen" class="calif-filter-select" style="width:100%" required>
                <option value="F">Femenino (F)</option>
                <option value="M">Masculino (M)</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px;margin-bottom:18px">
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Nivel Formativo *</label>
              <select id="add-afi-nivel" class="calif-filter-select" style="width:100%" required>
                ${nivelesOptions.map(n => `<option value="${escapeHTML(n)}" ${n === nivSel ? 'selected' : ''}>${escapeHTML(n)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Paralelo</label>
              <select id="add-afi-par" class="calif-filter-select" style="width:100%">
                <option value="A">Par. A</option>
                <option value="B">Par. B</option>
                <option value="C">Par. C</option>
              </select>
            </div>
            <div class="form-group">
              <label style="font-size:0.80rem;font-weight:700">Turno</label>
              <select id="add-afi-turno" class="calif-filter-select" style="width:100%">
                <option value="TARDE">Tarde</option>
                <option value="NOCHE">Noche</option>
                <option value="MAÑANA">Mañana</option>
              </select>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px">
            <button type="button" class="btn-calif btn-calif-secondary" onclick="document.getElementById('${modalId}').style.display='none'">Cancelar</button>
            <button type="submit" class="btn-calif btn-calif-primary" style="background:#063b17;color:#fff;border:none">+ Afiliar Estudiante</button>
          </div>
        </form>
      </div>
    `;
    modal.style.display = 'flex';
  }
  window.abrirModalAgregarEstudianteAfiliacion = abrirModalAgregarEstudianteAfiliacion;

  function ejecutarAgregarEstudianteAfiliacion(e, areaKey, carreraNombre) {
    e.preventDefault();
    const ci = (document.getElementById('add-afi-ci')?.value || '').trim();
    const rude = (document.getElementById('add-afi-rude')?.value || '').trim();
    const pat = (document.getElementById('add-afi-pat')?.value || '').trim().toUpperCase();
    const mat = (document.getElementById('add-afi-mat')?.value || '').trim().toUpperCase();
    const nom = (document.getElementById('add-afi-nom')?.value || '').trim().toUpperCase();
    const fnac = (document.getElementById('add-afi-fnac')?.value || '').trim();
    const gen = (document.getElementById('add-afi-gen')?.value || 'F').toUpperCase();
    const niv = document.getElementById('add-afi-nivel')?.value || 'Técnico Básico';
    const par = document.getElementById('add-afi-par')?.value || 'A';
    const turno = document.getElementById('add-afi-turno')?.value || 'TARDE';

    const nombreCompleto = [pat, mat, nom].filter(Boolean).join(' ');
    if (!nombreCompleto || !ci) {
      if (typeof mostrarNotificacionToast === 'function') mostrarNotificacionToast('Error: Complete los nombres y C.I. del estudiante', 'error');
      return;
    }

    const nuevo = {
      id: ci || rude || (areaKey + '_' + nombreCompleto),
      nombreCompleto,
      paterno: pat,
      materno: mat,
      nombres: nom,
      ci,
      rude,
      fechaNacimiento: fnac,
      genero: gen,
      areaKey,
      carreraNombre,
      nivel: niv,
      paralelo: par,
      turno
    };

    actualizarEstudiantesAfiliacion([nuevo], 'fusionar');
    const modalEl = document.getElementById('modal-agregar-estudiante-afiliacion');
    if (modalEl) modalEl.style.display = 'none';
    if (typeof filtrarTablaAfiliacion === 'function') filtrarTablaAfiliacion();
    if (typeof mostrarNotificacionToast === 'function') {
      mostrarNotificacionToast(`¡Estudiante ${nombreCompleto} afiliado exitosamente!`, 'success');
    }
  }
  window.ejecutarAgregarEstudianteAfiliacion = ejecutarAgregarEstudianteAfiliacion;

  function obtenerSemestreAutomaticoPorFecha() {
    const mes = new Date().getMonth() + 1;
    return mes >= 7 ? 'Segundo Semestre' : 'Primer Semestre';
  }
  window.obtenerSemestreAutomaticoPorFecha = obtenerSemestreAutomaticoPorFecha;

  function seleccionarCarreraTecnicaDirector(key) {
    _areaTecnicaSelCarrera = key;
    renderSubtabAdminContenido();
  }
  window.seleccionarCarreraTecnicaDirector = seleccionarCarreraTecnicaDirector;

  function volverListaCarrerasTecnicasDirector() {
    _areaTecnicaSelCarrera = null;
    renderSubtabAdminContenido();
  }
  window.volverListaCarrerasTecnicasDirector = volverListaCarrerasTecnicasDirector;

  function seleccionarMateriaHumanisticaDirector(key) {
    _areaHumanisticaSelMateria = key;
    renderSubtabAdminContenido();
  }
  window.seleccionarMateriaHumanisticaDirector = seleccionarMateriaHumanisticaDirector;

  function volverListaMateriasHumanisticasDirector() {
    _areaHumanisticaSelMateria = null;
    renderSubtabAdminContenido();
  }
  window.volverListaMateriasHumanisticasDirector = volverListaMateriasHumanisticasDirector;

  function seleccionarCarreraAfiliacion(key) {
    _afiliacionCarreraSeleccionada = key;
    if (typeof filtrarTablaAfiliacion === 'function') {
      filtrarTablaAfiliacion();
    } else if (typeof renderSubtabAdminContenido === 'function') {
      renderSubtabAdminContenido();
    }
  }
  window.seleccionarCarreraAfiliacion = seleccionarCarreraAfiliacion;

  function seleccionarMateriaAfiliacion(key) {
    _afiliacionMateriaSeleccionada = key;
    if (typeof filtrarTablaAfiliacion === 'function') {
      filtrarTablaAfiliacion();
    } else if (typeof renderSubtabAdminContenido === 'function') {
      renderSubtabAdminContenido();
    }
  }
  window.seleccionarMateriaAfiliacion = seleccionarMateriaAfiliacion;

  function volverListaAfiliacion() {
    _afiliacionCarreraSeleccionada = null;
    _afiliacionMateriaSeleccionada = null;
    _afiliacionNivelSeleccionado = null;
    if (typeof filtrarTablaAfiliacion === 'function') {
      filtrarTablaAfiliacion();
    } else if (typeof renderSubtabAdminContenido === 'function') {
      renderSubtabAdminContenido();
    }
  }
  window.volverListaAfiliacion = volverListaAfiliacion;



  // ─── 2. GESTIONES Y PARALELOS ACADÉMICOS ───
  function getGestionesDisponibles() {
    const lista = (typeof lsGet === 'function')
      ? lsGet(CALIF_STORAGE_KEYS.GESTIONES, ['2026'])
      : JSON.parse(localStorage.getItem(CALIF_STORAGE_KEYS.GESTIONES) || '["2026"]');
    return Array.isArray(lista) && lista.length > 0 ? lista : ['2026'];
  }

  function crearNuevaGestion(nuevoAnio) {
    const anioStr = String(nuevoAnio || '').trim();
    if (!anioStr || !/^\d{4}$/.test(anioStr)) {
      alert('Por favor ingrese un año de 4 dígitos válido (Ej: 2027).');
      return false;
    }
    const lista = getGestionesDisponibles();
    if (!lista.includes(anioStr)) {
      lista.push(anioStr);
      lista.sort((a, b) => b.localeCompare(a)); // Más recientes primero
      if (typeof lsSet === 'function') lsSet(CALIF_STORAGE_KEYS.GESTIONES, lista);
      else localStorage.setItem(CALIF_STORAGE_KEYS.GESTIONES, JSON.stringify(lista));
      registrarAuditoria('GESTION', 'NUEVA_GESTION', `Habilitación de nueva gestión académica: ${anioStr}`);
      alert(`Gestión académica ${anioStr} habilitada correctamente. Los registros anteriores se conservan intactos.`);
    }
    _gestionActiva = anioStr;
    return true;
  }


  function getParalelosHabilitadosCurso(carreraKey, nivel, gestion) {
    const list = (typeof getParalelosDisponibles === 'function') 
      ? getParalelosDisponibles(carreraKey, nivel, gestion)
      : ['A'];
    const setP = new Set(list);

    // Revisar registros existentes
    const regs = (typeof getRegistros === 'function') ? getRegistros() : [];
    regs.forEach(r => {
      const matchCar = r.areaKey === carreraKey || r.carreraAreaKey === carreraKey || normalizarCadena(r.carrera || '') === normalizarCadena(carreraKey);
      const matchNiv = r.nivel === nivel || normalizarCadena(r.nivel || '') === normalizarCadena(nivel);
      if (matchCar && matchNiv && r.paralelo) {
        setP.add(r.paralelo.toUpperCase());
      }
    });

    // Revisar estudiantes en afiliación general
    if (typeof obtenerEstudiantesAfiliacion === 'function') {
      const afis = obtenerEstudiantesAfiliacion();
      const aNorm = normalizarCadena(carreraKey || '');
      const nNorm = normalizarCadena(nivel || '');
      afis.forEach(a => {
        const matchCar = a.areaKey === carreraKey || normalizarCadena(a.areaKey || '') === aNorm || normalizarCadena(a.carreraNombre || '').includes(aNorm) || aNorm.includes(normalizarCadena(a.carreraNombre || ''));
        const aNivCan = (typeof normalizarNivelCanonica === 'function') ? normalizarNivelCanonica(a.nivel || '') : '';
        const nCan = (typeof normalizarNivelCanonica === 'function') ? normalizarNivelCanonica(nivel || '') : '';
        const matchNiv = (aNivCan && nCan) ? (aNivCan === nCan) : (normalizarCadena(a.nivel || '') === nNorm);
        if (matchCar && matchNiv && a.paralelo) {
          setP.add(a.paralelo.toUpperCase());
        }
      });
    }

    if (setP.size === 0) setP.add('A');
    return Array.from(setP).sort();
  }
  window.getParalelosHabilitadosCurso = getParalelosHabilitadosCurso;

  function getParalelosDisponibles(carreraKey, nivel, gestion) {
    const key = `par_${carreraKey || 'gen'}_${nivel || 'gen'}_${gestion || _gestionActiva}`;
    const config = (typeof lsGet === 'function')
      ? lsGet(CALIF_STORAGE_KEYS.PARALELOS, {})
      : JSON.parse(localStorage.getItem(CALIF_STORAGE_KEYS.PARALELOS) || '{}');
    const paras = config[key] || ['A'];
    return Array.from(new Set(paras)).sort();
  }

  function agregarNuevoParalelo(carreraKey, nivel, gestion, nombreParalelo) {
    const p = String(nombreParalelo || '').trim().toUpperCase();
    if (!p) return false;
    const key = `par_${carreraKey || 'gen'}_${nivel || 'gen'}_${gestion || _gestionActiva}`;
    const config = (typeof lsGet === 'function')
      ? lsGet(CALIF_STORAGE_KEYS.PARALELOS, {})
      : JSON.parse(localStorage.getItem(CALIF_STORAGE_KEYS.PARALELOS) || '{}');
    if (!config[key]) config[key] = ['A'];
    if (!config[key].includes(p)) {
      config[key].push(p);
      config[key].sort();
      if (typeof lsSet === 'function') lsSet(CALIF_STORAGE_KEYS.PARALELOS, config);
      else localStorage.setItem(CALIF_STORAGE_KEYS.PARALELOS, JSON.stringify(config));
      registrarAuditoria(key, 'CREAR_PARALELO', `Creación de nuevo paralelo: "${p}" para ${carreraKey} - ${nivel} (Gestión ${gestion})`);
    }
    return true;
  }

  // ─── 3. UTILIDADES DE ALMACENAMIENTO Y AUDITORÍA ───
  function getRegistros() {
    let regs = (typeof lsGet === 'function')
      ? lsGet(CALIF_STORAGE_KEYS.REGISTROS, [])
      : JSON.parse(localStorage.getItem(CALIF_STORAGE_KEYS.REGISTROS) || '[]');
    if (!Array.isArray(regs)) regs = [];

    let modificado = false;
    regs.forEach(r => {
      // Regla institucional obligatoria: Registros de la gestión 2026 sin semestre se asignan por defecto a Segundo Semestre
      if (String(r.gestion) === '2026') {
        if (!r.semestre || r.semestre === '' || r.semestre === 'todos' || r.semestre === '1er Semestre' && !r.semestreEspecificado) {
          r.semestre = 'Segundo Semestre';
          modificado = true;
        }
      } else if (!r.semestre) {
        r.semestre = 'Primer Semestre';
        modificado = true;
      }
    });

    if (modificado) {
      setRegistros(regs);
    }
    return regs;
  }

  function setRegistros(regs) {
    if (typeof lsSet === 'function') {
      lsSet(CALIF_STORAGE_KEYS.REGISTROS, regs);
    } else {
      localStorage.setItem(CALIF_STORAGE_KEYS.REGISTROS, JSON.stringify(regs));
    }
  }

  function getDetalles() {
    return (typeof lsGet === 'function')
      ? lsGet(CALIF_STORAGE_KEYS.DETALLES, [])
      : JSON.parse(localStorage.getItem(CALIF_STORAGE_KEYS.DETALLES) || '[]');
  }

  function setDetalles(dets) {
    if (typeof lsSet === 'function') {
      lsSet(CALIF_STORAGE_KEYS.DETALLES, dets);
    } else {
      localStorage.setItem(CALIF_STORAGE_KEYS.DETALLES, JSON.stringify(dets));
    }
  }

  function getAuditoria() {
    return (typeof lsGet === 'function')
      ? lsGet(CALIF_STORAGE_KEYS.AUDITORIA, [])
      : JSON.parse(localStorage.getItem(CALIF_STORAGE_KEYS.AUDITORIA) || '[]');
  }

  function registrarAuditoria(idRegistro, accion, detalle) {
    try {
      const session = (typeof lsGet === 'function') ? lsGet('cea_session', {}) : {};
      const usuario = session.name || session.user || 'Sistema';
      const rol = session.role || 'desconocido';
      const logs = getAuditoria();
      const nuevoLog = {
        id: 'AUD-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        idRegistro: idRegistro || 'GENERAL',
        usuario: usuario,
        rol: rol,
        accion: accion,
        detalle: detalle,
        fechaHora: new Date().toLocaleString('es-BO')
      };
      logs.unshift(nuevoLog);
      if (logs.length > 300) logs.length = 300;
      if (typeof lsSet === 'function') {
        lsSet(CALIF_STORAGE_KEYS.AUDITORIA, logs);
      } else {
        localStorage.setItem(CALIF_STORAGE_KEYS.AUDITORIA, JSON.stringify(logs));
      }
      sincronizarCalifGoogleSheet('registrar-auditoria-calificaciones', nuevoLog);
    } catch (e) {
      console.warn('Error al registrar auditoría:', e);
    }
  }

  function normalizarCadena(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // ─── MALLAS OFICIALES TÉCNICAS (5 MÓDULOS POR CADA NIVEL) ───
  const MALLAS_TECNICAS_DEFAULT_MAP = {
    'tec-sis': {
      key: 'tec-sis',
      nombre: 'Sistemas Informáticos',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Taller de Sistemas Operativos I'], ['Módulo II', 'Matemática para la Informática'], ['Módulo III', 'Programación I-A'], ['Módulo IV', 'Hardware de Computadoras I'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Taller de Sistemas Operativos II'], ['Módulo VII', 'Ofimática y Tecnología Multimedia I'], ['Módulo VIII', 'Programación I-B'], ['Módulo IX', 'Hardware de Computadoras II'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Inglés Técnico'], ['Módulo XII', 'Diseño y Programación Web I-A'], ['Módulo XIII', 'Programación I-C'], ['Módulo XIV', 'Ofimática y Tecnología Multimedia II'], ['Módulo XV', 'Emprendimiento Productivo']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Redes de Computadoras I'], ['Módulo XVII', 'Diseño y Programación Web I-B'], ['Módulo XVIII', 'Base de Datos I'], ['Módulo XIX', 'Programación Móvil I'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-agropecuaria': {
      key: 'tec-agropecuaria',
      nombre: 'Agropecuaria',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Suelos y Fertilidad'], ['Módulo II', 'Producción de Hortalizas'], ['Módulo III', 'Sanidad Vegetal'], ['Módulo IV', 'Riegos y Drenajes'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Manejo de Frutales'], ['Módulo VII', 'Crianza de Animales Menores'], ['Módulo VIII', 'Nutrición Animal'], ['Módulo IX', 'Agroforestería'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Transformación de Alimentos'], ['Módulo XII', 'Maquinaria Agrícola'], ['Módulo XIII', 'Producción Pecuaria'], ['Módulo XIV', 'Gestión de Cuencas'], ['Módulo XV', 'Emprendimiento Agropecuario']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Agroecología Avanzada'], ['Módulo XVII', 'Comercialización y Mercados'], ['Módulo XVIII', 'Proyectos Agropecuarios'], ['Módulo XIX', 'Biotecnología Agrícola'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-sec': {
      key: 'tec-sec',
      nombre: 'Secretariado Ejecutivo',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Técnicas de Oficina'], ['Módulo II', 'Digitación Computarizada'], ['Módulo III', 'Redacción General'], ['Módulo IV', 'Relaciones Humanas'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Gestión Documental y Archivo'], ['Módulo VII', 'Ofimática Empresarial'], ['Módulo VIII', 'Correspondencia Comercial'], ['Módulo IX', 'Ética Profesional'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Inglés Comercial I'], ['Módulo XII', 'Contabilidad Básica'], ['Módulo XIII', 'Administración y Gestión'], ['Módulo XIV', 'Protocolo y Eventos'], ['Módulo XV', 'Emprendimiento Secretarial']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Inglés Comercial II'], ['Módulo XVII', 'Sistemas de Información'], ['Módulo XVIII', 'Gestión Ejecutiva'], ['Módulo XIX', 'Legislación Laboral'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-bel': {
      key: 'tec-bel',
      nombre: 'Belleza Integral',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Bioseguridad y Ergonomía'], ['Módulo II', 'Cuidado y Tratamiento Capilar'], ['Módulo III', 'Técnicas de Manicura y Pedicura'], ['Módulo IV', 'Atención al Cliente'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Cortes de Cabello Unisex'], ['Módulo VII', 'Colorimetría Básica'], ['Módulo VIII', 'Peinados y Diseños'], ['Módulo IX', 'Tratamientos Faciales Básicos'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Colorimetría Avanzada'], ['Módulo XII', 'Maquillaje Profesional'], ['Módulo XIII', 'Cosmetología Aplicada'], ['Módulo XIV', 'Ondulaciones y Alisados'], ['Módulo XV', 'Emprendimiento en Estética']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Cosmiatría y Estética Corporal'], ['Módulo XVII', 'Técnicas de Spa'], ['Módulo XVIII', 'Gestión de Salón'], ['Módulo XIX', 'Tendencias y Vanguardia'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-contaduria': {
      key: 'tec-contaduria',
      nombre: 'Contaduría General',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Introducción a la Contabilidad'], ['Módulo II', 'Documentación Mercantil'], ['Módulo III', 'Legislación Comercial'], ['Módulo IV', 'Matemática Financiera I'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Contabilidad Intermedia'], ['Módulo VII', 'Sistemas Tributarios I'], ['Módulo VIII', 'Informática Contable I'], ['Módulo IX', 'Matemática Financiera II'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Contabilidad de Costos'], ['Módulo XII', 'Sistemas Tributarios II'], ['Módulo XIII', 'Informática Contable II'], ['Módulo XIV', 'Contabilidad de Sociedades'], ['Módulo XV', 'Emprendimiento Financiero']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Auditoría Básica'], ['Módulo XVII', 'Contabilidad Gubernamental'], ['Módulo XVIII', 'Análisis e Interpretación de EE.FF.'], ['Módulo XIX', 'Gabinete Contable'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-gas': {
      key: 'tec-gas',
      nombre: 'Gastronomía',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Higiene y Manipulación de Alimentos'], ['Módulo II', 'Técnicas Culinarias Básicas'], ['Módulo III', 'Nutrición y Dietética'], ['Módulo IV', 'Cocina Nacional I'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Cocina Nacional II'], ['Módulo VII', 'Panadería y Masas'], ['Módulo VIII', 'Costos y Presupuestos Culinarios'], ['Módulo IX', 'Técnicas de Emplatado'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Cocina Internacional'], ['Módulo XII', 'Pastelería y Repostería'], ['Módulo XIII', 'Coctelería y Bebidas'], ['Módulo XIV', 'Servicio de Comedor y Salón'], ['Módulo XV', 'Emprendimiento Gastronómico']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Alta Cocina y Vanguardia'], ['Módulo XVII', 'Chocolatería y Confitería'], ['Módulo XVIII', 'Gestión de Restaurantes'], ['Módulo XIX', 'Catering y Eventos'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-tex': {
      key: 'tec-tex',
      nombre: 'Confección Textil',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Manejo de Máquinas de Confección'], ['Módulo II', 'Trazado y Corte Básico'], ['Módulo III', 'Costura Recta y Remallado'], ['Módulo IV', 'Telas y Materiales'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Patronaje y Confección de Faldas y Blusas'], ['Módulo VII', 'Confección de Pantalones'], ['Módulo VIII', 'Acabados y Planchado'], ['Módulo IX', 'Mantenimiento de Máquinas'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Confección de Ropa Deportiva'], ['Módulo XII', 'Patronaje Industrial'], ['Módulo XIII', 'Confección de Camisas y Vestidos'], ['Módulo XIV', 'Control de Calidad Textil'], ['Módulo XV', 'Emprendimiento Textil']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Sastrería y Ropa de Fiesta'], ['Módulo XVII', 'Diseño de Modas y Tendencias'], ['Módulo XVIII', 'Costos y Presupuestos Textiles'], ['Módulo XIX', 'Producción en Serie'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-construccion': {
      key: 'tec-construccion',
      nombre: 'Construcción Civil',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Seguridad Industrial en Construcción'], ['Módulo II', 'Materiales de Construcción'], ['Módulo III', 'Albañilería Básica'], ['Módulo IV', 'Herramientas y Equipos'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Encofrados y Fierrería'], ['Módulo VII', 'Hormigón Armado'], ['Módulo VIII', 'Lectura de Planos de Arquitectura'], ['Módulo IX', 'Topografía Básica'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Instalaciones Hidrosanitarias'], ['Módulo XII', 'Instalaciones Eléctricas en Viviendas'], ['Módulo XIII', 'Revestimientos y Acabados'], ['Módulo XIV', 'Cómputos Métricos y Presupuestos'], ['Módulo XV', 'Emprendimiento en Construcción']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Supervisión de Obras'], ['Módulo XVII', 'Estructuras Especiales'], ['Módulo XVIII', 'Dibujo Asistido por Computadora (CAD)'], ['Módulo XIX', 'Seguridad y Medio Ambiente en Obra'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    },
    'tec-parvularia': {
      key: 'tec-parvularia',
      nombre: 'Parvularia',
      malla: [
        { nivel: 'Técnico Básico', modulos: [['Módulo I', 'Desarrollo Integral Infantil'], ['Módulo II', 'Salud, Higiene y Primeros Auxilios'], ['Módulo III', 'Nutrición en la Primera Infancia'], ['Módulo IV', 'Estimulación Oportuna'], ['Módulo V', 'Emergente']] },
        { nivel: 'Técnico Auxiliar', modulos: [['Módulo VI', 'Psicología Infantil'], ['Módulo VII', 'Elaboración de Material Didáctico'], ['Módulo VIII', 'Expresión Artística y Corporal'], ['Módulo IX', 'Juegos y Recreación'], ['Módulo X', 'Emergente']] },
        { nivel: 'Técnico Medio I', modulos: [['Módulo XI', 'Literatura y Narración Infantil'], ['Módulo XII', 'Planificación Curricular Inicial'], ['Módulo XIII', 'Estrategias Pedagógicas en Parvularia'], ['Módulo XIV', 'Detección de Dificultades de Aprendizaje'], ['Módulo XV', 'Emprendimiento en Centros Infantiles']] },
        { nivel: 'Técnico Medio II', modulos: [['Módulo XVI', 'Gestión y Administración de Centros Infantiles'], ['Módulo XVII', 'Familia, Comunidad y Escuela'], ['Módulo XVIII', 'Ética y Deontología en Parvularia'], ['Módulo XIX', 'Taller de Práctica Integral'], ['Módulo XX', 'Modalidades de Graduación']] }
      ]
    }
  };

  function buscarCarreraOficial(keyOrName) {
    const poolOficial = (typeof window !== 'undefined' && Array.isArray(window.BASE_CARRERAS_20) && window.BASE_CARRERAS_20.length > 0)
      ? window.BASE_CARRERAS_20
      : ((typeof BASE_CARRERAS_20 !== 'undefined' && Array.isArray(BASE_CARRERAS_20))
          ? BASE_CARRERAS_20
          : ((typeof AREAS_TEC_DEFAULT !== 'undefined' && Array.isArray(AREAS_TEC_DEFAULT)) ? AREAS_TEC_DEFAULT : []));
    const raw = String(keyOrName || '').trim();
    const norm = normalizarCadena(raw).replace(/^tec-?/, '');
    const pool = (typeof BASE_CARRERAS_20 !== 'undefined' && Array.isArray(BASE_CARRERAS_20))
      ? BASE_CARRERAS_20
      : ((typeof AREAS_TEC_DEFAULT !== 'undefined' && Array.isArray(AREAS_TEC_DEFAULT)) ? AREAS_TEC_DEFAULT : []);

    let found = pool.find(c => {
      const cKeyNorm = normalizarCadena(c.key).replace(/^tec-?/, '');
      const cNomNorm = normalizarCadena(c.nombre);
      return cKeyNorm === norm || cNomNorm === norm || norm.includes(cKeyNorm) || cKeyNorm.includes(norm) || norm.includes(cNomNorm) || cNomNorm.includes(norm);
    });

    if (!found) {
      for (const k in MALLAS_TECNICAS_DEFAULT_MAP) {
        const item = MALLAS_TECNICAS_DEFAULT_MAP[k];
        const iKeyNorm = normalizarCadena(item.key).replace(/^tec-?/, '');
        const iNomNorm = normalizarCadena(item.nombre);
        if (iKeyNorm === norm || iNomNorm === norm || norm.includes(iKeyNorm) || iKeyNorm.includes(norm) || norm.includes(iNomNorm) || iNomNorm.includes(norm)) {
          found = item;
          break;
        }
      }
    }

    if (!found) {
      found = pool[0] || MALLAS_TECNICAS_DEFAULT_MAP['tec-sis'];
    }
    return found;
  }

  function obtenerMallaOficialTecnica(carreraKey, nivelNombre) {
    const car = buscarCarreraOficial(carreraKey);
    const nivelNorm = normalizarCadena(nivelNombre);
    let itemNivel = null;
    if (car && Array.isArray(car.malla)) {
      itemNivel = car.malla.find(m => normalizarCadena(m.nivel) === nivelNorm);
      if (!itemNivel) {
        if (nivelNorm.endsWith(' ii') || nivelNorm.includes('medio 2') || nivelNorm.includes('segundo')) {
          itemNivel = car.malla.find(m => normalizarCadena(m.nivel).endsWith(' ii'));
        } else if (nivelNorm.endsWith(' i') || nivelNorm.includes('medio 1') || nivelNorm.includes('primero')) {
          itemNivel = car.malla.find(m => normalizarCadena(m.nivel).endsWith(' i') && !normalizarCadena(m.nivel).endsWith(' ii'));
        } else {
          itemNivel = car.malla.find(m => normalizarCadena(m.nivel).includes(nivelNorm) || nivelNorm.includes(normalizarCadena(m.nivel)));
        }
      }
    }
    let modulos = (itemNivel && Array.isArray(itemNivel.modulos) && itemNivel.modulos.length > 0)
      ? itemNivel.modulos
      : null;

    if (!modulos || modulos.length === 0) {
      const prefijo = nivelNorm.includes('auxiliar') ? 'Módulo VI' :
                      nivelNorm.includes('medio i') ? 'Módulo XI' :
                      nivelNorm.includes('medio ii') ? 'Módulo XVI' : 'Módulo I';
      modulos = [
        ['MOD-01', `${prefijo}: Fundamentos Productivos`],
        ['MOD-02', 'Módulo 2: Técnicas Especializadas'],
        ['MOD-03', 'Módulo 3: Práctica Comunitaria'],
        ['MOD-04', 'Módulo 4: Proyecto Productivo'],
        ['MOD-05', 'Módulo 5: Innovación Tecnológica']
      ];
    }

    return modulos.slice(0, 5).map((m, idx) => {
      const cod = Array.isArray(m) ? m[0] : (m.codigo || ('MOD-0' + (idx + 1)));
      const nom = Array.isArray(m) ? m[1] : (m.nombre || m);
      return {
        codigo: cod,
        nombre: nom,
        completo: `${cod}: ${nom}`
      };
    });
  }

  function obtenerDocenteLogueado() {
    let session = null;
    if (typeof lsGet === 'function') {
      session = lsGet('cea_session', null) || lsGet('cea_sesion_activa', null);
    } else if (typeof localStorage !== 'undefined') {
      try {
        session = JSON.parse(localStorage.getItem('cea_session') || localStorage.getItem('cea_sesion_activa') || 'null');
      } catch (e) {}
    }
    if (!session && window._docAreaKeyActiva) {
      return {
        role: 'docente',
        name: 'Docente',
        areaKey: window._docAreaKeyActiva,
        token: ''
      };
    }
    if (!session) return null;
    return {
      role: session.role || 'docente',
      name: session.name || 'Docente',
      areaKey: session.areaKey || window._docAreaKeyActiva || '',
      token: session.token || ''
    };
  }

  /**
   * Resuelve las asignaciones oficiales reales del docente logueado
   */
  function obtenerAsignacionesDocente(docenteInfo) {
    const asignaciones = {
      tecnica: [],
      humanistica: []
    };

    if (!docenteInfo) return asignaciones;
    const { name, areaKey, role } = docenteInfo;
    const nameNorm = normalizarCadena(name);
    const keyNorm = normalizarCadena(areaKey);
    const esModoDocente = (role === 'docente');
    const esAreaHumanistica = keyNorm.startsWith('hum') || keyNorm.includes('social') || keyNorm.includes('natural') || keyNorm.includes('matematica') || keyNorm.includes('lenguaje');

    const areasTec = (typeof lsGet === 'function')
      ? lsGet('cea_areas_tec', (typeof AREAS_TEC_DEFAULT !== 'undefined' ? AREAS_TEC_DEFAULT : []))
      : (typeof AREAS_TEC_DEFAULT !== 'undefined' ? AREAS_TEC_DEFAULT : []);

    const docentesMap = (typeof lsGet === 'function')
      ? lsGet('cea_docentes', (typeof DOCENTES_DEFAULT !== 'undefined' ? DOCENTES_DEFAULT : {}))
      : (typeof DOCENTES_DEFAULT !== 'undefined' ? DOCENTES_DEFAULT : {});

    // 1. ASIGNACIONES TÉCNICAS (SOLO SI NO ES DOCENTE EXCLUSIVO DE HUMANÍSTICA)
    if (!esModoDocente || !esAreaHumanistica) {
      const nivelesTec = ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio I', 'Técnico Medio II'];

      areasTec.forEach(carrera => {
        const docAsignadoCarrera = docentesMap[carrera.key] || carrera.docente || '';
        const docAsignadoNorm = normalizarCadena(docAsignadoCarrera);
        const carreraKeyNorm = normalizarCadena(carrera.key);
        const cKeyClean = carreraKeyNorm.replace(/^tec-?/, '');
        const kKeyClean = keyNorm.replace(/^tec-?/, '');
        const cNomNorm = normalizarCadena(carrera.nombre);

        const esMismaCarrera = (carreraKeyNorm === keyNorm) ||
                               (carrera.key === areaKey) ||
                               (cKeyClean && kKeyClean && (cKeyClean.includes(kKeyClean) || kKeyClean.includes(cKeyClean))) ||
                               (cNomNorm && kKeyClean && (cNomNorm.includes(kKeyClean) || kKeyClean.includes(cNomNorm)));

        const esDocenteAsignado = (role === 'director' || role === 'admin') ||
                                  esMismaCarrera ||
                                  (docAsignadoNorm && nameNorm && nameNorm.length > 4 && (docAsignadoNorm.includes(nameNorm) || nameNorm.includes(docAsignadoNorm)));

        if (esDocenteAsignado) {
          nivelesTec.forEach(nivelNombre => {
            const modulos = obtenerMallaOficialTecnica(carrera.key, nivelNombre);
            modulos.forEach(modItem => {
              asignaciones.tecnica.push({
                tipo: 'tecnica',
                areaKey: carrera.key,
                carrera: carrera.nombre,
                nivel: nivelNombre,
                moduloCodigo: modItem.codigo,
                moduloNombre: modItem.nombre,
                moduloCompleto: modItem.completo,
                docente: docAsignadoCarrera || name,
                color: carrera.color || 'var(--verde-dark)'
              });
            });
          });
        }
      });

      // Si por alguna razón la lista quedó vacía para el docente técnico, resolver directamente con carrera oficial
      if (asignaciones.tecnica.length === 0 && (!esModoDocente || !esAreaHumanistica)) {
        const carOficial = buscarCarreraOficial(areaKey || 'sistemas');
        nivelesTec.forEach(nivelNombre => {
          const modulos = obtenerMallaOficialTecnica(carOficial.key, nivelNombre);
          modulos.forEach(modItem => {
            asignaciones.tecnica.push({
              tipo: 'tecnica',
              areaKey: carOficial.key,
              carrera: carOficial.nombre,
              nivel: nivelNombre,
              moduloCodigo: modItem.codigo,
              moduloNombre: modItem.nombre,
              moduloCompleto: modItem.completo,
              docente: name || 'Docente',
              color: carOficial.color || 'var(--verde-dark)'
            });
          });
        });
      }
    }

    // 2. ASIGNACIONES HUMANÍSTICAS (SOLO SI NO ES DOCENTE EXCLUSIVO DE TÉCNICA)
    if (!esModoDocente || esAreaHumanistica) {
      const materiasHum = (typeof MATERIAS_HUMANISTICA !== 'undefined') ? MATERIAS_HUMANISTICA : [
        { area: 'CIENCIAS NATURALES', docente: 'Lic. Edmar Callisaya Tapia', clase: 'hum-cn' },
        { area: 'MATEMÁTICA Y ESTADÍSTICA', docente: 'Lic. Marcela Choque Mamani', clase: 'hum-mat' },
        { area: 'CIENCIAS SOCIALES', docente: 'Lic. María Estela Laura Tenorio', clase: 'hum-cs' },
        { area: 'LENGUAJE Y LITERATURA', docente: 'Lic. Efraina Pajarito Ventura', clase: 'hum-len' }
      ];

      materiasHum.forEach(mat => {
        const docAsignadoMateria = docentesMap[mat.clase] || mat.docente || '';
        const docAsignadoNorm = normalizarCadena(docAsignadoMateria);
        const claseNorm = normalizarCadena(mat.clase);

        const esDocenteAsignadoHum = (role === 'director' || role === 'admin') ||
                                     (claseNorm === keyNorm) ||
                                     (mat.clase === areaKey) ||
                                     (docAsignadoNorm && nameNorm && nameNorm.length > 4 && (docAsignadoNorm.includes(nameNorm) || nameNorm.includes(docAsignadoNorm)));

        if (esDocenteAsignadoHum) {
          NIVELES_HUMANISTICA_OFICIALES.forEach(nivHum => {
            asignaciones.humanistica.push({
              tipo: 'humanistica',
              areaKey: mat.clase,
              carrera: mat.area,
              materia: mat.area,
              nivel: nivHum.nivel,
              ciclo: nivHum.ciclo,
              curso: nivHum.curso,
              moduloCodigo: mat.clase,
              moduloNombre: mat.area,
              moduloCompleto: `${mat.area} — ${nivHum.nivel}`,
              docente: docAsignadoMateria || name,
              color: '#8b5cf6'
            });
          });
        }
      });
    }

    return asignaciones;
  }

  // ─── 4. OBTENCIÓN O CREACIÓN DE UN REGISTRO DE EVALUACIÓN ───
  function generarIdRegistro(asig, semestre, gestion, paralelo) {
    const k = asig.areaKey || 'area';
    const n = (asig.nivel || '').replace(/\s+/g, '-');
    const m = (asig.moduloCodigo || asig.moduloNombre || asig.materia || 'mod').replace(/[^a-zA-Z0-9]/g, '');
    const p = (paralelo || 'A').toUpperCase().replace(/[^a-zA-Z0-9]/g, '');
    const g = gestion || _gestionActiva || '2026';
    let sStr = semestre;
    if (!sStr) {
      sStr = (g === '2026') ? 'Segundo Semestre' : (_semestreActivo || 'Primer Semestre');
    }
    const s = (/2/i.test(sStr) || /segundo/i.test(sStr)) ? '2' : '1';
    return `REG-${k}-${n}-${m}-${g}-S${s}-P${p}`.toUpperCase();
  }

  function obtenerOCrearRegistro(asig, semestre = null, gestion = null, paralelo = 'A') {
    const g = gestion || _gestionActiva || '2026';
    let s = semestre;
    if (!s) {
      s = (g === '2026') ? 'Segundo Semestre' : (_semestreActivo || 'Primer Semestre');
    }
    const p = (paralelo || _paraleloActivo || 'A').toUpperCase();
    const id = generarIdRegistro(asig, s, g, p);
    const registros = getRegistros();
    let reg = registros.find(r => r.id === id);

    // Advertencia si ya existe un registro para la misma materia/módulo en la misma gestión, semestre y paralelo
    const duplicado = registros.find(r => 
      r.id !== id && 
      r.areaKey === asig.areaKey && 
      r.nivel === asig.nivel && 
      (r.moduloCodigo === (asig.moduloCodigo || '') || r.modulo === asig.moduloCompleto) && 
      String(r.gestion) === String(g) && 
      r.semestre === s && 
      r.paralelo === p
    );
    if (duplicado) {
      console.warn('Advertencia institucional: Ya existe un registro con id ' + duplicado.id + ' para ' + asig.moduloCompleto + ' en gestión ' + g + ' (' + s + ', Paralelo ' + p + ').');
    }

    if (!reg) {
      reg = {
        id: id,
        tipo: asig.tipo,
        areaKey: asig.areaKey,
        carrera: asig.carrera,
        nivel: asig.nivel,
        modulo: asig.moduloCompleto,
        moduloCodigo: asig.moduloCodigo || '',
        moduloNombre: asig.moduloNombre || asig.materia || '',
        docente: asig.docente,
        semestre: semestre,
        gestion: gestion,
        paralelo: paralelo,
        fecha: new Date().toISOString().split('T')[0],
        estado: 'BORRADOR', // BORRADOR, EN EDICIÓN, FINALIZADO, PUBLICADO, ARCHIVADO
        bloqueado: false, // Control de bloqueo por Dirección
        estadoBloqueo: 'DESBLOQUEADO',
        usuarioBloqueo: '',
        fechaBloqueo: '',
        motivoBloqueo: '',
        criterios: asig.tipo === 'tecnica' ? CRITERIOS_TECNICA_DEFAULT : CRITERIOS_HUMANISTICA_DEFAULT,
        fechaCreacion: new Date().toISOString(),
        fechaModificacion: new Date().toISOString(),
        usuarioModif: asig.docente
      };
      registros.push(reg);
      setRegistros(registros);
      registrarAuditoria(id, 'CREAR', `Creación de registro para ${asig.carrera} - ${asig.nivel} - ${asig.moduloCompleto} (Gestión ${gestion} / ${semestre} / Par. ${paralelo})`);
    }

    // Asegurar compatibilidad si el registro previo no tenía el campo bloqueado
    if (reg.bloqueado === undefined) reg.bloqueado = false;
    if (!reg.estadoBloqueo) reg.estadoBloqueo = reg.bloqueado ? 'BLOQUEADO' : 'DESBLOQUEADO';

    let todosDetalles = getDetalles();
    const idNorm = normalizarCadena(id).replace(/[^a-zA-Z0-9]/g, '');
    const modCodNorm = asig.moduloCodigo ? normalizarCadena(asig.moduloCodigo).replace(/[^a-zA-Z0-9]/g, '') : '';
    
    let detalles = todosDetalles.filter(d => {
      if (!d.idRegistro) return false;
      if (d.idRegistro === id) return true;
      const dRegNorm = normalizarCadena(d.idRegistro).replace(/[^a-zA-Z0-9]/g, '');
      if (dRegNorm === idNorm) return true;
      return false;
    });

    // RECONCILIACIÓN AUTOMÁTICA AFILIACIÓN <-> LLENAR NOTAS:
    // Si este registro no tiene estudiantes aún o si el padrón de Afiliación General tiene más estudiantes asignados,
    // sincronizarlos automáticamente asegurando que Llenar Notas refleje con total fidelidad la nómina de Afiliación.
    if (!reg.nominaVaciadaManual && typeof obtenerEstudiantesParaCurso === 'function') {
      const estsAfiliados = obtenerEstudiantesParaCurso(asig.areaKey, asig.nivel, p);
      if (Array.isArray(estsAfiliados) && estsAfiliados.length > 0) {
        if (detalles.length === 0 && reg.totalEstudiantes !== 0) {
          detalles = estsAfiliados.map((est, idx) => ({
            id: 'DET-' + reg.id + '-' + (idx + 1),
            idRegistro: reg.id,
            nro: idx + 1,
            paterno: est.paterno || '',
            materno: est.materno || '',
            nombres: est.nombres || est.nombreCompleto || '',
            ci: est.ci || '',
            rude: est.rude || '',
            ser: 0,
            saber: 0,
            hacer: 0,
            decidir: 0,
            autoevaluacion: 0,
            numeral: 0,
            cualitativa: '',
            observacion: ''
          }));
          todosDetalles = todosDetalles.concat(detalles);
          setDetalles(todosDetalles);
          reg.totalEstudiantes = detalles.length;
        } else if (estsAfiliados.length > detalles.length) {
          let huboNuevos = false;
          estsAfiliados.forEach(est => {
            const ciEst = est.ci ? String(est.ci).trim() : '';
            const rudeEst = est.rude ? String(est.rude).trim() : '';
            const nomEst = normalizarCadena(est.nombreCompleto || est.nombres || '');

            const yaExiste = detalles.some(d => {
              const dCi = d.ci ? String(d.ci).trim() : '';
              const dRude = d.rude ? String(d.rude).trim() : '';
              const dNom = normalizarCadena((d.paterno ? (d.paterno + ' ' + (d.materno || '') + ' ' + d.nombres) : d.nombres) || '');
              return (ciEst && dCi && ciEst === dCi) ||
                     (rudeEst && dRude && rudeEst === dRude) ||
                     (nomEst && dNom && (nomEst === dNom || nomEst.includes(dNom) || dNom.includes(nomEst)));
            });

            if (!yaExiste) {
              const nuevoIdx = detalles.length + 1;
              const nuevoDetalle = {
                id: 'DET-' + reg.id + '-' + nuevoIdx,
                idRegistro: reg.id,
                nro: nuevoIdx,
                paterno: est.paterno || '',
                materno: est.materno || '',
                nombres: est.nombres || est.nombreCompleto || '',
                ci: est.ci || '',
                rude: est.rude || '',
                ser: 0,
                saber: 0,
                hacer: 0,
                decidir: 0,
                autoevaluacion: 0,
                numeral: 0,
                cualitativa: '',
                observacion: ''
              };
              detalles.push(nuevoDetalle);
              todosDetalles.push(nuevoDetalle);
              huboNuevos = true;
            }
          });

          if (huboNuevos) {
            detalles.forEach((d, idx) => { d.nro = idx + 1; });
            setDetalles(todosDetalles);
            reg.totalEstudiantes = detalles.length;
          }
        }
      }
    }

    // FUSIÓN INTELIGENTE: Si en Google Sheets (todosDetalles) se cargaron notas manualmente
    // buscar coincidencia por CI, RUDE o Nombre para este módulo/curso y reflejar las notas reales
    if (Array.isArray(detalles) && detalles.length > 0 && Array.isArray(todosDetalles)) {
      detalles.forEach(d => {
        const ciNorm = d.ci ? String(d.ci).replace(/[^\d]/g, '') : '';
        const patNorm = normalizarCadena(d.paterno || '');
        const nomNorm = normalizarCadena(d.nombres || d.nombreCompleto || '');

        // Buscar coincidencia en todosDetalles que provenga de Google Sheets
        const matchRemoto = todosDetalles.find(r => {
          if (r === d) return false;
          const rCiNorm = r.ci ? String(r.ci).replace(/[^\d]/g, '') : '';
          const rPatNorm = normalizarCadena(r.paterno || '');
          const rNomNorm = normalizarCadena(r.nombres || '');
          const coincideEstudiante = (ciNorm && rCiNorm && ciNorm === rCiNorm) ||
                                     (d.rude && r.rude && String(d.rude).trim() === String(r.rude).trim()) ||
                                     (patNorm && nomNorm && rPatNorm === patNorm && rNomNorm === nomNorm);
          if (!coincideEstudiante) return false;

          // Si coincide el estudiante, verificar si es de este módulo o tiene notas ingresadas
          if (r.idRegistro) {
            const rRegNorm = normalizarCadena(r.idRegistro).replace(/[^a-zA-Z0-9]/g, '');
            if (rRegNorm === idNorm || (modCodNorm && rRegNorm === modCodNorm)) return true;
          }
          const tieneNotas = (Number(r.notaFinal) > 0 || Number(r.ser) > 0 || Number(r.saber) > 0 || Number(r.hacer) > 0 || Number(r.decidir) > 0);
          return tieneNotas;
        });

        if (matchRemoto) {
          function parseVal(v) { return (v !== '' && v !== null && v !== undefined && !isNaN(Number(v))) ? Number(v) : null; }
          const vSer = parseVal(matchRemoto.ser);
          const vSab = parseVal(matchRemoto.saber);
          const vHac = parseVal(matchRemoto.hacer);
          const vDec = parseVal(matchRemoto.decidir);
          const vAuto = parseVal(matchRemoto.autoevaluacion);
          const vProc = parseVal(matchRemoto.proceso);
          const vProd = parseVal(matchRemoto.producto);
          const vFinal = parseVal(matchRemoto.notaFinal);

          if (vSer !== null) d.ser = vSer;
          if (vSab !== null) d.saber = vSab;
          if (vHac !== null) d.hacer = vHac;
          if (vDec !== null) d.decidir = vDec;
          if (vAuto !== null) d.autoevaluacion = vAuto;
          if (vProc !== null) d.proceso = vProc;
          if (vProd !== null) d.producto = vProd;

          if (vFinal !== null) {
            d.notaFinal = vFinal;
            d.numeral = vFinal;
          } else {
            // Calcular nota final según dimensiones
            const totalCalc = (Number(d.ser) || 0) + (Number(d.saber) || 0) + (Number(d.hacer) || 0) + (Number(d.decidir) || 0) + (Number(d.autoevaluacion) || 0);
            if (totalCalc > 0) {
              d.notaFinal = totalCalc;
              d.numeral = totalCalc;
            }
          }
          if (matchRemoto.observacion) {
            d.observacion = matchRemoto.observacion === 'APROBADO' ? 'PROMOVIDO' :
                            matchRemoto.observacion === 'REPROBADO' ? 'POSTERGADO' : matchRemoto.observacion;
          }
          else if (Number(d.notaFinal) >= 51) d.observacion = 'PROMOVIDO';
          else if (Number(d.notaFinal) > 0) d.observacion = 'POSTERGADO';
        }
      });
    }

    _registroActivo = reg;
    _detallesActivos = detalles;
    window._registroActivo = reg;
    window._detallesActivos = detalles;
    return { registro: reg, detalles: detalles };
  }

  function cargarEstudiantesDesdeInscripciones(asig, reg) {
    if (typeof obtenerEstudiantesParaCurso === 'function') {
      const afiliados = obtenerEstudiantesParaCurso(asig.areaKey || asig.carrera, asig.nivel, reg.paralelo || 'A');
      if (Array.isArray(afiliados) && afiliados.length > 0) {
        return afiliados.map((item, idx) => ({
          id: 'DET-' + reg.id + '-' + (idx + 1),
          idRegistro: reg.id,
          nro: idx + 1,
          paterno: (item.paterno || '').toUpperCase(),
          materno: (item.materno || '').toUpperCase(),
          nombres: (item.nombres || '').toUpperCase(),
          ci: String(item.ci || '').trim(),
          rude: String(item.rude || item.codigoRude || '').trim(),
          ser: '',
          saber: '',
          decidir: '',
          proceso: '',
          producto: '',
          hacer: '',
          autoevaluacion: '',
          notaFinal: 0,
          observacion: 'PENDIENTE'
        }));
      }
    }
    return [];
  }

  // ─── 5. CÁLCULOS Y ESTADÍSTICAS OFICIALES ───
  function calcularFilaEvaluacion(fila, tipo = 'tecnica') {
    let final = 0;
    const num = (v) => {
      const parsed = parseFloat(v);
      return isNaN(parsed) ? 0 : parsed;
    };

    if (tipo === 'tecnica') {
      const ser = Math.min(10, Math.max(0, num(fila.ser)));
      const saber = Math.min(30, Math.max(0, num(fila.saber)));
      const decidir = Math.min(10, Math.max(0, num(fila.decidir)));
      const proceso = Math.min(20, Math.max(0, num(fila.proceso)));
      const producto = Math.min(20, Math.max(0, num(fila.producto)));
      const autoeval = Math.min(10, Math.max(0, num(fila.autoevaluacion)));
      final = Math.round(ser + saber + decidir + proceso + producto + autoeval);
    } else {
      const ser = Math.min(10, Math.max(0, num(fila.ser)));
      const saber = Math.min(35, Math.max(0, num(fila.saber)));
      const hacer = Math.min(35, Math.max(0, num(fila.hacer || fila.proceso)));
      const decidir = Math.min(10, Math.max(0, num(fila.decidir)));
      const autoeval = Math.min(10, Math.max(0, num(fila.autoevaluacion)));
      final = Math.round(ser + saber + hacer + decidir + autoeval);
    }

    fila.notaFinal = final;

    const tieneAlgunaNota = [fila.ser, fila.saber, fila.decidir, fila.proceso, fila.producto, fila.hacer, fila.autoevaluacion].some(v => v !== '' && v !== null && v !== undefined);
    if (!tieneAlgunaNota) {
      fila.observacion = 'PENDIENTE';
    } else if (fila.observacion === 'RETIRADO' || fila.observacion === 'ABANDONO') {
      // Mantener si fue marcado explícitamente
    } else if (final >= 51) {
      fila.observacion = 'PROMOVIDO';
    } else {
      fila.observacion = 'POSTERGADO';
    }

    return fila;
  }

  function calcularEstadisticasPlanilla(detalles) {
    const totalInscritos = detalles.length;
    let evaluados = 0;
    let aprobados = 0;
    let reprobados = 0;
    let pendientes = 0;
    let sumaNotas = 0;

    detalles.forEach(d => {
      const tieneNota = [d.ser, d.saber, d.decidir, d.proceso, d.producto, d.hacer, d.autoevaluacion]
        .some(v => v !== '' && v !== null && v !== undefined && !isNaN(parseFloat(v)));

      if (tieneNota || (d.observacion && d.observacion !== 'PENDIENTE' && d.observacion !== 'NO EVALUADO')) {
        evaluados++;
        const nota = d.notaFinal || 0;
        sumaNotas += nota;
        if (nota >= 51) aprobados++;
        else reprobados++;
      } else {
        pendientes++;
      }
    });

    const pctAprobacion = evaluados > 0 ? ((aprobados / evaluados) * 100).toFixed(1) + '%' : '0.0%';
    const pctReprobacion = evaluados > 0 ? ((reprobados / evaluados) * 100).toFixed(1) + '%' : '0.0%';
    const promedio = evaluados > 0 ? (sumaNotas / evaluados).toFixed(1) : '0.0';

    return {
      totalInscritos,
      evaluados,
      aprobados,
      reprobados,
      pendientes,
      pctAprobacion,
      pctReprobacion,
      promedio
    };
  }

  // ─── 6. INTERFAZ SIMPLIFICADA DEL MODO DOCENTE (CURSOS DIRECTOS) ───
  function renderDocenteCalificaciones(areaKey) {
    if (areaKey) window._docAreaKeyActiva = areaKey;
    const container = document.getElementById('docente-calificaciones-slot');
    if (!container) return;

    document.body.classList.remove('admin-logged-in', 'public-view-active');
    document.body.classList.add('docente-logged-in', 'docente-panel-active');

    const docInfo = obtenerDocenteLogueado() || { areaKey: areaKey, name: 'Docente', role: 'docente' };
    const asignaciones = obtenerAsignacionesDocente(docInfo);

    const aKey = (docInfo.areaKey || areaKey || '').toLowerCase();
    const esHum = aKey.startsWith('hum') || aKey.includes('social') || aKey.includes('natural') || aKey.includes('matematica') || aKey.includes('lenguaje');
    let tabActiva = esHum ? 'humanistica' : 'tecnica';
    window._docTabActiva = tabActiva;

    const gestiones = getGestionesDisponibles();
    if (!gestiones.includes(_gestionActiva)) _gestionActiva = gestiones[0] || '2026';

    const nombreEspecialidad = tabActiva === 'tecnica'
      ? (asignaciones.tecnica[0]?.carrera || 'Carrera Técnica')
      : (asignaciones.humanistica[0]?.carrera || 'Educación Humanística');

    window._docAsignaciones = asignaciones;

    if (!window._docenteSidebarTab) {
      window._docenteSidebarTab = 'subir_notas';
    }

    container.innerHTML = `
      <!-- ENTORNO DE ESCRITORIO CON BARRA LATERAL IZQUIERDA -->
      <div class="docente-desktop-layout">
        <!-- BARRA LATERAL IZQUIERDA -->
        <aside class="docente-sidebar-nav">
          <div class="docente-sidebar-header">
            <div style="display:flex;align-items:center;gap:8px">
              <img src="logo.png" alt="CEA" style="width:26px;height:auto" onerror="this.style.display='none'">
              <div>
                <strong style="color:#ffffff;font-size:0.80rem;display:block;line-height:1.2">CEA MADRE MARIE POUSSEPIN</strong>
                <span style="font-size:0.68rem;color:#86efac;font-weight:700">PANEL ACADÉMICO 2026</span>
              </div>
            </div>
          </div>

          <!-- GRUPO 1: INICIO -->
          <div class="docente-sidebar-group-title">INICIO</div>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'inicio' ? 'active' : ''}" data-tab="inicio" onclick="window.conmutarVistaDocenteSidebar('inicio')">
            ${getSvgIcon('HOME')}
            <span>Inicio Docente</span>
          </button>

          <!-- GRUPO 2: MIS CLASES Y CALIFICACIONES -->
          <div class="docente-sidebar-group-title">MIS CLASES Y CALIFICACIONES</div>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'subir_notas' ? 'active' : ''}" data-tab="subir_notas" onclick="window.conmutarVistaDocenteSidebar('subir_notas')">
            ${getSvgIcon('EDIT')}
            <span>Llenar Notas / Registro</span>
          </button>
          <div id="docente-subir-notas-submenu" style="display:${window._docenteSidebarTab === 'subir_notas' ? 'block' : 'none'};padding-left:24px;margin-top:4px;margin-bottom:8px">
            ${((String(docInfo.areaKey || '').startsWith('hum')) ? NIVELES_HUMANISTICA_OFICIALES.map(n => n.nivel) : ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio I', 'Técnico Medio II']).map(niv => `
            <button type="button" class="docente-subitem-btn" onclick="window.seleccionarNivelDesdeSubmenu('${escapeHTML(niv)}')" style="width:100%;text-align:left;background:none;border:none;color:#cbd5e1;padding:6px 12px;font-size:0.80rem;font-weight:700;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:6px">
              <span>&bull; ${escapeHTML(niv)}</span>
            </button>`).join('')}
          </div>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'centralizador' || window._docenteSidebarTab === 'centralizador_digital' ? 'active' : ''}" data-tab="centralizador" onclick="window.conmutarVistaDocenteSidebar('centralizador')">
            ${getSvgIcon('EYE')}
            <span>Boletín Centralizador</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'impresion_masiva' ? 'active' : ''}" data-tab="impresion_masiva" onclick="window.conmutarVistaDocenteSidebar('impresion_masiva')">
            ${getSvgIcon('PRINT')}
            <span>Imprimir Todos los Boletines</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'crear_paralelo' ? 'active' : ''}" data-tab="crear_paralelo" onclick="window.conmutarVistaDocenteSidebar('crear_paralelo')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>Crear Paralelo</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'afiliacion' ? 'active' : ''}" data-tab="afiliacion" onclick="window.conmutarVistaDocenteSidebar('afiliacion')">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
            <span>Afiliación / Estudiantes</span>
          </button>

          <!-- GRUPO 3: MI INFORMACIÓN Y SEGURIDAD -->
          <div class="docente-sidebar-group-title">MI INFORMACIÓN Y SEGURIDAD</div>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'perfil' ? 'active' : ''}" data-tab="perfil" onclick="window.conmutarVistaDocenteSidebar('perfil')">
            ${getSvgIcon('USER')}
            <span>Perfil de la Especialidad</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'fotografia' ? 'active' : ''}" data-tab="fotografia" onclick="window.conmutarVistaDocenteSidebar('fotografia')">
            ${getSvgIcon('CAMERA')}
            <span>Fotografía de la Especialidad</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'seguridad' ? 'active' : ''}" data-tab="seguridad" onclick="window.conmutarVistaDocenteSidebar('seguridad')">
            ${getSvgIcon('LOCK')}
            <span>Usuario y Contraseña / Seguridad</span>
          </button>

          <!-- GRUPO 4: DOCUMENTACIÓN ACADÉMICA -->
          <div class="docente-sidebar-group-title">DOCUMENTACIÓN ACADÉMICA</div>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'kardex' ? 'active' : ''}" data-tab="kardex" onclick="window.conmutarVistaDocenteSidebar('kardex')">
            ${getSvgIcon('DOC')}
            <span>Mi Kárdex</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'malla' ? 'active' : ''}" data-tab="malla" onclick="window.conmutarVistaDocenteSidebar('malla')">
            ${getSvgIcon('BOOK')}
            <span>Malla Curricular Oficial</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'documentos' ? 'active' : ''}" data-tab="documentos" onclick="window.conmutarVistaDocenteSidebar('documentos')">
            ${getSvgIcon('FOLDER')}
            <span>Documentos por Niveles</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'horarios' ? 'active' : ''}" data-tab="horarios" onclick="window.conmutarVistaDocenteSidebar('horarios')">
            ${getSvgIcon('CLOCK')}
            <span>Gestión de Horarios</span>
          </button>

          <button type="button" class="docente-sidebar-item ${window._docenteSidebarTab === 'avisos' ? 'active' : ''}" data-tab="avisos" onclick="window.conmutarVistaDocenteSidebar('avisos')">
            ${getSvgIcon('BELL')}
            <span>Publicación de Actividades</span>
          </button>

          <div style="margin-top:auto;padding:14px;border-top:1.5px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.25)">
            <button type="button" class="btn-calif" style="width:100%;padding:10px 14px;font-size:0.86rem;font-weight:700;color:#ffffff;background:#dc2626;border:none;border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;box-shadow:0 2px 6px rgba(220,38,38,0.4)" onclick="if(typeof adminLogout==='function') { adminLogout(); } else { location.reload(); }">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Salir / Cerrar Sesión</span>
            </button>
          </div>
        </aside>

        <!-- ESCENARIO PRINCIPAL -->
        <main class="docente-main-stage" id="docente-main-stage">
          <!-- CABECERA INSTITUCIONAL SUPERIOR -->
          <div style="background:#ffffff;border:1px solid var(--border-col);border-radius:10px;padding:12px 18px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;box-shadow:0 2px 6px rgba(0,0,0,0.04)">
            <div style="display:flex;align-items:center;gap:12px">
              <button type="button" class="sidebar-toggle-btn docente-sidebar-toggle-btn" onclick="window.toggleAcademicSidebarMobile()" title="Menú de opciones docentes" style="background:#f1f5f9;color:#0f172a;border:1.5px solid #cbd5e1;border-radius:8px;padding:7px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              </button>
              <div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="background:var(--verde);color:#fff;font-size:0.75rem;font-weight:800;padding:3px 8px;border-radius:4px;text-transform:uppercase">
                    ${tabActiva === 'tecnica' ? 'TÉCNICA PRODUCTIVA' : 'HUMANÍSTICA'}
                  </span>
                  <h3 style="margin:0;color:var(--verde-dark);font-size:1.15rem">
                    ${escapeHTML(nombreEspecialidad)}
                  </h3>
                </div>
                <p style="margin:3px 0 0 0;font-size:0.83rem;color:var(--text-sec)">
                  Docente: <strong>${escapeHTML(docInfo.name)}</strong> • Estado Académico: <strong style="color:var(--verde)">Activo</strong>
                </p>
              </div>
            </div>

            <!-- SELECTORES DE GESTIÓN Y SEMESTRE Y ACCIONES -->
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:6px">
                <label style="font-size:0.80rem;font-weight:700;color:var(--text-sec)">GESTIÓN:</label>
                <select class="calif-filter-select" style="width:auto;padding:5px 10px;font-weight:700" onchange="window.cambiarGestionDocente(this.value)">
                  ${gestiones.map(g => `<option value="${g}" ${g === _gestionActiva ? 'selected' : ''}>Gestión ${g}</option>`).join('')}
                </select>
              </div>

              <div style="display:flex;align-items:center;gap:6px">
                <label style="font-size:0.80rem;font-weight:700;color:var(--text-sec)">SEMESTRE:</label>
                <select class="calif-filter-select" style="width:auto;padding:5px 10px;font-weight:700" onchange="window.cambiarSemestreDocente(this.value)">
                  <option value="Segundo Semestre" ${_semestreActivo === 'Segundo Semestre' ? 'selected' : ''}>Segundo Semestre</option>
                  <option value="Primer Semestre" ${_semestreActivo === 'Primer Semestre' ? 'selected' : ''}>Primer Semestre</option>
                </select>
              </div>

              <button type="button" class="btn-calif btn-calif-secondary" style="padding:6px 12px;font-size:0.78rem" onclick="if(typeof abrirModalSeguridadDocente==='function') abrirModalSeguridadDocente(); else if(typeof window.abrirModalSeguridadDocente==='function') window.abrirModalSeguridadDocente();">
                ${SVG_ICONS.LOCK}
                <span>Seguridad</span>
              </button>
              <button type="button" class="btn-calif btn-calif-secondary" style="padding:6px 12px;font-size:0.78rem;color:#dc2626" onclick="if(typeof adminLogout==='function') adminLogout();">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                <span>Salir</span>
              </button>
            </div>
          </div>

          <!-- CONTENIDO DINÁMICO DE LA VISTA DEL SIDEBAR -->
          <div id="docente-stage-content"></div>
        </main>
      </div>
    `;

    renderContenidoDocenteStage(window._docenteSidebarTab);
  }

  function conmutarVistaDocenteSidebar(tabName) {
    if (tabName === 'inicio') tabName = 'subir_notas';
    if (tabName === 'afiliacion') {
      _afiliacionNivelSeleccionado = null;
    }
    if (tabName === 'subir_notas') {
      _moduloActivoDocente = null;
    }
    window._docenteSidebarTab = tabName;
    const subMenu = document.getElementById('docente-subir-notas-submenu');
    if (subMenu) {
      subMenu.style.display = (tabName === 'subir_notas') ? 'block' : 'none';
    }
    document.querySelectorAll('.docente-sidebar-item').forEach(btn => {
      const bTab = btn.getAttribute('data-tab');
      btn.classList.toggle('active', bTab === tabName || (tabName === 'subir_notas' && bTab === 'inicio'));
    });
    if (typeof window !== 'undefined' && window.innerWidth <= 900 && typeof toggleAcademicSidebarMobile === 'function') {
      toggleAcademicSidebarMobile(true);
    }
    renderContenidoDocenteStage(tabName);
  }

  window.renderContenidoDocenteStage = renderContenidoDocenteStage;
  