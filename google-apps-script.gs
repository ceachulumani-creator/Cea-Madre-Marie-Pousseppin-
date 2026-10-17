/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - CEA MADRE MARIE POUSSEPIN
 * Integración Completa con Google Sheets para CMS y Formularios
 * ==============================================================================
 * 
 * INSTRUCCIONES DE ACTUALIZACIÓN:
 * 1. Abre tu hoja de cálculo en Google Drive.
 * 2. Ve al menú "Extensiones" > "Apps Script".
 * 3. Borra todo el código anterior y pega este archivo completo.
 * 4. Haz clic en "Guardar".
 * 5. Haz clic en "Implementar" > "Gestionar implementaciones".
 * 6. Haz clic en el lápiz (Editar) > Selecciona Versión: "Nueva versión".
 * 7. Haz clic en "Implementar".
 * ==============================================================================
 */

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── FUNCIONES DE SEGURIDAD (TOKEN, SANITIZACIÓN Y RATE LIMIT) ───
const CEA_SECRET_TOKEN = "CEA_POUSSEPIN_SEC_2026_KEY";

function generarTokenSeguro(usuario, rol) {
  const ts = new Date().getTime();
  const raw = JSON.stringify({ u: String(usuario), r: String(rol), t: ts });
  const payload = Utilities.base64Encode(raw);
  const sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(payload, CEA_SECRET_TOKEN));
  return payload + "." + sig;
}

function validarTokenSeguro(token, rolEsperado) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  try {
    const parts = token.split('.');
    const payloadB64 = parts[0];
    const sig = parts[1];
    const expectedSig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(payloadB64, CEA_SECRET_TOKEN));
    if (sig !== expectedSig) return false;

    const data = JSON.parse(Utilities.newBlob(Utilities.base64Decode(payloadB64)).getDataAsString());
    const now = new Date().getTime();
    // Expiración: 7 días (604,800,000 ms)
    if (now - data.t > 604800000) return false;

    if (rolEsperado && data.r !== rolEsperado && data.r !== 'director') return false;
    return data;
  } catch(e) {
    return false;
  }
}

function sanitizarEntradaTexto(texto) {
  if (texto === null || texto === undefined) return "";
  let s = String(texto);
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  s = s.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/on\w+\s*=/gi, "");
  return s.trim();
}

function verificarRateLimit(clave, maxPeticiones, ventanaSegundos) {
  try {
    const cache = CacheService.getScriptCache();
    const actual = parseInt(cache.get(clave) || "0", 10);
    if (actual >= maxPeticiones) return false;
    cache.put(clave, String(actual + 1), ventanaSegundos);
    return true;
  } catch(e) {
    return true;
  }
}

// ─── RESOLUCIÓN RESILIENTE DE HOJA DE CÁLCULO PRINCIPAL ───
const NOMBRE_HOJA_CALCULO = "BD_OFICIAL_CEA_MADRE_MARIE_POUSSEPIN";
const SPREADSHEET_ID_MANUAL = ""; // Opcional: ID de la hoja de Google Sheets si se desea fijar manualmente

function obtenerSpreadsheetPrincipal() {
  if (SPREADSHEET_ID_MANUAL && SPREADSHEET_ID_MANUAL.trim() !== "") {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID_MANUAL.trim());
    } catch(e) {}
  }
  // 1. Si el script está dentro de la hoja de cálculo (Extensiones > Apps Script)
  try {
    const ssActiva = SpreadsheetApp.getActiveSpreadsheet();
    if (ssActiva) return ssActiva;
  } catch (e) {}

  // 2. Si es un script independiente en script.google.com, buscar por nombre exacto en Drive
  try {
    const files = DriveApp.getFilesByName(NOMBRE_HOJA_CALCULO);
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
        return SpreadsheetApp.openById(file.getId());
      }
    }
  } catch (e) {}

  // 3. Buscar si existe alguna hoja que contenga "BD_OFICIAL" o "CEA"
  try {
    const filesAny = DriveApp.searchFiles('title contains "BD_OFICIAL" and mimeType = "application/vnd.google-apps.spreadsheet"');
    if (filesAny.hasNext()) {
      return SpreadsheetApp.openById(filesAny.next().getId());
    }
    const filesCea = DriveApp.searchFiles('title contains "CEA" and mimeType = "application/vnd.google-apps.spreadsheet"');
    if (filesCea.hasNext()) {
      return SpreadsheetApp.openById(filesCea.next().getId());
    }
  } catch (e) {}

  // 4. Si aún no existe, crear la hoja oficial automáticamente en Google Drive
  try {
    const nueva = SpreadsheetApp.create(NOMBRE_HOJA_CALCULO);
    return nueva;
  } catch (e) {
    throw new Error("No se pudo conectar ni crear la hoja de cálculo en Google Drive: " + e.toString());
  }
}

/**
 * Petición GET: Devuelve todo el contenido del sitio web desde el Google Sheet
 */
