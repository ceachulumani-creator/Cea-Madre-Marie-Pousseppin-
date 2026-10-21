/* ==========================================================================
   MÓDULO EXCLUSIVO Y AISLADO DE IMPRESIÓN DE COMPROBANTE DE INSCRIPCIÓN
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN 2026
   Bordes: 1 cm arriba, derecha, abajo; 2 cm a la izquierda (Archivado)
   Entra estrictamente en UNA SOLA HOJA (Formato Vertical Oficial)
   ========================================================================== */

(function () {
  'use strict';

  let _cachedLogoDataUrl = null;
  function precargarLogoInstitucional() {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cvs = document.createElement('canvas');
          cvs.width = img.naturalWidth || img.width || 120;
          cvs.height = img.naturalHeight || img.height || 120;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0);
          _cachedLogoDataUrl = cvs.toDataURL('image/png');
        } catch (e) {}
      };
      img.src = 'logo cea madre marie poussepin.png';
    } catch (e) {}
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', precargarLogoInstitucional);
    } else {
      precargarLogoInstitucional();
    }
  }

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

  function formatearSoloFechaNacimiento(fnac) {
    if (!fnac) return 'No especificada';
    const str = String(fnac).trim();
    const soloFecha = str.split('T')[0].split(' ')[0];
    const partes = soloFecha.split('-');
    if (partes.length === 3) {
      const y = partes[0];
      const m = partes[1].padStart(2, '0');
      const d = partes[2].padStart(2, '0');
      return `${d}/${m}/${y}`;
    }
    const partesSlash = soloFecha.split('/');
    if (partesSlash.length === 3) {
      return `${partesSlash[0].padStart(2, '0')}/${partesSlash[1].padStart(2, '0')}/${partesSlash[2]}`;
    }
    return soloFecha;
  }

  function generarQRCodeDataUrl(texto, tamano = 85) {
    try {
      if (typeof QRCode !== 'undefined') {
        const div = document.createElement('div');
        new QRCode(div, {
          text: texto,
          width: tamano,
          height: tamano,
          colorDark: "#064e3b",
          colorLight: "#ffffff",
          correctLevel: (typeof QRCode.CorrectLevel !== 'undefined') ? QRCode.CorrectLevel.M : 0
        });
        const img = div.querySelector('img');
        if (img && img.src && img.src.startsWith('data:')) return img.src;
        const cvs = div.querySelector('canvas');
        if (cvs && typeof cvs.toDataURL === 'function') return cvs.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('Generando QR local con QRCode.js:', e);
    }

    // Respaldo visual institucional 100% offline con Canvas sin peticiones de red
    try {
      const cvs = document.createElement('canvas');
      cvs.width = tamano;
      cvs.height = tamano;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, tamano, tamano);
      ctx.strokeStyle = '#166534';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(3, 3, tamano - 6, tamano - 6);

      const drawEye = (x, y) => {
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(x, y, 18, 18);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 3, y + 3, 12, 12);
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(x + 6, y + 6, 6, 6);
      };
      drawEye(6, 6);
      drawEye(tamano - 24, 6);
      drawEye(6, tamano - 24);

      // Puntos simulados de validación oficial
      ctx.fillStyle = '#166534';
      ctx.fillRect(tamano / 2 - 4, tamano / 2 - 4, 8, 8);
      ctx.fillRect(tamano / 2 - 12, tamano / 2 + 6, 6, 6);
      ctx.fillRect(tamano / 2 + 6, tamano / 2 - 10, 6, 6);
      ctx.fillRect(tamano / 2 + 8, tamano / 2 + 8, 5, 5);
      return cvs.toDataURL('image/png');
    } catch (errCanvas) {
      return '';
    }
  }

  function generarHtmlFichaOficial(data, codigoReg, fechaHoy, directorNom) {
    const edadNum = data.edad || (data.fechaNacimiento && typeof calcularEdad === 'function' ? calcularEdad(data.fechaNacimiento) : null);
    const edadStr = (edadNum !== null && !isNaN(edadNum) && edadNum > 0) ? `(<strong>${edadNum} años cumplidos</strong>)` : '';
    const fechaNacTexto = `${formatearSoloFechaNacimiento(data.fechaNacimiento)} ${edadStr}`.trim();
    let baseOriginUrl = 'https://ceachulumani-creator.github.io/Cea-Madre-Marie-Pousseppin-/';
    if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')) {
      baseOriginUrl = window.location.origin + window.location.pathname;
    }
    const qrTargetUrl = baseOriginUrl + '?ci=' + encodeURIComponent(data.ci || '') + '&reg=' + encodeURIComponent(codigoReg);
    const qrUrl = generarQRCodeDataUrl(qrTargetUrl, 85);

    // Detección precisa de Área y Nivel Académico
    const areaStr = String(data.area || '').toLowerCase();
    const carreraStr = String(data.carrera || '').toLowerCase();
    const cursoStr = String(data.curso || data.nivel || '').toLowerCase();
    const esTecnica = areaStr.includes('tec') || carreraStr.includes('sistemas') || carreraStr.includes('gastronom') || carreraStr.includes('belleza') || carreraStr.includes('secretariado') || carreraStr.includes('confecci') || carreraStr.includes('agropecuaria') || Boolean(data.esTecnica);
    const esPrimaria = !esTecnica && (cursoStr.includes('primaria') || cursoStr.includes('elementales') || cursoStr.includes('avanzados') || cursoStr.includes('1°-3°') || cursoStr.includes('4°-6°') || cursoStr.includes('1-3') || cursoStr.includes('4-6') || cursoStr.includes('epa'));
    
    // Función estricta: en área técnica NUNCA existe caso excepcional
    const esCasoExcepcional = (() => {
      if (esTecnica) return false;
      const v = data.esCasoExcepcional;
      if (v === true || v === 1 || v === 'true' || v === '1' || v === 'SI' || v === 'SÍ') return true;
      const c = String(data.casoExcepcional || '').trim();
      if (c && !['false', '0', 'NO', 'No', 'no', 'Ninguno', 'Inscripción Regular', 'Regular', '—', '-'].includes(c)) return true;
      return false;
    })();

    let docItems = [];
    let tituloCotejo = '';

    if (esTecnica) {
      tituloCotejo = '3. REGISTRO DE COTEJO DE DOCUMENTOS REQUERIDOS — ÁREA TÉCNICA TECNOLÓGICA (TTP):';
      const esAuxiliar = carreraStr.includes('auxiliar');
      const esMedio = carreraStr.includes('medio');

      docItems.push('Fotocopia simple de Cédula de Identidad (CI) vigente.');
      docItems.push('Fotocopia de Certificado de Nacimiento.');

      if (esMedio) {
        docItems.push('Fotocopia del Certificado oficial del nivel Técnico Auxiliar.');
      } else if (esAuxiliar) {
        docItems.push('Fotocopia del Certificado del nivel Técnico Básico (o libreta/certificado del nivel anterior).');
      } else {
        docItems.push('Fotocopia de libreta escolar o constancia de nivel previo (o 15 años cumplidos).');
      }
      // En área técnica NO existe caso excepcional bajo ninguna circunstancia
    } else if (esPrimaria) {
      tituloCotejo = '3. REGISTRO DE COTEJO DE DOCUMENTOS REQUERIDOS — EDUCACIÓN PRIMARIA DE ADULTOS (EPA):';
      docItems.push('Fotocopia simple de Cédula de Identidad (CI) vigente.');
      docItems.push('Fotocopia de Certificado de Nacimiento.');
      docItems.push('Fotocopia de libreta o certificación de estudios previos (si cuenta con escolaridad anterior).');

      if (esCasoExcepcional) {
        docItems.push('Fotocopia del documento de respaldo para caso de excepción legal (justificación laboral, salud o tutoría).');
      }
    } else {
      tituloCotejo = '3. REGISTRO DE COTEJO DE DOCUMENTOS REQUERIDOS — EDUCACIÓN SECUNDARIA DE ADULTOS (ESA / BTH):';
      docItems.push('Fotocopia simple de Cédula de Identidad (CI) vigente.');
      docItems.push('Fotocopia de Certificado de Nacimiento.');
      docItems.push('Fotocopia de Libreta Escolar del último curso aprobado (año vencido).');

      if (esCasoExcepcional) {
        docItems.push('Fotocopia del documento de respaldo para caso de excepción legal (justificación laboral, salud o tutoría).');
      }
    }

    return `
      <div class="comprobante-ficha-letter" style="font-family:Arial, Helvetica, sans-serif; width:702px; max-width:702px; height:970px; min-height:970px; max-height:970px; margin:0 auto; padding:8px 12px 14px 12px; border:2px solid #166534; border-radius:6px; color:#0f172a; background:#ffffff; box-sizing:border-box; overflow:hidden; page-break-inside:avoid; display:flex; flex-direction:column; justify-content:space-between; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:geometricPrecision;">
        
        <!-- BLOQUE SUPERIOR: ENCABEZADO Y SECCIONES 1 A 5 AGRUPADAS JUNTITAS -->
        <div style="flex:0 0 auto; display:flex; flex-direction:column;">
          <!-- ENCABEZADO INSTITUCIONAL OFICIAL -->
          <div style="border-bottom:2px solid #166534; padding-bottom:4px; margin-bottom:5px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <img src="${_cachedLogoDataUrl || 'logo cea madre marie poussepin.png'}" alt="Logo CEA" crossorigin="anonymous" style="width:52px; height:auto; max-height:52px;" />
              <div style="flex:1; padding:0 8px; line-height:1.15; text-align:center;">
                <div style="font-size:7.2pt; font-weight:800; letter-spacing:0.5px; color:#1e293b; text-transform:uppercase; margin:0;">Estado Plurinacional de Bolivia • Ministerio de Educación</div>
                <div style="font-size:6.8pt; font-weight:700; color:#475569; margin:1px 0 0 0;">Viceministerio de Educación Alternativa y Especial • DDE La Paz • DDE Chulumani</div>
                <h2 style="margin:2px 0 1px; font-size:1.15rem; font-weight:900; color:#166534; letter-spacing:0.5px;">CEA MADRE MARIE POUSSEPÍN</h2>
                <div style="font-size:6.8pt; color:#64748b; margin:0; font-weight:600;">R.A. 176/2013 • Código SIE: 80630044 • Chulumani, Sud Yungas, La Paz - Bolivia</div>
              </div>
              <div style="text-align:right;">
                <span style="display:inline-block; padding:3px 8px; background:#dcfce7; border:1.4px solid #16a34a; border-radius:5px; font-weight:900; font-size:7.8pt; color:#166534;">GESTIÓN ${data.gestion || '2026'}</span>
                <div style="margin-top:2px; font-size:7pt; color:#64748b; font-weight:700;">FOLIO REGISTRO:</div>
                <div style="font-size:8.2pt; font-weight:900; color:#0f172a; letter-spacing:0.5px;">${codigoReg}</div>
              </div>
            </div>
            <div style="text-align:center; margin-top:3px; background:#f0fdf4; padding:3px 6px; border-radius:4px; border:1px solid #bbf7d0;">
              <h3 style="margin:0; font-size:0.90rem; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; color:#166534;">FORMULARIO OFICIAL DE PRE-INSCRIPCIÓN Y REGISTRO ÚNICO DE MATRÍCULA</h3>
              <span style="font-size:6.6pt; color:#475569; font-weight:600;">Documento válido para ratificación presencial de matrícula en Secretaría Académica • Emisión: ${fechaHoy}</span>
            </div>
          </div>

          <!-- CUERPO PRINCIPAL DEL FORMULARIO (Secciones compactas y continuas una debajo de otra) -->
          <div style="display:flex; flex-direction:column; gap:5px; margin:0; padding:0;">
            
            <!-- TABLA 1: DATOS PERSONALES DEL PARTICIPANTE (+1 punto de tamaño de texto) -->
            <table style="width:100%; border-collapse:collapse; font-size:8.8pt; border:1px solid #cbd5e1; margin:0;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th colspan="4" style="padding:4px 8px; text-align:left; font-size:8.4pt; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1; font-weight:900;">
                    1. DATOS DE IDENTIFICACIÓN PERSONAL DEL PARTICIPANTE
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; width:22%; background:#f8fafc;">Apellidos y Nombres:</td>
                  <td style="padding:4px 8px; font-weight:900; color:#0f172a;" colspan="3">${data.nombre || '—'}</td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Cédula de Identidad (CI):</td>
                  <td style="padding:4px 8px; font-weight:800; color:#0f172a; width:28%;">${data.ci || '—'}</td>
                  <td style="padding:4px 8px; font-weight:700; width:20%; background:#f8fafc;">Fecha Nac. / Edad:</td>
                  <td style="padding:4px 8px; width:30%; font-weight:700;">${fechaNacTexto}</td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Teléfono / WhatsApp:</td>
                  <td style="padding:4px 8px; font-weight:800; color:#166534;">${data.telefono || '—'}</td>
                  <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Comunidad / Procedencia:</td>
                  <td style="padding:4px 8px; font-weight:800; color:#0f172a;">${data.comunidad || data.direccion || data.domicilio || 'Chulumani / Sud Yungas'}</td>
                </tr>
              </tbody>
            </table>

            <!-- TABLA 2: ASIGNACIÓN ACADÉMICA Y CARRERA (+1 punto de tamaño de texto) -->
            <table style="width:100%; border-collapse:collapse; font-size:8.8pt; border:1px solid #cbd5e1; margin:0;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th colspan="4" style="padding:4px 8px; text-align:left; font-size:8.4pt; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1; font-weight:900;">
                    2. ASIGNACIÓN ACADÉMICA Y CARRERA
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; width:22%; background:#f8fafc;">Área de Formación:</td>
                  <td style="padding:4px 8px; font-weight:900; color:#166534;" colspan="3">
                    ${data.area === 'tecnica' ? 'EDUCACIÓN TÉCNICA TECNOLÓGICA PRODUCTIVA (ETTP / ETA)' : 'EDUCACIÓN DE PERSONAS JÓVENES Y ADULTAS (EPJA - Humanística)'}
                  </td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Especialidad / Carrera:</td>
                  <td style="padding:4px 8px; font-weight:900; color:#0f172a; width:36%;">${data.carrera || '—'}</td>
                  <td style="padding:4px 8px; font-weight:700; width:18%; background:#f8fafc;">Nivel / Semestre:</td>
                  <td style="padding:4px 8px; font-weight:800; color:#166534; width:24%;">${data.semestre || '1er Semestre'} — Gestión ${data.gestion || '2026'}</td>
                </tr>
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Sede o Subcentro:</td>
                  <td style="padding:4px 8px; font-weight:800; color:#0f172a;" colspan="3">${data.sede || data.subcentro || 'Sede Central (Centro de Chulumani)'}</td>
                </tr>
                ${esCasoExcepcional ? `
                <tr style="border-bottom:1px solid #e2e8f0;background:#fffbeb;">
                  <td style="padding:4px 8px; font-weight:700; color:#92400e; background:#fef3c7;">Modalidad Matrícula:</td>
                  <td style="padding:4px 8px; font-weight:800; color:#b45309; line-height:1.2;" colspan="3">
                    PRE-INSCRIPCIÓN CONDICIONAL POR CASO EXCEPCIONAL (LEY 070)<br>
                    <span style="font-size:8pt; font-weight:600; color:#92400e;">Causal declarada: ${data.casoExcepcional || 'Caso Excepcional'}${data.detalleExcepcion ? ` (${data.detalleExcepcion})` : ''}</span>
                  </td>
                </tr>` : `
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Modalidad Matrícula:</td>
                  <td style="padding:4px 8px; font-weight:700; color:#166534;" colspan="3">Inscripción Regular Oficial (Cumple con los requisitos establecidos)</td>
                </tr>`}
                <tr style="border-bottom:1px solid #e2e8f0;">
                  <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Observaciones:</td>
                  <td style="padding:4px 8px; font-size:8.4pt; color:#475569;" colspan="3">${data.observaciones || 'Sin observaciones adicionales registradas.'}</td>
                </tr>
              </tbody>
            </table>

            <!-- SECCIÓN 3: REQUISITOS Y DOCUMENTACIÓN DE RESPALDO (+1 punto de tamaño de texto) -->
            <div style="border:1px solid #cbd5e1; border-radius:4px; padding:5px 8px; background:#f8fafc; font-size:8.3pt; line-height:1.3; margin:0;">
              <strong style="color:#0f172a; display:block; margin-bottom:3px; text-transform:uppercase; font-size:8.3pt; border-bottom:1px solid #cbd5e1; padding-bottom:2px;">
                ${tituloCotejo}
              </strong>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:3px 10px; color:#334155;">
                ${docItems.map((doc, idx) => `<div>[ &nbsp; ] ${idx + 1}. ${doc}</div>`).join('')}
              </div>
            </div>

            <!-- SECCIÓN 4: DECLARACIÓN JURADA Y COMPROMISO DEL PARTICIPANTE (+1 punto de tamaño de texto) -->
            <div style="border:1px solid #cbd5e1; border-radius:4px; padding:5px 8px; background:#ffffff; font-size:7.9pt; line-height:1.3; color:#334155; margin:0;">
              <strong style="color:#0f172a; text-transform:uppercase; font-size:8.1pt; display:block; margin-bottom:2px;">
                4. DECLARACIÓN JURADA Y COMPROMISO INSTITUCIONAL:
              </strong>
              Yo, en mi calidad de participante, declaro bajo juramento que los datos e información consignados en este formulario son fidedignos y verídicos. Me comprometo a presentar toda la documentación original ante Secretaría Académica para el cotejo correspondiente, así como a respetar y cumplir fielmente el Estatuto Orgánico, el Reglamento Interno del Centro de Educación Alternativa "Madre Marie Poussepin", las disposiciones de la Dirección Distrital y la Ley de Educación N° 070 "Avelino Siñani - Elizardo Pérez".
            </div>

            <!-- SECCIÓN 5: CONTROL DE RECEPCIÓN Y QR DE VALIDACIÓN DIGITAL (+1 punto de tamaño de texto) -->
            <div style="display:grid; grid-template-columns:1fr 85px; gap:8px; align-items:center; border:1px solid #cbd5e1; border-radius:4px; padding:5px 8px; background:#f8fafc; margin:0;">
              <div style="font-size:8.0pt; line-height:1.35; color:#334155;">
                <strong style="color:#0f172a; text-transform:uppercase; display:block; margin-bottom:2px; font-size:8.2pt;">
                  5. CONTROL DE RECEPCIÓN Y OBSERVACIONES DE KARDEX:
                </strong>
                <div>• Fecha límite de ratificación y entrega de carpetas: <strong>Hasta 5 días hábiles posteriores a la preinscripción</strong>.</div>
                <div>• Observaciones de Kardex: ____________________________________________________________________________</div>
                <div style="margin-top:2px;">• Código Único de Registro Electrónico: <strong style="font-family:monospace; font-size:8.5pt; color:#166534;">CEA-${codigoReg}-${new Date().getFullYear()}</strong></div>
              </div>
              <div style="text-align:center;">
                <img src="${qrUrl}" alt="QR Verificación" crossorigin="anonymous" style="width:68px; height:68px; border:1px solid #cbd5e1; padding:2px; border-radius:4px; display:inline-block; background:#ffffff;" />
                <span style="display:block; font-size:6.8pt; color:#64748b; margin-top:1px; font-weight:800; text-transform:uppercase;">Validación Digital</span>
              </div>
            </div>

          </div>
        </div>

        <!-- SECCIÓN 6: BLOQUE INFERIOR CON ESPACIO AMPLIO PARA FIRMA DEL PARTICIPANTE -->
        <div style="flex:1 1 auto; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; padding-top:24px; padding-bottom:6px; min-height:85px;">
          <div style="width:280px; text-align:center; border-top:1.8px solid #334155; padding-top:4px;">
            <strong style="font-size:9.2pt; display:block; color:#0f172a; text-transform:uppercase; letter-spacing:0.4px;">Firma del Participante</strong>
            <span style="font-size:8.2pt; color:#475569; display:block; font-weight:600; margin-top:2px;">C.I.: ${data.ci || '_____________________'}</span>
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

  let _html2pdfLoadPromise = null;
  function asegurarHtml2PdfCargado() {
    if (typeof window.html2pdf !== 'undefined') {
      return Promise.resolve();
    }
    if (_html2pdfLoadPromise) return _html2pdfLoadPromise;
    _html2pdfLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = (err) => {
        _html2pdfLoadPromise = null;
        reject(err);
      };
      document.head.appendChild(script);
    });
    return _html2pdfLoadPromise;
  }

  function asegurarEstilosAnimacionComprobante() {
    if (document.getElementById('cea-comprobante-anim-styles')) return;
    const st = document.createElement('style');
    st.id = 'cea-comprobante-anim-styles';
    st.innerHTML = `
      @keyframes spinVoucherBtn {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes zoomInAvisoPdf {
        from { transform: scale(0.92); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }
      @keyframes pulseProgresoIcon {
        0%, 100% { transform: scale(1); box-shadow: 0 8px 22px rgba(22,163,74,0.38); }
        50% { transform: scale(1.08); box-shadow: 0 12px 30px rgba(22,163,74,0.58); }
      }
      @keyframes shimmerBar {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
      }
    `;
    document.head.appendChild(st);
  }

  async function convertirImagenesComprobanteABase64(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map(async (img) => {
      const src = img.getAttribute('src') || img.src;
      if (!src || src.startsWith('data:')) return;

      const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timeoutId = setTimeout(() => { if (controller) controller.abort(); }, 1500);

      // 1. Intentar vía fetch + FileReader
      try {
        const fetchOpts = { mode: 'cors', cache: 'force-cache' };
        if (controller) fetchOpts.signal = controller.signal;
        const res = await fetch(src, fetchOpts);
        clearTimeout(timeoutId);
        if (res.ok) {
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) {
            img.src = dataUrl;
            return;
          }
        }
      } catch (e) {
        clearTimeout(timeoutId);
      }

      // 2. Respaldo vía Canvas Image con timeout rápido
      await new Promise((resolve) => {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        const timer = setTimeout(finish, 800);
        tempImg.onload = () => {
          clearTimeout(timer);
          try {
            const cvs = document.createElement('canvas');
            cvs.width = tempImg.naturalWidth || tempImg.width || 85;
            cvs.height = tempImg.naturalHeight || tempImg.height || 85;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            img.src = cvs.toDataURL('image/png');
          } catch (e) {}
          finish();
        };
        tempImg.onerror = () => {
          clearTimeout(timer);
          finish();
        };
        tempImg.src = src;
      });
    }));
  }

  function obtenerMetadatosFicha(data) {
    if (!data._codigoReg) {
      data._codigoReg = 'CEA-2026-' + Math.floor(100000 + Math.random() * 900000);
    }
    if (!data._fechaEmisionTexto) {
      data._fechaEmisionTexto = new Date().toLocaleDateString('es-BO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    let directorNom = 'Lic. José Luis Alanoca Mamani';
    try {
      const stored = localStorage.getItem('cea_textos_director');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.director_nombre) directorNom = parsed.director_nombre;
      }
    } catch (e) {}

    const ciLimpio = String(data.ci || 'CEA').replace(/[^a-zA-Z0-9_-]/g, '');
    const nomLimpio = String(data.nombre || 'Participante')
      .trim()
      .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s_-]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 36);
    const nombreArchivo = `Ficha_Inscripcion_CEA_${ciLimpio}_${nomLimpio}.pdf`;

    return {
      codigoReg: data._codigoReg,
      fechaHoy: data._fechaEmisionTexto,
      directorNom,
      nombreArchivo
    };
  }

  function descargarBlobArchivoPDF(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename || 'Ficha_Inscripcion_CEA_2026.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a && a.parentNode) a.parentNode.removeChild(a);
      } catch (e) {}
    }, 4000);
  }

  let _ultimoPdfBlobUrl = null;

  function abrirPdfGeneradoComprobante() {
    if (_ultimoPdfBlobUrl) {
      const win = window.open(_ultimoPdfBlobUrl, '_blank');
      if (!win || win.closed || typeof win.closed === 'undefined') {
        const a = document.createElement('a');
        a.href = _ultimoPdfBlobUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          try { if (a && a.parentNode) a.parentNode.removeChild(a); } catch(e) {}
        }, 1200);
      }
    } else if (window._ultimoRegistroInscripcion && window._ultimoRegistroInscripcion._pdfBlob) {
      _ultimoPdfBlobUrl = URL.createObjectURL(window._ultimoRegistroInscripcion._pdfBlob);
      window.open(_ultimoPdfBlobUrl, '_blank');
    }
  }

  function cerrarModalAvisoDescargaPdf() {
    const modal = document.getElementById('modal-aviso-pdf-descargado');
    if (modal) modal.style.display = 'none';
  }

  function mostrarModalAvisoDescargaPdf(nombreArchivo, blob) {
    if (blob) {
      if (_ultimoPdfBlobUrl) {
        try { URL.revokeObjectURL(_ultimoPdfBlobUrl); } catch (e) {}
      }
      _ultimoPdfBlobUrl = URL.createObjectURL(blob);
    }

    let modal = document.getElementById('modal-aviso-pdf-descargado');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'modal-aviso-pdf-descargado';
      modal.className = 'modal-aviso-pdf-overlay';
      document.body.appendChild(modal);
    }

    const esAndroid = /Android/i.test(navigator.userAgent);
    const esIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const esMovil = esAndroid || esIOS || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);

    const badgeIconSvg = esMovil
      ? `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" style="flex-shrink:0;"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`
      : `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.3" style="flex-shrink:0;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
    const badgeTexto = esAndroid ? 'CELULAR ANDROID' : (esMovil ? 'DISPOSITIVO MÓVIL' : 'COMPUTADORA / PC');
    const badgeColor = esMovil ? '#166534' : '#1d4ed8';
    const badgeBg = esMovil ? '#dcfce7' : '#eff6ff';
    const badgeBorder = esMovil ? '#86efac' : '#93c5fd';

    const mensajeDispositivo = esMovil
      ? `Tu ficha oficial en formato PDF ya fue descargada en tu <strong>celular</strong>. Puedes revisarla con el botón <strong>"Abrir"</strong> o en tu carpeta de <strong>Descargas</strong> / barra de notificaciones.`
      : `Tu ficha oficial en formato PDF ya fue descargada en tu <strong>computadora</strong>. El archivo se encuentra guardado en tu carpeta de <strong>Descargas</strong>.`;

    const escNom = typeof escapeHTML === 'function' ? escapeHTML(nombreArchivo || '') : String(nombreArchivo || '');

    modal.innerHTML = `
      <div class="modal-aviso-pdf-backdrop" onclick="cerrarModalAvisoDescargaPdf()" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(4,26,11,0.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;">
        <div class="modal-aviso-pdf-card" onclick="event.stopPropagation()" style="background:#ffffff;border:2px solid #16a34a;border-radius:16px;max-width:460px;width:100%;box-shadow:0 20px 50px rgba(0,0,0,0.35);padding:24px 22px;text-align:center;box-sizing:border-box;animation:zoomInAvisoPdf 0.22s ease-out;">
          
          <div style="display:inline-flex;align-items:center;gap:6px;background:${badgeBg};color:${badgeColor};border:1.5px solid ${badgeBorder};border-radius:50px;padding:4px 12px;font-size:0.75rem;font-weight:800;letter-spacing:0.5px;margin-bottom:12px;text-transform:uppercase;">
            ${badgeIconSvg}
            <span>${badgeTexto}</span>
          </div>

          <div style="width:58px;height:58px;border-radius:50%;background:linear-gradient(135deg, #16a34a 0%, #15803d 100%);color:#ffffff;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 12px auto;box-shadow:0 6px 18px rgba(22,163,74,0.35);">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>

          <h3 style="margin:0 0 8px 0;font-size:1.25rem;font-weight:900;color:#063c17;letter-spacing:-0.3px;">
            Se descargó tu Ficha Oficial
          </h3>

          <div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:0.80rem;color:#334155;font-weight:700;word-break:break-all;display:flex;align-items:center;justify-content:center;gap:7px;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#16a34a" stroke-width="2.2" style="flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <span>${escNom || 'Ficha_Inscripcion_CEA_2026.pdf'}</span>
          </div>

          <p style="margin:0 0 20px 0;font-size:0.88rem;color:#475569;line-height:1.45;">
            ${mensajeDispositivo}
          </p>

          <div style="display:flex;flex-direction:column;gap:10px;">
            <button type="button" onclick="abrirPdfGeneradoComprobante()" style="background:linear-gradient(135deg, #16a34a 0%, #15803d 100%);color:#ffffff;border:none;border-radius:50px;padding:12px 24px;font-size:0.96rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 6px 20px rgba(22,163,74,0.40);transition:all 0.2s ease;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              <span>Abrir</span>
            </button>

            <button type="button" onclick="cerrarModalAvisoDescargaPdf()" style="background:#f1f5f9;color:#475569;border:1px solid #cbd5e1;border-radius:50px;padding:9px 18px;font-size:0.86rem;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all 0.2s ease;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              <span>Cerrar</span>
            </button>
          </div>

        </div>
      </div>
    `;

    modal.style.display = 'block';
  }

  function asegurarModalProgresoEnDOM() {
    let modal = document.getElementById('modal-progreso-descarga-pdf');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'modal-progreso-descarga-pdf';
    modal.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(4,26,11,0.76);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:9999999;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;';

    modal.innerHTML = `
      <div class="card-progreso-pdf" style="background:#ffffff;border:2px solid #16a34a;border-radius:18px;max-width:440px;width:100%;box-shadow:0 24px 60px rgba(0,0,0,0.40);padding:26px 24px;text-align:center;box-sizing:border-box;animation:zoomInAvisoPdf 0.22s ease-out;position:relative;">
        
        <!-- Icono animado vectorial exclusivo sin emojis -->
        <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg, #16a34a 0%, #15803d 100%);color:#ffffff;display:inline-flex;align-items:center;justify-content:center;margin:0 auto 14px auto;box-shadow:0 8px 22px rgba(22,163,74,0.38);animation:pulseProgresoIcon 1.6s ease-in-out infinite;">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.3">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 18 15 15"/>
          </svg>
        </div>

        <h3 id="progreso-pdf-titulo" style="margin:0 0 6px 0;font-size:1.20rem;font-weight:900;color:#063c17;letter-spacing:-0.2px;">
          Generando Ficha Oficial
        </h3>

        <p id="progreso-pdf-mensaje" style="margin:0 0 18px 0;font-size:0.88rem;color:#475569;line-height:1.45;min-height:36px;display:flex;align-items:center;justify-content:center;">
          Iniciando preparación del documento...
        </p>

        <!-- Barra de progreso con gradiente continuo y efecto shimmer -->
        <div style="background:#e2e8f0;border-radius:50px;height:12px;overflow:hidden;position:relative;margin-bottom:12px;box-shadow:inset 0 1px 3px rgba(0,0,0,0.12);border:1px solid #cbd5e1;">
          <div id="progreso-pdf-barra" style="height:100%;width:10%;background:linear-gradient(90deg, #16a34a 0%, #22c55e 50%, #15803d 100%);background-size:200% 100%;border-radius:50px;transition:width 0.28s ease-out;animation:shimmerBar 2s linear infinite;"></div>
        </div>

        <!-- Fila inferior: Estado del paso y porcentaje numérico -->
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.84rem;font-weight:800;color:#166534;padding:0 2px;">
          <span id="progreso-pdf-paso" style="color:#64748b;font-weight:700;font-size:0.80rem;display:inline-flex;align-items:center;gap:5px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>Paso 1 de 4</span>
          </span>
          <span id="progreso-pdf-pct" style="font-size:1.15rem;font-weight:900;color:#15803d;font-family:monospace;letter-spacing:0.5px;">10%</span>
        </div>

        <div style="margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9;font-size:0.75rem;color:#94a3b8;font-weight:600;">
          Centro de Educación Alternativa "Madre Marie Poussepín" • Gestión 2026
        </div>

      </div>
    `;

    document.body.appendChild(modal);
    return modal;
  }

  const ProgresoPDF = {
    _pctActual: 0,
    _timerTicker: null,

    iniciar(titulo, mensajeInicial) {
      this._pctActual = 12;
      this._limpiarTicker();
      asegurarEstilosAnimacionComprobante();
      const modal = asegurarModalProgresoEnDOM();
      if (!modal) return;

      const elTit = document.getElementById('progreso-pdf-titulo');
      const elMsg = document.getElementById('progreso-pdf-mensaje');
      const elBar = document.getElementById('progreso-pdf-barra');
      const elPct = document.getElementById('progreso-pdf-pct');
      const elPaso = document.getElementById('progreso-pdf-paso');

      if (elTit) elTit.textContent = titulo || 'Generando Ficha Oficial';
      if (elMsg) elMsg.textContent = mensajeInicial || 'Iniciando proceso...';
      if (elPaso) {
        const span = elPaso.querySelector('span') || elPaso;
        span.textContent = 'Paso 1 de 4';
      }
      if (elBar) elBar.style.width = '12%';
      if (elPct) elPct.textContent = '12%';

      modal.style.display = 'flex';
    },

    actualizar(porcentaje, mensaje, pasoTexto) {
      const p = Math.min(100, Math.max(0, Math.round(porcentaje)));
      this._pctActual = p;
      const elMsg = document.getElementById('progreso-pdf-mensaje');
      const elBar = document.getElementById('progreso-pdf-barra');
      const elPct = document.getElementById('progreso-pdf-pct');
      const elPaso = document.getElementById('progreso-pdf-paso');

      if (elMsg && mensaje) elMsg.textContent = mensaje;
      if (elPaso && pasoTexto) {
        const span = elPaso.querySelector('span') || elPaso;
        span.textContent = pasoTexto;
      }
      if (elBar) elBar.style.width = `${p}%`;
      if (elPct) elPct.textContent = `${p}%`;
    },

    iniciarTickerIntermedio(minPct = 65, maxPct = 88, intervalMs = 220) {
      this._limpiarTicker();
      this._timerTicker = setInterval(() => {
        if (this._pctActual >= minPct && this._pctActual < maxPct) {
          this._pctActual += 2;
          const elBar = document.getElementById('progreso-pdf-barra');
          const elPct = document.getElementById('progreso-pdf-pct');
          if (elBar) elBar.style.width = `${this._pctActual}%`;
          if (elPct) elPct.textContent = `${this._pctActual}%`;
        }
      }, intervalMs);
    },

    _limpiarTicker() {
      if (this._timerTicker) {
        clearInterval(this._timerTicker);
        this._timerTicker = null;
      }
    },

    obtenerPctActual() {
      return this._pctActual;
    },

    cerrar() {
      this._limpiarTicker();
      const modal = document.getElementById('modal-progreso-descarga-pdf');
      if (modal) modal.style.display = 'none';
    }
  };

  async function construirBlobComprobantePDF(data, autoDownload = false, onProgress = null) {
    if (!data) return null;
    if (data._pdfBlob && data._pdfFilename) {
      if (autoDownload) {
        descargarBlobArchivoPDF(data._pdfBlob, data._pdfFilename);
      }
      return { blob: data._pdfBlob, filename: data._pdfFilename };
    }

    if (data._pdfGeneratingPromise) {
      if (onProgress) {
        onProgress(45, 'Renderizando documento oficial...', 'Paso 2 de 4');
        ProgresoPDF.iniciarTickerIntermedio(45, 88, 200);
      }
      const res = await data._pdfGeneratingPromise;
      if (autoDownload && res && res.blob) {
        descargarBlobArchivoPDF(res.blob, res.filename);
      }
      return res;
    }

    data._pdfGeneratingPromise = (async () => {
      asegurarEstilosAnimacionComprobante();
      if (onProgress) onProgress(20, 'Cargando motor de generación PDF...', 'Paso 1 de 4');
      await asegurarHtml2PdfCargado();

      if (onProgress) onProgress(35, 'Estructurando datos oficiales y códigos SIE...', 'Paso 2 de 4');
      const { codigoReg, fechaHoy, directorNom, nombreArchivo } = obtenerMetadatosFicha(data);
      const fichaHtml = generarHtmlFichaOficial(data, codigoReg, fechaHoy, directorNom);

      // Contenedor temporal exacto para formato Carta (702px x 970px) con borde verde hasta abajo
      const outerWrap = document.createElement('div');
      outerWrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:702px;height:970px;z-index:-99999;background:#ffffff;overflow:hidden;';
      const targetEl = document.createElement('div');
      targetEl.style.cssText = 'width:702px;height:970px;background:#ffffff;margin:0;padding:0;box-sizing:border-box;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:geometricPrecision;';
      targetEl.innerHTML = fichaHtml;
      outerWrap.appendChild(targetEl);
      document.body.appendChild(outerWrap);

      try {
        if (onProgress) onProgress(50, 'Optimizando sellos institucionales y códigos SIE...', 'Paso 2 de 4');
        await convertirImagenesComprobanteABase64(targetEl);
        await new Promise(r => setTimeout(r, 40));

        if (onProgress) {
          onProgress(68, 'Renderizando documento en alta definición (Formato Carta)...', 'Paso 3 de 4');
          ProgresoPDF.iniciarTickerIntermedio(68, 88, 180);
        }

        const esMovil = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 768);
        const canvasScale = esMovil ? 2.8 : 3.0;

        const opt = {
          margin: [10, 20, 10, 10], // [Superior: 10mm (1cm), Izquierdo: 20mm (2cm), Inferior: 10mm (1cm), Derecho: 10mm (1cm)]
          filename: nombreArchivo,
          image: { type: 'jpeg', quality: 1.0 },
          html2canvas: {
            scale: canvasScale, // Alta Definición nítido sin pixelación y óptimo en velocidad móvil
            letterRendering: true,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            scrollX: 0,
            scrollY: 0,
            logging: false
          },
          jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait', compress: true },
          pagebreak: { mode: ['avoid-all'] }
        };

        const worker = window.html2pdf().set(opt).from(targetEl);

        let blob = null;
        try {
          if (onProgress) onProgress(89, 'Compilando archivo PDF oficial...', 'Paso 4 de 4');
          const pdf = await worker.toPdf().get('pdf');
          if (pdf && typeof pdf.output === 'function') {
            blob = pdf.output('blob');
          }
        } catch (errBlob) {
          console.warn('Extrayendo blob de html2pdf:', errBlob);
        }

        if (blob) {
          data._pdfBlob = blob;
          data._pdfFilename = nombreArchivo;
        }

        if (autoDownload && blob) {
          descargarBlobArchivoPDF(blob, nombreArchivo);
        }

        return { blob, filename: nombreArchivo };
      } finally {
        if (outerWrap && outerWrap.parentNode) {
          outerWrap.parentNode.removeChild(outerWrap);
        }
        data._pdfGeneratingPromise = null;
      }
    })();

    return data._pdfGeneratingPromise;
  }

  function pregenerarComprobantePDF(dataOverride) {
    const data = dataOverride || window._ultimoRegistroInscripcion;
    if (!data) return;
    construirBlobComprobantePDF(data, false).catch((err) => {
      console.warn('Pre-generación de PDF en segundo plano:', err);
    });
  }

  async function descargarComprobanteDirectoPDF(dataOverride) {
    const data = dataOverride || window._ultimoRegistroInscripcion;
    if (!data) {
      if (typeof mostrarAlertaModal === 'function') {
        mostrarAlertaModal('No hay un registro de pre-inscripción seleccionado para descargar la ficha.', 'Descarga de Comprobante', 'warning');
      } else if (typeof mostrarToastLive === 'function') {
        mostrarToastLive('No hay un registro de pre-inscripción seleccionado.');
      }
      return;
    }

    // 1. REACCIÓN INMEDIATA EN LA INTERFAZ (0ms):
    // El usuario percibe al instante que su clic funcionó
    asegurarEstilosAnimacionComprobante();
    const btns = document.querySelectorAll('.btn-voucher-pdf');
    btns.forEach(b => {
      if (!b.dataset.origHtml) b.dataset.origHtml = b.innerHTML;
      b.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spinVoucherBtn 0.8s linear infinite;flex-shrink:0;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
        </svg>
        <span>Procesando descarga...</span>
      `;
      b.style.pointerEvents = 'none';
      b.style.opacity = '0.85';
    });

    const restaurarBotones = () => {
      btns.forEach(b => {
        if (b.dataset.origHtml) {
          b.innerHTML = b.dataset.origHtml;
          delete b.dataset.origHtml;
        }
        b.style.pointerEvents = '';
        b.style.opacity = '';
      });
    };

    // CASO A: El PDF ya está listo en memoria (pre-generado) -> Animación fluida instantánea y descarga inmediata
    if (data._pdfBlob && data._pdfFilename) {
      ProgresoPDF.iniciar('Descargando Ficha Oficial', 'Verificando archivo PDF generado...');
      ProgresoPDF.actualizar(35, 'Documento verificado con éxito...', 'Paso 1 de 2');
      setTimeout(() => {
        ProgresoPDF.actualizar(80, 'Iniciando descarga en tu dispositivo...', 'Paso 2 de 2');
        setTimeout(() => {
          ProgresoPDF.actualizar(100, '¡Documento listo! Descargando archivo...', 'Paso 2 de 2');
          // DESCARGA EN EL PRIMER CLIC GARANTIZADA
          descargarBlobArchivoPDF(data._pdfBlob, data._pdfFilename);
          restaurarBotones();
          setTimeout(() => {
            ProgresoPDF.cerrar();
            mostrarModalAvisoDescargaPdf(data._pdfFilename, data._pdfBlob);
          }, 350);
        }, 140);
      }, 100);
      return;
    }

    // CASO B: Generación en progreso o primera vez -> Barra interactiva con pasos y porcentaje en vivo
    ProgresoPDF.iniciar('Generando Ficha Oficial de Pre-Inscripción', 'Iniciando preparación del documento...');
    ProgresoPDF.actualizar(15, 'Preparando datos oficiales y validaciones...', 'Paso 1 de 4');

    try {
      const result = await construirBlobComprobantePDF(data, false, (progreso, mensaje, paso) => {
        ProgresoPDF.actualizar(progreso, mensaje, paso);
      });

      if (result && result.blob) {
        ProgresoPDF.actualizar(100, '¡Documento listo! Descargando archivo...', 'Paso 4 de 4');
        // DESCARGA EN EL PRIMER CLIC GARANTIZADA DIRECTA VÍA BLOB
        descargarBlobArchivoPDF(result.blob, result.filename);
        restaurarBotones();
        setTimeout(() => {
          ProgresoPDF.cerrar();
          mostrarModalAvisoDescargaPdf(result.filename, result.blob);
        }, 400);
      } else {
        throw new Error('No se generó el blob del PDF.');
      }
    } catch (err) {
      console.error('Error generando y descargando PDF directo:', err);
      ProgresoPDF.cerrar();
      restaurarBotones();
      if (typeof mostrarAlertaModal === 'function') {
        mostrarAlertaModal('Hubo un inconveniente al generar el archivo PDF. Por favor, intenta nuevamente.', 'Descarga de Ficha', 'error');
      } else if (typeof mostrarToastLive === 'function') {
        mostrarToastLive('Error al generar la ficha en PDF.');
      }
    }
  }

  // Exportar al ámbito global
  window.pregenerarComprobantePDF = pregenerarComprobantePDF;
  window.descargarComprobanteDirectoPDF = descargarComprobanteDirectoPDF;
  window.imprimirComprobante = descargarComprobanteDirectoPDF;
  window.descargarComprobanteInscripcionPDF = descargarComprobanteDirectoPDF;
  window.aplicarOrientacionComprobante = aplicarOrientacionComprobante;
  window.abrirPdfGeneradoComprobante = abrirPdfGeneradoComprobante;
  window.cerrarModalAvisoDescargaPdf = cerrarModalAvisoDescargaPdf;
})();
