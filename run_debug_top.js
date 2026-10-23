const { execSync } = require('child_process');
const path = require('path');
const html = path.resolve('debug_top_space.html');
const cmd = '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless=new --no-sandbox --disable-gpu --virtual-time-budget=8000 --dump-dom "file:///' + html.replace(/\\/g, '/') + '"';
try {
  const res = execSync(cmd, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const m = res.match(/<div id="output">(.*?)<\/div>/);
  console.log(m ? m[1] : res.substring(0, 300));
} catch(e) {
  console.error(e.message);
}
