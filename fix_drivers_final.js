const fs = require('fs');
let s = fs.readFileSync('src/app/drivers/page.tsx', 'utf8');
const idx = s.indexOf('        {!loading && !error && totalPages > 1 && (');
if (idx > -1) {
  const end = s.indexOf('      </section>', idx);
  if (end > -1) {
    const prefix = s.slice(0, idx);
    const suffix = s.slice(end);
    s = prefix + "        {!loading && !error && totalPages > 1 && (\n          <div className=\"pagination\">\n            <button className=\"btn btn-ghost\" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Sebelumnya</button>\n            <span className=\"pagination-info\">Halaman {page} / {totalPages}</span>\n            <button className=\"btn btn-ghost\" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Selanjutnya</button>\n          </div>\n        )}\n" + suffix;
    fs.writeFileSync('src/app/drivers/page.tsx', s);
    console.log('ok');
  }
}