function doGet(e) {
  try {
    const ss = obtenerSpreadsheetPrincipal();
    if (!ss.getSheetByName("Director_y_Textos")) {
      inicializarHojas();
    }
    
    // 1. Director y Textos
    const textosObj = {};
    const sheetTextos = ss.getSheetByName("Director_y_Textos");
    if (sheetTextos) {
      const dataTextos = sheetTextos.getDataRange().getValues();
      for (let i = 1; i < dataTextos.length; i++) {
        const k = String(dataTextos[i][0] || '').trim();
        // SEGURIDAD: Nunca enviar la contraseña del director al navegador público
        if (k && k !== 'director_contrasena') {
          textosObj[k] = dataTextos[i][1] || "";
        }
      }
    }

    // 2. Docentes
    const docentesObj = {};
    const sheetDocentes = ss.getSheetByName("Docentes");
    if (sheetDocentes) {
      const dataDocentes = sheetDocentes.getDataRange().getValues();
      for (let i = 1; i < dataDocentes.length; i++) {
        const codigo = dataDocentes[i][0];
        const nombre = dataDocentes[i][1];
        if (codigo) {
          docentesObj[codigo] = nombre;
        }
      }
    }

    // 3. Carreras Técnicas
    const carrerasList = [];
    const sheetCarreras = ss.getSheetByName("Carreras_Tecnicas");
    if (sheetCarreras) {
      const dataCarreras = sheetCarreras.getDataRange().getValues();
      for (let i = 1; i < dataCarreras.length; i++) {
        if (dataCarreras[i][0]) {
          carrerasList.push({
            key: dataCarreras[i][0],
            nombre: dataCarreras[i][1],
            docente: dataCarreras[i][2],
            color: dataCarreras[i][3] || "#1a6b2e",
            resumen: dataCarreras[i][4] || ""
          });
        }
      }
    }

    // 4. Materias Humanísticas
    const materiasHumList = [];
    const sheetMaterias = ss.getSheetByName("Materias_Humanistica");
    if (sheetMaterias) {
      const dataMaterias = sheetMaterias.getDataRange().getValues();
      for (let i = 1; i < dataMaterias.length; i++) {
        if (dataMaterias[i][0]) {
          materiasHumList.push({
            materia: dataMaterias[i][0],
            docente: dataMaterias[i][1] || "",
            ciclo: dataMaterias[i][2] || ""
          });
        }
      }
    }

    // 5. Horarios Matriz
    const horariosObj = { hum: [], tec: [] };
    const sheetHorarios = ss.getSheetByName("Horarios");
    if (sheetHorarios) {
      const dataHorarios = sheetHorarios.getDataRange().getValues();
      for (let i = 1; i < dataHorarios.length; i++) {
        const area = String(dataHorarios[i][0]).trim();
        const dia = dataHorarios[i][1];
        const hora = dataHorarios[i][2];
        if (area && dia) {
          if (!horariosObj[area]) horariosObj[area] = [];
          horariosObj[area].push({ dia: dia, hora: hora || "" });
        }
      }
    }

    // 5. Horarios Matriz (Construido prioritariamente desde la hoja Horarios_Matriz para respetar ediciones manuales en Google Sheets)
    let horariosMatrizObj = null;
    const sheetHorariosMat = ss.getSheetByName("Horarios_Matriz");
    if (sheetHorariosMat && sheetHorariosMat.getLastRow() > 1) {
      const dataHMat = sheetHorariosMat.getDataRange().getValues();
      if (dataHMat.length > 1) {
        horariosMatrizObj = {
          hum: {
            periodos: [
              { num: 1, inicio: '08:00', fin: '08:40', receso: false },
              { num: 2, inicio: '08:40', fin: '09:20', receso: false },
              { num: 3, inicio: '09:20', fin: '10:00', receso: false },
              { num: 0, inicio: '10:00', fin: '10:20', receso: true, titulo: 'RECREO (20 MIN)' },
              { num: 4, inicio: '10:20', fin: '11:00', receso: false },
              { num: 5, inicio: '11:00', fin: '11:40', receso: false },
              { num: 6, inicio: '11:40', fin: '12:20', receso: false }
            ],
            matriz: {}
          },
          tec: {
            periodos: [
              { num: 1, inicio: '14:00', fin: '14:40', horaSabado: '08:00 – 08:40', horaNoche: '19:00 – 19:40', receso: false },
              { num: 2, inicio: '14:40', fin: '15:20', horaSabado: '08:40 – 09:20', horaNoche: '19:40 – 20:20', receso: false },
              { num: 3, inicio: '15:20', fin: '16:00', horaSabado: '09:20 – 10:00', horaNoche: '20:20 – 21:00', receso: false },
              { num: 0, inicio: '16:00', fin: '16:20', horaSabado: '10:00 – 10:20', horaNoche: '21:00 – 21:15', receso: true, titulo: 'RECESO' },
              { num: 4, inicio: '16:20', fin: '17:00', horaSabado: '10:20 – 11:00', horaNoche: '21:15 – 21:55', receso: false },
              { num: 5, inicio: '17:00', fin: '17:40', horaSabado: '11:00 – 11:40', horaNoche: '21:55 – 22:35', receso: false },
              { num: 6, inicio: '17:40', fin: '18:20', horaSabado: '11:40 – 12:20', horaNoche: '22:35 – 23:15', receso: false },
              { num: 7, inicio: '18:20', fin: '19:00', horaSabado: '—',            horaNoche: '23:15 – 23:55', receso: false }
            ],
            matriz: {}
          }
        };

        if (textosObj.horarios_matriz_json) {
          try {
            const pb = JSON.parse(textosObj.horarios_matriz_json);
            if (pb && pb.hum && Array.isArray(pb.hum.periodos) && pb.hum.periodos.length > 0) horariosMatrizObj.hum.periodos = pb.hum.periodos;
            if (pb && pb.tec && Array.isArray(pb.tec.periodos) && pb.tec.periodos.length > 0) horariosMatrizObj.tec.periodos = pb.tec.periodos;
          } catch(e) {}
        }

        for (let i = 1; i < dataHMat.length; i++) {
          const t = String(dataHMat[i][0] || '').trim().toLowerCase();
          const dia = String(dataHMat[i][1] || '').trim();
          const pNum = String(dataHMat[i][2] !== undefined ? dataHMat[i][2] : '').trim();
          const doc = String(dataHMat[i][5] || '').trim();
          const mat = String(dataHMat[i][6] || '').trim();
          const cur = String(dataHMat[i][7] || '').trim();
          if (t && dia && pNum !== '' && (t === 'hum' || t === 'tec')) {
            if (!horariosMatrizObj[t].matriz[dia]) horariosMatrizObj[t].matriz[dia] = {};
            if (!Array.isArray(horariosMatrizObj[t].matriz[dia][pNum])) {
              horariosMatrizObj[t].matriz[dia][pNum] = [];
            }
            horariosMatrizObj[t].matriz[dia][pNum].push({
              docente: doc || "—",
              materia: mat || "Libre",
              curso: cur || "—"
            });
          }
        }
      }
    } else if (textosObj.horarios_matriz_json) {
      try {
        horariosMatrizObj = JSON.parse(textosObj.horarios_matriz_json);
      } catch(e) {}
    }

    // 6. Documentos
    const documentosList = [];
    const sheetDocs = ss.getSheetByName("Documentos");
    if (sheetDocs) {
      const dataDocs = sheetDocs.getDataRange().getValues();
      for (let i = 1; i < dataDocs.length; i++) {
        if (dataDocs[i][0]) {
          const docKey = dataDocs[i][5] || ("doc_" + i);
          documentosList.push({
            id: docKey,
            key: docKey,
            titulo: dataDocs[i][0],
            descripcion: dataDocs[i][1] || "",
            icono: dataDocs[i][2] || "documento",
            enlace: dataDocs[i][3] || "#",
            botonTexto: dataDocs[i][4] || "Descargar"
          });
        }
      }
    }

    // 7. Mallas Curriculares
    const mallasObj = {};
    const sheetMallas = ss.getSheetByName("Mallas_Curriculares");
    if (sheetMallas) {
      const dataMallas = sheetMallas.getDataRange().getValues();
      for (let i = 1; i < dataMallas.length; i++) {
        const carreraKey = dataMallas[i][0];
        const nivel = dataMallas[i][1];
        const modulo = dataMallas[i][2];
        const materia = dataMallas[i][3];
        if (carreraKey && nivel) {
          if (!mallasObj[carreraKey]) mallasObj[carreraKey] = {};
          if (!mallasObj[carreraKey][nivel]) mallasObj[carreraKey][nivel] = [];
          mallasObj[carreraKey][nivel].push([modulo, materia]);
        }
      }
    }

    // 8. Usuarios Docentes
    const usuariosDocentesObj = {};
    const sheetUsuarios = ss.getSheetByName("Usuarios_Docentes");
    if (sheetUsuarios) {
      const dataUsuarios = sheetUsuarios.getDataRange().getValues();
      for (let i = 1; i < dataUsuarios.length; i++) {
        const key = dataUsuarios[i][0];
        const user = dataUsuarios[i][1];
        // SEGURIDAD: Nunca enviar contraseñas de docentes al navegador público
        if (key) {
          usuariosDocentesObj[key] = { user: user || "" };
        }
      }
    }

    // 9. Visitas Globales
    const visitasObj = {};
    const sheetVisitas = ss.getSheetByName("Visitas");
    if (sheetVisitas) {
      const dataVisitas = sheetVisitas.getDataRange().getValues();
      for (let i = 1; i < dataVisitas.length; i++) {
        const g = dataVisitas[i][0];
        const m = dataVisitas[i][1];
        if (g !== "" && m !== "") {
          const key = `${g}_${m}`;
          visitasObj[key] = (visitasObj[key] || 0) + 1;
        }
      }
    }

    // 10. Actividades e Hitos Cronológicos
    const actividadesList = [];
    const sheetActividades = ss.getSheetByName("Actividades");
    if (sheetActividades) {
      const dataAct = sheetActividades.getDataRange().getValues();
      for (let i = 1; i < dataAct.length; i++) {
        if (dataAct[i][0] || dataAct[i][4]) {
          actividadesList.push({
            id: dataAct[i][0] || ("act-" + i),
            gestion: dataAct[i][1] || "",
            mes: dataAct[i][2] || "",
            fecha: dataAct[i][3] || "",
            titulo: dataAct[i][4] || "",
            descripcion: dataAct[i][5] || "",
            tipoMedia: dataAct[i][6] || "ninguno",
            urlMedia: dataAct[i][7] || "",
            autor: dataAct[i][8] || "CEA Madre Marie Poussepín"
          });
        }
      }
    }

    // 11. Documentos por Nivel
    const docNivelesObj = {};
    const sheetDocNiv = ss.getSheetByName("Documentos_Niveles");
    if (sheetDocNiv) {
      const dataDocNiv = sheetDocNiv.getDataRange().getValues();
      for (let i = 1; i < dataDocNiv.length; i++) {
        const carreraKey = dataDocNiv[i][0];
        const nivel = dataDocNiv[i][1];
        const enlace = dataDocNiv[i][2];
        if (carreraKey && nivel) {
          if (!docNivelesObj[carreraKey]) docNivelesObj[carreraKey] = {};
          docNivelesObj[carreraKey][nivel] = enlace || "#";
        }
      }
    }

    // 12. Pre-Inscripciones Recibidas (Sincronización Total con la Web y Panel del Director)
    const inscripcionesList = [];
    const sheetIns = ss.getSheetByName("Inscripciones");
    if (sheetIns) {
      const dataIns = sheetIns.getDataRange().getValues();
      for (let i = 1; i < dataIns.length; i++) {
        if (dataIns[i][3]) { // Nombre Completo
          inscripcionesList.push({
            gestion: String(dataIns[i][0] || ""),
            mes: String(dataIns[i][1] || ""),
            fecha: String(dataIns[i][2] || ""),
            nombre: String(dataIns[i][3] || ""),
            ci: String(dataIns[i][4] || ""),
            fechaNacimiento: String(dataIns[i][5] || ""),
            telefono: String(dataIns[i][6] || ""),
            area: String(dataIns[i][7] || ""),
            carrera: String(dataIns[i][8] || ""),
            observaciones: String(dataIns[i][9] || ""),
            semestre: String(dataIns[i][10] || ""),
            casoExcepcional: String(dataIns[i][11] || ""),
            detalleExcepcion: String(dataIns[i][12] || ""),
            esCasoExcepcional: Boolean(dataIns[i][11] && dataIns[i][11] !== "No" && dataIns[i][11] !== "")
          });
        }
      }
    }

    // 13. Galería de Fotos de Talleres y Prácticas Productivas
    const galeriaFotosList = [];
    const sheetGaleria = ss.getSheetByName("Galeria_Fotos");
    if (sheetGaleria) {
      const dataGal = sheetGaleria.getDataRange().getValues();
      for (let i = 1; i < dataGal.length; i++) {
        if (dataGal[i][0] || dataGal[i][7]) {
          galeriaFotosList.push({
            id: String(dataGal[i][0] || ("foto-" + i)),
            gestion: String(dataGal[i][1] || ""),
            mes: String(dataGal[i][2] || ""),
            fecha: String(dataGal[i][3] || ""),
            titulo: String(dataGal[i][4] || ""),
            carreraKey: String(dataGal[i][5] || "general"),
            carreraNombre: String(dataGal[i][6] || "General / Institucional"),
            urlFoto: String(dataGal[i][7] || ""),
            autor: String(dataGal[i][8] || "Dirección / Docente")
          });
        }
      }
    }

    // 14. Calendario Académico Oficial
    const calendarioList = [];
    const sheetCal = ss.getSheetByName("Calendario_Academico");
    if (sheetCal) {
      const dataCal = sheetCal.getDataRange().getValues();
      for (let i = 1; i < dataCal.length; i++) {
        if (dataCal[i][1] || dataCal[i][2]) {
          calendarioList.push({
            gestion: String(dataCal[i][0] || ""),
            semestre: String(dataCal[i][1] || ""),
            actividad: String(dataCal[i][2] || ""),
            fecha: String(dataCal[i][3] || ""),
            id: String(dataCal[i][4] || ("cal_" + i))
          });
        }
      }
    }

    // 15. Niveles, Equivalencias y Edades Mínimas (EPJA)
    const epjaNivelesList = [];
    const sheetEPJA = ss.getSheetByName("Niveles_EPJA");
    if (sheetEPJA) {
      const dataEPJA = sheetEPJA.getDataRange().getValues();
      for (let i = 1; i < dataEPJA.length; i++) {
        if (dataEPJA[i][0] || dataEPJA[i][1]) {
          epjaNivelesList.push({
            regular: String(dataEPJA[i][0] || ""),
            alternativa: String(dataEPJA[i][1] || ""),
            edadMinima: String(dataEPJA[i][2] || ""),
            fechaLimite: String(dataEPJA[i][3] || "")
          });
        }
      }
    }

    // 16. Malla Curricular y Ciclos Humanística
    let humanisticaData = null;
    const sheetHum = ss.getSheetByName("Malla_Humanistica");
    if (sheetHum) {
      const dataHum = sheetHum.getDataRange().getValues();
      const epaList = [];
      const esaList = [];
      const ciclosList = [];
      for (let i = 1; i < dataHum.length; i++) {
        const tipo = String(dataHum[i][0] || "").toUpperCase();
        if (tipo === "EPA") {
          epaList.push({
            materia: String(dataHum[i][1] || ""),
            docente: String(dataHum[i][2] || ""),
            ciclo: String(dataHum[i][3] || "")
          });
        } else if (tipo === "ESA") {
          esaList.push({
            materia: String(dataHum[i][1] || ""),
            docente: String(dataHum[i][2] || ""),
            ciclo: String(dataHum[i][3] || "")
          });
        } else if (tipo === "CICLO") {
          ciclosList.push({
            titulo: String(dataHum[i][1] || ""),
            etapas: String(dataHum[i][2] || ""),
            duracion: String(dataHum[i][3] || ""),
            requisito: String(dataHum[i][4] || "")
          });
        }
      }
      if (epaList.length || esaList.length || ciclosList.length) {
        humanisticaData = { epa: epaList, esa: esaList, ciclos: ciclosList };
      }
    }

    let carrerasTecnicasLista = null;
    if (textosObj.carreras_tecnicas_lista_json) {
      try { carrerasTecnicasLista = JSON.parse(textosObj.carreras_tecnicas_lista_json); } catch(e){}
    }
    let reqNivelesTec = null;
    if (textosObj.req_niveles_tec_json) {
      try { reqNivelesTec = JSON.parse(textosObj.req_niveles_tec_json); } catch(e){}
    }
    let casosExcepcionales = null;
    if (textosObj.casos_excepcionales_json) {
      try { casosExcepcionales = JSON.parse(textosObj.casos_excepcionales_json); } catch(e){}
    }
    let horariosMerges = null;
    if (textosObj.horarios_merges_json) {
      try { horariosMerges = JSON.parse(textosObj.horarios_merges_json); } catch(e){}
    }

    return responseJSON({
      status: "success",
      data: {
        textos: textosObj,
        docentes: docentesObj,
        carreras: carrerasList,
        materiasHumanistica: materiasHumList,
        horarios: horariosObj,
        horariosMatriz: horariosMatrizObj,
        documentos: documentosList,
        mallas: mallasObj,
        usuariosDocentes: usuariosDocentesObj,
        visitas: visitasObj,
        actividades: actividadesList,
        docNiveles: docNivelesObj,
        inscripciones: inscripcionesList,
        galeriaFotos: galeriaFotosList,
        calendario: calendarioList,
        epjaNiveles: epjaNivelesList,
        humanistica: humanisticaData,
        carrerasTecnicasLista: carrerasTecnicasLista,
        reqNivelesTec: reqNivelesTec,
        casosExcepcionales: casosExcepcionales,
        horariosMerges: horariosMerges
      }
    });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * Petición POST: Procesa envíos desde el panel institucional y formularios
 */
function doPost(e) {
  try {
    const ss = obtenerSpreadsheetPrincipal();
    if (!ss.getSheetByName("Director_y_Textos")) {
      inicializarHojas();
    }
    let postData = {};

    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch (ex) {
        postData = e.parameter || {};
      }
    } else if (e && e.parameter) {
      postData = e.parameter;
    }

    if (typeof postData.payload === 'string') {
      try { postData = JSON.parse(postData.payload); } catch(ex) {}
    }

    const action = postData.action || "pre-inscripcion";
    const now = new Date();
    const gestion = now.getFullYear();
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mes = meses[now.getMonth()];
    const fecha = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

    // 0. Autenticación Segura en el Servidor (Google Sheets) con Token Criptográfico y Rate Limiting
    if (action === "login") {
      const userInp = String(postData.user || "").trim().toLowerCase();
      const passInp = String(postData.pass || "").trim();

      if (!userInp || !passInp) {
        return responseJSON({ status: "error", message: "Debe ingresar usuario y contraseña." });
      }

      // Control de límite de peticiones contra ataques de fuerza bruta (máximo 5 intentos por minuto)
      if (!verificarRateLimit("login_" + userInp, 5, 60)) {
        return responseJSON({ status: "error", message: "Demasiados intentos de acceso fallidos. Por favor espere 1 minuto." });
      }

      // 1. Verificar credenciales del Director en Director_y_Textos
      const sheetT = ss.getSheetByName("Director_y_Textos");
      let dirUser = "user";
      let dirPass = "user";
      if (sheetT) {
        const rowsT = sheetT.getDataRange().getValues();
        for (let i = 1; i < rowsT.length; i++) {
          const k = String(rowsT[i][0] || '').trim();
          if (k === 'director_usuario') dirUser = String(rowsT[i][1] || '').trim().toLowerCase();
          if (k === 'director_contrasena') dirPass = String(rowsT[i][1] || '').trim();
        }
      }

      if (userInp === dirUser && passInp === dirPass) {
        return responseJSON({
          status: "success",
          role: "director",
          name: "Director(a)",
          token: generarTokenSeguro(dirUser, "director")
        });
      }

      // 2. Verificar credenciales de Docentes en Usuarios_Docentes
      const sheetU = ss.getSheetByName("Usuarios_Docentes");
      if (sheetU) {
        const rowsU = sheetU.getDataRange().getValues();
        for (let i = 1; i < rowsU.length; i++) {
          const areaKey = String(rowsU[i][0] || '').trim();
          const docUser = String(rowsU[i][1] || '').trim().toLowerCase();
          const docPass = String(rowsU[i][2] || '').trim();
          if (areaKey && docUser === userInp && docPass === passInp) {
            return responseJSON({
              status: "success",
              role: "docente",
              areaKey: areaKey,
              name: rowsU[i][1],
              token: generarTokenSeguro(docUser, "docente")
            });
          }
        }
      }

      return responseJSON({ status: "error", message: "Usuario o contraseña incorrectos." });
    }

    // 0.1 Obtener nómina completa de pre-inscripciones protegida por Token del Director
    else if (action === "obtenerInscripciones") {
      const auth = validarTokenSeguro(postData.token, "director");
      if (!auth) {
        return responseJSON({ status: "error", message: "Acceso no autorizado. Se requiere token válido de Director." });
      }

      const sheetIns = ss.getSheetByName("Inscripciones");
      const list = [];
      if (sheetIns) {
        const dataIns = sheetIns.getDataRange().getValues();
        for (let i = 1; i < dataIns.length; i++) {
          if (dataIns[i][3]) {
            list.push({
              gestion: dataIns[i][0] || "",
              mes: dataIns[i][1] || "",
              fecha: dataIns[i][2] || "",
              nombre: dataIns[i][3] || "",
              ci: dataIns[i][4] || "",
              fechaNacimiento: dataIns[i][5] || "",
              telefono: dataIns[i][6] || "",
              area: dataIns[i][7] || "",
              carrera: dataIns[i][8] || "",
              observaciones: dataIns[i][9] || "",
              semestre: dataIns[i][10] || "",
              casoExcepcional: dataIns[i][11] || "",
              detalleExcepcion: dataIns[i][12] || "",
              esCasoExcepcional: Boolean(dataIns[i][11] && dataIns[i][11] !== "No" && dataIns[i][11] !== "")
            });
          }
        }
      }
      return responseJSON({ status: "success", inscripciones: list });
    }

    // 1. Pre-inscripción pública con Sanitización Anti-XSS y Rate Limit
    else if (action === "pre-inscripcion") {
      const rlKey = "preins_" + (postData.ci || postData.telefono || "anon");
      if (!verificarRateLimit(rlKey, 5, 180)) {
        return responseJSON({ status: "error", message: "Demasiadas peticiones. Por favor espera 3 minutos antes de enviar otra solicitud." });
      }

      let sheetIns = ss.getSheetByName("Inscripciones") || ss.insertSheet("Inscripciones");
      if (sheetIns.getLastRow() === 0) {
        sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción"]);
      }
      sheetIns.appendRow([
        gestion, mes, fecha,
        sanitizarEntradaTexto(postData.nombre || ""),
        sanitizarEntradaTexto(postData.ci || ""),
        sanitizarEntradaTexto(postData.fechaNacimiento || ""),
        sanitizarEntradaTexto(postData.telefono || ""),
        sanitizarEntradaTexto(postData.area || ""),
        sanitizarEntradaTexto(postData.carrera || ""),
        sanitizarEntradaTexto(postData.observaciones || ""),
        sanitizarEntradaTexto(postData.semestre || ""),
        sanitizarEntradaTexto(postData.casoExcepcional || (postData.esCasoExcepcional ? "Sí" : "No")),
        sanitizarEntradaTexto(postData.detalleExcepcion || "")
      ]);
      return responseJSON({ status: "success", message: "Pre-inscripción registrada con éxito." });
    } 
    
    else if (action === "contacto") {
      let sheetContact = ss.getSheetByName("Contacto") || ss.insertSheet("Contacto");
      if (sheetContact.getLastRow() === 0) {
        sheetContact.appendRow(["Gestión", "Mes", "Fecha", "Nombre", "Contacto (Teléfono/Correo)", "Asunto", "Mensaje"]);
      }
      sheetContact.appendRow([
        gestion, mes, fecha,
        postData.nombre || "", postData.contacto || "", postData.asunto || "", postData.mensaje || ""
      ]);
      return responseJSON({ status: "success", message: "Mensaje de contacto registrado con éxito." });
    }

    else if (action === "visita") {
      let sheetVis = ss.getSheetByName("Visitas") || ss.insertSheet("Visitas");
      if (sheetVis.getLastRow() === 0) {
        sheetVis.appendRow(["Gestión", "Mes", "Fecha_Hora", "Navegador"]);
      }
      sheetVis.appendRow([gestion, now.getMonth(), fecha, postData.userAgent || ""]);
      return responseJSON({ status: "success", message: "Visita registrada." });
    }

    else if (action === "guardar-docentes") {
      let sheetDocentes = ss.getSheetByName("Docentes") || ss.insertSheet("Docentes");
      if (sheetDocentes.getLastRow() === 0) {
        sheetDocentes.appendRow(["Codigo", "Nombre", "Materia_Carrera", "Area"]);
      }
      if (postData.docentes) {
        const data = sheetDocentes.getDataRange().getValues();
        const docentesMap = postData.docentes;
        for (let codigo in docentesMap) {
          const nuevoNombre = docentesMap[codigo];
          let encontrado = false;
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim().toLowerCase() === String(codigo).trim().toLowerCase()) {
              sheetDocentes.getRange(i + 1, 2).setValue(nuevoNombre);
              encontrado = true;
              break;
            }
          }
          if (!encontrado) {
            sheetDocentes.appendRow([codigo, nuevoNombre, "", ""]);
          }
        }
        return responseJSON({ status: "success", message: "Docentes actualizados en Google Sheets." });
      }
    }

    else if (action === "guardar-carreras") {
      let sheetCarreras = ss.getSheetByName("Carreras_Tecnicas") || ss.insertSheet("Carreras_Tecnicas");
      if (postData.carreras && Array.isArray(postData.carreras)) {
        sheetCarreras.clearContents();
        sheetCarreras.appendRow(["Codigo", "Nombre", "DocenteCodigo", "Color", "Resumen"]);
        postData.carreras.forEach(carr => {
          sheetCarreras.appendRow([carr.key || "tec-gen", carr.nombre || "", carr.docente || carr.key || "", carr.color || "#1a6b2e", carr.resumen || ""]);
        });
        return responseJSON({ status: "success", message: "Carreras actualizadas en Google Sheets." });
      }
    }

    else if (action === "guardar-materias") {
      let sheetMaterias = ss.getSheetByName("Materias_Humanistica") || ss.insertSheet("Materias_Humanistica");
      if (postData.materias && Array.isArray(postData.materias)) {
        sheetMaterias.clearContents();
        sheetMaterias.appendRow(["Materia", "Docente", "Ciclo"]);
        postData.materias.forEach(matName => {
          sheetMaterias.appendRow([matName, "", "1° – 6°"]);
        });
        return responseJSON({ status: "success", message: "Materias humanísticas actualizadas en Google Sheets." });
      }
    }

    else if (action === "guardar-kardex") {
      let sheetKardex = ss.getSheetByName("Kardex_Docentes") || ss.insertSheet("Kardex_Docentes");
      if (sheetKardex.getLastRow() === 0) {
        sheetKardex.appendRow(["DocenteId", "NombreCompleto", "CI", "RDA", "Area_Especialidad", "FechaActualizacion", "JSON_Kardex"]);
      }
      const k = postData.kardex || {};
      const docId = postData.docenteId || k.ci || "docente";
      const nom = [k.nombres, k.paterno, k.materno].filter(Boolean).join(" ");
      const dataRows = sheetKardex.getDataRange().getValues();
      let encontrado = false;
      for (let i = 1; i < dataRows.length; i++) {
        if (String(dataRows[i][0]).trim().toLowerCase() === String(docId).trim().toLowerCase()) {
          sheetKardex.getRange(i + 1, 2).setValue(nom);
          sheetKardex.getRange(i + 1, 3).setValue(k.ci || "");
          sheetKardex.getRange(i + 1, 4).setValue(k.rda || "");
          sheetKardex.getRange(i + 1, 5).setValue(k.ue || "");
          sheetKardex.getRange(i + 1, 6).setValue(fecha);
          sheetKardex.getRange(i + 1, 7).setValue(JSON.stringify(k));
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        sheetKardex.appendRow([docId, nom, k.ci || "", k.rda || "", k.ue || "", fecha, JSON.stringify(k)]);
      }
      return responseJSON({ status: "success", message: "Kardex docente guardado en Google Sheets." });
    }

    else if (action === "guardar-horarios") {
      let sheetHorarios = ss.getSheetByName("Horarios") || ss.insertSheet("Horarios");
      if (postData.horarios) {
        sheetHorarios.clearContents();
        sheetHorarios.appendRow(["Area", "Dia", "Hora"]);
        if (Array.isArray(postData.horarios.hum)) {
          postData.horarios.hum.forEach(h => sheetHorarios.appendRow(["hum", h.dia, h.hora]));
        }
        if (Array.isArray(postData.horarios.tec)) {
          postData.horarios.tec.forEach(h => sheetHorarios.appendRow(["tec", h.dia, h.hora]));
        }
        return responseJSON({ status: "success", message: "Horarios actualizados en Google Sheets." });
      }
    }

    else if (action === "guardar-horarios-matriz") {
      let sheetHorariosMat = ss.getSheetByName("Horarios_Matriz") || ss.insertSheet("Horarios_Matriz");
      if (postData.horariosMatriz) {
        // 1. Guardar copia JSON de respaldo en Director_y_Textos
        let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
        const dataTxt = sheetTextos.getDataRange().getValues();
        const claveH = "horarios_matriz_json";
        const valH = JSON.stringify(postData.horariosMatriz);
        let encH = false;
        for (let i = 1; i < dataTxt.length; i++) {
          if (String(dataTxt[i][0]).trim() === claveH) {
            sheetTextos.getRange(i + 1, 2).setValue(valH);
            encH = true;
            break;
          }
        }
        if (!encH) sheetTextos.appendRow([claveH, valH]);

        // 2. Guardar filas legibles en Horarios_Matriz de forma ULTRA RÁPIDA (BATCH SETVALUES)
        sheetHorariosMat.clearContents();
        sheetHorariosMat.appendRow(["Turno", "Dia", "PeriodoNum", "HoraInicio", "HoraFin", "Docente", "Materia", "Curso", "Sede"]);
        aplicarEstiloEncabezado(sheetHorariosMat, 9);
        const hm = postData.horariosMatriz;
        const sedeVal = postData.sede || "central";
        const allRows = [];

        ["hum", "tec"].forEach(t => {
          if (hm[t] && hm[t].matriz) {
            const periodos = hm[t].periodos || [];
            const matriz = hm[t].matriz;
            for (let dia in matriz) {
              for (let pNum in matriz[dia]) {
                const slot = matriz[dia][pNum];
                const pInfo = (Array.isArray(periodos) ? periodos.find(p => String(p.num) === String(pNum)) : null) || {};
                const hIni = pInfo.inicio || "";
                const hFin = pInfo.fin || "";
                if (Array.isArray(slot)) {
                  slot.forEach((item, idx) => {
                    allRows.push([
                      t, dia, Number(pNum) || pNum, hIni, hFin,
                      (item && item.docente) || "", (item && item.materia) || "", (item && (item.curso || item.sub)) || ("Curso " + (idx + 1)), sedeVal
                    ]);
                  });
                } else if (slot && typeof slot === 'object') {
                  allRows.push([
                    t, dia, Number(pNum) || pNum, hIni, hFin,
                    slot.docente || "", slot.materia || "", slot.curso || "", sedeVal
                  ]);
                }
              }
            }
          }
        });

        if (allRows.length > 0) {
          sheetHorariosMat.getRange(2, 1, allRows.length, 9).setValues(allRows);
        }
      }
      if (postData.horariosMerges) {
        let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
        const data = sheetTextos.getDataRange().getValues();
        const clave = "horarios_merges_json";
        const val = JSON.stringify(postData.horariosMerges);
        let enc = false;
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === clave) {
            sheetTextos.getRange(i + 1, 2).setValue(val);
            enc = true;
            break;
          }
        }
        if (!enc) sheetTextos.appendRow([clave, val]);
      }
      return responseJSON({ status: "success", message: "Horarios matriz y combinaciones guardados exitosamente en Google Sheets." });
    }

    else if (action === "guardar-drive") {
      // 1. Guardar y actualizar la pestaña "Documentos" en Google Sheets
      let sheetDocs = ss.getSheetByName("Documentos") || ss.insertSheet("Documentos");
      if (sheetDocs.getLastRow() === 0) {
        sheetDocs.appendRow(["Titulo", "Descripcion", "Icono", "Enlace", "BotonTexto", "Key"]);
        sheetDocs.appendRow(["Reglamento Interno", "Normas y disposiciones del CEA Madre Marie Poussepín.", "documento", (postData.drive && postData.drive.reglamento) || "#", "Ver / Descargar", "reglamento"]);
        sheetDocs.appendRow(["Formulario de Inscripción", "Formulario oficial para la inscripción presencial.", "formulario", (postData.drive && postData.drive.formulario) || "#", "Ver / Descargar", "formulario"]);
        sheetDocs.appendRow(["Mallas Curriculares", "Mallas oficiales de todas las carreras técnicas.", "mallas", (postData.drive && postData.drive.mallas) || "#", "Ver / Descargar", "mallas"]);
        sheetDocs.appendRow(["Calendario Académico 2026", "Fechas importantes de la gestión 2026.", "calendario", (postData.drive && postData.drive.calendario) || "#", "Ver / Descargar", "calendario"]);
      } else if (postData.drive) {
        const dataDocs = sheetDocs.getDataRange().getValues();
        const driveMap = postData.drive;
        for (let i = 1; i < dataDocs.length; i++) {
          const rowKey = String(dataDocs[i][5] || dataDocs[i][0] || "").toLowerCase();
          if (rowKey.indexOf("reglamento") !== -1 && driveMap.reglamento) {
            sheetDocs.getRange(i + 1, 4).setValue(driveMap.reglamento);
          } else if (rowKey.indexOf("formulario") !== -1 && driveMap.formulario) {
            sheetDocs.getRange(i + 1, 4).setValue(driveMap.formulario);
          } else if (rowKey.indexOf("malla") !== -1 && driveMap.mallas) {
            sheetDocs.getRange(i + 1, 4).setValue(driveMap.mallas);
          } else if (rowKey.indexOf("calendario") !== -1 && driveMap.calendario) {
            sheetDocs.getRange(i + 1, 4).setValue(driveMap.calendario);
          }
        }
      }

      // 2. Guardar también en "Director_y_Textos" por doble seguridad
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      if (postData.drive) {
        const data = sheetTextos.getDataRange().getValues();
        const driveMap = postData.drive;
        for (let k in driveMap) {
          const keyName = "drive_" + k;
          const val = driveMap[k];
          let enc = false;
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim() === keyName) {
              sheetTextos.getRange(i + 1, 2).setValue(val);
              enc = true;
              break;
            }
          }
          if (!enc) {
            sheetTextos.appendRow([keyName, val]);
          }
        }
      }
      return responseJSON({ status: "success", message: "Enlaces de documentos actualizados en la pestaña Documentos de Google Sheets." });
    }

    else if (action === "guardar-usuarios-docentes") {
      let sheetUsuarios = ss.getSheetByName("Usuarios_Docentes") || ss.insertSheet("Usuarios_Docentes");
      if (postData.usuarios) {
        sheetUsuarios.clearContents();
        sheetUsuarios.appendRow(["AreaKey", "Usuario", "Contrasena"]);
        const uObj = postData.usuarios;
        for (let key in uObj) {
          sheetUsuarios.appendRow([key, uObj[key].user || "", uObj[key].pass || ""]);
        }
        return responseJSON({ status: "success", message: "Usuarios docentes actualizados en Google Sheets." });
      }
    }

    else if (action === "guardar-credenciales-director") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      if (postData.creds) {
        const data = sheetTextos.getDataRange().getValues();
        const credsMap = {
          "director_usuario": postData.creds.user,
          "director_contrasena": postData.creds.pass
        };
        for (let clave in credsMap) {
          const val = credsMap[clave];
          let enc = false;
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim() === clave) {
              sheetTextos.getRange(i + 1, 2).setValue(val);
              enc = true;
              break;
            }
          }
          if (!enc) {
            sheetTextos.appendRow([clave, val]);
          }
        }
        return responseJSON({ status: "success", message: "Credenciales de director actualizadas en Google Sheets." });
      }
    }

    else if (action === "guardar-director") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const dir = postData.director || postData;
      const data = sheetTextos.getDataRange().getValues();
      const campos = {
        "director_nombre": dir.nombre || dir.director_nombre,
        "director_telefono": dir.telefono || dir.director_telefono,
        "director_correo": dir.correo || dir.director_correo,
        "director_titulo": dir.titulo || dir.director_titulo
      };
      for (let extraKey in dir) {
        if (extraKey !== "action" && extraKey !== "token" && campos[extraKey] === undefined) {
          campos[extraKey] = dir[extraKey];
        }
      }
      for (let k in campos) {
        if (campos[k] !== undefined) {
          let enc = false;
          for (let i = 1; i < data.length; i++) {
            if (String(data[i][0]).trim() === k) {
              sheetTextos.getRange(i + 1, 2).setValue(campos[k]);
              enc = true;
              break;
            }
          }
          if (!enc) {
            sheetTextos.appendRow([k, campos[k]]);
          }
        }
      }
      return responseJSON({ status: "success", message: "Datos y contacto del Director actualizados correctamente." });
    }

    else if (action === "guardar-contenido" || action === "guardar-textos" || action === "guardar-contenido-vivo-multiple") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const textosMap = postData.textos || postData;
      for (let clave in textosMap) {
        if (clave === "action" || clave === "token") continue;
        const nuevoValor = textosMap[clave];
        let encontrado = false;
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === String(clave).trim()) {
            sheetTextos.getRange(i + 1, 2).setValue(nuevoValor);
            encontrado = true;
            break;
          }
        }
        if (!encontrado) {
          sheetTextos.appendRow([clave, nuevoValor]);
        }
      }
      return responseJSON({ status: "success", message: "Textos y configuraciones actualizados correctamente." });
    }

    else if (action === "guardar-bth-carrera") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = "bth_carrera_activa";
      const nuevoValor = postData.carreraBTH || postData.carrera || "";
      let encontrado = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(nuevoValor);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        sheetTextos.appendRow([clave, nuevoValor]);
      }
      return responseJSON({ status: "success", message: "Carrera BTH guardada." });
    }

    else if (action === "guardar-bth-modulos") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = "bth_modulos_" + (postData.carrera || "") + "_" + (postData.area || "");
      const nuevoValor = postData.modulos || "";
      let encontrado = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(nuevoValor);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        sheetTextos.appendRow([clave, nuevoValor]);
      }
      return responseJSON({ status: "success", message: "Módulos BTH guardados." });
    }

    else if (action === "guardar-bth-filas") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = "bth_filas_humanistica";
      const nuevoValor = JSON.stringify(postData.filasBTH || []);
      let encontrado = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(nuevoValor);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        sheetTextos.appendRow([clave, nuevoValor]);
      }
      return responseJSON({ status: "success", message: "Filas humanísticas BTH guardadas." });
    }

    else if (action === "guardar-color-materia") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = "color_materia_" + String(postData.materia || "").trim().toLowerCase();
      const nuevoValor = postData.colorTexto ? JSON.stringify({ bg: postData.color, txt: postData.colorTexto }) : (postData.color || "");
      let encontrado = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(nuevoValor);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        sheetTextos.appendRow([clave, nuevoValor]);
      }
      return responseJSON({ status: "success", message: "Color de materia guardado en Google Sheets." });
    }

    else if (action === "guardar-gestor-config" || action === "guardar-turnos-dias-hum" || action === "guardar-turnos-dias-tec") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = action === "guardar-gestor-config" ? "gestor_app_state_json" : action;
      const nuevoValor = JSON.stringify(postData.appStateGestor || postData.turnos || postData);
      let encontrado = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(nuevoValor);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        sheetTextos.appendRow([clave, nuevoValor]);
      }
      return responseJSON({ status: "success", message: "Configuración de diseño de horario guardada." });
    }

    else if (action === "guardar-actividad") {
      let sheetAct = ss.getSheetByName("Actividades") || ss.insertSheet("Actividades");
      if (sheetAct.getLastRow() === 0) {
        sheetAct.appendRow(["ID", "Gestion", "Mes", "Fecha", "Titulo", "Descripcion", "TipoMedia", "UrlMedia", "Autor"]);
      }
      const act = postData.actividad;
      if (act) {
        // Convertir Base64 en archivo real en Google Drive si corresponde
        if (act.urlMedia && act.urlMedia.indexOf("data:") === 0) {
          act.urlMedia = guardarMediaEnDrive(act.urlMedia, act.titulo);
        }

        const dataAct = sheetAct.getDataRange().getValues();
        let enc = false;
        const actId = act.id || ("act-" + Date.now());
        for (let i = 1; i < dataAct.length; i++) {
          if (String(dataAct[i][0]) === String(actId)) {
            sheetAct.getRange(i + 1, 2, 1, 8).setValues([[
              act.gestion || gestion, act.mes || mes, act.fecha || fecha,
              act.titulo || "", act.descripcion || "", act.tipoMedia || "ninguno",
              act.urlMedia || "", act.autor || "Docente / Dirección"
            ]]);
            enc = true;
            break;
          }
        }
        if (!enc) {
          sheetAct.appendRow([
            actId, act.gestion || gestion, act.mes || mes, act.fecha || fecha,
            act.titulo || "", act.descripcion || "", act.tipoMedia || "ninguno",
            act.urlMedia || "", act.autor || "Docente / Dirección"
          ]);
        }
        return responseJSON({ status: "success", message: "Actividad guardada en Google Sheets y archivo guardado en Google Drive.", driveUrl: act.urlMedia });
      }
    }

    else if (action === "eliminar-actividad") {
      let sheetAct = ss.getSheetByName("Actividades");
      if (sheetAct && postData.id) {
        const dataAct = sheetAct.getDataRange().getValues();
        for (let i = 1; i < dataAct.length; i++) {
          if (String(dataAct[i][0]).trim() === String(postData.id).trim()) {
            sheetAct.deleteRow(i + 1);
            return responseJSON({ status: "success", message: "Actividad eliminada de Google Sheets." });
          }
        }
      }
    }

    else if (action === "eliminar-inscripcion") {
      let sheetIns = ss.getSheetByName("Inscripciones");
      let deletedCount = 0;
      if (sheetIns && (postData.ci || postData.nombre)) {
        const dataIns = sheetIns.getDataRange().getValues();
        const targetCi = postData.ci ? String(postData.ci).trim().toLowerCase() : "";
        const targetNom = postData.nombre ? String(postData.nombre).trim().toLowerCase() : "";
        // Recorrer de abajo hacia arriba para no desfasar índices de filas al borrar
        for (let i = dataIns.length - 1; i >= 1; i--) {
          const rowCi = String(dataIns[i][4] || "").trim().toLowerCase();
          const rowNom = String(dataIns[i][3] || "").trim().toLowerCase();
          const matchCi = targetCi && (rowCi === targetCi || rowCi.replace(/[^\d]/g, '') === targetCi.replace(/[^\d]/g, ''));
          const matchNom = targetNom && rowNom === targetNom;
          if (matchCi || matchNom) {
            sheetIns.deleteRow(i + 1);
            deletedCount++;
          }
        }
        return responseJSON({
          status: "success",
          deletedCount: deletedCount,
          message: deletedCount > 0 ? ("Pre-inscripción eliminada (" + deletedCount + " fila(s)) de Google Sheets.") : "No se encontró coincidencia en Google Sheets."
        });
      }
      return responseJSON({ status: "error", message: "Faltan datos de CI o Nombre para eliminar." });
    }

    else if (action === "guardar-todas-inscripciones") {
      let sheetIns = ss.getSheetByName("Inscripciones") || ss.insertSheet("Inscripciones");
      sheetIns.clearContents();
      sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción"]);
      const lista = postData.inscripciones || [];
      lista.forEach(ins => {
        sheetIns.appendRow([
          ins.gestion || gestion,
          ins.mes || mes,
          ins.fecha || Utilities.formatDate(new Date(ins.fechaRegistro || now), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
          ins.nombre || "",
          ins.ci || "",
          ins.fechaNacimiento || "",
          ins.telefono || "",
          ins.area || "",
          ins.carrera || "",
          ins.observaciones || "",
          ins.semestre || "",
          ins.casoExcepcional || (ins.esCasoExcepcional ? "Sí" : "No"),
          ins.detalleExcepcion || ""
        ]);
      });
      return responseJSON({ status: "success", count: lista.length, message: "Lista completa de pre-inscripciones sincronizada en Google Sheets." });
    }

    else if (action === "limpiar-inscripciones") {
      let sheetIns = ss.getSheetByName("Inscripciones");
      if (sheetIns) {
        const targetGestion = postData.gestion ? String(postData.gestion).trim() : "todas";
        if (targetGestion && targetGestion !== "todas") {
          const dataIns = sheetIns.getDataRange().getValues();
          let deleted = 0;
          for (let i = dataIns.length - 1; i >= 1; i--) {
            const rowGest = String(dataIns[i][0] || "").trim();
            if (rowGest === targetGestion) {
              sheetIns.deleteRow(i + 1);
              deleted++;
            }
          }
          return responseJSON({
            status: "success",
            deletedCount: deleted,
            message: "Pre-inscripciones de la gestión " + targetGestion + " eliminadas (" + deleted + " registros) de Google Sheets."
          });
        } else {
          sheetIns.clearContents();
          sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción"]);
          aplicarEstiloEncabezado(sheetIns, 13);
          return responseJSON({
            status: "success",
            message: "Todas las pre-inscripciones de todas las gestiones fueron eliminadas de Google Sheets."
          });
        }
      }
      return responseJSON({ status: "error", message: "Hoja de Inscripciones no encontrada." });
    }

    else if (action === "guardar-malla") {
      let sheetMalla = ss.getSheetByName("Mallas_Curriculares") || ss.insertSheet("Mallas_Curriculares");
      if (postData.carreraKey && postData.malla) {
        const carreraKey = postData.carreraKey;
        const dataMalla = sheetMalla.getDataRange().getValues();
        for (let i = dataMalla.length - 1; i >= 1; i--) {
          if (String(dataMalla[i][0]) === String(carreraKey)) {
            sheetMalla.deleteRow(i + 1);
          }
        }
        postData.malla.forEach(nivelObj => {
          const nivelName = nivelObj.nivel;
          (nivelObj.modulos || []).forEach(modPair => {
            sheetMalla.appendRow([carreraKey, nivelName, modPair[0], modPair[1]]);
          });
        });
        return responseJSON({ status: "success", message: "Malla curricular actualizada en Google Sheets." });
      }
    }

    else if (action === "guardar-doc-niveles") {
      let sheetDocNiv = ss.getSheetByName("Documentos_Niveles") || ss.insertSheet("Documentos_Niveles");
      if (sheetDocNiv.getLastRow() === 0) {
        sheetDocNiv.appendRow(["CarreraKey", "Nivel", "Enlace"]);
      }
      if (postData.carreraKey && postData.drive) {
        const carreraKey = postData.carreraKey;
        const driveMap = postData.drive;
        const dataDocNiv = sheetDocNiv.getDataRange().getValues();
        for (let nivel in driveMap) {
          const val = driveMap[nivel];
          let enc = false;
          for (let i = 1; i < dataDocNiv.length; i++) {
            if (String(dataDocNiv[i][0]).trim() === String(carreraKey).trim() && String(dataDocNiv[i][1]).trim() === String(nivel).trim()) {
              sheetDocNiv.getRange(i + 1, 3).setValue(val);
              enc = true;
              break;
            }
          }
          if (!enc) {
            sheetDocNiv.appendRow([carreraKey, nivel, val]);
          }
        }
        return responseJSON({ status: "success", message: "Documentos por nivel guardados en Google Sheets." });
      }
    }

    else if (action === "guardar-contenido-vivo") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      if (sheetTextos.getLastRow() === 0) {
        sheetTextos.appendRow(["Clave", "Valor"]);
      }
      const key = String(postData.key || "").trim();
      const val = postData.htmlValor || postData.valor || "";
      if (key) {
        const data = sheetTextos.getDataRange().getValues();
        let enc = false;
        for (let i = 1; i < data.length; i++) {
          if (String(data[i][0]).trim() === key) {
            sheetTextos.getRange(i + 1, 2).setValue(val);
            enc = true;
            break;
          }
        }
        if (!enc) {
          sheetTextos.appendRow([key, val]);
        }
        return responseJSON({ status: "success", message: "Contenido '" + key + "' actualizado correctamente en Google Sheets." });
      }
    }

    else if (action === "eliminar-carrera") {
      const key = String(postData.key || "").trim().toLowerCase();
      if (key) {
        // 1. Eliminar de Carreras_Tecnicas
        let sheetC = ss.getSheetByName("Carreras_Tecnicas");
        if (sheetC) {
          const dataC = sheetC.getDataRange().getValues();
          for (let i = dataC.length - 1; i >= 1; i--) {
            if (String(dataC[i][0]).trim().toLowerCase() === key) {
              sheetC.deleteRow(i + 1);
            }
          }
        }
        // 2. Eliminar de Mallas_Curriculares
        let sheetM = ss.getSheetByName("Mallas_Curriculares");
        if (sheetM) {
          const dataM = sheetM.getDataRange().getValues();
          for (let i = dataM.length - 1; i >= 1; i--) {
            if (String(dataM[i][0]).trim().toLowerCase() === key) {
              sheetM.deleteRow(i + 1);
            }
          }
        }
        // 3. Eliminar de Docentes asociados
        let sheetD = ss.getSheetByName("Docentes");
        if (sheetD) {
          const dataD = sheetD.getDataRange().getValues();
          for (let i = dataD.length - 1; i >= 1; i--) {
            if (String(dataD[i][0]).trim().toLowerCase() === key) {
              sheetD.deleteRow(i + 1);
            }
          }
        }
        // 4. Eliminar de Usuarios_Docentes
        let sheetU = ss.getSheetByName("Usuarios_Docentes");
        if (sheetU) {
          const dataU = sheetU.getDataRange().getValues();
          for (let i = dataU.length - 1; i >= 1; i--) {
            if (String(dataU[i][0]).trim().toLowerCase() === key) {
              sheetU.deleteRow(i + 1);
            }
          }
        }
        return responseJSON({ status: "success", message: "Carrera y sus mallas/docentes asociados eliminados de Google Sheets." });
      }
    }

    else if (action === "eliminar-docente") {
      const codigo = String(postData.codigo || "").trim().toLowerCase();
      if (codigo) {
        let sheetD = ss.getSheetByName("Docentes");
        if (sheetD) {
          const dataD = sheetD.getDataRange().getValues();
          for (let i = dataD.length - 1; i >= 1; i--) {
            if (String(dataD[i][0]).trim().toLowerCase() === codigo) {
              sheetD.deleteRow(i + 1);
            }
          }
        }
        let sheetU = ss.getSheetByName("Usuarios_Docentes");
        if (sheetU) {
          const dataU = sheetU.getDataRange().getValues();
          for (let i = dataU.length - 1; i >= 1; i--) {
            if (String(dataU[i][0]).trim().toLowerCase() === codigo) {
              sheetU.deleteRow(i + 1);
            }
          }
        }
        return responseJSON({ status: "success", message: "Docente y sus accesos eliminados de Google Sheets." });
      }
    }

    else if (action === "guardar-foto-galeria") {
      let sheetGal = ss.getSheetByName("Galeria_Fotos") || ss.insertSheet("Galeria_Fotos");
      if (sheetGal.getLastRow() === 0) {
        sheetGal.appendRow(["ID", "Gestion", "Mes", "Fecha", "Titulo", "CarreraKey", "CarreraNombre", "UrlFoto", "Autor"]);
      }
      const foto = postData.foto;
      if (foto) {
        if (foto.urlFoto && foto.urlFoto.indexOf("data:") === 0) {
          foto.urlFoto = guardarMediaEnDrive(foto.urlFoto, (foto.carreraKey || "foto") + "_" + (foto.titulo || "galeria"));
        }
        const dataGal = sheetGal.getDataRange().getValues();
        let enc = false;
        const fotoId = foto.id || ("foto-" + Date.now());
        for (let i = 1; i < dataGal.length; i++) {
          if (String(dataGal[i][0]) === String(fotoId)) {
            sheetGal.getRange(i + 1, 2, 1, 8).setValues([[
              foto.gestion || gestion, foto.mes || mes, foto.fecha || fecha,
              foto.titulo || "", foto.carreraKey || "general", foto.carreraNombre || "General / Institucional",
              foto.urlFoto || "", foto.autor || "Dirección / Docente"
            ]]);
            enc = true;
            break;
          }
        }
        if (!enc) {
          sheetGal.appendRow([
            fotoId, foto.gestion || gestion, foto.mes || mes, foto.fecha || fecha,
            foto.titulo || "", foto.carreraKey || "general", foto.carreraNombre || "General / Institucional",
            foto.urlFoto || "", foto.autor || "Dirección / Docente"
          ]);
        }
        return responseJSON({ status: "success", message: "Fotografía guardada en la galería de Google Sheets.", driveUrl: foto.urlFoto });
      }
    }

    else if (action === "eliminar-foto-galeria") {
      let sheetGal = ss.getSheetByName("Galeria_Fotos");
      if (sheetGal && postData.id) {
        const dataGal = sheetGal.getDataRange().getValues();
        for (let i = 1; i < dataGal.length; i++) {
          if (String(dataGal[i][0]).trim() === String(postData.id).trim()) {
            sheetGal.deleteRow(i + 1);
            return responseJSON({ status: "success", message: "Fotografía eliminada de la galería en Google Sheets." });
          }
        }
      }
    }

    else if (action === "guardar-calendario") {
      let sheetCal = ss.getSheetByName("Calendario_Academico") || ss.insertSheet("Calendario_Academico");
      sheetCal.clearContents();
      sheetCal.appendRow(["Gestion", "Semestre", "Actividad", "FechaProgramada", "Id"]);
      if (Array.isArray(postData.calendario)) {
        postData.calendario.forEach(item => {
          sheetCal.appendRow([
            item.gestion || gestion,
            item.semestre || "",
            item.actividad || "",
            item.fecha || "",
            item.id || ""
          ]);
        });
      }
      return responseJSON({ status: "success", message: "Calendario académico actualizado en Google Sheets." });
    }

    else if (action === "guardar-epja-niveles") {
      let sheetEPJA = ss.getSheetByName("Niveles_EPJA") || ss.insertSheet("Niveles_EPJA");
      sheetEPJA.clearContents();
      sheetEPJA.appendRow(["EducacionRegular", "EducacionAlternativaEPJA", "EdadMinima", "FechaLimite"]);
      if (Array.isArray(postData.niveles)) {
        postData.niveles.forEach(item => {
          sheetEPJA.appendRow([
            item.regular || "",
            item.alternativa || "",
            item.edadMinima || "",
            item.fechaLimite || ""
          ]);
        });
      }
      return responseJSON({ status: "success", message: "Niveles y equivalencias EPJA actualizados en Google Sheets." });
    }

    else if (action === "guardar-humanistica-malla") {
      let sheetHum = ss.getSheetByName("Malla_Humanistica") || ss.insertSheet("Malla_Humanistica");
      sheetHum.clearContents();
      sheetHum.appendRow(["Tipo", "MateriaOTitulo", "DocenteOParam", "CicloODuracion", "ExtraRequisito"]);
      aplicarEstiloEncabezado(sheetHum, 5);
      const hData = postData.humanistica || postData.data || {};
      if (Array.isArray(hData.epa)) {
        hData.epa.forEach(item => {
          sheetHum.appendRow(["EPA", item.materia || "", item.docente || "", item.ciclo || "", ""]);
        });
      }
      if (Array.isArray(hData.esa)) {
        hData.esa.forEach(item => {
          sheetHum.appendRow(["ESA", item.materia || "", item.docente || "", item.ciclo || "", ""]);
        });
      }
      if (Array.isArray(hData.ciclos)) {
        hData.ciclos.forEach(item => {
          sheetHum.appendRow(["CICLO", item.titulo || "", item.etapas || "", item.duracion || "", item.requisito || ""]);
        });
      }
      return responseJSON({ status: "success", message: "Malla humanística actualizada en Google Sheets." });
    }

    else if (action === "guardar-documentos-dinamicos" || action === "guardar-documentos" || action === "guardar-documentos-oficiales") {
      let sheetDocs = ss.getSheetByName("Documentos") || ss.insertSheet("Documentos");
      sheetDocs.clearContents();
      sheetDocs.appendRow(["Titulo", "Descripcion", "Icono", "Enlace", "BotonTexto", "Key"]);
      aplicarEstiloEncabezado(sheetDocs, 6);
      const docs = postData.documentos || [];
      if (Array.isArray(docs)) {
        docs.forEach(d => {
          sheetDocs.appendRow([
            d.titulo || "",
            d.descripcion || d.desc || "",
            d.icono || "documento",
            d.enlace || d.url || "#",
            d.botonTexto || "Ver / Descargar",
            d.key || d.id || ""
          ]);
        });
      }
      return responseJSON({ status: "success", message: "Documentos oficiales guardados en Google Sheets." });
    }

    else if (action === "guardar-carreras-tecnicas-lista") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = "carreras_tecnicas_lista_json";
      const val = JSON.stringify(postData.carreras || []);
      let enc = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(val);
          enc = true;
          break;
        }
      }
      if (!enc) sheetTextos.appendRow([clave, val]);
      return responseJSON({ status: "success", message: "Catálogo de carreras técnicas guardado en Google Sheets." });
    }

    else if (action === "guardar-req-niveles-tec") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = "req_niveles_tec_json";
      const val = JSON.stringify(postData.niveles || []);
      let enc = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(val);
          enc = true;
          break;
        }
      }
      if (!enc) sheetTextos.appendRow([clave, val]);
      return responseJSON({ status: "success", message: "Requisitos de niveles técnicos guardados en Google Sheets." });
    }

    else if (action === "guardar-casos-excepcionales") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const data = sheetTextos.getDataRange().getValues();
      const clave = "casos_excepcionales_json";
      const val = JSON.stringify(postData.casos || []);
      let enc = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(val);
          enc = true;
          break;
        }
      }
      if (!enc) sheetTextos.appendRow([clave, val]);
      return responseJSON({ status: "success", message: "Casos excepcionales guardados en Google Sheets." });
    }

    return responseJSON({ status: "error", message: "Acción no reconocida: " + action });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * Menú personalizado al abrir la hoja en Google Sheets
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('CEA Madre Marie Poussepín')
      .addItem('Inicializar y Configurar Todas las Hojas', 'inicializarHojas')
      .addToUi();
  } catch (e) {}
}

