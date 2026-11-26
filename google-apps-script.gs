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
  return ContentService.createTextOutput(JSON.stringify(Object.assign({apiVersion: 2}, data)))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── FUNCIONES DE SEGURIDAD (TOKEN, SANITIZACIÓN Y RATE LIMIT) ───


function generarTokenSeguro(usuario, rol, areaKey, version, cuentaKey) {
  const ts = new Date().getTime();
  const raw = JSON.stringify({ u: String(usuario), r: String(rol), t: ts, areaKey: areaKey || '', v: version || '', cuentaKey: cuentaKey || areaKey || '' });
  const payload = Utilities.base64Encode(raw);
  const sig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(payload, secretoCEA()));
  return payload + "." + sig;
}

function validarTokenSeguro(token, rolEsperado) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  try {
    const parts = token.split('.');
    const payloadB64 = parts[0];
    const sig = parts[1];
    const expectedSig = Utilities.base64Encode(Utilities.computeHmacSha256Signature(payloadB64, secretoCEA()));
    if (sig !== expectedSig) return false;

    const data = JSON.parse(Utilities.newBlob(Utilities.base64Decode(payloadB64)).getDataAsString());
    const now = new Date().getTime();
    // Expiración: 7 días (604,800,000 ms)
    if (!Number.isFinite(data.t) || data.t > now || now - data.t > 604800000) return false;

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

function sincronizarUsuariosDocentesSheet(ss, usuariosObj) {
  if(!usuariosObj||typeof usuariosObj!=='object')return;
  const sheet=ss.getSheetByName('Usuarios_Docentes');
  const rows=sheet&&sheet.getLastRow()?sheet.getDataRange().getDisplayValues():[['AreaKey','Usuario','Contrasena','Comision','Asignacion','Clave_Docente']];
  rows[0][4]='Asignacion';rows[0][5]='Clave_Docente';
  const indices=new Map(rows.slice(1).map((r,i)=>[String(r[0]).trim(),i+1]));
  for(const key of Object.keys(usuariosObj)){
    const item=usuariosObj[key];if(!item)continue;
    const index=indices.get(key),prev=index==null?[]:rows[index],fila=prev.slice();
    const clave=String(item.pass||'').trim(),usuario=String(item.user||'').trim();
    fila[0]=key;fila[1]=usuario||prev[1]||'';
    fila[2]=clave?(clave.startsWith('cea$')?clave:codificarClaveCEA(clave)):(prev[2]||'');
    fila[3]=(item.comision===true||/^(SI|TRUE)$/i.test(String(item.comision)))?'SI':'NO';
    fila[4]=String(item.asigKey||prev[4]||key).trim();
    fila[5]=clave&&!clave.startsWith('cea$')?clave:(prev[5]||'');
    if(index==null){indices.set(key,rows.length);rows.push(fila);}else rows[index]=fila;
  }
  escribirTablaCEA(ss,'Usuarios_Docentes',rows);
}

function claveVisibleDocenteCEA(row) {
  const stored = String(row[2] == null ? '' : row[2]).trim();
  if (!stored.startsWith('cea$')) return stored;
  const visible = String(row[5] == null ? '' : row[5]);
  return visible && comprobarClaveCEA(visible, stored) ? visible : '';
}

function docentesEliminadosCEA(ss) {
  const sheet = ss.getSheetByName('Docentes_Eliminados');
  return new Set(sheet ? sheet.getDataRange().getValues().slice(1).map(row => String(row[0]).trim()).filter(Boolean) : []);
}

function depurarDocentesEliminadosCEA(ss, data) {
  if (!data.docentes && !data.usuarios && !['guardar-contenido-vivo', 'guardar-textos'].includes(data.action)) return;
  const eliminados = docentesEliminadosCEA(ss);
  if (!eliminados.size) return;
  ['docentes', 'usuarios'].forEach(campo => {
    if (data[campo]) eliminados.forEach(key => delete data[campo][key]);
  });
  const contenido = data.action === 'guardar-contenido-vivo' && data.key === 'config_global_cea_json';
  if (contenido || (data.action === 'guardar-textos' && data.config_global_cea_json)) {
    const config = JSON.parse((contenido ? data.valor : data.config_global_cea_json) || '{}');
    ['cea_docentes', 'cea_docentes_asignaciones', 'cea_usuarios_docentes'].forEach(campo => {
      if (config[campo]) eliminados.forEach(key => delete config[campo][key]);
    });
    delete config.cea_docentes_eliminados;
    if (contenido) { data.valor = JSON.stringify(config); data.htmlValor = data.valor; }
    else data.config_global_cea_json = JSON.stringify(config);
  }
}

function eliminarDocentePersistenteCEA(ss, codigo) {
  const key = String(codigo || '').trim();
  exigirCEA(key, 'Selecciona un docente válido.');
  const sheetD = ss.getSheetByName('Docentes');
  const sheetU = ss.getSheetByName('Usuarios_Docentes');
  const docs = sheetD ? sheetD.getDataRange().getValues() : [];
  const users = sheetU ? sheetU.getDataRange().getValues() : [];
  const docente = docs.slice(1).find(row => String(row[0]).trim() === key);
  const cuenta = users.slice(1).find(row => String(row[0]).trim() === key);
  const nombre = docente ? String(docente[1] || '') : '';
  const area = cuenta ? areaCuentaDocenteCEA(ss, cuenta) : key;
  let restantesD = docs.filter((row, i) => i === 0 || String(row[0]).trim() !== key);
  const restantesU = users.filter((row, i) => i === 0 || String(row[0]).trim() !== key);
  const codigos = [key];
  if (area !== key && !restantesU.slice(1).some(row => String(row[0]).trim() === area) && restantesD.slice(1).some(row => String(row[0]).trim() === area && String(row[1]) === nombre)) {
    restantesD = restantesD.filter((row, i) => i === 0 || String(row[0]).trim() !== area);
    codigos.push(area);
  }
  const otraCuenta = restantesU.slice(1).find(row => areaCuentaDocenteCEA(ss, row) === area);
  const otroDocente = otraCuenta && restantesD.slice(1).find(row => String(row[0]).trim() === String(otraCuenta[0]).trim());
  const reemplazo = otroDocente ? String(otroDocente[1] || '') : '';
  if (sheetD) escribirTablaCEA(ss, 'Docentes', restantesD);
  if (sheetU) escribirTablaCEA(ss, 'Usuarios_Docentes', restantesU);
  const textos = ss.getSheetByName('Director_y_Textos');
  if (textos) {
    const rows = textos.getDataRange().getValues();
    const index = rows.findIndex(row => row[0] === 'config_global_cea_json');
    if (index >= 0) {
      const config = JSON.parse(rows[index][1] || '{}');
      ['cea_docentes', 'cea_docentes_asignaciones', 'cea_usuarios_docentes'].forEach(campo => { if (config[campo]) codigos.forEach(codigo => delete config[campo][codigo]); });
      if (Array.isArray(config.cea_areas_tec)) config.cea_areas_tec.forEach(item => { if (item.key === area && (item.docente === nombre || item.docente === key)) item.docente = reemplazo; });
      rows[index][1] = JSON.stringify(config);
      escribirTablaCEA(ss, 'Director_y_Textos', rows);
    }
  }
  ['Carreras_Tecnicas', 'Materias_Humanistica'].forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const rows = sheet.getDataRange().getValues();
    rows.slice(1).forEach(row => {
      const col = name === 'Carreras_Tecnicas' ? 2 : 1;
      const texto = String(row[0]).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const materia = {'hum-cn':'naturales', 'hum-mat':'matemat', 'hum-cs':'sociales', 'hum-len':'lengu'}[area];
      const mismaArea = areaCanonicaCEA(row[0]) === area || (name === 'Materias_Humanistica' && materia && texto.includes(materia));
      if (String(row[col]) === key || (mismaArea && nombre && String(row[col]) === nombre)) row[col] = reemplazo;
    });
    escribirTablaCEA(ss, name, rows);
  });
  const papelera = ss.getSheetByName('Docentes_Eliminados') || ss.insertSheet('Docentes_Eliminados');
  if (!papelera.getLastRow()) papelera.appendRow(['Codigo', 'Fecha']);
  codigos.forEach(codigo => { if (!docentesEliminadosCEA(ss).has(codigo)) papelera.appendRow([codigo, new Date().toISOString()]); });
  exigirCEA(!sheetD?.getDataRange().getValues().slice(1).some(r=>String(r[0]).trim()===key)&&!sheetU?.getDataRange().getValues().slice(1).some(r=>String(r[0]).trim()===key),'No se confirmó la eliminación del docente.');
  return {status:'success',codigo:key,areaKey:area,docenteReemplazo:reemplazo,docentesEliminados:[...docentesEliminadosCEA(ss)]};
}

// ─── RESOLUCIÓN RESILIENTE DE HOJA DE CÁLCULO PRINCIPAL ───
const NOMBRE_HOJA_CALCULO = "BD_OFICIAL_CEA_MADRE_MARIE_POUSSEPIN";
const SPREADSHEET_ID_MANUAL = ""; // Opcional: ID de la hoja del sistema institucional si se desea fijar manualmente

function obtenerSpreadsheetPrincipal() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CEA_SPREADSHEET_ID') || SPREADSHEET_ID_MANUAL;
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  throw new Error('Ejecuta configurarSistemaCEA desde Apps Script de la hoja oficial.');
}

/**
 * Petición GET: Devuelve todo el contenido del sitio web desde el Google Sheet
 */
