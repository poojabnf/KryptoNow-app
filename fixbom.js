const fs   = require('fs');
const path = require('path');

const ROOT   = 'C:\\Kryptonow\\Kryptonow-app';
const SKIP   = new Set(['node_modules', '.expo', 'dist', '.git']);
let   fixed  = 0;
let   total  = 0;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      total++;
      try {
        const buf = fs.readFileSync(full);
        if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
          fs.writeFileSync(full, buf.slice(3));
          console.log('FIXED:', full.replace(ROOT, ''));
          fixed++;
        }
      } catch(e) {
        console.log('ERROR:', entry.name, e.message);
      }
    }
  }
}

console.log('Scanning', ROOT, '...\n');
walk(ROOT);
console.log('\nDone. Scanned ' + total + ' files, fixed ' + fixed + ' BOM(s).');
console.log('Now run: npx expo start --clear');


