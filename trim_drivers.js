const fs = require('fs');
let s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
s = s.trim();
if (!s.endsWith('}')) s += '\n}';
fs.writeFileSync('src/app/drivers/page.tsx', s + '\n');
console.log(s.slice(-5));