function leerDatosCEA(auth, precargarCriterios = false) {
  try {
    const ss = obtenerSpreadsheetPrincipal();
    if (!ss.getSheetByName("Director_y_Textos")) {
      throw new Error('Ejecuta configurarSistemaCEA en la hoja oficial.');
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
            resumen: dataCarreras[i][4] || "",
            foto: dataCarreras[i][5] || ""
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

    // 5. Horarios Matriz (Construido prioritariamente desde la hoja Horarios_Matriz para respetar ediciones manuales en el sistema institucional)
    let horariosMatrizObj = null;
    const horariosMatrizPorSede = {};
    const sheetHorariosMat = ss.getSheetByName("Horarios_Matriz");

    function crearEstructuraHorarioVacia() {
      const base = {
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
          if (pb && pb.hum && Array.isArray(pb.hum.periodos) && pb.hum.periodos.length > 0) base.hum.periodos = pb.hum.periodos;
          if (pb && pb.tec && Array.isArray(pb.tec.periodos) && pb.tec.periodos.length > 0) base.tec.periodos = pb.tec.periodos;
        } catch(e) {}
      }
      return base;
    }

    horariosMatrizPorSede["central"] = crearEstructuraHorarioVacia();

    if (sheetHorariosMat && sheetHorariosMat.getLastRow() > 1) {
      const dataHMat = sheetHorariosMat.getDataRange().getValues();
      if (dataHMat.length > 1) {
        for (let i = 1; i < dataHMat.length; i++) {
          const t = String(dataHMat[i][0] || '').trim().toLowerCase();
          const dia = String(dataHMat[i][1] || '').trim();
          const pNum = String(dataHMat[i][2] !== undefined ? dataHMat[i][2] : '').trim();
          const doc = String(dataHMat[i][5] || '').trim();
          const mat = String(dataHMat[i][6] || '').trim();
          const cur = String(dataHMat[i][7] || '').trim();
          const sede = String(dataHMat[i][8] || 'central').trim();

          if (t && dia && pNum !== '' && (t === 'hum' || t === 'tec')) {
            if (!horariosMatrizPorSede[sede]) {
              horariosMatrizPorSede[sede] = crearEstructuraHorarioVacia();
            }
            if (!horariosMatrizPorSede[sede][t].matriz[dia]) horariosMatrizPorSede[sede][t].matriz[dia] = {};
            if (!Array.isArray(horariosMatrizPorSede[sede][t].matriz[dia][pNum])) {
              horariosMatrizPorSede[sede][t].matriz[dia][pNum] = [];
            }
            horariosMatrizPorSede[sede][t].matriz[dia][pNum].push({
              docente: doc || "—",
              materia: mat || "Libre",
              curso: cur || "—"
            });
          }
        }
      }
      horariosMatrizObj = horariosMatrizPorSede["central"];
    } else if (textosObj.horarios_matriz_json) {
      try {
        horariosMatrizObj = JSON.parse(textosObj.horarios_matriz_json);
        horariosMatrizPorSede["central"] = horariosMatrizObj;
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
          mallasObj[carreraKey][nivel].push([modulo,materia,Number(dataMallas[i][4])||null]);
        }
      }
    }

    for (const [area, niveles] of Object.entries(mallasObj)) {
      if (areaCanonicaCEA(area) !== 'tec-sis') continue;
      for (const nivel of Object.keys(niveles)) {
        niveles[nivel] = mallaSistemasCEA(niveles[nivel], nivel);
      }
    }

    // 8. Usuarios Docentes
    const usuariosDocentesObj = {};
    const sheetUsuarios = ss.getSheetByName("Usuarios_Docentes");
    if (sheetUsuarios) {
      const dataUsuarios = sheetUsuarios.getDataRange().getDisplayValues();
      for (let i = 1; i < dataUsuarios.length; i++) {
        const key = String(dataUsuarios[i][0] || '').trim();
        const user = String(dataUsuarios[i][1] || '').trim();
        const comisionVal = String(dataUsuarios[i][3] || '').trim().toUpperCase();
        const esComision = (comisionVal === 'SI' || dataUsuarios[i][3] === true);
        // SEGURIDAD: Nunca enviar contraseñas de docentes al navegador público
        if (key) {
          usuariosDocentesObj[key] = { 
            user: user || "",
            pass: '',
            comision: esComision,
            asigKey: String(dataUsuarios[i][4] || key).trim()
          };
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

    // 11. Documentos por Nivel (Soporte dinámico para múltiples documentos, módulos y niveles)
    const docNivelesObj = {};
    const sheetDocNiv = ss.getSheetByName("Documentos_Niveles");
    if (sheetDocNiv) {
      const dataDocNiv = sheetDocNiv.getDataRange().getValues();
      for (let i = 1; i < dataDocNiv.length; i++) {
        const carreraKey = String(dataDocNiv[i][0] || '').trim();
        const nivel = String(dataDocNiv[i][1] || '').trim();
        const col2 = String(dataDocNiv[i][2] || '').trim();
        const col3 = String(dataDocNiv[i][3] || '').trim();
        if (carreraKey && (nivel || col2 || col3)) {
          if (!docNivelesObj[carreraKey]) docNivelesObj[carreraKey] = [];
          let docTitulo = col2;
          let docEnlace = col3;
          if (!col3 && (col2.startsWith('http') || col2.startsWith('drive') || col2 === '#')) {
            docTitulo = nivel || 'Documento PDF';
            docEnlace = col2;
          }
          if (Array.isArray(docNivelesObj[carreraKey])) {
            docNivelesObj[carreraKey].push({
              id: 'doc_' + i,
              nivel: nivel || 'General',
              titulo: docTitulo || nivel || 'Documento Oficial',
              enlace: docEnlace || '#'
            });
          }
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
            ...estadoInscripcionCEA(dataIns[i]),
            id: String(dataIns[i][15] || 'INS-' + hashCEA([dataIns[i].slice(0, 15), i])),
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
            esCasoExcepcional: Boolean(dataIns[i][11] && dataIns[i][11] !== "No" && dataIns[i][11] !== ""),
            sede: String(dataIns[i][13] || "Sede Central (Centro de Chulumani)"),
            comunidad: String(dataIns[i][14] || "")
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

    // 17. Kardex Docentes (Carga segura y sincronizada)
    const kardexDocentesObj = {};
    const sheetKardex = ss.getSheetByName("Kardex_Docentes");
    if (sheetKardex) {
      const dataKardex = sheetKardex.getDataRange().getValues();
      for (let i = 1; i < dataKardex.length; i++) {
        const docId = String(dataKardex[i][0] || '').trim();
        const jsonStr = String(dataKardex[i][6] || '').trim();
        if (docId && jsonStr) {
          try {
            kardexDocentesObj[docId] = JSON.parse(jsonStr);
          } catch(eK) {}
        }
      }
    }

    // 18. Registro de Estudiantes (Padrón Oficial CEA)
    const matriculas = leerMatriculasCEA(ss);
    const registroEstudiantesList = matriculas.filter(est => est.estadoMatricula !== 'ELIMINADO');
    const papeleraEstudiantesList = matriculas.filter(est => est.estadoMatricula === 'ELIMINADO');

    // 20. Calificaciones: Registros y Detalles (Sincronización Bidireccional Total)
    const califRegistrosList = [];
    const sheetCR = ss.getSheetByName("Calificaciones_Registros");
    if (sheetCR && sheetCR.getLastRow() > 1) {
      const dCR = sheetCR.getDataRange().getValues();
      for (let i = 1; i < dCR.length; i++) {
        const idR = String(dCR[i][0] || '').trim();
        if (idR) {
          let crit = [];
          try { crit = JSON.parse(dCR[i][14] || '[]'); } catch(eC) {}
          if (String(dCR[i][1]) === 'humanistica') crit = criteriosHumanisticaCEA();
          const numeroFijo=posicionFilaModuloCEA(dCR[i],dCR[0]);
          const nivelesMalla=mallasObj[dCR[i][2]]||{},mallaActual=Object.entries(nivelesMalla).find(([n])=>nivelNotasCEA(n)===nivelNotasCEA(dCR[i][4]))?.[1]||[];
          const etiqueta=mallaActual.find(m=>Number(m[2])===numeroFijo);
          const moduloOficial=etiqueta||moduloPlanillaSistemasCEA(dCR[i][2],dCR[i][4],idR,dCR[i][5]);
          califRegistrosList.push({
            id: idR,
            tipo: String(dCR[i][1] || 'tecnica'),
            areaKey: String(dCR[i][2] || ''),
            carrera: String(dCR[i][3] || ''),
            nivel: String(dCR[i][1] || 'tecnica') === 'humanistica' ? nivelHumanisticoOficialCEA(dCR[i][4]) : String(dCR[i][4] || ''),
            modulo: moduloOficial ? moduloOficial.slice(0,2).join(': ') : String(dCR[i][5] || ''),
            moduloNumero:numeroFijo,
            moduloCodigo:moduloOficial?moduloOficial[0]:String(dCR[i][dCR[0].indexOf('ModuloCodigoFijo')]||String(dCR[i][5]||'').split(':')[0]),
            docente: String(dCR[i][6] || ''),
            semestre: String(dCR[i][7] || '1er Semestre'),
            gestion: String(dCR[i][8] || '2026'),
            paralelo: String(dCR[i][9] || 'A'),
            fecha: String(dCR[i][10] || ''),
            estado: String(dCR[i][11] || 'BORRADOR'),
            publicadoConsulta: String(dCR[i][11]) === 'PUBLICADO' || dCR[0].indexOf('EstadoPublicacion') >= 0 && dCR[i][dCR[0].indexOf('EstadoPublicacion')] === 'PUBLICADO',
            fechaModificacion: String(dCR[i][12] || ''),
            usuarioModif: String(dCR[i][13] || ''),
            criterios: crit,
            estadoBloqueo: String(dCR[i][15] || 'DESBLOQUEADO'),
            bloqueado: String(dCR[i][15] || '').toUpperCase() === 'BLOQUEADO',
            usuarioBloqueo: String(dCR[i][16] || ''),
            fechaBloqueo: String(dCR[i][17] || ''),
            motivoBloqueo: String(dCR[i][18] || '')
          });
        }
      }
    }

    const califDetallesList = [];
    const sheetCD = ss.getSheetByName("Calificaciones_Detalle") || ss.getSheetByName("Calificaciones Detalle") || ss.getSheetByName("Calificaciones") || ss.getSheetByName("Notas");
    if (sheetCD && sheetCD.getLastRow() > 1) {
      const dCD = sheetCD.getDataRange().getValues();
      for (let i = 1; i < dCD.length; i++) {
        const idDet = String(dCD[i][0] || '').trim();
        const idReg = String(dCD[i][1] || '').trim();
        const ciVal = String(dCD[i][6] || '').trim();
        const paternoVal = String(dCD[i][3] || '').trim();
        const nombresVal = String(dCD[i][5] || '').trim();
        if (idReg || ciVal || paternoVal || nombresVal) {
          function vNum(val) { return (val !== '' && val !== null && !isNaN(Number(val))) ? Number(val) : ''; }
          califDetallesList.push({
            id: idDet || ('DET-' + (idReg || 'MANUAL') + '-' + i),
            idRegistro: idReg,
            nro: Number(dCD[i][2]) || i,
            paterno: paternoVal,
            materno: String(dCD[i][4] || '').trim(),
            nombres: nombresVal,
            ci: ciVal,
            rude: String(dCD[i][7] || '').trim(),
            ser: vNum(!dCD[i][19] && String(dCD[i][8]) === '0' ? '' : dCD[i][8]),
            saber: vNum(!dCD[i][19] && String(dCD[i][9]) === '0' ? '' : dCD[i][9]),
            decidir: vNum(!dCD[i][19] && String(dCD[i][10]) === '0' ? '' : dCD[i][10]),
            proceso: vNum(!dCD[i][19] && String(dCD[i][11]) === '0' ? '' : dCD[i][11]),
            producto: vNum(!dCD[i][19] && String(dCD[i][12]) === '0' ? '' : dCD[i][12]),
            hacer: vNum(!dCD[i][19] && String(dCD[i][13]) === '0' ? '' : dCD[i][13]),
            autoevaluacion: vNum(!dCD[i][19] && String(dCD[i][14]) === '0' ? '' : dCD[i][14]),
            notaFinal: (dCD[i][15] !== '' && dCD[i][15] !== null && !isNaN(Number(dCD[i][15]))) ? Number(dCD[i][15]) : (vNum(dCD[i][15]) || 0),
            observacion: String(dCD[i][16] || 'PENDIENTE'), observacionManual: String(dCD[i][17] || ''), estadoParticipante: String(dCD[i][18] || '')
          });
        }
      }
    }

    // 21. Control de Subida de Centralizadores
    const tiposRegistro = new Map(califRegistrosList.map(registro => [registro.id, registro.tipo]));
    califDetallesList.forEach(detalle => recalcularDetalleLeidoCEA(detalle, tiposRegistro.get(detalle.idRegistro) || 'tecnica'));

    const controlSubidaCentralizadoresObj = {};
    const sheetSubCent = ss.getSheetByName("Control_Subida_Centralizadores");
    if (sheetSubCent && sheetSubCent.getLastRow() > 1) {
      const dataSubC = sheetSubCent.getDataRange().getValues();
      for (let i = 1; i < dataSubC.length; i++) {
        const k = String(dataSubC[i][0] || "").trim();
        if (k) {
          controlSubidaCentralizadoresObj[k] = {
            key: k,
            carreraKey: String(dataSubC[i][1] || ""),
            nivelNombre: String(dataSubC[i][2] || ""),
            gestion: String(dataSubC[i][3] || ""),
            semestre: String(dataSubC[i][4] || ""),
            paralelo: String(dataSubC[i][5] || ""),
            estado: String(dataSubC[i][6] || "PENDIENTE DE VERIFICACIÓN"),
            fechaHora: String(dataSubC[i][7] || ""),
            usuarioDirector: String(dataSubC[i][8] || ""),
            hashNotas: String(dataSubC[i][9] || "")
          };
        }
      }
    }

    // 22. Control de Subida de Estudiantes
    const controlSubidaEstudiantesObj = {};
    const sheetSubEst = ss.getSheetByName("Control_Subida_Estudiantes");
    if (sheetSubEst && sheetSubEst.getLastRow() > 1) {
      const dataSubE = sheetSubEst.getDataRange().getValues();
      for (let i = 1; i < dataSubE.length; i++) {
        const k = String(dataSubE[i][0] || "").trim();
        const est = String(dataSubE[i][8] || "").trim() === "SUBIDO";
        if (k) controlSubidaEstudiantesObj[k] = est;
      }
    }

    return responseJSON({
      status: "success",
      data: filtrarDatosCEA({
        textos: textosObj,
        docentes: docentesObj,
        docentesEliminados: [...docentesEliminadosCEA(ss)],
        carreras: carrerasList,
        perfilesEspecialidad: Object.keys(textosObj).filter(key => key.startsWith('perfil_especialidad_')).reduce((perfiles,key) => {
          try { const perfil=JSON.parse(textosObj[key]); if (perfil.areaKey) perfiles[perfil.areaKey]=perfil; } catch(error) {}
          return perfiles;
        }, {}),
        materiasHumanistica: materiasHumList,
        horarios: horariosObj,
        horariosMatriz: horariosMatrizObj,
        horariosMatrizPorSede: horariosMatrizPorSede,
        documentos: documentosList,
        mallas: mallasObj,
        usuariosDocentes: usuariosDocentesObj,
        kardexDocentes: kardexDocentesObj,
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
        horariosMerges: horariosMerges,
        registroEstudiantes: registroEstudiantesList,
        padronAfiliacion: registroEstudiantesList,
        papeleraEstudiantes: papeleraEstudiantesList,
        calificacionesRegistros: califRegistrosList,
        calificacionesDetalles: califDetallesList,
        controlSubidaCentralizadores: controlSubidaCentralizadoresObj,
        controlSubidaEstudiantes: controlSubidaEstudiantesObj
      }, auth, precargarCriterios)
    });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * Petición POST: Procesa envíos desde el panel institucional y formularios
 */
function procesarSolicitudCEA(e, auth) {
  try {
    const ss = obtenerSpreadsheetPrincipal();
    if (!ss.getSheetByName("Director_y_Textos")) {
      throw new Error('Ejecuta configurarSistemaCEA en la hoja oficial.');
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
          const comisionCell = String(rowsU[i][3] || '').trim().toUpperCase();
          const esComision = (comisionCell === 'SI' || rowsU[i][3] === true);
          if (areaKey && docUser === userInp && docPass === passInp) {
            let nombreDocente = String(rowsU[i][1] || '');
            const sheetD = ss.getSheetByName("Docentes");
            if (sheetD) {
              const dataD = sheetD.getDataRange().getValues();
              for (let d = 1; d < dataD.length; d++) {
                if (String(dataD[d][0] || '').trim().toLowerCase() === areaKey.toLowerCase()) {
                  const n = String(dataD[d][1] || '').trim();
                  if (n) nombreDocente = n;
                  break;
                }
              }
            }
            return responseJSON({
              status: "success",
              role: "docente",
              areaKey: areaKey,
              name: nombreDocente,
              comision: esComision,
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
              esCasoExcepcional: Boolean(dataIns[i][11] && dataIns[i][11] !== "No" && dataIns[i][11] !== ""),
              sede: String(dataIns[i][13] || "Sede Central (Centro de Chulumani)"),
              comunidad: String(dataIns[i][14] || "")
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

      const configuracionInscripcion = ss.getSheetByName('Director_y_Textos').getDataRange().getValues();
      const anioConfigurado = configuracionInscripcion.find(fila => fila[0] === 'insc_gestion')?.[1];
      const gestionInscripcion = String(postData.gestion || anioConfigurado || gestion).trim();
      exigirCEA(/^\d{4}$/.test(gestionInscripcion) && Number(gestionInscripcion) >= 1900, 'La gestión de inscripción no es válida.');

      let sheetIns = ss.getSheetByName("Inscripciones") || ss.insertSheet("Inscripciones");
      if (sheetIns.getLastRow() === 0) {
        sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción", "Sede / Subcentro", "De dónde vienes"]);
        aplicarEstiloEncabezado(sheetIns, 15);
      }
      sheetIns.appendRow([
        gestionInscripcion, mes, fecha,
        sanitizarEntradaTexto(postData.nombre || ""),
        sanitizarEntradaTexto(postData.ci || ""),
        sanitizarEntradaTexto(postData.fechaNacimiento || ""),
        sanitizarEntradaTexto(postData.telefono || ""),
        sanitizarEntradaTexto(postData.area || ""),
        sanitizarEntradaTexto(postData.carrera || ""),
        sanitizarEntradaTexto(postData.observaciones || ""),
        sanitizarEntradaTexto(postData.semestre || ""),
        sanitizarEntradaTexto(postData.casoExcepcional || (postData.esCasoExcepcional ? "Sí" : "No")),
        sanitizarEntradaTexto(postData.detalleExcepcion || ""),
        sanitizarEntradaTexto(postData.sede || "Sede Central (Centro de Chulumani)"),
        sanitizarEntradaTexto(postData.comunidad || "")
      ]);
      return responseJSON({ status: "success", message: "Pre-inscripción registrada con éxito." });
    } 

    // 1.1 Consulta y Verificación Oficial de Inscripción por CI (Validación Código QR)
    else if (action === "consultar-inscripcion-ci" || action === "verificar-qr-inscripcion") {
      const credencial = action === 'verificar-qr-inscripcion' ? String(postData.credencial || '').trim() : '';
      const ciBuscado = String(postData.ci || "").trim().toLowerCase();
      const ciDigits = ciBuscado.replace(/[^\d]/g, "");
      let sheetIns = ss.getSheetByName("Inscripciones");
      if (!sheetIns) {
        return responseJSON({ status: "not_found", message: "No hay registros de inscripciones." });
      }
      const dataIns = sheetIns.getDataRange().getValues();
      let encontrada = null;
      for (let i = dataIns.length - 1; i >= 1; i--) {
        const fila = dataIns[i];
        const ciFila = String(fila[4] || "").trim().toLowerCase();
        const ciFilaDigits = ciFila.replace(/[^\d]/g, "");
        const nombreFila = String(fila[3] || "").trim();
        const id = String(fila[15] || '');
        const coincide = credencial ? id === credencial && fila[16] === 'INSCRITO'
          : ciBuscado && (ciFila === ciBuscado || (ciDigits && ciFilaDigits && ciDigits === ciFilaDigits));
        if (coincide && nombreFila) {
          encontrada = {
            ...estadoInscripcionCEA(fila),
            codigoCredencial: fila[16] === "INSCRITO" ? id : "",
            gestion: String(fila[0] || ""),
            mes: String(fila[1] || ""),
            fecha: String(fila[2] || ""),
            nombre: nombreFila,
            ci: String(fila[4] || ""),
            fechaNacimiento: String(fila[5] || ""),
            telefono: String(fila[6] || ""),
            area: String(fila[7] || ""),
            carrera: String(fila[8] || ""),
            observaciones: String(fila[9] || ""),
            semestre: String(fila[10] || ""),
            casoExcepcional: String(fila[11] || ""),
            detalleExcepcion: String(fila[12] || ""),
            esCasoExcepcional: Boolean(fila[11] && fila[11] !== "No" && fila[11] !== ""),
            sede: String(fila[13] || "Sede Central (Centro de Chulumani)"),
            comunidad: String(fila[14] || "")
          };
          break;
        }
      }
      if (encontrada) {
        if (encontrada.estadoInscripcion === 'INSCRITO') {
          const normal = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
          const carrera = normal(encontrada.carrera);
          const matriculas = leerMatriculasCEA(ss).filter(est =>
            est.estadoMatricula !== 'ELIMINADO' && normal(est.ci) === normal(encontrada.ci) &&
            est.gestion === encontrada.gestion &&
            /2|segundo/i.test(est.semestre) === /2|segundo/i.test(encontrada.semestre) &&
            normal(est.carreraNombre) && carrera.includes(normal(est.carreraNombre)));
          const niveles = [...new Set(matriculas.map(est => est.nivel).filter(Boolean))];
          const nivelDeclarado = encontrada.carrera.match(/T[eé]cnico\s+(?:B[aá]sico|Auxiliar|Medio(?:\s+(?:II|I|2|1))?)|Aprendizajes\s+(?:Elementales|Avanzados|Aplicados|Complementarios|Especializados)/i);
          encontrada.nivel = niveles.length === 1 ? niveles[0] : nivelDeclarado?.[0] || '';
        }
        return responseJSON({ status: "success", inscripcion: encontrada });
      } else {
        return responseJSON({ status: "not_found", message: "No se encontró registro con el CI especificado." });
      }
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

    else if (action === "guardar-docentes" || action === "guardar-docentes-completo") {
      const sheet=ss.getSheetByName('Docentes');
      const rows=sheet&&sheet.getLastRow()?sheet.getDataRange().getValues():[['Codigo','Nombre','Materia_Carrera','Area']];
      const indices=new Map(rows.slice(1).map((r,i)=>[String(r[0]).trim().toLowerCase(),i+1]));
      for(const codigo of Object.keys(postData.docentes||{})){
        const nombre=String(postData.docentes[codigo]??''),index=indices.get(codigo.trim().toLowerCase());
        const cuenta=postData.usuarios?.[codigo];
        if(index==null){indices.set(codigo.trim().toLowerCase(),rows.length);rows.push([codigo,nombre,cuenta?.asigKey||'',cuenta?.area||'']);}
        else{rows[index][1]=nombre;if(cuenta?.asigKey)rows[index][2]=cuenta.asigKey;if(cuenta?.area)rows[index][3]=cuenta.area;}
      }
      escribirTablaCEA(ss,'Docentes',rows);
      const materias=ss.getSheetByName('Materias_Humanistica');
      if(materias){const filas=materias.getDataRange().getValues(),mapa={'hum-cn':'ciencias naturales','hum-mat':'matemática','hum-cs':'ciencias sociales','hum-len':'lenguaje'};let cambio=false;
        for(const key of Object.keys(mapa))if(postData.docentes?.[key]!==undefined)for(let i=1;i<filas.length;i++)if(String(filas[i][0]).toLowerCase().includes(mapa[key])&&String(filas[i][1])!==String(postData.docentes[key])){filas[i][1]=String(postData.docentes[key]);cambio=true;}
        if(cambio)escribirTablaCEA(ss,'Materias_Humanistica',filas);
      }
      if(Array.isArray(postData.carreras)){
        const filas=[['Codigo','Nombre','DocenteCodigo','Color','Resumen','Foto']];
        for(const carr of postData.carreras){let foto=String(carr.foto||'').trim();if(foto.startsWith('data:'))foto=guardarMediaEnDrive(foto,'Foto_'+(carr.key||'tec'));filas.push([carr.key||'tec-gen',carr.nombre||'',carr.docente||carr.key||'',carr.color||'#1a6b2e',carr.resumen||'',foto]);}
        escribirTablaCEA(ss,'Carreras_Tecnicas',filas);
      }else if(Array.isArray(postData.carrerasDocentes)){
        const carreras=ss.getSheetByName('Carreras_Tecnicas');if(carreras){const filas=carreras.getDataRange().getValues(),mapa=new Map(postData.carrerasDocentes.map(c=>[String(c.key),String(c.docente||'')]));let cambio=false;for(let i=1;i<filas.length;i++)if(mapa.has(String(filas[i][0]))&&String(filas[i][2])!==mapa.get(String(filas[i][0]))){filas[i][2]=mapa.get(String(filas[i][0]));cambio=true;}if(cambio)escribirTablaCEA(ss,'Carreras_Tecnicas',filas);}
      }
      if(postData.usuarios)sincronizarUsuariosDocentesSheet(ss,postData.usuarios);
      return responseJSON({status:'success'});
    }

    else if (action === "guardar-carreras") {
      let sheetCarreras = ss.getSheetByName("Carreras_Tecnicas") || ss.insertSheet("Carreras_Tecnicas");
      if (postData.carreras && Array.isArray(postData.carreras)) {
        sheetCarreras.clearContents();
        sheetCarreras.appendRow(["Codigo", "Nombre", "DocenteCodigo", "Color", "Resumen", "Foto"]);

        let sheetDocentes = ss.getSheetByName("Docentes") || ss.insertSheet("Docentes");
        if (sheetDocentes.getLastRow() === 0) {
          sheetDocentes.appendRow(["Codigo", "Nombre", "Materia_Carrera", "Area"]);
        }
        let dataDoc = sheetDocentes.getDataRange().getValues();
        let mapDoc = {};
        for (let d = 1; d < dataDoc.length; d++) {
          const kDoc = String(dataDoc[d][0] || '').trim();
          if (kDoc) mapDoc[kDoc] = d + 1;
        }

        let sheetU = ss.getSheetByName("Usuarios_Docentes") || ss.insertSheet("Usuarios_Docentes");
        if (sheetU.getLastRow() === 0) {
          sheetU.appendRow(["AreaKey", "Usuario", "Contrasena", "Comision"]);
        }
        let dataU = sheetU.getDataRange().getValues();
        let mapU = {};
        for (let u = 1; u < dataU.length; u++) {
          const kU = String(dataU[u][0] || '').trim();
          if (kU) mapU[kU] = u + 1;
        }

        postData.carreras.forEach(carr => {
          const cKey = String(carr.key || "tec-gen").trim();
          const cNom = String(carr.nombre || "").trim();
          const cDoc = String(carr.docente || "").trim();
          const cCol = carr.color || "#1a6b2e";
          const cRes = carr.resumen || "";
          let cFoto = String(carr.foto || "").trim();
          if (cFoto && cFoto.indexOf("data:") === 0) {
            try {
              cFoto = guardarMediaEnDrive(cFoto, "Foto_" + cKey);
            } catch(eFoto) {}
          }
          sheetCarreras.appendRow([cKey, cNom, cDoc || cKey, cCol, cRes, cFoto]);

          // Crear o sincronizar en hoja Docentes automáticamente
          if (!mapDoc[cKey]) {
            const nomDocente = cDoc || ("Docente de " + cNom);
            sheetDocentes.appendRow([cKey, nomDocente, cNom, "Técnica"]);
            mapDoc[cKey] = sheetDocentes.getLastRow();
          } else if (cDoc) {
            sheetDocentes.getRange(mapDoc[cKey], 2).setValue(cDoc);
            sheetDocentes.getRange(mapDoc[cKey], 3).setValue(cNom);
          }

          // Crear en Usuarios_Docentes con usuario y contraseña oficial si no existía
          if (!mapU[cKey]) {
            const cleanSlug = cNom.toLowerCase().replace(/[^a-z0-9]/g, '') || cKey.replace('tec-', '');
            const defUser = 'profe.' + cleanSlug;
            const defPass = 'cea' + Math.floor(1000 + Math.random() * 9000);
            sheetU.appendRow([cKey, defUser, defPass, "NO"]);
            mapU[cKey] = sheetU.getLastRow();
          }
        });
        return responseJSON({ status: "success", message: "Carreras y sus docentes asignados guardados exitosamente en el sistema institucional." });
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
        return responseJSON({ status: "success", message: "Materias humanísticas actualizadas en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Kardex docente guardado en el sistema institucional." });
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
        return responseJSON({ status: "success", message: "Horarios actualizados en el sistema institucional." });
      }
    }

    else if (action === "guardar-horarios-matriz") {
      let sheetHorariosMat = ss.getSheetByName("Horarios_Matriz") || ss.insertSheet("Horarios_Matriz");
      const sedeVal = String(postData.sede || "central").trim();

      if (postData.horariosMatriz) {
        // 1. Guardar copia JSON de respaldo en Director_y_Textos específica para la sede
        let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
        const dataTxt = sheetTextos.getDataRange().getValues();
        const claveH = (sedeVal === "central") ? "horarios_matriz_json" : ("horarios_matriz_json_" + sedeVal);
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

        // 2. Preservar filas de OTRAS sedes y reemplazar únicamente las filas de sedeVal
        const existingData = (sheetHorariosMat.getLastRow() > 1) ? sheetHorariosMat.getDataRange().getValues() : [];
        const otherSedesRows = [];
        for (let r = 1; r < existingData.length; r++) {
          const rowSede = String(existingData[r][8] || "central").trim();
          if (rowSede !== sedeVal) {
            otherSedesRows.push(existingData[r]);
          }
        }

        const hm = postData.horariosMatriz;
        const newRows = [];

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
                    newRows.push([
                      t, dia, Number(pNum) || pNum, hIni, hFin,
                      (item && item.docente) || "", (item && item.materia) || "", (item && (item.curso || item.sub)) || ("Curso " + (idx + 1)), sedeVal
                    ]);
                  });
                } else if (slot && typeof slot === 'object') {
                  newRows.push([
                    t, dia, Number(pNum) || pNum, hIni, hFin,
                    slot.docente || "", slot.materia || "", slot.curso || "", sedeVal
                  ]);
                }
              }
            }
          }
        });

        const allRows = otherSedesRows.concat(newRows);
        sheetHorariosMat.clearContents();
        sheetHorariosMat.appendRow(["Turno", "Dia", "PeriodoNum", "HoraInicio", "HoraFin", "Docente", "Materia", "Curso", "Sede"]);
        aplicarEstiloEncabezado(sheetHorariosMat, 9);
        if (allRows.length > 0) {
          sheetHorariosMat.getRange(2, 1, allRows.length, 9).setValues(allRows);
        }
      }
      if (postData.horariosMerges) {
        let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
        const data = sheetTextos.getDataRange().getValues();
        const clave = (sedeVal === "central") ? "horarios_merges_json" : ("horarios_merges_json_" + sedeVal);
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
      return responseJSON({ status: "success", message: `Horarios matriz para sede "${sedeVal}" guardados exitosamente en el sistema institucional.` });
    }

    else if (action === "eliminar-subcentro") {
      const sedeKey = String(postData.sede || "").trim();
      if (sedeKey && sedeKey !== "central") {
        let sheetHorariosMat = ss.getSheetByName("Horarios_Matriz");
        if (sheetHorariosMat && sheetHorariosMat.getLastRow() > 1) {
          const dataH = sheetHorariosMat.getDataRange().getValues();
          const keptRows = [];
          for (let i = 1; i < dataH.length; i++) {
            if (String(dataH[i][8] || "central").trim() !== sedeKey) {
              keptRows.push(dataH[i]);
            }
          }
          sheetHorariosMat.clearContents();
          sheetHorariosMat.appendRow(["Turno", "Dia", "PeriodoNum", "HoraInicio", "HoraFin", "Docente", "Materia", "Curso", "Sede"]);
          aplicarEstiloEncabezado(sheetHorariosMat, 9);
          if (keptRows.length > 0) {
            sheetHorariosMat.getRange(2, 1, keptRows.length, 9).setValues(keptRows);
          }
        }
      }
      return responseJSON({ status: "success", message: `Subcentro "${sedeKey}" y sus horarios eliminados correctamente.` });
    }

    else if (action === "guardar-sedes-lista") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const area = String(postData.area || "hum").trim().toLowerCase();
      const clave = "sedes_lista_" + area + "_json";
      const val = JSON.stringify(postData.sedes || []);
      const dataTxt = sheetTextos.getDataRange().getValues();
      let enc = false;
      for (let i = 1; i < dataTxt.length; i++) {
        if (String(dataTxt[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(val);
          enc = true;
          break;
        }
      }
      if (!enc) sheetTextos.appendRow([clave, val]);
      return responseJSON({ status: "success", message: "Lista de sedes actualizada en el sistema institucional." });
    }

    else if (action === "guardar-drive") {
      // 1. Guardar y actualizar la pestaña "Documentos" en el sistema institucional
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
      return responseJSON({ status: "success", message: "Enlaces de documentos actualizados en la pestaña Documentos del sistema institucional." });
    }

    else if (action === "guardar-usuarios-docentes") {
      const lock = null;

      try {
        if (postData.usuarios && typeof postData.usuarios === 'object') {
          sincronizarUsuariosDocentesSheet(ss, postData.usuarios);
          return responseJSON({ status: "success", message: "Usuarios y contraseñas de docentes actualizados en el sistema institucional." });
        }
        return responseJSON({ status: "error", message: "No se proporcionaron datos de usuarios docentes." });
      } finally {
        if (lock) {
          try { lock.releaseLock(); } catch(eRL) {}
        }
      }
    }

    else if (action === "obtener-usuarios-docentes-admin") {
      const auth = validarTokenSeguro(postData.token, "director");
      if (!auth) {
        return responseJSON({ status: "error", message: "Acceso no autorizado. Se requiere token de Director." });
      }
      const sheetU = ss.getSheetByName("Usuarios_Docentes");
      const resObj = {};
      if (sheetU) {
        const rows = sheetU.getDataRange().getValues();
        for (let i = 1; i < rows.length; i++) {
          const k = String(rows[i][0] || '').trim();
          if (k) {
            const comisionVal = String(rows[i][3] || '').trim().toUpperCase();
            resObj[k] = {
              user: String(rows[i][1] || '').trim(),
              pass: '',
              comision: (comisionVal === 'SI' || rows[i][3] === true)
            };
          }
        }
      }
      return responseJSON({ status: "success", usuarios: resObj });
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
        return responseJSON({ status: "success", message: "Credenciales de director actualizadas en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Color de materia guardado en el sistema institucional." });
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
        return responseJSON({ status: "success", message: "Actividad guardada en el sistema institucional y archivo guardado en Google Drive.", driveUrl: act.urlMedia });
      }
    }

    else if (action === "eliminar-actividad") {
      let sheetAct = ss.getSheetByName("Actividades");
      if (sheetAct && postData.id) {
        const dataAct = sheetAct.getDataRange().getValues();
        for (let i = 1; i < dataAct.length; i++) {
          if (String(dataAct[i][0]).trim() === String(postData.id).trim()) {
            sheetAct.deleteRow(i + 1);
            return responseJSON({ status: "success", message: "Actividad eliminada del sistema institucional." });
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
          message: deletedCount > 0 ? ("Pre-inscripción eliminada (" + deletedCount + " fila(s)) del sistema institucional.") : "No se encontró coincidencia en el sistema institucional."
        });
      }
      return responseJSON({ status: "error", message: "Faltan datos de CI o Nombre para eliminar." });
    }

    else if (action === "guardar-todas-inscripciones") {
      let sheetIns = ss.getSheetByName("Inscripciones") || ss.insertSheet("Inscripciones");
      sheetIns.clearContents();
      sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción", "Sede / Subcentro", "De dónde vienes"]);
      aplicarEstiloEncabezado(sheetIns, 15);
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
          ins.detalleExcepcion || "",
          ins.sede || "Sede Central (Centro de Chulumani)",
          ins.comunidad || ""
        ]);
      });
      return responseJSON({ status: "success", count: lista.length, message: "Lista completa de pre-inscripciones sincronizada en el sistema institucional." });
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
            message: "Pre-inscripciones de la gestión " + targetGestion + " eliminadas (" + deleted + " registros) del sistema institucional."
          });
        } else {
          sheetIns.clearContents();
          sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción", "Sede / Subcentro", "De dónde vienes"]);
          aplicarEstiloEncabezado(sheetIns, 15);
          return responseJSON({
            status: "success",
            message: "Todas las pre-inscripciones de todas las gestiones fueron eliminadas del sistema institucional."
          });
        }
      }
      return responseJSON({ status: "error", message: "Hoja de Inscripciones no encontrada." });
    }

    else if (action === "guardar-malla") {
      const carreraKey = String(postData.carreraKey || '').trim();
      fijarIdentidadModulosCEA(ss,carreraKey);
      if (postData.moduloHumanistico) {
        const modulo = postData.moduloHumanistico;
        const nivel = nivelHumanisticoOficialCEA(modulo.nivel);
        const numero = Number(modulo.numero);
        const nombre = String(modulo.nombre || '').trim();
        const gestionModulo = String(modulo.gestion || new Date().getFullYear()).trim();
        const semestreModulo = modulo.semestre || (new Date().getMonth() >= 6 ? 'Segundo Semestre' : 'Primer Semestre');
        exigirCEA(/^\d{4}$/.test(gestionModulo),'Selecciona una gestión válida para el módulo.');
        exigirCEA(carreraKey.startsWith('hum-') && carreraKey !== 'hum-humanistica' && [1, 2].includes(numero) &&
          ['basico','auxiliar','aplicados','complementarios','especializados'].includes(nivelNotasCEA(nivel)) && nombre && nombre.length <= 160, 'Completa un nombre válido para el módulo.');
        const codigo = numero === 1 ? carreraKey : carreraKey + '-M2';
        const hoja = ss.getSheetByName('Mallas_Curriculares');
        const filas = hoja && hoja.getLastRow() ? hoja.getDataRange().getValues() : [['CarreraKey', 'Nivel', 'Modulo', 'Materia']];
        const conservar = filas.filter((fila, indice) => indice === 0 || String(fila[0]) !== carreraKey ||
          nivelNotasCEA(fila[1]) !== nivelNotasCEA(nivel) || String(fila[2]) !== codigo);
        escribirTablaCEA(ss, 'Mallas_Curriculares', conservar.concat([[carreraKey, nivel, codigo, nombre]]));
        const registros = ss.getSheetByName('Calificaciones_Registros');
        if (registros) registros.getDataRange().getValues().slice(1).forEach((fila, indice) => {
          const numeroGuardado = posicionFilaModuloCEA(fila,registros.getDataRange().getValues()[0]);
          if (String(fila[2]) === carreraKey && nivelNotasCEA(fila[4]) === nivelNotasCEA(nivel) && numeroGuardado === numero && String(fila[8]).trim() === gestionModulo && /2|segundo/i.test(fila[7]) === /2|segundo/i.test(semestreModulo)) {
            registros.getRange(indice + 2, 6).setValue(nombre + ' - ' + nivel);
          }
        });
        return responseJSON({status: 'success'});
      }
      if (carreraKey && Array.isArray(postData.malla)) {
        const hoja = ss.getSheetByName('Mallas_Curriculares');
        const filas = hoja && hoja.getLastRow() ? hoja.getDataRange().getValues() : [['CarreraKey', 'Nivel', 'Modulo', 'Materia']];
        const conservar = filas.filter((fila, indice) => indice === 0 || String(fila[0]) !== carreraKey);
        const modulos=postData.malla.flatMap(nivel=>{
          const catalogo=catalogoModuloFijoCEA(ss,carreraKey,nivel.nivel,'tecnica');
          return (nivel.modulos||[]).map((modulo,i)=>[carreraKey,nivel.nivel,catalogo[i]?.codigo||modulo[0],String(modulo[1]||''),i+1]);
        });
        if(!conservar[0].includes('ModuloNumero'))conservar[0][4]='ModuloNumero';
        escribirTablaCEA(ss, 'Mallas_Curriculares', conservar.concat(modulos));
        actualizarEtiquetasMallaCEA(ss,carreraKey);
        return responseJSON({status:'success',message:'Malla curricular actualizada.',carreraKey,mallaConfirmada:conservar.concat(modulos).slice(1).filter(f=>String(f[0])===carreraKey).map(f=>({nivel:f[1],codigo:f[2],nombre:f[3],numero:Number(f[4])||null}))});
      }
    }

    else if (action === "guardar-doc-niveles") {
      let sheetDocNiv = ss.getSheetByName("Documentos_Niveles") || ss.insertSheet("Documentos_Niveles");
      if (sheetDocNiv.getLastRow() === 0) {
        sheetDocNiv.appendRow(["CarreraKey", "Nivel", "Titulo", "Enlace"]);
        aplicarEstiloEncabezado(sheetDocNiv, 4);
      }
      const carreraKey = String(postData.carreraKey || "").trim();
      if (carreraKey) {
        const dataDocNiv = sheetDocNiv.getDataRange().getValues();
        // Borrar filas existentes para esta carrera para sobreescribir limpiamente con la nueva lista
        for (let i = dataDocNiv.length - 1; i >= 1; i--) {
          if (String(dataDocNiv[i][0]).trim().toLowerCase() === carreraKey.toLowerCase()) {
            sheetDocNiv.deleteRow(i + 1);
          }
        }
        // Insertar los nuevos documentos
        const docs = postData.docs || postData.documentos || [];
        if (Array.isArray(docs) && docs.length > 0) {
          docs.forEach(d => {
            if (d && (d.titulo || d.enlace || d.nivel)) {
              sheetDocNiv.appendRow([carreraKey, d.nivel || "General", d.titulo || d.nivel || "Documento PDF", d.enlace || "#"]);
            }
          });
        } else if (postData.drive && typeof postData.drive === 'object') {
          for (let niv in postData.drive) {
            sheetDocNiv.appendRow([carreraKey, niv, `PDF ${niv}`, postData.drive[niv] || "#"]);
          }
        }
        return responseJSON({ status: "success", message: "Documentos de " + carreraKey + " actualizados en el sistema institucional." });
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
        return responseJSON({ status: "success", message: "Contenido '" + key + "' actualizado correctamente en el sistema institucional." });
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
        return responseJSON({ status: "success", message: "Carrera y sus mallas/docentes asociados eliminados del sistema institucional." });
      }
    }

    else if (action === "eliminar-docente") {
      return responseJSON(eliminarDocentePersistenteCEA(ss, postData.codigo));
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
        return responseJSON({ status: "success", message: "Fotografía guardada en la galería del sistema institucional.", driveUrl: foto.urlFoto });
      }
    }

    else if (action === "eliminar-foto-galeria") {
      let sheetGal = ss.getSheetByName("Galeria_Fotos");
      if (sheetGal && postData.id) {
        const dataGal = sheetGal.getDataRange().getValues();
        for (let i = 1; i < dataGal.length; i++) {
          if (String(dataGal[i][0]).trim() === String(postData.id).trim()) {
            sheetGal.deleteRow(i + 1);
            return responseJSON({ status: "success", message: "Fotografía eliminada de la galería en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Calendario académico actualizado en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Niveles y equivalencias EPJA actualizados en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Malla humanística actualizada en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Documentos oficiales guardados en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Catálogo de carreras técnicas guardado en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Requisitos de niveles técnicos guardados en el sistema institucional." });
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
      return responseJSON({ status: "success", message: "Casos excepcionales guardados en el sistema institucional." });
    }

    // ─── GESTIÓN INSTITUCIONAL DEL REGISTRO Y PADRÓN OFICIAL DE ESTUDIANTES ───
    else if (action === "guardar-registro-estudiantes" || action === "guardar-padron-afiliacion") {
      let sheetEst = ss.getSheetByName("Registro_Estudiantes") || ss.getSheetByName("Registro de Estudiantes");
      if (!sheetEst) {
        sheetEst = ss.insertSheet("Registro_Estudiantes");
      }

      const headers = [
        "N°", "GESTIÓN", "SEMESTRE", "ÁREA / RAMA", "CARRERA / ESPECIALIDAD",
        "NIVEL / CURSO", "PARALELO", "TURNO", "DOCUMENTO (CI)", "CÓDIGO RUDE",
        "APELLIDO PATERNO", "APELLIDO MATERNO", "NOMBRES", "NOMBRE COMPLETO",
        "GÉNERO", "FECHA DE NACIMIENTO", "CELULAR / CONTACTO", "ESTADO MATRÍCULA",
        "FECHA ACTUALIZACIÓN"
      ];

      sheetEst.clearContents();
      sheetEst.appendRow(headers);
      aplicarEstiloEncabezado(sheetEst, headers.length);

      const rawEst = postData.estudiantes || postData.registroEstudiantes || postData.lista || [];
      const listaEst = Array.isArray(rawEst) ? rawEst : [];
      const gestionDefault = String(postData.gestion || (typeof gestion !== 'undefined' ? gestion : '2026')).trim();
      const semestreDefault = String(postData.semestre || 'Segundo Semestre').trim();
      const fechaNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      function normalizarRama(e) {
        if (e.rama) return String(e.rama).trim();
        const aKey = String(e.areaKey || '').toLowerCase();
        const cNom = String(e.carreraNombre || '').toLowerCase();
        if (aKey.indexOf('hum') !== -1 || cNom.indexOf('human') !== -1 || cNom.indexOf('secundaria') !== -1 || cNom.indexOf('primaria') !== -1) {
          return "ÁREA HUMANÍSTICA";
        }
        return "ÁREA TÉCNICA TECNOLÓGICA";
      }

      // Ordenar estudiantes meticulosamente por:
      // 1. Rama (Área Técnica primero, Área Humanística luego)
      // 2. Carrera / Especialidad
      // 3. Nivel / Curso
      // 4. Paralelo (A, B)
      // 5. Apellidos y Nombres
      listaEst.sort(function(a, b) {
        const ramaA = normalizarRama(a);
        const ramaB = normalizarRama(b);
        if (ramaA !== ramaB) return ramaA.localeCompare(ramaB);

        const carA = String(a.carreraNombre || a.areaKey || '').toUpperCase();
        const carB = String(b.carreraNombre || b.areaKey || '').toUpperCase();
        if (carA !== carB) return carA.localeCompare(carB);

        const nivA = String(a.nivel || '').toUpperCase();
        const nivB = String(b.nivel || '').toUpperCase();
        if (nivA !== nivB) return nivA.localeCompare(nivB);

        const parA = String(a.paralelo || 'A').toUpperCase();
        const parB = String(b.paralelo || 'A').toUpperCase();
        if (parA !== parB) return parA.localeCompare(parB);

        const nomA = String(a.paterno || a.nombreCompleto || '').toUpperCase();
        const nomB = String(b.paterno || b.nombreCompleto || '').toUpperCase();
        return nomA.localeCompare(nomB);
      });

      const rows = [];
      for (let i = 0; i < listaEst.length; i++) {
        const est = listaEst[i];
        const ci = String(est.ci !== undefined ? est.ci : '').trim();
        const rude = String(est.rude !== undefined ? est.rude : '').trim();
        const paterno = String(est.paterno || '').trim();
        const materno = String(est.materno || '').trim();
        const nombres = String(est.nombres || '').trim();
        const nomCompleto = String(est.nombreCompleto || (paterno + " " + materno + " " + nombres)).trim();
        const rama = normalizarRama(est);
        const carrera = String(est.carreraNombre || est.areaKey || '').trim().toUpperCase();
        const nivel = String(est.nivel || '').trim().toUpperCase();
        const paralelo = String(est.paralelo || 'A').trim().toUpperCase();
        const turno = String(est.turno || 'NOCHE').trim().toUpperCase();
        const genero = String(est.genero || 'F').trim().toUpperCase();
        const fechaNac = String(est.fechaNacimiento || '').trim();
        const cel = String(est.celular || est.telefono || '').trim();
        const estMatricula = String(est.estadoMatricula || 'EFECTIVO').trim().toUpperCase();
        const gRow = String(est.gestion || gestionDefault).trim();
        const sRow = String(est.semestre || est.hoja || semestreDefault).trim();

        rows.push([
          i + 1,
          gRow,
          sRow,
          rama,
          carrera,
          nivel,
          paralelo,
          turno,
          ci,
          rude,
          paterno,
          materno,
          nombres,
          nomCompleto,
          genero,
          fechaNac,
          cel,
          estMatricula,
          fechaNow
        ]);
      }

      if (rows.length > 0) {
        sheetEst.getRange(2, 1, rows.length, headers.length).setValues(rows);
      }

      // Guardar también copia JSON en Director_y_Textos para sincronización redundante
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const dTextos = sheetTextos.getDataRange().getValues();
      const jsonBackup = JSON.stringify(listaEst);
      const clavesActualizar = {
        "registro_estudiantes_json": jsonBackup,
        "padron_afiliacion_json": jsonBackup,
        "padron_afiliacion_total": String(listaEst.length),
        "padron_afiliacion_actualizacion": fechaNow
      };

      for (let k in clavesActualizar) {
        let encK = false;
        for (let j = 1; j < dTextos.length; j++) {
          if (String(dTextos[j][0]).trim() === k) {
            sheetTextos.getRange(j + 1, 2).setValue(clavesActualizar[k]);
            encK = true;
            break;
          }
        }
        if (!encK) {
          sheetTextos.appendRow([k, clavesActualizar[k]]);
        }
      }

      return responseJSON({
        status: "success",
        count: listaEst.length,
        message: "Registro y padrón oficial de estudiantes guardado exitosamente."
      });
    }

    // ─── PAPELERA DE RECUPERACIÓN DE ESTUDIANTES (PERÍODO DE 7 DÍAS) ───
    else if (action === "guardar-papelera-estudiantes") {
      let sheetPap = ss.getSheetByName("Papelera_Recuperacion") || ss.insertSheet("Papelera_Recuperacion");
      const headersPap = [
        "N°", "GESTIÓN", "SEMESTRE", "ÁREA / RAMA", "CARRERA / ESPECIALIDAD",
        "NIVEL / CURSO", "PARALELO", "TURNO", "DOCUMENTO (CI)", "CÓDIGO RUDE",
        "NOMBRE COMPLETO", "GÉNERO", "FECHA ELIMINACIÓN", "DÍAS RESTANTES (MÁX 7)",
        "MOTIVO", "FECHA ACTUALIZACIÓN"
      ];

      sheetPap.clearContents();
      sheetPap.appendRow(headersPap);
      aplicarEstiloEncabezado(sheetPap, headersPap.length);

      const rawPap = postData.papelera || [];
      const listaPap = Array.isArray(rawPap) ? rawPap : [];
      const ahoraMs = new Date().getTime();
      const sieteDiasMs = 7 * 24 * 60 * 60 * 1000;
      const fechaNow = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

      // Filtrar y purgar definitivamente estudiantes eliminados hace más de 7 días
      const validos = [];
      const rowsPap = [];

      for (let i = 0; i < listaPap.length; i++) {
        const est = listaPap[i];
        const fElim = est.fechaEliminacion ? new Date(est.fechaEliminacion).getTime() : ahoraMs;
        const transcurrido = ahoraMs - fElim;

        // Solo se conservan si están dentro de los 7 días
        if (transcurrido < sieteDiasMs) {
          const diasRest = Math.max(1, 7 - Math.floor(transcurrido / (1000 * 60 * 60 * 24)));
          validos.push({ ...est, diasRestantes: diasRest });

          rowsPap.push([
            rowsPap.length + 1,
            String(est.gestion || '2026').trim(),
            String(est.semestre || 'Segundo Semestre').trim(),
            String(est.rama || '').trim(),
            String(est.carreraNombre || est.areaKey || '').trim().toUpperCase(),
            String(est.nivel || '').trim().toUpperCase(),
            String(est.paralelo || 'A').trim().toUpperCase(),
            String(est.turno || 'NOCHE').trim().toUpperCase(),
            String(est.ci || '').trim(),
            String(est.rude || '').trim(),
            String(est.nombreCompleto || '').trim(),
            String(est.genero || 'F').trim().toUpperCase(),
            String(est.fechaEliminacion || fechaNow).trim(),
            diasRest,
            String(est.motivoEliminacion || est.motivo || 'Eliminado').trim(),
            fechaNow
          ]);
        }
      }

      if (rowsPap.length > 0) {
        sheetPap.getRange(2, 1, rowsPap.length, headersPap.length).setValues(rowsPap);
      }

      // Guardar respaldo JSON en Director_y_Textos
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const dTextos = sheetTextos.getDataRange().getValues();
      const jsonBackup = JSON.stringify(validos);
      let enc = false;
      for (let j = 1; j < dTextos.length; j++) {
        if (String(dTextos[j][0]).trim() === "papelera_estudiantes_json") {
          sheetTextos.getRange(j + 1, 2).setValue(jsonBackup);
          enc = true;
          break;
        }
      }
      if (!enc) {
        sheetTextos.appendRow(["papelera_estudiantes_json", jsonBackup]);
      }

      return responseJSON({
        status: "success",
        count: validos.length,
        message: "Papelera de recuperación actualizada correctamente (estudiantes con más de 7 días purgados definitivamente)."
      });
    }

    // ─── GESTIÓN INSTITUCIONAL DE CALIFICACIONES (TÉCNICA, HUMANÍSTICA Y ESTUDIANTES) ───
    else if (action === "guardar-calificaciones-registro") {
      let sheetReg = ss.getSheetByName("Calificaciones_Registros") || ss.insertSheet("Calificaciones_Registros");
      if (sheetReg.getLastRow() === 0) {
        sheetReg.appendRow(["ID_Registro", "Tipo", "AreaKey", "Carrera_Especialidad", "Nivel", "Modulo_Materia", "Docente", "Semestre", "Gestion", "Paralelo", "Fecha", "Estado", "FechaModificacion", "UsuarioModif", "JSON_Criterios", "EstadoBloqueo", "UsuarioBloqueo", "FechaBloqueo", "MotivoBloqueo"]);
        aplicarEstiloEncabezado(sheetReg, 19);
      }

      const reg = postData.registro || {};
      const detalles = postData.detalles || [];
      const idReg = String((reg && reg.id) || postData.idRegistro || postData.id || "").trim();

      if (!idReg) {
        return responseJSON({ status: "error", message: "ID de registro no especificado." });
      }

      // Guardar o actualizar registro principal
      const dataReg = sheetReg.getDataRange().getValues();
      let filaRegEnc = -1;

      let usuarioBloqueoExistente = "";
      let fechaBloqueoExistente = "";
      let motivoBloqueoExistente = "";

      for (let i = 1; i < dataReg.length; i++) {
        if (String(dataReg[i][0]).trim() === idReg) {
          filaRegEnc = i + 1;

          usuarioBloqueoExistente = String(dataReg[i][16] || "");
          fechaBloqueoExistente = String(dataReg[i][17] || "");
          motivoBloqueoExistente = String(dataReg[i][18] || "");
          break;
        }
      }

      // PROTECCIÓN DE SEGURIDAD EN EL BACKEND:
      // La autorizacion de area se verifica antes de guardar. La publicacion
      // y los bloqueos historicos no impiden corregir las notas autorizadas.
      exigirCEA(auth, 'Inicia sesion para guardar las calificaciones.', 'AUTH');

      const esTecnicaBackend = (reg.tipo || "tecnica") === "tecnica";
      const maxSer = 10;
      const maxSaber = esTecnicaBackend ? 30 : 40;
      const maxDecidir = 10;
      const maxProceso = 20;
      const maxProducto = 20;
      const maxHacer = esTecnicaBackend ? 40 : 30;
      const maxAutoeval = 10;

      for (let i = 0; i < detalles.length; i++) {
        const d = detalles[i];
        const nomEst = (d.nombres || "") + " " + (d.paterno || "");
        function valNum(v) { return (v !== "" && v !== null && v !== undefined) ? Number(v) : null; }
        const vSer = valNum(d.ser);
        const vSaber = valNum(d.saber);
        const vDecidir = valNum(d.decidir);
        const vProceso = valNum(d.proceso);
        const vProducto = valNum(d.producto);
        const vHacer = valNum(d.hacer);
        const vAuto = valNum(d.autoevaluacion);

        if ((vSer !== null && (isNaN(vSer) || vSer < 0 || vSer > maxSer)) ||
            (vSaber !== null && (isNaN(vSaber) || vSaber < 0 || vSaber > maxSaber)) ||
            (vDecidir !== null && (isNaN(vDecidir) || vDecidir < 0 || vDecidir > maxDecidir)) ||
            (vAuto !== null && (isNaN(vAuto) || vAuto < 0 || vAuto > maxAutoeval)) ||
            (esTecnicaBackend && vProceso !== null && (isNaN(vProceso) || vProceso < 0 || vProceso > maxProceso)) ||
            (esTecnicaBackend && vProducto !== null && (isNaN(vProducto) || vProducto < 0 || vProducto > maxProducto)) ||
            (!esTecnicaBackend && vHacer !== null && (isNaN(vHacer) || vHacer < 0 || vHacer > maxHacer))) {
          return responseJSON({
            status: "error",
            message: "VALIDACIÓN RECHAZADA: Calificaciones fuera de rango para " + nomEst + ". Límites: SER (10), SABER (" + maxSaber + "), DECIDIR (10), AUTOEVALUACIÓN (10)" + (esTecnicaBackend ? ", PROCESO (20), PRODUCTO (20)." : ", HACER (35).")
          });
        }
      }

      const estadoBloqueoFinal = 'DESBLOQUEADO';

      const tipoReg = reg.tipo || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][1] || "tecnica") : "tecnica");
      const areaKeyReg = reg.areaKey || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][2] || "") : "");
      const carreraReg = reg.carrera || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][3] || "") : "");
      const nivelReg = reg.nivel || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][4] || "") : "");
      const moduloRecibido = reg.modulo || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][5] || "") : "");
      const mallaGuardada=ss.getSheetByName('Mallas_Curriculares')?.getDataRange().getValues().slice(1).find(f=>areaCanonicaCEA(f[0])===areaCanonicaCEA(areaKeyReg)&&nivelNotasCEA(f[1])===nivelNotasCEA(nivelReg)&&Number(f[4])===Number(reg.moduloNumero));
      const moduloOficial=mallaGuardada?[mallaGuardada[2],mallaGuardada[3]]:moduloPlanillaSistemasCEA(areaKeyReg,nivelReg,idReg,moduloRecibido,reg.moduloCodigo);
      const moduloReg = moduloOficial ? moduloOficial.slice(0,2).join(': ') : moduloRecibido;
      const docenteReg = reg.docente || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][6] || "") : "");
      const semestreReg = reg.semestre || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][7] || "Segundo Semestre") : "Segundo Semestre");
      const gestionReg = reg.gestion || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][8] || "2026") : "2026");
      const paraleloReg = reg.paralelo || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][9] || "A") : "A");
      const fechaReg = reg.fecha || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][10] || "") : new Date().toISOString().split("T")[0]);
      const estadoReg = reg.estado || (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][11] || "BORRADOR") : "BORRADOR");
      const criteriosReg = reg.criterios ? JSON.stringify(reg.criterios) : (filaRegEnc > 0 ? String(dataReg[filaRegEnc - 1][14] || "[]") : "[]");

      const valoresReg = [
        idReg,
        tipoReg,
        areaKeyReg,
        carreraReg,
        nivelReg,
        moduloReg,
        docenteReg,
        semestreReg,
        gestionReg,
        paraleloReg,
        fechaReg,
        estadoReg,
        new Date().toISOString(),
        reg.usuarioModif || "Docente",
        criteriosReg,
        estadoBloqueoFinal,
        reg.usuarioBloqueo || usuarioBloqueoExistente,
        reg.fechaBloqueo || fechaBloqueoExistente,
        reg.motivoBloqueo || motivoBloqueoExistente
      ];

      if (filaRegEnc > 0) {
        sheetReg.getRange(filaRegEnc, 1, 1, 19).setValues([valoresReg]);
      } else {
        sheetReg.appendRow(valoresReg);
      }

      const filasIdentidad=sheetReg.getDataRange().getValues(),camposIdentidad=columnasModuloCEA(filasIdentidad);
      const filaIdentidad=filasIdentidad.find(f=>String(f[0])===String(idReg));
      if(filaIdentidad&&reg.moduloNumero){filaIdentidad[camposIdentidad.numero]=Number(reg.moduloNumero);filaIdentidad[camposIdentidad.codigo]=String(reg.moduloCodigo||moduloReg.split(':')[0]);escribirTablaCEA(ss,'Calificaciones_Registros',filasIdentidad);}
      // Guardar o actualizar detalles (estudiantes)
      let sheetDet = ss.getSheetByName("Calificaciones_Detalle") || ss.insertSheet("Calificaciones_Detalle");
      if (sheetDet.getLastRow() === 0) {
        sheetDet.appendRow(["ID_Detalle", "ID_Registro", "Nro", "Paterno", "Materno", "Nombres", "CI", "RUDE", "Ser", "Saber", "Decidir", "Proceso", "Producto", "Hacer", "Autoevaluacion", "NotaFinal", "Observacion", "ObservacionManual", "EstadoParticipante", "NotasRegistradas"]);
        aplicarEstiloEncabezado(sheetDet, 17);
      }

      if (sheetDet.getLastColumn() < 18) sheetDet.getRange(1, 18).setValue("ObservacionManual");
      if (sheetDet.getLastColumn() < 20) sheetDet.getRange(1, 19, 1, 2).setValues([["EstadoParticipante", "NotasRegistradas"]]);
      const dataDet = sheetDet.getDataRange().getValues();
      let nuevasFilas = [];

      if (detalles.length > 0) {
        nuevasFilas = detalles.map((d, idx) => [
          d.id || ('DET-' + idReg + '-' + (idx + 1)),
          idReg,
          d.nro || (idx + 1),
          d.paterno || "",
          d.materno || "",
          d.nombres || "",
          d.ci || "",
          d.rude || "",
          d.ser !== "" ? d.ser : "",
          d.saber !== "" ? d.saber : "",
          d.decidir !== "" ? d.decidir : "",
          d.proceso !== "" ? d.proceso : "",
          d.producto !== "" ? d.producto : "",
          d.hacer !== undefined ? d.hacer : "",
          d.autoevaluacion !== "" ? d.autoevaluacion : "",
          d.notaFinal || 0,
          d.observacion || "NO EVALUADO",
          d.observacionManual || "", d.estadoParticipante || "", "SI"
        ]);

      }

      const primeraFilaDetalle = dataDet.findIndex((row, i) => i > 0 && String(row[1]).trim() === idReg);
      const cantidadAnterior = dataDet.filter((row, i) => i > 0 && String(row[1]).trim() === idReg).length;
      const mismasFilas = primeraFilaDetalle > 0 && cantidadAnterior === nuevasFilas.length &&
        nuevasFilas.every((row, i) => {
          const anterior = dataDet[primeraFilaDetalle + i];
          return anterior && String(anterior[1]).trim() === idReg &&
            String(anterior[0]) === String(row[0]) && Number(anterior[2]) === Number(row[2]);
        });
      if (cantidadAnterior === 0) {
        // Una planilla nueva se agrega sin reescribir el historial de otros años.
        if (nuevasFilas.length) sheetDet.getRange(sheetDet.getLastRow()+1,1,nuevasFilas.length,20).setValues(nuevasFilas);
      } else if (mismasFilas) {
        let primeraModificada = nuevasFilas.length;
        let ultimaModificada = -1;
        nuevasFilas.forEach((row, i) => {
          const anterior = dataDet[primeraFilaDetalle + i];
          if (row.every((valor, columna) => String(valor ?? '') === String(anterior[columna] ?? ''))) return;
          primeraModificada = Math.min(primeraModificada, i);
          ultimaModificada = i;
        });
        if (ultimaModificada >= 0) {
          const modificadas = nuevasFilas.slice(primeraModificada, ultimaModificada + 1);
          sheetDet.getRange(primeraFilaDetalle + primeraModificada + 1, 1, modificadas.length, 20).setValues(modificadas);
        }
      } else {
        const incomingIds = new Set(detalles.map(detail => String(detail.id || '')));
        const archived = leerMatriculasCEA(ss).filter(est =>
          est.estadoMatricula === 'ELIMINADO' &&
          areaCanonicaCEA(est.areaKey) === areaCanonicaCEA(areaKeyReg) &&
          String(est.nivel).trim().toLowerCase() === String(nivelReg).trim().toLowerCase() &&
          est.paralelo === paraleloReg && String(est.gestion) === String(gestionReg) &&
          /2|segundo/i.test(est.semestre) === /2|segundo/i.test(semestreReg)
        );
        const conservados = dataDet.filter((row, i) => i === 0 || String(row[1]).trim() !== idReg ||
          (!incomingIds.has(String(row[0])) && archived.some(est =>
            (est.ci && est.ci === String(row[6])) || (est.rude && est.rude === String(row[7]))
          ))
        );
        escribirTablaCEA(ss, 'Calificaciones_Detalle', conservados.concat(nuevasFilas));
        if (sheetDet.getLastRow() > 1) {
          sheetDet.getRange(2, 1, sheetDet.getLastRow() - 1, 20).sort([
            { column: 2, ascending: true },
            { column: 3, ascending: true }
          ]);
        }
      }
      if (filaRegEnc < 0 && sheetReg.getLastRow() > 1) {
        sheetReg.getRange(2, 1, sheetReg.getLastRow() - 1, Math.max(19,sheetReg.getLastColumn())).sort([
          { column: 1, ascending: true }  // ID_Registro
        ]);
      }

      return responseJSON({ status: "success", message: "Calificaciones guardadas exitosamente en el sistema institucional.", id: idReg });
    }

    else if (action === "cambiar-bloqueo-calificaciones") {
      let sheetReg = ss.getSheetByName("Calificaciones_Registros");
      if (!sheetReg) return responseJSON({ status: "error", message: "Hoja de registros no encontrada." });
      const idReg = String(postData.idRegistro || "").trim();
      const bloqueado = Boolean(postData.bloqueado);
      const motivo = String(postData.motivo || "").trim();
      const usuario = String(postData.usuario || "Director").trim();

      const dataReg = sheetReg.getDataRange().getValues();
      let modificado = false;
      for (let i = 1; i < dataReg.length; i++) {
        if (String(dataReg[i][0]).trim() === idReg) {
          sheetReg.getRange(i + 1, 16).setValue(bloqueado ? "BLOQUEADO" : "DESBLOQUEADO");
          sheetReg.getRange(i + 1, 17).setValue(usuario);
          sheetReg.getRange(i + 1, 18).setValue(new Date().toISOString());
          sheetReg.getRange(i + 1, 19).setValue(motivo);
          modificado = true;
          break;
        }
      }
      return responseJSON({
        status: modificado ? "success" : "not_found",
        bloqueado: bloqueado,
        message: bloqueado ? "Registro bloqueado por la Dirección exitosamente." : "Registro desbloqueado exitosamente."
      });
    }

    else if (action === "guardar-estado-subida-centralizador") {
      let sheetSub = ss.getSheetByName("Control_Subida_Centralizadores") || ss.insertSheet("Control_Subida_Centralizadores");
      if (sheetSub.getLastRow() === 0) {
        sheetSub.appendRow(["Key", "CarreraKey", "NivelNombre", "Gestion", "Semestre", "Paralelo", "Estado", "FechaHora", "UsuarioDirector", "HashNotas"]);
        aplicarEstiloEncabezado(sheetSub, 10);
      }

      const key = String(postData.key || "").trim();
      const carreraKey = String(postData.carreraKey || "").trim();
      const nivelNombre = String(postData.nivelNombre || "").trim();
      const gestion = String(postData.gestion || "").trim();
      const semestre = String(postData.semestre || "").trim();
      const paralelo = String(postData.paralelo || "").trim();
      const estado = String(postData.estado || "PENDIENTE DE VERIFICACIÓN").trim();
      const fechaHora = String(postData.fechaHora || new Date().toISOString()).trim();
      const usuarioDirector = String(postData.usuarioDirector || "Director").trim();
      const hashNotas = String(postData.hashNotas || "").trim();

      if (!key) {
        return responseJSON({ status: "error", message: "Clave de centralizador no especificada." });
      }

      const dataSub = sheetSub.getDataRange().getValues();
      let filaEnc = -1;
      for (let i = 1; i < dataSub.length; i++) {
        if (String(dataSub[i][0]).trim() === key) {
          filaEnc = i + 1;
          break;
        }
      }

      const filaValores = [key, carreraKey, nivelNombre, gestion, semestre, paralelo, estado, fechaHora, usuarioDirector, hashNotas];
      if (filaEnc > 0) {
        sheetSub.getRange(filaEnc, 1, 1, 10).setValues([filaValores]);
      } else {
        sheetSub.appendRow(filaValores);
      }

      return responseJSON({
        status: "success",
        message: "Estado de subida del centralizador guardado exitosamente en el sistema institucional.",
        data: { key: key, estado: estado, fechaHora: fechaHora, usuarioDirector: usuarioDirector, hashNotas: hashNotas }
      });
    }

    else if (action === "guardar-subida-estudiante" || action === "guardar-subida-nota-estudiante") {
      let sheetSubEst = ss.getSheetByName("Control_Subida_Estudiantes") || ss.insertSheet("Control_Subida_Estudiantes");
      if (sheetSubEst.getLastRow() === 0) {
        sheetSubEst.appendRow(["Key", "CarreraKey", "NivelNombre", "Gestion", "Semestre", "Paralelo", "EstudianteId", "NombreCompleto", "Estado", "FechaHora", "UsuarioDirector"]);
        aplicarEstiloEncabezado(sheetSubEst, 11);
      }

      const carreraKey = String(postData.carreraKey || "").trim();
      const nivelNombre = String(postData.nivelNombre || postData.nivel || "").trim();
      const gestion = String(postData.gestion || "").trim();
      const semestre = String(postData.semestre || "").trim();
      const paralelo = String(postData.paralelo || "A").trim();
      const estudianteId = String(postData.estudianteId || postData.estudianteKey || "").trim();
      const nombreCompleto = String(postData.nombreCompleto || "").trim();
      const key = [carreraKey, nivelNombre, gestion, semestre, paralelo, estudianteId].map(encodeURIComponent).join('|');
      const estado = (postData.estado === true || postData.subido === true || String(postData.estado).toUpperCase() === "SUBIDO" || String(postData.subido).toUpperCase() === "SUBIDO") ? "SUBIDO" : "PENDIENTE";
      const fechaHora = String(postData.fechaHora || postData.fechaActualizacion || new Date().toISOString()).trim();
      const usuarioDirector = String(postData.usuarioDirector || "Director").trim();

      if (!key) {
        return responseJSON({ status: "error", message: "Clave de estudiante requerida." });
      }

      const rows = sheetSubEst.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]).trim() === key) {
          rowIndex = i + 1;
          break;
        }
      }

      const newRow = [key, carreraKey, nivelNombre, gestion, semestre, paralelo, estudianteId, nombreCompleto, estado, fechaHora, usuarioDirector];
      if (rowIndex > 0) {
        sheetSubEst.getRange(rowIndex, 1, 1, newRow.length).setValues([newRow]);
      } else {
        sheetSubEst.appendRow(newRow);
      }

      return responseJSON({
        status: "success",
        message: "Estado de subida por estudiante guardado.",
        data: { key: key, estado: estado }
      });
    }

    else if (action === "guardar-lote-subida-estudiantes" || action === "marcar-todas-subidas-curso") {
      let sheetSubEst = ss.getSheetByName("Control_Subida_Estudiantes") || ss.insertSheet("Control_Subida_Estudiantes");
      if (sheetSubEst.getLastRow() === 0) {
        sheetSubEst.appendRow(["Key", "CarreraKey", "NivelNombre", "Gestion", "Semestre", "Paralelo", "EstudianteId", "NombreCompleto", "Estado", "FechaHora", "UsuarioDirector"]);
        aplicarEstiloEncabezado(sheetSubEst, 11);
      }

      const items = Array.isArray(postData.items) ? postData.items : [];
      const rows = sheetSubEst.getDataRange().getValues();
      const keyMap = {};
      for (let i = 1; i < rows.length; i++) {
        keyMap[String(rows[i][0]).trim()] = i + 1;
      }

      if (items.length > 0) {
        items.forEach(it => {
          const k = [it.carreraKey || postData.carreraKey, it.nivelNombre || it.nivel || postData.nivelNombre, it.gestion || postData.gestion, it.semestre || postData.semestre, it.paralelo || postData.paralelo || 'A', it.estudianteId || it.estudianteKey || it.key].map(encodeURIComponent).join('|');
          if (!k) return;
          const newRow = [
            k,
            String(it.carreraKey || postData.carreraKey || "").trim(),
            String(it.nivelNombre || it.nivel || postData.nivelNombre || postData.nivel || "").trim(),
            String(it.gestion || postData.gestion || "").trim(),
            String(it.semestre || postData.semestre || "").trim(),
            String(it.paralelo || postData.paralelo || "A").trim(),
            String(it.estudianteId || it.estudianteKey || it.key || "").trim(),
            String(it.nombreCompleto || "").trim(),
            (it.estado === true || it.subido === true || String(it.estado).toUpperCase() === "SUBIDO" || String(it.subido).toUpperCase() === "SUBIDO") ? "SUBIDO" : "PENDIENTE",
            String(it.fechaHora || it.fechaActualizacion || new Date().toISOString()).trim(),
            String(it.usuarioDirector || "Director").trim()
          ];
          if (keyMap[k]) {
            sheetSubEst.getRange(keyMap[k], 1, 1, newRow.length).setValues([newRow]);
          } else {
            sheetSubEst.appendRow(newRow);
            keyMap[k] = sheetSubEst.getLastRow();
          }
        });
      } else if (postData.marcarTodos !== undefined) {
        const marcarEst = Boolean(postData.marcarTodos) ? "SUBIDO" : "PENDIENTE";
        const cKeyFiltro = String(postData.carreraKey || "").trim();
        const nivFiltro = String(postData.nivelNombre || postData.nivel || "").trim();
        const parFiltro = String(postData.paralelo || "").trim();
        for (let i = 1; i < rows.length; i++) {
          const rCKey = String(rows[i][1] || "").trim();
          const rNiv = String(rows[i][2] || "").trim();
          const rPar = String(rows[i][5] || "").trim();
          if ((!cKeyFiltro || rCKey === cKeyFiltro) && (!nivFiltro || rNiv === nivFiltro) && (!parFiltro || rPar === parFiltro) && String(rows[i][3]) === String(postData.gestion) && String(rows[i][4]) === String(postData.semestre)) {
            sheetSubEst.getRange(i + 1, 9).setValue(marcarEst);
            sheetSubEst.getRange(i + 1, 10).setValue(new Date().toISOString());
          }
        }
      }

      return responseJSON({
        status: "success",
        message: "Lote de estados de subida procesado exitosamente.",
        count: items.length
      });
    }

    else if (action === "guardar-paralelos") {
      let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
      const dataT = sheetTextos.getDataRange().getValues();
      const clave = "cea_calificaciones_paralelos_config";
      const nuevoValor = JSON.stringify(postData.paralelos || {});
      let encP = false;
      for (let i = 1; i < dataT.length; i++) {
        if (String(dataT[i][0]).trim() === clave) {
          sheetTextos.getRange(i + 1, 2).setValue(nuevoValor);
          encP = true;
          break;
        }
      }
      if (!encP) {
        sheetTextos.appendRow([clave, nuevoValor]);
      }
      return responseJSON({ status: "success", message: "Configuración de paralelos guardada exitosamente." });
    }

    else if (action === "guardar-foto-carrera") {
      const cKey = String(postData.key || "").trim();
      const foto = String(postData.foto || "").trim();
      if (cKey) {
        let sheetCarreras = ss.getSheetByName("Carreras_Tecnicas") || ss.insertSheet("Carreras_Tecnicas");
        const dataC = sheetCarreras.getDataRange().getValues();
        for (let i = 1; i < dataC.length; i++) {
          if (String(dataC[i][0]).trim() === cKey) {
            sheetCarreras.getRange(i + 1, 6).setValue(foto);
            break;
          }
        }
        let sheetTextos = ss.getSheetByName("Director_y_Textos") || ss.insertSheet("Director_y_Textos");
        const dataT = sheetTextos.getDataRange().getValues();
        const clave = "foto_carrera_" + cKey;
        let encT = false;
        for (let i = 1; i < dataT.length; i++) {
          if (String(dataT[i][0]).trim() === clave) {
            sheetTextos.getRange(i + 1, 2).setValue(foto);
            encT = true;
            break;
          }
        }
        if (!encT) {
          sheetTextos.appendRow([clave, foto]);
        }
      }
      return responseJSON({ status: "success", message: "Fotografía de especialidad guardada exitosamente." });
    }

    else if (action === "obtener-estados-subida-estudiantes") {
      let sheetSubEst = ss.getSheetByName("Control_Subida_Estudiantes");
      if (!sheetSubEst) {
        return responseJSON({ status: "success", data: {} });
      }

      const rows = sheetSubEst.getDataRange().getValues();
      const result = {};
      for (let i = 1; i < rows.length; i++) {
        const k = String(rows[i][0]).trim();
        const est = String(rows[i][8]).trim() === "SUBIDO";
        if (k) result[k] = est;
      }

      return responseJSON({ status: "success", data: result });
    }

    else if (action === "obtener-estados-subida-centralizador") {
      let sheetSub = ss.getSheetByName("Control_Subida_Centralizadores");
      if (!sheetSub) {
        return responseJSON({ status: "success", data: [] });
      }
      const dataSub = sheetSub.getDataRange().getValues();
      const lista = [];
      for (let i = 1; i < dataSub.length; i++) {
        const k = String(dataSub[i][0] || "").trim();
        if (k) {
          lista.push({
            key: k,
            carreraKey: String(dataSub[i][1] || ""),
            nivelNombre: String(dataSub[i][2] || ""),
            gestion: String(dataSub[i][3] || ""),
            semestre: String(dataSub[i][4] || ""),
            paralelo: String(dataSub[i][5] || ""),
            estado: String(dataSub[i][6] || "PENDIENTE DE VERIFICACIÓN"),
            fechaHora: String(dataSub[i][7] || ""),
            usuarioDirector: String(dataSub[i][8] || ""),
            hashNotas: String(dataSub[i][9] || "")
          });
        }
      }
      return responseJSON({ status: "success", data: lista });
    }

    else if (action === "cambiar-credenciales-docente") {
      let sheetU = ss.getSheetByName("Usuarios_Docentes") || ss.insertSheet("Usuarios_Docentes");
      const areaKey = String(postData.areaKey || "").trim();
      const passActual = String(postData.passActual || "").trim();
      const nuevoUsuario = String(postData.nuevoUsuario || "").trim().toLowerCase();
      const nuevaPass = String(postData.nuevaPass || "").trim();

      if (!areaKey || !nuevoUsuario || !nuevaPass) {
        return responseJSON({ status: "error", message: "Datos incompletos para actualizar credenciales." });
      }

      const dataU = sheetU.getDataRange().getValues();
      let filaDoc = -1;
      for (let i = 1; i < dataU.length; i++) {
        const u = String(dataU[i][1] || "").trim().toLowerCase();
        const a = String(dataU[i][0] || "").trim();
        if (a === areaKey) {
          filaDoc = i + 1;
        } else if (u === nuevoUsuario) {
          return responseJSON({ status: "error", message: "El nombre de usuario '" + nuevoUsuario + "' ya está en uso por otro docente." });
        }
      }

      const sheetT = ss.getSheetByName("Director_y_Textos");
      if (sheetT) {
        const rowsT = sheetT.getDataRange().getValues();
        for (let i = 1; i < rowsT.length; i++) {
          if (String(rowsT[i][0] || '').trim() === 'director_usuario') {
            if (String(rowsT[i][1] || '').trim().toLowerCase() === nuevoUsuario) {
              return responseJSON({ status: "error", message: "El nombre de usuario elegido no está disponible." });
            }
          }
        }
      }

      if (filaDoc > 0) {
        const passRegistrada = String(dataU[filaDoc - 1][2] || "").trim();
        if (passActual && passRegistrada && passActual !== passRegistrada) {
          return responseJSON({ status: "error", message: "La contraseña actual ingresada es incorrecta." });
        }
        sheetU.getRange(filaDoc, 2).setValue(nuevoUsuario);
        sheetU.getRange(filaDoc, 3).setValue(nuevaPass);
        return responseJSON({ status: "success", message: "Credenciales de docente actualizadas exitosamente en el sistema institucional." });
      } else {
        sheetU.appendRow([areaKey, nuevoUsuario, nuevaPass, "NO"]);
        return responseJSON({ status: "success", message: "Credenciales registradas exitosamente." });
      }
    }

    else if (action === "cambiar-estado-calificaciones") {
      let sheetReg = ss.getSheetByName("Calificaciones_Registros");
      if (!sheetReg) return responseJSON({ status: "error", message: "Hoja de registros no encontrada." });
      const idReg = String(postData.idRegistro || "").trim();
      const nuevoEstado = String(postData.nuevoEstado || "").trim();

      const dataReg = sheetReg.getDataRange().getValues();
      let modificado = false;
      for (let i = 1; i < dataReg.length; i++) {
        if (String(dataReg[i][0]).trim() === idReg) {
          sheetReg.getRange(i + 1, 12).setValue(nuevoEstado);
          sheetReg.getRange(i + 1, 13).setValue(new Date().toISOString());
          modificado = true;
          break;
        }
      }
      return responseJSON({ status: modificado ? "success" : "not_found", message: modificado ? "Estado actualizado a " + nuevoEstado : "Registro no encontrado." });
    }

    else if (action === 'habilitar-gestion-academica') {
      const anio = String(postData.anio || '').trim();
      exigirCEA(/^\d{4}$/.test(anio) && Number(anio) >= 1900, 'Ingresa una gestión de cuatro dígitos válida.');
      const hoja = ss.getSheetByName('Director_y_Textos');
      const filas = hoja.getDataRange().getValues();
      const posicion = filas.findIndex(fila=>fila[0]==='cea_gestiones_lista');
      let anteriores = [];
      try { anteriores = JSON.parse(posicion >= 0 ? filas[posicion][1] : '[]'); } catch(error) {}
      const gestiones = [...new Set([...(Array.isArray(anteriores)?anteriores:[]),anio].map(String).filter(valor=>/^\d{4}$/.test(valor)))].sort((a,b)=>b.localeCompare(a));
      if (posicion >= 0) hoja.getRange(posicion+1,2).setValue(JSON.stringify(gestiones));
      else hoja.appendRow(['cea_gestiones_lista',JSON.stringify(gestiones)]);
      return responseJSON({status:'success',gestiones});
    }

    else if (action === 'publicar-boletin-curso') {
      return responseJSON(publicarBoletinCursoCEA(ss, postData, auth));
    }

    else if (action === "publicar-lote-calificaciones") {
      const ids = new Set(Array.isArray(postData.ids) ? postData.ids.map(String) : []);
      const gestion = String(postData.gestion || '').trim();
      const semestre = String(postData.semestre || '').trim();
      const area = areaCanonicaCEA(postData.areaKey);
      if (!ids.size || !gestion || !semestre) {
        return responseJSON({status: 'error', message: 'Selecciona las planillas y el período que deseas publicar.'});
      }
      const hoja = ss.getSheetByName('Calificaciones_Registros');
      if (!hoja) return responseJSON({status: 'error', message: 'Hoja de registros no encontrada.'});
      const publicados = [];
      const fecha = new Date().toISOString();
      hoja.getDataRange().getValues().slice(1).forEach((fila, index) => {
        const id = String(fila[0]).trim();
        if (!ids.has(id) || String(fila[11]).trim() !== 'FINALIZADO' ||
            String(fila[8]).trim() !== gestion || /2|segundo/i.test(fila[7]) !== /2|segundo/i.test(semestre) ||
            (area && areaCanonicaCEA(fila[2]) !== area)) return;
        hoja.getRange(index + 2, 12, 1, 2).setValues([['PUBLICADO', fecha]]);
        publicados.push(id);
      });
      return responseJSON({status: 'success', publicados, fecha});
    }

    else if (action === "registrar-auditoria-calificaciones") {
      let sheetAud = ss.getSheetByName("Calificaciones_Auditoria") || ss.insertSheet("Calificaciones_Auditoria");
      if (sheetAud.getLastRow() === 0) {
        sheetAud.appendRow(["ID_Auditoria", "ID_Registro", "Usuario", "Rol", "Accion", "Detalle", "FechaHora"]);
        aplicarEstiloEncabezado(sheetAud, 7);
      }
      sheetAud.appendRow([
        postData.id || ("AUD-" + Date.now()),
        postData.idRegistro || "",
        postData.usuario || "Sistema",
        postData.rol || "",
        postData.accion || "",
        postData.detalle || "",
        postData.fechaHora || new Date().toLocaleString("es-BO")
      ]);
      return responseJSON({ status: "success" });
    }

    else if (action === "consultar-calificaciones-estudiante") {
      const ciBuscado = documentoConsultaNotasCEA(postData.ci);
      exigirCEA(ciBuscado, 'Ingresa tu cédula de identidad.');

      let sheetDet = ss.getSheetByName("Calificaciones_Detalle");
      let sheetReg = ss.getSheetByName("Calificaciones_Registros");

      if (!sheetDet || !sheetReg) {
        return responseJSON({ status: "success", calificaciones: [] });
      }

      const dataReg = sheetReg.getDataRange().getValues();
      const dataDet = sheetDet.getDataRange().getValues();
      const columnaPublicacion = dataReg[0].indexOf('EstadoPublicacion');
      const mallas = ss.getSheetByName('Mallas_Curriculares')?.getDataRange().getValues().slice(1) || [];
      const docentes = ss.getSheetByName('Docentes')?.getDataRange().getValues().slice(1) || [];

      // Mapa de registros PUBLICADOS
      const mapaRegPublicados = {};
      for (let i = 1; i < dataReg.length; i++) {
        const fila = dataReg[i];
        if (String(fila[11]).trim() === "PUBLICADO" || columnaPublicacion >= 0 && fila[columnaPublicacion] === 'PUBLICADO') {
          mapaRegPublicados[String(fila[0]).trim()] = {
            id: String(fila[0]),
            tipo: String(fila[1]),
            areaKey: String(fila[2]),
            carrera: String(fila[3]),
            nivel: String(fila[4]),
            modulo: String(fila[5]),
            moduloNumero:posicionFilaModuloCEA(fila,dataReg[0]),
            docente: String(fila[6]),
            semestre: String(fila[7]),
            gestion: String(fila[8]),
            paralelo: String(fila[9]),
            fecha: String(fila[10]),
            fechaModificacion: String(fila[12] || fila[10] || ''),
            estado: "PUBLICADO"
          };
          const registro = mapaRegPublicados[String(fila[0]).trim()];
          registro.catalogoModulos = catalogoConsultaNotasCEA(registro, mallas);
          registro.numeroModulo = posicionConsultaNotasCEA(registro);
          const docente = docentes.find(item => String(item[0]) === registro.areaKey);
          if (!registro.docente || registro.docente === registro.areaKey) registro.docente = String(docente?.[1] || '');
        }
      }

      const resultados = [];
      for (let i = 1; i < dataDet.length; i++) {
        const fila = dataDet[i];
        const ciFila = documentoConsultaNotasCEA(fila[6]);
        const idRegFila = String(fila[1] || "").trim();

        if (mapaRegPublicados[idRegFila] && ciFila === ciBuscado) {
          resultados.push({
            registro: mapaRegPublicados[idRegFila],
            detalle: {
              id: String(fila[0]),
              idRegistro: idRegFila,
              nro: fila[2],
              paterno: String(fila[3] || ""),
              materno: String(fila[4] || ""),
              nombres: String(fila[5] || ""),
              ci: String(fila[6] || ""),
              rude: String(fila[7] || ""),
              ser: fila[8],
              saber: fila[9],
              decidir: fila[10],
              proceso: fila[11],
              producto: fila[12],
              hacer: fila[13],
              autoevaluacion: fila[14],
              notaFinal: fila[15],
              observacion: String(fila[16] || ""),
              observacionManual: String(fila[17] || ""),
              notasRegistradas: fila[19] === true || /^(SI|TRUE)$/i.test(String(fila[19])) || fila.slice(8, 15).some(valor => valor !== '' && valor != null) || Number(fila[15]) > 0
            }
          });
        }
      }

      return responseJSON({ status: "success", calificaciones: resultados });
    }

    return responseJSON({ status: "error", message: "Acción no reconocida: " + action });

  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

