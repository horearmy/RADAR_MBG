const fs = require('fs');
let s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
s = s.replace(/                \)\}\]/g, '                })');
s = s.replace(/          <\/div>\r?\n        \)\}\]/g, '          </div>\r\n        )}');
s = s.replace(/          <\/div>\n        \)\}\]/g, '          </div>\n        )}');
fs.writeFileSync('src/app/drivers/page.tsx', s);
console.log('done');
