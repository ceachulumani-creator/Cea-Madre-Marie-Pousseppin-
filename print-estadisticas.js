/* ==========================================================================
   MÓDULO EXCLUSIVO Y AUTÓNOMO: REPORTE ESTADÍSTICO INSTITUCIONAL (1 SOLA HOJA)
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN ACADÉMICA 2026
   Garantía de impresión: 1 SOLA HOJA COMPLETA EXACTA (Single Page Executive Report)
   ========================================================================== */

(function () {
  'use strict';

  function aplicarOrientacionEstadisticas() {
    let styleTag = document.getElementById('cea-dynamic-page-orientation');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cea-dynamic-page-orientation';
      document.head.appendChild(styleTag);
    }
    styleTag.innerHTML = `
      @page {
        size: letter portrait !important;
        margin: 8mm 10mm 8mm 20mm !important;
      }
      @page :first {
        margin: 8mm 10mm 8mm 20mm !important;
      }
      @media print {
        #reporte-inscritos-print-area .tabla-cuadro-oficial td,
        #reporte-estadistico-print-area .tabla-cuadro-oficial td {
          padding-top: 4.8px !important;
          padding-bottom: 4.8px !important;
          padding-left: 7px !important;
          padding-right: 7px !important;
          font-size: 8pt !important;
          line-height: 1.25 !important;
          vertical-align: middle !important;
        }
        #reporte-inscritos-print-area .tabla-cuadro-oficial th,
        #reporte-estadistico-print-area .tabla-cuadro-oficial th {
          padding-top: 4.8px !important;
          padding-bottom: 4.8px !important;
          font-size: 8pt !important;
          vertical-align: middle !important;
        }
        #reporte-inscritos-print-area .tabla-cuadro-oficial tr,
        #reporte-estadistico-print-area .tabla-cuadro-oficial tr {
          height: auto !important;
        }
      }
    `;
    document.body.classList.add('print-orientation-portrait', 'printing-reporte', 'printing-estadisticas-1hoja', 'printing-solo-estadisticas');
    document.body.classList.remove('print-orientation-landscape', 'print-turno-hum', 'print-turno-tec', 'printing-kardex', 'printing-horario', 'printing-comprobante');
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function calcularEdadItem(item) {
    if (!item) return null;
    if (item.edad !== undefined && item.edad !== null && item.edad !== '') {
      const e = parseInt(item.edad, 10);
      if (!isNaN(e) && e >= 10 && e <= 99) return e;
    }
    const fnac = item.fechaNacimiento || item.fecha_nacimiento || item.nacimiento || item.fechanac;
    if (fnac) {
      if (typeof window.calcularEdad === 'function') {
        const c = window.calcularEdad(fnac);
        if (c !== null && !isNaN(c) && c >= 10 && c <= 99) return c;
      }
      const partes = String(fnac).split('-');
      if (partes.length === 3) {
        const y = parseInt(partes[0], 10);
        const m = parseInt(partes[1], 10) - 1;
        const d = parseInt(partes[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          const hoy = new Date();
          let edad = hoy.getFullYear() - y;
          const diffM = hoy.getMonth() - m;
          if (diffM < 0 || (diffM === 0 && hoy.getDate() < d)) edad--;
          if (edad >= 10 && edad <= 99) return edad;
        }
      }
    }
    return null;
  }

  function calcularPromedioEdad(lista) {
    if (!lista || !lista.length) return '—';
    let suma = 0;
    let count = 0;
    lista.forEach(item => {
      const e = calcularEdadItem(item);
      if (e !== null) {
        suma += e;
        count++;
      }
    });
    if (count === 0) return '—';
    const prom = suma / count;
    const promStr = (prom % 1 === 0) ? prom.toFixed(0) : prom.toFixed(1);
    return `${promStr} años`;
  }

  function imprimirReporteEstadisticoUnaHoja(areaFiltro = 'todas', incluirGraficos = true) {
    if (typeof cerrarModalOpcionesImpresion === 'function') cerrarModalOpcionesImpresion();
    if (typeof cerrarDashboardVisualInscripciones === 'function') cerrarDashboardVisualInscripciones();

    const ins = (typeof lsGet === 'function') ? lsGet('cea_inscripciones', []) : (JSON.parse(localStorage.getItem('cea_inscripciones') || '[]'));
    if (!ins.length) {
      if (typeof mostrarAlertaModal === 'function') {
        mostrarAlertaModal('No hay pre-inscripciones registradas actualmente para generar el reporte estadístico.', 'Reporte Estadístico', 'warning');
      } else if (typeof mostrarToastLive === 'function') {
        mostrarToastLive('No hay pre-inscripciones registradas actualmente.');
      }
      return;
    }

    aplicarOrientacionEstadisticas();

    // Obtener los contenedores de impresión (poblar ambos para máxima compatibilidad)
    let printArea1 = document.getElementById('reporte-inscritos-print-area');
    if (!printArea1) {
      printArea1 = document.createElement('div');
      printArea1.id = 'reporte-inscritos-print-area';
      document.body.appendChild(printArea1);
    }
    let printArea2 = document.getElementById('reporte-estadistico-print-area');
    if (!printArea2) {
      printArea2 = document.createElement('div');
      printArea2.id = 'reporte-estadistico-print-area';
      document.body.appendChild(printArea2);
    }

    const anio = new Date().getFullYear() || 2026;
    const fechaEmision = new Date().toLocaleString('es-BO', { dateStyle: 'full', timeStyle: 'short' });
    const t = (typeof lsGet === 'function') ? lsGet('cea_textos_director', {}) : {};
    const directorNom = t.director_nombre || 'Lic. José Luis Alanoca Mamani';

    // Agrupación cuantitativa de participantes
    const humanisticaEPA = [];
    const humanisticaESA = [];
    const tecnicaGrupos = {
      'Agropecuaria': [],
      'Sistemas Informáticos': [],
      'Gastronomía y Alimentación': [],
      'Belleza Integral': [],
      'Confección Textil': [],
      'Secretariado Ejecutivo': []
    };

    ins.forEach(item => {
      const area = (item.area || '').toLowerCase();
      const carrera = (item.carrera || '').toLowerCase();

      const esHum = area.includes('hum') || carrera.includes('aprendizajes') || carrera.includes('primaria') || 
                    carrera.includes('secundaria') || carrera.includes('epa') || carrera.includes('esa') || 
                    carrera.includes('elementales') || carrera.includes('avanzados') || carrera.includes('aplicados') || 
                    carrera.includes('complementarios') || carrera.includes('especializados') || carrera.includes('bth');

      if (esHum) {
        if (carrera.includes('elementales') || carrera.includes('avanzados') || carrera.includes('primaria') || carrera.includes('epa')) {
          humanisticaEPA.push(item);
        } else {
          humanisticaESA.push(item);
        }
      } else {
        if (carrera.includes('agropecuaria')) {
          tecnicaGrupos['Agropecuaria'].push(item);
        } else if (carrera.includes('sistemas') || carrera.includes('informát')) {
          tecnicaGrupos['Sistemas Informáticos'].push(item);
        } else if (carrera.includes('gastronom') || carrera.includes('cocina')) {
          tecnicaGrupos['Gastronomía y Alimentación'].push(item);
        } else if (carrera.includes('belleza') || carrera.includes('peinado')) {
          tecnicaGrupos['Belleza Integral'].push(item);
        } else if (carrera.includes('confeccion') || carrera.includes('confección') || carrera.includes('textil') || carrera.includes('corte')) {
          tecnicaGrupos['Confección Textil'].push(item);
        } else if (carrera.includes('secretariado')) {
          tecnicaGrupos['Secretariado Ejecutivo'].push(item);
        } else {
          tecnicaGrupos['Sistemas Informáticos'].push(item);
        }
      }
    });

    const totalHum = humanisticaEPA.length + humanisticaESA.length;
    let totalTec = 0;
    Object.values(tecnicaGrupos).forEach(arr => { totalTec += arr.length; });
    const totalGeneral = totalHum + totalTec;
    const totalMostrado = areaFiltro === 'tecnica' ? totalTec : (areaFiltro === 'humanistica' ? totalHum : totalGeneral);

    const pctTec = totalGeneral > 0 ? Math.round((totalTec / totalGeneral) * 100) : 0;
    const pctHum = totalGeneral > 0 ? Math.round((totalHum / totalGeneral) * 100) : 0;
    const pctEPA = totalHum > 0 ? Math.round((humanisticaEPA.length / totalHum) * 100) : 0;
    const pctESA = totalHum > 0 ? Math.round((humanisticaESA.length / totalHum) * 100) : 0;

    let subtituloReporte = `INFORME ESTADÍSTICO INSTITUCIONAL Y CUADRO DE MATRÍCULAS — GESTIÓN ACADÉMICA ${anio}`;
    if (areaFiltro === 'tecnica') {
      subtituloReporte = `INFORME ESTADÍSTICO OFICIAL: ÁREA TÉCNICA TECNOLÓGICA (ETTP) — GESTIÓN ${anio}`;
    } else if (areaFiltro === 'humanistica') {
      subtituloReporte = `INFORME ESTADÍSTICO OFICIAL: ÁREA HUMANÍSTICA (EPJA / BTH) — GESTIÓN ${anio}`;
    }

    // 1. Tarjetas de Indicadores Estratégicos (KPIs) de Alto Impacto
    let kpisHTML = '';
    if (areaFiltro === 'todas') {
      kpisHTML = `
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:10px;text-align:center;margin-bottom:12px">
          <div style="border:1.6px solid #0f4a1e;border-radius:6px;padding:7px 5px;background:#f0fdf4;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:18pt;font-weight:900;color:#0f4a1e;line-height:1">${totalGeneral}</span>
            <span style="font-size:7.2pt;color:#166534;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Total Pre-Inscritos</span>
            <span style="font-size:6.4pt;color:#475569">Matrícula Institucional</span>
          </div>
          <div style="border:1.6px solid #059669;border-radius:6px;padding:7px 5px;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:18pt;font-weight:900;color:#059669;line-height:1">${totalTec} <small style="font-size:9.5pt;font-weight:800">(${pctTec}%)</small></span>
            <span style="font-size:7.2pt;color:#059669;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Área Técnica (ETTP)</span>
            <span style="font-size:6.4pt;color:#475569">6 Carreras Habilitadas</span>
          </div>
          <div style="border:1.6px solid #1d4ed8;border-radius:6px;padding:7px 5px;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:18pt;font-weight:900;color:#1d4ed8;line-height:1">${totalHum} <small style="font-size:9.5pt;font-weight:800">(${pctHum}%)</small></span>
            <span style="font-size:7.2pt;color:#1d4ed8;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Área Humanística</span>
            <span style="font-size:6.4pt;color:#475569">Régimen EPJA y BTH</span>
          </div>
          <div style="border:1.6px solid #d97706;border-radius:6px;padding:7px 5px;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:18pt;font-weight:900;color:#d97706;line-height:1">${humanisticaEPA.length} / ${humanisticaESA.length}</span>
            <span style="font-size:7.2pt;color:#d97706;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Primaria / Secundaria</span>
            <span style="font-size:6.4pt;color:#475569">EPA (${pctEPA}%) | ESA (${pctESA}%)</span>
          </div>
        </div>
      `;
    } else if (areaFiltro === 'tecnica') {
      kpisHTML = `
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:8px">
          <div style="border:1.6px solid #0f4a1e;border-radius:6px;padding:8px 6px;background:#f0fdf4;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:20pt;font-weight:900;color:#0f4a1e;line-height:1">${totalTec}</span>
            <span style="font-size:7.6pt;color:#166534;font-weight:800;text-transform:uppercase;display:block;margin-top:3px">Total Postulantes Área Técnica</span>
            <span style="font-size:6.5pt;color:#475569">Matrícula Efectiva 2026</span>
          </div>
          <div style="border:1.6px solid #059669;border-radius:6px;padding:8px 6px;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:20pt;font-weight:900;color:#059669;line-height:1">6 Carreras</span>
            <span style="font-size:7.6pt;color:#059669;font-weight:800;text-transform:uppercase;display:block;margin-top:3px">Especialidades Productivas</span>
            <span style="font-size:6.5pt;color:#475569">Técnico Básico, Auxiliar y Medio</span>
          </div>
          <div style="border:1.6px solid #16a34a;border-radius:6px;padding:8px 6px;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:20pt;font-weight:900;color:#16a34a;line-height:1">${pctTec}%</span>
            <span style="font-size:7.6pt;color:#166534;font-weight:800;text-transform:uppercase;display:block;margin-top:3px">Proporción Demanda Global</span>
            <span style="font-size:6.5pt;color:#475569">Participación sobre Matrícula CEA</span>
          </div>
        </div>
      `;
    } else if (areaFiltro === 'humanistica') {
      kpisHTML = `
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;text-align:center;margin-bottom:8px">
          <div style="border:1.6px solid #1e40af;border-radius:6px;padding:8px 6px;background:#eff6ff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:20pt;font-weight:900;color:#1e40af;line-height:1">${totalHum}</span>
            <span style="font-size:7.6pt;color:#1e40af;font-weight:800;text-transform:uppercase;display:block;margin-top:3px">Total Postulantes Humanística</span>
            <span style="font-size:6.5pt;color:#475569">Régimen EPJA Acreditado</span>
          </div>
          <div style="border:1.6px solid #059669;border-radius:6px;padding:8px 6px;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:20pt;font-weight:900;color:#059669;line-height:1">${humanisticaEPA.length} <small style="font-size:10pt">(${pctEPA}%)</small></span>
            <span style="font-size:7.6pt;color:#059669;font-weight:800;text-transform:uppercase;display:block;margin-top:3px">Primaria de Adultos (EPA)</span>
            <span style="font-size:6.5pt;color:#475569">Aprendizajes Elementales y Avanzados</span>
          </div>
          <div style="border:1.6px solid #2563eb;border-radius:6px;padding:8px 6px;background:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:20pt;font-weight:900;color:#2563eb;line-height:1">${humanisticaESA.length} <small style="font-size:10pt">(${pctESA}%)</small></span>
            <span style="font-size:7.6pt;color:#2563eb;font-weight:800;text-transform:uppercase;display:block;margin-top:3px">Secundaria de Adultos (ESA)</span>
            <span style="font-size:6.5pt;color:#475569">Bachillerato Técnico Humanístico</span>
          </div>
        </div>
      `;
    }

    // 2. Gráficos de Distribución Comparativa (2 Columnas)
    let panelGraficosHTML = '';
    if (areaFiltro === 'todas') {
      panelGraficosHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px">
          <!-- Columna 1: Carreras Técnicas con Barras Visuales -->
          <div style="border:1.4px solid #cbd5e1;border-radius:6px;padding:8px 10px;background:#ffffff">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;background:#0f4a1e;color:#ffffff;padding:4px 8px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                <strong style="font-size:7.8pt;text-transform:uppercase">1. Área Técnica Tecnológica (ETTP)</strong>
                <span style="font-size:6.8pt;font-weight:800;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px">${totalTec} post.</span>
              </div>
              <table style="width:100%;font-size:7.3pt;border-collapse:collapse;margin:0">
                <tbody>
                  ${Object.entries(tecnicaGrupos).map(([nom, list]) => {
                    const p = totalTec > 0 ? Math.round((list.length / totalTec) * 100) : 0;
                    return `
                      <tr style="border-bottom:1px solid #f1f5f9">
                        <td style="padding:6px 3px;width:48%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                          <strong style="color:#0f172a">${escapeHTML(nom)}</strong>
                        </td>
                        <td style="padding:6px 3px;text-align:center;width:15%">
                          <strong style="color:#0f4a1e;font-size:7.8pt">${list.length}</strong>
                        </td>
                        <td style="padding:6px 3px;text-align:center;width:14%;color:#64748b;font-size:6.8pt">
                          ${p}%
                        </td>
                        <td style="padding:6px 3px;width:23%">
                          <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                            <div style="width:${p}%;height:100%;background:#16a34a;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                  <tr style="background:#f0fdf4;font-weight:900;color:#0f4a1e;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                    <td style="padding:4.5px 2px">SUBTOTAL TÉCNICA</td>
                    <td style="padding:4.5px 2px;text-align:center">${totalTec}</td>
                    <td style="padding:4.5px 2px;text-align:center">100%</td>
                    <td style="padding:4.5px 2px;text-align:center;font-size:6.6pt;color:#166534">6 Carreras</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Columna 2: Área Humanística y Proporción Global -->
          <div style="border:1.4px solid #cbd5e1;border-radius:6px;padding:8px 10px;background:#ffffff;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;background:#1e40af;color:#ffffff;padding:4px 8px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                <strong style="font-size:7.8pt;text-transform:uppercase">2. Área Humanística (EPJA / BTH)</strong>
                <span style="font-size:6.8pt;font-weight:800;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px">${totalHum} post.</span>
              </div>
              <table style="width:100%;font-size:7.4pt;border-collapse:collapse;margin:0">
                <tbody>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:7px 4px;width:48%">
                      <strong style="color:#0f172a;font-size:8.2pt;display:block">EPA Primaria de Adultos</strong>
                      <div style="font-size:6.6pt;color:#64748b">Elementales y Avanzados (1° a 6°)</div>
                    </td>
                    <td style="padding:7px 4px;text-align:center;width:15%">
                      <strong style="color:#1e40af;font-size:9.2pt">${humanisticaEPA.length}</strong>
                    </td>
                    <td style="padding:7px 4px;text-align:center;width:14%;color:#64748b;font-size:7pt">
                      ${pctEPA}%
                    </td>
                    <td style="padding:7px 4px;width:23%">
                      <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                        <div style="width:${pctEPA}%;height:100%;background:#059669;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                      </div>
                    </td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:7px 4px;width:48%">
                      <strong style="color:#0f172a;font-size:8.2pt;display:block">ESA Secundaria de Adultos</strong>
                      <div style="font-size:6.6pt;color:#64748b">Bachillerato Técnico Humanístico (BTH)</div>
                    </td>
                    <td style="padding:7px 4px;text-align:center;width:15%">
                      <strong style="color:#1e40af;font-size:9.2pt">${humanisticaESA.length}</strong>
                    </td>
                    <td style="padding:7px 4px;text-align:center;width:14%;color:#64748b;font-size:7pt">
                      ${pctESA}%
                    </td>
                    <td style="padding:7px 4px;width:23%">
                      <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                        <div style="width:${pctESA}%;height:100%;background:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                      </div>
                    </td>
                  </tr>
                  <tr style="background:#eff6ff;font-weight:900;color:#1e40af;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                    <td style="padding:5.5px 4px">SUBTOTAL HUMANÍSTICA</td>
                    <td style="padding:5.5px 4px;text-align:center">${totalHum}</td>
                    <td style="padding:5.5px 4px;text-align:center">100%</td>
                    <td style="padding:5.5px 4px;text-align:center;font-size:6.6pt;color:#1d4ed8">EPJA / BTH</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Proporción Global Técnica vs Humanística -->
            <div style="margin-top:6px;border-top:1px dashed #cbd5e1;padding-top:5px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                <span style="font-size:6.8pt;font-weight:700;color:#334155">Demanda Global Institucional:</span>
                <span style="font-size:6.8pt;color:#0f4a1e;font-weight:800">Téc: ${pctTec}% | Hum: ${pctHum}%</span>
              </div>
              <div style="display:flex;width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                <div style="width:${pctTec}%;height:100%;background:#16a34a" title="Técnica: ${pctTec}%"></div>
                <div style="width:${pctHum}%;height:100%;background:#2563eb" title="Humanística: ${pctHum}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else if (areaFiltro === 'tecnica') {
      let countBasico = 0, countAuxiliar = 0, countMedio = 0;
      ins.forEach(it => {
        const c = String((it.carrera || '') + ' ' + (it.nivel || '') + ' ' + (it.semestre || '')).toLowerCase();
        if (c.includes('medio') || c.includes('4to') || c.includes('3er y 4to')) countMedio++;
        else if (c.includes('auxiliar') || c.includes('3er') || c.includes('3ro')) countAuxiliar++;
        else countBasico++;
      });
      const pctBasico = totalTec > 0 ? Math.round((countBasico / totalTec) * 100) : 0;
      const pctAux = totalTec > 0 ? Math.round((countAuxiliar / totalTec) * 100) : 0;
      const pctMed = totalTec > 0 ? Math.round((countMedio / totalTec) * 100) : 0;

      panelGraficosHTML = `
        <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:10px;margin-bottom:8px">
          <!-- Columna 1: Desglose de las 6 Carreras Técnicas con Barras Visuales -->
          <div style="border:1.4px solid #cbd5e1;border-radius:6px;padding:8px 12px;background:#ffffff">
            <div style="display:flex;justify-content:space-between;align-items:center;background:#0f4a1e;color:#ffffff;padding:4px 8px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <strong style="font-size:7.8pt;text-transform:uppercase">Distribución por Carrera Técnica (ETTP)</strong>
              <span style="font-size:6.8pt;font-weight:800;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px">${totalTec} postulantes</span>
            </div>
            <table style="width:100%;font-size:7.2pt;border-collapse:collapse;margin:0">
              <tbody>
                ${Object.entries(tecnicaGrupos).map(([nom, list]) => {
                  const p = totalTec > 0 ? Math.round((list.length / totalTec) * 100) : 0;
                  return `
                    <tr style="border-bottom:1px solid #f1f5f9">
                      <td style="padding:4.5px 2px;width:46%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        <strong style="color:#0f172a">${escapeHTML(nom)}</strong>
                      </td>
                      <td style="padding:4.5px 2px;text-align:center;width:15%">
                        <strong style="color:#0f4a1e">${list.length}</strong>
                      </td>
                      <td style="padding:4.5px 2px;text-align:center;width:14%;color:#64748b;font-size:6.6pt">
                        ${p}%
                      </td>
                      <td style="padding:4.5px 2px;width:25%">
                        <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                          <div style="width:${p}%;height:100%;background:#16a34a;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
                <tr style="background:#f0fdf4;font-weight:900;color:#0f4a1e;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                  <td style="padding:5px 2px">TOTAL ÁREA TÉCNICA</td>
                  <td style="padding:5px 2px;text-align:center">${totalTec}</td>
                  <td style="padding:5px 2px;text-align:center">100%</td>
                  <td style="padding:5px 2px;text-align:center;font-size:6.5pt;color:#166534">6 Especialidades</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Columna 2: Niveles de Formación Técnica y Estadísticas -->
          <div style="border:1.4px solid #cbd5e1;border-radius:6px;padding:8px 12px;background:#ffffff;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;background:#15803d;color:#ffffff;padding:4px 8px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                <strong style="font-size:7.8pt;text-transform:uppercase">Niveles</strong>
                <span style="font-size:6.8pt;font-weight:800;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px">Técnico Básico, Auxiliar y Medio</span>
              </div>
              <table style="width:100%;font-size:7.4pt;border-collapse:collapse;margin:0">
                <tbody>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:6.5px 4px;width:48%">
                      <strong style="color:#0f172a;font-size:8pt;display:block">Técnico Básico</strong>
                      <div style="font-size:6.5pt;color:#64748b">1er y 2do Semestre</div>
                    </td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%"><strong style="color:#15803d;font-size:9.2pt">${countBasico}</strong></td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%;color:#64748b;font-size:7pt">${pctBasico}%</td>
                    <td style="padding:6.5px 4px;width:22%">
                      <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                        <div style="width:${pctBasico}%;height:100%;background:#15803d"></div>
                      </div>
                    </td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:6.5px 4px;width:48%">
                      <strong style="color:#0f172a;font-size:8pt;display:block">Técnico Auxiliar</strong>
                      <div style="font-size:6.5pt;color:#64748b">3er Semestre</div>
                    </td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%"><strong style="color:#15803d;font-size:9.2pt">${countAuxiliar}</strong></td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%;color:#64748b;font-size:7pt">${pctAux}%</td>
                    <td style="padding:6.5px 4px;width:22%">
                      <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                        <div style="width:${pctAux}%;height:100%;background:#22c55e"></div>
                      </div>
                    </td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:6.5px 4px;width:48%">
                      <strong style="color:#0f172a;font-size:8pt;display:block">Técnico Medio</strong>
                      <div style="font-size:6.5pt;color:#64748b">4to Semestre (Graduación)</div>
                    </td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%"><strong style="color:#15803d;font-size:9.2pt">${countMedio}</strong></td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%;color:#64748b;font-size:7pt">${pctMed}%</td>
                    <td style="padding:6.5px 4px;width:22%">
                      <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                        <div style="width:${pctMed}%;height:100%;background:#86efac"></div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="margin-top:6px;border-top:1px dashed #cbd5e1;padding-top:5px;font-size:6.8pt;color:#475569;line-height:1.4">
              <div>• Promedio general de edad técnica: <strong>${calcularPromedioEdad(Object.values(tecnicaGrupos).flat())}</strong></div>
              <div>• Modalidad: Modular Semestral Presencial en Talleres Productivos Oficiales</div>
            </div>
          </div>
        </div>
      `;
    } else if (areaFiltro === 'humanistica') {
      const humCiclos = [
        { id: 'elem', nombre: 'Aprendizajes Elementales', detalle: '1° a 3° de Primaria', sub: 'Primaria de Adultos (EPA)', lista: [], color: '#059669' },
        { id: 'avan', nombre: 'Aprendizajes Avanzados', detalle: '4° a 6° de Primaria', sub: 'Primaria de Adultos (EPA)', lista: [], color: '#10b981' },
        { id: 'apli', nombre: 'Aprendizajes Aplicados', detalle: '1° y 2° de Secundaria', sub: 'Secundaria de Adultos (ESA)', lista: [], color: '#2563eb' },
        { id: 'comp', nombre: 'Aprendizajes Complementarios', detalle: '3° y 4° de Secundaria', sub: 'Secundaria de Adultos (ESA)', lista: [], color: '#3b82f6' },
        { id: 'espe', nombre: 'Aprendizajes Especializados', detalle: '5° y 6° Sec. (BTH)', sub: 'Bachillerato Técnico Humanístico', lista: [], color: '#1d4ed8' }
      ];

      humanisticaEPA.forEach(it => {
        const c = String((it.carrera || '') + ' ' + (it.nivel || '')).toLowerCase();
        if (c.includes('elemental') || c.includes('1°') || c.includes('1ro') || c.includes('2°') || c.includes('2do') || c.includes('3°') || c.includes('3ro')) {
          humCiclos[0].lista.push(it);
        } else {
          humCiclos[1].lista.push(it);
        }
      });

      humanisticaESA.forEach(it => {
        const c = String((it.carrera || '') + ' ' + (it.nivel || '')).toLowerCase();
        if (c.includes('especializ') || c.includes('5°') || c.includes('6°') || c.includes('bth') || c.includes('bachiller')) {
          humCiclos[4].lista.push(it);
        } else if (c.includes('complement') || c.includes('3°') || c.includes('4°')) {
          humCiclos[3].lista.push(it);
        } else {
          humCiclos[2].lista.push(it);
        }
      });

      panelGraficosHTML = `
        <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:10px;margin-bottom:8px">
          <!-- Columna 1: Desglose por Ciclos Formativos EPJA con Barras -->
          <div style="border:1.4px solid #cbd5e1;border-radius:6px;padding:8px 12px;background:#ffffff">
            <div style="display:flex;justify-content:space-between;align-items:center;background:#1e40af;color:#ffffff;padding:4px 8px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <strong style="font-size:7.8pt;text-transform:uppercase">Distribución por Ciclos Curriculares EPJA</strong>
              <span style="font-size:6.8pt;font-weight:800;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px">${totalHum} postulantes</span>
            </div>
            <table style="width:100%;font-size:7.2pt;border-collapse:collapse;margin:0">
              <tbody>
                ${humCiclos.map(ciclo => {
                  const p = totalHum > 0 ? Math.round((ciclo.lista.length / totalHum) * 100) : 0;
                  return `
                    <tr style="border-bottom:1px solid #f1f5f9">
                      <td style="padding:6.5px 3px;width:48%">
                        <strong style="color:#0f172a">${escapeHTML(ciclo.nombre)}</strong>
                        <div style="font-size:6.4pt;color:#64748b">${escapeHTML(ciclo.detalle)}</div>
                      </td>
                      <td style="padding:6.5px 3px;text-align:center;width:14%">
                        <strong style="color:#1e40af;font-size:7.8pt">${ciclo.lista.length}</strong>
                      </td>
                      <td style="padding:6.5px 3px;text-align:center;width:14%;color:#64748b;font-size:6.6pt">
                        ${p}%
                      </td>
                      <td style="padding:6.5px 3px;width:24%">
                        <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                          <div style="width:${p}%;height:100%;background:${ciclo.color};-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
                <tr style="background:#eff6ff;font-weight:900;color:#1e40af;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                  <td style="padding:5px 2px">TOTAL ÁREA HUMANÍSTICA</td>
                  <td style="padding:5px 2px;text-align:center">${totalHum}</td>
                  <td style="padding:5px 2px;text-align:center">100%</td>
                  <td style="padding:5px 2px;text-align:center;font-size:6.5pt;color:#1d4ed8">5 Ciclos EPJA</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Columna 2: Indicadores por Subsistema y Acreditación Oficial -->
          <div style="border:1.4px solid #cbd5e1;border-radius:6px;padding:8px 12px;background:#ffffff;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;background:#1d4ed8;color:#ffffff;padding:4px 8px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                <strong style="font-size:7.8pt;text-transform:uppercase">Acreditación EPJA y BTH</strong>
                <span style="font-size:6.8pt;font-weight:800;background:rgba(255,255,255,0.2);padding:2px 6px;border-radius:3px">Ley Avelino Siñani</span>
              </div>
              <table style="width:100%;font-size:7.4pt;border-collapse:collapse;margin:0">
                <tbody>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:6.5px 4px;width:48%">
                      <strong style="color:#0f172a;font-size:8pt;display:block">Primaria de Adultos (EPA)</strong>
                      <div style="font-size:6.5pt;color:#64748b">Elementales y Avanzados (1° a 6°)</div>
                    </td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%"><strong style="color:#059669;font-size:9.2pt">${humanisticaEPA.length}</strong></td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%;color:#64748b;font-size:7pt">${pctEPA}%</td>
                    <td style="padding:6.5px 4px;width:22%">
                      <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                        <div style="width:${pctEPA}%;height:100%;background:#059669"></div>
                      </div>
                    </td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:6.5px 4px;width:48%">
                      <strong style="color:#0f172a;font-size:8pt;display:block">Secundaria de Adultos (ESA)</strong>
                      <div style="font-size:6.5pt;color:#64748b">Bachillerato Técnico Humanístico (BTH)</div>
                    </td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%"><strong style="color:#2563eb;font-size:9.2pt">${humanisticaESA.length}</strong></td>
                    <td style="padding:6.5px 4px;text-align:center;width:15%;color:#64748b;font-size:7pt">${pctESA}%</td>
                    <td style="padding:6.5px 4px;width:22%">
                      <div style="width:100%;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden">
                        <div style="width:${pctESA}%;height:100%;background:#2563eb"></div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style="margin-top:6px;border-top:1px dashed #cbd5e1;padding-top:5px;font-size:6.8pt;color:#334155;line-height:1.4">
              <div>• Promedio de edad EPA: <strong>${calcularPromedioEdad(humanisticaEPA)}</strong> | ESA: <strong>${calcularPromedioEdad(humanisticaESA)}</strong></div>
              <div>• Titulación: <strong>Bachiller Técnico Humanístico</strong> oficial con Diploma.</div>
            </div>
          </div>
        </div>
      `;
    }

    // 3. Tabla Consolidada Institucional (Distribución completa y amplia)
    let tablaConsolidadaHTML = '';
    let tituloTablaConsolidada = `Cuadro Oficial Consolidado de Distribución de Matrículas (Gestión ${anio}):`;

    if (areaFiltro === 'todas') {
      tituloTablaConsolidada = `Cuadro Oficial Consolidado de Distribución de Matrículas (Gestión ${anio}):`;
      tablaConsolidadaHTML = `
        <table class="tabla-cuadro-oficial" style="width:100%;border-collapse:collapse;font-size:8.2pt;margin-bottom:8px">
          <thead>
            <tr style="background:#0f4a1e;color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <th style="padding:8px 7px;text-align:left;border:1px solid #0f4a1e;width:38%">Especialidad / Programa Formativo</th>
              <th style="padding:8px 7px;text-align:left;border:1px solid #0f4a1e;width:24%">Área y Modalidad</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #0f4a1e;width:18%">Promedio de Edad</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #0f4a1e;width:10%">Inscritos</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #0f4a1e;width:10%">% Demanda</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #cbd5e1;background:#fafafa">
              <td style="padding:4.8px 7px"><strong>EPA Primaria de Adultos</strong></td>
              <td style="padding:4.8px 7px">Humanística (EPJA)</td>
              <td style="padding:4.8px 7px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(humanisticaEPA)}</td>
              <td style="padding:4.8px 7px;text-align:center;font-weight:800;color:#1e40af;font-size:8.8pt">${humanisticaEPA.length}</td>
              <td style="padding:4.8px 7px;text-align:center">${totalGeneral > 0 ? Math.round((humanisticaEPA.length/totalGeneral)*100) : 0}%</td>
            </tr>
            <tr style="border-bottom:1px solid #cbd5e1">
              <td style="padding:4.8px 7px"><strong>ESA Secundaria de Adultos</strong></td>
              <td style="padding:4.8px 7px">Humanística (BTH)</td>
              <td style="padding:4.8px 7px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(humanisticaESA)}</td>
              <td style="padding:4.8px 7px;text-align:center;font-weight:800;color:#1e40af;font-size:8.8pt">${humanisticaESA.length}</td>
              <td style="padding:4.8px 7px;text-align:center">${totalGeneral > 0 ? Math.round((humanisticaESA.length/totalGeneral)*100) : 0}%</td>
            </tr>
            ${Object.entries(tecnicaGrupos).map(([nom, list], idx) => {
              const bg = idx % 2 === 0 ? '#fafafa' : '#ffffff';
              const p = totalGeneral > 0 ? Math.round((list.length/totalGeneral)*100) : 0;
              return `
                <tr style="border-bottom:1px solid #cbd5e1;background:${bg}">
                  <td style="padding:4.8px 7px"><strong>Carrera de ${escapeHTML(nom)}</strong></td>
                  <td style="padding:4.8px 7px">Técnica Tecnológica (ETTP)</td>
                  <td style="padding:4.8px 7px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(list)}</td>
                  <td style="padding:4.8px 7px;text-align:center;font-weight:800;color:#0f4a1e;font-size:8.8pt">${list.length}</td>
                  <td style="padding:4.8px 7px;text-align:center">${p}%</td>
                </tr>
              `;
            }).join('')}
            <tr style="background:#0f4a1e;color:#ffffff;font-weight:900;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <td colspan="2" style="padding:6px 7px;font-size:7.8pt">TOTAL GENERAL INSTITUCIONAL CONSOLIDADO DE MATRÍCULAS</td>
              <td style="padding:6px 7px;text-align:center;font-size:7.8pt;font-weight:800">Prom. General: ${calcularPromedioEdad(ins)}</td>
              <td style="padding:6px 7px;text-align:center;font-size:9pt">${totalGeneral}</td>
              <td style="padding:6px 7px;text-align:center;font-size:9pt">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (areaFiltro === 'tecnica') {
      tituloTablaConsolidada = `Cuadro Oficial de Matrícula — Área Técnica Tecnológica ETTP (Gestión ${anio}):`;
      tablaConsolidadaHTML = `
        <table class="tabla-cuadro-oficial" style="width:100%;border-collapse:collapse;font-size:8.2pt;margin-bottom:8px">
          <thead>
            <tr style="background:#0f4a1e;color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <th style="padding:8px 7px;text-align:left;border:1px solid #0f4a1e;width:40%">Carrera Técnica Oficial</th>
              <th style="padding:8px 7px;text-align:left;border:1px solid #0f4a1e;width:24%">Niveles</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #0f4a1e;width:18%">Promedio de Edad</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #0f4a1e;width:9%">Postulantes</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #0f4a1e;width:9%">% Técnica</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(tecnicaGrupos).map(([nom, list], idx) => {
              const bg = idx % 2 === 0 ? '#fafafa' : '#ffffff';
              const p = totalTec > 0 ? Math.round((list.length/totalTec)*100) : 0;
              return `
                <tr style="border-bottom:1px solid #cbd5e1;background:${bg}">
                  <td style="padding:4.8px 7px"><strong>Carrera de ${escapeHTML(nom)}</strong></td>
                  <td style="padding:4.8px 7px">Técnico Básico, Auxiliar y Medio</td>
                  <td style="padding:4.8px 7px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(list)}</td>
                  <td style="padding:4.8px 7px;text-align:center;font-weight:800;color:#0f4a1e;font-size:8.8pt">${list.length}</td>
                  <td style="padding:4.8px 7px;text-align:center">${p}%</td>
                </tr>
              `;
            }).join('')}
            <tr style="background:#0f4a1e;color:#ffffff;font-weight:900;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <td colspan="2" style="padding:6px 7px">TOTAL POSTULANTES ÁREA TÉCNICA TECNOLÓGICA (ETTP)</td>
              <td style="padding:6px 7px;text-align:center;font-size:7.8pt;font-weight:800">Prom. Técnica: ${calcularPromedioEdad(Object.values(tecnicaGrupos).flat())}</td>
              <td style="padding:6px 7px;text-align:center;font-size:9pt">${totalTec}</td>
              <td style="padding:6px 7px;text-align:center;font-size:9pt">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (areaFiltro === 'humanistica') {
      tituloTablaConsolidada = `Cuadro Oficial de Matrícula — Área Humanística EPJA / BTH (Gestión ${anio}):`;
      const humCiclosFilas = [
        { nombre: 'EPA — Aprendizajes Elementales (1° a 3° Primaria)', sub: 'Educación Primaria de Adultos (EPA)', lista: [] },
        { nombre: 'EPA — Aprendizajes Avanzados (4° a 6° Primaria)', sub: 'Conclusión Nivel Primaria (EPA)', lista: [] },
        { nombre: 'ESA — Aprendizajes Aplicados (1° y 2° Secundaria)', sub: 'Educación Secundaria de Adultos (ESA)', lista: [] },
        { nombre: 'ESA — Aprendizajes Complementarios (3° y 4° Secundaria)', sub: 'Secundaria Ciclo Intermedio (ESA)', lista: [] },
        { nombre: 'ESA — Aprendizajes Especializados (5° y 6° Sec. BTH)', sub: 'Bachillerato Técnico Humanístico (BTH)', lista: [] }
      ];

      humanisticaEPA.forEach(it => {
        const c = String((it.carrera || '') + ' ' + (it.nivel || '')).toLowerCase();
        if (c.includes('elemental') || c.includes('1°') || c.includes('1ro') || c.includes('2°') || c.includes('2do') || c.includes('3°') || c.includes('3ro')) {
          humCiclosFilas[0].lista.push(it);
        } else {
          humCiclosFilas[1].lista.push(it);
        }
      });

      humanisticaESA.forEach(it => {
        const c = String((it.carrera || '') + ' ' + (it.nivel || '')).toLowerCase();
        if (c.includes('especializ') || c.includes('5°') || c.includes('6°') || c.includes('bth') || c.includes('bachiller')) {
          humCiclosFilas[4].lista.push(it);
        } else if (c.includes('complement') || c.includes('3°') || c.includes('4°')) {
          humCiclosFilas[3].lista.push(it);
        } else {
          humCiclosFilas[2].lista.push(it);
        }
      });

      tablaConsolidadaHTML = `
        <table class="tabla-cuadro-oficial" style="width:100%;border-collapse:collapse;font-size:8.2pt;margin-bottom:8px">
          <thead>
            <tr style="background:#1e40af;color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <th style="padding:8px 7px;text-align:left;border:1px solid #1e40af;width:42%">Nivel y Ciclo Humanístico Oficial</th>
              <th style="padding:8px 7px;text-align:left;border:1px solid #1e40af;width:24%">Subsistema y Acreditación</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #1e40af;width:16%">Promedio de Edad</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #1e40af;width:9%">Postulantes</th>
              <th style="padding:8px 7px;text-align:center;border:1px solid #1e40af;width:9%">% Humanística</th>
            </tr>
          </thead>
          <tbody>
            ${humCiclosFilas.map((fila, idx) => {
              const bg = idx % 2 === 0 ? '#fafafa' : '#ffffff';
              const p = totalHum > 0 ? Math.round((fila.lista.length / totalHum) * 100) : 0;
              return `
                <tr style="border-bottom:1px solid #cbd5e1;background:${bg}">
                  <td style="padding:4.8px 7px"><strong>${escapeHTML(fila.nombre)}</strong></td>
                  <td style="padding:4.8px 7px;color:#334155">${escapeHTML(fila.sub)}</td>
                  <td style="padding:4.8px 7px;text-align:center;font-weight:700;color:#1e40af">${calcularPromedioEdad(fila.lista)}</td>
                  <td style="padding:4.8px 7px;text-align:center;font-weight:800;color:#1e40af;font-size:8.8pt">${fila.lista.length}</td>
                  <td style="padding:4.8px 7px;text-align:center">${p}%</td>
                </tr>
              `;
            }).join('')}
            <tr style="background:#1e40af;color:#ffffff;font-weight:900;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <td colspan="2" style="padding:6px 7px">TOTAL POSTULANTES ÁREA HUMANÍSTICA (EPJA / BTH)</td>
              <td style="padding:6px 7px;text-align:center;font-size:7.8pt;font-weight:800">Prom. Humanística: ${calcularPromedioEdad([...humanisticaEPA, ...humanisticaESA])}</td>
              <td style="padding:6px 7px;text-align:center;font-size:9pt">${totalHum}</td>
              <td style="padding:6px 7px;text-align:center;font-size:9pt">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Estructura maestra HTML para ocupar armónicamente TODA la página (1 hoja completa con espacio amplio para firma y sello)
    const documentoHTML = `
      <div style="width:100%;max-width:100%;min-height:256mm;display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;page-break-inside:avoid;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.25;font-size:7.6pt">
        <div style="width:100%">
          <!-- MEMBRETE OFICIAL INSTITUCIONAL CON PROTOCOLO MINISTERIAL -->
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f4a1e;padding-bottom:6px;margin-bottom:8px;gap:10px">
            <div style="width:58px;flex-shrink:0;text-align:left">
              <img src="logo cea madre marie poussepin.png" alt="Logo CEA" style="width:56px;height:56px;object-fit:contain" onerror="this.style.display='none'" />
            </div>
            <div style="flex:1;text-align:center">
              <div style="font-size:6.8pt;font-weight:700;color:#475569;letter-spacing:0.6px;text-transform:uppercase">
                Estado Plurinacional de Bolivia • Ministerio de Educación
              </div>
              <div style="font-size:6.4pt;font-weight:600;color:#64748b;text-transform:uppercase">
                Dirección Departamental de Educación La Paz — Subdirección de Educación Alternativa y Especial
              </div>
              <h1 style="margin:2px 0 1px 0;color:#0f4a1e;font-size:12.2pt;font-weight:900;letter-spacing:0.2px;font-family:Arial,Helvetica,sans-serif">
                CENTRO DE EDUCACIÓN ALTERNATIVA «MADRE MARIE POUSSEPIN»
              </h1>
              <div style="font-size:6.6pt;color:#334155;font-weight:600">
                Chulumani — Sud Yungas — La Paz • R.A. 132/2007 • SIE: 80730064 • Edificio: 80630046
              </div>
              <div style="display:inline-block;background:#0f4a1e;color:#ffffff;font-size:7.8pt;font-weight:800;padding:2px 14px;border-radius:3px;margin-top:2px;letter-spacing:0.3px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                ${subtituloReporte}
              </div>
            </div>
            <div style="width:138px;flex-shrink:0;border:1px solid #cbd5e1;border-radius:5px;padding:5px;font-size:6.5pt;color:#475569;text-align:right;background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <div><strong>Emisión:</strong> ${fechaEmision}</div>
              <div style="margin-top:2px"><strong>Total Matrícula:</strong> ${totalMostrado} postulantes</div>
              <div style="margin-top:2px"><span style="background:#dcfce7;color:#166534;padding:1px 5px;border-radius:3px;font-weight:800;font-size:6.2pt">INFORME EN 1 HOJA</span></div>
              <div style="margin-top:2px;font-weight:700;color:#0f4a1e">Documento Oficial CEA</div>
            </div>
          </div>

          <!-- 1. FILA DE INDICADORES CLAVE (KPIS) -->
          ${kpisHTML}

          <!-- 2. PANELES DE DISTRIBUCIÓN GRÁFICA COMPARATIVA -->
          ${panelGraficosHTML}

          <!-- 3. TABLA CUANTITATIVA CONSOLIDADA INSTITUCIONAL -->
          <div style="margin-bottom:8px">
            <strong style="font-size:7.8pt;color:#0f4a1e;display:block;margin-bottom:4px;text-transform:uppercase">
              ${tituloTablaConsolidada}
            </strong>
            ${tablaConsolidadaHTML}
          </div>

          <!-- 4. RECUADRO DE OBSERVACIONES Y PLANIFICACIÓN CURRICULAR -->
          <div style="background:#f0fdf4;border:1.2px solid #86efac;border-radius:6px;padding:6px 12px;font-size:6.8pt;color:#166534;line-height:1.35;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin-bottom:6px">
            <strong>Nota Oficial Institucional:</strong> El presente informe consolida los datos cuantitativos y porcentuales oficiales del proceso de pre-inscripción del Centro de Educación Alternativa «Madre Marie Poussepin» para la Gestión Académica ${anio}. Instrumento administrativo para la planificación de aulas, dotación de ítems docentes, provisión de insumos en talleres productivos y remisión ante la Dirección Distrital de Educación de Chulumani.
          </div>
        </div>

        <!-- 5. CASILLA EXCLUSIVA PARA FIRMA Y SELLO DEL DIRECTOR (UBICADA AL FONDO/BORDE DE LA HOJA) -->
        <div style="margin-top:auto;margin-bottom:0;padding-bottom:1mm;display:flex;justify-content:center;page-break-inside:avoid">
          <div style="width:340px;text-align:center">
            <!-- Espacio amplio reservado para sello de goma y rúbrica manual -->
            <div style="height:72px"></div>
            <div style="border-top:1.8px solid #0f4a1e;padding-top:4px">
              <strong style="display:block;font-size:9pt;color:#0f4a1e;font-weight:800;margin:0;line-height:1.2">${escapeHTML(directorNom)}</strong>
              <span style="display:block;font-size:7.4pt;color:#334155;font-weight:700;margin:2px 0 0 0;line-height:1.15">Director(a) Institucional</span>
              <span style="display:block;font-size:6.8pt;color:#64748b;margin:1px 0 0 0;line-height:1.15">CEA "Madre Marie Poussepin" — Chulumani</span>
            </div>
          </div>
        </div>

      </div>
    `;

    // Asignar a ambos contenedores para garantizar visibilidad al 100%
    printArea1.innerHTML = documentoHTML;
    printArea1.style.display = 'block';

    printArea2.innerHTML = documentoHTML;
    printArea2.style.display = 'block';

    // Limpieza post-impresión
    let cleaned = false;
    const limpiarPrintEstadisticas = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('printing-reporte', 'printing-estadisticas-1hoja', 'printing-solo-estadisticas');
      if (printArea1) {
        printArea1.innerHTML = '';
        printArea1.style.display = 'none';
      }
      if (printArea2) {
        printArea2.innerHTML = '';
        printArea2.style.display = 'none';
      }
      window.removeEventListener('afterprint', limpiarPrintEstadisticas);
    };
    window.addEventListener('afterprint', limpiarPrintEstadisticas, { once: true });

    // Disparar ventana de impresión oficial
    setTimeout(() => {
      window.print();
    }, 150);
  }

  // Exportar al ámbito global
  window.aplicarOrientacionEstadisticas = aplicarOrientacionEstadisticas;
  window.imprimirReporteEstadisticoUnaHoja = imprimirReporteEstadisticoUnaHoja;
})();
