with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

import re
matches = [m.start() for m in re.finditer(r'<[a-zA-Z0-9]+\s+[^>]*id=["\']directorLiveBar["\']', html)]
print("Markup matches for directorLiveBar:", matches)
for pos in matches:
    print(html[pos-100:pos+500])