/**
 * Menú personalizado al abrir la hoja en el sistema institucional
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('CEA Madre Marie Poussepín')
      .addItem('Configurar conexión y actualizar estructura', 'configurarSistemaCEA')
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
    sheetT.appendRow(["director_contrasena", Utilities.getUuid()]);
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
    sheetC.appendRow(["Codigo", "Nombre", "DocenteCodigo", "Color", "Resumen", "Foto"]);
    aplicarEstiloEncabezado(sheetC, 6);
    sheetC.appendRow(["tec-sis", "Sistemas Informáticos", "tec-sis", "#1565c0", "Instalación y mantenimiento de equipos, redes, bases de datos y desarrollo de software moderno.", "FOTOGRAFIA DE SISTEMAS.jpg"]);
    sheetC.appendRow(["tec-sec", "Secretariado Ejecutivo", "tec-sec", "#6a1b9a", "Gestión documental, redacción profesional, ofimática avanzada y administración eficiente de oficinas.", ""]);
    sheetC.appendRow(["tec-bel", "Belleza Integral", "tec-bel", "#ad1457", "Corte, estilismo capilar, colorimetría, tratamientos estéticos, cuidado dérmico y maquillaje profesional.", ""]);
    sheetC.appendRow(["tec-tex", "Confección Textil", "tec-tex", "#2e7d32", "Patronaje industrial, corte y confección de prendas, operatividad de máquinas y acabados de calidad.", ""]);
    sheetC.appendRow(["tec-gas", "Gastronomía y Alimentación", "tec-gas", "#e64a19", "Arte culinario boliviano e internacional, pastelería, panadería, inocuidad alimentaria y gestión gastronómica.", ""]);
    sheetC.appendRow(["tec-agr", "Agropecuaria", "tec-agr", "#558b2f", "Cultivos sostenibles, sistemas de riego, producción agroecológica y manejo pecuario regional.", ""]);
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
    sheetU.appendRow(["AreaKey", "Usuario", "Contrasena", "Comision"]);
    aplicarEstiloEncabezado(sheetU, 4);
    sheetU.appendRow(["tec-sis", "profe.sistemas", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["tec-sec", "profe.secretariado", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["tec-bel", "profe.belleza", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["tec-tex", "profe.textil", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["tec-gas", "profe.gastronomia", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["tec-agr", "profe.agropecuaria", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["hum-cn", "profe.naturales", Utilities.getUuid(), "SI"]);
    sheetU.appendRow(["hum-mat", "profe.matematica", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["hum-cs", "profe.sociales", Utilities.getUuid(), "NO"]);
    sheetU.appendRow(["hum-len", "profe.lenguaje", Utilities.getUuid(), "NO"]);
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
    sheetDocNiv.appendRow(["CarreraKey", "Nivel", "Titulo", "Enlace"]);
    aplicarEstiloEncabezado(sheetDocNiv, 4);
    const carrs = ["tec-sis", "tec-sec", "tec-bel", "tec-tex", "tec-gas", "tec-agr"];
    const nivs = [
      { n: "Técnico Básico", t: "Plan Modular - Técnico Básico" },
      { n: "Técnico Auxiliar", t: "Plan Modular - Técnico Auxiliar" },
      { n: "Técnico Medio I", t: "Plan Modular - Técnico Medio I" },
      { n: "Técnico Medio II", t: "Plan Modular - Técnico Medio II" }
    ];
    carrs.forEach(c => {
      nivs.forEach(item => {
        sheetDocNiv.appendRow([c, item.n, item.t, "#"]);
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
    sheetIns.appendRow(["Gestión", "Mes", "Fecha", "Nombre Completo", "CI", "Fecha Nacimiento", "Teléfono", "Área", "Carrera/Nivel", "Observaciones", "Semestre", "Caso Excepcional", "Detalle Excepción", "Sede / Subcentro", "De dónde vienes"]);
    aplicarEstiloEncabezado(sheetIns, 15);
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

  
  // 17. Calificaciones_Registros
  let sheetCalifReg = ss.getSheetByName("Calificaciones_Registros") || ss.insertSheet("Calificaciones_Registros");
  if (sheetCalifReg.getLastRow() === 0) {
    sheetCalifReg.appendRow(["ID_Registro", "Tipo", "AreaKey", "Carrera_Especialidad", "Nivel", "Modulo_Materia", "Docente", "Semestre", "Gestion", "Paralelo", "Fecha", "Estado", "FechaModificacion", "UsuarioModif", "JSON_Criterios"]);
    aplicarEstiloEncabezado(sheetCalifReg, 15);
  }

  // 18. Calificaciones_Detalle
  let sheetCalifDet = ss.getSheetByName("Calificaciones_Detalle") || ss.insertSheet("Calificaciones_Detalle");
  if (sheetCalifDet.getLastRow() === 0) {
    sheetCalifDet.appendRow(["ID_Detalle", "ID_Registro", "Nro", "Paterno", "Materno", "Nombres", "CI", "RUDE", "Ser", "Saber", "Decidir", "Proceso", "Producto", "Hacer", "Autoevaluacion", "NotaFinal", "Observacion", "ObservacionManual", "EstadoParticipante", "NotasRegistradas"]);
    aplicarEstiloEncabezado(sheetCalifDet, 17);
  }

  // 19. Calificaciones_Auditoria
  let sheetCalifAud = ss.getSheetByName("Calificaciones_Auditoria") || ss.insertSheet("Calificaciones_Auditoria");
  if (sheetCalifAud.getLastRow() === 0) {
    sheetCalifAud.appendRow(["ID_Auditoria", "ID_Registro", "Usuario", "Rol", "Accion", "Detalle", "FechaHora"]);
    aplicarEstiloEncabezado(sheetCalifAud, 7);
  }

  // 20. Registro_Estudiantes (Padrón Oficial Organizado de Estudiantes)
  let sheetRegEst = ss.getSheetByName("Registro_Estudiantes") || ss.getSheetByName("Registro de Estudiantes") || ss.insertSheet("Registro_Estudiantes");
  if (sheetRegEst.getLastRow() === 0) {
    sheetRegEst.appendRow([
      "N°", "GESTIÓN", "SEMESTRE", "ÁREA / RAMA", "CARRERA / ESPECIALIDAD",
      "NIVEL / CURSO", "PARALELO", "TURNO", "DOCUMENTO (CI)", "CÓDIGO RUDE",
      "APELLIDO PATERNO", "APELLIDO MATERNO", "NOMBRES", "NOMBRE COMPLETO",
      "GÉNERO", "FECHA DE NACIMIENTO", "CELULAR / CONTACTO", "ESTADO MATRÍCULA",
      "FECHA ACTUALIZACIÓN"
    ]);
    aplicarEstiloEncabezado(sheetRegEst, 19);
  }

  // 21. Papelera_Recuperacion (Resguardo Temporal de 7 Días)
  let sheetPap = ss.getSheetByName("Papelera_Recuperacion") || ss.insertSheet("Papelera_Recuperacion");
  if (sheetPap.getLastRow() === 0) {
    sheetPap.appendRow([
      "N°", "GESTIÓN", "SEMESTRE", "ÁREA / RAMA", "CARRERA / ESPECIALIDAD",
      "NIVEL / CURSO", "PARALELO", "TURNO", "DOCUMENTO (CI)", "CÓDIGO RUDE",
      "NOMBRE COMPLETO", "GÉNERO", "FECHA ELIMINACIÓN", "DÍAS RESTANTES (MÁX 7)",
      "MOTIVO", "FECHA ACTUALIZACIÓN"
    ]);
    aplicarEstiloEncabezado(sheetPap, 16);
  }

return "Todas las 21 hojas del CEA Madre Marie Poussepín fueron creadas y configuradas con éxito.";
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

// Persistencia y autorización institucional. Se publica junto con este mismo archivo.
const CEA_API_VERSION = 2;
const CEA_ACCIONES_PUBLICAS = ['login', 'visita', 'contacto', 'pre-inscripcion', 'consultar-inscripcion-ci', 'verificar-qr-inscripcion', 'consultar-calificaciones-estudiante'];

function secretoCEA() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty('CEA_SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty('CEA_SESSION_SECRET', secret);
  }
  return secret;
}

function hashCEA(value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(value))).replace(/=+$/, '');
}

function codificarClaveCEA(password) {
  const salt = Utilities.getUuid();
  return 'cea$' + salt + '$' + Utilities.base64Encode(Utilities.computeHmacSha256Signature(salt + ':' + password, secretoCEA()));
}

function comprobarClaveCEA(password, stored) {
  if (password == null || stored == null) return false;
  stored = String(stored).trim();
  if (!String(stored).startsWith('cea$')) return String(password).trim() === stored;
  const parts = String(stored).split('$');
  return parts.length === 3 && parts[2] === Utilities.base64Encode(Utilities.computeHmacSha256Signature(parts[1] + ':' + password, secretoCEA()));
}

function areaCanonicaCEA(value) {
  const key = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const aliases = {sistemas: 'tec-sis', 'tec-sistemas': 'tec-sis', 'sistemas informaticos': 'tec-sis', 'tec-agropecuaria': 'tec-agr', agropecuaria: 'tec-agr', secretariado: 'tec-sec', gastronomia: 'tec-gas', belleza: 'tec-bel', textil: 'tec-tex'};
  return aliases[key] || key;
}

function permisoAreaCEA(auth, area, matricula) {
  if (auth && auth.r === 'director') return true;
  if (!auth || !area) return false;
  const own = areaCanonicaCEA(auth.areaKey);
  const target = areaCanonicaCEA(area);
  return own === target || Boolean(matricula && own.startsWith('hum-') && target === 'hum-humanistica');
}

function exigirCEA(condition, message, code) {
  if (!condition) {
    const error = new Error(message);
    error.code = code || 'VALIDACION';
    throw error;
  }
}

function datosPeticionCEA(e) {
  let data = e && e.parameter || {};
  if (e && e.postData && e.postData.contents) data = JSON.parse(e.postData.contents);
  if (typeof data.payload === 'string') data = JSON.parse(data.payload);
  exigirCEA(data && typeof data.action === 'string', 'Falta la operación solicitada.');
  return data;
}

function areaCuentaDocenteCEA(ss, row) {
  const key = String(row[0]).trim();
  if (row[4]) return areaCanonicaCEA(row[4]);
  const texts = ss.getSheetByName('Director_y_Textos');
  const config = texts && texts.getDataRange().getValues().find(item => item[0] === 'config_global_cea_json');
  try {
    const asignaciones = config && JSON.parse(config[1]).cea_docentes_asignaciones;
    if (asignaciones && asignaciones[key] && asignaciones[key].asigKey) return areaCanonicaCEA(asignaciones[key].asigKey);
  } catch (error) {}
  return areaCanonicaCEA(key);
}

function usuarioCanonicoCEA(value) {
  return String(value == null ? '' : value).normalize('NFC').trim().toLowerCase();
}

function sesionCEA(token) {
  const auth = validarTokenSeguro(token);
  exigirCEA(auth, 'La sesión venció. Ingresa nuevamente.', 'SESION');
  const ss = obtenerSpreadsheetPrincipal();
  if (auth.r === 'director') {
    const sheet = ss.getSheetByName('Director_y_Textos');
    const values = sheet ? sheet.getDataRange().getDisplayValues() : [];
    const user = values.find(row => row[0] === 'director_usuario');
    const pass = values.find(row => row[0] === 'director_contrasena');
    exigirCEA(user && pass && usuarioCanonicoCEA(user[1]) === auth.u && auth.v === hashCEA(pass[1]), 'La cuenta cambió. Ingresa nuevamente.', 'SESION');
  } else {
    const sheet = ss.getSheetByName('Usuarios_Docentes');
    const rows = sheet ? sheet.getDataRange().getDisplayValues() : [];
    const row = rows.slice(1).find(item => usuarioCanonicoCEA(item[1]) === auth.u && String(item[0]).trim() === (auth.cuentaKey || auth.areaKey) && hashCEA(item[2]) === auth.v);
    exigirCEA(row && auth.v === hashCEA(row[2]), 'La cuenta cambió. Ingresa nuevamente.', 'SESION');
    exigirCEA(areaCuentaDocenteCEA(ss, row) === auth.areaKey, 'La asignación cambió. Ingresa nuevamente.', 'SESION');
    auth.comision = /^(SI|TRUE)$/i.test(String(row[3]).trim());
  }
  return auth;
}

function migrarClaveAccesoCEA(sheet, row, column, password, stored) {
  stored = String(stored);
  if (stored.startsWith('cea$')) return stored;
  // La migración es opcional: una escritura en curso no impide ingresar.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(0)) return stored;
  try {
    const cell = sheet.getRange(row, column);
    const current = cell.getDisplayValues()[0][0];
    exigirCEA(comprobarClaveCEA(password, current), 'Usuario o contraseña incorrectos.', 'CREDENCIALES');
    if (String(current).startsWith('cea$')) return String(current);
    const encoded = codificarClaveCEA(password);
    if (sheet.getName() === 'Usuarios_Docentes') {
      sheet.getRange(1, 6).setValue('Clave_Docente');
      sheet.getRange(row, 6).setNumberFormat('@').setValue(password);
    }
    cell.setValue(encoded);
    return encoded;
  } finally {
    lock.releaseLock();
  }
}

function iniciarSesionCEA(ss, data) {
  const user = usuarioCanonicoCEA(data.user);
  const password = String(data.pass || '').trim();
  exigirCEA(user && password, 'Ingresa usuario y contraseña.');
  const texts = ss.getSheetByName('Director_y_Textos');
  const values = texts ? texts.getDataRange().getDisplayValues() : [];
  const userRow = values.findIndex(row => row[0] === 'director_usuario');
  const passRow = values.findIndex(row => row[0] === 'director_contrasena');
  if (userRow >= 0 && passRow >= 0 && usuarioCanonicoCEA(values[userRow][1]) === user && comprobarClaveCEA(password, values[passRow][1])) {
    const stored = migrarClaveAccesoCEA(texts, passRow + 1, 2, password, values[passRow][1]);
    CacheService.getScriptCache().put('login_' + user, '0', 60);
    return {status: 'success', role: 'director', user: user, name: 'Dirección', token: generarTokenSeguro(user, 'director', '', hashCEA(stored))};
  }
  const users = ss.getSheetByName('Usuarios_Docentes');
  const rows = users ? users.getDataRange().getDisplayValues() : [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (usuarioCanonicoCEA(row[1]) !== user || !comprobarClaveCEA(password, row[2])) continue;
    const stored = migrarClaveAccesoCEA(users, i + 1, 3, password, row[2]);
    CacheService.getScriptCache().put('login_' + user, '0', 60);
    const teachers = ss.getSheetByName('Docentes');
    const teacher = teachers && teachers.getDataRange().getValues().find(item => String(item[0]) === String(row[0]).trim());
    return {status: 'success', role: 'docente', user: user, areaKey: areaCuentaDocenteCEA(ss, row), name: teacher ? teacher[1] : user, comision: String(row[3]).toUpperCase() === 'SI', token: generarTokenSeguro(user, 'docente', areaCuentaDocenteCEA(ss, row), hashCEA(stored), String(row[0]).trim())};
  }
  const intentosPermitidos = verificarRateLimit('login_' + user, 5, 60);
  exigirCEA(false, 'Usuario o contraseña incorrectos. Revisa tus datos.', intentosPermitidos ? 'CREDENCIALES' : 'INTENTOS');
}

function clavePrivadaCEA(key) {
  return /contrasena|password|credencial|usuarios|session|token|kardex|inscrip|afiliacion|padron|registro_estudiantes|papelera|calif|subidas|auditoria|mensajes_contacto/i.test(key);
}

function filtrarDatosCEA(data, auth, precargarCriterios = false) {
  const texts = {};
  Object.keys(data.textos).forEach(key => {
    if (key === 'config_global_cea_json') {
      try {
        const source = JSON.parse(data.textos[key]);
        const clean = {};
        Object.keys(source).forEach(k => { if (!clavePrivadaCEA(k)) clean[k] = source[k]; });
        texts[key] = JSON.stringify(clean);
      } catch (error) {}
    } else if (!/director_usuario|director_contrasena|registro_estudiantes_json|padron_afiliacion|papelera_estudiantes_json/.test(key)) {
      texts[key] = data.textos[key];
    }
  });
  data.textos = texts;
  Object.keys(data.usuariosDocentes || {}).forEach(key => { data.usuariosDocentes[key].pass = ''; });
  if (!auth) {
    ['usuariosDocentes', 'kardexDocentes', 'inscripciones', 'registroEstudiantes', 'padronAfiliacion', 'papeleraEstudiantes', 'calificacionesRegistros', 'calificacionesDetalles', 'controlSubidaCentralizadores', 'controlSubidaEstudiantes'].forEach(key => delete data[key]);
    return data;
  }
  data.registroEstudiantes = data.registroEstudiantes.filter(est => permisoAreaCEA(auth, est.areaKey, true));
  data.padronAfiliacion = data.registroEstudiantes;
  data.papeleraEstudiantes = data.papeleraEstudiantes.filter(est => permisoAreaCEA(auth, est.areaKey, true));
  data.papeleraEstudiantes.forEach(est => {
    if (!est.calificacionesPapelera?.criterios) return;
    const cuenta=auth.cuentaKey || auth.areaKey;
    est.calificacionesPapelera.criterios=Object.fromEntries(Object.entries(est.calificacionesPapelera.criterios).map(([nombre,filas])=>[nombre, auth.r === 'docente' ? filas.filter(f=>String(f[1])===cuenta) : []]));
  });
  data.calificacionesRegistros = data.calificacionesRegistros.filter(reg => permisoAreaCEA(auth, reg.areaKey, false));
  const ids = new Set(data.calificacionesRegistros.map(reg => reg.id));
  data.calificacionesDetalles = data.calificacionesDetalles.filter(det => ids.has(det.idRegistro));
  const ss = obtenerSpreadsheetPrincipal();
  const versiones = versionesNotasCEA(ss);
  data.calificacionesRegistros.forEach(reg => { reg.version = versiones.get(String(reg.id)) || null; });
  if (precargarCriterios && auth.r === 'docente') {
    const cuenta = auth.cuentaKey || auth.areaKey, tablas = {};
    for (const nombre of ['Criterios_Configuracion','Criterios_Definiciones','Criterios_Notas','Criterios_Resultados']) {
      const porRegistro = tablas[nombre] = new Map();
      for (const fila of ss.getSheetByName(nombre)?.getDataRange().getValues().slice(1) || []) {
        const id = String(fila[0]);
        if (String(fila[1]) !== cuenta || !ids.has(id)) continue;
        if (!porRegistro.has(id)) porRegistro.set(id, []);
        porRegistro.get(id).push(fila);
      }
    }
    data.criteriosEvaluaciones = data.calificacionesRegistros.map(reg => leerCriteriosEvaluacionCEA(ss, reg.id, auth, tablas));
  }
  const estadosBoletin = ss.getSheetByName('Estados_Boletin');
  data.estadosBoletin = Object.fromEntries((estadosBoletin?.getDataRange().getValues().slice(1) || [])
    .filter(row => permisoAreaCEA(auth, row[1], false)).map(row => [String(row[0]), String(row[2])]));
  data._revisions = revisionesCEA(ss);
  data.nominaRespaldo = leerRespaldoNominaCEA(ss).filter(est => permisoAreaCEA(auth, est.areaKey, true));
  if (auth.r === 'director') {
    data.mensajesContacto = leerMensajesCEA(ss);
  } else {
    delete data.inscripciones;
    const ownKardex = data.kardexDocentes[auth.areaKey];
    data.kardexDocentes = ownKardex ? {[auth.areaKey]: ownKardex} : {};
    data.usuariosDocentes = {[auth.areaKey]: data.usuariosDocentes[auth.cuentaKey || auth.areaKey] || {user: auth.u, pass: '', comision: auth.comision}};
    Object.keys(data.controlSubidaCentralizadores).forEach(key => {
      if (!permisoAreaCEA(auth, data.controlSubidaCentralizadores[key].carreraKey, false)) delete data.controlSubidaCentralizadores[key];
    });
    const subidas = ss.getSheetByName('Control_Subida_Estudiantes');
    const allowed = new Set(subidas ? subidas.getDataRange().getValues().slice(1).filter(row => permisoAreaCEA(auth, row[1], false)).map(row => String(row[0])) : []);
    Object.keys(data.controlSubidaEstudiantes).forEach(key => { if (!allowed.has(key)) delete data.controlSubidaEstudiantes[key]; });
  }
  return data;
}

function doGet(e) {
  // Las consultas públicas nunca aceptan un token por URL.
  return leerDatosCEA(null);
}

const CEA_COLECCIONES = {
  'guardar-carreras': 'Carreras_Tecnicas', 'guardar-materias': 'Materias_Humanistica',
  'guardar-horarios': 'Horarios', 'guardar-calendario': 'Calendario_Academico',
  'guardar-epja-niveles': 'Niveles_EPJA', 'guardar-humanistica-malla': 'Malla_Humanistica',
  'guardar-documentos-dinamicos': 'Documentos', 'guardar-documentos': 'Documentos', 'guardar-documentos-oficiales': 'Documentos',
  'guardar-horarios-matriz': 'Horarios_Matriz', 'guardar-paralelos': 'ParalelosCEA'
};

function versionHojaCEA(ss, name) {
  if (name === 'ParalelosCEA') {
    const sheet = ss.getSheetByName('Director_y_Textos');
    const row = sheet && sheet.getDataRange().getValues().find(item => item[0] === 'cea_calificaciones_paralelos_config');
    return hashCEA(row ? row[1] : '');
  }
  const sheet = ss.getSheetByName(name);
  return hashCEA(sheet ? sheet.getDataRange().getValues() : []);
}

function revisionesCEA(ss) {
  const result = {};
  Object.values(CEA_COLECCIONES).forEach(name => { result[name] = versionHojaCEA(ss, name); });
  return result;
}

function versionesNotasCEA(ss) {
  const registros = ss.getSheetByName('Calificaciones_Registros');
  const detalle = ss.getSheetByName('Calificaciones_Detalle');
  const porRegistro = new Map();
  if (detalle) {
    detalle.getDataRange().getValues().slice(1).forEach(row => {
      const id = String(row[1]);
      if (!porRegistro.has(id)) porRegistro.set(id, []);
      porRegistro.get(id).push(row);
    });
  }
  const versiones = new Map();
  if (registros) {
    registros.getDataRange().getValues().slice(1).forEach(row => {
      const id = String(row[0]);
      if (!versiones.has(id)) versiones.set(id, hashCEA([row, porRegistro.get(id) || []]));
    });
  }
  return versiones;
}

function versionNotasCEA(ss, id) {
  const regs = ss.getSheetByName('Calificaciones_Registros');
  const details = ss.getSheetByName('Calificaciones_Detalle');
  const row = regs && regs.getDataRange().getValues().slice(1).find(item => String(item[0]) === id);
  if (!row) return null;
  return hashCEA([row, details ? details.getDataRange().getValues().slice(1).filter(item => String(item[1]) === id) : []]);
}

function autorizarOperacionCEA(ss, data, auth) {
  const action = data.action;
  if (action === 'guardar-estado-boletin') return;
  if (action === 'obtener-plantillas-criterios') {
    exigirCEA(auth.r === 'docente', 'Las plantillas de criterios corresponden al docente.', 'PERMISO');
    return;
  }
  if (action === 'obtener-criterios-evaluacion' || data.criteriosEvaluacion) {
    exigirCEA(auth.r === 'docente', 'Los criterios individuales corresponden al modo docente.', 'PERMISO');
    const registro = data.registro || {};
    exigirCEA(registro.id && permisoAreaCEA(auth, registro.areaKey, false), 'Solo puedes gestionar criterios de tu especialidad.', 'PERMISO');
    const fila = ss.getSheetByName('Calificaciones_Registros')?.getDataRange().getValues().slice(1).find(f => String(f[0]) === String(registro.id));
    exigirCEA(!fila || permisoAreaCEA(auth, fila[2], false), 'El registro pertenece a otra especialidad.', 'PERMISO');
    if (fila && data.criteriosEvaluacion) exigirCEA(String(fila[1]) === registro.tipo, 'El tipo de evaluacion no coincide con el registro oficial.');
    if (action === 'obtener-criterios-evaluacion') return;
  }
  if (auth.r === 'director') return;
  if (action === 'guardar-nombre-docente') {
    exigirCEA(auth.r === 'docente' && String(data.areaKey) === auth.areaKey, 'Solo puedes corregir tu propio nombre.', 'PERMISO');
    return;
  }
  if (action === 'habilitar-gestion-academica') return;
  if (action === 'publicar-boletin-curso') {
    exigirCEA(data.areaKey && permisoAreaCEA(auth, data.areaKey, false), 'Solo puedes publicar las notas de tu propia carrera o área.', 'PERMISO');
    return;
  }
  if (action === 'guardar-boletin') {
    exigirCEA(Array.isArray(data.planillas) && data.planillas.length > 0 && data.planillas.length <= 30, 'El boletín no contiene planillas válidas.');
    data.planillas.forEach(planilla => autorizarOperacionCEA(ss, {...planilla, action:'guardar-calificaciones-registro'}, auth));
    return;
  }
  if (action === 'guardar-paralelos') {
    const sheet = ss.getSheetByName('Director_y_Textos');
    const row = sheet && sheet.getDataRange().getValues().find(item => item[0] === 'cea_calificaciones_paralelos_config');
    const current = JSON.parse(row && row[1] || '{}');
    const prefix = 'par_' + auth.areaKey + '_';
    Object.keys(data.paralelos || {}).filter(key => key.startsWith(prefix)).forEach(key => {
      current[key] = data.paralelos[key];
    });
    data.paralelos = current;
    return;
  }
  if (['obtener-datos-privados', 'actualizar-matriculas', 'cambiar-credenciales-docente', 'registrar-auditoria-calificaciones'].includes(action)) return;
  if (action === 'guardar-calificaciones-registro' || action === 'cambiar-estado-calificaciones') {
    const id = String(data.idRegistro || data.registro && data.registro.id || '');
    const sheet = ss.getSheetByName('Calificaciones_Registros');
    const row = sheet && sheet.getDataRange().getValues().find(item => String(item[0]) === id);
    exigirCEA(permisoAreaCEA(auth, row ? row[2] : data.registro && data.registro.areaKey, false), 'Este registro pertenece a otra área.', 'PERMISO');
    if (data.registro) {
      exigirCEA(permisoAreaCEA(auth, data.registro.areaKey, false), 'No puedes trasladar registros a otra área.', 'PERMISO');
    }
    return;
  }
  if(['obtener-traslado-notas','trasladar-notas-modulo'].includes(action)){
    const fila=ss.getSheetByName('Calificaciones_Registros')?.getDataRange().getValues().slice(1).find(f=>String(f[0])===String(data.idRegistro));
    exigirCEA(fila,'No se encontró el registro de origen en el servidor. Guarda las notas de ese módulo y vuelve a intentar.','REGISTRO_NO_GUARDADO');
    exigirCEA(permisoAreaCEA(auth,fila[2],false),'Solo puedes trasladar notas de tu especialidad.','PERMISO');return;
  }
  const scoped = {'guardar-perfil-especialidad': data.areaKey, 'guardar-malla': data.carreraKey, 'guardar-doc-niveles': data.carreraKey, 'guardar-foto-carrera': data.key || data.carreraKey, 'guardar-kardex': data.docenteId};
  if (Object.prototype.hasOwnProperty.call(scoped, action)) {
    exigirCEA(permisoAreaCEA(auth, scoped[action], false), 'Solo puedes modificar tu propia área.', 'PERMISO');
    return;
  }
  if (action === 'guardar-docentes' || action === 'guardar-docentes-completo') {
    data.docentes = {[auth.areaKey]: data.docentes && data.docentes[auth.areaKey]};
    delete data.carreras;
    delete data.carrerasDocentes;
    delete data.usuarios;
    return;
  }
  if (action === 'guardar-carreras') {
    const sheet = ss.getSheetByName('Carreras_Tecnicas');
    const current = sheet ? sheet.getDataRange().getValues().slice(1) : [];
    const own = (data.carreras || []).find(item => permisoAreaCEA(auth, item.key, false));
    exigirCEA(own, 'No se encontró tu carrera.', 'PERMISO');
    data.carreras = current.map(row => ({key: row[0], nombre: row[1], docente: row[2], color: row[3], resumen: permisoAreaCEA(auth, row[0], false) ? own.resumen : row[4], foto: row[5]}));
    return;
  }
  if (['guardar-actividad', 'eliminar-actividad', 'guardar-foto-galeria', 'eliminar-foto-galeria'].includes(action)) {
    const activity = action.includes('actividad');
    const sheet = ss.getSheetByName(activity ? 'Actividades' : 'Galeria_Fotos');
    const item = activity ? data.actividad : data.foto;
    const id = String(item && item.id || data.id || '');
    const old = sheet && sheet.getDataRange().getValues().slice(1).find(row => String(row[0]) === id);
    const teachers = ss.getSheetByName('Docentes');
    const teacher = teachers && teachers.getDataRange().getValues().find(row => String(row[0]) === auth.areaKey);
    const oldAuthor = old && String(old[8] || '');
    const owned = oldAuthor === 'Docente: ' + auth.areaKey || (teacher && oldAuthor === 'Docente: ' + teacher[1]);
    exigirCEA(!old || owned, 'Solo puedes editar tus propias publicaciones.', 'PERMISO');
    if (item) {
      item.autor = 'Docente: ' + auth.areaKey;
      if (!activity) item.carreraKey = auth.areaKey;
    }
    return;
  }
  // La comision tambien puede administrar los documentos institucionales de Inicio.
  if (auth.comision && ['guardar-documentos-dinamicos', 'guardar-documentos', 'guardar-documentos-oficiales', 'guardar-drive'].includes(action)) return;
  if (auth.comision && action === 'guardar-contenido-vivo' && data.key === 'documentos_oficiales_dinamicos_json') return;
  // La comisión conserva la gestión del horario institucional.
  if (auth.comision && ['guardar-horarios-matriz', 'guardar-gestor-config', 'guardar-turnos-dias-hum', 'guardar-turnos-dias-tec', 'guardar-sedes-lista', 'guardar-bth-carrera', 'guardar-bth-modulos', 'guardar-bth-filas', 'guardar-color-materia'].includes(action)) return;
  throw Object.assign(new Error('Esta operación requiere una cuenta de Dirección.'), {code: 'PERMISO'});
}

function leerMensajesCEA(ss) {
  const sheet = ss.getSheetByName('Contacto');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).filter(row => row[3] || row[6]).map((row, index) => ({id: String(row[7] || 'MSG-' + hashCEA([row.slice(0, 7), index])), fecha: String(row[2]), nombre: String(row[3]), contacto: String(row[4]), asunto: String(row[5]), mensaje: String(row[6]), leido: row[8] === true || row[8] === 'SI'}));
}

function doPost(e) {
  let lock;
  let hojasDeGuardado = null;
  const esHojaDeGuardado = sheet => hojasDeGuardado
    ? hojasDeGuardado.includes(sheet.getName())
    : !sheet.getName().startsWith('_CEA_');
  let backups;
  let ss;
  try {
    const data = datosPeticionCEA(e);
    const accesoOLectura = ['login', 'obtener-datos-privados', 'obtenerInscripciones', 'obtener-usuarios-docentes-admin'].includes(data.action);
    if (!accesoOLectura) {
      lock = LockService.getScriptLock();
      exigirCEA(lock.tryLock(5000), 'Otra operación sigue en curso. Intenta nuevamente.', 'OCUPADO');
    }
    ss = obtenerSpreadsheetPrincipal();
    const auth = CEA_ACCIONES_PUBLICAS.includes(data.action) ? null : sesionCEA(data.token);
    if (auth) autorizarOperacionCEA(ss, data, auth);
    depurarDocentesEliminadosCEA(ss, data);
    if (data.action === 'login') return responseJSON(iniciarSesionCEA(ss, data));
    if (data.action === 'guardar-estado-boletin') {
      const clave = String(data.clave || '');
      let partes;
      try { partes = JSON.parse(clave); } catch (_) {}
      exigirCEA(Array.isArray(partes) && partes.length === 6 &&
        partes.every(v => typeof v === 'string' && v.length > 0 && v.length <= 250) &&
        JSON.stringify(partes) === clave && /^[a-z0-9_-]+$/i.test(partes[0]), 'El estudiante o curso no es válido.');
      exigirCEA(auth.r === 'director' || (auth.r === 'docente' && permisoAreaCEA(auth, partes[0], false)),
        'Solo puedes cambiar el estado de tu especialidad o asignatura.', 'PERMISO');
      const estado = data.estado;
      exigirCEA(['', '-', 'PENDIENTE', 'APROBADO', 'REPROBADO', 'PROMOVIDO EXCELENTE',
        'PROMOVIDO', 'POSTERGADO', 'RETIRADO'].includes(estado), 'Selecciona un estado válido.');
      const hoja = ss.getSheetByName('Estados_Boletin') || ss.insertSheet('Estados_Boletin');
      if (!hoja.getLastRow()) hoja.appendRow(['Clave', 'Área', 'Estado']);
      const fila = hoja.getDataRange().getValues().findIndex((row, i) => i > 0 && row[0] === clave);
      if (fila >= 0) hoja.getRange(fila + 1, 3).setValue(estado);
      else if (estado) hoja.appendRow([clave, partes[0], estado]);
      SpreadsheetApp.flush();
      return responseJSON({status:'success', clave, estado});
    }
    if (data.action === 'obtener-datos-privados') return leerDatosCEA(auth, true);
    if (data.action === 'obtener-criterios-evaluacion') return responseJSON({status:'success', criteriosEvaluacion:leerCriteriosEvaluacionCEA(ss, data.registro.id, auth)});
    if (data.action === 'obtener-plantillas-criterios') {
      const cuenta=auth.cuentaKey || auth.areaKey;
      const registros=new Set(ss.getSheetByName('Calificaciones_Registros')?.getDataRange().getValues().slice(1).filter(f=>permisoAreaCEA(auth,f[2],false)).map(f=>String(f[0])) || []);
      const plantillas=(ss.getSheetByName('Criterios_Configuracion')?.getDataRange().getValues().slice(1) || [])
        .filter(f=>String(f[1])===cuenta && registros.has(String(f[0])))
        .map(f=>({id:String(f[0]),areaKey:String(f[5]),gestion:String(f[6]),semestre:String(f[7]),nivel:String(f[8]),paralelo:String(f[9]),modulo:String(f[10])}));
      return responseJSON({status:'success',plantillas});
    }
    if (data.action === 'guardar-nombre-docente') return responseJSON(guardarNombreDocenteCEA(ss, data, auth));
    if (data.action === 'guardar-perfil-especialidad') return responseJSON(guardarPerfilEspecialidadCEA(ss, data, auth));
    if (data.action === 'cambiar-estado-calificaciones' && data.nuevoEstado === 'PUBLICADO') {
      const fila = ss.getSheetByName('Calificaciones_Registros')?.getDataRange().getValues().slice(1).find(f => String(f[0]) === String(data.idRegistro));
      exigirCEA(fila, 'No se encontró el registro que deseas publicar.');
      return responseJSON(publicarBoletinCursoCEA(ss, {areaKey:fila[2],nivel:fila[4],gestion:String(fila[8]),semestre:fila[7],paralelo:fila[9] || 'A',idRegistro:String(fila[0])}, auth));
    }
    if (data.action === 'obtenerInscripciones') return responseJSON({status: 'success', inscripciones: JSON.parse(leerDatosCEA(auth).getContent()).data.inscripciones});
    if (data.action === 'actualizar-matriculas') return responseJSON(actualizarMatriculasCEA(ss, data, auth));
    exigirCEA(!['guardar-registro-estudiantes', 'guardar-padron-afiliacion', 'guardar-papelera-estudiantes', 'guardar-todas-inscripciones'].includes(data.action), 'Actualiza la página antes de modificar la nómina.', 'VERSION');
    if (data.action === 'cambiar-credenciales-docente' || data.action === 'guardar-credenciales-director') return responseJSON(cambiarClaveCEA(ss, data, auth));
    if (data.action === 'confirmar-inscripcion') return responseJSON(confirmarInscripcionCEA(ss, data, auth));
    if (data.action === 'eliminar-inscripcion') return responseJSON(eliminarInscripcionCEA(ss, data));
    if (data.action === 'gestionar-mensajes') return responseJSON(gestionarMensajesCEA(ss, data));
    if (data.action === 'obtener-usuarios-docentes-admin') {
      const sheet = ss.getSheetByName('Usuarios_Docentes');
      const usuarios = {};
      if (sheet) sheet.getDataRange().getDisplayValues().slice(1).forEach(row => { usuarios[String(row[0]).trim()] = {user: String(row[1]).trim(), pass: claveVisibleDocenteCEA(row), asigKey: String(row[4] || row[0]).trim(), comision: /^(SI|TRUE)$/i.test(String(row[3]).trim())}; });
      return responseJSON({status: 'success', usuarios: usuarios});
    }
    // Reintentos con el mismo identificador no vuelven a insertar formularios.
    const operationId = String(data.requestId || '');
    const cache = CacheService.getScriptCache();
    const cacheKey = 'op_' + hashCEA([auth && auth.u, data.action, operationId]);
    if (operationId && cache.get(cacheKey)) {
      const confirmado=JSON.parse(cache.get(cacheKey));
      if (confirmado.criteriosGuardados) {
        const datos=JSON.parse(leerDatosCEA(auth).getContent()).data;
        return responseJSON({status:'success',version:versionNotasCEA(ss,confirmado.idRegistro),detalles:datos.calificacionesDetalles.filter(d=>String(d.idRegistro)===confirmado.idRegistro),criteriosEvaluacion:leerCriteriosEvaluacionCEA(ss,confirmado.idRegistro,auth)});
      }
      if(confirmado.boletinGuardado){const datos=JSON.parse(leerDatosCEA(auth).getContent()).data;return responseJSON({status:'success',confirmadas:confirmado.boletinGuardado.map(id=>({id,detalles:datos.calificacionesDetalles.filter(d=>String(d.idRegistro)===id)}))});}
      return responseJSON(confirmado);
    }
    const collection = CEA_COLECCIONES[data.action];
    if (data.action === 'cambiar-estado-calificaciones') exigirCEA(['BORRADOR', 'EN EDICION', 'FINALIZADO', 'PUBLICADO', 'ARCHIVADO'].includes(data.nuevoEstado), 'Estado inválido.');
    if (collection) exigirCEA(data.baseVersion === versionHojaCEA(ss, collection), 'Estos datos cambiaron en otra sesión. Recarga antes de guardar.', 'CONFLICTO');
    const guardarBoletin = data.action === 'guardar-boletin';
    if (guardarBoletin) {
      exigirCEA(Array.isArray(data.planillas) && data.planillas.length > 0 && data.planillas.length <= 30, 'El boletín no contiene planillas válidas.');
      const ids = new Set();
      for (const planilla of data.planillas) {
        exigirCEA(planilla?.registro?.id && !ids.has(planilla.registro.id) &&
          Array.isArray(planilla.cambiosNotas) && planilla.cambiosNotas.length, 'Hay una planilla inválida o repetida.');
        ids.add(planilla.registro.id);
        prepararNotasCEA(ss, planilla, auth);
      }
    }
    let criteriosPreparados = null;
    if (data.action === 'guardar-calificaciones-registro') {
      prepararNotasCEA(ss, data, auth);
      if (data.criteriosEvaluacion) {
        criteriosPreparados = prepararCriteriosEvaluacionCEA(ss, data, auth);
        prepararNotasCEA(ss, data, auth);
      }
    }
    const ajustesCriterios = guardarBoletin ? data.planillas.map(p=>({data:p,ajustes:sincronizarPromediosCriteriosCEA(ss,p,null,auth)})) : data.action === 'guardar-calificaciones-registro' ? [{data,ajustes:sincronizarPromediosCriteriosCEA(ss,data,criteriosPreparados,auth)}] : [];
    if (data.action === 'registrar-auditoria-calificaciones') {
      data.usuario = auth.u;
      data.rol = auth.r;
      data.fechaHora = new Date().toISOString();
    }
    // Estado y bloqueo se aplican sobre el registro actual bajo el bloqueo del servidor.
    // Una versión antigua del navegador no impide estas operaciones autorizadas.
    if (data.action === 'guardar-contenido-vivo' && data.key === 'config_global_cea_json') {
      const cfg = JSON.parse(data.valor || '{}');
      Object.keys(cfg).forEach(key => { if (clavePrivadaCEA(key)) delete cfg[key]; });
      data.valor = JSON.stringify(cfg);
      data.htmlValor = data.valor;
    }
    if (['pre-inscripcion', 'contacto'].includes(data.action)) exigirCEA(String(data.nombre || '').trim() && (data.action === 'contacto' ? String(data.mensaje || '').trim() : String(data.ci || '').trim()), 'Completa los campos obligatorios.');
    const readOnly = data.action.startsWith('obtener') || data.action.startsWith('consultar') || data.action === 'verificar-qr-inscripcion';
    hojasDeGuardado = data.action==='trasladar-notas-modulo'?['Calificaciones_Registros','Calificaciones_Detalle','Traslados_Notas'].concat(Object.keys(TABLAS_CRITERIOS_CEA)) : guardarBoletin || data.action === 'guardar-calificaciones-registro'
      ? ['Calificaciones_Registros', 'Calificaciones_Detalle'].concat(criteriosPreparados || ajustesCriterios.some(p=>p.ajustes.length) ? Object.keys(TABLAS_CRITERIOS_CEA) : [])
      : ['guardar-docentes','guardar-docentes-completo','eliminar-docente'].includes(data.action)?['Docentes','Usuarios_Docentes','Carreras_Tecnicas','Materias_Humanistica','Director_y_Textos','Docentes_Eliminados']
      : data.action==='guardar-malla'?['Mallas_Curriculares','Calificaciones_Registros']
      : data.action === 'registrar-auditoria-calificaciones' ? ['Calificaciones_Auditoria'] : null;
    if(criteriosPreparados?.eliminados?.length&&hojasDeGuardado)hojasDeGuardado.push('Papelera_Matriculas');
    if (!readOnly && data.action !== 'visita') {
      backups = ss.getSheets().filter(esHojaDeGuardado).map(sheet => {
        const range = sheet.getDataRange();
        const rows = range.getValues();
        const formulas = typeof range.getFormulas === 'function' ? range.getFormulas() : [];
        return {name: sheet.getName(), rows: rows.map((row, index) => row.map((cell, col) => formulas[index]?.[col] || cell)), version: hashCEA(rows)};
      });
    }
    if (guardarBoletin) {
      const confirmadas = [];
      for (const planilla of data.planillas) {
        const payload = {...planilla, action: 'guardar-calificaciones-registro'};
        const respuesta = JSON.parse(procesarSolicitudCEA({postData: {contents: JSON.stringify(payload)}}, auth).getContent());
        exigirCEA(respuesta.status === 'success', respuesta.message || 'No se pudo guardar una planilla del boletín.');
        confirmadas.push({id: planilla.registro.id, detalles: planilla.detalles, fechaModificacion: new Date().toISOString()});
      }
      for(const p of ajustesCriterios)for(const ajuste of p.ajustes)persistirCriteriosEvaluacionCEA(ss,ajuste.preparado,p.data,ajuste.auth);
      SpreadsheetApp.flush();
      if(operationId)cache.put(cacheKey,JSON.stringify({boletinGuardado:confirmadas.map(p=>String(p.id))}),21600);
      backups = null;
      return responseJSON({status: 'success', confirmadas});
    }
    const result=data.action==='obtener-traslado-notas'?prepararTrasladoNotasCEA(ss,data,auth).vista:data.action==='trasladar-notas-modulo'?trasladarNotasModuloCEA(ss,data,auth):JSON.parse(procesarSolicitudCEA({postData:{contents:JSON.stringify(data)}},auth).getContent());
    exigirCEA(result.status === 'success' || result.status === 'not_found', result.message || 'El servidor rechazó el guardado.');
    if (criteriosPreparados) {
      persistirCriteriosEvaluacionCEA(ss, criteriosPreparados, data, auth);
      result.criteriosEvaluacion = leerCriteriosEvaluacionCEA(ss, data.registro.id, auth);
    }
    for(const p of ajustesCriterios)for(const ajuste of p.ajustes)persistirCriteriosEvaluacionCEA(ss,ajuste.preparado,p.data,ajuste.auth);
    if (result.inscripcion && CEA_ACCIONES_PUBLICAS.includes(data.action)) {
      ['fechaNacimiento', 'telefono', 'observaciones', 'detalleExcepcion', 'comunidad'].forEach(key => delete result.inscripcion[key]);
    }
    if (data.action === 'contacto') {
      const sheet = ss.getSheetByName('Contacto');
      sheet.getRange(1, 8, 1, 2).setValues([['ID', 'Leido']]);
      sheet.getRange(sheet.getLastRow(), 8, 1, 2).setValues([[data.id || Utilities.getUuid(), false]]);
    }
    if (data.action === 'pre-inscripcion') {
      const sheet = ss.getSheetByName('Inscripciones');
      result.id = Utilities.getUuid();
      sheet.getRange(1, 16).setValue('ID_Inscripcion');
      sheet.getRange(sheet.getLastRow(), 16).setValue(result.id);
    }
    SpreadsheetApp.flush();
    if (['guardar-docentes', 'guardar-docentes-completo'].includes(data.action)) {
      const filas = ss.getSheetByName('Docentes').getDataRange().getValues().slice(1);
      const confirmados = {};
      Object.entries(data.docentes || {}).forEach(([codigo, nombre]) => {
        const fila = filas.find(f => String(f[0]).trim().toLowerCase() === String(codigo).trim().toLowerCase());
        exigirCEA(fila && String(fila[1]) === String(nombre), 'No se confirmó el nombre del docente. Conserva los cambios y vuelve a guardar.');
        confirmados[codigo] = String(fila[1]);
      });
      result.docentesConfirmados = confirmados;
      const filasUsuarios=ss.getSheetByName('Usuarios_Docentes')?.getDataRange().getValues().slice(1)||[];
      result.usuariosConfirmados={};
      for(const codigo of Object.keys(data.usuarios||{})){const fila=filasUsuarios.find(r=>String(r[0]).trim()===codigo),item=data.usuarios[codigo];exigirCEA(fila&&(!item.user||String(fila[1])===String(item.user))&&(!item.asigKey||String(fila[4])===String(item.asigKey)),'No se confirmó la asignación o el usuario del docente.');result.usuariosConfirmados[codigo]={user:String(fila[1]),asigKey:String(fila[4]||codigo),comision:/^(SI|TRUE)$/i.test(String(fila[3])),pass:''};}

    }
    if (data.action.includes('calificaciones') && (data.idRegistro || data.registro)) result.version = versionNotasCEA(ss, String(data.idRegistro || data.registro.id));
    if (Array.isArray(data.cambiosNotas) && data.action === 'guardar-calificaciones-registro') result.detalles = data.detalles;
    if (collection) result.collectionVersion = versionHojaCEA(ss, collection);
    if (operationId && result.status === 'success') cache.put(cacheKey, JSON.stringify(criteriosPreparados ? {criteriosGuardados:true,idRegistro:String(data.registro.id)} : result), 21600);
    backups = null;
    return responseJSON(result);
  } catch (error) {
    if (backups && ss) {
      try {
        const names = new Set(backups.map(item => item.name));
        ss.getSheets().filter(sheet => esHojaDeGuardado(sheet) && !names.has(sheet.getName())).forEach(sheet => ss.deleteSheet(sheet));
        backups.forEach(item => {
          if (versionHojaCEA(ss, item.name) !== item.version) escribirTablaCEA(ss, item.name, item.rows);
        });
        SpreadsheetApp.flush();
      } catch (rollbackError) {
        return responseJSON({status: 'error', code: 'RECUPERACION', message: 'La escritura falló y necesita revisión en Sheets. Conserva esta pantalla y revisa el historial de versiones.'});
      }
    }
    return responseJSON({status: 'error', code: error.code || 'SERVIDOR', message: error.message || String(error)});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function escribirTablaCEA(ss, name, rows) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const width = Math.max(1, sheet.getLastColumn(), ...rows.map(row => row.length));
  const height = Math.max(1, sheet.getLastRow(), rows.length);
  const matrix = Array.from({length: height}, (_, index) => Array.from({length: width}, (_, col) => rows[index] && rows[index][col] !== undefined ? rows[index][col] : ''));
  if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  if (sheet.getMaxRows() < height) sheet.insertRowsAfter(sheet.getMaxRows(), height - sheet.getMaxRows());
  sheet.getRange(1, 1, height, width).setValues(matrix);
  return sheet;
}

function guardarPerfilEspecialidadCEA(ss, data, auth) {
  const area = areaCanonicaCEA(data.areaKey);
  exigirCEA(auth.r === 'director' || permisoAreaCEA(auth, area, false), 'Solo puedes editar tu propia especialidad.', 'PERMISO');
  const nombre = String(data.nombre || '').trim(), resumen = String(data.resumen || '').trim();
  exigirCEA(nombre && nombre.length <= 180 && resumen.length <= 10000, 'Escribe un nombre válido y una descripción de hasta 10000 caracteres.');
  const textos = ss.getSheetByName('Director_y_Textos');
  const anteriores = textos.getDataRange().getValues();
  const nuevos = anteriores.map(f => f.slice());
  const clave = 'perfil_especialidad_' + area;
  const posicion = nuevos.findIndex(f => f[0] === clave);
  const perfil = {areaKey:area,nombre,resumen};
  if (posicion >= 0) nuevos[posicion][1] = JSON.stringify(perfil);
  else nuevos.push([clave,JSON.stringify(perfil)]);
  const carreras = ss.getSheetByName('Carreras_Tecnicas');
  const filas = carreras ? carreras.getDataRange().getValues() : [];
  const originales = filas.map(f => f.slice());
  const indice = filas.findIndex((f,i) => i > 0 && areaCanonicaCEA(f[0]) === area);
  exigirCEA(!area.startsWith('tec-') || indice > 0, 'No se encontró tu especialidad.');
  if (indice > 0) { filas[indice][1] = nombre; filas[indice][4] = resumen; }
  try {
    escribirTablaCEA(ss, 'Director_y_Textos', nuevos);
    if (indice > 0) escribirTablaCEA(ss, 'Carreras_Tecnicas', filas);
    SpreadsheetApp.flush();
    const guardado = textos.getDataRange().getValues().find(f => f[0] === clave);
    exigirCEA(guardado && guardado[1] === JSON.stringify(perfil), 'No se confirmó el perfil de la especialidad.');
    if (indice > 0) {
      const confirmada = carreras.getDataRange().getValues().find(f => areaCanonicaCEA(f[0]) === area);
      exigirCEA(confirmada && confirmada[1] === nombre && confirmada[4] === resumen, 'No se confirmó el perfil de la especialidad.');
    }
  } catch(error) {
    escribirTablaCEA(ss, 'Director_y_Textos', anteriores);
    if (indice > 0) escribirTablaCEA(ss, 'Carreras_Tecnicas', originales);
    throw error;
  }
  return {status:'success',perfil};
}

function guardarNombreDocenteCEA(ss, data, auth) {
  exigirCEA(auth.r === 'docente' && String(data.areaKey) === auth.areaKey, 'Solo puedes corregir tu propio nombre.', 'PERMISO');
  const nombre = String(data.nombreDocente || '').replace(/\s+/g, ' ').trim();
  exigirCEA(nombre.length >= 2 && nombre.length <= 120, 'Escribe tu nombre completo, entre 2 y 120 caracteres.');
  const cuenta = auth.cuentaKey || auth.areaKey;
  const hoja = ss.getSheetByName('Docentes');
  exigirCEA(hoja, 'No se encontró el registro docente.');
  const filas = hoja.getDataRange().getValues();
  const indice = filas.findIndex((fila,i) => i > 0 && String(fila[0]).trim() === cuenta);
  exigirCEA(indice > 0, 'No se encontró tu registro docente.');
  const anterior = filas[indice][1];
  try {
    hoja.getRange(indice + 1, 2).setValue(nombre);
    SpreadsheetApp.flush();
    exigirCEA(String(hoja.getRange(indice + 1, 2).getValue()) === nombre, 'No se confirmó el nombre. Vuelve a guardar.');
  } catch (error) {
    hoja.getRange(indice + 1, 2).setValue(anterior);
    throw error;
  }
  return {status:'success', perfilActualizado:true, nombreDocente:nombre, cuentaKey:cuenta};
}

function cambiarClaveCEA(ss, data, auth) {
  const director = data.action === 'guardar-credenciales-director';
  const user = String(director ? data.creds && data.creds.user : data.nuevoUsuario).trim().toLowerCase();
  const password = String((director ? data.creds && data.creds.pass : data.nuevaPass) || '').trim();
  exigirCEA(user && user !== 'undefined' && (!director || password), 'Ingresa el usuario y la contraseña nuevos.');
  const cambiarNombre = !director && Object.prototype.hasOwnProperty.call(data, 'nombreDocente');
  const nombre = cambiarNombre ? String(data.nombreDocente || '').replace(/\s+/g, ' ').trim() : '';
  if (cambiarNombre) exigirCEA(nombre.length >= 2 && nombre.length <= 120, 'Escribe tu nombre completo, entre 2 y 120 caracteres.');
  const teachers = ss.getSheetByName('Usuarios_Docentes');
  const rows = teachers ? teachers.getDataRange().getValues() : [];
  const texts = ss.getSheetByName('Director_y_Textos');
  const values = texts.getDataRange().getValues();
  const userIndex = values.findIndex(row => row[0] === 'director_usuario');
  const passIndex = values.findIndex(row => row[0] === 'director_contrasena');
  const area = director ? '' : String(data.areaKey || '');
  const cuenta = auth.r === 'docente' ? (auth.cuentaKey || auth.areaKey) : area;
  exigirCEA(director ? auth.r === 'director' : permisoAreaCEA(auth, area, false), 'No puedes cambiar esta cuenta.', 'PERMISO');
  exigirCEA(!rows.slice(1).some(row => usuarioCanonicoCEA(row[1]) === user && (director || String(row[0]) !== cuenta)), 'Ese nombre de usuario ya existe.');
  if (!director) exigirCEA(userIndex < 0 || usuarioCanonicoCEA(values[userIndex][1]) !== user, 'Ese nombre de usuario ya existe.');
  let stored = password ? codificarClaveCEA(password) : '';
  if (director) {
    exigirCEA(passIndex >= 0 && comprobarClaveCEA(data.passActual, values[passIndex][1]), 'La contraseña actual es incorrecta.');
    values[userIndex][1] = user;
    values[passIndex][1] = stored;
    escribirTablaCEA(ss, 'Director_y_Textos', values);
  } else {
    const index = rows.findIndex((row, i) => i > 0 && String(row[0]) === cuenta);
    exigirCEA(index > 0, 'La cuenta docente no existe.');
    exigirCEA(auth.r === 'director' || comprobarClaveCEA(data.passActual, rows[index][2]), 'La contraseña actual es incorrecta.');
    const docentes = ss.getSheetByName('Docentes');
    const nombres = docentes ? docentes.getDataRange().getValues() : [['Codigo', 'Nombre']];
    const nombresAntes = nombres.map(fila => fila.slice());
    const cuentasAntes = rows.map(fila => fila.slice());
    stored = stored || rows[index][2];
    rows[index][1] = user;
    rows[index][2] = stored;
    if (password) rows[index][5] = password;
    if (cambiarNombre) {
      const posicion = nombres.findIndex((fila, i) => i > 0 && String(fila[0]).trim() === cuenta);
      if (posicion > 0) nombres[posicion][1] = nombre;
      else nombres.push([cuenta, nombre]);
    }
    try {
      escribirTablaCEA(ss, 'Usuarios_Docentes', rows);
      if (cambiarNombre) escribirTablaCEA(ss, 'Docentes', nombres);
      SpreadsheetApp.flush();
    } catch (error) {
      escribirTablaCEA(ss, 'Usuarios_Docentes', cuentasAntes);
      if (cambiarNombre) escribirTablaCEA(ss, 'Docentes', nombresAntes);
      throw error;
    }
  }
  return {status: 'success', user: user, ...(cambiarNombre ? {perfilActualizado: true, nombreDocente: nombre, cuentaKey: cuenta} : {}), token: generarTokenSeguro(user, director ? 'director' : 'docente', area, hashCEA(stored), cuenta)};
}

function estadoInscripcionCEA(fila) {
  const gestion = String(fila[0] || '').trim();
  const inscrito = String(fila[16] || '') === 'INSCRITO';
  return {
    estadoInscripcion: inscrito ? 'INSCRITO' : 'PREINSCRITO',
    fechaConfirmacion: inscrito ? String(fila[17] || '') : '',
    vencimientoCredencial: inscrito && /^\d{4}$/.test(gestion) ? gestion + '-12-31' : ''
  };
}

function confirmarInscripcionCEA(ss, data, auth) {
  exigirCEA(auth?.r === 'director', 'La confirmación corresponde a Dirección.', 'PERMISO');
  exigirCEA(typeof data.inscrito === 'boolean' && data.id, 'Selecciona una preinscripción válida.');
  const hoja = ss.getSheetByName('Inscripciones');
  const filas = hoja ? hoja.getDataRange().getValues() : [];
  const indice = filas.findIndex((fila, i) => i > 0 && fila[3] &&
    String(fila[15] || 'INS-' + hashCEA([fila.slice(0, 15), i])) === String(data.id));
  exigirCEA(indice > 0, 'La preinscripción ya no existe.', 'CONFLICTO');
  const fila = filas[indice];
  exigirCEA(!data.inscrito || /^\d{4}$/.test(String(fila[0]).trim()), 'La preinscripción no tiene una gestión válida.');
  const estado = data.inscrito ? 'INSCRITO' : 'PREINSCRITO';
  const fecha = data.inscrito ? (fila[16] === estado && fila[17] ? fila[17] : new Date().toISOString()) : '';
  hoja.getRange(1, 16, 1, 3).setValues([['ID_Inscripcion', 'Estado_Inscripcion', 'Fecha_Confirmacion']]);
  hoja.getRange(indice + 1, 16, 1, 3).setValues([[String(data.id), estado, fecha]]);
  SpreadsheetApp.flush();
  fila[16] = estado;
  fila[17] = fecha;
  return {status: 'success', id: String(data.id), ...estadoInscripcionCEA(fila)};
}

function eliminarInscripcionCEA(ss, data) {
  exigirCEA(data.id, 'Recarga las inscripciones antes de eliminar.');
  const sheet = ss.getSheetByName('Inscripciones');
  const rows = sheet ? sheet.getDataRange().getValues() : [];
  const index = rows.findIndex((row, i) => i > 0 && String(row[15] || 'INS-' + hashCEA([row.slice(0, 15), i])) === String(data.id));
  if (index < 0) return {status: 'success', deletedCount: 0};
  rows.forEach((row, i) => {
    if (!i) row[15] = 'ID_Inscripcion';
    else if (!row[15]) row[15] = 'INS-' + hashCEA([row.slice(0, 15), i]);
  });
  rows.splice(index, 1);
  escribirTablaCEA(ss, 'Inscripciones', rows);
  return {status: 'success', deletedCount: 1};
}

function gestionarMensajesCEA(ss, data) {
  const sheet = ss.getSheetByName('Contacto');
  if (!sheet) return {status: 'success'};
  const rows = sheet.getDataRange().getValues();
  const ids = new Set(data.ids || []);
  const result = [rows[0].slice(0, 7).concat(['ID', 'Leido'])];
  rows.slice(1).forEach((row, index) => {
    const id = String(row[7] || 'MSG-' + hashCEA([row.slice(0, 7), index]));
    if (ids.has(id) && data.operacion === 'eliminar') return;
    result.push(row.slice(0, 7).concat([id, ids.has(id) ? Boolean(data.leido) : row[8] || false]));
  });
  escribirTablaCEA(ss, 'Contacto', result);
  return {status: 'success'};
}

function nivelNotasCEA(nivel) {
  const valor = String(nivel || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (/especializad/.test(valor)) return 'especializados';
  if (/complementar/.test(valor)) return 'complementarios';
  if (/aplicad/.test(valor)) return 'aplicados';
  if (/avanzad/.test(valor)) return 'auxiliar';
  if (/elemental/.test(valor)) return 'basico';
  if (/basico|elemental|1er/.test(valor)) return 'basico';
  if (/auxiliar|avanzad|2do/.test(valor)) return 'auxiliar';
  if (/medio ii|medio 2|segundo/.test(valor)) return 'medio2';
  if (/medio/.test(valor)) return 'medio1';
  if (/aplicad|3er/.test(valor)) return 'aplicados';
  if (/complementar|4to/.test(valor)) return 'complementarios';
  if (/especializad|5to/.test(valor)) return 'especializados';
  return valor;
}

function nivelHumanisticoOficialCEA(nivel) {
  return {basico: 'Aprendizajes Elementales', auxiliar: 'Aprendizajes Avanzados', aplicados: 'Aprendizajes Aplicados',
    complementarios: 'Aprendizajes Complementarios', especializados: 'Aprendizajes Especializados'}[nivelNotasCEA(nivel)] || String(nivel || '');
}

function combinarCambiosNotasCEA(ss, data) {
  const reg = data.registro;
  const detallesEnviados = data.detalles;
  let matriculas;
  const id = String(reg.id);
  const hojaRegistros = ss.getSheetByName('Calificaciones_Registros');
  const actual = hojaRegistros && hojaRegistros.getDataRange().getValues().slice(1).find(row => String(row[0]) === id);
  const hojaDetalles = ss.getSheetByName('Calificaciones_Detalle');
  const campos = ['id', 'idRegistro', 'nro', 'paterno', 'materno', 'nombres', 'ci', 'rude', 'ser', 'saber', 'decidir', 'proceso', 'producto', 'hacer', 'autoevaluacion', 'notaFinal', 'observacion', 'observacionManual', 'estadoParticipante'];
  if (actual) {
    exigirCEA(String(actual[1]).trim().toLowerCase() === reg.tipo && areaCanonicaCEA(actual[2]) === areaCanonicaCEA(reg.areaKey), 'El registro ya no corresponde a esta área.');
    const estado = String(actual[11] || 'BORRADOR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    Object.assign(reg, {
      carrera: actual[3], nivel: actual[4], modulo: actual[5], docente: actual[6],
      semestre: actual[7], gestion: actual[8], paralelo: actual[9], fecha: actual[10],
      estado: estado === 'BORRADOR' ? 'EN EDICION' : estado
    });
    try {
      reg.criterios = JSON.parse(actual[14] || '[]');
    } catch (error) {
      // Los registros antiguos pueden contener criterios en texto.
    }
    data.detalles = hojaDetalles ? hojaDetalles.getDataRange().getValues().slice(1)
      .filter(row => String(row[1]) === id)
      .map(row => Object.fromEntries(campos.map((campo, i) => [campo, !row[19] && i >= 8 && i <= 14 && String(row[i]) === '0' ? '' : row[i]]))) : [];
  }
  const permitidos = reg.tipo === 'tecnica'
    ? ['ser', 'saber', 'decidir', 'proceso', 'producto', 'autoevaluacion']
    : ['ser', 'saber', 'decidir', 'hacer', 'autoevaluacion'];
  permitidos.push('observacionManual', 'estadoParticipante');
  for (const cambio of data.cambiosNotas) {
    exigirCEA(cambio && permitidos.includes(cambio.campo), 'El campo de calificación no es válido.');
    const coincideIdentidad = item => {
      if (cambio.ci) return String(item.ci || '').trim() === String(cambio.ci).trim();
      if (cambio.rude) return String(item.rude || '').trim() === String(cambio.rude).trim();
      return cambio.id && String(item.id) === String(cambio.id);
    };
    const coincidencias = data.detalles.filter(coincideIdentidad);
    let detalle = coincidencias.find(item => String(item.id) === String(cambio.id));
    if (!detalle && coincidencias.length === 1) detalle = coincidencias[0];
    if (!detalle && !coincidencias.length && actual) {
      const enviado = detallesEnviados.find(coincideIdentidad);
      if (!matriculas) matriculas = leerMatriculasCEA(ss);
      const afiliados = enviado ? matriculas.filter(est => {
        const area = areaCanonicaCEA(reg.areaKey);
        const areaEstudiante = areaCanonicaCEA(est.areaKey);
        const mismaArea = areaEstudiante === area || (reg.tipo === 'humanistica' && areaEstudiante === 'hum-humanistica');
        const identidad = cambio.ci || cambio.rude ? coincideIdentidad(est)
          : enviado.matriculaId && String(enviado.matriculaId) === est.matriculaId;
        return identidad && mismaArea && String(est.estadoMatricula).trim().toUpperCase() !== 'ELIMINADO' &&
          String(est.gestion).trim() === String(reg.gestion).trim() &&
          /2|segundo/i.test(est.semestre) === /2|segundo/i.test(reg.semestre) &&
          String(est.paralelo).trim().toUpperCase() === String(reg.paralelo || 'A').trim().toUpperCase() &&
          nivelNotasCEA(est.nivel) === nivelNotasCEA(reg.nivel);
      }) : [];
      if (afiliados.length === 1) {
        const est = afiliados[0];
        detalle = {
          id: cambio.ci || cambio.rude ? 'DET-' + id + '-' + est.matriculaId : enviado.id, idRegistro: id,
          nro: data.detalles.reduce((max, item) => Math.max(max, Number(item.nro) || 0), 0) + 1,
          paterno: est.paterno, materno: est.materno, nombres: est.nombres || est.nombreCompleto,
          ci: est.ci, rude: est.rude
        };
        data.detalles.push(detalle);
      }
    }
    exigirCEA(detalle, 'No se pudo identificar al estudiante en la nómina oficial de esta planilla.', 'NOMINA');
    detalle[cambio.campo] = cambio.valor;
  }
}

function moduloPlanillaSistemasCEA(area, nivel, id, modulo, codigo) {
  if (areaCanonicaCEA(area) !== 'tec-sis') return null;
  const malla = mallaSistemasCEA([], nivel);
  if (!malla.length) return null;
  const claveId = String(id || '').match(/-(?:m[oó]?dulo|mod)([ivx]+|\d+)-\d{4}-s[12]-p/i)?.[1];
  const numero = numeroModuloSistemasCEA(claveId) || numeroModuloSistemasCEA(codigo) || numeroModuloSistemasCEA(modulo);
  const inicio = numeroModuloSistemasCEA(malla[0][0]);
  const indice = numero >= 1 && numero <= 5 ? numero - 1 : numero - inicio;
  if (indice === 2 || indice === 3) return malla[indice];
  return null;
}

function publicarBoletinCursoCEA(ss, data, auth) {
  exigirCEA(auth && data.areaKey && data.nivel && data.paralelo && /^\d{4}$/.test(String(data.gestion)) && data.semestre, 'Selecciona el curso, paralelo, gestión y semestre que deseas publicar.');
  const area = areaCanonicaCEA(data.areaKey);
  exigirCEA(auth.r === 'director' || permisoAreaCEA(auth, area, false), 'Solo puedes publicar las notas de tu propia área.', 'PERMISO');
  const hoja = ss.getSheetByName('Calificaciones_Registros');
  const detalle = ss.getSheetByName('Calificaciones_Detalle');
  exigirCEA(hoja && detalle, 'Guarda las notas antes de publicarlas.');
  const filas = hoja.getDataRange().getValues();
  const conNotas = new Set(detalle.getDataRange().getValues().slice(1).filter(fila => fila[19] === true || /^(SI|TRUE)$/i.test(String(fila[19])) || fila.slice(8,15).some(valor => valor !== '' && valor != null) || Number(fila[15]) > 0).map(fila => String(fila[1])));
  const seleccion = filas.slice(1).map((fila,i)=>({fila,nro:i+2})).filter(({fila}) => areaCanonicaCEA(fila[2]) === area && nivelNotasCEA(fila[4]) === nivelNotasCEA(data.nivel) && String(fila[8]).trim() === String(data.gestion).trim() && /2|segundo/i.test(fila[7]) === /2|segundo/i.test(data.semestre) && String(fila[9] || 'A').trim().toUpperCase() === String(data.paralelo).trim().toUpperCase() && conNotas.has(String(fila[0])) && (!data.idRegistro || String(fila[0]) === String(data.idRegistro)));
  exigirCEA(seleccion.length, 'No hay notas guardadas para publicar en este curso.');
  let estadoCol = filas[0].indexOf('EstadoPublicacion') + 1;
  let fechaCol = filas[0].indexOf('FechaPublicacion') + 1;
  if (!estadoCol) estadoCol = hoja.getLastColumn() + 1;
  if (!fechaCol) fechaCol = Math.max(hoja.getLastColumn(), estadoCol) + 1;
  if (typeof hoja.getMaxColumns === 'function' && hoja.getMaxColumns() < fechaCol) hoja.insertColumnsAfter(hoja.getMaxColumns(),fechaCol-hoja.getMaxColumns());
  hoja.getRange(1,estadoCol).setValue('EstadoPublicacion');
  hoja.getRange(1,fechaCol).setValue('FechaPublicacion');
  const fecha = new Date().toISOString();
  seleccion.forEach(({nro})=>{
    hoja.getRange(nro,estadoCol).setValue('PUBLICADO');
    hoja.getRange(nro,fechaCol).setValue(fecha);
  });
  // Publicar para consulta no modifica el estado de edición ni los bloqueos.
  SpreadsheetApp.flush();
  const solicitados = new Set(seleccion.map(({fila})=>String(fila[0])));
  const confirmados = hoja.getDataRange().getValues().slice(1).filter(fila=>solicitados.has(String(fila[0])) && fila[estadoCol-1] === 'PUBLICADO').map(fila=>String(fila[0]));
  exigirCEA(confirmados.length === solicitados.size,'No se confirmó la publicación de todas las planillas.');
  return {status:'success', publicados:confirmados, fecha};
}

function documentoConsultaNotasCEA(valor) {
  return String(valor || '').trim().toUpperCase().replace(/\s+(LP|SC|CB|OR|PT|TJ|CH|BE|BN|PA)\.?$/i, '').replace(/[^A-Z0-9]/g, '');
}

function catalogoConsultaNotasCEA(registro, filas) {
  const tecnica = registro.tipo !== 'humanistica';
  const propias = filas.filter(fila => areaCanonicaCEA(fila[0]) === areaCanonicaCEA(registro.areaKey) && nivelNotasCEA(fila[1]) === nivelNotasCEA(registro.nivel))
    .sort((a,b) => registro.tipo === 'humanistica' ? Number(/-M2$/i.test(a[2])) - Number(/-M2$/i.test(b[2])) : numeroModuloSistemasCEA(a[2]) - numeroModuloSistemasCEA(b[2]));
  let modulos = propias.map(fila => [String(fila[2]||''),String(fila[3]||''),Number(fila[4])||null]);
  if (tecnica && areaCanonicaCEA(registro.areaKey) === 'tec-sis') modulos = mallaSistemasCEA(modulos, registro.nivel);
  return Array.from({length:tecnica ? 5 : 2}, (_, indice) => ({
    codigo: modulos[indice]?.[0] || (tecnica ? 'Módulo ' + (indice + 1) : registro.areaKey + (indice ? '-M2' : '')),
    nombre: modulos[indice]?.[1] || 'Módulo ' + (indice + 1)
  }));
}

function posicionConsultaNotasCEA(registro) {
  if(Number(registro.moduloNumero)>=1&&Number(registro.moduloNumero)<=(registro.tipo==='humanistica'?2:5))return Number(registro.moduloNumero);
  const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const claveId = String(registro.id || '').match(/-(?:m[oó]?dulo|mod)([ivx]+|\d+)-\d{4}-s[12]-p/i)?.[1];
  if (registro.tipo === 'humanistica') {
    if (/-HUM[A-Z0-9]*M2-\d{4}-S[12]-P/i.test(registro.id) || /MODULO\s*2/i.test(normalizar(registro.modulo))) return 2;
  }
  const numero = numeroModuloSistemasCEA(claveId) || numeroModuloSistemasCEA(String(registro.modulo || '').split(':')[0]);
  if (numero) return registro.tipo === 'humanistica' ? Math.min(2, numero) : ((numero - 1) % 5) + 1;
  const nombre = normalizar(String(registro.modulo || '').replace(/^[^:]+:\s*/, ''));
  const indice = registro.catalogoModulos.findIndex(modulo => normalizar(modulo.nombre) === nombre || normalizar(modulo.codigo) === normalizar(registro.modulo));
  return indice >= 0 ? indice + 1 : (registro.tipo === 'humanistica' ? 1 : null);
}

