/* ==========================================================================
   MÓDULO EXCLUSIVO Y ORQUESTADOR DE IMPRESIÓN DE KARDEX DOCENTE
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN 2026
   Soporte modular para:
   - Diseño 1: Oficial Tradicional (kardex-diseno1.css / kardex-diseno1.js)
   - Diseño 2: Institucional Verde CEA (kardex-diseno2.css / kardex-diseno2.js)
   Márgenes: 2 cm (20 mm) exactos a izquierda y derecha
   ========================================================================== */

(function () {
  'use strict';

  // Preferencia activa de diseño: 1 (Tradicional) o 2 (Verde Institucional)
  let disenoActivo = parseInt(localStorage.getItem('cea_kardex_diseno_activo') || '1', 10);
  if (disenoActivo !== 1 && disenoActivo !== 2) disenoActivo = 1;

  function setKardexDisenoActivo(num) {
    disenoActivo = (num === 2 || num === '2') ? 2 : 1;
    localStorage.setItem('cea_kardex_diseno_activo', String(disenoActivo));
  }

  function getKardexDisenoActivo() {
    return disenoActivo;
  }

  function aplicarOrientacionKardex(diseno = disenoActivo) {
    let styleTag = document.getElementById('cea-dynamic-page-orientation');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'cea-dynamic-page-orientation';
      document.head.appendChild(styleTag);
    }
    const supHoja1 = '10mm'; // 1 cm (10mm) exacto para Hoja 1 en ambos diseños (Versión 1 y Versión 2)
    // Hoja 1: 1 cm (10mm) en ambos diseños. Hoja 2: continuar en 2 cm (20mm). Laterales: 2 cm (20mm)
    styleTag.innerHTML = `
      @page {
      @page {
        size: letter portrait !important;
        margin: 20mm 20mm 4mm 20mm !important;
      }
      @page :first {
        margin-top: ${supHoja1} !important;
      }
      @page kardex_page1 {
        size: letter portrait !important;
        margin: ${supHoja1} 20mm 4mm 20mm !important;
      }
      @page kardex_page2 {
        size: letter portrait !important;
        margin: 20mm 20mm 4mm 20mm !important;
      }
    `;
    document.body.classList.add('print-orientation-portrait');
    document.body.classList.remove('print-orientation-landscape', 'print-turno-hum', 'print-turno-tec');
  }

  function prepararContenidoSegunDiseno(data, page1, page2, diseno = disenoActivo) {
    if (diseno === 2 && typeof window.prepararContenidoKardexDiseno2DOM === 'function') {
      window.prepararContenidoKardexDiseno2DOM(data, page1, page2);
    } else if (typeof window.prepararContenidoKardexDiseno1DOM === 'function') {
      window.prepararContenidoKardexDiseno1DOM(data, page1, page2);
    } else if (typeof window.prepararContenidoKardexDOM === 'function') {
      window.prepararContenidoKardexDOM(data, page1, page2);
    }
  }

  function prepararEImprimirKardex(docenteId, diseno = disenoActivo) {
    setKardexDisenoActivo(diseno);
    aplicarOrientacionKardex(diseno);

    const kardexMap = (typeof getKardexDocentesStorage === 'function')
      ? getKardexDocentesStorage()
      : (JSON.parse(localStorage.getItem('cea_kardex_docentes') || '{}'));

    const data = kardexMap[docenteId] || (typeof KARDEX_MODEL_DEFAULT !== 'undefined' ? JSON.parse(JSON.stringify(KARDEX_MODEL_DEFAULT)) : {});

    let printArea = document.getElementById('kardex-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'kardex-print-area';
      document.body.appendChild(printArea);
    }

    printArea.innerHTML = `
      <div id="kardex-print-page-1"></div>
      <div id="kardex-print-page-2"></div>
    `;

    const page1 = document.getElementById('kardex-print-page-1');
    const page2 = document.getElementById('kardex-print-page-2');

    prepararContenidoSegunDiseno(data, page1, page2, diseno);

    printArea.style.display = 'block';
    document.body.classList.add('printing-kardex');
    document.body.classList.remove('diseno-1', 'diseno-2');
    document.body.classList.add(diseno === 2 ? 'diseno-2' : 'diseno-1');
    document.body.classList.remove('printing-horario', 'printing-comprobante', 'printing-reporte');

    let printCleaned = false;
    const limpiarKardexPrint = () => {
      if (printCleaned) return;
      printCleaned = true;
      document.body.classList.remove('printing-kardex', 'diseno-1', 'diseno-2');
      if (printArea) {
        printArea.innerHTML = '';
        printArea.style.display = 'none';
      }
      window.removeEventListener('afterprint', limpiarKardexPrint);
    };
    window.addEventListener('afterprint', limpiarKardexPrint, { once: true });

    setTimeout(() => {
      window.print();
    }, 150);
  }

  function prepararEImprimirTodosLosKardex(filtradosSolamente = false, diseno = disenoActivo) {
    setKardexDisenoActivo(diseno);
    aplicarOrientacionKardex(diseno);

    const kardexMap = (typeof getKardexDocentesStorage === 'function')
      ? getKardexDocentesStorage()
      : (JSON.parse(localStorage.getItem('cea_kardex_docentes') || '{}'));

    const docentesAll = (typeof obtenerDocentesParaKardex === 'function') ? obtenerDocentesParaKardex() : [];

    let listaDocentes = docentesAll;
    if (filtradosSolamente) {
      const searchVal = (document.getElementById('kardex-search-input')?.value || '').toLowerCase().trim();
      const filterArea = document.getElementById('kardex-filter-area')?.value || 'todas';
      listaDocentes = docentesAll.filter(d => {
        if (filterArea === 'hum' && d.tipo !== 'hum') return false;
        if (filterArea === 'tec' && d.tipo !== 'tec') return false;
        if (searchVal) {
          const k = kardexMap[d.id] || {};
          const matchNom = (d.nombre || '').toLowerCase().includes(searchVal);
          const matchArea = (d.area || '').toLowerCase().includes(searchVal);
          const matchCI = (k.ci || '').toLowerCase().includes(searchVal);
          const matchRDA = (k.rda || '').toLowerCase().includes(searchVal);
          return matchNom || matchArea || matchCI || matchRDA;
        }
        return true;
      });
    }

    if (listaDocentes.length === 0) {
      alert('No hay registros de Kardex disponibles para imprimir.');
      return;
    }

    let printArea = document.getElementById('kardex-print-area');
    if (!printArea) {
      printArea = document.createElement('div');
      printArea.id = 'kardex-print-area';
      document.body.appendChild(printArea);
    }

    const page1 = document.createElement('div');
    page1.style.display = 'none';
    const page2 = document.createElement('div');
    page2.style.display = 'none';
    document.body.appendChild(page1);
    document.body.appendChild(page2);

    let htmlBatch = '';
    listaDocentes.forEach((docenteObj, idx) => {
      const docenteId = docenteObj.id;
      const data = kardexMap[docenteId] || (typeof KARDEX_MODEL_DEFAULT !== 'undefined' ? JSON.parse(JSON.stringify(KARDEX_MODEL_DEFAULT)) : {});

      prepararContenidoSegunDiseno(data, page1, page2, diseno);
      const p1HTML = page1.innerHTML;
      const p2HTML = page2.innerHTML;
      const p1Class = page1.className;
      const p2Class = page2.className;

      htmlBatch += `
        <div class="kardex-docente-batch-wrap">
          <div class="${p1Class}">
            ${p1HTML}
          </div>
          <div class="${p2Class}" style="${idx < listaDocentes.length - 1 ? 'page-break-after:always !important; break-after:page !important;' : ''}">
            ${p2HTML}
          </div>
        </div>
      `;
    });

    page1.remove();
    page2.remove();

    printArea.innerHTML = htmlBatch;
    printArea.style.display = 'block';

    document.body.classList.add('printing-kardex');
    document.body.classList.remove('diseno-1', 'diseno-2');
    document.body.classList.add(diseno === 2 ? 'diseno-2' : 'diseno-1');
    document.body.classList.remove('printing-horario', 'printing-comprobante', 'printing-reporte');

    let batchCleaned = false;
    const limpiarKardexBatch = () => {
      if (batchCleaned) return;
      batchCleaned = true;
      document.body.classList.remove('printing-kardex', 'diseno-1', 'diseno-2');
      if (printArea) {
        printArea.innerHTML = '';
        printArea.style.display = 'none';
      }
      window.removeEventListener('afterprint', limpiarKardexBatch);
    };
    window.addEventListener('afterprint', limpiarKardexBatch, { once: true });

    setTimeout(() => {
      window.print();
    }, 150);
  }

  async function imprimirKardexActual(diseno = disenoActivo) {
    const id = document.getElementById('kardex-docente-id')?.value || window.kardexDocenteActualId || 'hum-mat';
    if (typeof window.guardarKardexActual === 'function') {
      try {
        await window.guardarKardexActual();
      } catch (e) {
        console.warn('Auto-save previo a impresión:', e);
      }
    }
    prepararEImprimirKardex(id, diseno);
  }

  // Exportar al ámbito global
  window.prepararEImprimirKardex = prepararEImprimirKardex;
  window.prepararEImprimirTodosLosKardex = prepararEImprimirTodosLosKardex;
  window.imprimirKardexActual = imprimirKardexActual;
  window.aplicarOrientacionKardex = aplicarOrientacionKardex;
  window.setKardexDisenoActivo = setKardexDisenoActivo;
  window.getKardexDisenoActivo = getKardexDisenoActivo;
})();
