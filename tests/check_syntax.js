// Fails if any inline <script> block in index.html (or config.js) has a syntax error.
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (!blocks.length) { console.error('No inline <script> found in index.html'); process.exit(1); }
blocks.forEach((code, i) => {
  try { new Function(code); } catch (e) { console.error(`index.html script #${i + 1}: ${e.message}`); process.exit(1); }
});
for (const f of ['config.js', 'sw.js']) {
  try { new Function(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`${f}: ${e.message}`); process.exit(1); }
}
console.log(`Syntax OK (${blocks.length} inline script block(s) + config.js + sw.js)`);
