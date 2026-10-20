/* ==========================================================================
   MÓDULO EXCLUSIVO Y AISLADO DE IMPRESIÓN OFICIAL DE HORARIOS
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN 2026
   ========================================================================== */

(function () {
  'use strict';

  function aplicarOrientacionImpresionHorario(orientacion = 'landscape', turno = 'hum') {
    let styleTag = document.getElementById('cea-dynamic-page-orientation');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cea-dynamic-page-orientation';
    }
    document.head.appendChild(styleTag);

    if (turno === 'hum') {
      // Humanística: horizontal landscape con margen equilibrado (0.6cm top/bottom, 0.7cm laterales) para aprovechar el 100% de la altura
      styleTag.innerHTML = `
        @page {
          size: letter landscape !important;
          margin: 0.6cm 0.7cm !important;
        }
      `;
      document.body.classList.add('print-orientation-landscape', 'print-turno-hum');
      document.body.classList.remove('print-orientation-portrait', 'print-turno-tec');
    } else {
      // Técnica: vertical portrait con margen equilibrado
      styleTag.innerHTML = `
        @page {
          size: letter portrait !important;
          margin: 0.8cm 1.4cm !important;
        }
      `;
      document.body.classList.add('print-orientation-portrait', 'print-turno-tec');
      document.body.classList.remove('print-orientation-landscape', 'print-turno-hum');
    }
  }

  function obtenerCarrerasTecnicasConDocentesPrint() {
    const defaultCarreras = [
      { nombre: 'AGROPECUARIA', docente: 'Lic. Macario Ticonipa' },
      { nombre: 'BELLEZA INTEGRAL', docente: 'Lic. Maritza Ojeda Conde' },
      { nombre: 'CONFECCIÓN TEXTIL', docente: 'Lic. Maritza Ojeda Conde' },
      { nombre: 'GASTRONOMÍA', docente: 'Lic. Lourdes Chambi' },
      { nombre: 'SECRETARIADO EJECUTIVO', docente: 'Lic. Ofelia Flores' },
      { nombre: 'SISTEMAS INFORMÁTICOS', docente: 'Lic. Gualberto Choque' }
    ];

    try {
      if (typeof window.obtenerCarrerasTecnicasConDocentesPrint === 'function' && window.obtenerCarrerasTecnicasConDocentesPrint !== obtenerCarrerasTecnicasConDocentesPrint) {
        const res = window.obtenerCarrerasTecnicasConDocentesPrint();
        if (Array.isArray(res) && res.length > 0) {
          return res.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
        }
      }

      const stored = localStorage.getItem('cea_areas_tec');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapeados = parsed.filter(a => a.activa !== false).map(a => {
            const matchDef = defaultCarreras.find(d => 
              (a.key && a.key.toLowerCase().includes(d.nombre.toLowerCase().slice(0, 4))) ||
              (a.nombre && a.nombre.toLowerCase().includes(d.nombre.toLowerCase().slice(0, 4)))
            );
            return {
              nombre: a.nombre || (matchDef ? matchDef.nombre : 'Carrera Técnica'),
              docente: a.prof || a.docente || a.encargado || (matchDef ? matchDef.docente : 'Lic. Docente')
            };
          });
          if (mapeados.length > 0) {
            return mapeados.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
          }
        }
      }
    } catch (e) {
      console.warn('Error al leer carreras técnicas:', e);
    }
    return defaultCarreras.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es', { sensitivity: 'base' }));
  }

  function detectarTurnoActivo(turnoOverride) {
    if (turnoOverride) return turnoOverride;
    if (window.turnoHorarioActual) return window.turnoHorarioActual;
    const tabActiva = document.querySelector('.oferta-pill-btn.active, .btn-turno-tab.active, .btn-turno-tab.activo');
    if (tabActiva) {
      const dTurno = tabActiva.getAttribute('data-turno');
      if (dTurno) return dTurno;
      if (tabActiva.id && tabActiva.id.includes('tec')) return 'tec';
      if (tabActiva.id && tabActiva.id.includes('hum')) return 'hum';
    }
    const container = document.getElementById('tabla-horario-matriz-container');
    if (container && container.querySelector('.ttp-table')) return 'tec';
    return 'hum';
  }

  function toggleLineasImpresionHorario(checked) {
    const key = 'cea_horario_imprimir_lineas';
    const activa = (typeof checked === 'boolean') ? checked : (localStorage.getItem(key) !== 'false');
    localStorage.setItem(key, activa);
    const chk = document.getElementById('chk-imprimir-lineas-horario');
    if (chk) chk.checked = activa;
    if (typeof mostrarToastLive === 'function') {
      mostrarToastLive(activa ? 'Impresión: Cuadrícula visible activada.' : 'Impresión: Cuadrícula limpia sin líneas activada.');
    }
  }

  function escapeHtmlSub(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function generarMembreteOficialHtml(subtituloBadge, tituloArea, anio) {
    return `
      <div class="horario-print-header" style="text-align:center; border-bottom:2px solid var(--verde-dark, #166534); padding-bottom:2px; margin-bottom:3px; flex:0 0 auto;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <img src="logo cea madre marie poussepin.png" alt="Logo CEA" style="width:40px; height:auto;" />
          <div style="flex:1; padding:0 8px; line-height:1.02;">
            <div style="font-size:7.0pt; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; color:#334155; line-height:1.02; margin:0;">Estado Plurinacional de Bolivia • Ministerio de Educación</div>
            <div style="font-size:6.6pt; font-weight:700; color:#475569; line-height:1.02; margin:1px 0 0 0;">Viceministerio de Educación Alternativa y Especial • DDE La Paz</div>
            <div style="font-size:9.5pt; font-weight:900; color:var(--verde-dark, #166534); margin:1px 0; letter-spacing:0.5px; line-height:1.02;">CEA MADRE MARIE POUSSEPÍN</div>
            <div style="font-size:6.6pt; color:#64748b; font-weight:600; line-height:1.02; margin:0;">R.A. 176/2013 • Código SIE: 80630044 • Chulumani, Sud Yungas, La Paz</div>
          </div>
          <div style="text-align:right;">
            <span style="display:inline-block; padding:2px 7px; background:#dcfce7; border:1.5px solid #16a34a; border-radius:5px; font-weight:900; font-size:7.8pt; color:#166534;">GESTIÓN ${anio}</span>
            <div style="margin-top:2px; font-size:7.2pt; font-weight:800; color:var(--verde-dark, #166534); text-transform:uppercase;">${subtituloBadge}</div>
          </div>
        </div>
        <div style="font-size:8.2pt; font-weight:900; color:var(--verde-dark, #166534); text-transform:uppercase; margin-top:3px; background:#f0fdf4; padding:2.5px; border-radius:4px; border:1px solid #bbf7d0;">
          HORARIO DE CLASES — ${tituloArea}
        </div>
      </div>
    `;
  }

  function distribuirAlturasImpresion(pageEl, turno, hasBth, numTablesOnPage) {
    const isLandscape = (turno === 'hum');
    // Altura útil en pixels a 96 DPI:
    // Letter landscape: 215.9mm = ~816px. Margen 0.6cm arriba y abajo = 1.2cm (~45px). Altura imprimible = 771px.
    // Letter portrait: 279.4mm = ~1056px. Margen 0.8cm arriba y abajo = 1.6cm (~60px). Altura imprimible = 996px.
    const printableHeight = isLandscape ? 770 : 996;
    const headerHeight = 72; // Membrete oficial
    // Factor de seguridad del 94% para garantizar que NUNCA desborde a una 2da página
    let usableHeight = (printableHeight - headerHeight) * 0.94;

    const numTables = numTablesOnPage || Math.max(1, pageEl.querySelectorAll('table.gestor-schedule-table, table.ttp-table').length);
    const hasCarrerasTec = (turno === 'tec');

    // Descontar espacio vertical de componentes fijos
    if (hasBth) {
      usableHeight -= (numTables > 1 ? 110 : 132);
    }
    if (hasCarrerasTec && turno === 'tec') {
      usableHeight -= 110;
    }
    if (numTables > 1) {
      // Descontar encabezados de subcentro y separador
      usableHeight -= ((numTables - 1) * 32);
    }

    // Altura neta asignada a cada tabla
    const heightPerTable = Math.max(120, usableHeight / numTables);
    const tables = Array.from(pageEl.querySelectorAll('table.gestor-schedule-table, table.ttp-table'));

    tables.forEach(table => {
      // Filas de clase y filas de recreo
      const allRows = Array.from(table.querySelectorAll('tbody tr'));
      const classRows = allRows.filter(tr => 
        !tr.classList.contains('gestor-row-recreo') && 
        !tr.classList.contains('ttp-receso-row') &&
        !tr.querySelector('.bth-recreo, .gestor-recreo-banner, .ttp-receso-cell')
      );
      const recreoRows = allRows.filter(tr => 
        tr.classList.contains('gestor-row-recreo') || 
        tr.classList.contains('ttp-receso-row') ||
        tr.querySelector('.bth-recreo, .gestor-recreo-banner, .ttp-receso-cell')
      );

      const theadHeight = (numTables > 1) ? (isLandscape ? 34 : 32) : (isLandscape ? 44 : 40);
      const recreoHeight = (numTables > 1) ? 18 : (hasBth ? 20 : 26);
      const totalRecreoHeight = recreoRows.length * recreoHeight;

      const availableForClassRows = Math.max(60, heightPerTable - theadHeight - totalRecreoHeight);
      const numClassRows = Math.max(1, classRows.length);
      const calculatedRowHeight = Math.floor(availableForClassRows / numClassRows);

      // Altura armónica y proporcional:
      let finalRowHeight = calculatedRowHeight;

      if (!hasBth && numTables === 1) {
        // MODO SIN BTH: En Humanística mantener ~52px; en Técnica reducir a ~38px para mayor compacidad
        const maxProportionalRowHeight = isLandscape ? 52 : (turno === 'tec' ? 38 : 56);
        finalRowHeight = Math.min(maxProportionalRowHeight, calculatedRowHeight);
        pageEl.classList.add('single-schedule-proportional');
        pageEl.classList.remove('page-has-bth', 'fused-single-sheet');
      } else if (hasBth && numTables === 1) {
        // MODO CON BTH: Altura proporcional, armónica y equilibrada (~34px en horizontal)
        // para que las materias no se estiren innecesariamente de alto y guarden perfecta proporción con el banner BTH
        const bthMaxRowHeight = isLandscape ? 34 : 38;
        finalRowHeight = Math.min(bthMaxRowHeight, calculatedRowHeight);
        pageEl.classList.remove('single-schedule-proportional', 'fused-single-sheet');
        pageEl.classList.add('page-has-bth');
      } else {
        // MODO FUSIONADO (CENTRAL + SUBCENTRO EN 1 HOJA):
        // La altura de las materias ya no se estira innecesariamente.
        // Se ajusta a una altura compacta y proporcionada (~30px a 32px) para que dos horarios
        // quepan perfectamente en una sola hoja sin estirarse desmedidamente.
        const maxFusedRowHeight = isLandscape ? 31 : 34;
        finalRowHeight = Math.min(maxFusedRowHeight, Math.max(24, calculatedRowHeight));
        pageEl.classList.remove('single-schedule-proportional', 'page-has-bth');
        pageEl.classList.add('fused-single-sheet');
      }

      // Asegurar que la tabla y tbody tengan height auto para no estirarse más allá de sus filas
      table.style.setProperty('height', 'auto', 'important');
      const tbody = table.querySelector('tbody');
      if (tbody) tbody.style.setProperty('height', 'auto', 'important');

      // Asignar altura dinámica a las filas de clase
      classRows.forEach(row => {
        row.style.setProperty('height', `${finalRowHeight}px`, 'important');
        row.querySelectorAll('td').forEach(td => {
          td.style.setProperty('height', `${finalRowHeight}px`, 'important');
          td.style.setProperty('padding', (numTables > 1 ? '0.5px 1px' : '0.5px 0'), 'important');
        });
        row.querySelectorAll('.gestor-cell-card, .bth-celda-materia').forEach(card => {
          card.style.setProperty('height', 'calc(100% - 2px)', 'important');
          card.style.setProperty('min-height', 'calc(100% - 2px)', 'important');
        });
      });

      // Asignar altura compacta a las filas de recreo
      recreoRows.forEach(row => {
        row.style.setProperty('height', `${recreoHeight}px`, 'important');
        row.querySelectorAll('td').forEach(td => {
          td.style.setProperty('height', `${recreoHeight}px`, 'important');
          td.style.setProperty('padding', '0', 'important');
        });
        row.querySelectorAll('.gestor-recreo-banner, .ttp-receso-cell').forEach(el => {
          el.style.setProperty('height', '100%', 'important');
          el.style.setProperty('min-height', `${recreoHeight - 2}px`, 'important');
        });
      });
    });

    // Escala tipográfica armónica según el modo
    let subjectFontSize = '5.8pt';
    let periodoFontSize = '8.5pt';
    let horaFontSize = '7.2pt';

    if (!hasBth && numTables === 1) {
      // Modo Horario Normal Solo (SIN BTH): Mantener exactamente el tamaño actual (6.5pt) solicitado por el usuario
      subjectFontSize = '6.5pt';
      periodoFontSize = '9.5pt';
      horaFontSize = '7.8pt';
    } else if (hasBth && numTables === 1) {
      // Modo Horario CON BTH: Proporcional y nítido (5.2pt) para un equilibrio visual perfecto con el banner de docentes
      subjectFontSize = '5.2pt';
      periodoFontSize = '7.8pt';
      horaFontSize = '6.6pt';
    } else if (numTables > 1) {
      // Horario Central + Subcentro fusionados en 1 hoja
      subjectFontSize = hasBth ? '4.5pt' : '5.2pt';
      periodoFontSize = '7.5pt';
      horaFontSize = '6.5pt';
    }

    pageEl.style.setProperty('--print-subject-font-size', subjectFontSize);
    pageEl.style.setProperty('--print-periodo-font-size', periodoFontSize);
    pageEl.style.setProperty('--print-hora-font-size', horaFontSize);
  }

  function imprimirHorarioActual(turnoOverride) {
    const turno = detectarTurnoActivo(turnoOverride);

    if (turno === 'hum') {
      aplicarOrientacionImpresionHorario('landscape', 'hum');
    } else {
      aplicarOrientacionImpresionHorario('portrait', 'tec');
    }

    document.body.classList.add('printing-horario');
    document.body.classList.remove('printing-kardex', 'printing-comprobante', 'printing-reporte');

    let printArea = document.getElementById('horario-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'horario-print-area';
      document.body.appendChild(printArea);
    }

    const container = document.getElementById('tabla-horario-matriz-container');
    if (!container) {
      if (typeof mostrarAlertaModal === 'function') {
        mostrarAlertaModal('No se encontró la tabla de horarios para imprimir.', 'Impresión de Horario', 'warning');
      } else if (typeof mostrarToastLive === 'function') {
        mostrarToastLive('No se encontró la tabla de horarios para imprimir.');
      }
      return;
    }

    const anio = new Date().getFullYear();
    const curSedePrint = localStorage.getItem('cea_sede_activa') ? JSON.parse(localStorage.getItem('cea_sede_activa')) : 'central';

    const cloned = container.cloneNode(true);

    // Remover controles de edición, barras y herramientas
    cloned.querySelectorAll(
      '.horario-toolbar-no-print, .btn-admin-only, .inline-edit-pencil-btn, ' +
      '.gestor-edit-badge, .btn-edit-modulo-bth, .btn-col-control, .btn-del-periodo-tabla, ' +
      '.horario-publico-badge-wrap, .horario-editor-cards-wrap, .gestor-time-edit-btn, ' +
      '.no-print-edit, .no-print, .gestor-cell-free-label, .ttp-header-title, .subcentro-ubicacion-banner'
    ).forEach(el => el.remove());

    // Limpiar el texto "Editar" en los bloques de hora
    cloned.querySelectorAll('.gestor-time-stack span, .gestor-time-stack div').forEach(el => {
      if (el.textContent.trim().toLowerCase() === 'editar') {
        el.remove();
      }
    });

    // Limpiar celdas libres
    cloned.querySelectorAll('.gestor-cell-free, .gestor-cell-free-label').forEach(el => {
      el.innerHTML = '';
    });
    cloned.querySelectorAll('td').forEach(td => {
      if (td.textContent.trim() === 'Libre (Asignar)' || td.textContent.trim() === 'Libre' || td.querySelector('.gestor-cell-free')) {
        td.innerHTML = '';
        td.style.background = 'transparent';
      }
    });

    // Cajas BTH en modo edición
    cloned.querySelectorAll('.bth-inline-edit-box').forEach(box => {
      const textarea = box.querySelector('textarea');
      const val = textarea ? textarea.value : '';
      const div = document.createElement('div');
      div.style.fontSize = '0.78rem';
      div.style.color = '#475569';
      div.style.lineHeight = '1.35';
      div.textContent = val;
      box.parentNode.replaceChild(div, box);
    });

    // Convertir selects de materia BTH en texto oficial visible antes de limpiar selects
    cloned.querySelectorAll('.bth-area-badge').forEach(badge => {
      const select = badge.querySelector('select.bth-materia-select');
      const printSpan = badge.querySelector('.bth-print-only-text');
      let materiaTexto = '';
      if (select && select.value) {
        materiaTexto = select.value;
      } else if (printSpan && printSpan.textContent.trim()) {
        materiaTexto = printSpan.textContent.trim();
      } else {
        materiaTexto = badge.textContent.trim();
      }

      badge.innerHTML = '';
      const textEl = document.createElement('span');
      textEl.className = 'bth-materia-impresion-texto';
      textEl.textContent = materiaTexto;
      textEl.style.cssText = 'display:inline-block !important; visibility:visible !important; opacity:1 !important; font-weight:900 !important; font-size:7.0pt !important; text-transform:uppercase !important; text-align:center !important; width:100% !important; line-height:1.15 !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;';
      badge.appendChild(textEl);
    });

    const paletaActiva = (typeof lsGet === 'function' ? lsGet('cea_horario_paleta_colores', 'multicolor') : (localStorage.getItem('cea_horario_paleta_colores') ? JSON.parse(localStorage.getItem('cea_horario_paleta_colores')) : 'multicolor'));
    const isEco = (paletaActiva === 'economica');

    // Vinculación visual de módulos BTH con su materia/docente:
    // En Multicolor y Verde: El nivel (Técnico Básico, Auxiliar, Medio) adquiere el mismo fondo que su materia
    // En Ahorro de Tinta: Fondo blanco puro con borde 2px de color y texto de alta nitidez sin gasto de tinta
    cloned.querySelectorAll('.bth-doc-row').forEach(row => {
      const badge = row.querySelector('.bth-area-badge');
      let materiaNombre = '';
      const materiaSpan = row.querySelector('.bth-materia-impresion-texto, .bth-area-badge span');
      if (materiaSpan && materiaSpan.textContent.trim()) {
        materiaNombre = materiaSpan.textContent.trim();
      }

      const st = (typeof obtenerEstilosMateria === 'function')
        ? obtenerEstilosMateria(materiaNombre, 'hum')
        : { bg: '#ffffff', txt: '#0284c7', border: '#0284c7', accent: '#0284c7', isEco: isEco };

      if (isEco) {
        if (badge) {
          badge.style.setProperty('background-color', '#ffffff', 'important');
          badge.style.setProperty('background', '#ffffff', 'important');
          badge.style.setProperty('color', st.accent || st.txt, 'important');
          badge.style.setProperty('border', `2px solid ${st.accent || st.border}`, 'important');
        }
        row.querySelectorAll('.mod-lvl-badge').forEach(lvlBadge => {
          lvlBadge.style.setProperty('background-color', '#ffffff', 'important');
          lvlBadge.style.setProperty('background', '#ffffff', 'important');
          lvlBadge.style.setProperty('color', st.accent || st.txt, 'important');
          lvlBadge.style.setProperty('border', `1.5px solid ${st.accent || st.border}`, 'important');
          lvlBadge.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
          lvlBadge.style.setProperty('print-color-adjust', 'exact', 'important');
        });
      } else {
        let bgMateria = badge ? (badge.style.backgroundColor || badge.style.background) : '';
        let txtMateria = badge ? badge.style.color : '';

        if ((!bgMateria || bgMateria === 'transparent') && materiaNombre) {
          bgMateria = st.bg;
          txtMateria = st.txt;
        }

        if (badge && bgMateria) {
          badge.style.setProperty('background-color', bgMateria, 'important');
          badge.style.setProperty('background', bgMateria, 'important');
          badge.style.setProperty('color', txtMateria || '#ffffff', 'important');
        }

        if (bgMateria) {
          row.querySelectorAll('.mod-lvl-badge').forEach(lvlBadge => {
            lvlBadge.style.setProperty('background-color', bgMateria, 'important');
            lvlBadge.style.setProperty('background', bgMateria, 'important');
            lvlBadge.style.setProperty('color', txtMateria || '#ffffff', 'important');
            lvlBadge.style.setProperty('border', 'none', 'important');
            lvlBadge.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
            lvlBadge.style.setProperty('print-color-adjust', 'exact', 'important');
          });
        }
      }
    });

    if (paletaActiva === 'verde') {
      // En la paleta verde institucional: Remover sombra de texto para Ciencias Sociales y Lenguaje
      cloned.querySelectorAll('.cs-print-shadow, .bth-len .gestor-cell-subject-title, .bth-cs .gestor-cell-subject-title').forEach(el => {
        el.style.setProperty('text-shadow', 'none', 'important');
        el.classList.remove('cs-print-shadow');
      });
      cloned.querySelectorAll('.gestor-cell-card').forEach(card => {
        const tit = card.querySelector('.gestor-cell-subject-title');
        const txt = tit ? tit.textContent.toLowerCase() : '';
        if (txt.includes('lengua') || txt.includes('literat') || txt.includes('redacc') || txt.includes('comunicac') ||
            txt.includes('social') || txt.includes('histor') || txt.includes('cívic') || txt.includes('civic') || txt.includes('geograf')) {
          if (tit) tit.style.setProperty('text-shadow', 'none', 'important');
        }
      });
    } else if (isEco) {
      // En la paleta económica (ahorro de tinta): Remover todas las sombras para máxima nitidez sobre fondo blanco
      cloned.querySelectorAll('.cs-print-shadow, .gestor-cell-subject-title, .bth-len .gestor-cell-subject-title, .bth-cs .gestor-cell-subject-title, .bth-celda-materia span, .bth-materia-text-print').forEach(el => {
        el.style.setProperty('text-shadow', 'none', 'important');
        el.classList.remove('cs-print-shadow');
      });
    } else {
      // En la paleta multicolor: Mantener sombra de texto intacta
      cloned.querySelectorAll('.cs-print-shadow').forEach(el => {
        el.style.setProperty('text-shadow', '0 1px 2px rgba(0, 0, 0, 0.5)', 'important');
      });
    }

    cloned.querySelectorAll('.bth-celda-materia span[style*="position:absolute"]').forEach(el => el.remove());

    // Tarjetas de materia y celdas BTH en tabla
    cloned.querySelectorAll('.gestor-cell-card, .bth-celda-materia').forEach(card => {
      card.style.setProperty('width', 'calc(100% - 2px)', 'important');
      card.style.setProperty('max-width', 'calc(100% - 2px)', 'important');
      card.style.setProperty('margin', '0 1px', 'important');
      card.style.setProperty('box-sizing', 'border-box', 'important');
      card.style.setProperty('border-radius', '4px', 'important');
      card.style.setProperty('visibility', 'visible', 'important');
      card.style.setProperty('opacity', '1', 'important');

      if (isEco) {
        // Paleta 3: Ahorro de tinta (Sin Relleno / Bordes y texto nítidos)
        card.style.setProperty('background-color', '#ffffff', 'important');
        card.style.setProperty('background', '#ffffff', 'important');
        card.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
        card.style.setProperty('print-color-adjust', 'exact', 'important');

        let matName = '';
        const tit = card.querySelector('.gestor-cell-subject-title');
        if (tit) matName = tit.textContent.trim();
        else {
          const sp = card.querySelector('span');
          if (sp) matName = sp.textContent.trim();
        }

        let accentBorder = '#0284c7';
        if (card.classList.contains('bth-mat')) accentBorder = '#d97706';
        else if (card.classList.contains('bth-cs')) accentBorder = '#dc2626';
        else if (card.classList.contains('bth-len')) accentBorder = '#334155';
        else if (card.classList.contains('bth-cn')) accentBorder = '#0284c7';
        else if (matName && typeof obtenerEstilosMateria === 'function') {
          const st = obtenerEstilosMateria(matName, 'hum');
          accentBorder = st.accent || st.border || '#0284c7';
        }

        card.style.setProperty('border', `2px solid ${accentBorder}`, 'important');
        card.style.setProperty('border-color', accentBorder, 'important');
        card.style.setProperty('color', accentBorder, 'important');

        if (tit) {
          tit.style.setProperty('color', accentBorder, 'important');
          tit.style.setProperty('text-shadow', 'none', 'important');
        }
        card.querySelectorAll('span:not(.gestor-cell-teacher span):not(.gestor-cell-sub)').forEach(sp => {
          if (!sp.closest('.gestor-cell-teacher') && !sp.closest('.gestor-cell-sub')) {
            sp.style.setProperty('color', accentBorder, 'important');
            sp.style.setProperty('text-shadow', 'none', 'important');
          }
        });
        const teacher = card.querySelector('.gestor-cell-teacher');
        if (teacher) {
          teacher.style.setProperty('color', '#334155', 'important');
          teacher.querySelectorAll('span').forEach(sp => sp.style.setProperty('color', '#334155', 'important'));
          teacher.querySelectorAll('svg').forEach(svg => svg.style.setProperty('stroke', '#334155', 'important'));
        }
        const sub = card.querySelector('.gestor-cell-sub');
        if (sub) {
          sub.style.setProperty('color', '#64748b', 'important');
        }
      } else {
        const bg = card.style.backgroundColor || card.style.background;
        if (bg && bg !== 'transparent') {
          card.style.setProperty('background-color', bg, 'important');
          card.style.setProperty('background', bg, 'important');
          card.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
          card.style.setProperty('print-color-adjust', 'exact', 'important');
        }
      }
    });

    // Asegurar visibilidad de nombres de materias dentro de celdas BTH
    cloned.querySelectorAll('.bth-celda-materia span').forEach(sp => {
      sp.style.setProperty('visibility', 'visible', 'important');
      sp.style.setProperty('opacity', '1', 'important');
      sp.style.setProperty('display', 'block', 'important');
      sp.style.setProperty('font-size', 'var(--print-subject-font-size, 5.2pt)', 'important');
      sp.style.setProperty('font-weight', '800', 'important');
      sp.style.setProperty('text-align', 'center', 'important');
      sp.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
      sp.style.setProperty('print-color-adjust', 'exact', 'important');
    });

    // Remover selects restantes
    cloned.querySelectorAll('select').forEach(sel => sel.remove());

    // Encabezados de cursos con estilo elegante: si no entra en una fila, entra en dos filas
    cloned.querySelectorAll('.bth-curso-select-wrap, .gestor-th-track-box, .bth-curso-th, .th-curso-sub').forEach(box => {
      box.style.setProperty('background', '#ffffff', 'important');
      box.style.setProperty('background-color', '#ffffff', 'important');
      box.style.setProperty('border', '1.5px solid #94a3b8', 'important');
      box.style.setProperty('border-radius', '6px', 'important');
      box.style.setProperty('box-shadow', 'none', 'important');
      box.style.setProperty('min-height', '22px', 'important');
      box.style.setProperty('padding', '2px 1px', 'important');
      box.style.setProperty('display', 'flex', 'important');
      box.style.setProperty('align-items', 'center', 'important');
      box.style.setProperty('justify-content', 'center', 'important');
      box.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
      box.style.setProperty('print-color-adjust', 'exact', 'important');
    });

    cloned.querySelectorAll('.bth-curso-label-text, .gestor-th-track-text').forEach(lbl => {
      let txt = lbl.textContent.trim();
      // Si contiene palabras largas que no entran en una fila (como COMPLEMENTARIOS o ESPECIALIZADOS),
      // permitir que entre en dos filas de texto limpias con un punto de corte silábico inteligente
      if (/complementarios/i.test(txt)) {
        lbl.innerHTML = txt.replace(/comple/i, 'COMPLE-<wbr>');
      } else if (/especializados/i.test(txt)) {
        lbl.innerHTML = txt.replace(/especia/i, 'ESPECIA-<wbr>');
      }
      lbl.style.setProperty('color', '#334155', 'important');
      lbl.style.setProperty('font-weight', '900', 'important');
      lbl.style.setProperty('font-size', '5.2pt', 'important');
      lbl.style.setProperty('letter-spacing', '-0.1px', 'important');
      lbl.style.setProperty('line-height', '1.05', 'important');
      lbl.style.setProperty('white-space', 'normal', 'important');
      lbl.style.setProperty('word-break', 'break-word', 'important');
      lbl.style.setProperty('overflow-wrap', 'anywhere', 'important');
      lbl.style.setProperty('text-align', 'center', 'important');
      lbl.style.setProperty('width', '100%', 'important');
      lbl.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
      lbl.style.setProperty('print-color-adjust', 'exact', 'important');
    });

    // En Humanística: estilizar píldoras de día e inyectar separadores sin duplicar
    if (turno === 'hum') {
      cloned.querySelectorAll('thead tr:first-child th.gestor-th-day').forEach(thDay => {
        thDay.style.setProperty('background', 'transparent', 'important');
        thDay.style.setProperty('border', 'none', 'important');
        thDay.style.setProperty('padding', '1px 0', 'important');
        thDay.style.setProperty('box-sizing', 'border-box', 'important');
        const dayBox = thDay.querySelector('.gestor-th-day-box');
        if (dayBox) {
          if (isEco) {
            let dayText = dayBox.querySelector('span') ? dayBox.querySelector('span').textContent.toLowerCase() : dayBox.textContent.toLowerCase();
            let dayColor = '#334155';
            if (dayText.includes('lunes')) dayColor = '#0284c7';
            else if (dayText.includes('martes')) dayColor = '#059669';
            else if (dayText.includes('miercol') || dayText.includes('miércol')) dayColor = '#d97706';
            else if (dayText.includes('jueves')) dayColor = '#7c3aed';
            else if (dayText.includes('viernes')) dayColor = '#dc2626';
            else if (dayText.includes('sabad') || dayText.includes('sábad')) dayColor = '#ea580c';
            else if (dayText.includes('domingo')) dayColor = '#0d9488';

            dayBox.style.cssText = `display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:center !important; gap:1px !important; width:calc(100% - 2px) !important; max-width:calc(100% - 2px) !important; margin:0 1px !important; padding:3px 2px !important; border-radius:6px !important; background:#ffffff !important; background-color:#ffffff !important; color:${dayColor} !important; border:2px solid ${dayColor} !important; box-sizing:border-box !important; font-weight:900 !important; font-size:8.5pt !important; text-transform:uppercase !important; box-shadow:none !important; text-shadow:none !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;`;
            dayBox.querySelectorAll('span:not(.ttp-day-sub)').forEach(sp => {
              sp.style.setProperty('color', dayColor, 'important');
              sp.style.setProperty('text-shadow', 'none', 'important');
            });
            const sub = dayBox.querySelector('.ttp-day-sub');
            if (sub) {
              sub.style.setProperty('color', '#64748b', 'important');
              sub.style.setProperty('background', 'transparent', 'important');
              sub.style.setProperty('border', 'none', 'important');
              sub.style.setProperty('text-shadow', 'none', 'important');
              sub.style.setProperty('font-size', '6.0pt', 'important');
              sub.style.setProperty('font-weight', '800', 'important');
              sub.style.setProperty('letter-spacing', '0.4px', 'important');
              sub.style.setProperty('text-transform', 'uppercase', 'important');
            }
          } else {
            dayBox.style.cssText = 'display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:center !important; gap:1px !important; width:calc(100% - 2px) !important; max-width:calc(100% - 2px) !important; margin:0 1px !important; padding:4px 2px !important; border-radius:6px !important; background:var(--verde-dark, #166534) !important; color:#ffffff !important; box-sizing:border-box !important; font-weight:900 !important; font-size:8.5pt !important; text-transform:uppercase !important; border:none !important; box-shadow:none !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;';
            const sub = dayBox.querySelector('.ttp-day-sub');
            if (sub) {
              sub.style.setProperty('font-size', '6.0pt', 'important');
              sub.style.setProperty('font-weight', '800', 'important');
              sub.style.setProperty('text-transform', 'uppercase', 'important');
              sub.style.setProperty('color', '#ffffff', 'important');
              sub.style.setProperty('opacity', '0.92', 'important');
              sub.style.setProperty('letter-spacing', '0.4px', 'important');
              sub.style.setProperty('padding', '0.5px 4px', 'important');
              sub.style.setProperty('background', 'rgba(255,255,255,0.18)', 'important');
              sub.style.setProperty('border-radius', '4px', 'important');
              sub.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
              sub.style.setProperty('print-color-adjust', 'exact', 'important');
            }
          }
        }
      });

      let sepsAdded = 0;
      cloned.querySelectorAll('tr').forEach(tr => {
        const endCells = Array.from(tr.children).filter(cell => cell.classList.contains('day-group-end'));
        const lastCellInRow = tr.lastElementChild;
        let countInRow = 0;
        endCells.forEach(cell => {
          if (cell !== lastCellInRow && !cell.nextElementSibling?.classList.contains('day-red-separator')) {
            countInRow++;
            const isTh = cell.tagName.toLowerCase() === 'th';
            const sep = document.createElement(isTh ? 'th' : 'td');
            sep.className = 'day-red-separator';
            sep.style.cssText = 'width:6px !important; min-width:6px !important; max-width:6px !important; background:#ffffff !important; background-color:#ffffff !important; padding:0 !important; margin:0 !important; border:none !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;';
            if (cell.hasAttribute('rowspan')) {
              sep.setAttribute('rowspan', cell.getAttribute('rowspan'));
            }
            cell.after(sep);
          }
        });
        if (countInRow > sepsAdded) sepsAdded = countInRow;
      });

      if (sepsAdded > 0) {
        cloned.querySelectorAll('td[colspan], th[colspan]').forEach(cell => {
          const cSpan = parseInt(cell.getAttribute('colspan'), 10);
          if (cSpan > 10 && !cell.classList.contains('gestor-th-day')) {
            cell.setAttribute('colspan', cSpan + sepsAdded);
          }
        });
      }
    }

    if (isEco) {
      cloned.querySelectorAll('.ttp-day-header-box').forEach(dayBox => {
        let dayText = dayBox.querySelector('.ttp-day-name') ? dayBox.querySelector('.ttp-day-name').textContent.toLowerCase() : dayBox.textContent.toLowerCase();
        let dayColor = '#334155';
        if (dayText.includes('lunes')) dayColor = '#0284c7';
        else if (dayText.includes('martes')) dayColor = '#059669';
        else if (dayText.includes('miercol') || dayText.includes('miércol')) dayColor = '#d97706';
        else if (dayText.includes('jueves')) dayColor = '#7c3aed';
        else if (dayText.includes('viernes')) dayColor = '#dc2626';
        else if (dayText.includes('sabad') || dayText.includes('sábad')) dayColor = '#ea580c';
        else if (dayText.includes('domingo')) dayColor = '#0d9488';

        dayBox.style.setProperty('background', '#ffffff', 'important');
        dayBox.style.setProperty('background-color', '#ffffff', 'important');
        dayBox.style.setProperty('border', `2px solid ${dayColor}`, 'important');
        dayBox.style.setProperty('color', dayColor, 'important');
        dayBox.style.setProperty('box-shadow', 'none', 'important');
        dayBox.style.setProperty('text-shadow', 'none', 'important');

        const nameSpan = dayBox.querySelector('.ttp-day-name');
        if (nameSpan) {
          nameSpan.style.setProperty('color', dayColor, 'important');
          nameSpan.style.setProperty('text-shadow', 'none', 'important');
        }
        const sub = dayBox.querySelector('.ttp-day-sub');
        if (sub) {
          sub.style.setProperty('color', '#64748b', 'important');
          sub.style.setProperty('background', 'transparent', 'important');
          sub.style.setProperty('text-shadow', 'none', 'important');
        }
      });
    }
    let carrerasTecCardHtml = '';
    if (turno === 'tec') {
      const carrerasList = obtenerCarrerasTecnicasConDocentesPrint();
      carrerasTecCardHtml = `
        <div class="carreras-tec-print-card" style="margin-top:6px; width:100%; border:none; background:transparent; font-family:Arial, sans-serif; flex:0 0 auto;">
          <div style="color:var(--verde-dark, #166534); font-weight:900; font-size:8.8pt; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:5px; border-bottom:2px solid var(--verde-dark, #166534); display:inline-block; padding-bottom:1px;">
            CARRERAS TÉCNICAS
          </div>
          <div class="carreras-tec-col-list" style="display:flex; flex-direction:column; gap:4px; width:100%; box-sizing:border-box;">
            ${carrerasList.map(c => `
              <div class="carrera-item-gradita" style="text-align:left; line-height:1.25;">
                <div style="margin-left:22px; font-weight:900; font-size:8.0pt; color:var(--verde-dark, #166534); text-transform:uppercase; letter-spacing:0.3px;">
                  ▸ ${escapeHtmlSub(c.nombre)}
                </div>
                <div style="margin-left:44px; font-weight:600; font-size:7.5pt; color:#1e293b;">
                  • ${escapeHtmlSub(c.docente)}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // ══════════════════════════════════════════════════════════════════════════
    // DETECCIÓN INTELIGENTE DE SUBCENTROS Y BTH PARA DECIDIR PAGINACIÓN
    // ══════════════════════════════════════════════════════════════════════════
    const subcentroBloques = Array.from(cloned.querySelectorAll('.subcentro-bloque-unificado'));
    const tieneSubcentros = (subcentroBloques.length > 0);

    // 1. Detectar si Central tiene BTH
    let centralTieneBth = false;
    try {
      if (typeof window.getSedeLsData === 'function') {
        centralTieneBth = (turno === 'hum') && window.getSedeLsData('cea_horario_incluir_bth', true, 'central', 'hum');
      } else {
        const val = localStorage.getItem('cea_horario_incluir_bth_central_hum');
        if (val !== null) centralTieneBth = (turno === 'hum') && JSON.parse(val);
      }
    } catch (e) {}

    // Si no está en LS, verificar en el DOM si el banner de Central existe y no está oculto
    const centralBthBannerInDom = cloned.querySelector(':scope > .bth-docentes-banner, .gestor-schedule-wrap + .bth-docentes-banner');
    if (centralBthBannerInDom && centralBthBannerInDom.style.display !== 'none') {
      centralTieneBth = true;
    }

    // 2. Detectar si algún subcentro tiene BTH
    let anySubcentroTieneBth = false;
    subcentroBloques.forEach(sb => {
      const subBthEl = sb.querySelector('.bth-docentes-banner');
      if (subBthEl && subBthEl.style.display !== 'none') {
        anySubcentroTieneBth = true;
      }
    });

    // EVALUACIÓN DE DESBORDE PARA HORARIO FUSIONADO (CENTRAL + SUBCENTRO):
    // Opción 1: Si los horarios caben juntos en una sola hoja, se imprimen fusionados en 1 hoja.
    // Opción 2: Solo si el horario combinado es extenso y se desborda de la hoja (o hay múltiples subcentros),
    //           se separa automáticamente en hojas independientes (Página 1: Central, Página 2+: Subcentro).
    // Si NO hay subcentros (horario solo), NUNCA se separa y mantiene 100% intacta su configuración original.
    let debeSepararEnHojas = false;
    if (tieneSubcentros) {
      const centralScheduleEl = cloned.querySelector(':scope > .gestor-schedule-wrap, .gestor-schedule-wrap');
      const centralRows = Array.from(centralScheduleEl ? centralScheduleEl.querySelectorAll('tbody tr') : []);
      const centralClassRows = centralRows.filter(tr => 
        !tr.classList.contains('gestor-row-recreo') && 
        !tr.classList.contains('ttp-receso-row') &&
        !tr.querySelector('.bth-recreo, .gestor-recreo-banner, .ttp-receso-cell')
      );
      const centralRecreos = centralRows.length - centralClassRows.length;

      let subClassRowsTotal = 0;
      let subRecreosTotal = 0;
      subcentroBloques.forEach(sb => {
        const subRows = Array.from(sb.querySelectorAll('tbody tr'));
        const subClassRows = subRows.filter(tr => 
          !tr.classList.contains('gestor-row-recreo') && 
          !tr.classList.contains('ttp-receso-row') &&
          !tr.querySelector('.bth-recreo, .gestor-recreo-banner, .ttp-receso-cell')
        );
        subClassRowsTotal += subClassRows.length;
        subRecreosTotal += (subRows.length - subClassRows.length);
      });

      const totalClassRows = centralClassRows.length + subClassRowsTotal;
      const totalRecreos = centralRecreos + subRecreosTotal;
      const numSubcentros = subcentroBloques.length;

      // Estimación de altura requerida para no desbordar la hoja (en Letter Landscape ~735px útiles):
      const headerMembreteHeight = 68;
      const subcentroHeadersHeight = numSubcentros * 26;
      const theadTotalHeight = (1 + numSubcentros) * 34;
      const recreosTotalHeight = totalRecreos * 18;
      const bthBannersHeight = (centralTieneBth ? 98 : 0) + (anySubcentroTieneBth ? 98 : 0);
      const minClassRowsHeight = totalClassRows * 31;

      const alturaTotalEstimada = headerMembreteHeight + subcentroHeadersHeight + theadTotalHeight + recreosTotalHeight + bthBannersHeight + minClassRowsHeight;

      // Se desborda si la altura necesaria supera el límite útil de la hoja (735px) o si se abre un 3er horario (más de 1 subcentro)
      debeSepararEnHojas = (alturaTotalEstimada > 735) || (numSubcentros > 1);
    }

    if (debeSepararEnHojas) {
      // ══════════════════════════════════════════════════════════════════════
      // MODO MULTI-PÁGINA: Hojas separadas e independientes al 100% cada una
      // ══════════════════════════════════════════════════════════════════════
      let pagesHtml = '';

      // ── PÁGINA 1: SEDE CENTRAL ──
      const centralTituloArea = (turno === 'hum')
        ? (centralTieneBth ? 'ÁREA HUMANÍSTICA (BTH) • SEDE CENTRAL' : 'ÁREA HUMANÍSTICA • SEDE CENTRAL')
        : 'ÁREA TÉCNICA (TTP) • SEDE CENTRAL';
      const membreteCentral = generarMembreteOficialHtml('Horario Oficial', centralTituloArea, anio);

      // Extraer solo la tabla y el banner BTH de Central
      const centralScheduleEl = cloned.querySelector(':scope > .gestor-schedule-wrap, .gestor-schedule-wrap');
      let centralScheduleHtml = centralScheduleEl ? centralScheduleEl.outerHTML : '';
      let centralBthHtml = '';
      if (centralTieneBth && centralBthBannerInDom) {
        centralBthHtml = centralBthBannerInDom.outerHTML;
      }

      pagesHtml += `
        <div class="horario-print-page print-page-central" data-paleta="${paletaActiva}" data-has-bth="${centralTieneBth ? '1' : '0'}" style="font-family:Arial, 'Segoe UI', sans-serif; padding:0; margin:0 auto; color:#0f172a; background:#ffffff; font-size:8.5pt; box-sizing:border-box; width:100%; min-height:calc(100vh - 2px); height:auto; display:flex; flex-direction:column; justify-content:flex-start; page-break-after:always; break-after:page; overflow:visible;">
          ${membreteCentral}
          <div class="horario-impresion-tabla-wrap" style="${turno === 'tec' ? 'flex:0 0 auto; margin-bottom:0;' : 'flex:1 1 auto;'} display:flex; flex-direction:column; min-height:0; width:100%;">
            ${centralScheduleHtml}
            ${centralBthHtml}
          </div>
          ${carrerasTecCardHtml}
        </div>
      `;

      // ── PÁGINA 2+ : CADA SUBCENTRO ──
      subcentroBloques.forEach((subBloque, sIdx) => {
        const isLastSub = (sIdx === subcentroBloques.length - 1);
        const subTitleEl = subBloque.querySelector('.subcentro-bloque-titulo, .subcentro-print-header');
        let nombreSub = 'Subcentro';
        if (subTitleEl) {
          const rawTxt = subTitleEl.textContent.trim().replace(/\s+/g, ' ');
          const matchSub = rawTxt.match(/SUBCENTRO\s*\/\s*ANEXO:\s*([^•\n]+)/i);
          nombreSub = matchSub ? matchSub[1].trim() : rawTxt.split('•')[0].replace(/SUBCENTRO\s*\/?\s*ANEXO:?/i, '').trim();
        }

        const subBthEl = subBloque.querySelector('.bth-docentes-banner');
        const subTieneBth = Boolean(subBthEl && subBthEl.style.display !== 'none');

        const subTituloArea = (turno === 'hum')
          ? (subTieneBth ? `ÁREA HUMANÍSTICA (BTH) • SUBCENTRO: ${nombreSub.toUpperCase()}` : `ÁREA HUMANÍSTICA • SUBCENTRO: ${nombreSub.toUpperCase()}`)
          : `ÁREA TÉCNICA (TTP) • SUBCENTRO: ${nombreSub.toUpperCase()}`;

        const membreteSub = generarMembreteOficialHtml('Horario Oficial', subTituloArea, anio);

        const subScheduleEl = subBloque.querySelector('.gestor-schedule-wrap');
        const subScheduleHtml = subScheduleEl ? subScheduleEl.outerHTML : '';
        const subBthHtml = (subTieneBth && subBthEl) ? subBthEl.outerHTML : '';

        const pageBreakStyle = isLastSub ? 'page-break-after:auto; break-after:auto;' : 'page-break-after:always; break-after:page;';

        pagesHtml += `
          <div class="horario-print-page print-page-subcentro" data-paleta="${paletaActiva}" data-has-bth="${subTieneBth ? '1' : '0'}" style="font-family:Arial, 'Segoe UI', sans-serif; padding:0; margin:0 auto; color:#0f172a; background:#ffffff; font-size:8.5pt; box-sizing:border-box; width:100%; min-height:calc(100vh - 2px); height:auto; display:flex; flex-direction:column; justify-content:flex-start; ${pageBreakStyle} overflow:visible;">
            ${membreteSub}
            <div class="horario-impresion-tabla-wrap" style="flex:1 1 auto; display:flex; flex-direction:column; min-height:0; width:100%;">
              ${subScheduleHtml}
              ${subBthHtml}
            </div>
          </div>
        `;
      });

      printArea.innerHTML = pagesHtml;

      // Aplicar distribución de alturas de 100% de página para CADA página de forma independiente
      printArea.querySelectorAll('.horario-print-page').forEach(pageEl => {
        const pageHasBth = (pageEl.getAttribute('data-has-bth') === '1');
        distribuirAlturasImpresion(pageEl, turno, pageHasBth, 1);
      });

    } else {
      // ══════════════════════════════════════════════════════════════════════
      // MODO HOJA ÚNICA: Ocupa el 100% de 1 sola página
      // (Aplica para: Sede sola con o sin BTH, o Central + Subcentro ambos SIN BTH)
      // ══════════════════════════════════════════════════════════════════════
      // Si están en modo unificado sin BTH, transformar el título de subcentro a banner limpio
      cloned.querySelectorAll('.subcentro-bloque-titulo').forEach(header => {
        const texto = header.textContent.trim().replace(/\s+/g, ' ');
        const subHeader = document.createElement('div');
        subHeader.className = 'subcentro-print-header';
        subHeader.style.cssText = 'background:var(--verde-dark, #166534) !important; color:#ffffff !important; padding:3px 8px !important; border-radius:4px !important; font-weight:900 !important; font-size:8pt !important; margin:4px 0 2px 0 !important; display:flex !important; justify-content:space-between !important; align-items:center !important; text-transform:uppercase !important; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important;';
        subHeader.innerHTML = `
          <span>${escapeHtmlSub(texto.split('•')[0] || texto)}</span>
          <span style="font-size:7pt;opacity:0.9;">HORARIO OFICIAL INTEGRADO</span>
        `;
        header.parentNode.replaceChild(subHeader, header);
      });

      // Si ninguno tiene BTH, remover cualquier banner BTH sobrante
      if (!centralTieneBth && !anySubcentroTieneBth) {
        cloned.querySelectorAll('.bth-docentes-banner').forEach(el => el.remove());
      }
      cloned.querySelectorAll('[style*="display: none"], [style*="display:none"]').forEach(el => el.remove());

      let tituloUnico = (turno === 'hum')
        ? (centralTieneBth ? 'ÁREA HUMANÍSTICA (BTH)' : 'ÁREA HUMANÍSTICA')
        : 'ÁREA TÉCNICA TECNOLÓGICA PRODUCTIVA (TTP)';

      if (tieneSubcentros) {
        tituloUnico += ' • COMPENDIO UNIFICADO (SEDE CENTRAL + SUBCENTROS)';
      }

      const membreteUnico = generarMembreteOficialHtml('Horario Oficial', tituloUnico, anio);

      printArea.innerHTML = `
        <div class="horario-print-page horario-print-document ${tieneSubcentros ? 'fused-single-sheet' : ''}" data-paleta="${paletaActiva}" data-has-bth="${centralTieneBth ? '1' : '0'}" style="font-family:Arial, 'Segoe UI', sans-serif; padding:0; margin:0 auto; color:#0f172a; background:#ffffff; font-size:8.5pt; box-sizing:border-box; width:100%; min-height:calc(100vh - 2px); height:auto; display:flex; flex-direction:column; justify-content:flex-start; page-break-after:auto; break-after:auto; overflow:visible;">
          ${membreteUnico}
          <div class="horario-impresion-tabla-wrap" style="${turno === 'tec' ? 'flex:0 0 auto; margin-bottom:0;' : 'flex:1 1 auto;'} display:flex; flex-direction:column; min-height:0; width:100%;">
            ${cloned.innerHTML}
          </div>
          ${carrerasTecCardHtml}
        </div>
      `;

      const singlePage = printArea.querySelector('.horario-print-page');
      if (singlePage) {
        distribuirAlturasImpresion(singlePage, turno, centralTieneBth, tieneSubcentros ? 2 : 1);
      }
    }

    printArea.setAttribute('data-paleta', paletaActiva);
    printArea.style.display = 'block';

    let printCleaned = false;
    const limpiarHorarioPrint = () => {
      if (printCleaned) return;
      printCleaned = true;
      document.body.classList.remove('printing-horario', 'print-turno-hum', 'print-turno-tec');
      if (printArea) {
        printArea.innerHTML = '';
        printArea.style.display = 'none';
      }
      window.removeEventListener('afterprint', limpiarHorarioPrint);
    };
    window.addEventListener('afterprint', limpiarHorarioPrint, { once: true });

    setTimeout(() => {
      window.print();
    }, 150);
  }

  // Exportar al ámbito global
  window.imprimirHorarioActual = imprimirHorarioActual;
  window.aplicarOrientacionImpresionHorario = aplicarOrientacionImpresionHorario;
  window.toggleLineasImpresionHorario = toggleLineasImpresionHorario;
  window.obtenerCarrerasTecnicasConDocentesPrint = obtenerCarrerasTecnicasConDocentesPrint;
})();
