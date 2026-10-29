const fs = require('fs');
let s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
s = s.split('        )}]\n      </section>').join('        )}\n      </section>');
fs.writeFileSync('src/app/drivers/page.tsx', s);
console.log('done');