function numeroModuloSistemasCEA(clave) {
  const valor = String(clave || '').split(':')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
    .replace(/^MOD(?:ULO)?[ ._-]*/, '').trim();
  return /^\d+$/.test(valor) ? Number(valor) : ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'].indexOf(valor) + 1;
}

function mallaSistemasCEA(modulos, nivel) {
  const oficiales = {
    basico: [["Módulo I","Taller de Sistemas Operativos I"],["Módulo II","Matemática para la Informática"],["Módulo III","Programación I-A"],["Módulo IV","Hardware de Computadoras I"],["Módulo V","Emergente"]],
    auxiliar: [["Módulo VI","Taller de Sistemas Operativos II"],["Módulo VII","Ofimática y Tecnología Multimedia I"],["Módulo VIII","Programación I-B"],["Módulo IX","Hardware de Computadoras II"],["Módulo X","Emergente"]],
    medio1: [["Módulo XI","Inglés Técnico"],["Módulo XII","Diseño y Programación Web I-A"],["Módulo XIII","Programación I-C"],["Módulo XIV","Ofimática y Tecnología Multimedia II"],["Módulo XV","Emprendimiento Productivo"]],
    medio2: [["Módulo XVI","Redes de Computadoras I"],["Módulo XVII","Diseño y Programación Web I-B"],["Módulo XVIII","Base de Datos I"],["Módulo XIX","Programación Móvil I"],["Módulo XX","Modalidades de Graduación"]]
  };
  const oficial = oficiales[nivelNotasCEA(nivel)];
  if (!oficial) return modulos;
  return oficial.map(([codigo, nombre], indice) => {
    const encontrado = modulos.find(([clave]) => numeroModuloSistemasCEA(clave) === numeroModuloSistemasCEA(codigo));
    return Number(encontrado?.[2])?[codigo,encontrado[1],Number(encontrado[2])]:[codigo,indice===2||indice===3?nombre:(encontrado?.[1]||nombre)];
  });
}

