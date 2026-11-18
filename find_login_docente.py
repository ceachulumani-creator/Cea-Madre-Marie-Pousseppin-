import re

for fn in ['app.js', 'calificaciones.js']:
    with open(fn, 'r', encoding='utf-8') as f:
        content = f.read()
    for m in re.finditer(r'function (?:iniciarSesionDocente|renderDocenteCalificaciones|abrirPanelDocente|mostrarPanelDocente)', content):
        print(f"=== {fn}: {m.group(0)} ===")
        print(content[m.start():m.start()+1200])
