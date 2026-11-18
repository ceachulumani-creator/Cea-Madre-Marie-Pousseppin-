import re

with open('app.js', 'r', encoding='utf-8') as f:
    app = f.read()

m = re.search(r'function mostrarPanelAdmin\b', app)
if m:
    print(app[m.start():m.start()+1500])
