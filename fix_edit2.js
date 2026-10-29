const fs = require('fs');
const file = 'src/app/vehicles/page.tsx';
let s = fs.readFileSync(file, 'utf8');
if (s.indexOf('Edit') === -1) {
  const marker = '} from "lucide-react"';
  const idx = s.indexOf(marker);
  if (idx >= 0) {
    s = s.slice(0, idx) + ',\n  Edit' + s.slice(idx);
    fs.writeFileSync(file, s);
    console.log('ok');
  } else {
    console.log('no');
  }
} else {
  console.log('has');
}
