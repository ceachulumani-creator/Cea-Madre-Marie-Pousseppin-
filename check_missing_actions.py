import re

with open('google-apps-script.gs', 'r', encoding='utf-8', errors='ignore') as f:
    gs_text = f.read()

with open('list_actions.py', 'r', encoding='utf-8') as f:
    # run same logic
    pass

with open('app.js', 'r', encoding='utf-8', errors='ignore') as f:
    app_text = f.read()

actions = sorted(set(re.findall(r"action:\s*['\"]([^'\"]+)['\"]", app_text)))
print("Checking actions in google-apps-script.gs:")
missing = []
present = []
for a in actions:
    if f'"{a}"' in gs_text or f"'{a}'" in gs_text:
        present.append(a)
    else:
        missing.append(a)

print(f"Present ({len(present)}):", present)
print(f"MISSING ({len(missing)}):", missing)
