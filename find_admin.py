with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

idx = html.find('id="admin"')
print("Found #admin at:", idx)
print(html[idx-100:idx+900])