function criteriosHumanisticaCEA() {
  return Object.entries({ser: 10, saber: 40, hacer: 30, decidir: 10, autoevaluacion: 10}).map(([id, max]) =>
    ({id, nombre: id.toUpperCase(), max, categoria: id === 'autoevaluacion' ? 'Autoevaluación' : 'Heteroevaluación'}));
}

function recalcularDetalleLeidoCEA(detalle, tipo) {
  const tecnica = tipo === 'tecnica';
  const limites = tecnica ? {ser: 10, saber: 30, decidir: 10, proceso: 20, producto: 20, autoevaluacion: 10}
    : {ser: 10, saber: 40, decidir: 10, hacer: 30, autoevaluacion: 10};
  for(const campo of Object.keys(limites))if(detalle[campo]!==''&&detalle[campo]!=null&&Number.isFinite(Number(detalle[campo])))detalle[campo]=Math.round(Number(detalle[campo]));
  if(detalle.notaFinal!==''&&detalle.notaFinal!=null&&Number.isFinite(Number(detalle.notaFinal)))detalle.notaFinal=Math.round(Number(detalle.notaFinal));
  const tieneDimensiones = Object.keys(limites).some(campo => detalle[campo] !== '' && detalle[campo] != null);
  if (tieneDimensiones) {
    detalle.notaFinal = Math.round(Object.entries(limites).reduce((total, [campo, maximo]) => {
      const valor = Number(detalle[campo]);
      return total + (Number.isFinite(valor) ? (tecnica ? Math.min(maximo, Math.max(0, valor)) : Math.max(0, valor)) : 0);
    }, 0));
    if (tecnica) detalle.hacer = Number(detalle.proceso || 0) + Number(detalle.producto || 0);
  }
  const manual = detalle.observacionManual;
  if (manual && manual !== 'AUTOMATICO') detalle.observacion = manual;
  else if (detalle.estadoParticipante === 'RETIRADO') detalle.observacion = 'RETIRADO';
  else detalle.observacion = detalle.notaFinal >= 85 ? 'PROMOVIDO EXCELENTE' : detalle.notaFinal >= 51 ? 'PROMOVIDO'
    : detalle.notaFinal > 0 || tieneDimensiones ? 'POSTERGADO' : '';
}

