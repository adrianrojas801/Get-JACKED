// Fails if any of the app's scripts has a syntax error, or if index.html and the js/ folder disagree
// about which files make up the app.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const loaded = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);
const onDisk = fs.readdirSync('js').filter(f => f.endsWith('.js')).map(f => 'js/' + f);
let bad = false;
const fail = msg => { console.error(msg); bad = true; };
if (!loaded.length) fail('index.html loads no js/ files');
for (const f of onDisk) if (!loaded.includes(f)) fail(`${f} exists but index.html doesn't load it`);
for (const f of loaded) if (!onDisk.includes(f)) fail(`index.html loads ${f}, which doesn't exist`);
if (/<script>(?!\s*<\/script>)/.test(html)) fail('index.html has an inline <script>; app code belongs in js/');
if (!fs.existsSync('css/app.css') || !html.includes('href="css/app.css"')) fail('css/app.css is missing or not linked');
// The service worker keeps these files for offline use, so its list has to match.
const sw = fs.readFileSync('sw.js', 'utf8');
for (const f of [...loaded, 'css/app.css']) if (!sw.includes(`'${f}'`)) fail(`sw.js doesn't list ${f} in SHELL`);
for (const f of [...loaded.filter(f => onDisk.includes(f)), 'config.js', 'sw.js']) {
  try { new Function(fs.readFileSync(f, 'utf8')); } catch (e) { fail(`${f}: ${e.message}`); }
}
if (bad) process.exit(1);
console.log(`Syntax OK (${loaded.length} app files + config.js + sw.js)`);
