const fs = require('fs');
const file = 'src/app/vehicles/page.tsx';
let s = fs.readFileSync(file, 'utf8');
if (!s.includes('Edit')) {
  // try to add after Car
  if (s.includes('"Car",')) {
    s = s.replace('"Car",', '"Car",\n  Edit,');
    fs.writeFileSync(file, s);
    console.log('added');
  } else {
    console.log('pattern not found');
  }
} else {
  console.log('exists');
}
