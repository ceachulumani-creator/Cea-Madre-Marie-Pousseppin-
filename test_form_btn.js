const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

// Find where #btn-enviar-preinscripcion is defined in index.html
const idxBtn = html.indexOf('id="btn-enviar-preinscripcion"');
console.log('Button HTML:');
console.log(html.substring(idxBtn - 50, idxBtn + 150));

// Find ejecutarAccionEnviarPreInscripcion
const idxFunc = html.indexOf('function ejecutarAccionEnviarPreInscripcion');
console.log('ejecutarAccionEnviarPreInscripcion:');
console.log(html.substring(idxFunc, idxFunc + 300));