function prepararNotasCEA(ss, data, auth) {
  const reg=data.registro||{};
  const existentes=ss.getSheetByName('Calificaciones_Registros')?.getDataRange().getValues()||[];
  const anterior=existentes.slice(1).find(f=>String(f[0])===String(reg.id));
  const numeroAnterior=anterior?posicionFilaModuloCEA(anterior,existentes[0]):null;
  if(anterior){
    exigirCEA(areaCanonicaCEA(reg.areaKey)===areaCanonicaCEA(anterior[2])&&nivelNotasCEA(reg.nivel)===nivelNotasCEA(anterior[4])&&String(reg.gestion)===String(anterior[8])&&/2|segundo/i.test(reg.semestre)===/2|segundo/i.test(anterior[7])&&String(reg.paralelo||'A')===String(anterior[9]||'A'),'Para trasladar notas usa Cambiar notas de módulo.','NOMINA');
    const codigoPedido=numeroModuloSistemasCEA(reg.moduloCodigo)||numeroModuloSistemasCEA(String(reg.modulo||'').split(':')[0]);
    const numeroPedido=Number(reg.moduloNumero)||(reg.tipo==='humanistica'?(String(reg.moduloCodigo||'').endsWith('-M2')?2:1):codigoPedido?((codigoPedido-1)%5)+1:0);
    if(numeroAnterior&&numeroPedido)exigirCEA(numeroPedido===numeroAnterior,'Este registro fue trasladado. Recarga las notas antes de guardar.','IDENTIDAD_MODULO');
    if(numeroAnterior&&reg.moduloNumero)exigirCEA(Number(reg.moduloNumero)===numeroAnterior,'Este módulo cambió de ubicación. Recarga las notas antes de editar.','IDENTIDAD_MODULO');
  }
  reg.moduloNumero=numeroAnterior||Number(reg.moduloNumero)||posicionFilaModuloCEA([reg.id,reg.tipo,reg.areaKey,reg.carrera,reg.nivel,reg.modulo],[]);
  exigirCEA(reg.id && reg.areaKey && reg.nivel && reg.gestion && reg.semestre && reg.paralelo, 'Faltan datos del curso de la planilla.');
  exigirCEA(Array.isArray(data.detalles), 'Falta la lista de calificaciones.');
  const matriculasVigentes = leerMatriculasCEA(ss);
  for (const detalle of data.detalles) {
    const prefijo = 'DET-' + reg.id + '-';
    const idDetalle = String(detalle.id || '');
    const matriculaId = detalle.matriculaId || (idDetalle.startsWith(prefijo) && idDetalle.slice(prefijo.length).startsWith('MAT-') ? idDetalle.slice(prefijo.length) : '');
    if (!matriculaId) continue;
    exigirCEA(matriculasVigentes.some(est => est.matriculaId === matriculaId && est.estadoMatricula !== 'ELIMINADO' &&
      String(est.gestion).trim() === String(reg.gestion).trim() &&
      /2|segundo/i.test(est.semestre) === /2|segundo/i.test(reg.semestre) &&
      nivelNotasCEA(est.nivel) === nivelNotasCEA(reg.nivel) &&
      String(est.paralelo).trim().toUpperCase() === String(reg.paralelo).trim().toUpperCase() &&
      (areaCanonicaCEA(est.areaKey) === areaCanonicaCEA(reg.areaKey) || (reg.tipo === 'humanistica' && areaCanonicaCEA(est.areaKey) === 'hum-humanistica'))),
      'La matrícula cambió o fue eliminada. Actualiza la nómina antes de guardar sus notas.', 'NOMINA');
  }
  if (Array.isArray(data.cambiosNotas)) {
    combinarCambiosNotasCEA(ss, data);
  }
  // Las operaciones de planilla completa también admiten versiones antiguas:
  // el último guardado confirmado prevalece en esta planilla. Las ediciones
  // normales de notas usan cambiosNotas para conservar las demás celdas.
  reg.usuarioModif = auth.u;
  exigirCEA(['BORRADOR', 'EN EDICION', 'FINALIZADO', 'PUBLICADO', 'ARCHIVADO'].includes(reg.estado || 'BORRADOR'), 'Estado de planilla inválido.');
  const technical = reg.tipo === 'tecnica';
  if (!technical) {
    reg.nivel = nivelHumanisticoOficialCEA(reg.nivel);
    reg.criterios = criteriosHumanisticaCEA();
  }
  data.detalles.forEach(detail => {
    const fields = technical ? ['ser', 'saber', 'decidir', 'proceso', 'producto', 'autoevaluacion'] : ['ser', 'saber', 'decidir', 'hacer', 'autoevaluacion'];
    const hasNotes = fields.some(key => detail[key] !== '' && detail[key] != null);
    fields.forEach(key => {
      if (detail[key] == null) detail[key] = '';
      if (detail[key] === '') return;
      const valor = Number(detail[key]);
      exigirCEA(Number.isFinite(valor) && valor >= 0 && valor <= limitesCriteriosCEA(reg.tipo)[key], 'Hay calificaciones fuera del rango de su dimensión.');
      detail[key] = Math.round(valor);
    });
    if (technical) detail.hacer = detail.proceso === '' && detail.producto === '' ? '' : Number(detail.proceso || 0) + Number(detail.producto || 0);
    const total = fields.reduce((sum, key) => sum + Number(detail[key] || 0), 0);
    exigirCEA(Number.isFinite(total), 'Hay calificaciones inválidas.');
    const redondeado = Math.round(total);
    detail.notaFinal = redondeado;
    exigirCEA(!detail.estadoParticipante || ['EFECTIVO', 'ABANDONO', 'RETIRADO'].includes(detail.estadoParticipante), 'Estado no valido.');
    const manual = detail.observacionManual;
    exigirCEA(!manual || ['D', 'AUTOMATICO', 'EFECTIVO', 'RETIRADO', 'ABANDONO', 'NO EVALUADO', 'POSTERGADO', 'PROMOVIDO', 'PROMOVIDO EXCELENTE'].includes(manual), 'Observación no válida.');
    if (manual && manual !== 'AUTOMATICO') detail.observacion = manual;
    else if (['RETIRADO', 'ABANDONO'].includes(detail.estadoParticipante)) detail.observacion = detail.estadoParticipante;
    else if (manual || detail.estadoParticipante || detail.observacion !== 'RETIRADO') {
      const nota = detail.notaFinal;
      detail.observacion = !nota ? (hasNotes ? 'D' : 'ABANDONO') : nota >= 85 ? 'PROMOVIDO EXCELENTE' : nota >= 51 ? 'PROMOVIDO' : 'POSTERGADO';
    }
  });
}

// Criterios variables: una fila por criterio y una fila por calificacion.
// No se agregan columnas variables a las planillas oficiales existentes.
const TABLAS_CRITERIOS_CEA = {
  Criterios_Configuracion: ['RegistroID','CuentaDocente','Habilitado','Sobre100','Revision','AreaKey','Gestion','Semestre','Nivel','Paralelo','Modulo','Tipo'],
  Criterios_Definiciones: ['RegistroID','CuentaDocente','CriterioID','Dimension','Titulo','Orden','Activo'],
  Criterios_Notas: ['RegistroID','CuentaDocente','CriterioID','DetalleID','Valor','Escala','Origen'],
  Criterios_Resultados: ['RegistroID','CuentaDocente','DetalleID','Dimension','ValorAplicado'],
  Criterios_Historial: ['RegistroID','CuentaDocente','Revision','Fecha','Tipo','CambioJSON']
};

function leerCriteriosEvaluacionCEA(ss, id, auth, tablas) {
  exigirCEA(auth.r === 'docente', 'Los criterios individuales corresponden al docente.', 'PERMISO');
  const cuenta = auth.cuentaKey || auth.areaKey;
  const leer = nombre => tablas ? (tablas[nombre].get(String(id)) || []) : (ss.getSheetByName(nombre)?.getDataRange().getValues().slice(1).filter(f => String(f[0]) === String(id) && String(f[1]) === cuenta) || []);
  const fila = leer('Criterios_Configuracion')[0];
  const criterios=leer('Criterios_Definiciones').map(f => ({id:String(f[2]),dimension:String(f[3]),titulo:String(f[4]),orden:Number(f[5]),activo:f[6] !== false}));
  const tipo=fila?.[11] || (String(fila?.[5] || auth.areaKey).startsWith('hum-') ? 'humanistica' : 'tecnica');
  const escalas=limitesCriteriosCEA(tipo);
  return {
    registroId:String(id), eliminacionDefinitiva:true, habilitado:fila?.[2] === true, sobre100:fila?.[3] === true, revision:fila?.[4] || null,
    criterios,
    notas:leer('Criterios_Notas').map(f => {
      const criterio=criterios.find(c=>c.id===String(f[2]));
      const destino=fila?.[3] === true ? 100 : escalas[criterio?.dimension] || 100;
      const origen=Number(f[5]) || destino;
      return {criterioId:String(f[2]),detalleId:String(f[3]),valor:f[4] === '' ? '' : Math.round(Number(f[4])*destino/origen),origen:f[6] === 'automatico' ? 'automatico' : 'manual'};
    }),
    resultados:leer('Criterios_Resultados').map(f => ({detalleId:String(f[2]),dimension:String(f[3]),valor:f[4] === '' ? '' : Math.round(Number(f[4]))}))
  };
}

function distribuirCriteriosCEA(nota, maximo, escala, cantidad, semilla) {
  if(!cantidad)return [];
  const unidad=1, tope=Math.round(escala);
  const suma=Math.round(Math.max(0,Math.min(maximo,Math.round(Number(nota))))*escala/maximo*unidad*cantidad);
  const base=Math.floor(suma/cantidad), resto=suma-base*cantidad;
  const valores=Array.from({length:cantidad},(_,i)=>base+(i<resto?1:0));
  let hash=0;for(const c of String(semilla || ''))hash=(hash*31+c.charCodeAt(0))>>>0;
  for(let i=0;i<Math.floor(cantidad/2);i++){
    const j=cantidad-1-i, margen=Math.min(valores[j],tope-valores[i]);
    const amplitud=Math.min(margen,Math.round(tope*0.15));
    const cambio=Math.round(amplitud*(i+1)/(Math.floor(cantidad/2)+1)*(0.5+(hash%6)/10));
    valores[i]+=cambio;valores[j]-=cambio;
  }
  return valores.map(v=>v/unidad);
}

