/* ==========================================================================
   MÓDULO EXCLUSIVO Y AISLADO DE IMPRESIÓN DE PRE-INSCRIPCIONES
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN 2026
   Bordes: 2 cm (20 mm) exactos a izquierda y derecha
   ========================================================================== */

(function () {
  'use strict';

  function aplicarOrientacionPreinscripciones(soloEstadisticas = false) {
    let styleTag = document.getElementById('cea-dynamic-page-orientation');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cea-dynamic-page-orientation';
      document.head.appendChild(styleTag);
    }
    if (soloEstadisticas) {
      styleTag.innerHTML = `
        @page {
          size: letter portrait !important;
          margin: 8mm 14mm 8mm 14mm !important;
        }
      `;
    } else {
      // Hoja 1: margen superior normal (6mm). A partir de la hoja 2: 1.5 cm (15mm). Laterales: 2 cm (20mm). Inferior: 1 cm (10mm) en todas las hojas
      styleTag.innerHTML = `
        @page {
          size: letter portrait !important;
          margin: 15mm 20mm 10mm 20mm !important;
        }
        @page :first {
          margin-top: 6mm !important;
          margin-bottom: 10mm !important;
        }
      `;
    }
    document.body.classList.add('print-orientation-portrait');
    document.body.classList.remove('print-orientation-landscape', 'print-turno-hum', 'print-turno-tec');
  }

  function detectarAreaActiva() {
    const dashModal = document.getElementById('modalDashboardInscripciones');
    if (dashModal && dashModal.style.display !== 'none') {
      return window.filtroDashboardActivo || 'todas';
    }
    const estado = window.estadoFiltroInscripciones || 'todas';
    if (estado === 'tecnica') return 'tecnica';
    if (estado === 'humanistica' || estado === 'primaria' || estado === 'secundaria') return 'humanistica';
    return 'todas';
  }

  function getNombreArea(area) {
    if (area === 'tecnica') return 'Solo Área Técnica (6 Carreras)';
    if (area === 'humanistica') return 'Solo Área Humanística (EPJA y BTH)';
    return 'Vista Global (Toda la Institución)';
  }

  function abrirModalOpcionesImpresion() {
    const area = detectarAreaActiva();
    window.areaImpresionReporte = area;

    const badge = document.getElementById('print-modal-area-detectada-badge');
    if (badge) {
      badge.textContent = getNombreArea(area);
    }

    const modal = document.getElementById('modalOpcionesImpresionReporte') || document.getElementById('modal-opciones-impresion-reporte');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('active');
    }
  }

  function cerrarModalOpcionesImpresion() {
    const modal = document.getElementById('modalOpcionesImpresionReporte') || document.getElementById('modal-opciones-impresion-reporte');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('active');
    }
  }

  function seleccionarOpcionImpresionDirecta(tipo) {
    const radioNom = document.getElementById('opt-rep-nominal');
    const radioEst = document.getElementById('opt-rep-estadisticas');
    if (tipo === 'nominal') {
      if (radioNom) radioNom.checked = true;
    } else {
      if (radioEst) radioEst.checked = true;
    }
    actualizarEstiloTipoReporte();
  }

  function seleccionarAreaImpresion(area) {
    window.areaImpresionReporte = area;
    ['todas', 'tecnica', 'humanistica'].forEach(a => {
      const btn = document.getElementById('btn-print-area-' + a);
      if (btn) {
        if (a === area) {
          btn.style.borderColor = 'var(--verde, #16a34a)';
          btn.style.background = 'var(--verde-light, #dcfce7)';
          btn.style.color = 'var(--verde-dark, #166534)';
        } else {
          btn.style.borderColor = 'var(--border-col, #e2e8f0)';
          btn.style.background = 'var(--bg-body, #f8fafc)';
          btn.style.color = 'var(--text-main, #0f172a)';
        }
      }
    });
  }

  function actualizarEstiloTipoReporte() {
    const radioNom = document.getElementById('opt-rep-nominal');
    const lblNom = document.getElementById('lbl-opt-rep-nominal');
    const lblEst = document.getElementById('lbl-opt-rep-estadisticas');
    if (!lblNom || !lblEst) return;
    if (radioNom && radioNom.checked) {
      lblNom.style.background = 'var(--verde-light, #dcfce7)';
      lblNom.style.borderColor = 'var(--verde, #16a34a)';
      const stNom = lblNom.querySelector('strong');
      if (stNom) stNom.style.color = 'var(--verde-dark, #166534)';
      lblEst.style.background = 'var(--bg-card, #ffffff)';
      lblEst.style.borderColor = 'var(--border-col, #e2e8f0)';
      const stEst = lblEst.querySelector('strong');
      if (stEst) stEst.style.color = 'var(--text-main, #0f172a)';
    } else {
      lblEst.style.background = 'var(--verde-light, #dcfce7)';
      lblEst.style.borderColor = 'var(--verde, #16a34a)';
      const stEst = lblEst.querySelector('strong');
      if (stEst) stEst.style.color = 'var(--verde-dark, #166534)';
      lblNom.style.background = 'var(--bg-card, #ffffff)';
      lblNom.style.borderColor = 'var(--border-col, #e2e8f0)';
      const stNom = lblNom.querySelector('strong');
      if (stNom) stNom.style.color = 'var(--text-main, #0f172a)';
    }
  }

  function imprimirOpcion1Completo() {
    const area = window.areaImpresionReporte || detectarAreaActiva();
    cerrarModalOpcionesImpresion();
    if (typeof window.cerrarDashboardVisualInscripciones === 'function') {
      window.cerrarDashboardVisualInscripciones();
    }
    if (typeof window.ejecutarImpresionReporteOrganizado === 'function') {
      window.ejecutarImpresionReporteOrganizado(area, true, false);
    }
  }

  function imprimirOpcion2UnaHoja() {
    const area = window.areaImpresionReporte || detectarAreaActiva();
    cerrarModalOpcionesImpresion();
    if (typeof window.cerrarDashboardVisualInscripciones === 'function') {
      window.cerrarDashboardVisualInscripciones();
    }
    if (typeof window.imprimirReporteEstadisticoUnaHoja === 'function') {
      window.imprimirReporteEstadisticoUnaHoja(area, true);
    } else if (typeof window.ejecutarImpresionReporteOrganizado === 'function') {
      window.ejecutarImpresionReporteOrganizado(area, true, true);
    }
  }

  function confirmarImpresionDesdeModal() {
    const radioEst = document.getElementById('opt-rep-estadisticas');
    const soloEstadisticas = radioEst ? radioEst.checked : false;
    if (soloEstadisticas) {
      imprimirOpcion2UnaHoja();
    } else {
      imprimirOpcion1Completo();
    }
  }

  function imprimirInscripciones() {
    abrirModalOpcionesImpresion();
  }

  function imprimirDesdeDashboard() {
    abrirModalOpcionesImpresion();
  }

  function imprimirDashboardInscripciones() {
    abrirModalOpcionesImpresion();
  }

  function imprimirSoloEstadisticasDashboard() {
    imprimirOpcion2UnaHoja();
  }

  function imprimirNominaCompletaDashboard() {
    imprimirOpcion1Completo();
  }

  // Exportar al ámbito global
  window.aplicarOrientacionPreinscripciones = aplicarOrientacionPreinscripciones;
  window.abrirModalOpcionesImpresion = abrirModalOpcionesImpresion;
  window.cerrarModalOpcionesImpresion = cerrarModalOpcionesImpresion;
  window.seleccionarAreaImpresion = seleccionarAreaImpresion;
  window.seleccionarOpcionImpresionDirecta = seleccionarOpcionImpresionDirecta;
  window.actualizarEstiloTipoReporte = actualizarEstiloTipoReporte;
  window.confirmarImpresionDesdeModal = confirmarImpresionDesdeModal;
  window.imprimirOpcion1Completo = imprimirOpcion1Completo;
  window.imprimirOpcion2UnaHoja = imprimirOpcion2UnaHoja;
  window.imprimirInscripciones = imprimirInscripciones;
  window.imprimirDesdeDashboard = imprimirDesdeDashboard;
  window.imprimirDashboardInscripciones = imprimirDashboardInscripciones;
  window.imprimirSoloEstadisticasDashboard = imprimirSoloEstadisticasDashboard;
  window.imprimirNominaCompletaDashboard = imprimirNominaCompletaDashboard;
})();
