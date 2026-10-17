import re

with open('app.js', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

actions = set(re.findall(r"action:\s*['\"]([^'\"]+)['\"]", text))
print("Found actions:")
for a in sorted(actions):
    print(" -", a)