function limitesCriteriosCEA(tipo) {
  return tipo === 'tecnica' ? {ser:10,saber:30,decidir:10,proceso:20,producto:20,autoevaluacion:10} : {ser:10,saber:40,hacer:30,decidir:10,autoevaluacion:10};
}

function prepararCriteriosEvaluacionCEA(ss, data, auth) {
  exigirCEA(auth.r === 'docente', 'Solo el docente puede guardar sus criterios.', 'PERMISO');
  const entrada = data.criteriosEvaluacion;
  const anterior = leerCriteriosEvaluacionCEA(ss, data.registro.id, auth);
  exigirCEA(['tecnica','humanistica'].includes(data.registro.tipo), 'Tipo de evaluacion invalido.');
  exigirCEA(entrada.baseRevision === anterior.revision, 'Los criterios cambiaron en otra pestaña. Usa Recargar criterios guardados para revisar la version del servidor antes de guardar.', 'CRITERIOS_VERSION');
  exigirCEA(typeof entrada.habilitado === 'boolean' && typeof entrada.sobre100 === 'boolean' && Array.isArray(entrada.criterios) && Array.isArray(entrada.notas) && Array.isArray(entrada.aplicar), 'Configuracion de criterios invalida.');
  const limites = limitesCriteriosCEA(data.registro.tipo);
  exigirCEA(entrada.criterios.length <= 1000 && entrada.notas.length <= 100000, 'Divide la evaluacion en menos criterios por modulo.');
  exigirCEA(entrada.eliminados == null || Array.isArray(entrada.eliminados), 'La lista de criterios eliminados no es válida.');
  const eliminados = new Set((entrada.eliminados || []).map(String));
  exigirCEA(eliminados.size <= 1000 && [...eliminados].every(id => anterior.criterios.some(c => c.id === id)), 'Solo puedes eliminar criterios existentes de este registro.', 'PERMISO');
  const ids = new Set(), criterios = entrada.criterios.map((c,i) => {
    const id=String(c.id || ''), titulo=String(c.titulo || '').trim();
    exigirCEA(id && id.length <= 160 && !ids.has(id) && !eliminados.has(id) && Object.prototype.hasOwnProperty.call(limites,c.dimension) && titulo && titulo.length <= 180, 'Hay un criterio repetido o invalido.');
    ids.add(id);
    return {id,dimension:c.dimension,titulo,orden:i,activo:c.activo !== false};
  });
  // Las omisiones de clientes anteriores se archivan; la eliminacion explicita retira definicion y notas.
  for (const c of anterior.criterios) if (!ids.has(c.id) && !eliminados.has(c.id)) criterios.push({...c,activo:false});
  const porCriterio = new Map(criterios.map(c => [c.id,c]));
  const detalles = new Map(data.detalles.map(d => [String(d.id),d]));
  const claves = new Set();
  const notas = entrada.notas.map(n => {
    const criterio=porCriterio.get(String(n.criterioId)),detalleId=String(n.detalleId),clave=JSON.stringify([detalleId,String(n.criterioId)]);
    exigirCEA(criterio && detalles.has(detalleId) && !claves.has(clave), 'La nota del criterio no corresponde a esta nomina.');
    claves.add(clave);
    const valor=n.valor === '' || n.valor == null ? '' : Number(n.valor);
    exigirCEA(valor === '' || (Number.isFinite(valor) && valor >= 0 && valor <= (entrada.sobre100 ? 100 : limites[criterio.dimension])), 'Una nota excede el maximo del criterio.');
    return {criterioId:criterio.id,detalleId,valor:valor === '' ? '' : Math.round(valor),origen:n.origen === 'automatico' ? 'automatico' : 'manual'};
  });
  const valores = new Map(notas.map(n => [JSON.stringify([n.detalleId,n.criterioId]),n.valor]));
  const dimensionesEliminadas = new Set(anterior.criterios.filter(c => eliminados.has(c.id)).map(c => c.dimension));
  const resultados = anterior.resultados.filter(r => !dimensionesEliminadas.has(r.dimension)).map(r => ({...r})), aplicados = new Set();
  exigirCEA(!entrada.aplicar.length || entrada.habilitado, 'Activa los criterios para aplicar sus promedios.');
  data.cambiosNotas = Array.isArray(data.cambiosNotas) ? data.cambiosNotas : [];
  for (const aplicacion of entrada.aplicar) {
    const detalle=detalles.get(String(aplicacion.detalleId)),dimension=aplicacion.dimension;
    const clave=JSON.stringify([String(aplicacion.detalleId),dimension]);
    exigirCEA(detalle && Object.prototype.hasOwnProperty.call(limites,dimension) && !aplicados.has(clave), 'Resultado de criterios invalido.');
    aplicados.add(clave);
    const grupo=criterios.filter(c => c.activo && c.dimension === dimension);
    const ns=grupo.map(c => valores.get(JSON.stringify([String(detalle.id),c.id])));
    exigirCEA(grupo.length && ns.every(n => n !== '' && n != null), 'Completa todos los criterios de la dimension antes de aplicar el promedio.');
    const actual=detalle[dimension] == null ? '' : detalle[dimension];
    exigirCEA(String(actual) === String(aplicacion.baseValor == null ? '' : aplicacion.baseValor), 'La nota oficial cambio mientras evaluabas. Recarga y revisa el ajuste manual.', 'CRITERIOS_AJUSTE');
    const media=ns.reduce((s,n) => s+n,0)/ns.length;
    const valor=Math.round(entrada.sobre100 ? media * limites[dimension]/100 : media);
    data.cambiosNotas = data.cambiosNotas.filter(c => !(String(c.id) === String(detalle.id) && c.campo === dimension));
    data.cambiosNotas.push({id:detalle.id,ci:detalle.ci,rude:detalle.rude,campo:dimension,valor});
    const indice=resultados.findIndex(r => r.detalleId === String(detalle.id) && r.dimension === dimension);
    const resultado={detalleId:String(detalle.id),dimension,valor};
    if(indice>=0)resultados[indice]=resultado;else resultados.push(resultado);
  }
  return {anterior,eliminados:[...eliminados],habilitado:entrada.habilitado,sobre100:entrada.sobre100,criterios,notas,resultados,revision:Utilities.getUuid()};
}

function sincronizarPromediosCriteriosCEA(ss, data, preparado, auth) {
  const limites=limitesCriteriosCEA(data.registro.tipo);
  const aplicadas=new Set((data.criteriosEvaluacion?.aplicar || []).map(a=>JSON.stringify([String(a.detalleId),a.dimension])));
  const oficiales=ss.getSheetByName('Calificaciones_Detalle')?.getDataRange().getValues().slice(1) || [];
  const columnas={ser:8,saber:9,decidir:10,proceso:11,producto:12,hacer:13,autoevaluacion:14};
  const explicitos=Array.isArray(data.cambiosNotas)?data.cambiosNotas:data.detalles.flatMap(d=>{const anterior=oficiales.find(f=>String(f[0])===String(d.id)&&String(f[1])===String(data.registro.id));return anterior?Object.keys(limites).filter(c=>String(anterior[columnas[c]]??'')!==String(d[c]??'')).map(c=>({id:d.id,campo:c})):[];});
  const cambios=explicitos.filter(c=>Object.prototype.hasOwnProperty.call(limites,c.campo)&&!aplicadas.has(JSON.stringify([String(c.id),c.campo])));
  const salidas=[];
  if(!cambios.length)return salidas;
  const configuraciones=ss.getSheetByName('Criterios_Configuracion')?.getDataRange().getValues().slice(1).filter(f=>String(f[0])===String(data.registro.id)&&f[2]===true) || [];
  const cuentaActual=String(auth.cuentaKey || auth.areaKey);
  if(preparado && !configuraciones.some(f=>String(f[1])===cuentaActual))configuraciones.push([data.registro.id,cuentaActual]);
  for(const fila of configuraciones){
    const cuenta=String(fila[1]),identidad={...auth,r:'docente',cuentaKey:cuenta,areaKey:data.registro.areaKey};
    const propio=preparado&&cuenta===cuentaActual;
    const anterior=propio ? preparado.anterior : leerCriteriosEvaluacionCEA(ss,data.registro.id,identidad);
    const p=propio ? preparado : {...structuredCloneCriteriosCEA(anterior),anterior,revision:Utilities.getUuid()};
    if(!p.habilitado)continue;
    let actualizado=false;
    for(const cambio of cambios){
      const detalle=data.detalles.find(d=>String(d.id)===String(cambio.id));if(!detalle)continue;
      const dimension=cambio.campo, grupo=p.criterios.filter(c=>c.activo&&c.dimension===dimension);
      if(!grupo.length)continue;
      const objetivo=detalle[dimension], escala=p.sobre100?100:limites[dimension];
      const valores=objetivo===''||objetivo==null ? grupo.map(()=> '') : distribuirCriteriosCEA(objetivo,limites[dimension],escala,grupo.length,String(detalle.id)+dimension);
      grupo.forEach((c,i)=>{
        const n={criterioId:c.id,detalleId:String(detalle.id),valor:valores[i],origen:'automatico'};
        const pos=p.notas.findIndex(a=>a.detalleId===n.detalleId&&a.criterioId===n.criterioId);
        if(pos<0)p.notas.push(n);else p.notas[pos]=n;
      });
      const resultado={detalleId:String(detalle.id),dimension,valor:objetivo};
      const pos=p.resultados.findIndex(r=>r.detalleId===resultado.detalleId&&r.dimension===dimension);
      if(pos<0)p.resultados.push(resultado);else p.resultados[pos]=resultado;
      actualizado=true;
    }
    if(actualizado&&!propio)salidas.push({preparado:p,auth:identidad});
  }
  return salidas;
}
function structuredCloneCriteriosCEA(v){return JSON.parse(JSON.stringify(v));}

function eliminarRespaldosCriteriosCEA(ss,registroId,cuenta,ids){
  const eliminados=new Set(ids || []);if(!eliminados.size)return;
  const coincide=f=>String(f[0])===registroId&&String(f[1])===cuenta;
  const notaEliminada=f=>{if(f[4]!=='NOTA')return false;try{return eliminados.has(String(JSON.parse(f[5]).criterioId));}catch(error){return false;}};
  const historial=ss.getSheetByName('Criterios_Historial');
  if(historial){const filas=historial.getDataRange().getValues();const conservar=filas.filter((f,i)=>i===0||!coincide(f)||!notaEliminada(f));if(conservar.length!==filas.length)escribirTablaCEA(ss,'Criterios_Historial',conservar);}
  const papelera=ss.getSheetByName('Papelera_Matriculas');
  if(papelera){
    const filas=papelera.getDataRange().getValues();let cambio=false;
    for(let i=1;i<filas.length;i++){
      if(!filas[i][0]||!filas[i][1])continue;
      const estudiante=JSON.parse(String(filas[i][1])),tablas=estudiante.calificacionesPapelera?.criterios;if(!tablas)continue;
      let modificado=false;
      for(const nombre of ['Criterios_Definiciones','Criterios_Notas','Criterios_Historial']){
        if(!Array.isArray(tablas[nombre]))continue;
        const anteriores=tablas[nombre];tablas[nombre]=anteriores.filter(f=>!coincide(f)||!(nombre==='Criterios_Historial'?notaEliminada(f):eliminados.has(String(f[2]))));
        if(tablas[nombre].length!==anteriores.length)modificado=true;
      }
      if(modificado){filas[i][1]=JSON.stringify(estudiante);cambio=true;}
    }
    if(cambio)escribirTablaCEA(ss,'Papelera_Matriculas',filas);
  }
}

function persistirCriteriosEvaluacionCEA(ss, preparado, data, auth) {
  const id=String(data.registro.id),cuenta=auth.cuentaKey || auth.areaKey,revision=preparado.revision;
  const guardar=(nombre,filas) => {
    const hoja=ss.getSheetByName(nombre) || ss.insertSheet(nombre),cabecera=TABLAS_CRITERIOS_CEA[nombre],ancho=cabecera.length;
    if(hoja.getMaxColumns()<ancho)hoja.insertColumnsAfter(hoja.getMaxColumns(),ancho-hoja.getMaxColumns());
    const actuales=hoja.getLastRow()?hoja.getDataRange().getValues():[];
    if(JSON.stringify(actuales[0]?.slice(0,ancho))!==JSON.stringify(cabecera))hoja.getRange(1,1,1,ancho).setValues([cabecera]);
    const posiciones=actuales.slice(1).map((f,i)=>({f,pos:i+2})).filter(({f})=>String(f[0])===id&&String(f[1])===cuenta).map(({pos})=>pos);
    const nuevas=filas.map(f=>[id,cuenta].concat(f)), cambios=[];
    for(let i=0;i<posiciones.length;i++)cambios.push({pos:posiciones[i],fila:nuevas[i] || Array(ancho).fill('')});
    const final=hoja.getLastRow()+1;
    for(let i=posiciones.length;i<nuevas.length;i++)cambios.push({pos:final+i-posiciones.length,fila:nuevas[i]});
    cambios.sort((a,b)=>a.pos-b.pos);
    for(let i=0;i<cambios.length;){
      const inicio=i++;
      while(i<cambios.length&&cambios[i].pos===cambios[inicio].pos+i-inicio)i++;
      const posicion=cambios[inicio].pos, cantidad=i-inicio;
      if(posicion+cantidad-1>hoja.getMaxRows())hoja.insertRowsAfter(hoja.getMaxRows(),posicion+cantidad-1-hoja.getMaxRows());
      hoja.getRange(posicion,1,cantidad,ancho).setValues(cambios.slice(inicio,i).map(c=>c.fila));
    }
  };
  guardar('Criterios_Configuracion',[[preparado.habilitado,preparado.sobre100,revision,data.registro.areaKey,data.registro.gestion,data.registro.semestre,data.registro.nivel,data.registro.paralelo,data.registro.modulo,data.registro.tipo]]);
  guardar('Criterios_Definiciones',preparado.criterios.map(c=>[c.id,c.dimension,c.titulo,c.orden,c.activo]));
  const escalaDe=n=>preparado.sobre100 ? 100 : limitesCriteriosCEA(data.registro.tipo)[preparado.criterios.find(c=>c.id===n.criterioId).dimension];
  guardar('Criterios_Notas',preparado.notas.map(n=>[n.criterioId,n.detalleId,n.valor,escalaDe(n),n.origen || 'manual']));
  guardar('Criterios_Resultados',preparado.resultados.map(r=>[r.detalleId,r.dimension,r.valor]));
  eliminarRespaldosCriteriosCEA(ss,id,cuenta,preparado.eliminados);
  const historial=ss.getSheetByName('Criterios_Historial') || ss.insertSheet('Criterios_Historial');
  if(!historial.getLastRow())historial.appendRow(TABLAS_CRITERIOS_CEA.Criterios_Historial);
  const eventos=[];
  const registrar=(tipo,cambio)=>eventos.push([id,cuenta,revision,new Date().toISOString(),tipo,JSON.stringify(cambio)]);
  registrar('CONFIGURACION',{habilitado:preparado.habilitado,sobre100:preparado.sobre100});
  for(const criterioId of preparado.eliminados || [])registrar('CRITERIO_ELIMINADO',{criterioId});
  for(const c of preparado.criterios)if(JSON.stringify(c)!==JSON.stringify(preparado.anterior.criterios.find(a=>a.id===c.id)))registrar('CRITERIO',c);
  const anteriores=new Map(preparado.anterior.notas.map(n=>[JSON.stringify([n.detalleId,n.criterioId]),n.valor]));
  for(const n of preparado.notas)if(anteriores.get(JSON.stringify([n.detalleId,n.criterioId]))!==n.valor || preparado.anterior.notas.find(a=>a.detalleId===n.detalleId&&a.criterioId===n.criterioId)?.origen!==n.origen)registrar('NOTA',{...n,escala:escalaDe(n)});
  if(eventos.length){
    const inicio=historial.getLastRow()+1;
    if(inicio+eventos.length-1>historial.getMaxRows())historial.insertRowsAfter(historial.getMaxRows(),inicio+eventos.length-1-historial.getMaxRows());
    historial.getRange(inicio,1,eventos.length,6).setValues(eventos);
  }
  SpreadsheetApp.flush();
  const confirmado=leerCriteriosEvaluacionCEA(ss,id,auth);
  exigirCEA(confirmado.revision===revision && hashCEA(confirmado.criterios)===hashCEA(preparado.criterios) && hashCEA(confirmado.notas)===hashCEA(preparado.notas), 'No se confirmo el guardado de todos los criterios.');
}

function configurarSistemaCEA() {
  const lock = LockService.getScriptLock();
  lock.waitLock(28000);
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    exigirCEA(active, 'Abre Apps Script desde Extensiones de la hoja oficial.');
    const props = PropertiesService.getScriptProperties();
    const existing = props.getProperty('CEA_SPREADSHEET_ID');
    exigirCEA(!existing || existing === active.getId(), 'Este proyecto ya está vinculado a otra hoja. Revisa CEA_SPREADSHEET_ID en las propiedades del script.');
    props.setProperty('CEA_SPREADSHEET_ID', active.getId());
    secretoCEA();
    inicializarHojas();
    let current = leerMatriculasCEA(active);
    const rosterSheet = active.getSheetByName('Registro_Estudiantes') || active.getSheetByName('Registro de Estudiantes');
    if (!current.length && rosterSheet.getRange(1, 20).getValue() !== 'ID_Matricula') {
      const texts = active.getSheetByName('Director_y_Textos').getDataRange().getValues();
      const legacy = texts.find(row => row[0] === 'registro_estudiantes_json' && row[1]) ||
        texts.find(row => row[0] === 'padron_afiliacion_json' && row[1]);
      if (legacy) {
        const rows = JSON.parse(legacy[1]);
        exigirCEA(Array.isArray(rows), 'El respaldo anterior de matrícula necesita revisión.');
        current = rows.map(student => ({
          ...student,
          matriculaId: Utilities.getUuid(),
          gestion: student.gestion || new Date().getFullYear(),
          semestre: student.semestre || 'Segundo Semestre',
          areaKey: areaCanonicaCEA(student.areaKey)
        }));
      }
    }
    guardarMatriculasCEA(active, current);
    if (!active.getSheetByName('Nomina_Respaldo')) escribirTablaCEA(active, 'Nomina_Respaldo', [['JSON_Matricula']].concat(current.map(est => [JSON.stringify(est)])));
    presentarRespaldoNominaCEA(active);
    migrarPapeleraCEA(active);
    Logger.log('Configuración completada. Hoja vinculada: ' + active.getName());
  } finally {
    lock.releaseLock();
  }
}

function leerMatriculasCEA(ss, incluirPapelera = true) {
  const sheet = ss.getSheetByName('Registro_Estudiantes') || ss.getSheetByName('Registro de Estudiantes');
  if (!sheet) return incluirPapelera ? leerPapeleraMatriculasCEA(ss) : [];
  const rows = sheet.getDataRange().getValues();
  const activas = rows.slice(1).filter(row => row[8] || row[13]).map((row, index) => {
    const career = String(row[4] || '');
    const name = career.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const careers = {sistem: 'tec-sis', informa: 'tec-sis', agro: 'tec-agr', gastro: 'tec-gas', textil: 'tec-tex', confecc: 'tec-tex', secre: 'tec-sec', belleza: 'tec-bel', conta: 'tec-contaduria', constru: 'tec-construccion', human: 'hum-humanistica'};
    const matched = Object.keys(careers).find(key => name.includes(key));
    const area = String(row[20] || (String(row[3]).toUpperCase().includes('HUMAN') ? 'hum-humanistica' : careers[matched] || career));
    const id = String(row[19] || 'MAT-' + hashCEA([row.slice(1, 14), index]));
    return {id: id, matriculaId: id, num: row[0], gestion: String(row[1] || new Date().getFullYear()), semestre: String(row[2] || 'Segundo Semestre'), rama: String(row[3] || ''), carreraNombre: career, areaKey: areaCanonicaCEA(area), nivel: String(row[5] || ''), paralelo: String(row[6] || 'A').toUpperCase(), turno: String(row[7] || ''), ci: String(row[8] || ''), rude: String(row[9] || ''), paterno: String(row[10] || ''), materno: String(row[11] || ''), nombres: String(row[12] || ''), nombreCompleto: String(row[13] || ''), genero: String(row[14] || ''), fechaNacimiento: String(row[15] || ''), celular: String(row[16] || ''), telefono: String(row[16] || ''), estadoMatricula: String(row[17] || 'EFECTIVO'), fechaActualizacion: String(row[18] || ''), fechaEliminacion: String(row[21] || ''), motivoEliminacion: String(row[22] || ''), version: hashCEA(row)};
  });
  activas.forEach(est => { if (est.areaKey.startsWith('hum-')) est.nivel = nivelHumanisticoOficialCEA(est.nivel); });
  if (!incluirPapelera) return activas;
  const ids = new Set(activas.map(est => est.matriculaId));
  return activas.concat(leerPapeleraMatriculasCEA(ss).filter(est => !ids.has(est.matriculaId)));
}

function leerPapeleraMatriculasCEA(ss) {
  const hoja = ss.getSheetByName('Papelera_Matriculas');
  if (!hoja) return [];
  return hoja.getDataRange().getValues().slice(1).filter(row => row[0]).map(row => {
    const est = JSON.parse(String(row[1]));
    return {...est, nivel: String(est.areaKey || '').startsWith('hum-') ? nivelHumanisticoOficialCEA(est.nivel) : est.nivel, version: hashCEA(row)};
  });
}

function guardarPapeleraMatriculasCEA(ss, matriculas) {
  const eliminadas = matriculas.filter(est => est.estadoMatricula === 'ELIMINADO');
  if (!eliminadas.length && !ss.getSheetByName('Papelera_Matriculas')) return;
  escribirTablaCEA(ss, 'Papelera_Matriculas', [['ID_Matricula', 'Matricula_JSON']].concat(eliminadas.map(est => {
    const copia = {...est};
    delete copia.version;
    return [est.matriculaId, JSON.stringify(copia)];
  })));
}

function filaMatriculaCEA(est, numero) {
  return [
    numero, String(est.gestion), String(est.semestre), est.rama || '', est.carreraNombre || '',
    est.nivel || '', est.paralelo || 'A', est.turno || '', String(est.ci || ''), String(est.rude || ''),
    est.paterno || '', est.materno || '', est.nombres || '', est.nombreCompleto || '', est.genero || '',
    est.fechaNacimiento || '', est.celular || est.telefono || '', est.estadoMatricula || 'EFECTIVO',
    est.fechaActualizacion || '', est.matriculaId || est.id, est.areaKey || '', est.fechaEliminacion || '',
    est.motivoEliminacion || ''
  ];
}

function guardarMatriculasCEA(ss, list) {
  const headers = ['N°', 'GESTION', 'SEMESTRE', 'AREA / RAMA', 'CARRERA / ESPECIALIDAD', 'NIVEL / CURSO', 'PARALELO', 'TURNO', 'DOCUMENTO (CI)', 'CODIGO RUDE', 'APELLIDO PATERNO', 'APELLIDO MATERNO', 'NOMBRES', 'NOMBRE COMPLETO', 'GÉNERO', 'FECHA DE NACIMIENTO', 'CELULAR / CONTACTO', 'ESTADO MATRICULA', 'FECHA ACTUALIZACION', 'ID_Matricula', 'AreaKey', 'FechaEliminacion', 'MotivoEliminacion'];
  const rows = list.filter(est => est.estadoMatricula !== 'ELIMINADO').map((est, index) => filaMatriculaCEA(est, index + 1));
  const sheet = ss.getSheetByName('Registro_Estudiantes') || ss.getSheetByName('Registro de Estudiantes');
  escribirTablaCEA(ss, sheet ? sheet.getName() : 'Registro_Estudiantes', [headers].concat(rows));
  guardarPapeleraMatriculasCEA(ss, list);
}

function respaldoRangoMatriculaCEA(range) {
  const valores = range.getValues();
  const formulas = typeof range.getFormulas === 'function' ? range.getFormulas() : [];
  return {range, original: valores.map((row, r) => row.map((value, c) => formulas[r]?.[c] || value))};
}

function prepararBorradoNotasMatriculaCEA(ss, eliminadas, matriculas) {
  const ids = [];
  const rangos = [];
  const registrosEliminados = [];
  const respaldo = {detalles: [], registros: []};
  const hoja = ss.getSheetByName('Calificaciones_Detalle');
  const registros = ss.getSheetByName('Calificaciones_Registros');
  if (!eliminadas.length || !registros) return {ids, rangos, registrosEliminados, respaldo};

  const scope = (area, nivel, semestre, gestion, paralelo) => {
    const claveArea = areaCanonicaCEA(area);
    return JSON.stringify([
      claveArea.startsWith('hum-') ? 'hum-humanistica' : claveArea,
      nivelNotasCEA(nivel), /2|segundo/i.test(String(semestre)) ? '2' : '1',
      String(gestion).trim(), String(paralelo || 'A').trim().toUpperCase()
    ]);
  };
  const porRegistro = new Map(registros.getDataRange().getValues().slice(1).map(row =>
    [String(row[0]).trim(), scope(row[2], row[4], row[7], row[8], row[9])]
  ));
  const idsEliminados = new Set(eliminadas.map(est => est.matriculaId));
  const candidatosPorCurso = new Map();
  const cursosAfectados = new Set(eliminadas.map(est => scope(est.areaKey, est.nivel, est.semestre, est.gestion, est.paralelo)));
  for (const est of matriculas) {
    const clave = scope(est.areaKey, est.nivel, est.semestre, est.gestion, est.paralelo);
    if (!cursosAfectados.has(clave)) continue;
    if (!candidatosPorCurso.has(clave)) candidatosPorCurso.set(clave, []);
    candidatosPorCurso.get(clave).push(est);
  }
  const texto = valor => String(valor || '').trim().toUpperCase();
  const filas = hoja ? hoja.getDataRange().getValues() : [];
  const posiciones = [];
  filas.slice(1).forEach((row, index) => {
    const id = String(row[0]).trim();
    const reg = String(row[1]).trim();
    const candidatos = candidatosPorCurso.get(porRegistro.get(reg));
    if (!id || !candidatos) return;
    const ci = texto(row[6]);
    const rude = texto(row[7]);
    const vinculada = candidatos.find(est => id === 'DET-' + reg + '-' + est.matriculaId);
    const coincidencias = vinculada ? [vinculada] : candidatos.filter(est => {
      const ciEst = texto(est.ci);
      const rudeEst = texto(est.rude);
      const nombreFila = texto([row[3], row[4], row[5]].filter(Boolean).join(' '));
      const nombreEstudiante = texto([est.paterno, est.materno, est.nombres].filter(Boolean).join(' ') || est.nombreCompleto);
      return (ci && ciEst && ci === ciEst && (!rude || !rudeEst || rude === rudeEst)) ||
        ((!ci || !ciEst) && rude && rudeEst && rude === rudeEst) ||
        (!ci && !rude && nombreFila && nombreFila === nombreEstudiante);
    });
    if (coincidencias.length !== 1 || !idsEliminados.has(coincidencias[0].matriculaId)) return;
    ids.push(id);
    respaldo.detalles.push(row);
    posiciones.push(index + 2);
  });
  for (let index = 0; index < posiciones.length;) {
    const first = index++;
    while (index < posiciones.length && posiciones[index] === posiciones[first] + index - first) index++;
    rangos.push(hoja.getRange(posiciones[first], 1, index - first, hoja.getLastColumn()));
  }
  const idsBorrados = new Set(ids);
  registros.getDataRange().getValues().slice(1).forEach((row, indice) => {
    const id = String(row[0]).trim();
    if (!id || !cursosAfectados.has(porRegistro.get(id))) return;
    respaldo.registros.push(row);
    const quedanMatriculados = candidatosPorCurso.get(porRegistro.get(id)).some(est =>
      est.estadoMatricula !== 'ELIMINADO' && !idsEliminados.has(est.matriculaId));
    if (quedanMatriculados) return;
    if (filas.slice(1).some(fila => String(fila[1]).trim() === id && !idsBorrados.has(String(fila[0]).trim()))) return;
    registrosEliminados.push(id);
    rangos.push(registros.getRange(indice + 2, 1, 1, registros.getLastColumn()));
  });
  respaldo.criterios = {};
  const registrosBorrados = new Set(registrosEliminados);
  Object.keys(TABLAS_CRITERIOS_CEA).forEach(nombre => {
    const tabla = ss.getSheetByName(nombre);
    if (!tabla) return;
    tabla.getDataRange().getValues().slice(1).forEach((fila,indice) => {
      let coincide = registrosBorrados.has(String(fila[0]));
      if (nombre === 'Criterios_Notas') coincide = coincide || idsBorrados.has(String(fila[3]));
      if (nombre === 'Criterios_Resultados') coincide = coincide || idsBorrados.has(String(fila[2]));
      if (nombre === 'Criterios_Historial' && fila[4] === 'NOTA') {
        try { coincide = coincide || idsBorrados.has(String(JSON.parse(fila[5]).detalleId)); } catch(error) {}
      }
      if (!coincide) return;
      if (!respaldo.criterios[nombre]) respaldo.criterios[nombre] = [];
      respaldo.criterios[nombre].push(fila);
      rangos.push(tabla.getRange(indice + 2,1,1,tabla.getLastColumn()));
    });
  });
  return {ids, rangos, registrosEliminados, respaldo};
}

