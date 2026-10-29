const fs = require('fs');
let s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
// Remove trailing whitespace/newlines and ensure ends properly
s = s.replace(/\r?\n+$/, '\n');
fs.writeFileSync('src/app/drivers/page.tsx', s);
console.log('done');