/**
 * Aplica estilos institucionales (verde bosque, texto blanco en negrita, fila fijada) al encabezado
 */
function aplicarEstiloEncabezado(sheet, numCols) {
  if (!sheet || numCols < 1) return;
  try {
    const range = sheet.getRange(1, 1, 1, numCols);
    range.setBackground("#0c5825"); // Verde institucional del CEA
    range.setFontColor("#ffffff");
    range.setFontWeight("bold");
    range.setFontFamily("Arial");
    range.setHorizontalAlignment("center");
    range.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 30);
    sheet.setFrozenRows(1);
  } catch (e) {}
}

/**
 * Función para inicializar automáticamente las 16 pestañas con toda la estructura y datos oficiales del CEA
 */
function inicializarHojas() {
  const ss = obtenerSpreadsheetPrincipal();

  // 1. Director_y_Textos
  let sheetT = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
  if (sheetT.getLastRow() === 0) {
    sheetT.appendRow(["Clave", "Valor"]);
    aplicarEstiloEncabezado(sheetT, 2);
    sheetT.appendRow(["director_nombre", "Lic. José Luis Alanoca Mamani"]);
    sheetT.appendRow(["director_telefono", "+591 71580845"]);
    sheetT.appendRow(["director_correo", "ceachulumani@gmail.com"]);
    sheetT.appendRow(["director_titulo", "Director CEA Madre Marie Poussepín"]);
    sheetT.appendRow(["bienvenida_texto", "Somos una institución educativa comprometida con el desarrollo integral de nuestra comunidad. Ofrecemos formación técnica y humanística de calidad, con docentes especializados y una malla curricular actualizada."]);
    sheetT.appendRow(["humanistica_texto", "Formación integral en ciencias y humanidades para jóvenes y adultos que desean completar su educación primaria y secundaria."]);
    sheetT.appendRow(["tecnica_texto", "Formación técnica con certificación progresiva. Cada módulo de 100 horas otorga un nivel de certificación."]);
    sheetT.appendRow(["director_usuario", "user"]);
    sheetT.appendRow(["director_contrasena", "user"]);
    sheetT.appendRow(["horarios_atencion_dia_hum", "Lunes a Viernes"]);
    sheetT.appendRow(["horarios_atencion_hora_hum", "08:00 - 12:00"]);
    sheetT.appendRow(["horarios_atencion_dia_tec", "Lunes a Viernes"]);
    sheetT.appendRow(["horarios_atencion_hora_tec", "14:00 - 18:00"]);
    sheetT.appendRow(["dias_clase_hum", "Lunes a Viernes (08:00 – 12:20)"]);
    sheetT.appendRow(["dias_clase_tec", "Lunes a Viernes (14:00 – 18:20)"]);
    sheetT.appendRow(["insc_gestion", "2026"]);
    sheetT.appendRow(["insc_sem1_inicio", "2026-01-15"]);
    sheetT.appendRow(["insc_sem1_fin", "2026-02-28"]);
    sheetT.appendRow(["insc_sem1_clases", "Febrero a Junio"]);
    sheetT.appendRow(["insc_sem2_inicio", "2026-06-15"]);
    sheetT.appendRow(["insc_sem2_fin", "2026-07-31"]);
    sheetT.appendRow(["insc_sem2_clases", "Agosto a Diciembre"]);
    sheetT.appendRow(["cfg_inscripciones_abiertas", "true"]);
    sheetT.appendRow(["cfg_modo_mantenimiento", "false"]);
    sheetT.appendRow(["cfg_habilitar_whatsapp", "true"]);
  }

  // 2. Docentes
  let sheetD = ss.getSheetByName("Docentes") || ss.insertSheet("Docentes");
  if (sheetD.getLastRow() === 0) {
    sheetD.appendRow(["Codigo", "Nombre", "Materia_Carrera", "Area"]);
    aplicarEstiloEncabezado(sheetD, 4);
    sheetD.appendRow(["hum-cn", "Lic. Edmar Callisaya Tapia", "Ciencias Naturales", "humanistica"]);
    sheetD.appendRow(["hum-mat", "Lic. Marcela Choque Mamani", "Matemática", "humanistica"]);
    sheetD.appendRow(["hum-cs", "Lic. María Estela Laura Tenorio", "Ciencias Sociales", "humanistica"]);
    sheetD.appendRow(["hum-len", "Lic. Efraina Pajarito Ventura", "Lenguaje", "humanistica"]);
    sheetD.appendRow(["tec-sis", "Lic. Gualberto Choque", "Sistemas Informáticos", "tecnica"]);
    sheetD.appendRow(["tec-sec", "Lic. Ofelia Flores", "Secretariado Ejecutivo", "tecnica"]);
    sheetD.appendRow(["tec-bel", "Lic. Maritza Ojeda Conde", "Belleza Integral", "tecnica"]);
    sheetD.appendRow(["tec-tex", "Lic. Maritza Ojeda Conde", "Confección Textil", "tecnica"]);
    sheetD.appendRow(["tec-gas", "Lic. Lourdes Chambi", "Gastronomía", "tecnica"]);
    sheetD.appendRow(["tec-agr", "Lic. Macario Ticonipa", "Agropecuaria", "tecnica"]);
  }

  // 3. Carreras_Tecnicas
  let sheetC = ss.getSheetByName("Carreras_Tecnicas") || ss.insertSheet("Carreras_Tecnicas");
  if (sheetC.getLastRow() === 0) {
    sheetC.appendRow(["Codigo", "Nombre", "DocenteCodigo", "Color", "Resumen"]);
    aplicarEstiloEncabezado(sheetC, 5);
    sheetC.appendRow(["tec-sis", "Sistemas Informáticos", "tec-sis", "#1565c0", "Instalación y mantenimiento de equipos, redes, bases de datos y desarrollo de software moderno."]);
    sheetC.appendRow(["tec-sec", "Secretariado Ejecutivo", "tec-sec", "#6a1b9a", "Gestión documental, redacción profesional, ofimática avanzada y administración eficiente de oficinas."]);
    sheetC.appendRow(["tec-bel", "Belleza Integral", "tec-bel", "#ad1457", "Corte, estilismo capilar, colorimetría, tratamientos estéticos, cuidado dérmico y maquillaje profesional."]);
    sheetC.appendRow(["tec-tex", "Confección Textil", "tec-tex", "#2e7d32", "Patronaje industrial, corte y confección de prendas, operatividad de máquinas y acabados de calidad."]);
    sheetC.appendRow(["tec-gas", "Gastronomía y Alimentación", "tec-gas", "#e64a19", "Arte culinario boliviano e internacional, pastelería, panadería, inocuidad alimentaria y gestión gastronómica."]);
    sheetC.appendRow(["tec-agr", "Agropecuaria", "tec-agr", "#558b2f", "Cultivos sostenibles, sistemas de riego, producción agroecológica y manejo pecuario regional."]);
  }

  // 4. Materias_Humanistica
  let sheetMH = ss.getSheetByName("Materias_Humanistica") || ss.insertSheet("Materias_Humanistica");
  if (sheetMH.getLastRow() === 0) {
    sheetMH.appendRow(["Materia", "Docente", "Ciclo"]);
    aplicarEstiloEncabezado(sheetMH, 3);
    sheetMH.appendRow(["Ciencias Naturales (Biología, Física, Química)", "Lic. Edmar Callisaya Tapia", "1° – 6°"]);
    sheetMH.appendRow(["Matemática y Estadística", "Lic. Marcela Choque Mamani", "1° – 6°"]);
    sheetMH.appendRow(["Ciencias Sociales (Historia, Geografía, Cívica)", "Lic. María Estela Laura Tenorio", "1° – 6°"]);
    sheetMH.appendRow(["Lenguaje y Literatura", "Lic. Efraina Pajarito Ventura", "1° – 6°"]);
    sheetMH.appendRow(["Educación Física y Valores", "Docente Asignado", "1° – 6°"]);
  }

  // 5. Horarios
  let sheetH = ss.getSheetByName("Horarios") || ss.insertSheet("Horarios");
  if (sheetH.getLastRow() === 0) {
    sheetH.appendRow(["Area", "Dia", "Hora"]);
    aplicarEstiloEncabezado(sheetH, 3);
    sheetH.appendRow(["hum", "Lunes a Viernes", "08:00 – 12:20"]);
    sheetH.appendRow(["tec", "Lunes a Viernes", "14:00 – 18:20"]);
  }

  // 6. Horarios_Matriz
  let sheetHMat = ss.getSheetByName("Horarios_Matriz") || ss.insertSheet("Horarios_Matriz");
  if (sheetHMat.getLastRow() === 0) {
    sheetHMat.appendRow(["Turno", "Dia", "PeriodoNum", "HoraInicio", "HoraFin", "Docente", "Materia", "Curso", "Sede"]);
    aplicarEstiloEncabezado(sheetHMat, 9);
    const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    const persHum = [
      { num: 1, ini: "08:00", fin: "08:40", mat: "Matemática", doc: "Lic. Marcela Choque", cur: "EPA / ESA" },
      { num: 2, ini: "08:40", fin: "09:20", mat: "Lenguaje y Literatura", doc: "Lic. Efraina Pajarito", cur: "EPA / ESA" },
      { num: 3, ini: "09:20", fin: "10:00", mat: "Ciencias Naturales", doc: "Lic. Edmar Callisaya", cur: "EPA / ESA" },
      { num: 4, ini: "10:20", fin: "11:00", mat: "Ciencias Sociales", doc: "Lic. María Estela Laura", cur: "EPA / ESA" },
      { num: 5, ini: "11:00", fin: "11:40", mat: "Valores y Cívica", doc: "Docente Asignado", cur: "EPA / ESA" },
      { num: 6, ini: "11:40", fin: "12:20", mat: "Reforzamiento / Taller", doc: "Equipo Docente", cur: "EPA / ESA" }
    ];
    const initialRows = [];
    dias.forEach(d => {
      persHum.forEach(p => {
        initialRows.push(["hum", d, p.num, p.ini, p.fin, p.doc, p.mat, p.cur, "central"]);
      });
    });
    const persTec = [
      { num: 1, ini: "14:00", fin: "14:40", mat: "Taller Práctico I", doc: "Docente Técnico", cur: "ETTP" },
      { num: 2, ini: "14:40", fin: "15:20", mat: "Taller Práctico II", doc: "Docente Técnico", cur: "ETTP" },
      { num: 3, ini: "15:20", fin: "16:00", mat: "Tecnología Especializada", doc: "Docente Técnico", cur: "ETTP" },
      { num: 4, ini: "16:20", fin: "17:00", mat: "Laboratorio / Taller III", doc: "Docente Técnico", cur: "ETTP" },
      { num: 5, ini: "17:00", fin: "17:40", mat: "Emprendimiento Técnico", doc: "Docente Técnico", cur: "ETTP" },
      { num: 6, ini: "17:40", fin: "18:20", mat: "Evaluación Modular", doc: "Docente Técnico", cur: "ETTP" }
    ];
    dias.forEach(d => {
      persTec.forEach(p => {
        initialRows.push(["tec", d, p.num, p.ini, p.fin, p.doc, p.mat, p.cur, "central"]);
      });
    });
    if (initialRows.length > 0) {
      sheetHMat.getRange(2, 1, initialRows.length, 9).setValues(initialRows);
    }
  }

  // 7. Usuarios_Docentes
  let sheetU = ss.getSheetByName("Usuarios_Docentes") || ss.insertSheet("Usuarios_Docentes");
  if (sheetU.getLastRow() === 0) {
    sheetU.appendRow(["AreaKey", "Usuario", "Contrasena"]);
    aplicarEstiloEncabezado(sheetU, 3);
    sheetU.appendRow(["tec-sis", "profe.sistemas", "docente123"]);
    sheetU.appendRow(["tec-sec", "profe.secretariado", "docente123"]);
    sheetU.appendRow(["tec-bel", "profe.belleza", "docente123"]);
    sheetU.appendRow(["tec-tex", "profe.textil", "docente123"]);
    sheetU.appendRow(["tec-gas", "profe.gastronomia", "docente123"]);
    sheetU.appendRow(["tec-agr", "profe.agropecuaria", "docente123"]);
    sheetU.appendRow(["hum-general", "profe.humanistica", "docente123"]);
  }

  // 8. Documentos
  let sheetDocs = ss.getSheetByName("Documentos") || ss.insertSheet("Documentos");
  if (sheetDocs.getLastRow() === 0) {
    sheetDocs.appendRow(["Titulo", "Descripcion", "Icono", "Enlace", "BotonTexto", "Key"]);
    aplicarEstiloEncabezado(sheetDocs, 6);
    sheetDocs.appendRow(["Reglamento Interno", "Normas y disposiciones del CEA Madre Marie Poussepín.", "documento", "#", "Ver / Descargar", "reglamento"]);
    sheetDocs.appendRow(["Formulario de Inscripción", "Formulario oficial para la inscripción presencial.", "formulario", "#", "Ver / Descargar", "formulario"]);
    sheetDocs.appendRow(["Mallas Curriculares", "Mallas oficiales de todas las carreras técnicas.", "mallas", "#", "Ver / Descargar", "mallas"]);
    sheetDocs.appendRow(["Resolución Ministerial", "Acreditación legal del Ministerio de Educación de Bolivia.", "resolucion", "#", "Ver / Descargar", "resolucion"]);
  }

  // 9. Documentos_Niveles
  let sheetDocNiv = ss.getSheetByName("Documentos_Niveles") || ss.insertSheet("Documentos_Niveles");
  if (sheetDocNiv.getLastRow() === 0) {
    sheetDocNiv.appendRow(["CarreraKey", "Nivel", "Enlace"]);
    aplicarEstiloEncabezado(sheetDocNiv, 3);
    const carrs = ["tec-sis", "tec-sec", "tec-bel", "tec-tex", "tec-gas", "tec-agr"];
    const nivs = ["Técnico Básico", "Técnico Auxiliar", "Técnico Medio"];
    carrs.forEach(c => {
      nivs.forEach(n => {
        sheetDocNiv.appendRow([c, n, "#"]);
      });
    });
  }

  // 10. Mallas_Curriculares
  let sheetMallas = ss.getSheetByName("Mallas_Curriculares") || ss.insertSheet("Mallas_Curriculares");
  if (sheetMallas.getLastRow() === 0) {
    sheetMallas.appendRow(["CarreraKey", "Nivel", "Modulo", "Materia"]);
    aplicarEstiloEncabezado(sheetMallas, 4);
    sheetMallas.appendRow(["tec-sis", "Técnico Básico", "Módulo 1", "Operación de Sistemas y Ofimática"]);
    sheetMallas.appendRow(["tec-sis", "Técnico Básico", "Módulo 2", "Mantenimiento Preventivo de Hardware"]);
    sheetMallas.appendRow(["tec-sis", "Técnico Auxiliar", "Módulo 3", "Redes de Datos y Cableado Estructurado"]);
    sheetMallas.appendRow(["tec-sis", "Técnico Auxiliar", "Módulo 4", "Bases de Datos y Lógica de Programación"]);
    sheetMallas.appendRow(["tec-sis", "Técnico Medio", "Módulo 5", "Desarrollo de Aplicaciones Web y Móviles"]);
    sheetMallas.appendRow(["tec-sis", "Técnico Medio", "Módulo 6", "Seguridad Informática y Servidores"]);
  }

  // 11. Calendario_Academico
  let sheetCal = ss.getSheetByName("Calendario_Academico") || ss.insertSheet("Calendario_Academico");
  if (sheetCal.getLastRow() === 0) {
    sheetCal.appendRow(["Gestion", "Semestre", "Actividad", "Fecha", "ID"]);
    aplicarEstiloEncabezado(sheetCal, 5);
    sheetCal.appendRow(["2026", "1er Semestre", "Inicio de Pre-Inscripciones 1er Semestre", "15/01/2026", "cal_1"]);
    sheetCal.appendRow(["2026", "1er Semestre", "Fecha Límite de Inscripciones 1er Semestre", "28/02/2026", "cal_2"]);
    sheetCal.appendRow(["2026", "1er Semestre", "Inicio de Clases Presenciales 1er Semestre", "02/02/2026", "cal_3"]);
    sheetCal.appendRow(["2026", "1er Semestre", "Evaluaciones y Cierre 1er Semestre", "26/06/2026", "cal_4"]);
    sheetCal.appendRow(["2026", "2do Semestre", "Inicio de Pre-Inscripciones 2do Semestre", "15/06/2026", "cal_5"]);
    sheetCal.appendRow(["2026", "2do Semestre", "Fecha Límite de Inscripciones 2do Semestre", "31/07/2026", "cal_6"]);
    sheetCal.appendRow(["2026", "2do Semestre", "Inicio de Clases Presenciales 2do Semestre", "03/08/2026", "cal_7"]);
    sheetCal.appendRow(["2026", "2do Semestre", "Culminación de Gestión Académica Anual", "04/12/2026", "cal_8"]);
  }

  // 12. Inscripciones
  let sheetIns = ss.getSheetByName("Inscripciones") || ss.insertSheet("Inscripciones");
  if (sheetIns.getLastRow() === 0) {
    sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción"]);
    aplicarEstiloEncabezado(sheetIns, 13);
  }

  // 13. Contacto
  let sheetCnt = ss.getSheetByName("Contacto") || ss.insertSheet("Contacto");
  if (sheetCnt.getLastRow() === 0) {
    sheetCnt.appendRow(["Gestión", "Mes", "Fecha", "Nombre", "Contacto (Teléfono/Correo)", "Asunto", "Mensaje"]);
    aplicarEstiloEncabezado(sheetCnt, 7);
  }

  // 14. Actividades
  let sheetAct = ss.getSheetByName("Actividades") || ss.insertSheet("Actividades");
  if (sheetAct.getLastRow() === 0) {
    sheetAct.appendRow(["ID", "Gestion", "Mes", "Fecha", "Titulo", "Descripcion", "TipoMedia", "UrlMedia", "Autor"]);
    aplicarEstiloEncabezado(sheetAct, 9);
    sheetAct.appendRow(["act-1", "2026", "Febrero", "02/02/2026", "Inauguración de la Gestión Académica 2026", "Acto oficial de bienvenida a estudiantes de Humanística y Carreras Técnicas.", "ninguno", "", "Dirección CEA"]);
  }

  // 15. Galeria_Fotos
  let sheetG = ss.getSheetByName("Galeria_Fotos") || ss.insertSheet("Galeria_Fotos");
  if (sheetG.getLastRow() === 0) {
    sheetG.appendRow(["ID", "Gestion", "Mes", "Fecha", "Titulo", "CarreraKey", "CarreraNombre", "UrlFoto", "Autor"]);
    aplicarEstiloEncabezado(sheetG, 9);
    sheetG.appendRow(["foto-1", "2026", "Enero", "15/01/2026", "Práctica de Ensamble y Redes", "tec-sis", "Sistemas Informáticos", "FOTOGRAFIA DE SISTEMAS.jpg", "Docente: Lic. Gualberto Choque"]);
    sheetG.appendRow(["foto-2", "2026", "Enero", "20/01/2026", "Instalaciones y Frontis Institucional", "general", "General / Institucional", "FOTOGRAFIA DEL CEA .jpeg", "Dirección CEA"]);
  }

  // 16. Visitas
  let sheetVis = ss.getSheetByName("Visitas") || ss.insertSheet("Visitas");
  if (sheetVis.getLastRow() === 0) {
    sheetVis.appendRow(["Gestion", "Mes", "Fecha", "IP_Sesion"]);
    aplicarEstiloEncabezado(sheetVis, 4);
  }

  // Si existe la pestaña por defecto "Hoja 1" o "Sheet1" vacía, eliminarla para mantener orden
  try {
    const hoja1 = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
    if (hoja1 && ss.getSheets().length > 1 && hoja1.getLastRow() === 0) {
      ss.deleteSheet(hoja1);
    }
  } catch (e) {}

  return "Todas las 16 hojas del CEA Madre Marie Poussepín fueron creadas y configuradas con éxito.";
}

