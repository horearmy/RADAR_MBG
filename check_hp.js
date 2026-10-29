const fs=require('fs');
const s=fs.readFileSync('src/app/vehicles/page.tsx','utf8');
const re=/hasPermission\([^)]+\)/g;
let m;
while((m=re.exec(s))){
  console.log(m[0]);
}
