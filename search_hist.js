const fs = require('fs');
const transcript = fs.readFileSync('C:/Users/Betto/.gemini/antigravity/brain/d6685dfb-2aff-4f83-9e77-a37a0b4905a7/.system_generated/logs/transcript_full.jsonl', 'utf8');
const lines = transcript.split('\n');
const line = lines[1069];
const pos = line.indexOf("tabName === 'kardex'");
console.log(line.substring(pos, pos + 2500));
