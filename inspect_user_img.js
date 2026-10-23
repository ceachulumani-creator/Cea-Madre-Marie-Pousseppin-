const fs = require('fs');
const path = 'C:/Users/Betto/.gemini/antigravity/brain/baf7737b-e727-48fc-9b22-21d766419c59/.user_uploaded/media_1792691001680_afd196c5.png';

// Read PNG header
const buf = fs.readFileSync(path);
const width = buf.readUInt32BE(16);
const height = buf.readUInt32BE(20);
console.log('Image dimensions:', width, 'x', height);
