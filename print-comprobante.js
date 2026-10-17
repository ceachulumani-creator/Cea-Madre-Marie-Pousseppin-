/* ==========================================================================
   MÓDULO EXCLUSIVO Y AISLADO DE IMPRESIÓN DE COMPROBANTE DE INSCRIPCIÓN
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN 2026
   ========================================================================== */

(function () {
  'use strict';

  function aplicarOrientacionComprobante() {
    let styleTag = document.getElementById('cea-dynamic-page-orientation');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cea-dynamic-page-orientation';
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `@page { size: letter portrait !important; margin: 8mm 10mm !important; }`;
    document.body.classList.add('print-orientation-portrait');
    document.body.classList.remove('print-orientation-landscape');
  }

  function imprimirComprobante(dataOverride) {
    aplicarOrientacionComprobante();
    document.body.classList.add('printing-comprobante');
    document.body.classList.remove('printing-kardex', 'printing-horario', 'printing-reporte');

    const data = dataOverride || window._ultimoRegistroInscripcion;
    if (!data) {
      if (typeof mostrarAlertaModal === 'function') {
        mostrarAlertaModal('No hay un registro de pre-inscripción seleccionado para descargar la ficha.', 'Descarga de Comprobante', 'warning');
      } else {
        alert('No hay un registro de pre-inscripción seleccionado para descargar la ficha.');
      }
      return;
    }

    const codigoReg = 'CEA-2026-' + Math.floor(100000 + Math.random() * 900000);
    const fechaHoy = new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    
    let directorNom = 'Lic. José Luis Alanoca Mamani';
    try {
      const stored = localStorage.getItem('cea_textos_director');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.director_nombre) directorNom = parsed.director_nombre;
      }
    } catch (e) {}

    let printArea = document.getElementById('comprobante-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'comprobante-print-area';
      document.body.appendChild(printArea);
    }

    printArea.innerHTML = `
      <div class="comprobante-ficha-letter" style="font-family:'Inter', Arial, sans-serif; max-width:720px; margin:0 auto; padding:18px 24px; border:2px solid #1a6b2e; border-radius:10px; color:#0f172a; background:#ffffff; box-sizing:border-box;">
        <!-- Encabezado Institucional Oficial -->
        <div style="text-align:center; border-bottom:2px solid #1a6b2e; padding-bottom:10px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <img src="logo cea madre marie poussepin.png" alt="Logo CEA" style="width:65px; height:auto;" />
            <div style="flex:1; padding:0 12px;">
              <div style="font-size:0.75rem; font-weight:800; letter-spacing:1px; color:#1e293b; text-transform:uppercase;">Estado Plurinacional de Bolivia • Ministerio de Educación</div>
              <div style="font-size:0.70rem; font-weight:700; color:#475569;">Viceministerio de Educación Alternativa y Especial • DDE La Paz</div>
              <h2 style="margin:3px 0 2px; font-size:1.20rem; font-weight:900; color:#15803d; letter-spacing:0.5px;">CEA MADRE MARIE POUSSEPÍN</h2>
              <div style="font-size:0.72rem; color:#64748b;">R.A. 176/2013 • Código SIE: 80630044 • Chulumani, Sud Yungas, Bolivia</div>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block; padding:4px 10px; background:#dcfce7; border:1.5px solid #16a34a; border-radius:6px; font-weight:900; font-size:0.80rem; color:#166534;">GESTIÓN ${data.gestion || '2026'}</span>
              <div style="margin-top:4px; font-size:0.68rem; color:#64748b;">FOLIO N°: <strong style="color:#0f172a;">${codigoReg}</strong></div>
            </div>
          </div>
        </div>

        <div style="text-align:center; margin-bottom:12px;">
          <h3 style="margin:0; font-size:1.02rem; font-weight:900; text-transform:uppercase; letter-spacing:1px; color:#0f172a; text-decoration:underline;">FORMULARIO OFICIAL DE PRE-INSCRIPCIÓN Y MATRICULACIÓN</h3>
          <p style="margin:3px 0 0 0; font-size:0.75rem; color:#64748b;">Fecha y hora de emisión: ${fechaHoy}</p>
        </div>

        <!-- TABLA 1: DATOS PERSONALES -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:0.82rem; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9;"><th colspan="2" style="padding:5px 10px; text-align:left; font-size:0.78rem; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1;">1. DATOS PERSONALES DEL PARTICIPANTE</th></tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; width:35%; background:#f8fafc;">Apellidos y Nombres:</td><td style="padding:6px 10px; font-weight:800; color:#0f172a;">${data.nombre}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; background:#f8fafc;">Cédula de Identidad (CI):</td><td style="padding:6px 10px; font-weight:800;">${data.ci}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; background:#f8fafc;">Fecha de Nacimiento / Edad:</td><td style="padding:6px 10px;">${data.fechaNacimiento || 'No especificada'} ${data.edad ? `(<strong>${data.edad} años cumplidos</strong>)` : ''}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; background:#f8fafc;">Número de Teléfono / WhatsApp:</td><td style="padding:6px 10px;">${data.telefono}</td></tr>
          </tbody>
        </table>

        <!-- TABLA 2: ASIGNACIÓN ACADÉMICA -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:12px; font-size:0.82rem; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9;"><th colspan="2" style="padding:5px 10px; text-align:left; font-size:0.78rem; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1;">2. ASIGNACIÓN ACADÉMICA Y CARRERA</th></tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; width:35%; background:#f8fafc;">Área de Formación:</td><td style="padding:6px 10px; font-weight:800; color:#15803d;">${data.area === 'tecnica' ? 'EDUCACIÓN TÉCNICA TECNOLÓGICA (ETTP / ETA)' : 'EDUCACIÓN DE PERSONAS JÓVENES Y ADULTAS (EPJA - Humanística)'}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; background:#f8fafc;">Especialidad / Carrera Solicitada:</td><td style="padding:6px 10px; font-weight:800; color:#0f172a;">${data.carrera}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; background:#f8fafc;">Semestre Asignado:</td><td style="padding:6px 10px; font-weight:800; color:#15803d;">${data.semestre || '1er Semestre'} — Gestión ${data.gestion || '2026'}</td></tr>
            ${(data.esCasoExcepcional || data.casoExcepcional) ? `
            <tr style="border-bottom:1px solid #e2e8f0;background:#fffbeb;">
              <td style="padding:6px 10px; font-weight:700; color:#92400e; background:#fef3c7;">Modalidad de Matrícula:</td>
              <td style="padding:6px 10px; font-weight:800; color:#b45309;">
                PRE-INSCRIPCIÓN CONDICIONAL POR CASO EXCEPCIONAL (LEY 070)<br>
                <span style="font-size:0.75rem; font-weight:600; color:#92400e;">Causal declarada: ${data.casoExcepcional || 'Caso Excepcional'}${data.detalleExcepcion ? ` (${data.detalleExcepcion})` : ''}</span>
              </td>
            </tr>` : ''}
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px 10px; font-weight:700; background:#f8fafc;">Observaciones / Turno:</td><td style="padding:6px 10px; font-size:0.78rem; color:#475569;">${data.observaciones || 'Sin observaciones registradas.'}</td></tr>
          </tbody>
        </table>

        ${data.avisoVigencia ? `
        <!-- CONDICIÓN DE MATRÍCULA -->
        <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:6px; padding:7px 12px; margin-bottom:12px; font-size:0.74rem; color:#92400e; line-height:1.4;">
          <strong>Condición de Matrícula:</strong> ${data.avisoVigencia}
        </div>` : ''}

        <!-- REQUISITOS Y QR DIGITAL EN 2 COLUMNAS -->
        <div style="display:grid; grid-template-columns:1fr 95px; gap:12px; margin-bottom:16px; align-items:center;">
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:8px 12px; font-size:0.73rem; line-height:1.4; color:#334155;">
            <strong style="color:#0f172a; display:block; margin-bottom:3px; text-transform:uppercase; font-size:0.74rem;">Requisitos para ratificación de matrícula en Secretaría:</strong>
            1. Dos (2) fotocopias simples de Cédula de Identidad vigente (cotejada con original).<br>
            2. Fotocopia de Libreta o Certificado de Calificaciones del último nivel aprobado.<br>
            3. Para el Área Técnica: Certificado del nivel anterior (Básico/Auxiliar) si corresponde.<br>
            ${(data.esCasoExcepcional || data.casoExcepcional) ? `4. Documento o certificado físico de respaldo de la causal de excepción legal (postulantes menores de edad).<br>5. ` : '4. '}Presentar esta ficha oficial impresa o digital al momento de la entrega de carpetas.
          </div>
          <div style="text-align:center;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=${encodeURIComponent('https://ceamadremariepoussepin.github.io/?ci=' + data.ci + '&reg=' + codigoReg)}" alt="QR Verificación" style="width:78px; height:78px; border:1px solid #cbd5e1; padding:2px; border-radius:4px; display:inline-block;" />
            <span style="display:block; font-size:0.60rem; color:#64748b; margin-top:2px; font-weight:700">Validación Digital</span>
          </div>
        </div>

        <!-- SECCIÓN DE FIRMAS EN 3 COLUMNAS -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; text-align:center; margin-top:28px; padding-top:6px;">
          <div style="border-top:1.5px solid #64748b; padding-top:4px;">
            <strong style="font-size:0.74rem; display:block; color:#0f172a;">Firma del Participante</strong>
            <span style="font-size:0.65rem; color:#64748b;">Postulante Interesado</span>
          </div>
          <div style="border-top:1.5px solid #64748b; padding-top:4px;">
            <strong style="font-size:0.74rem; display:block; color:#0f172a;">${directorNom}</strong>
            <span style="font-size:0.65rem; color:#64748b;">Director(a) CEA</span>
          </div>
          <div style="border-top:1.5px solid #64748b; padding-top:4px;">
            <strong style="font-size:0.74rem; display:block; color:#0f172a;">Sello y Recepción</strong>
            <span style="font-size:0.65rem; color:#64748b;">Kardex / Secretaría Escolar</span>
          </div>
        </div>
      </div>
    `;

    printArea.style.display = 'block';

    let compCleaned = false;
    const limpiarComprobantePrint = () => {
      if (compCleaned) return;
      compCleaned = true;
      document.body.classList.remove('printing-comprobante');
      if (printArea) {
        printArea.innerHTML = '';
        printArea.style.display = 'none';
      }
      window.removeEventListener('afterprint', limpiarComprobantePrint);
    };
    window.addEventListener('afterprint', limpiarComprobantePrint, { once: true });

    setTimeout(() => {
      window.print();
    }, 150);
  }

  // Exportar al ámbito global
  window.imprimirComprobante = imprimirComprobante;
})();
