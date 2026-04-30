const fs = require('fs');
const path = process.argv[2];
let c = fs.readFileSync(path, 'utf8');

// Map each label to its icon using unicode escape codes (no stripping possible)
const iconMap = {
  'Wallet Address':      '\uD83D\uDCCB',  // 📋
  'Export Private Key':  '\uD83D\uDD11',  // 🔑
  'Backup Seed Phrase':  '\uD83D\uDCDD',  // 📝
  'Active Network':      '\uD83C\uDF10',  // 🌐
  'Hide Balance':        '\uD83D\uDC41',  // 👁
  'Biometric Lock':      '\uD83D\uDD12',  // 🔒
  'Push Notifications':  '\uD83D\uDD14',  // 🔔
  'Testnet Mode':        '\uD83E\uDDEA',  // 🧪
  'Transaction History': '\uD83D\uDCDC',  // 📜
  'Wipe Wallet':         '\uD83D\uDDD1',  // 🗑
};

// Replace each empty icon: '' before each label
for (const [label, icon] of Object.entries(iconMap)) {
  // Match: icon: '', label: 'LABEL'  OR  icon: '', label: "LABEL"
  const regex = new RegExp(
    `(icon:\\s*')[^']*('\\s*,\\s*label:\\s*['"]${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"])`,
    'g'
  );
  const before = c;
  c = c.replace(regex, `$1${icon}$2`);
  if (c !== before) {
    console.log('Fixed icon for:', label, '→', icon);
  } else {
    console.log('NOT FOUND:', label);
  }
}

// Also fix the wipe wallet alert icon on line ~42
c = c.replace(/' Wipe Wallet'/, `'\uD83D\uDDD1 Wipe Wallet'`);

fs.writeFileSync(path, c, 'utf8');
console.log('\nDone! Verifying...');

// Verify
const result = fs.readFileSync(path, 'utf8');
const lines = result.split('\n');
lines.forEach((l, i) => {
  if (l.includes('icon:') && l.includes('label:')) {
    console.log(`Line ${i+1}: ${l.trim()}`);
  }
});
