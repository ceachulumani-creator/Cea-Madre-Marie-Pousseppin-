/* PDF de texto y graficos: no depende de capturas HTML, del scroll ni del canvas. */
(function () {
  'use strict';
  const escala = 72 / 25.4;
  const numero = n => Number(n).toFixed(2);
  const cp1252 = {'€':128,'‚':130,'ƒ':131,'„':132,'…':133,'†':134,'‡':135,'ˆ':136,'‰':137,'Š':138,'‹':139,'Œ':140,'Ž':142,'‘':145,'’':146,'“':147,'”':148,'•':149,'–':150,'—':151,'˜':152,'™':153,'š':154,'›':155,'œ':156,'ž':158,'Ÿ':159};
  function literal(valor) {
    let salida = '';
    for (const c of String(valor ?? '').normalize('NFC').replace(/[\r\n\t]+/g,' ')) {
      let codigo = c.codePointAt(0);
      if (codigo > 255) codigo = cp1252[c] || c.normalize('NFD').replace(/[\u0300-\u036f]/g,'').charCodeAt(0);
      if (codigo > 255 || codigo < 32) codigo = 63;
      salida += codigo > 126 ? '\\'+codigo.toString(8).padStart(3,'0') : /[()\\]/.test(String.fromCharCode(codigo)) ? '\\'+String.fromCharCode(codigo) : String.fromCharCode(codigo);
    }
    return '('+salida+')';
  }
  const color = hex => hex.replace('#','').match(/../g).map(v=>numero(parseInt(v,16)/255)).join(' ');
  const anchoTexto = (texto,tamano) => {
    // Cota conservadora con las metricas de Helvetica, en puntos.
    let ancho = 0;
    for (const c of String(texto)) ancho += /[ilI.,'!:;| ]/.test(c) ? .29 : /[MW@%]/.test(c) ? .9 : /[A-ZÁÉÍÓÚÑ]/.test(c) ? .68 : .56;
    return ancho*tamano/escala;
  };
  function dividir(texto, ancho, tamano) {
    const lineas = []; let linea = '';
    for (const palabra of String(texto || '').split(/\s+/).filter(Boolean)) {
      if (linea && anchoTexto(linea+' '+palabra,tamano)>ancho) { lineas.push(linea); linea=''; }
      if (anchoTexto(palabra,tamano)>ancho) {
        for (const letra of palabra) {
          if (anchoTexto(linea+letra,tamano)>ancho && linea) { lineas.push(linea); linea=''; }
          linea+=letra;
        }
      } else linea += (linea ? ' ' : '')+palabra;
    }
    if (linea || !lineas.length) lineas.push(linea);
    return lineas;
  }
  window.crearPDFBoletinIndividual = function(datos) {
    if (!datos?.cursos?.length) throw new Error('No hay un boletín seleccionado.');
    const paginas = []; let comandos, y;
    const rect = (x,top,w,h,relleno) => comandos.push(color(relleno)+' rg '+[x*escala,(297-top-h)*escala,w*escala,h*escala].map(numero).join(' ')+' re f');
    const texto = (valor,x,top,tamano=10,negrita=false,tinta='#183c2a') => comandos.push('BT /'+(negrita?'F2':'F1')+' '+tamano+' Tf '+color(tinta)+' rg 1 0 0 1 '+numero(x*escala)+' '+numero((297-top)*escala)+' Tm '+literal(valor)+' Tj ET');
    function escribirLineas(lineas,x,top,tamano=10,negrita=false,tinta) {
      lineas.forEach((linea,i)=>texto(linea,x,top+i*tamano*.46,tamano,negrita,tinta));
      return lineas.length*tamano*.46;
    }
    function tablaCabecera() {
      rect(16,y,178,11,'#14532d');
      texto('Módulo y docente',20,y+7,10,true,'#ffffff');
      texto('Nota final',133,y+7,9,true,'#ffffff');
      texto('Observación',158,y+7,9,true,'#ffffff');
      y+=11;
    }
    function pagina(curso,continuacion=false) {
      comandos=[]; paginas.push(comandos);
      rect(0,0,210,52,'#0c4226');
      escribirLineas(dividir(datos.institucion,177,11),16,15,11,true,'#ffffff');
      texto('Boletín individual',16,34,22,true,'#ffffff');
      texto('DE CALIFICACIONES'+(continuacion?' · CONTINUACIÓN':''),16,43,10,false,'#d2edda');
      y=65;
      y+=escribirLineas(dividir(datos.nombre,178,16),16,y,16,true)+5;
      const pares=[['Cédula de identidad',curso.ci||datos.ci,'Gestión / semestre',datos.gestion+' · '+datos.semestre],['Área / carrera',curso.carrera,'Curso / paralelo',curso.nivel+' · '+(curso.paralelo||'A')]];
      if(curso.sede)pares.push(['Centro / sede',curso.sede,'','']);
      for(const [a,b,c,d] of pares){
        texto(a,16,y,8,false,'#5b7064');if(c)texto(c,108,y,8,false,'#5b7064');
        const izq=dividir(b,85,10),der=dividir(d,85,10);
        escribirLineas(izq,16,y+5,10,true);escribirLineas(der,108,y+5,10,true);
        y+=Math.max(izq.length,der.length)*4.6+10;
      }
      y+=3;tablaCabecera();
    }
    for(const curso of datos.cursos){
      pagina(curso);
      for(const [indice,m] of curso.modulos.entries()){
        const titulo=dividir('Módulo '+m.numero+' · '+m.nombre,106,10);
        const docente=dividir('Docente: '+(m.docente||'Por registrar'),106,8);
        const estado=dividir(m.observacion,32,9);
        const alto=Math.max(23,9+titulo.length*4.6+docente.length*3.7,8+estado.length*4.2);
        if(y+alto>260)pagina(curso,true);
        rect(16,y,178,alto,indice%2?'#f1f6f3':'#ffffff');
        rect(16,y+alto-.3,178,.3,'#d6e3da');
        escribirLineas(titulo,20,y+7,10,true);
        escribirLineas(docente,20,y+9+titulo.length*4.6,8,false,'#5b7064');
        texto(m.nota==null?'—':String(m.nota),135,y+alto/2+2,m.nota==null?14:19,true,m.nota!=null&&m.nota<51?'#9f3535':'#14532d');
        escribirLineas(estado,158,y+7,9,false,'#3f5b4b');
        y+=alto;
      }
      if(y+25>264)pagina(curso,true);
      y+=5;rect(16,y,178,18,'#e5f0e9');
      texto(curso.completo?'Promedio final del curso':'Promedio de módulos publicados',20,y+6,9,true);
      texto(curso.promedio==null?'—':String(curso.promedio),170,y+12,19,true);
      texto(curso.evaluados+' de '+curso.modulos.length+' módulos con nota · Escala de 0 a 100',20,y+12,8,false,'#5b7064');
      y+=24;
      for(const m of curso.sinUbicar||[]){
        const lineas=dividir('Registro por identificar: '+m.nombre+' · Nota final: '+(m.nota==null?'—':m.nota),178,9);
        if(y+lineas.length*4.2>265)pagina(curso,true);
        y+=escribirLineas(lineas,16,y,9)+3;
      }
    }
    paginas.forEach((p,i)=>{
      comandos=p;
      rect(16,276,178,.4,'#b8d0c0');
      texto('Calificaciones publicadas · Boletín institucional de consulta',16,282,8,false,'#5b7064');
      texto('Emitido el '+datos.fecha,16,287,8,false,'#5b7064');
      texto('Página '+(i+1)+' de '+paginas.length,170,287,8,false,'#5b7064');
    });
    const objetos=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count '+paginas.length+' /Kids ['+paginas.map((_,i)=>(5+i*2)+' 0 R').join(' ')+'] >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'];
    paginas.forEach((p,i)=>{
      const contenido=p.join('\n');
      objetos.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+(6+i*2)+' 0 R >>','<< /Length '+contenido.length+' >>\nstream\n'+contenido+'\nendstream');
    });
    const metadatos=objetos.length+1;
    objetos.push('<< /Title '+literal('Boletín de '+datos.nombre)+' /Author '+literal(datos.institucion)+' >>');
    let pdf='%PDF-1.4\n';const posiciones=[0];
    objetos.forEach((obj,i)=>{posiciones.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';});
    const xref=pdf.length;
    pdf+='xref\n0 '+(objetos.length+1)+'\n0000000000 65535 f \n'+posiciones.slice(1).map(p=>String(p).padStart(10,'0')+' 00000 n \n').join('');
    pdf+='trailer\n<< /Size '+(objetos.length+1)+' /Root 1 0 R /Info '+metadatos+' 0 R >>\nstartxref\n'+xref+'\n%%EOF';
    return new Blob([pdf],{type:'application/pdf'});
  };
})();
