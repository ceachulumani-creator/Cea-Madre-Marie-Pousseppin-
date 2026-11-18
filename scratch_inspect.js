const fs = require('fs');
const calif = fs.readFileSync('calificaciones.js', 'utf8');

const target2 = '// ── KÁRDEX INSTITUCIONAL 2026: VISTA OFICIAL INLINE CON MODO LECTURA Y EDICIÓN INMEDIATA ──';
const idx2 = calif.indexOf(target2);
console.log(calif.substring(idx2 + 5500, idx2 + 7500));
