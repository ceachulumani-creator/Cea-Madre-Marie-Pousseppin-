/* ==========================================================================
   MÓDULO EXCLUSIVO Y AISLADO DE IMPRESIÓN DE COMPROBANTE DE INSCRIPCIÓN
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN 2026
   Bordes: 1 cm arriba, derecha, abajo; 2 cm a la izquierda (Archivado)
   Entra estrictamente en UNA SOLA HOJA (Formato Vertical Oficial)
   ========================================================================== */

(function () {
  'use strict';

  function aplicarOrientacionComprobante() {
    let styleTag = document.getElementById('cea-dynamic-page-orientation');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cea-dynamic-page-orientation';
    }
    document.head.appendChild(styleTag);
    // Margen izquierdo de 2cm (20mm) para archivador/engrapado, 1cm (10mm) en los demás bordes
    styleTag.innerHTML = `@page { size: letter portrait !important; margin: 10mm 10mm 10mm 20mm !important; }`;
    document.body.classList.add('print-orientation-portrait', 'printing-comprobante');
    document.body.classList.remove('print-orientation-landscape', 'printing-horario', 'printing-kardex', 'printing-reporte');
  }

  function generarHtmlFichaOficial(data, codigoReg, fechaHoy, directorNom) {
    const edadStr = data.edad ? `(<strong>${data.edad} años cumplidos</strong>)` : (data.fechaNacimiento && typeof calcularEdad === 'function' && calcularEdad(data.fechaNacimiento) !== null ? `(<strong>${calcularEdad(data.fechaNacimiento)} años cumplidos</strong>)` : '');
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent('https://ceamadremariepoussepin.github.io/?ci=' + (data.ci || '') + '&reg=' + codigoReg)}`;

    return `
      <div class="comprobante-ficha-letter" style="font-family:Arial, Helvetica, sans-serif; width:100%; max-width:100%; max-height:254mm; margin:0 auto; padding:8px 12px; border:1.5px solid #1a6b2e; border-radius:6px; color:#0f172a; background:#ffffff; box-sizing:border-box; overflow:hidden; page-break-inside:avoid;">
        <!-- Encabezado Institucional Oficial -->
        <div style="text-align:center; border-bottom:1.8px solid #1a6b2e; padding-bottom:5px; margin-bottom:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <img src="logo cea madre marie poussepin.png" alt="Logo CEA" style="width:50px; height:auto; max-height:50px;" />
            <div style="flex:1; padding:0 8px; line-height:1.15;">
              <div style="font-size:6.8pt; font-weight:800; letter-spacing:0.5px; color:#1e293b; text-transform:uppercase; margin:0;">Estado Plurinacional de Bolivia • Ministerio de Educación</div>
              <div style="font-size:6.4pt; font-weight:700; color:#475569; margin:1px 0 0 0;">Viceministerio de Educación Alternativa y Especial • DDE La Paz</div>
              <h2 style="margin:2px 0 1px; font-size:1.10rem; font-weight:900; color:#15803d; letter-spacing:0.4px;">CEA MADRE MARIE POUSSEPÍN</h2>
              <div style="font-size:6.4pt; color:#64748b; margin:0;">R.A. 176/2013 • Código SIE: 80630044 • Chulumani, Sud Yungas, Bolivia</div>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block; padding:3px 8px; background:#dcfce7; border:1.2px solid #16a34a; border-radius:5px; font-weight:900; font-size:7.5pt; color:#166534;">GESTIÓN ${data.gestion || '2026'}</span>
              <div style="margin-top:2px; font-size:6.5pt; color:#64748b;">FOLIO N°: <strong style="color:#0f172a;">${codigoReg}</strong></div>
            </div>
          </div>
        </div>

        <div style="text-align:center; margin-bottom:8px;">
          <h3 style="margin:0; font-size:0.92rem; font-weight:900; text-transform:uppercase; letter-spacing:0.8px; color:#0f172a; text-decoration:underline;">FORMULARIO OFICIAL DE PRE-INSCRIPCIÓN Y MATRICULACIÓN</h3>
          <p style="margin:2px 0 0 0; font-size:6.8pt; color:#64748b;">Fecha y hora de emisión: ${fechaHoy}</p>
        </div>

        <!-- TABLA 1: DATOS PERSONALES -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:7.8pt; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9;"><th colspan="2" style="padding:4px 8px; text-align:left; font-size:7.4pt; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1;">1. DATOS PERSONALES DEL PARTICIPANTE</th></tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; width:34%; background:#f8fafc;">Apellidos y Nombres:</td><td style="padding:3.5px 8px; font-weight:800; color:#0f172a;">${data.nombre || '—'}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; background:#f8fafc;">Cédula de Identidad (CI):</td><td style="padding:3.5px 8px; font-weight:800;">${data.ci || '—'}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; background:#f8fafc;">Fecha de Nacimiento / Edad:</td><td style="padding:3.5px 8px;">${data.fechaNacimiento || 'No especificada'} ${edadStr}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; background:#f8fafc;">Número de Teléfono / WhatsApp:</td><td style="padding:3.5px 8px;">${data.telefono || '—'}</td></tr>
          </tbody>
        </table>

        <!-- TABLA 2: ASIGNACIÓN ACADÉMICA -->
        <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:7.8pt; border:1px solid #cbd5e1;">
          <thead>
            <tr style="background:#f1f5f9;"><th colspan="2" style="padding:4px 8px; text-align:left; font-size:7.4pt; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1;">2. ASIGNACIÓN ACADÉMICA Y CARRERA</th></tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; width:34%; background:#f8fafc;">Área de Formación:</td><td style="padding:3.5px 8px; font-weight:800; color:#15803d;">${data.area === 'tecnica' ? 'EDUCACIÓN TÉCNICA TECNOLÓGICA (ETTP / ETA)' : 'EDUCACIÓN DE PERSONAS JÓVENES Y ADULTAS (EPJA - Humanística)'}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; background:#f8fafc;">Especialidad / Carrera Solicitada:</td><td style="padding:3.5px 8px; font-weight:800; color:#0f172a;">${data.carrera || '—'}</td></tr>
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; background:#f8fafc;">Semestre Asignado:</td><td style="padding:3.5px 8px; font-weight:800; color:#15803d;">${data.semestre || '1er Semestre'} — Gestión ${data.gestion || '2026'}</td></tr>
            ${(data.esCasoExcepcional || data.casoExcepcional) ? `
            <tr style="border-bottom:1px solid #e2e8f0;background:#fffbeb;">
              <td style="padding:3.5px 8px; font-weight:700; color:#92400e; background:#fef3c7;">Modalidad de Matrícula:</td>
              <td style="padding:3.5px 8px; font-weight:800; color:#b45309; line-height:1.2;">
                PRE-INSCRIPCIÓN CONDICIONAL POR CASO EXCEPCIONAL (LEY 070)<br>
                <span style="font-size:7pt; font-weight:600; color:#92400e;">Causal declarada: ${data.casoExcepcional || 'Caso Excepcional'}${data.detalleExcepcion ? ` (${data.detalleExcepcion})` : ''}</span>
              </td>
            </tr>` : ''}
            <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:3.5px 8px; font-weight:700; background:#f8fafc;">Observaciones / Turno:</td><td style="padding:3.5px 8px; font-size:7.4pt; color:#475569;">${data.observaciones || 'Sin observaciones registradas.'}</td></tr>
          </tbody>
        </table>

        ${data.avisoVigencia ? `
        <!-- CONDICIÓN DE MATRÍCULA -->
        <div style="background:#fef3c7; border:1px solid #f59e0b; border-radius:5px; padding:5px 8px; margin-bottom:8px; font-size:7.2pt; color:#92400e; line-height:1.35;">
          <strong>Condición de Matrícula:</strong> ${data.avisoVigencia}
        </div>` : ''}

        <!-- REQUISITOS Y QR DIGITAL EN 2 COLUMNAS -->
        <div style="display:grid; grid-template-columns:1fr 85px; gap:8px; margin-bottom:12px; align-items:center;">
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:5px; padding:6px 10px; font-size:6.9pt; line-height:1.35; color:#334155;">
            <strong style="color:#0f172a; display:block; margin-bottom:2px; text-transform:uppercase; font-size:7pt;">Requisitos para ratificación de matrícula en Secretaría:</strong>
            1. Dos (2) fotocopias simples de Cédula de Identidad vigente (cotejada con original).<br>
            2. Fotocopia de Libreta o Certificado de Calificaciones del último nivel aprobado.<br>
            3. Para el Área Técnica: Certificado del nivel anterior (Básico/Auxiliar) si corresponde.<br>
            ${(data.esCasoExcepcional || data.casoExcepcional) ? `4. Documento o certificado físico de respaldo de la causal de excepción legal (menores de edad).<br>5. ` : '4. '}Presentar esta ficha oficial impresa o digital al momento de la entrega de carpetas.
          </div>
          <div style="text-align:center;">
            <img src="${qrUrl}" alt="QR Verificación" style="width:68px; height:68px; border:1px solid #cbd5e1; padding:2px; border-radius:4px; display:inline-block;" />
            <span style="display:block; font-size:6pt; color:#64748b; margin-top:2px; font-weight:700">Validación Digital</span>
          </div>
        </div>

        <!-- SECCIÓN DE FIRMAS EN 3 COLUMNAS -->
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; text-align:center; margin-top:16px; padding-top:4px;">
          <div style="border-top:1.5px solid #64748b; padding-top:3px;">
            <strong style="font-size:7.2pt; display:block; color:#0f172a;">Firma del Participante</strong>
            <span style="font-size:6.3pt; color:#64748b;">Postulante Interesado</span>
          </div>
          <div style="border-top:1.5px solid #64748b; padding-top:3px;">
            <strong style="font-size:7.2pt; display:block; color:#0f172a;">${directorNom}</strong>
            <span style="font-size:6.3pt; color:#64748b;">Director(a) CEA</span>
          </div>
          <div style="border-top:1.5px solid #64748b; padding-top:3px;">
            <strong style="font-size:7.2pt; display:block; color:#0f172a;">Sello y Recepción</strong>
            <span style="font-size:6.3pt; color:#64748b;">Kardex / Secretaría Escolar</span>
          </div>
        </div>
      </div>
    `;
  }

  function imprimirDocumentoComprobanteAislado(htmlContent, titulo = 'Ficha de Preinscripción - CEA Madre Marie Poussepin') {
    let oldIframe = document.getElementById('comprobante-isolated-print-frame');
    if (oldIframe) {
      try { oldIframe.remove(); } catch(e) {}
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'comprobante-isolated-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '1000px';
    iframe.style.height = '1200px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    @page {
      size: letter portrait !important;
      margin: 10mm 10mm 10mm 20mm !important; /* Top 1cm, Right 1cm, Bottom 1cm, Left 2cm */
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: Arial, Helvetica, sans-serif;
    }
    .comprobante-ficha-letter {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      page-break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.warn('Fallback a window.print:', err);
        window.print();
      }
      setTimeout(() => {
        try {
          if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
        } catch(e) {}
      }, 2500);
    }, 250);
  }

  function imprimirComprobante(dataOverride) {
    aplicarOrientacionComprobante();

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

    const fichaHtml = generarHtmlFichaOficial(data, codigoReg, fechaHoy, directorNom);

    // Preparar el área para respaldo en la ventana principal
    let printArea = document.getElementById('comprobante-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'comprobante-print-area';
      document.body.appendChild(printArea);
    }
    printArea.innerHTML = fichaHtml;

    // Ejecutar impresión aislada en documento independiente (garantiza márgenes de 2cm izq, 1cm demás y 1 sola hoja)
    imprimirDocumentoComprobanteAislado(fichaHtml, `Ficha_Preinscripcion_${data.ci || 'CEA'}`);
  }

  // Exportar al ámbito global
  window.imprimirComprobante = imprimirComprobante;
  window.descargarComprobanteInscripcionPDF = imprimirComprobante;
  window.aplicarOrientacionComprobante = aplicarOrientacionComprobante;
})();
