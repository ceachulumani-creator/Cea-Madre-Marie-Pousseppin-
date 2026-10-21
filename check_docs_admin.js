const fs = require('fs');
const app = fs.readFileSync('app.js', 'utf8');

let idx = 0;
while ((idx = app.indexOf('cargarDocumentosOficialesAdmin', idx)) !== -1) {
  console.log(app.substring(idx - 50, idx + 800));
  idx += 30;
}