/**
 * Guarda un archivo Base64 directamente como un archivo real en Google Drive
 * dentro de la carpeta "CEA_Archivos_Publicaciones" y retorna su URL pública
 */
function guardarMediaEnDrive(urlMedia, titulo) {
  if (!urlMedia || typeof urlMedia !== "string" || urlMedia.indexOf("data:") !== 0) {
    return urlMedia;
  }
  try {
    var folderName = "CEA_Archivos_Publicaciones";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
      try {
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(e) {}
    }
    
    var match = urlMedia.match(/^data:(.*?);base64,(.*)$/);
    if (!match) return urlMedia;
    
    var mimeType = match[1];
    var base64Data = match[2];
    var ext = mimeType.split("/")[1] || "png";
    if (ext.indexOf("jpeg") !== -1) ext = "jpg";
    else if (ext.indexOf("svg") !== -1) ext = "svg";
    else if (ext.indexOf("mp4") !== -1) ext = "mp4";
    else if (ext.indexOf("webm") !== -1) ext = "webm";
    
    var fileName = (titulo || "Publicacion_CEA").replace(/[^a-zA-Z0-9_-]/g, "_") + "_" + Date.now() + "." + ext;
    var bytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    
    var file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(e) {}
    
    return "https://lh3.googleusercontent.com/d/" + file.getId();
  } catch (err) {
    Logger.log("Error en guardarMediaEnDrive: " + err);
    return urlMedia;
  }
}
