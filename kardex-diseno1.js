/* ==========================================================================
   KARDEX DOCENTE - MÓDULO EXCLUSIVO DISEÑO 1 (OFICIAL TRADICIONAL)
   CEA "MADRE MARIE POUSSEPIN" - GESTIÓN 2026
   Bordes: 2 cm (20 mm) exactos a izquierda y derecha
   ========================================================================== */

(function () {
  'use strict';

  function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function prepararContenidoKardexDiseno1DOM(data, page1, page2) {
    if (!page1 || !page2) return;

    data = data || {};

    // Formato de fecha de nacimiento
    let fechaNacStr = '';
    if (data.fechaNacimiento) {
      if (data.fechaNacimiento.includes('-')) {
        const parts = data.fechaNacimiento.split('-');
        if (parts.length === 3) {
          fechaNacStr = `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}/${parts[0]}`;
        } else {
          fechaNacStr = data.fechaNacimiento;
        }
      } else {
        fechaNacStr = data.fechaNacimiento;
      }
    }

    let generoTexto = '';
    if (data.genero === 'M' || (data.genero && data.genero.toUpperCase().startsWith('M'))) {
      generoTexto = 'MASCULINO';
    } else if (data.genero === 'F' || (data.genero && data.genero.toUpperCase().startsWith('F'))) {
      generoTexto = 'FEMENINO';
    } else {
      generoTexto = escapeHTML(data.genero || '');
    }

    const ciConExp = data.ci ? (data.ci + (data.expedido && !data.ci.toUpperCase().includes(data.expedido.toUpperCase()) ? ' ' + data.expedido : '')) : '';
    const hoyRef = new Date();
    const MESES_BOL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const diaFallback = String(hoyRef.getDate());
    const mesFallback = MESES_BOL[hoyRef.getMonth()];

    // Fotografía oficial 4 x 4 cm con marco
    const fotoHTML = data.foto
      ? `<img src="${data.foto}" style="width:100%;height:100%;object-fit:cover" alt="Foto Docente" />`
      : `<div style="padding:4px;color:#334155;font-weight:800;font-size:6.8pt;line-height:1.2;text-align:center">PEGAR FOTOGRAFÍA<br>ACTUAL<br><span style="font-size:6pt;font-weight:600;color:#475569">(4 × 4 cm)</span></div>`;

    // Filas fijas para Formación Profesional (2 filas)
    const fpRows = (data.formacionProf && data.formacionProf.length > 0) ? [...data.formacionProf] : [];
    while (fpRows.length < 2) {
      fpRows.push({ tipoDoc: '', especialidad: '', nivel: '', institucion: '', fechaEmision: '' });
    }

    // Filas fijas para Formación Complementaria (2 filas)
    const fcRows = (data.formacionComp && data.formacionComp.length > 0) ? [...data.formacionComp] : [];
    while (fcRows.length < 2) {
      fcRows.push({ nivel: '', area: '', institucion: '', fechaEmision: '' });
    }

    // Filas fijas para Capacitaciones (4 filas)
    const capRows = (data.capacitaciones && data.capacitaciones.length > 0) ? [...data.capacitaciones] : [];
    while (capRows.length < 4) {
      capRows.push({ inicio: '', conclusion: '', curso: '', tipo: '', institucion: '', lugar: '', horas: '' });
    }

    // Filas fijas para Experiencia (3 filas)
    const expRows = (data.experiencia && data.experiencia.length > 0) ? [...data.experiencia] : [];
    while (expRows.length < 3) {
      expRows.push({ distrito: '', institucion: '', cargo: '', del: '', al: '', forma: '', motivo: '' });
    }

    // Filas familiares (2 filas)
    const famRows = (data.familiaresUrgencia && data.familiaresUrgencia.length > 0) ? [...data.familiaresUrgencia] : [];
    while (famRows.length < 2) {
      famRows.push({ parentesco: '', nombres: '', direccion: '', contacto: '' });
    }

    // Filas referencias (2 filas)
    const refRows = (data.referenciasPersonales && data.referenciasPersonales.length > 0) ? [...data.referenciasPersonales] : [];
    while (refRows.length < 2) {
      refRows.push({ referencia: '', nombres: '', contacto: '', direccion: '' });
    }

    const ues = data.ultimasUE || [];
    const anioActual = new Date().getFullYear();
    const gestionActual = data.gestion || String(anioActual);
    const codigoActual = data.codigoKardex
      ? ((data.codigoKardex.toUpperCase().startsWith('CÓDIGO') || data.codigoKardex.toUpperCase().startsWith('CODIGO'))
          ? data.codigoKardex
          : 'CÓDIGO ' + data.codigoKardex)
      : 'CÓDIGO 245';

    /* ══════════ PÁGINA 1: DISEÑO 1 OFICIAL TRADICIONAL ══════════ */
    page1.className = 'kardex-print-page kardex-page-1 kardex-d1-page kardex-d1-p1';
    page1.innerHTML = `
      <!-- ENCABEZADO INSTITUCIONAL OFICIAL -->
      <div class="k-print-header-wrap kardex-d1-header" style="display:flex !important; align-items:stretch !important; justify-content:space-between !important; width:100% !important; margin-bottom:2px !important; padding-top:0 !important; box-sizing:border-box !important;">
        <div style="width:160px !important; min-width:160px !important; display:flex !important; flex-direction:column !important; align-items:center !important; justify-content:flex-start !important; text-align:center !important; padding-top:4px !important; margin-left:-20px !important;">
          <img src="logo%20cea%20madre%20marie%20poussepin.png" alt="Logo Institución" class="k-print-escudo kardex-d1-escudo" style="height:120px !important; max-width:155px !important; object-fit:contain !important; margin-bottom:6px !important;" onerror="this.style.display='none'" />
          <div class="k-print-cod-box kardex-d1-cod-box" style="margin-top:6px !important; margin-bottom:0px !important; align-self:center !important;">${escapeHTML(codigoActual)}</div>
        </div>
        <div style="flex:1 !important; text-align:center !important; padding:0 4px !important; margin:0 !important;">
          <div class="k-print-tit-dep kardex-d1-tit-dep" style="font-size:11.0pt !important; font-weight:900 !important; line-height:1.2 !important; margin-top:14px !important; padding-top:0 !important; color:#475569 !important; text-align:center !important; -webkit-text-stroke:none !important;">DIRECCIÓN DEPARTAMENTAL DE LA PAZ</div>
          <div class="k-print-tit-dis kardex-d1-tit-dis" style="font-size:9.0pt !important; font-weight:900 !important; line-height:1.2 !important; margin-top:4px !important; color:#1e293b !important; text-align:center !important; -webkit-text-stroke:none !important;">DIRECCIÓN DISTRITAL DE EDUCACIÓN CHULUMANI</div>
          <div class="k-print-tit-main kardex-d1-tit-main" style="font-size:13.0pt !important; font-weight:900 !important; -webkit-text-stroke:0.5px #000000 !important; line-height:1.25 !important; margin-top:45px !important; text-decoration:none !important; color:#000000 !important; text-align:center !important;">KARDEX DOCENTE - ADMINISTRATIVO<br><span style="display:inline-block; margin-top:3px; font-weight:900 !important; -webkit-text-stroke:0.5px #000000 !important;">${escapeHTML(gestionActual)}</span></div>
        </div>
        <div style="width:130px !important; display:flex !important; justify-content:flex-end !important; padding-top:28px !important;">
          <div class="k-print-foto-frame kardex-d1-foto-frame">
            ${fotoHTML}
          </div>
        </div>
      </div>

      <table class="kardex-master-grid kardex-d1-grid">
        <colgroup>
          <col style="width: 15.0%;">
          <col style="width: 15.0%;">
          <col style="width: 17.5%;">
          <col style="width: 1.5%;">
          <col style="width: 12.5%;">
          <col style="width: 12.5%;">
          <col style="width: 12.5%;">
          <col style="width: 13.5%;">
        </colgroup>
        <tbody>
          <!-- FILA 1: BANNERS I. DATOS GENERALES / II. UNIDAD EDUCATIVA DE TRABAJO -->
          <tr>
            <th colspan="3" class="k-banner">I. DATOS GENERALES</th>
            <td class="k-spacer"></td>
            <th colspan="4" class="k-banner">II. UNIDAD EDUCATIVA DE TRABAJO</th>
          </tr>

          <!-- FILA 2: HEADERS PATERNO / MATERNO / CONYUGE || COD. NUCLEO / NUCLEO EDUCATIVO -->
          <tr>
            <th>A. PATERNO</th>
            <th>A. MATERNO</th>
            <th>A. CONYUGE</th>
            <td class="k-spacer"></td>
            <th>COD. NÚCLEO</th>
            <th colspan="3">NÚCLEO EDUCATIVO</th>
          </tr>

          <!-- FILA 3: VALORES PATERNO / MATERNO / CONYUGE || COD. NUCLEO / NUCLEO EDUCATIVO -->
          <tr>
            <td>${escapeHTML(data.paterno || '')}</td>
            <td>${escapeHTML(data.materno || '')}</td>
            <td>${escapeHTML(data.conyuge || '')}</td>
            <td class="k-spacer"></td>
            <td>${escapeHTML(data.codNucleo || '10084')}</td>
            <td colspan="3">${escapeHTML(data.nucleo || 'CRISPIN ANDRADE PORTUGAL')}</td>
          </tr>

          <!-- FILA 4: HEADERS NOMBRE(S) / GÉNERO || COD. U.E. / UNIDAD EDUCATIVA -->
          <tr>
            <th colspan="2">NOMBRE(S)</th>
            <th>GÉNERO</th>
            <td class="k-spacer"></td>
            <th>COD. U.E.</th>
            <th colspan="3">UNIDAD EDUCATIVA</th>
          </tr>

          <!-- FILA 5: VALORES NOMBRE(S) / GÉNERO || COD. U.E. / UNIDAD EDUCATIVA -->
          <tr>
            <td colspan="2" style="font-weight:800">${escapeHTML(data.nombres || '')}</td>
            <td>${escapeHTML(generoTexto)}</td>
            <td class="k-spacer"></td>
            <td>${escapeHTML(data.codUE || '80630044')}</td>
            <td colspan="3">${escapeHTML(data.ue || 'CEA MADRE MARIE POUSSEPIN')}</td>
          </tr>

          <!-- FILA 6: BANNERS FILIACIÓN || III. DATOS DE PLANILLAS -->
          <tr>
            <th colspan="3" class="k-banner">FILIACIÓN</th>
            <td class="k-spacer"></td>
            <th colspan="4" class="k-banner">III. DATOS DE PLANILLAS</th>
          </tr>

          <!-- FILA 7: HEADERS FECHA NACIMIENTO / EDAD / Nº DE CÉDULA || SERVICIO / ITEM / Nº RDA / CATEGORIA -->
          <tr>
            <th>FECHA DE NACIMIENTO</th>
            <th>EDAD</th>
            <th>Nº DE CÉDULA</th>
            <td class="k-spacer"></td>
            <th>SERVICIO</th>
            <th>ITEM</th>
            <th>Nº RDA</th>
            <th>CATEGORIA</th>
          </tr>

          <!-- FILA 8: VALORES FECHA NAC / EDAD / CI || SERVICIO / ITEM / RDA / CATEGORIA -->
          <tr>
            <td>${escapeHTML(fechaNacStr)}</td>
            <td>${escapeHTML(data.edad ? String(data.edad) : '')}</td>
            <td>${escapeHTML(ciConExp)}</td>
            <td class="k-spacer"></td>
            <td>${escapeHTML(data.servicio || '')}</td>
            <td>${escapeHTML(data.item || '')}</td>
            <td>${escapeHTML(data.rda || '')}</td>
            <td>${escapeHTML(data.categoria || '')}</td>
          </tr>

          <!-- FILA 9: HEADERS DEPARTAMENTO / PROVINCIA / LOCALIDAD || AÑO DE EGRESO / AÑOS DE SERVICIO / AÑOS DE TRABAJO EN EL DISTRITO -->
          <tr>
            <th>DEPARTAMENTO</th>
            <th>PROVINCIA</th>
            <th>LOCALIDAD</th>
            <td class="k-spacer"></td>
            <th>AÑO DE EGRESO</th>
            <th>AÑOS DE SERVICIO</th>
            <th colspan="2">AÑOS DE TRABAJO EN EL DISTRITO</th>
          </tr>

          <!-- FILA 10: VALORES DEPARTAMENTO / PROVINCIA / LOCALIDAD || AÑO EGRESO / AÑOS SERVICIO / AÑOS DISTRITO -->
          <tr>
            <td>${escapeHTML(data.departamento || (data.expedido === 'LP' ? 'LA PAZ' : data.expedido) || 'LA PAZ')}</td>
            <td>${escapeHTML(data.provincia || '')}</td>
            <td>${escapeHTML(data.localidad || '')}</td>
            <td class="k-spacer"></td>
            <td>${escapeHTML(data.anoEgreso || '')}</td>
            <td>${escapeHTML(data.anosServicio ? String(data.anosServicio) : '')}</td>
            <td colspan="2">${escapeHTML(data.anosDistrito ? String(data.anosDistrito) : '')}</td>
          </tr>

          <!-- FILA 11: HEADERS ESTADO CIVIL / LIBRETA / SANGRE || BANNER UNIDADES EDUCATIVAS DE TRABAJO -->
          <tr>
            <th>ESTADO CIVIL</th>
            <th>Nº LIBRETA MILITAR</th>
            <th>TIPO DE SANGRE</th>
            <td class="k-spacer"></td>
            <th colspan="4" class="k-banner">UNIDADES EDUCATIVAS DE TRABAJO (3 últimas)</th>
          </tr>

          <!-- FILA 12: VALORES ESTADO CIVIL / LIBRETA / SANGRE || HEADERS DISTRITO / UNIDAD EDUCATIVA -->
          <tr>
            <td>${escapeHTML(data.estadoCivil || '')}</td>
            <td>${escapeHTML(data.libretaMilitar || '')}</td>
            <td>${escapeHTML(data.tipoSangre || '')}</td>
            <td class="k-spacer"></td>
            <th colspan="2">DISTRITO</th>
            <th colspan="2">UNIDAD EDUCATIVA</th>
          </tr>

          <!-- FILA 13: BANNER DIRECCIÓN ACTUAL CON LUGAR/ZONA/CALLE || VALOR U.E. 1 -->
          <tr>
            <th colspan="3" class="k-banner">DIRECCIÓN ACTUAL DE DOMICILIO (Lugar/zona/calle): <span style="font-weight:900;text-transform:uppercase;">${escapeHTML(data.domicilioCalle || '')}</span></th>
            <td class="k-spacer"></td>
            <td colspan="2">${escapeHTML(ues[0]?.distrito || '')}</td>
            <td colspan="2">${escapeHTML(ues[0]?.ue || '')}</td>
          </tr>

          <!-- FILA 14: HEADERS Nº DE DOMICILIO / TELEFONO / CONTACTO DE CELULAR || VALOR U.E. 2 -->
          <tr>
            <th>Nº DE DOMICILIO</th>
            <th>TELEFONO</th>
            <th>CONTACTO DE CELULAR</th>
            <td class="k-spacer"></td>
            <td colspan="2">${escapeHTML(ues[1]?.distrito || '')}</td>
            <td colspan="2">${escapeHTML(ues[1]?.ue || '')}</td>
          </tr>

          <!-- FILA 15: VALORES Nº DOMICILIO / TELEFONO / CELULAR || VALOR U.E. 3 -->
          <tr>
            <td>${escapeHTML(data.domicilioNum || 'S/N')}</td>
            <td>${escapeHTML(data.telefono || 'S/N')}</td>
            <td>${escapeHTML(data.celular || 'S/N')}</td>
            <td class="k-spacer"></td>
            <td colspan="2">${escapeHTML(ues[2]?.distrito || '')}</td>
            <td colspan="2">${escapeHTML(ues[2]?.ue || '')}</td>
          </tr>

          <!-- ESPACIO SEPARADOR VACÍO DEBAJO DE DIRECCIÓN / ARRIBA DE FORMACIÓN PROFESIONAL (COMPLETAMENTE VACÍO SIN LÍNEAS) -->
          <tr style="height:12px !important; border:none !important;">
            <td colspan="8" style="border:none !important; border-top:none !important; border-bottom:none !important; border-left:none !important; border-right:none !important; background:transparent !important; height:12px !important; padding:0 !important;"></td>
          </tr>

          <!-- FILA 17: BANNER IV. FORMACIÓN PROFESIONAL -->
          <tr>
            <th colspan="8" class="k-banner">IV. FORMACIÓN PROFESIONAL (Normalista - Licenciatura)</th>
          </tr>
          <tr>
            <th colspan="2">TIPO DE DOCUMENTO</th>
            <th colspan="3">ESPECIALIDAD / ÁREA DE FORMACIÓN</th>
            <th>NIVEL</th>
            <th>INSTITUCIÓN</th>
            <th>FECHA EMISIÓN</th>
          </tr>
          ${fpRows.slice(0, 2).map(r => `
            <tr>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.tipoDoc || '')}</td>
              <td colspan="3" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.especialidad || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.nivel || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.institucion || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.fechaEmision || '')}</td>
            </tr>
          `).join('')}

          <!-- FILA 21: BANNER V. FORMACIÓN COMPLEMENTARIA -->
          <tr>
            <th colspan="8" class="k-banner">V. FORMACIÓN COMPLEMENTARIA: TÉCNICO, LICENCIATURA Y POST GRADOS</th>
          </tr>
          <tr>
            <th colspan="2">NIVEL DE FORMACIÓN</th>
            <th colspan="3">ÁREA / ESPECIALIDAD</th>
            <th colspan="2">INSTITUCIÓN EMISORA</th>
            <th>FECHA EMISIÓN</th>
          </tr>
          ${fcRows.slice(0, 2).map(r => `
            <tr>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.nivel || '')}</td>
              <td colspan="3" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.area || '')}</td>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.institucion || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.fechaEmision || '')}</td>
            </tr>
          `).join('')}

          <!-- ACLARACIONES -->
          <tr>
            <th colspan="8" class="k-banner">ACLARACIONES (SI CONSIDERA NECESARIO)</th>
          </tr>
          <tr style="height: 75px !important;">
            <td colspan="8" style="text-align:left; vertical-align:top; padding:8px 10px; height:75px !important; min-height:75px !important; word-break:break-word; overflow-wrap:break-word; white-space:normal; font-size:7.5pt; color:#000000; background:#ffffff;">
              ${escapeHTML(data.aclaracionesV || '')}
            </td>
          </tr>
        </tbody>
      </table>
    `;

    /* ══════════ PÁGINA 2: DISEÑO 1 OFICIAL TRADICIONAL ══════════ */
    page2.className = 'kardex-print-page kardex-page-2 kardex-d1-page kardex-d1-p2';
    page2.innerHTML = `
      <table class="kardex-master-grid kardex-d1-grid">
        <colgroup>
          <col style="width: 11.5%;">
          <col style="width: 11.5%;">
          <col style="width: 20.0%;">
          <col style="width: 8.0%;">
          <col style="width: 9.0%;">
          <col style="width: 16.0%;">
          <col style="width: 15.0%;">
          <col style="width: 9.0%;">
        </colgroup>
        <tbody>
          <!-- VI. CAPACITACIONES -->
          <tr>
            <th colspan="8" class="k-banner">VI.- SEMINARIOS/ TALLERES Y/O CURSOS DE CAPACITACIÓN (DESDE 2024 A LA ACTUALIDAD)</th>
          </tr>
          <tr>
            <th rowspan="2">INICIO<br>DD/MM/AAAA</th>
            <th rowspan="2">CONCLUSIÓN<br>DD/MM/AAAA</th>
            <th rowspan="2">NOMBRE DEL<br>CURSO</th>
            <th colspan="2" style="font-size:6.5pt; padding:1px;">CAPACITACIÓN</th>
            <th rowspan="2">INSTITUCIÓN</th>
            <th rowspan="2">LUGAR</th>
            <th rowspan="2">HORAS</th>
          </tr>
          <tr>
            <th style="font-size:5.5pt; padding:1px; line-height:1.05; text-align:center;">NACIO-<br>NAL</th>
            <th style="font-size:5.5pt; padding:1px; line-height:1.05; text-align:center;">INTER-<br>NACIONAL</th>
          </tr>
          ${capRows.slice(0, 4).map(r => {
            const isNac = (r.tipo || '').toUpperCase().includes('NAC') ? 'X' : (r.tipo === 'NACIONAL' ? 'X' : '');
            const isInt = (r.tipo || '').toUpperCase().includes('INTER') ? 'X' : (r.tipo === 'INTERNACIONAL' ? 'X' : '');
            return `
              <tr>
                <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;">${escapeHTML(r.inicio || '')}</td>
                <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;">${escapeHTML(r.conclusion || '')}</td>
                <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.curso || '')}</td>
                <td>${isNac}</td>
                <td>${isInt}</td>
                <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.institucion || '')}</td>
                <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.lugar || '')}</td>
                <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;">${escapeHTML(r.horas || '')}</td>
              </tr>
            `;
          }).join('')}

          <!-- VII. EXPERIENCIA LABORAL -->
          <tr>
            <th colspan="8" class="k-banner">VII.- EXPERIENCIA LABORAL DE 3 ÚLTIMAS GESTIONES (EMPEZAR POR EL MAS RECIENTE)</th>
          </tr>
          <tr>
            <th>DISTRITO</th>
            <th colspan="2">INSTITUCION</th>
            <th>CARGO</th>
            <th>DEL MES/AÑO</th>
            <th>AL MES/AÑO</th>
            <th>FORMA DE DESIGNACION</th>
            <th>MOTIVO DE CAMBIO</th>
          </tr>
          ${expRows.slice(0, 3).map(r => `
            <tr>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.distrito || '')}</td>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.institucion || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.cargo || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.del || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.al || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.forma || '')}</td>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.motivo || '')}</td>
            </tr>
          `).join('')}

          <!-- VIII. DATOS COMPLEMENTARIOS -->
          <tr>
            <th colspan="8" class="k-banner">VIII.- DATOS COMPLEMENTARIOS</th>
          </tr>
          <tr>
            <th colspan="8" class="k-banner-sub">FAMILIARES DE REFERENCIA EN CASO DE URGENCIA</th>
          </tr>
          <tr>
            <th>PARENTESCO</th>
            <th colspan="2">NOMBRES Y APELLIDOS</th>
            <th colspan="3">DIRECCION ACTUAL (DESCRIPCION Z/CALLE Y AVENIDA)</th>
            <th colspan="2">CONTACTOS DE REFERENCIA</th>
          </tr>
          ${famRows.slice(0, 2).map(r => `
            <tr>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.parentesco || '')}</td>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.nombres || '')}</td>
              <td colspan="3" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.direccion || '')}</td>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.contacto || '')}</td>
            </tr>
          `).join('')}

          <tr>
            <th colspan="8" class="k-banner-sub">REFERENCIAS PERSONALES EN CASO DE NECESIDAD</th>
          </tr>
          <tr>
            <th>REFERENCIA</th>
            <th colspan="2">NOMBRES Y APELLIDOS</th>
            <th colspan="2">TELEFONO/ CELULAR</th>
            <th colspan="3">DIRECCION</th>
          </tr>
          ${refRows.slice(0, 2).map(r => `
            <tr>
              <td style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.referencia || '')}</td>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.nombres || '')}</td>
              <td colspan="2" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.contacto || '')}</td>
              <td colspan="3" style="word-break:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.1;min-height:20px;height:auto;font-size:6.2pt;">${escapeHTML(r.direccion || '')}</td>
            </tr>
          `).join('')}

          <!-- OTROS ASPECTOS -->
          <tr>
            <th colspan="8" class="k-banner-sub">OTROS ASPECTOS (SI CONSIDERA NECESARIO)</th>
          </tr>
          <tr>
            <td colspan="8" style="text-align:left; padding:4px 8px; vertical-align:top; min-height:48px;">
              ${data.otrosAspectos ? `<div style="font-weight:700; font-size:7pt; color:#000; margin-bottom:2px;">${escapeHTML(data.otrosAspectos)}</div>` : ''}
              <div style="border-bottom: 1.2px dotted #000000; height: 13px; width: 100%;"></div>
              <div style="border-bottom: 1.2px dotted #000000; height: 13px; width: 100%;"></div>
              <div style="border-bottom: 1.2px dotted #000000; height: 13px; width: 100%;"></div>
            </td>
          </tr>

          <!-- DECLARACIÓN JURADA -->
          <tr>
            <th colspan="8" class="k-banner" style="font-weight:800; font-size:7.5pt; text-align:center; padding:3px 4px; text-transform:none;">
              Los datos proporcionados son de responsabilidad personal
            </th>
          </tr>

          <!-- FIRMAS -->
          <tr>
            <td colspan="8" style="border:none; padding:8px 0 4px 0; background:transparent;">
              <div class="k-print-firmas-container" style="display:flex; border:1.5px solid #000000; width:100%; box-sizing:border-box; height:80px;">
                <div class="k-print-firma-column" style="flex:1; border-right:1.5px solid #000000; display:flex; flex-direction:column; justify-content:space-between; padding:4px; box-sizing:border-box;">
                  <div style="flex:1;"></div>
                  <div style="border-top:1px solid #000000; text-align:center; font-weight:800; font-size:7.2pt; padding-top:2px;">MAESTRA/O</div>
                </div>
                <div class="k-print-firma-column" style="flex:1; border-right:1.5px solid #000000; display:flex; flex-direction:column; justify-content:space-between; padding:4px; box-sizing:border-box;">
                  <div style="flex:1;"></div>
                  <div style="border-top:1px solid #000000; text-align:center; font-weight:800; font-size:7.2pt; padding-top:2px;">DIRECTORA UNIDAD EDUCATIVA</div>
                </div>
                <div class="k-print-firma-column" style="flex:1; display:flex; flex-direction:column; justify-content:space-between; padding:4px; box-sizing:border-box;">
                  <div style="flex:1;"></div>
                  <div style="border-top:1px solid #000000; text-align:center; font-weight:800; font-size:7.2pt; padding-top:2px;">DIRECTOR DISTRITAL</div>
                </div>
              </div>
            </td>
          </tr>

          <!-- FECHA -->
          <tr>
            <td colspan="8" style="border:none; text-align:right; font-size:7.5pt; font-weight:800; padding:4px 0 0 0; background:transparent;">
              Lugar y fecha: &nbsp;&nbsp; Chulumani, &nbsp;__${escapeHTML(data.lugarFechaDia || diaFallback)}__ &nbsp;de&nbsp; ${escapeHTML(data.lugarFechaMes || mesFallback)} &nbsp;de&nbsp; _____ ${escapeHTML(gestionActual)} _____
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  // Exportar al ámbito global
  window.prepararContenidoKardexDiseno1DOM = prepararContenidoKardexDiseno1DOM;
})();