function cambiosTrasladoCursoCEA(traslado, matriculas, auth) {
  const origen = traslado.origen || {};
  const area = areaCanonicaCEA(origen.areaKey);
  exigirCEA(area && permisoAreaCEA(auth, area, true), 'No puedes modificar matrículas de otra área.', 'PERMISO');
  const promover = traslado.modo === 'promover';
  exigirCEA(promover || traslado.modo === 'corregir', 'Operación de curso inválida.');
  const niveles = area.startsWith('hum-')
    ? ['Aprendizajes Elementales', 'Aprendizajes Avanzados', 'Aprendizajes Aplicados', 'Aprendizajes Complementarios', 'Aprendizajes Especializados']
    : ['Técnico Básico', 'Técnico Auxiliar', 'Técnico Medio I', 'Técnico Medio II'];
  const posicion = niveles.findIndex(nivel => nivelNotasCEA(nivel) === nivelNotasCEA(origen.nivel));
  const destino = promover ? niveles[posicion + 1] : niveles.find(nivel => nivel === traslado.nivel);
  const gestion = String(origen.gestion || '').trim();
  const semestre = /2|segundo/i.test(origen.semestre) ? 'Segundo Semestre' : 'Primer Semestre';
  const paraleloOrigen = String(origen.paralelo || '').trim().toUpperCase();
  const paralelo = String(traslado.paralelo || '').trim().toUpperCase();
  exigirCEA(posicion >= 0 && destino && /^\d{4}$/.test(gestion) && origen.semestre &&
    /^[A-Z0-9]{1,3}$/.test(paraleloOrigen) && /^[A-Z0-9]{1,3}$/.test(paralelo), 'El origen o destino del curso no es válido.');
  exigirCEA(promover || posicion !== niveles.indexOf(destino) || paraleloOrigen !== paralelo, 'Selecciona un nivel o paralelo diferente.');
  const siguienteGestion = promover && semestre === 'Segundo Semestre' ? String(Number(gestion) + 1) : gestion;
  const siguienteSemestre = promover ? (semestre === 'Primer Semestre' ? 'Segundo Semestre' : 'Primer Semestre') : semestre;
  const mismoCurso = (est, nivel, anio, periodo, grupo) =>
    areaCanonicaCEA(est.areaKey) === area && nivelNotasCEA(est.nivel) === nivelNotasCEA(nivel) &&
    String(est.gestion).trim() === anio && /2|segundo/i.test(est.semestre) === /2|segundo/i.test(periodo) &&
    String(est.paralelo || 'A').trim().toUpperCase() === grupo;
  const activos = matriculas.filter(est => String(est.estadoMatricula).trim().toUpperCase() !== 'ELIMINADO');
  const curso = activos.filter(est => mismoCurso(est, origen.nivel, gestion, semestre, paraleloOrigen));
  const ids = new Set(Array.isArray(traslado.ids) ? traslado.ids.map(String) : []);
  exigirCEA(curso.length && curso.length === ids.size && curso.every(est => ids.has(est.matriculaId)),
    'La nómina de origen cambió. Actualiza Afiliación y revisa el curso.', 'CONFLICTO');
  const receptores = activos.filter(est => mismoCurso(est, destino, siguienteGestion, siguienteSemestre, paralelo));
  const normalizar = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
  const mismaPersona = (a, b) => {
    const ciA = normalizar(a.ci), ciB = normalizar(b.ci);
    const rudeA = normalizar(a.rude), rudeB = normalizar(b.rude);
    if (ciA && ciB) return ciA === ciB;
    if (rudeA && rudeB) return rudeA === rudeB;
    const nombre = normalizar(a.nombreCompleto || a.nombres);
    return nombre && nombre === normalizar(b.nombreCompleto || b.nombres);
  };
  const cambios = [];
  let omitidas = 0;
  for (const est of curso) {
    if (receptores.some(otro => mismaPersona(est, otro))) {
      exigirCEA(promover, 'Hay una matrícula duplicada en el destino. Revisa el curso de destino antes de moverlo.', 'CONFLICTO');
      omitidas++;
      continue;
    }
    const id = promover ? Utilities.getUuid() : est.matriculaId;
    const estudiante = {...est, id, matriculaId: id, nivel: destino, paralelo,
      gestion: siguienteGestion, semestre: siguienteSemestre, estadoMatricula: promover ? 'EFECTIVO' : est.estadoMatricula};
    cambios.push({id, version: promover ? null : est.version, operacion: 'guardar', estudiante});
    receptores.push(estudiante);
  }
  return {cambios, omitidas, destino: {nivel: destino, paralelo, gestion: siguienteGestion, semestre: siguienteSemestre}};
}

function actualizarMatriculasCEA(ss, data, auth) {
  const list = leerMatriculasCEA(ss);
  const traslado = data.trasladoCurso ? cambiosTrasladoCursoCEA(data.trasladoCurso, list, auth) : null;
  const cambios = traslado ? traslado.cambios : data.cambios;
  exigirCEA(Array.isArray(cambios), 'Falta la lista de cambios.');
  const byId = new Map(list.map(est => [est.matriculaId, est]));
  const seen = new Set();
  const eliminadas = [];
  const restauradas = [];
  cambios.forEach(change => {
    const id = String(change.id || '');
    exigirCEA(id && !seen.has(id), 'Identificador de matrícula inválido o repetido.');
    seen.add(id);
    const old = byId.get(id);
    const next = change.estudiante;
    if (next && areaCanonicaCEA(next.areaKey).startsWith('hum-')) next.nivel = nivelHumanisticoOficialCEA(next.nivel);
    exigirCEA(['guardar', 'baja', 'eliminar'].includes(change.operacion), 'Operación de matrícula inválida.');
    exigirCEA(permisoAreaCEA(auth, old ? old.areaKey : next && next.areaKey, true), 'Esta matrícula pertenece a otra área.', 'PERMISO');
    exigirCEA((old ? old.version : null) === (change.version || null), 'Una matrícula cambió en otra sesión. Recarga para evitar perder datos.', 'CONFLICTO');
    if (change.operacion === 'guardar') {
      exigirCEA(next && permisoAreaCEA(auth, next.areaKey, true), 'El destino pertenece a otra área.', 'PERMISO');
      exigirCEA(next.gestion && next.semestre && next.nivel && next.paralelo && next.areaKey && (next.nombreCompleto || next.nombres), 'Completa nombre, carrera, nivel, gestión, semestre y paralelo.');
      const guardada = {...old, ...next, id: id, matriculaId: id, estadoMatricula: next.estadoMatricula === 'ELIMINADO' ? 'ELIMINADO' : next.estadoMatricula || 'EFECTIVO', fechaActualizacion: new Date().toISOString()};
      if (old?.estadoMatricula === 'ELIMINADO' && guardada.estadoMatricula !== 'ELIMINADO') {
        if (old.calificacionesPapelera) restauradas.push(old.calificacionesPapelera);
        delete guardada.calificacionesPapelera;
      }
      byId.set(id, guardada);
    } else {
      exigirCEA(old, 'La matrícula ya no existe.');
      eliminadas.push(old);
      if (change.operacion === 'eliminar') {
        byId.delete(id);
      }
      else byId.set(id, {...old, calificacionesPapelera: old.calificacionesPapelera || prepararBorradoNotasMatriculaCEA(ss, [old], list).respaldo,
        estadoMatricula: 'ELIMINADO', fechaEliminacion: new Date().toISOString(), motivoEliminacion: change.motivo || 'Baja de matrícula', fechaActualizacion: new Date().toISOString()});
    }
  });
  const existing = ss.getSheetByName('Registro_Estudiantes') || ss.getSheetByName('Registro de Estudiantes');
  const notas = prepararBorradoNotasMatriculaCEA(ss, eliminadas, list);
  const applied = [];
  try {
    const papelera = ss.getSheetByName('Papelera_Matriculas') || ss.insertSheet('Papelera_Matriculas');
    const filasPapelera = Array.from(byId.values()).filter(est => est.estadoMatricula === 'ELIMINADO').length + 1;
    applied.push(respaldoRangoMatriculaCEA(papelera.getRange(1, 1, Math.max(filasPapelera, papelera.getLastRow()), 2)));
    if (!existing || existing.getRange(1, 20).getValue() !== 'ID_Matricula') {
      if (existing) applied.push(respaldoRangoMatriculaCEA(existing.getRange(1, 1, Math.max(existing.getLastRow(), byId.size + 1), Math.max(23, existing.getLastColumn()))));
      guardarMatriculasCEA(ss, Array.from(byId.values()));
    } else {
      const rows = existing.getDataRange().getValues();
      const positions = new Map();
      let rosterIndex = 0;
      rows.slice(1).forEach((row, index) => {
        if (!row[8] && !row[13]) return;
        const id = String(row[19] || 'MAT-' + hashCEA([row.slice(1, 14), rosterIndex]));
        positions.set(id, index + 2);
        rosterIndex++;
      });
      let nextPosition = rows.length + 1;
      const updates = Array.from(seen, id => {
        const position = positions.get(id) || nextPosition++;
        const student = byId.get(id);
        return {position, values: student && student.estadoMatricula !== 'ELIMINADO' ? filaMatriculaCEA(student, student.num || position - 1) : Array(23).fill('')};
      }).sort((a, b) => a.position - b.position);
      if (nextPosition - 1 > existing.getMaxRows()) {
        existing.insertRowsAfter(existing.getMaxRows(), nextPosition - 1 - existing.getMaxRows());
      }
      for (let index = 0; index < updates.length;) {
        const first = index++;
        const position = updates[first].position;
        while (index < updates.length && updates[index].position === position + index - first) index++;
        const range = existing.getRange(position, 1, index - first, 23);
        applied.push(respaldoRangoMatriculaCEA(range));
        range.setValues(updates.slice(first, index).map(update => update.values));
      }
    }
    for (const range of notas.rangos) {
      applied.push(respaldoRangoMatriculaCEA(range));
      range.clearContent();
    }
    for (const [nombre, campo] of [['Calificaciones_Registros', 'registros'], ['Calificaciones_Detalle', 'detalles']]) {
      const recuperar = restauradas.flatMap(item => item[campo] || []);
      if (!recuperar.length) continue;
      const hoja = ss.getSheetByName(nombre);
      exigirCEA(hoja, 'No se encontró la hoja de calificaciones para recuperar la matrícula.');
      const filas = hoja.getDataRange().getValues();
      const ids = new Set(filas.slice(1).map(fila => String(fila[0])));
      const nuevas = recuperar.filter(fila => {
        if (ids.has(String(fila[0]))) return false;
        ids.add(String(fila[0]));
        return true;
      });
      if (!nuevas.length) continue;
      const posicion = hoja.getLastRow() + 1;
      const ancho = Math.max(hoja.getLastColumn(), ...nuevas.map(fila => fila.length));
      if (posicion + nuevas.length - 1 > hoja.getMaxRows()) hoja.insertRowsAfter(hoja.getMaxRows(), posicion + nuevas.length - 1 - hoja.getMaxRows());
      const rango = hoja.getRange(posicion, 1, nuevas.length, ancho);
      applied.push(respaldoRangoMatriculaCEA(rango));
      rango.setValues(nuevas.map(fila => Array.from({length: ancho}, (_, indice) => fila[indice] ?? '')));
    }
    for (const nombre of Object.keys(TABLAS_CRITERIOS_CEA)) {
      const recuperar = restauradas.flatMap(item => item.criterios?.[nombre] || []);
      if (!recuperar.length) continue;
      const hoja = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
      if (!hoja.getLastRow()) hoja.appendRow(TABLAS_CRITERIOS_CEA[nombre]);
      const anchosClave={Criterios_Configuracion:2,Criterios_Definiciones:3,Criterios_Notas:4,Criterios_Resultados:4};
      const claveFila=f=>JSON.stringify(anchosClave[nombre] ? f.slice(0,anchosClave[nombre]) : f);
      const existentes = new Set(hoja.getDataRange().getValues().slice(1).map(claveFila));
      const nuevas = recuperar.filter(f => {const clave=claveFila(f);if(existentes.has(clave))return false;existentes.add(clave);return true;});
      if (!nuevas.length) continue;
      const ancho=TABLAS_CRITERIOS_CEA[nombre].length, posicion=hoja.getLastRow()+1;
      if (posicion+nuevas.length-1>hoja.getMaxRows()) hoja.insertRowsAfter(hoja.getMaxRows(),posicion+nuevas.length-1-hoja.getMaxRows());
      const rango=hoja.getRange(posicion,1,nuevas.length,ancho);
      applied.push(respaldoRangoMatriculaCEA(rango));
      rango.setValues(nuevas.map(f=>Array.from({length:ancho},(_,i)=>f[i]??'')));
    }
    guardarPapeleraMatriculasCEA(ss, Array.from(byId.values()));
    SpreadsheetApp.flush();
  } catch (error) {
    applied.reverse().forEach(item => item.range.setValues(item.original));
    SpreadsheetApp.flush();
    throw error;
  }
  const saved = leerMatriculasCEA(ss).filter(est => permisoAreaCEA(auth, est.areaKey, true));
  return {status: 'success', estudiantes: saved.filter(est => est.estadoMatricula !== 'ELIMINADO'), papelera: saved.filter(est => est.estadoMatricula === 'ELIMINADO'), notasEliminadas: notas.ids, registrosEliminados: notas.registrosEliminados,
    ...(traslado ? {trasladoCurso: {cantidad: cambios.length, omitidas: traslado.omitidas, destino: traslado.destino}} : {})};
}

function organizarRespaldoNominaCEA() {
  const lock = LockService.getScriptLock();
  lock.waitLock(28000);
  try {
    presentarRespaldoNominaCEA(obtenerSpreadsheetPrincipal());
  } finally {
    lock.releaseLock();
  }
}

function sincronizarBorradosCEA() {
  const lock = LockService.getScriptLock();
  lock.waitLock(28000);
  try {
    const ss = obtenerSpreadsheetPrincipal();
    const pendientes = leerMatriculasCEA(ss, false).filter(est => est.estadoMatricula === 'ELIMINADO');
    if (!pendientes.length) return {status: 'success', matriculasLimpiadas: 0};
    const resultado = actualizarMatriculasCEA(ss, {
      cambios: pendientes.map(est => ({id: est.matriculaId, version: est.version, operacion: 'baja', motivo: est.motivoEliminacion}))
    }, {r: 'director'});
    return {...resultado, matriculasLimpiadas: pendientes.length};
  } finally {
    lock.releaseLock();
  }
}

function presentarRespaldoNominaCEA(ss) {
  const sheet = ss.getSheetByName('Nomina_Respaldo');
  exigirCEA(sheet, 'Primero crea el respaldo con configurarSistemaCEA.');
  const headers = ['N.º', 'Estudiante', 'CI', 'RUDE', 'Área', 'Carrera', 'Nivel', 'Paralelo', 'Gestión', 'Semestre', 'Turno', 'Estado', 'ID Matrícula'];
  const saved = sheet.getRange(1, 1, Math.max(1, sheet.getLastRow()), 1).getValues();
  const rows = saved.slice(1).map(([json], index) => {
    if (!json) return headers.map(() => '');
    const est = JSON.parse(json);
    const semestre = /^hoja\b/i.test(String(est.semestre || '')) ? 'Por revisar (' + est.semestre + ')' : est.semestre;
    return [index + 1, est.nombreCompleto, est.ci, est.rude, est.rama, est.carreraNombre,
      est.nivel, est.paralelo, est.gestion, semestre, est.turno, est.estadoMatricula, est.matriculaId || est.id]
      .map(value => typeof value === 'number' ? value : String(value || '').replace(/^=/, "'="));
  });
  const range = sheet.getRange(1, 2, rows.length + 1, headers.length);
  range.setNumberFormat('@').setValues([headers].concat(rows));
  aplicarEstiloEncabezado(sheet, headers.length + 1);
  sheet.hideColumns(1);
  sheet.autoResizeColumns(2, headers.length);
  if (!sheet.getFilter() && rows.length) range.createFilter();
}

function leerRespaldoNominaCEA(ss) {
  const sheet = ss.getSheetByName('Nomina_Respaldo');
  if (!sheet) return [];
  return sheet.getDataRange().getValues().slice(1).filter(row => row[0]).map(row => JSON.parse(row[0]));
}

function migrarPapeleraCEA(ss) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('CEA_PAPELERA_MIGRADA') === '2') return;
  const sheet = ss.getSheetByName('Papelera_Recuperacion');
  const list = leerMatriculasCEA(ss);
  if (sheet) sheet.getDataRange().getValues().slice(1).forEach((row, index) => {
    if (!row[8] && !row[10]) return;
    const id = 'PAP-' + hashCEA([row, index]);
    if (list.some(est => est.matriculaId === id)) return;
    const career = String(row[4] || '');
    const norm = career.toLowerCase();
    const key = /sistem|informa/.test(norm) ? 'tec-sis' : /secre/.test(norm) ? 'tec-sec' : /gastro/.test(norm) ? 'tec-gas' : /agro/.test(norm) ? 'tec-agr' : /textil|confecc/.test(norm) ? 'tec-tex' : /belleza/.test(norm) ? 'tec-bel' : /human/.test(norm) ? 'hum-humanistica' : career;
    list.push({id: id, matriculaId: id, gestion: String(row[1]), semestre: String(row[2]), rama: row[3], carreraNombre: career, areaKey: key, nivel: row[5], paralelo: row[6], turno: row[7], ci: String(row[8]), rude: String(row[9]), nombreCompleto: row[10], genero: row[11], estadoMatricula: 'ELIMINADO', fechaEliminacion: row[12], motivoEliminacion: row[14]});
  });
  guardarMatriculasCEA(ss, list);
  props.setProperty('CEA_PAPELERA_MIGRADA', '2');
}


// El número de módulo identifica la planilla; su nombre es solo una etiqueta editable.
function posicionFilaModuloCEA(fila,cabecera) {
  const fijo=Number(fila[cabecera.indexOf('ModuloNumero')]);
  if(Number.isInteger(fijo)&&fijo>=1&&fijo<=(fila[1]==='humanistica'?2:5))return fijo;
  const id=String(fila[0]||'');
  if(fila[1]==='humanistica')return /-HUM[A-Z0-9]*M2-\d{4}-S[12]-P/i.test(id)||/-M2$/i.test(String(fila[cabecera.indexOf('ModuloCodigoFijo')]||''))?2:1;
  const clave=id.match(/-(?:m[oó]?dulo|mod)([ivx]+|\d+)-\d{4}-s[12]-p/i)?.[1];
  const numero=numeroModuloSistemasCEA(clave)||numeroModuloSistemasCEA(fila[cabecera.indexOf('ModuloCodigoFijo')])||numeroModuloSistemasCEA(String(fila[5]||'').split(':')[0]);
  return numero?((numero-1)%5)+1:null;
}
function columnasModuloCEA(filas){
  for(const nombre of ['ModuloNumero','ModuloCodigoFijo'])if(!filas[0].includes(nombre))filas[0].push(nombre);
  return {numero:filas[0].indexOf('ModuloNumero'),codigo:filas[0].indexOf('ModuloCodigoFijo')};
}
function catalogoModuloFijoCEA(ss,area,nivel,tipo){
  const filas=ss.getSheetByName('Mallas_Curriculares')?.getDataRange().getValues().slice(1)||[];
  const propias=filas.filter(f=>areaCanonicaCEA(f[0])===areaCanonicaCEA(area)&&nivelNotasCEA(f[1])===nivelNotasCEA(nivel));
  const inicial=tipo==='humanistica'?0:({basico:0,auxiliar:5,medio1:10,medio2:15}[nivelNotasCEA(nivel)]||0);
  const romanos=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX'];
  return Array.from({length:tipo==='humanistica'?2:5},(_,i)=>{const fila=propias.find(f=>Number(f[4])===i+1)||propias.find(f=>tipo==='humanistica'?(/-M2$/i.test(String(f[2]))?2:1)===i+1:((numeroModuloSistemasCEA(f[2])-1)%5)+1===i+1);return {numero:i+1,codigo:tipo==='humanistica'?area+(i?'-M2':''):'Módulo '+romanos[inicial+i],nombre:String(fila?.[3]||'Módulo '+(i+1))};});
}
function fijarIdentidadModulosCEA(ss,area,ids){
  const sheet=ss.getSheetByName('Calificaciones_Registros');if(!sheet||sheet.getLastRow()<2)return;
  const filas=sheet.getDataRange().getValues(),campos=columnasModuloCEA(filas);
  for(const fila of filas.slice(1)){
    if(areaCanonicaCEA(fila[2])!==areaCanonicaCEA(area)||(ids&&!ids.has(String(fila[0]))))continue;
    let numero=posicionFilaModuloCEA(fila,filas[0]);
    const catalogo=catalogoModuloFijoCEA(ss,fila[2],fila[4],fila[1]);
    if(!numero){const nombre=String(fila[5]||'').replace(/^[^:]+:\s*/, '').trim();const candidatos=catalogo.filter(m=>m.nombre===nombre);if(candidatos.length===1)numero=candidatos[0].numero;}
    exigirCEA(numero,'Hay una planilla antigua sin número de módulo verificable. No se cambió la malla ni las notas. Revisa su identificación antes de continuar.','MODULO_AMBIGUO');
    fila[campos.numero]=numero;fila[campos.codigo]=catalogo[numero-1].codigo;
  }
  escribirTablaCEA(ss,'Calificaciones_Registros',filas);
}
function actualizarEtiquetasMallaCEA(ss,area){
  const sheet=ss.getSheetByName('Calificaciones_Registros');if(!sheet||sheet.getLastRow()<2)return;
  const filas=sheet.getDataRange().getValues(),campos=columnasModuloCEA(filas),cache=new Map();
  for(const fila of filas.slice(1))if(areaCanonicaCEA(fila[2])===areaCanonicaCEA(area)){
    const numero=posicionFilaModuloCEA(fila,filas[0]),key=String(fila[4]);if(!cache.has(key))cache.set(key,catalogoModuloFijoCEA(ss,area,fila[4],fila[1]));const modulo=cache.get(key)[numero-1];
    if(modulo){fila[5]=modulo.codigo+': '+modulo.nombre;fila[campos.codigo]=modulo.codigo;fila[campos.numero]=numero;}
  }
  escribirTablaCEA(ss,'Calificaciones_Registros',filas);
}


function prepararTrasladoNotasCEA(ss,data,auth){
  const filas=ss.getSheetByName('Calificaciones_Registros')?.getDataRange().getValues()||[],origen=filas.slice(1).find(r=>String(r[0])===String(data.idRegistro));
  exigirCEA(origen,'No se encontró el registro de origen en el servidor. Guarda las notas de ese módulo y vuelve a intentar.','REGISTRO_NO_GUARDADO');
  exigirCEA(auth.r==='director'||permisoAreaCEA(auth,origen[2],false),'Solo puedes trasladar notas de tu especialidad.','PERMISO');
  const destino=data.destino||{},numero=Number(destino.moduloNumero),tipo=String(origen[1]),nivel=String(destino.nivel||origen[4]),paralelo=String(destino.paralelo||origen[9]||'A').trim().toUpperCase();
  exigirCEA(Number.isInteger(numero)&&numero>=1&&numero<=(tipo==='humanistica'?2:5)&&paralelo.length<=12&&paralelo.length>0,'Selecciona un módulo y paralelo válidos.');
  exigirCEA((tipo==='humanistica'?['basico','auxiliar','aplicados','complementarios','especializados']:['basico','auxiliar','medio1','medio2']).includes(nivelNotasCEA(nivel)),'Selecciona un nivel válido.');
  const numeroOrigen=posicionFilaModuloCEA(origen,filas[0]);exigirCEA(numeroOrigen,'No se puede identificar el módulo de origen sin ambigüedad.');
  exigirCEA(!(nivelNotasCEA(nivel)===nivelNotasCEA(origen[4])&&paralelo===String(origen[9]||'A').toUpperCase()&&numero===numeroOrigen),'Selecciona un módulo de destino diferente.');
  const candidatos=filas.slice(1).filter(r=>areaCanonicaCEA(r[2])===areaCanonicaCEA(origen[2])&&nivelNotasCEA(r[4])===nivelNotasCEA(nivel)&&String(r[8])===String(origen[8])&&/2|segundo/i.test(r[7])===/2|segundo/i.test(origen[7])&&String(r[9]||'A').toUpperCase()===paralelo&&posicionFilaModuloCEA(r,filas[0])===numero);
  exigirCEA(candidatos.length<=1,'Hay más de una planilla en el destino. Revisa los registros antes de trasladar.','MODULO_AMBIGUO');
  const destinoFila=candidatos[0]||null,detalles=ss.getSheetByName('Calificaciones_Detalle')?.getDataRange().getValues()||[],sourceD=detalles.slice(1).filter(d=>String(d[1])===String(origen[0])),destD=destinoFila?detalles.slice(1).filter(d=>String(d[1])===String(destinoFila[0])):[];
  const evaluado=d=>d.slice(8,15).some(v=>v!==''&&v!=null)||Number(d[15])>0||d[19]===true;
  exigirCEA(sourceD.some(evaluado),'El módulo de origen no tiene notas guardadas.');
  const moviendoNivel=nivelNotasCEA(nivel)!==nivelNotasCEA(origen[4])||paralelo!==String(origen[9]||'A').toUpperCase();
  const matriculas=moviendoNivel?leerMatriculasCEA(ss):[];
  function curso(n,p){return matriculas.filter(e=>e.estadoMatricula!=='ELIMINADO'&&String(e.gestion)===String(origen[8])&&/2|segundo/i.test(e.semestre)===/2|segundo/i.test(origen[7])&&nivelNotasCEA(e.nivel)===nivelNotasCEA(n)&&String(e.paralelo||'A').toUpperCase()===p&&(areaCanonicaCEA(e.areaKey)===areaCanonicaCEA(origen[2])||(tipo==='humanistica'&&areaCanonicaCEA(e.areaKey)==='hum-humanistica')));}
  function enlazar(ds,estudiantes){const mapa=new Map();for(const d of ds){const ci=String(d[6]||'').trim().toUpperCase(),rude=String(d[7]||'').trim().toUpperCase(),nombre=[d[3],d[4],d[5]].filter(Boolean).join(' ').replace(/\s+/g,' ').trim().toUpperCase();const encontrados=estudiantes.filter(e=>ci?String(e.ci||'').trim().toUpperCase()===ci:rude?String(e.rude||'').trim().toUpperCase()===rude:[e.paterno,e.materno,e.nombres].filter(Boolean).join(' ').replace(/\s+/g,' ').trim().toUpperCase()===nombre);if(encontrados.length===1)mapa.set(String(d[0]),encontrados[0]);}return mapa;}
  const mapaOrigen=moviendoNivel?enlazar(sourceD,curso(nivel,paralelo)):null,mapaDestino=moviendoNivel&&destinoFila?enlazar(destD,curso(origen[4],String(origen[9]||'A').toUpperCase())):null;
  const faltantesOrigen=mapaOrigen?sourceD.length-mapaOrigen.size:0,faltantesDestino=mapaDestino?destD.length-mapaDestino.size:0;
  const catalogo=catalogoModuloFijoCEA(ss,origen[2],nivel,tipo),modulo=catalogo[numero-1];
  const version=hashCEA([origen,destinoFila,sourceD,destD,catalogo]);
  return {filas,detalles,origen,destinoFila,sourceD,destD,mapaOrigen,mapaDestino,modulo,numeroOrigen,nivel,paralelo,numero,version,
    vista:{status:'success',version,origen:{id:origen[0],nivel:origen[4],paralelo:origen[9],moduloNumero:numeroOrigen,modulo:origen[5]},destino:{id:destinoFila?.[0]||null,nivel,paralelo,moduloNumero:numero,modulo:modulo.codigo+': '+modulo.nombre},estudiantes:sourceD.length,conNotas:sourceD.filter(evaluado).length,destinoConNotas:destD.filter(evaluado).length,faltantesOrigen,faltantesDestino,puedeMover:!destD.some(evaluado)&&!faltantesOrigen,puedeIntercambiar:Boolean(destinoFila)&&!faltantesOrigen&&!faltantesDestino}};
}
function trasladarNotasModuloCEA(ss,data,auth){
  const ctx=prepararTrasladoNotasCEA(ss,data,auth);exigirCEA(data.baseVersion===ctx.version,'Las notas o la malla cambiaron mientras revisabas el traslado. Vuelve a consultar el destino.','CONFLICTO');
  exigirCEA(['mover','intercambiar'].includes(data.modo),'Selecciona trasladar o intercambiar.');
  exigirCEA(data.modo==='mover'?ctx.vista.puedeMover:ctx.vista.puedeIntercambiar,ctx.vista.faltantesOrigen||ctx.vista.faltantesDestino?'Para trasladar entre niveles o paralelos, los mismos estudiantes deben estar afiliados en el destino.':'El destino tiene notas. Selecciona Intercambiar para conservar ambos registros.');
  // Una planilla antigua sin identificar en otro curso no debe impedir
  // intercambiar dos registros cuya identidad ya fue comprobada.
  fijarIdentidadModulosCEA(ss,ctx.origen[2],new Set([String(ctx.origen[0]),...(ctx.destinoFila?[String(ctx.destinoFila[0])]:[])]));
  const filas=ss.getSheetByName('Calificaciones_Registros').getDataRange().getValues(),campos=columnasModuloCEA(filas),origen=filas.slice(1).find(r=>String(r[0])===String(ctx.origen[0])),destino=ctx.destinoFila?filas.slice(1).find(r=>String(r[0])===String(ctx.destinoFila[0])):null;
  const antes={origen:origen.slice(),destino:destino?.slice()||null},cambios=new Map();
  function mover(fila,nivel,paralelo,numero){const modulo=catalogoModuloFijoCEA(ss,fila[2],nivel,fila[1])[numero-1];fila[4]=nivel;fila[9]=paralelo;fila[5]=modulo.codigo+': '+modulo.nombre;fila[campos.numero]=numero;fila[campos.codigo]=modulo.codigo;fila[12]=new Date().toISOString();fila[13]=auth.u;if(fila[11]==='PUBLICADO')fila[11]='EN EDICION';for(const n of ['EstadoPublicacion','FechaPublicacion']){const i=filas[0].indexOf(n);if(i>=0)fila[i]='';}cambios.set(String(fila[0]),fila);}
  mover(origen,ctx.nivel,ctx.paralelo,ctx.numero);if(destino)mover(destino,ctx.origen[4],String(ctx.origen[9]||'A'),ctx.numeroOrigen);
  const idsDetalles=new Map();for(const [ds,mapa]of [[ctx.sourceD,ctx.mapaOrigen],[ctx.destD,ctx.mapaDestino]])if(mapa)for(const d of ds){const est=mapa.get(String(d[0]));exigirCEA(est?.matriculaId,'No se confirmó la matrícula de destino.');idsDetalles.set(String(d[0]),'DET-'+d[1]+'-'+est.matriculaId);}
  if(idsDetalles.size){const filasD=ctx.detalles;for(const d of filasD.slice(1))if(idsDetalles.has(String(d[0])))d[0]=idsDetalles.get(String(d[0]));escribirTablaCEA(ss,'Calificaciones_Detalle',filasD);}
  for(const nombre of Object.keys(TABLAS_CRITERIOS_CEA)){
    const sheet=ss.getSheetByName(nombre);if(!sheet||sheet.getLastRow()<2)continue;const datos=sheet.getDataRange().getValues();let cambio=false;
    for(const f of datos.slice(1)){const reg=cambios.get(String(f[0]));if(!reg)continue;if(nombre==='Criterios_Configuracion'){f[4]=Utilities.getUuid();f[8]=reg[4];f[9]=reg[9];f[10]=reg[5];cambio=true;}const indice=nombre==='Criterios_Notas'?3:nombre==='Criterios_Resultados'?2:-1;if(indice>=0&&idsDetalles.has(String(f[indice]))){f[indice]=idsDetalles.get(String(f[indice]));cambio=true;}}
    if(cambio)escribirTablaCEA(ss,nombre,datos);
  }
  escribirTablaCEA(ss,'Calificaciones_Registros',filas);
  const historial=ss.getSheetByName('Traslados_Notas')||ss.insertSheet('Traslados_Notas');if(!historial.getLastRow())historial.appendRow(['ID','Fecha','Usuario','Modo','AntesJSON','DespuesJSON','DetalleIDsJSON']);
  const id=data.requestId||Utilities.getUuid();historial.appendRow([id,new Date().toISOString(),auth.u,data.modo,JSON.stringify(antes),JSON.stringify({origen,destino}),JSON.stringify([...idsDetalles])]);
  return {status:'success',trasladoConfirmado:true,id,registros:[...cambios.keys()],destino:ctx.vista.destino,estudiantes:ctx.sourceD.length,publicacionPendiente:true};
}
