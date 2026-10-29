const fs = require('fs');
let s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
s = s.replace('                })}]\r\n', '                })}\r\n');
s = s.replace('                })}]\n', '                })}\n');
s = s.replace('        )}]\r\n', '        )}\r\n');
s = s.replace('        )}]\n', '        )}\n');
fs.writeFileSync('src/app/drivers/page.tsx', s);
console.log('done');
