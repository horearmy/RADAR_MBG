const fs = require('fs');
const s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
const lines = s.split('\n');
for (let i=0;i<lines.length;i++) {
  if (lines[i].includes('export default')) console.log(i+1, lines[i]);
}
