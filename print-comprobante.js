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

  function generarHtmlFichaOficial(data, codigoReg, fechaHoy, directorNom) {
    const edadNum = data.edad || (data.fechaNacimiento && typeof calcularEdad === 'function' ? calcularEdad(data.fechaNacimiento) : null);
    const edadStr = (edadNum !== null && !isNaN(edadNum) && edadNum > 0) ? `(<strong>${edadNum} años cumplidos</strong>)` : '';
    const fechaNacTexto = `${formatearSoloFechaNacimiento(data.fechaNacimiento)} ${edadStr}`.trim();
    let baseOriginUrl = 'https://ceachulumani-creator.github.io/Cea-Madre-Marie-Pousseppin-/';
    if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.startsWith('http')) {
      baseOriginUrl = window.location.origin + window.location.pathname;
    }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=85x85&data=${encodeURIComponent(baseOriginUrl + '?ci=' + (data.ci || '') + '&reg=' + codigoReg)}`;

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
      <div class="comprobante-ficha-letter" style="font-family:Arial, Helvetica, sans-serif; width:702px; max-width:702px; height:945px; max-height:945px; min-height:945px; margin:0 auto; padding:10px 14px; border:1.8px solid #166534; border-radius:6px; color:#0f172a; background:#ffffff; box-sizing:border-box; overflow:hidden; page-break-inside:avoid; display:flex; flex-direction:column; justify-content:space-between;">
        
        <!-- ENCABEZADO INSTITUCIONAL OFICIAL -->
        <div style="border-bottom:2px solid #166534; padding-bottom:5px; margin-bottom:5px; flex:0 0 auto;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <img src="logo cea madre marie poussepin.png" alt="Logo CEA" crossorigin="anonymous" style="width:55px; height:auto; max-height:55px;" />
            <div style="flex:1; padding:0 10px; line-height:1.15; text-align:center;">
              <div style="font-size:7.2pt; font-weight:800; letter-spacing:0.5px; color:#1e293b; text-transform:uppercase; margin:0;">Estado Plurinacional de Bolivia • Ministerio de Educación</div>
              <div style="font-size:6.8pt; font-weight:700; color:#475569; margin:1px 0 0 0;">Viceministerio de Educación Alternativa y Especial • DDE La Paz • DDE Chulumani</div>
              <h2 style="margin:2px 0 1px; font-size:1.18rem; font-weight:900; color:#166534; letter-spacing:0.5px;">CEA MADRE MARIE POUSSEPÍN</h2>
              <div style="font-size:6.8pt; color:#64748b; margin:0; font-weight:600;">R.A. 176/2013 • Código SIE: 80630044 • Chulumani, Sud Yungas, La Paz - Bolivia</div>
            </div>
            <div style="text-align:right;">
              <span style="display:inline-block; padding:4px 9px; background:#dcfce7; border:1.4px solid #16a34a; border-radius:5px; font-weight:900; font-size:8pt; color:#166534;">GESTIÓN ${data.gestion || '2026'}</span>
              <div style="margin-top:3px; font-size:7.2pt; color:#64748b; font-weight:700;">FOLIO REGISTRO:</div>
              <div style="font-size:8.5pt; font-weight:900; color:#0f172a; letter-spacing:0.5px;">${codigoReg}</div>
            </div>
          </div>
          <div style="text-align:center; margin-top:4px; background:#f0fdf4; padding:3px 6px; border-radius:4px; border:1px solid #bbf7d0;">
            <h3 style="margin:0; font-size:0.92rem; font-weight:900; text-transform:uppercase; letter-spacing:0.6px; color:#166534;">FORMULARIO OFICIAL DE PRE-INSCRIPCIÓN Y REGISTRO ÚNICO DE MATRÍCULA</h3>
            <span style="font-size:6.6pt; color:#475569; font-weight:600;">Documento válido para ratificación presencial de matrícula en Secretaría Académica • Emisión: ${fechaHoy}</span>
          </div>
        </div>

        <!-- CUERPO PRINCIPAL DEL FORMULARIO -->
        <div style="flex:1 1 auto; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
          
          <!-- TABLA 1: DATOS PERSONALES DEL PARTICIPANTE -->
          <table style="width:100%; border-collapse:collapse; font-size:7.8pt; border:1px solid #cbd5e1;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th colspan="4" style="padding:4px 8px; text-align:left; font-size:7.4pt; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1; font-weight:900;">
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

          <!-- TABLA 2: ASIGNACIÓN ACADÉMICA Y CARRERA -->
          <table style="width:100%; border-collapse:collapse; font-size:7.8pt; border:1px solid #cbd5e1;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th colspan="4" style="padding:4px 8px; text-align:left; font-size:7.4pt; color:#0f172a; text-transform:uppercase; border-bottom:1px solid #cbd5e1; font-weight:900;">
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
                  <span style="font-size:7pt; font-weight:600; color:#92400e;">Causal declarada: ${data.casoExcepcional || 'Caso Excepcional'}${data.detalleExcepcion ? ` (${data.detalleExcepcion})` : ''}</span>
                </td>
              </tr>` : `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Modalidad Matrícula:</td>
                <td style="padding:4px 8px; font-weight:700; color:#166534;" colspan="3">Inscripción Regular Oficial (Cumple con los requisitos establecidos)</td>
              </tr>`}
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:4px 8px; font-weight:700; background:#f8fafc;">Observaciones:</td>
                <td style="padding:4px 8px; font-size:7.4pt; color:#475569;" colspan="3">${data.observaciones || 'Sin observaciones adicionales registradas.'}</td>
              </tr>
            </tbody>
          </table>

          <!-- SECCIÓN 3: REQUISITOS Y DOCUMENTACIÓN DE RESPALDO (REGISTRO DE COTEJO ESPECÍFICO) -->
          <div style="border:1px solid #cbd5e1; border-radius:5px; padding:6px 10px; background:#f8fafc; font-size:7.3pt; line-height:1.35;">
            <strong style="color:#0f172a; display:block; margin-bottom:4px; text-transform:uppercase; font-size:7.3pt; border-bottom:1px solid #cbd5e1; padding-bottom:2px;">
              ${tituloCotejo}
            </strong>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; color:#334155;">
              ${docItems.map((doc, idx) => `<div>[ &nbsp; ] ${idx + 1}. ${doc}</div>`).join('')}
            </div>
          </div>

          <!-- SECCIÓN 4: DECLARACIÓN JURADA Y COMPROMISO DEL PARTICIPANTE -->
          <div style="border:1px solid #cbd5e1; border-radius:5px; padding:6px 10px; background:#ffffff; font-size:6.9pt; line-height:1.35; color:#334155;">
            <strong style="color:#0f172a; text-transform:uppercase; font-size:7.1pt; display:block; margin-bottom:2px;">
              4. DECLARACIÓN JURADA Y COMPROMISO INSTITUCIONAL:
            </strong>
            Yo, en mi calidad de participante, declaro bajo juramento que los datos e información consignados en este formulario son fidedignos y verídicos. Me comprometo a presentar toda la documentación original ante Secretaría Académica para el cotejo correspondiente, así como a respetar y cumplir fielmente el Estatuto Orgánico, el Reglamento Interno del Centro de Educación Alternativa "Madre Marie Poussepin", las disposiciones de la Dirección Distrital y la Ley de Educación N° 070 "Avelino Siñani - Elizardo Pérez".
          </div>

          <!-- SECCIÓN 5: CONTROL DE RECEPCIÓN Y QR DE VALIDACIÓN DIGITAL -->
          <div style="display:grid; grid-template-columns:1fr 90px; gap:10px; align-items:center; border:1px solid #cbd5e1; border-radius:5px; padding:6px 10px; background:#f8fafc;">
            <div style="font-size:7.0pt; line-height:1.4; color:#334155;">
              <strong style="color:#0f172a; text-transform:uppercase; display:block; margin-bottom:2px; font-size:7.2pt;">
                5. CONTROL DE RECEPCIÓN Y OBSERVACIONES DE KARDEX:
              </strong>
              <div>• Fecha límite de ratificación y entrega de carpetas: <strong>Hasta 5 días hábiles posteriores a la preinscripción</strong>.</div>
              <div>• Observaciones de Kardex: ____________________________________________________________________________</div>
              <div style="margin-top:2px;">• Código Único de Registro Electrónico: <strong style="font-family:monospace; font-size:7.5pt; color:#166534;">CEA-${codigoReg}-${new Date().getFullYear()}</strong></div>
            </div>
            <div style="text-align:center;">
              <img src="${qrUrl}" alt="QR Verificación" crossorigin="anonymous" style="width:72px; height:72px; border:1px solid #cbd5e1; padding:2px; border-radius:4px; display:inline-block; background:#ffffff;" />
              <span style="display:block; font-size:5.8pt; color:#64748b; margin-top:2px; font-weight:800; text-transform:uppercase;">Validación Digital</span>
            </div>
          </div>

        </div>

        <!-- SECCIÓN 6: CONFORMIDAD Y FIRMA EXCLUSIVA DEL PARTICIPANTE -->
        <div style="display:flex; justify-content:center; align-items:center; padding-top:30px; margin-top:10px; flex:0 0 auto;">
          <div style="width:280px; text-align:center; border-top:1.8px solid #334155; padding-top:5px;">
            <strong style="font-size:8.2pt; display:block; color:#0f172a; text-transform:uppercase; letter-spacing:0.4px;">Firma del Participante</strong>
            <span style="font-size:7.2pt; color:#475569; display:block; font-weight:600; margin-top:2px;">C.I.: ${data.ci || '_____________________'}</span>
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
      return Promise.resolve(window.html2pdf);
    }
    if (_html2pdfLoadPromise) return _html2pdfLoadPromise;
    _html2pdfLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.async = true;
      script.onload = () => resolve(window.html2pdf);
      script.onerror = (err) => {
        _html2pdfLoadPromise = null;
        reject(err);
      };
      document.head.appendChild(script);
    });
    return _html2pdfLoadPromise;
  }

  async function convertirImagenesComprobanteABase64(container) {
    const imgs = Array.from(container.querySelectorAll('img'));
    await Promise.all(imgs.map(async (img) => {
      const src = img.getAttribute('src') || img.src;
      if (!src || src.startsWith('data:')) return;

      // 1. Intentar vía fetch + FileReader (ideal para QR con CORS y assets locales en servidor)
      try {
        const res = await fetch(src, { mode: 'cors', cache: 'force-cache' });
        if (res.ok) {
          const blob = await res.blob();
          const dataUrl = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) {
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
              img.src = dataUrl;
              if (img.complete) resolve();
            });
            return;
          }
        }
      } catch (e) {}

      // 2. Respaldo vía Canvas Image
      await new Promise((resolve) => {
        const tempImg = new Image();
        tempImg.crossOrigin = 'anonymous';
        tempImg.onload = () => {
          try {
            const cvs = document.createElement('canvas');
            cvs.width = tempImg.naturalWidth || tempImg.width || 160;
            cvs.height = tempImg.naturalHeight || tempImg.height || 160;
            const ctx = cvs.getContext('2d');
            ctx.drawImage(tempImg, 0, 0);
            img.src = cvs.toDataURL('image/png');
          } catch (e) {}
          resolve();
        };
        tempImg.onerror = () => resolve();
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
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename || 'Ficha_Inscripcion_CEA_2026.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (e) {}
    }, 4000);
  }

  async function construirBlobComprobantePDF(data) {
    if (!data) return null;
    if (data._pdfBlob && data._pdfFilename) {
      return { blob: data._pdfBlob, filename: data._pdfFilename };
    }
    if (data._pdfGeneratingPromise) {
      return data._pdfGeneratingPromise;
    }

    data._pdfGeneratingPromise = (async () => {
      await asegurarHtml2PdfCargado();
      const { codigoReg, fechaHoy, directorNom, nombreArchivo } = obtenerMetadatosFicha(data);
      const fichaHtml = generarHtmlFichaOficial(data, codigoReg, fechaHoy, directorNom);

      // Crear contenedor invisible en dimensiones exactas de hoja Carta (702px × 945px = 185.9mm × 250mm)
      // para que tanto en celular como en PC el PDF se genere idéntico y en 1 sola página
      const outerWrap = document.createElement('div');
      outerWrap.style.cssText = 'position:fixed;left:0;top:0;width:702px;height:945px;z-index:-9999;opacity:0.01;pointer-events:none;overflow:hidden;background:#ffffff;';
      const targetEl = document.createElement('div');
      targetEl.style.cssText = 'width:702px;height:945px;background:#ffffff;margin:0;padding:0;box-sizing:border-box;';
      targetEl.innerHTML = fichaHtml;
      outerWrap.appendChild(targetEl);
      document.body.appendChild(outerWrap);

      try {
        await convertirImagenesComprobanteABase64(targetEl);
        await new Promise(r => setTimeout(r, 80));

        const opt = {
          margin: [10, 10, 10, 20], // 1cm arriba, 1cm derecha, 1cm abajo, 2cm izquierda
          filename: nombreArchivo,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 702,
            height: 945,
            windowWidth: 1024,
            scrollX: 0,
            scrollY: 0,
            logging: false
          },
          jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait', compress: true }
        };

        const worker = window.html2pdf().set(opt).from(targetEl).toPdf();
        const pdf = await worker.get('pdf');
        while (pdf.internal.getNumberOfPages() > 1) {
          pdf.deletePage(pdf.internal.getNumberOfPages());
        }
        const blob = pdf.output('blob');
        data._pdfBlob = blob;
        data._pdfFilename = nombreArchivo;
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
    construirBlobComprobantePDF(data).catch((err) => {
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

    // Si ya fue pre-generado al enviar la inscripción, descargarlo de inmediato al hacer clic
    if (data._pdfBlob && data._pdfFilename) {
      descargarBlobArchivoPDF(data._pdfBlob, data._pdfFilename);
      if (typeof mostrarToastLive === 'function') {
        mostrarToastLive('¡Ficha Oficial de Inscripción descargada en PDF!');
      }
      return;
    }

    if (typeof mostrarToastLive === 'function') {
      mostrarToastLive('Descargando Ficha Oficial de Inscripción en PDF...');
    }

    try {
      const result = await construirBlobComprobantePDF(data);
      if (result && result.blob) {
        descargarBlobArchivoPDF(result.blob, result.filename);
        if (typeof mostrarToastLive === 'function') {
          mostrarToastLive('¡Ficha Oficial de Inscripción descargada en PDF!');
        }
        return;
      }
    } catch (err) {
      console.error('Error generando PDF directo, usando respaldo:', err);
    }

    // Respaldo de emergencia solo si fallara la librería PDF
    const { codigoReg, fechaHoy, directorNom } = obtenerMetadatosFicha(data);
    const fichaHtml = generarHtmlFichaOficial(data, codigoReg, fechaHoy, directorNom);
    imprimirDocumentoComprobanteAislado(fichaHtml, `Ficha_Preinscripcion_${data.ci || 'CEA'}`);
  }

  // Exportar al ámbito global
  window.pregenerarComprobantePDF = pregenerarComprobantePDF;
  window.imprimirComprobante = descargarComprobanteDirectoPDF;
  window.descargarComprobanteInscripcionPDF = descargarComprobanteDirectoPDF;
  window.aplicarOrientacionComprobante = aplicarOrientacionComprobante;
})();
