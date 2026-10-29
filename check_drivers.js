const fs = require('fs');
const s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
console.log(JSON.stringify(s.slice(-60)));
