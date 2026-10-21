const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const start = html.indexOf('function manejarFormInscripcionOptimizado(e) {');
const end = html.indexOf('function vincularFormularioInscripcionOptimizado() {');
console.log(html.substring(start, end));
