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
        margin: 6mm 12mm 5mm 12mm !important;
      }
      @page :first {
        margin: 6mm 12mm 5mm 12mm !important;
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
      } else {
        alert('No hay pre-inscripciones registradas actualmente para generar el reporte estadístico.');
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

    // 1. Tarjetas de Indicadores Estratégicos (KPIs)
    let kpisHTML = '';
    if (areaFiltro === 'todas') {
      kpisHTML = `
        <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;text-align:center;margin-bottom:8px">
          <div style="border:1.5px solid #0f4a1e;border-radius:6px;padding:6px 4px;background:#f0fdf4;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:15pt;font-weight:900;color:#0f4a1e;line-height:1">${totalGeneral}</span>
            <span style="font-size:6.8pt;color:#166534;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Total Pre-Inscritos</span>
            <span style="font-size:5.8pt;color:#475569">Matrícula Institucional</span>
          </div>
          <div style="border:1.5px solid #059669;border-radius:6px;padding:6px 4px;background:#ffffff">
            <span style="display:block;font-size:15pt;font-weight:900;color:#059669;line-height:1">${totalTec} <small style="font-size:8pt;font-weight:800">(${pctTec}%)</small></span>
            <span style="font-size:6.8pt;color:#059669;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Área Técnica (ETTP)</span>
            <span style="font-size:5.8pt;color:#475569">6 Carreras Habilitadas</span>
          </div>
          <div style="border:1.5px solid #1d4ed8;border-radius:6px;padding:6px 4px;background:#ffffff">
            <span style="display:block;font-size:15pt;font-weight:900;color:#1d4ed8;line-height:1">${totalHum} <small style="font-size:8pt;font-weight:800">(${pctHum}%)</small></span>
            <span style="font-size:6.8pt;color:#1d4ed8;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Área Humanística</span>
            <span style="font-size:5.8pt;color:#475569">Régimen EPJA y BTH</span>
          </div>
          <div style="border:1.5px solid #d97706;border-radius:6px;padding:6px 4px;background:#ffffff">
            <span style="display:block;font-size:15pt;font-weight:900;color:#d97706;line-height:1">${humanisticaEPA.length} / ${humanisticaESA.length}</span>
            <span style="font-size:6.8pt;color:#d97706;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Primaria / Secundaria</span>
            <span style="font-size:5.8pt;color:#475569">EPA (${pctEPA}%) | ESA (${pctESA}%)</span>
          </div>
        </div>
      `;
    } else if (areaFiltro === 'tecnica') {
      kpisHTML = `
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;text-align:center;margin-bottom:8px">
          <div style="border:1.5px solid #0f4a1e;border-radius:6px;padding:6px 4px;background:#f0fdf4;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:15pt;font-weight:900;color:#0f4a1e;line-height:1">${totalTec}</span>
            <span style="font-size:7pt;color:#166534;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Total Postulantes Área Técnica</span>
            <span style="font-size:6pt;color:#475569">Matrícula Efectiva 2026</span>
          </div>
          <div style="border:1.5px solid #059669;border-radius:6px;padding:6px 4px;background:#ffffff">
            <span style="display:block;font-size:15pt;font-weight:900;color:#059669;line-height:1">6 Carreras</span>
            <span style="font-size:7pt;color:#059669;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Especialidades Productivas</span>
            <span style="font-size:6pt;color:#475569">Técnico Básico, Auxiliar y Medio</span>
          </div>
          <div style="border:1.5px solid #16a34a;border-radius:6px;padding:6px 4px;background:#ffffff">
            <span style="display:block;font-size:15pt;font-weight:900;color:#16a34a;line-height:1">${pctTec}%</span>
            <span style="font-size:7pt;color:#16a34a;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Proporción Demanda Global</span>
            <span style="font-size:6pt;color:#475569">Participación sobre Matrícula CEA</span>
          </div>
        </div>
      `;
    } else if (areaFiltro === 'humanistica') {
      kpisHTML = `
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px;text-align:center;margin-bottom:8px">
          <div style="border:1.5px solid #1e40af;border-radius:6px;padding:6px 4px;background:#eff6ff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <span style="display:block;font-size:15pt;font-weight:900;color:#1e40af;line-height:1">${totalHum}</span>
            <span style="font-size:7pt;color:#1e40af;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Total Postulantes Humanística</span>
            <span style="font-size:6pt;color:#475569">Régimen EPJA Acreditado</span>
          </div>
          <div style="border:1.5px solid #059669;border-radius:6px;padding:6px 4px;background:#ffffff">
            <span style="display:block;font-size:15pt;font-weight:900;color:#059669;line-height:1">${humanisticaEPA.length} <small style="font-size:8pt">(${pctEPA}%)</small></span>
            <span style="font-size:7pt;color:#059669;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Primaria de Adultos (EPA)</span>
            <span style="font-size:6pt;color:#475569">Aprendizajes Elementales y Avanzados</span>
          </div>
          <div style="border:1.5px solid #2563eb;border-radius:6px;padding:6px 4px;background:#ffffff">
            <span style="display:block;font-size:15pt;font-weight:900;color:#2563eb;line-height:1">${humanisticaESA.length} <small style="font-size:8pt">(${pctESA}%)</small></span>
            <span style="font-size:7pt;color:#2563eb;font-weight:800;text-transform:uppercase;display:block;margin-top:2px">Secundaria de Adultos (ESA)</span>
            <span style="font-size:6pt;color:#475569">Bachillerato Técnico Humanístico</span>
          </div>
        </div>
      `;
    }

    // 2. Gráficos de Distribución Comparativa (2 Columnas)
    let panelGraficosHTML = '';
    if (areaFiltro === 'todas') {
      panelGraficosHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
          <!-- Columna 1: Carreras Técnicas con Barras Visuales -->
          <div style="border:1.2px solid #cbd5e1;border-radius:6px;padding:6px 8px;background:#ffffff">
            <div style="display:flex;justify-content:space-between;align-items:center;background:#0f4a1e;color:#ffffff;padding:3px 6px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <strong style="font-size:7.2pt;text-transform:uppercase">1. Área Técnica Tecnológica (ETTP)</strong>
              <span style="font-size:6.4pt;font-weight:800;background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px">${totalTec} post.</span>
            </div>
            <table style="width:100%;font-size:6.8pt;border-collapse:collapse;margin:0">
              <tbody>
                ${Object.entries(tecnicaGrupos).map(([nom, list]) => {
                  const p = totalTec > 0 ? Math.round((list.length / totalTec) * 100) : 0;
                  return `
                    <tr style="border-bottom:1px solid #f1f5f9">
                      <td style="padding:2.5px 2px;width:48%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        <strong style="color:#0f172a">${escapeHTML(nom)}</strong>
                      </td>
                      <td style="padding:2.5px 2px;text-align:right;width:15%">
                        <strong style="color:#0f4a1e">${list.length}</strong>
                      </td>
                      <td style="padding:2.5px 2px;text-align:right;width:14%;color:#64748b;font-size:6.2pt">
                        ${p}%
                      </td>
                      <td style="padding:2.5px 2px;width:23%">
                        <div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
                          <div style="width:${p}%;height:100%;background:#16a34a;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
                <tr style="background:#f0fdf4;font-weight:900;color:#0f4a1e;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                  <td style="padding:3px 2px">SUBTOTAL TÉCNICA</td>
                  <td style="padding:3px 2px;text-align:right">${totalTec}</td>
                  <td style="padding:3px 2px;text-align:right">100%</td>
                  <td style="padding:3px 2px;text-align:center;font-size:6pt;color:#166534">6 Carreras</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Columna 2: Área Humanística y Proporción Global -->
          <div style="border:1.2px solid #cbd5e1;border-radius:6px;padding:6px 8px;background:#ffffff;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;background:#1e40af;color:#ffffff;padding:3px 6px;border-radius:4px;margin-bottom:6px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                <strong style="font-size:7.2pt;text-transform:uppercase">2. Área Humanística (EPJA / BTH)</strong>
                <span style="font-size:6.4pt;font-weight:800;background:rgba(255,255,255,0.2);padding:1px 5px;border-radius:3px">${totalHum} post.</span>
              </div>
              <table style="width:100%;font-size:6.8pt;border-collapse:collapse;margin:0">
                <tbody>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:3px 2px;width:48%">
                      <strong style="color:#0f172a">EPA Primaria de Adultos</strong>
                      <div style="font-size:5.8pt;color:#64748b">Aprendizajes Elementales y Avanzados</div>
                    </td>
                    <td style="padding:3px 2px;text-align:right;width:15%">
                      <strong style="color:#1e40af">${humanisticaEPA.length}</strong>
                    </td>
                    <td style="padding:3px 2px;text-align:right;width:14%;color:#64748b;font-size:6.2pt">
                      ${pctEPA}%
                    </td>
                    <td style="padding:3px 2px;width:23%">
                      <div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
                        <div style="width:${pctEPA}%;height:100%;background:#059669;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                      </div>
                    </td>
                  </tr>
                  <tr style="border-bottom:1px solid #f1f5f9">
                    <td style="padding:3px 2px;width:48%">
                      <strong style="color:#0f172a">ESA Secundaria de Adultos</strong>
                      <div style="font-size:5.8pt;color:#64748b">Aplicados, Complementarios y Especializados</div>
                    </td>
                    <td style="padding:3px 2px;text-align:right;width:15%">
                      <strong style="color:#1e40af">${humanisticaESA.length}</strong>
                    </td>
                    <td style="padding:3px 2px;text-align:right;width:14%;color:#64748b;font-size:6.2pt">
                      ${pctESA}%
                    </td>
                    <td style="padding:3px 2px;width:23%">
                      <div style="width:100%;height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden">
                        <div style="width:${pctESA}%;height:100%;background:#2563eb;-webkit-print-color-adjust:exact;print-color-adjust:exact"></div>
                      </div>
                    </td>
                  </tr>
                  <tr style="background:#eff6ff;font-weight:900;color:#1e40af;-webkit-print-color-adjust:exact;print-color-adjust:exact">
                    <td style="padding:3px 2px">SUBTOTAL HUMANÍSTICA</td>
                    <td style="padding:3px 2px;text-align:right">${totalHum}</td>
                    <td style="padding:3px 2px;text-align:right">100%</td>
                    <td style="padding:3px 2px;text-align:center;font-size:6pt;color:#1d4ed8">EPJA / BTH</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Proporción Global Técnica vs Humanística -->
            <div style="margin-top:6px;border-top:1px dashed #cbd5e1;padding-top:5px">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px">
                <span style="font-size:6.2pt;font-weight:700;color:#334155">Demanda Global Institucional:</span>
                <span style="font-size:6.2pt;color:#0f4a1e;font-weight:800">Téc: ${pctTec}% | Hum: ${pctHum}%</span>
              </div>
              <div style="display:flex;width:100%;height:7px;background:#e2e8f0;border-radius:3px;overflow:hidden">
                <div style="width:${pctTec}%;height:100%;background:#16a34a" title="Técnica: ${pctTec}%"></div>
                <div style="width:${pctHum}%;height:100%;background:#2563eb" title="Humanística: ${pctHum}%"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // 3. Tabla Consolidada Institucional (Distribución completa y amplia)
    let tablaConsolidadaHTML = '';
    if (areaFiltro === 'todas') {
      tablaConsolidadaHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:7pt;margin-bottom:8px">
          <thead>
            <tr style="background:#0f4a1e;color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <th style="padding:4px 6px;text-align:left;border:1px solid #0f4a1e;width:38%">Especialidad / Programa Formativo</th>
              <th style="padding:4px 6px;text-align:left;border:1px solid #0f4a1e;width:24%">Área y Modalidad</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #0f4a1e;width:18%">Promedio de Edad</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #0f4a1e;width:10%">Inscritos</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #0f4a1e;width:10%">% Demanda</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #cbd5e1;background:#fafafa">
              <td style="padding:3px 6px"><strong>EPA Primaria de Adultos</strong></td>
              <td style="padding:3px 6px">Humanística (EPJA)</td>
              <td style="padding:3px 6px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(humanisticaEPA)}</td>
              <td style="padding:3px 6px;text-align:center;font-weight:800;color:#1e40af">${humanisticaEPA.length}</td>
              <td style="padding:3px 6px;text-align:center">${totalGeneral > 0 ? Math.round((humanisticaEPA.length/totalGeneral)*100) : 0}%</td>
            </tr>
            <tr style="border-bottom:1px solid #cbd5e1">
              <td style="padding:3px 6px"><strong>ESA Secundaria de Adultos</strong></td>
              <td style="padding:3px 6px">Humanística (BTH)</td>
              <td style="padding:3px 6px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(humanisticaESA)}</td>
              <td style="padding:3px 6px;text-align:center;font-weight:800;color:#1e40af">${humanisticaESA.length}</td>
              <td style="padding:3px 6px;text-align:center">${totalGeneral > 0 ? Math.round((humanisticaESA.length/totalGeneral)*100) : 0}%</td>
            </tr>
            ${Object.entries(tecnicaGrupos).map(([nom, list], idx) => {
              const bg = idx % 2 === 0 ? '#fafafa' : '#ffffff';
              const p = totalGeneral > 0 ? Math.round((list.length/totalGeneral)*100) : 0;
              return `
                <tr style="border-bottom:1px solid #cbd5e1;background:${bg}">
                  <td style="padding:3px 6px"><strong>Carrera de ${escapeHTML(nom)}</strong></td>
                  <td style="padding:3px 6px">Técnica Tecnológica (ETTP)</td>
                  <td style="padding:3px 6px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(list)}</td>
                  <td style="padding:3px 6px;text-align:center;font-weight:800;color:#0f4a1e">${list.length}</td>
                  <td style="padding:3px 6px;text-align:center">${p}%</td>
                </tr>
              `;
            }).join('')}
            <tr style="background:#0f4a1e;color:#ffffff;font-weight:900;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <td colspan="2" style="padding:4.5px 6px;font-size:7.5pt">TOTAL GENERAL INSTITUCIONAL CONSOLIDADO DE MATRÍCULAS</td>
              <td style="padding:4.5px 6px;text-align:center;font-size:7.5pt;font-weight:800">Prom. General: ${calcularPromedioEdad(ins)}</td>
              <td style="padding:4.5px 6px;text-align:center;font-size:8.2pt">${totalGeneral}</td>
              <td style="padding:4.5px 6px;text-align:center;font-size:8.2pt">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (areaFiltro === 'tecnica') {
      tablaConsolidadaHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:7.2pt;margin-bottom:8px">
          <thead>
            <tr style="background:#0f4a1e;color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <th style="padding:4px 6px;text-align:left;border:1px solid #0f4a1e;width:40%">Carrera Técnica Oficial</th>
              <th style="padding:4px 6px;text-align:left;border:1px solid #0f4a1e;width:24%">Régimen y Acreditación</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #0f4a1e;width:18%">Promedio de Edad</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #0f4a1e;width:9%">Postulantes</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #0f4a1e;width:9%">% Técnica</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(tecnicaGrupos).map(([nom, list], idx) => {
              const bg = idx % 2 === 0 ? '#fafafa' : '#ffffff';
              const p = totalTec > 0 ? Math.round((list.length/totalTec)*100) : 0;
              return `
                <tr style="border-bottom:1px solid #cbd5e1;background:${bg}">
                  <td style="padding:3.5px 6px"><strong>Carrera de ${escapeHTML(nom)}</strong></td>
                  <td style="padding:3.5px 6px">Técnico Básico, Auxiliar y Medio</td>
                  <td style="padding:3.5px 6px;text-align:center;font-weight:700;color:#0f4a1e">${calcularPromedioEdad(list)}</td>
                  <td style="padding:3.5px 6px;text-align:center;font-weight:800;color:#0f4a1e">${list.length}</td>
                  <td style="padding:3.5px 6px;text-align:center">${p}%</td>
                </tr>
              `;
            }).join('')}
            <tr style="background:#0f4a1e;color:#ffffff;font-weight:900;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <td colspan="2" style="padding:5px 6px">TOTAL POSTULANTES ÁREA TÉCNICA TECNOLÓGICA (ETTP)</td>
              <td style="padding:5px 6px;text-align:center;font-size:7.5pt;font-weight:800">Prom. Técnica: ${calcularPromedioEdad(Object.values(tecnicaGrupos).flat())}</td>
              <td style="padding:5px 6px;text-align:center;font-size:8.2pt">${totalTec}</td>
              <td style="padding:5px 6px;text-align:center;font-size:8.2pt">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (areaFiltro === 'humanistica') {
      tablaConsolidadaHTML = `
        <table style="width:100%;border-collapse:collapse;font-size:7.2pt;margin-bottom:8px">
          <thead>
            <tr style="background:#1e40af;color:#ffffff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <th style="padding:4px 6px;text-align:left;border:1px solid #1e40af;width:40%">Nivel Humanístico Oficial</th>
              <th style="padding:4px 6px;text-align:left;border:1px solid #1e40af;width:24%">Ciclos y Módulos Formativos</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #1e40af;width:18%">Promedio de Edad</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #1e40af;width:9%">Postulantes</th>
              <th style="padding:4px 6px;text-align:center;border:1px solid #1e40af;width:9%">% Humanística</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom:1px solid #cbd5e1;background:#fafafa">
              <td style="padding:4px 6px"><strong>EPA — Educación Primaria de Adultos</strong></td>
              <td style="padding:4px 6px">Aprendizajes Elementales y Avanzados</td>
              <td style="padding:4px 6px;text-align:center;font-weight:700;color:#1e40af">${calcularPromedioEdad(humanisticaEPA)}</td>
              <td style="padding:4px 6px;text-align:center;font-weight:800;color:#1e40af">${humanisticaEPA.length}</td>
              <td style="padding:4px 6px;text-align:center">${pctEPA}%</td>
            </tr>
            <tr style="border-bottom:1px solid #cbd5e1">
              <td style="padding:4px 6px"><strong>ESA — Educación Secundaria de Adultos</strong></td>
              <td style="padding:4px 6px">Aplicados, Complementarios y Especializados (BTH)</td>
              <td style="padding:4px 6px;text-align:center;font-weight:700;color:#1e40af">${calcularPromedioEdad(humanisticaESA)}</td>
              <td style="padding:4px 6px;text-align:center;font-weight:800;color:#1e40af">${humanisticaESA.length}</td>
              <td style="padding:4px 6px;text-align:center">${pctESA}%</td>
            </tr>
            <tr style="background:#1e40af;color:#ffffff;font-weight:900;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <td colspan="2" style="padding:5px 6px">TOTAL POSTULANTES ÁREA HUMANÍSTICA (EPJA / BTH)</td>
              <td style="padding:5px 6px;text-align:center;font-size:7.5pt;font-weight:800">Prom. Humanística: ${calcularPromedioEdad([...humanisticaEPA, ...humanisticaESA])}</td>
              <td style="padding:5px 6px;text-align:center;font-size:8.2pt">${totalHum}</td>
              <td style="padding:5px 6px;text-align:center;font-size:8.2pt">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    // Estructura maestra HTML para ocupar armónicamente TODA la página (1 hoja completa)
    const documentoHTML = `
      <div style="width:100%;max-width:100%;box-sizing:border-box;page-break-inside:avoid;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.2;font-size:7.2pt">
        
        <!-- MEMBRETE OFICIAL INSTITUCIONAL CON PROTOCOLO MINISTERIAL -->
        <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:2.2px solid #0f4a1e;padding-bottom:7px;margin-bottom:8px;gap:12px">
          <div style="width:65px;flex-shrink:0;text-align:left">
            <img src="logo cea madre marie poussepin.png" alt="Logo CEA" style="width:62px;height:62px;object-fit:contain" onerror="this.style.display='none'" />
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:6.8pt;font-weight:700;color:#475569;letter-spacing:0.8px;text-transform:uppercase">
              Estado Plurinacional de Bolivia • Ministerio de Educación
            </div>
            <div style="font-size:6.3pt;font-weight:600;color:#64748b;text-transform:uppercase">
              Dirección Departamental de Educación La Paz — Subdirección de Educación Alternativa y Especial
            </div>
            <h1 style="margin:2px 0 1px 0;color:#0f4a1e;font-size:12.5pt;font-weight:900;letter-spacing:0.2px;font-family:Arial,Helvetica,sans-serif">
              CENTRO DE EDUCACIÓN ALTERNATIVA «MADRE MARIE POUSSEPIN»
            </h1>
            <div style="font-size:6.7pt;color:#334155;font-weight:600">
              Chulumani — Sud Yungas — La Paz • R.A. 132/2007 • SIE: 80730064 • Edificio: 80630046
            </div>
            <div style="display:inline-block;background:#0f4a1e;color:#ffffff;font-size:7.8pt;font-weight:800;padding:2px 14px;border-radius:3px;margin-top:3px;letter-spacing:0.3px;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              ${subtituloReporte}
            </div>
          </div>
          <div style="width:142px;flex-shrink:0;border:1px solid #cbd5e1;border-radius:5px;padding:5px;font-size:6.5pt;color:#475569;text-align:right;background:#f8fafc;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <div><strong>Emisión:</strong> ${fechaEmision}</div>
            <div style="margin-top:2px"><strong>Total Matrícula:</strong> ${totalMostrado} postulantes</div>
            <div style="margin-top:2px"><span style="background:#dcfce7;color:#166534;padding:1px 5px;border-radius:3px;font-weight:800;font-size:6pt">INFORME EN 1 HOJA</span></div>
            <div style="margin-top:2px;font-weight:700;color:#0f4a1e">Documento Oficial CEA</div>
          </div>
        </div>

        <!-- 1. FILA DE INDICADORES CLAVE (KPIS) -->
        ${kpisHTML}

        <!-- 2. PANELES DE DISTRIBUCIÓN GRÁFICA COMPARATIVA -->
        ${panelGraficosHTML}

        <!-- 3. TABLA CUANTITATIVA CONSOLIDADA INSTITUCIONAL -->
        <div style="margin-bottom:6px">
          <strong style="font-size:7.4pt;color:#0f4a1e;display:block;margin-bottom:3px;text-transform:uppercase">
            Cuadro Oficial Consolidado de Distribución de Matrículas (Gestión ${anio}):
          </strong>
          ${tablaConsolidadaHTML}
        </div>

        <!-- 4. RECUADRO DE OBSERVACIONES Y PLANIFICACIÓN CURRICULAR -->
        <div style="background:#f0fdf4;border:1.2px solid #86efac;border-radius:5px;padding:5px 10px;font-size:6.5pt;color:#166534;line-height:1.3;-webkit-print-color-adjust:exact;print-color-adjust:exact;margin-bottom:6px">
          <strong>Nota Oficial Institucional:</strong> El presente informe consolida los datos cuantitativos y porcentuales oficiales del proceso de pre-inscripción del Centro de Educación Alternativa «Madre Marie Poussepin» para la Gestión Académica ${anio}. Instrumento administrativo para la planificación de aulas, dotación de ítems docentes, provisión de insumos en talleres productivos y remisión ante la Dirección Distrital de Educación de Chulumani.
        </div>

        <!-- 5. CASILLA DE FIRMA Y SELLO OFICIAL DEL DIRECTOR(A) (ESPACIO AMPLIO Y CÓMODO PARA FIRMA Y SELLO) -->
        <div style="margin-top:54px;display:flex;justify-content:center;page-break-inside:avoid">
          <div style="width:340px;text-align:center;border-top:1.8px solid #0f4a1e;padding-top:5px;line-height:1.2">
            <strong style="display:block;font-size:9pt;color:#0f4a1e;font-weight:800;margin:0;line-height:1.2">${escapeHTML(directorNom)}</strong>
            <span style="display:block;font-size:7.4pt;color:#334155;font-weight:700;margin:2px 0 0 0;line-height:1.15">Director(a) Institucional</span>
            <span style="display:block;font-size:6.8pt;color:#64748b;margin:1px 0 0 0;line-height:1.15">CEA "Madre Marie Poussepin" — Chulumani</span>
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
